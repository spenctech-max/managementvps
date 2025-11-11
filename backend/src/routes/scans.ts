import { Router, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest, validateUuidParam, createScanSchema } from '@medicine-man/shared';
import { parsePaginationParams, buildPaginationQuery, buildPaginatedResponse } from '../utils/pagination';
import { scanQueue } from '../queues/queueManager';
import { JobType, JobPriority } from '../queues/queueManager';
import { ScanJobData } from '../queues/jobs/scanJobs';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/scans
 * List all scans with pagination
 * Requires: Authentication
 * Query params: page (default: 1), limit (default: 20, max: 100)
 */
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Parse pagination parameters
    const paginationParams = parsePaginationParams(req.query);
    const { limit, offset } = buildPaginationQuery(paginationParams);

    logger.info('Listed all scans', {
      page: paginationParams.page,
      limit: paginationParams.limit,
      userId: req.user?.id,
    });

    const scansResult = await pool.query(
      `SELECT
        ss.id,
        ss.server_id,
        ss.scan_type,
        ss.status,
        ss.started_at,
        ss.completed_at,
        ss.scan_duration,
        ss.scan_summary,
        ss.error_message,
        ss.created_at,
        s.name as server_name,
        s.ip as server_ip,
        COUNT(*) OVER() as total_count
       FROM server_scans ss
       LEFT JOIN servers s ON ss.server_id = s.id
       ORDER BY ss.started_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Extract total count from first row (or 0 if no rows)
    const totalCount = scansResult.rows.length > 0 ? parseInt(scansResult.rows[0].total_count, 10) : 0;

    // Map and remove total_count from data
    const scans = scansResult.rows.map((scan) => {
      const { total_count, ...scanData } = scan;
      return {
        id: scanData.id,
        server_id: scanData.server_id,
        server_name: scanData.server_name,
        server_ip: scanData.server_ip,
        scan_type: scanData.scan_type,
        status: scanData.status,
        started_at: scanData.started_at,
        completed_at: scanData.completed_at,
        scan_duration: scanData.scan_duration,
        summary: scanData.scan_summary || null,
        error_message: scanData.error_message,
        created_at: scanData.created_at,
      };
    });

    // Build paginated response
    const paginatedData = buildPaginatedResponse(scans, paginationParams, totalCount);

    res.status(200).json({
      success: true,
      message: 'Scans retrieved successfully',
      data: paginatedData,
    });
  })
);

/**
 * POST /api/servers/:id/scan
 * Start a new server scan (enqueues job to BullMQ)
 * Requires: Authentication, valid UUID, createScanSchema
 * Returns: scan_id and job_id immediately (scan runs asynchronously)
 */
router.post(
  '/:id/scan',
  authenticateToken,
  rateLimiters.heavy, // Apply heavy rate limiter for scan operations
  validateUuidParam('id'),
  validateRequest(createScanSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: serverId } = req.params;
    const { scan_type = 'full' } = req.validatedData;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Verify server exists
    const serverResult = await pool.query(
      'SELECT id, name FROM servers WHERE id = $1',
      [serverId]
    );

    if (serverResult.rows.length === 0) {
      throw new AppError('Server not found', 404);
    }

    const server = serverResult.rows[0];

    logger.info('Enqueuing scan for server', {
      serverId,
      serverName: server.name,
      scanType: scan_type,
      userId,
    });

    // Create scan record
    const scanResult = await pool.query(
      `INSERT INTO server_scans (server_id, scan_type, status, created_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id`,
      [serverId, scan_type]
    );

    const scanId = scanResult.rows[0].id;

    // Enqueue scan job
    const jobData: ScanJobData = {
      serverId,
      scanId,
      userId,
      scanType: scan_type as 'full' | 'quick' | 'custom',
      options: {},
    };

    const jobType = scan_type === 'quick' ? JobType.SCAN_QUICK : JobType.SCAN_FULL;
    const job = await scanQueue.add(jobType, jobData, {
      priority: JobPriority.NORMAL,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    });

    logger.info('Scan job enqueued', {
      serverId,
      scanId,
      jobId: job.id,
    });

    // Return scan_id and job_id immediately
    res.status(202).json({
      success: true,
      message: 'Scan enqueued successfully',
      data: {
        scanId,
        jobId: job.id,
        serverId,
        serverName: server.name,
        scanType: scan_type,
        status: 'pending',
        message: 'Scan is queued and will run shortly. Check status using GET /api/scans/:id or GET /api/jobs/:id',
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
 * GET /api/scans/:id
 * Get detailed scan information with all results
 * Requires: Authentication, valid UUID
 * Returns: scan details with services, filesystems, and recommendations
 */
router.get(
  '/:id',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: scanId } = req.params;

    logger.info('Retrieved scan details', {
      scanId,
      userId: req.user?.id,
    });

    // Get scan info
    const scanResult = await pool.query(
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
       WHERE id = $1`,
      [scanId]
    );

    if (scanResult.rows.length === 0) {
      throw new AppError('Scan not found', 404);
    }

    const scan = scanResult.rows[0];

    // Get detected services
    const servicesResult = await pool.query(
      `SELECT
        id,
        scan_id,
        service_name,
        service_type,
        status,
        process_id,
        port_bindings,
        config_paths,
        data_paths,
        log_paths,
        service_details,
        backup_priority,
        backup_strategy,
        created_at
       FROM detected_services
       WHERE scan_id = $1
       ORDER BY backup_priority DESC, service_name ASC`,
      [scanId]
    );

    // Get detected filesystems
    const filesystemsResult = await pool.query(
      `SELECT
        id,
        scan_id,
        mount_point,
        device_name,
        filesystem_type,
        total_size,
        used_size,
        available_size,
        usage_percentage,
        is_system_drive,
        contains_data,
        backup_recommended,
        backup_priority,
        estimated_backup_size,
        exclusion_patterns,
        created_at
       FROM detected_filesystems
       WHERE scan_id = $1
       ORDER BY backup_priority DESC, mount_point ASC`,
      [scanId]
    );

    // Get backup recommendations
    const recommendationsResult = await pool.query(
      `SELECT
        id,
        scan_id,
        recommendation_type,
        priority,
        title,
        description,
        backup_paths,
        exclusion_patterns,
        estimated_size,
        backup_frequency,
        retention_period,
        backup_method,
        implementation_notes,
        created_at
       FROM backup_recommendations
       WHERE scan_id = $1
       ORDER BY
         CASE priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         recommendation_type ASC`,
      [scanId]
    );

    res.status(200).json({
      success: true,
      message: 'Scan details retrieved successfully',
      data: {
        scan: {
          id: scan.id,
          server_id: scan.server_id,
          scan_type: scan.scan_type,
          status: scan.status,
          started_at: scan.started_at,
          completed_at: scan.completed_at,
          scan_duration: scan.scan_duration,
          summary: scan.scan_summary || null,
          error_message: scan.error_message,
          created_at: scan.created_at,
        },
        services: servicesResult.rows.map((service) => ({
          id: service.id,
          service_name: service.service_name,
          service_type: service.service_type,
          status: service.status,
          process_id: service.process_id,
          port_bindings: service.port_bindings,
          config_paths: service.config_paths,
          data_paths: service.data_paths,
          log_paths: service.log_paths,
          service_details: service.service_details || {},
          backup_priority: service.backup_priority,
          backup_strategy: service.backup_strategy,
          created_at: service.created_at,
        })),
        filesystems: filesystemsResult.rows.map((fs) => ({
          id: fs.id,
          mount_point: fs.mount_point,
          device_name: fs.device_name,
          filesystem_type: fs.filesystem_type,
          total_size: fs.total_size,
          used_size: fs.used_size,
          available_size: fs.available_size,
          usage_percentage: fs.usage_percentage,
          is_system_drive: fs.is_system_drive,
          contains_data: fs.contains_data,
          backup_recommended: fs.backup_recommended,
          backup_priority: fs.backup_priority,
          estimated_backup_size: fs.estimated_backup_size,
          exclusion_patterns: fs.exclusion_patterns,
          created_at: fs.created_at,
        })),
        recommendations: recommendationsResult.rows.map((rec) => ({
          id: rec.id,
          recommendation_type: rec.recommendation_type,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
          backup_paths: rec.backup_paths,
          exclusion_patterns: rec.exclusion_patterns,
          estimated_size: rec.estimated_size,
          backup_frequency: rec.backup_frequency,
          retention_period: rec.retention_period,
          backup_method: rec.backup_method,
          implementation_notes: rec.implementation_notes,
          created_at: rec.created_at,
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
 * GET /api/scans/compare?scanIds[]=id1&scanIds[]=id2
 * Compare multiple scans
 * Requires: Authentication, at least 2 scan IDs
 * Returns: Comparison showing added, removed, and changed services
 */
router.get(
  '/compare',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const scanIds = Array.isArray(req.query.scanIds)
      ? req.query.scanIds as string[]
      : [req.query.scanIds as string];

    if (scanIds.length < 2) {
      throw new AppError('At least 2 scan IDs are required for comparison', 400);
    }

    // Fetch all requested scans
    const scansResult = await pool.query(
      `SELECT
        ss.id, ss.server_id, ss.scan_type, ss.status,
        ss.started_at, ss.completed_at, ss.results,
        s.name as server_name
      FROM server_scans ss
      JOIN servers s ON ss.server_id = s.id
      WHERE ss.id = ANY($1)
      ORDER BY ss.started_at`,
      [scanIds]
    );

    if (scansResult.rows.length < 2) {
      throw new AppError('Could not find all requested scans', 404);
    }

    const scans = scansResult.rows;

    // Verify all scans are from the same server
    const serverIds = new Set(scans.map((s) => s.server_id));
    if (serverIds.size > 1) {
      throw new AppError('All scans must be from the same server', 400);
    }

    // Compare services between scans
    const differences = compareScanResults(scans);

    logger.info('Scan comparison completed', {
      scanCount: scans.length,
      serverId: scans[0].server_id,
      userId: req.user?.id,
    });

    res.status(200).json({
      success: true,
      message: 'Scan comparison completed',
      data: {
        server: {
          id: scans[0].server_id,
          name: scans[0].server_name,
        },
        scans: scans.map((scan) => ({
          id: scan.id,
          scanType: scan.scan_type,
          startedAt: scan.started_at,
          completedAt: scan.completed_at,
        })),
        differences,
      },
    });
  })
);

/**
 * Helper function to compare scan results
 */
function compareScanResults(scans: any[]) {
  if (scans.length < 2) return null;

  // Parse results
  const parsedScans = scans.map((scan) => ({
    id: scan.id,
    services: Array.isArray(scan.results) ? scan.results : [],
    timestamp: scan.started_at,
  }));

  // Compare first scan with last scan
  const oldScan = parsedScans[0];
  const newScan = parsedScans[parsedScans.length - 1];

  // Create service maps for comparison
  const oldServices = new Map(
    oldScan.services.map((s: any) => [`${s.port}-${s.protocol}`, s])
  );
  const newServices = new Map(
    newScan.services.map((s: any) => [`${s.port}-${s.protocol}`, s])
  );

  // Find differences
  const added: any[] = [];
  const removed: any[] = [];
  const changed: any[] = [];

  // Find added services (in new but not in old)
  for (const [key, service] of newServices) {
    if (!oldServices.has(key)) {
      added.push(service);
    }
  }

  // Find removed services (in old but not in new)
  for (const [key, service] of oldServices) {
    if (!newServices.has(key)) {
      removed.push(service);
    }
  }

  // Find changed services (in both but different)
  for (const [key, newService] of newServices) {
    const oldService = oldServices.get(key) as any;
    if (oldService) {
      // Compare service details
      const differences = [];
      if ((oldService as any).name !== (newService as any).name) {
        differences.push({ field: 'name', old: (oldService as any).name, new: (newService as any).name });
      }
      if ((oldService as any).state !== (newService as any).state) {
        differences.push({ field: 'state', old: (oldService as any).state, new: (newService as any).state });
      }
      if ((oldService as any).version !== (newService as any).version) {
        differences.push({ field: 'version', old: (oldService as any).version, new: (newService as any).version });
      }

      if (differences.length > 0) {
        changed.push({
          port: (newService as any).port,
          protocol: (newService as any).protocol,
          name: (newService as any).name,
          differences,
        });
      }
    }
  }

  return {
    added,
    removed,
    changed,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      totalChanges: added.length + removed.length + changed.length,
    },
  };
}

export default router;
