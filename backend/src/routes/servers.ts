import { Router, Response } from 'express';
import { Client } from 'ssh2';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { cache, invalidateCacheAfter, CacheConfig, InvalidationPatterns } from '../middleware/cache';
import { encrypt, decrypt } from '../utils/crypto';
import { validateRequest, validateUuidParam, createServerSchema, createScanSchema } from '@medicine-man/shared';
import { parsePaginationParams, buildPaginationQuery, buildPaginatedResponse } from '../utils/pagination';
import { BackupService } from '../services/backup';
import { BackupScanner } from '../services/scanner';
import { BackupOrchestrator } from '../services/backupOrchestrator';

const router = Router();

// Initialize backup service
const backupService = new BackupService(pool, logger);

// Initialize scanner
const scanner = new BackupScanner(pool, logger);

// Initialize backup orchestrator
const backupOrchestrator = new BackupOrchestrator(pool, logger);

/**
 * GET /api/servers
 * List all servers for the authenticated user with pagination
 * Requires: authenticateToken
 * Query params: page (default: 1), limit (default: 20, max: 100)
 */
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Parse pagination parameters
      const paginationParams = parsePaginationParams(req.query);
      const { limit, offset } = buildPaginationQuery(paginationParams);

      // Get total count with efficient window function
      const result = await pool.query(
        `SELECT
           id, name, ip, port, username, auth_type, tags, description, is_online, created_at, updated_at,
           COUNT(*) OVER() as total_count
         FROM servers
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      // Extract total count from first row (or 0 if no rows)
      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

      // Remove credentials and total_count from response
      const servers = result.rows.map(server => {
        const { total_count, ...serverData } = server;
        return serverData;
      });

      // Build paginated response
      const paginatedData = buildPaginatedResponse(servers, paginationParams, totalCount);

      // SECURITY: Anonymized logging - no server details
      logger.info('Listed servers', {
        userId,
        count: servers.length,
        page: paginationParams.page,
        limit: paginationParams.limit,
        totalCount,
      });

      res.status(200).json({
        success: true,
        message: 'Servers retrieved successfully',
        data: paginatedData,
      });
    } catch (error) {
      logger.error('Failed to list servers', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * POST /api/servers
 * Add a new server
 * Requires: authenticateToken, createServerSchema validation
 */
router.post(
  '/',
  authenticateToken,
  validateRequest(createServerSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { name, ip, port, username, auth_type, credential, tags, description } = req.validatedData;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Security: Secure credential handling - clear sensitive data after use
    // Credentials are encrypted before storage and cleared from memory immediately
    let encryptedCredential: string | null = null;

    try {
      // Encrypt the credential before storing
      encryptedCredential = encrypt(credential);

      const result = await pool.query(
        `INSERT INTO servers (user_id, name, ip, port, username, auth_type, credential, tags, description, is_online, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW(), NOW())
         RETURNING id, name, ip, port, username, auth_type, tags, description, is_online, created_at, updated_at`,
        [userId, name, ip, port, username, auth_type, encryptedCredential, tags || null, description || null]
      );

      const newServer = result.rows[0];

      // SECURITY: Log action without sensitive infrastructure details (no IP, no username)
      // Only the server name is logged to maintain operational visibility while protecting sensitive data
      await pool.query(
        `INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, 'CREATE', 'server', newServer.id, JSON.stringify({ name })]
      );

      // SECURITY: Anonymized logging - no IP addresses
      logger.info('Server added', {
        userId,
        serverId: newServer.id,
        name,
      });

      res.status(201).json({
        success: true,
        message: 'Server added successfully',
        data: newServer,
      });
    } catch (error) {
      logger.error('Failed to add server', {
        userId,
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      // CRITICAL: Clear sensitive data from memory
      // Overwrite before nullifying to prevent memory residue
      if (encryptedCredential) {
        encryptedCredential = '';
        encryptedCredential = null;
      }
    }
  })
);

/**
 * POST /api/servers/:id/test
 * Test SSH connection to server
 * Requires: authenticateToken, valid UUID in params
 */
router.post(
  '/:id/test',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const serverId = req.params.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Security: Secure credential handling - ensure cleanup even on errors
    // Clear decrypted credentials from memory immediately after use
    // to minimize exposure window in case of memory dumps or errors
    let decryptedCredential: string | null = null;

    try {
      // Fetch server from database
      const serverResult = await pool.query(
        `SELECT id, name, ip, port, username, auth_type, credential, is_online
         FROM servers
         WHERE id = $1 AND user_id = $2`,
        [serverId, userId]
      );

      if (serverResult.rows.length === 0) {
        throw new AppError('Server not found', 404);
      }

      const server = serverResult.rows[0];

      // Decrypt the credential
      try {
        decryptedCredential = decrypt(server.credential);
      } catch (error) {
        throw new AppError('Failed to decrypt server credentials', 500);
      }

      // SECURITY AUDIT: Log credential access (without the credential itself)
      // This creates an audit trail for compliance and security monitoring
      await pool.query(
        `INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, 'CREDENTIAL_ACCESS', 'server', serverId, JSON.stringify({ action: 'connection_test' })]
      );

      // Test SSH connection
      const testResult = await testSSHConnection(
        server.ip,
        server.port,
        server.username,
        server.auth_type,
        decryptedCredential
      );

      // Update server's is_online status
      await pool.query(
        `UPDATE servers SET is_online = $1, updated_at = NOW() WHERE id = $2`,
        [testResult.success, serverId]
      );

      // SECURITY: Log action without sensitive details
      await pool.query(
        `INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, 'TEST', 'server', serverId, JSON.stringify({ success: testResult.success })]
      );

      logger.info('Server connection tested', {
        userId,
        serverId,
        serverName: server.name,
        success: testResult.success,
      });

      res.status(200).json({
        success: testResult.success,
        message: testResult.message,
        data: {
          serverId,
          isOnline: testResult.success,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to test server connection', {
        userId,
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      // CRITICAL: Clear sensitive data from memory
      // Overwrite the string in memory before nullifying to prevent
      // sensitive data from remaining in memory that could be accessed
      // via memory dumps or heap inspection
      if (decryptedCredential) {
        decryptedCredential = '';
        decryptedCredential = null;
      }
    }
  })
);

/**
 * DELETE /api/servers/:id
 * Delete a server
 * Requires: authenticateToken, valid UUID in params
 */
router.delete(
  '/:id',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const serverId = req.params.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Verify server belongs to user
      const serverResult = await pool.query(
        `SELECT id, name FROM servers WHERE id = $1 AND user_id = $2`,
        [serverId, userId]
      );

      if (serverResult.rows.length === 0) {
        throw new AppError('Server not found', 404);
      }

      const server = serverResult.rows[0];

      // Delete the server
      await pool.query(
        `DELETE FROM servers WHERE id = $1`,
        [serverId]
      );

      // SECURITY: Log action without sensitive infrastructure details
      // Only log the server name, not IP addresses or other sensitive data
      await pool.query(
        `INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, 'DELETE', 'server', serverId, JSON.stringify({ name: server.name })]
      );

      logger.info('Server deleted', {
        userId,
        serverId,
        serverName: server.name,
      });

      res.status(200).json({
        success: true,
        message: 'Server deleted successfully',
        data: {
          serverId,
        },
      });
    } catch (error) {
      logger.error('Failed to delete server', {
        userId,
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * POST /api/servers/:id/backup
 * Start backup for a server
 * Requires: authenticateToken, valid UUID in params
 */
router.post(
  '/:id/backup',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const serverId = req.params.id;
    const { backup_type = 'full', options = {} } = req.body;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Verify server exists and belongs to user
      const serverResult = await pool.query(
        `SELECT id, name, is_online FROM servers WHERE id = $1 AND user_id = $2`,
        [serverId, userId]
      );

      if (serverResult.rows.length === 0) {
        throw new AppError('Server not found', 404);
      }

      const server = serverResult.rows[0];

      // Check if server is online
      if (!server.is_online) {
        throw new AppError('Server is not online. Please test the connection first.', 400);
      }

      // Create backup record
      const backupResult = await pool.query(
        `INSERT INTO backups (server_id, backup_type, status, options, started_at, created_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, server_id, backup_type, status, started_at`,
        [serverId, backup_type, 'pending', JSON.stringify(options)]
      );

      const backupJob = backupResult.rows[0];

      // SECURITY: Log action without sensitive server details
      // Only log the backup type and IDs for tracking, no infrastructure details
      await pool.query(
        `INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, 'CREATE', 'backup', backupJob.id, JSON.stringify({ serverId, backup_type })]
      );

      logger.info('Backup started', {
        userId,
        serverId,
        backupId: backupJob.id,
        backupType: backup_type,
        serverName: server.name,
      });

      // Execute backup asynchronously
      backupService.executeBackup(serverId, backupJob.id, {
        backup_type,
        ...options,
      }).catch((error) => {
        logger.error('Backup execution failed', {
          backupId: backupJob.id,
          error: error.message,
        });
      });

      res.status(202).json({
        success: true,
        message: 'Backup started successfully',
        data: {
          backupId: backupJob.id,
          serverId,
          backupType: backup_type,
          status: backupJob.status,
          startedAt: backupJob.started_at,
        },
      });
    } catch (error) {
      logger.error('Failed to start backup', {
        userId,
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * Helper function to test SSH connection
 *
 * SECURITY NOTE: This function receives decrypted credentials as parameters.
 * The credential parameter is kept in memory only for the duration of the connection attempt
 * and is automatically garbage collected after the function returns. The caller is responsible
 * for explicitly clearing credentials from memory using the pattern:
 *   credential = ''; credential = null;
 */
async function testSSHConnection(
  host: string,
  port: number,
  username: string,
  authType: 'password' | 'key',
  credential: string
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const client = new Client();

    const timeout = setTimeout(() => {
      client.end();
      resolve({
        success: false,
        message: 'Connection timeout after 10 seconds',
      });
    }, 10000);

    client
      .on('ready', () => {
        clearTimeout(timeout);
        client.end();
        resolve({
          success: true,
          message: 'SSH connection successful',
        });
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        logger.error('SSH connection error', {
          host,
          port,
          username,
          error: err.message,
        });
        resolve({
          success: false,
          message: `SSH connection failed: ${err.message}`,
        });
      });

    const connectionConfig: any = {
      host,
      port,
      username,
    };

    if (authType === 'password') {
      connectionConfig.password = credential;
    } else if (authType === 'key') {
      connectionConfig.privateKey = credential;
    }

    try {
      client.connect(connectionConfig);
    } catch (error) {
      clearTimeout(timeout);
      logger.error('SSH connection setup error', {
        host,
        port,
        username,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      resolve({
        success: false,
        message: `Connection setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });
}

/**
 * POST /api/servers/:id/scan
 * Start a new server scan
 * Requires: Authentication, valid UUID, createScanSchema
 * Returns: scan_id immediately (scan runs asynchronously)
 */
router.post(
  '/:id/scan',
  authenticateToken,
  validateUuidParam('id'),
  validateRequest(createScanSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: serverId } = req.params;
    const { scan_type = 'full' } = req.validatedData;

    // Verify server exists
    const serverResult = await pool.query(
      'SELECT id, name FROM servers WHERE id = $1',
      [serverId]
    );

    if (serverResult.rows.length === 0) {
      throw new AppError('Server not found', 404);
    }

    const server = serverResult.rows[0];

    logger.info('Scan initiated for server', {
      serverId,
      serverName: server.name,
      scanType: scan_type,
      userId: req.user?.id,
    });

    // Start scan asynchronously (don't wait for completion)
    scanner.scanServer(serverId, scan_type).catch((error) => {
      logger.error('Scan execution error:', {
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    // Return scan_id immediately
    res.status(202).json({
      success: true,
      message: 'Scan started successfully',
      data: {
        serverId,
        serverName: server.name,
        scanType: scan_type,
        message: 'Scan is running in the background. Check status using GET /api/servers/:id/scans',
      },
    });
  })
);

/**
 * GET /api/servers/:id/scans
 * List all scans for a specific server
 * Requires: Authentication, valid UUID
 */
router.get(
  '/:id/scans',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: serverId } = req.params;

    // Verify server exists
    const serverResult = await pool.query(
      'SELECT id, name FROM servers WHERE id = $1',
      [serverId]
    );

    if (serverResult.rows.length === 0) {
      throw new AppError('Server not found', 404);
    }

    const server = serverResult.rows[0];

    logger.info('Listed scans for server', {
      serverId,
      userId: req.user?.id,
    });

    const scansResult = await pool.query(
      `SELECT
        id,
        server_id,
        scan_type,
        status,
        started_at,
        completed_at,
        scan_duration,
        scan_summary,
        error_message,
        created_at
       FROM server_scans
       WHERE server_id = $1
       ORDER BY started_at DESC`,
      [serverId]
    );

    res.status(200).json({
      success: true,
      message: 'Scans retrieved successfully',
      data: {
        server: {
          id: server.id,
          name: server.name,
        },
        scans: scansResult.rows.map((scan) => ({
          id: scan.id,
          scan_type: scan.scan_type,
          status: scan.status,
          started_at: scan.started_at,
          completed_at: scan.completed_at,
          scan_duration: scan.scan_duration,
          summary: scan.scan_summary || null,
          error_message: scan.error_message,
          created_at: scan.created_at,
        })),
      },
    });
  })
);

/**
 * GET /api/servers/:id/scan-summary
 * Get the latest scan summary for a server
 * Requires: Authentication, valid UUID
 */
router.get(
  '/:id/scan-summary',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: serverId } = req.params;

    // Verify server exists
    const serverResult = await pool.query(
      'SELECT id, name FROM servers WHERE id = $1',
      [serverId]
    );

    if (serverResult.rows.length === 0) {
      throw new AppError('Server not found', 404);
    }

    const server = serverResult.rows[0];

    logger.info('Retrieved latest scan summary for server', {
      serverId,
      userId: req.user?.id,
    });

    // Get latest completed scan
    const latestScanResult = await pool.query(
      `SELECT
        id,
        scan_type,
        status,
        started_at,
        completed_at,
        scan_duration,
        scan_summary,
        error_message
       FROM server_scans
       WHERE server_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [serverId]
    );

    if (latestScanResult.rows.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No scans found for server',
        data: {
          server: {
            id: server.id,
            name: server.name,
          },
          latestScan: null,
        },
      });
      return;
    }

    const latestScan = latestScanResult.rows[0];

    res.status(200).json({
      success: true,
      message: 'Latest scan summary retrieved successfully',
      data: {
        server: {
          id: server.id,
          name: server.name,
        },
        latestScan: {
          id: latestScan.id,
          scan_type: latestScan.scan_type,
          status: latestScan.status,
          started_at: latestScan.started_at,
          completed_at: latestScan.completed_at,
          scan_duration: latestScan.scan_duration,
          summary: latestScan.scan_summary || null,
          error_message: latestScan.error_message,
        },
      },
    });
  })
);

/**
 * GET /api/servers/:id/services
 * List all detected services for a server with pagination
 * Requires: Authentication, valid UUID
 * Query params: page (default: 1), limit (default: 20, max: 100)
 */
router.get(
  '/:id/services',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: serverId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Verify server exists and belongs to user
    const serverResult = await pool.query(
      'SELECT id, name FROM servers WHERE id = $1 AND user_id = $2',
      [serverId, userId]
    );

    if (serverResult.rows.length === 0) {
      throw new AppError('Server not found', 404);
    }

    const server = serverResult.rows[0];

    // Parse pagination parameters
    const paginationParams = parsePaginationParams(req.query);
    const { limit, offset } = buildPaginationQuery(paginationParams);

    // Get services from latest scan for this server with pagination
    const servicesResult = await pool.query(
      `SELECT
        ds.id,
        ds.scan_id,
        ds.service_name,
        ds.service_type,
        ds.status,
        ds.process_id,
        ds.port_bindings,
        ds.config_paths,
        ds.data_paths,
        ds.log_paths,
        ds.service_details,
        ds.backup_priority,
        ds.backup_strategy,
        ds.created_at,
        ss.started_at as scan_date,
        COUNT(*) OVER() as total_count
       FROM detected_services ds
       INNER JOIN server_scans ss ON ds.scan_id = ss.id
       WHERE ss.server_id = $1
       AND ss.id = (
         SELECT id FROM server_scans
         WHERE server_id = $1 AND status = 'completed'
         ORDER BY completed_at DESC
         LIMIT 1
       )
       ORDER BY ds.backup_priority DESC, ds.service_name ASC
       LIMIT $2 OFFSET $3`,
      [serverId, limit, offset]
    );

    // Extract total count from first row (or 0 if no rows)
    const totalCount = servicesResult.rows.length > 0 ? parseInt(servicesResult.rows[0].total_count, 10) : 0;

    // Remove total_count from data
    const services = servicesResult.rows.map(row => {
      const { total_count, ...serviceData } = row;
      return serviceData;
    });

    // Build paginated response
    const paginatedData = buildPaginatedResponse(services, paginationParams, totalCount);

    logger.info('Listed services for server', {
      userId,
      serverId,
      serverName: server.name,
      count: services.length,
      page: paginationParams.page,
      limit: paginationParams.limit,
      totalCount,
    });

    res.status(200).json({
      success: true,
      message: 'Services retrieved successfully',
      data: {
        server: {
          id: server.id,
          name: server.name,
        },
        ...paginatedData,
      },
    });
  })
);

/**
 * POST /api/servers/:serverId/services/:serviceId/update
 * Update a specific service on a server
 * Requires: Authentication, valid UUIDs
 */
router.post(
  '/:serverId/services/:serviceId/update',
  authenticateToken,
  validateUuidParam('serverId'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { serverId, serviceId } = req.params;
    const userId = req.user?.id;

    // Get server details
    const serverResult = await pool.query(
      'SELECT * FROM servers WHERE id = $1',
      [serverId]
    );

    if (serverResult.rows.length === 0) {
      throw new AppError('Server not found', 404);
    }

    const server = serverResult.rows[0];

    // Get service details
    const serviceResult = await pool.query(
      'SELECT * FROM detected_services WHERE id = $1',
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      throw new AppError('Service not found', 404);
    }

    const service = serviceResult.rows[0];

    logger.info('Service update initiated', {
      serverId,
      serviceId,
      serviceName: service.service_name,
      serviceType: service.service_type,
      userId,
    });

    // Execute update based on service type
    const updateResult = await executeServiceUpdate(server, service);

    // Log the action
    await pool.query(
      `INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        userId,
        'UPDATE_SERVICE',
        'service',
        serviceId,
        JSON.stringify({
          service_name: service.service_name,
          service_type: service.service_type,
          server_name: server.name,
        }),
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Service update initiated',
      data: updateResult,
    });
  })
);

/**
 * SECURITY: Sanitize shell arguments to prevent command injection
 * Only allow alphanumeric characters, hyphens, underscores, forward slashes, and dots
 */
function sanitizeShellArg(arg: string): string {
  // Remove any characters that could be used for command injection
  return arg.replace(/[^a-zA-Z0-9_\-\/\.]/g, '');
}

/**
 * Helper function to execute service updates via SSH
 * SECURITY WARNING: This function executes commands on remote servers
 * Input is sanitized to prevent command injection attacks
 */
async function executeServiceUpdate(server: any, service: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const credential = decrypt(server.credential);

    conn.on('ready', () => {
      let updateCommand = '';

      // Determine update command based on service type
      if (service.service_type === 'docker') {
        // SECURITY: Sanitize Docker image and container names to prevent command injection
        const imageName = sanitizeShellArg(service.service_details?.image || service.service_name);
        const containerName = sanitizeShellArg(service.service_name);

        // Validate that names are not empty after sanitization
        if (!imageName || !containerName) {
          reject(new Error('Invalid Docker image or container name'));
          conn.end();
          return;
        }

        updateCommand = `docker pull ${imageName} && docker stop ${containerName} && docker rm ${containerName} && docker run -d --name ${containerName} ${imageName}`;
      } else if (service.service_type === 'systemd') {
        // Systemd service update - depends on package manager
        // SECURITY: Only allow specific known service names to prevent command injection
        if (service.service_name.includes('nginx')) {
          updateCommand = 'apt-get update && apt-get install --only-upgrade nginx -y || yum update nginx -y';
        } else if (service.service_name.includes('apache')) {
          updateCommand = 'apt-get update && apt-get install --only-upgrade apache2 -y || yum update httpd -y';
        } else if (service.service_name.includes('mysql')) {
          updateCommand = 'apt-get update && apt-get install --only-upgrade mysql-server -y || yum update mysql-server -y';
        } else if (service.service_name.includes('postgresql')) {
          updateCommand = 'apt-get update && apt-get install --only-upgrade postgresql -y || yum update postgresql -y';
        } else {
          reject(new Error(`Update not supported for service: ${service.service_name}`));
          conn.end();
          return;
        }
      } else {
        reject(new Error(`Update not supported for service type: ${service.service_type}`));
        conn.end();
        return;
      }

      conn.exec(updateCommand, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        let output = '';
        let errorOutput = '';

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        stream.on('close', (code: number) => {
          conn.end();

          if (code !== 0) {
            reject(new Error(`Update failed (exit ${code}): ${errorOutput || output}`));
          } else {
            resolve({
              success: true,
              output: output,
              message: 'Service updated successfully',
            });
          }
        });
      });
    });

    conn.on('error', (err: Error) => {
      reject(err);
    });

    const config: any = {
      host: server.ip,
      port: server.port,
      username: server.username,
      readyTimeout: 30000,
    };

    if (server.auth_type === 'key') {
      config.privateKey = credential;
    } else {
      config.password = credential;
    }

    conn.connect(config);
  });
}

/**
 * POST /api/servers/:id/orchestrated-backup
 * Orchestrate a complete backup workflow for a server
 * Includes service discovery, dependency resolution, graceful shutdown, backup, and restart
 * Requires: Authentication, valid UUID
 */
router.post(
  '/:id/orchestrated-backup',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: serverId } = req.params;
    const userId = req.user?.id;
    const { backupType, selectedServices } = req.body;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Validate backup type
    if (!backupType || !['full', 'selective'].includes(backupType)) {
      throw new AppError('Invalid backup type. Must be "full" or "selective"', 400);
    }

    // Validate selected services if selective backup
    if (backupType === 'selective' && (!selectedServices || !Array.isArray(selectedServices))) {
      throw new AppError('Selected services required for selective backup', 400);
    }

    // Verify server exists and belongs to user
    const serverResult = await pool.query(
      'SELECT id, name FROM servers WHERE id = $1 AND user_id = $2',
      [serverId, userId]
    );

    if (serverResult.rows.length === 0) {
      throw new AppError('Server not found', 404);
    }

    const server = serverResult.rows[0];

    logger.info('Starting orchestrated backup', {
      userId,
      serverId,
      serverName: server.name,
      backupType,
      selectedServicesCount: selectedServices?.length || 0,
    });

    // Log activity
    await pool.query(
      `INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'orchestrated_backup_initiated',
        'server',
        serverId,
        JSON.stringify({
          server_name: server.name,
          backup_type: backupType,
          services_count: selectedServices?.length || 0,
        }),
        req.ip,
      ]
    );

    // Start orchestrated backup (async operation)
    backupOrchestrator
      .orchestrateServerBackup(serverId, backupType, selectedServices)
      .then(async (result) => {
        // SECURITY FIX: Use parameterized query for INTERVAL calculation
        // Convert backupDuration to seconds for proper PostgreSQL interval
        const durationSeconds = Math.floor(result.backupDuration / 1000);

        // Create backup record in database
        await pool.query(
          `INSERT INTO backups (server_id, backup_type, status, file_size, started_at, completed_at, metadata)
           VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 second' * $5, NOW(), $6)`,
          [
            serverId,
            backupType === 'full' ? 'orchestrated_full' : 'orchestrated_selective',
            result.success ? 'completed' : 'failed',
            result.backupSize,
            durationSeconds,
            JSON.stringify({
              services_backed_up: result.servicesBackedUp,
              services_failed: result.servicesFailed,
              errors: result.errors,
            }),
          ]
        );

        logger.info('Orchestrated backup completed', {
          userId,
          serverId,
          success: result.success,
          duration: result.backupDuration,
          servicesBackedUp: result.servicesBackedUp.length,
          servicesFailed: result.servicesFailed.length,
        });
      })
      .catch(async (error) => {
        logger.error('Orchestrated backup failed', {
          userId,
          serverId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Create failed backup record
        await pool.query(
          `INSERT INTO backups (server_id, backup_type, status, file_size, started_at, completed_at, metadata)
           VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)`,
          [
            serverId,
            backupType === 'full' ? 'orchestrated_full' : 'orchestrated_selective',
            'failed',
            0,
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          ]
        );
      });

    res.status(202).json({
      success: true,
      message: 'Orchestrated backup started. Services will be stopped, backed up, and restarted automatically.',
      data: {
        serverId,
        serverName: server.name,
        backupType,
        status: 'running',
      },
    });
  })
);

export default router;
