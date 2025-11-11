import { Router, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { validateUuidParam } from '@medicine-man/shared';
import { parsePaginationParams, buildPaginationQuery, buildPaginatedResponse } from '../utils/pagination';
import { rateLimiters } from '../middleware/rateLimiter';
import { createManualBackupSchema } from '../utils/validation';
import { backupQueue, JobType } from '../queues/queueManager';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/backups
 * Create a manual backup
 * Requires: authenticateToken
 * Body: serverId, backupType, paths, options
 */
router.post(
  '/',
  authenticateToken,
  rateLimiters.write,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Validate request body
      const validatedData = createManualBackupSchema.parse(req.body);
      const { serverId, backupType, paths, options } = validatedData;

      // Verify server exists and belongs to user
      const serverCheck = await pool.query(
        `SELECT id, name FROM servers WHERE id = $1 AND user_id = $2`,
        [serverId, userId]
      );

      if (serverCheck.rows.length === 0) {
        throw new AppError('Server not found or access denied', 404);
      }

      const server = serverCheck.rows[0];

      // Create backup record
      const backupId = uuidv4();
      await pool.query(
        `INSERT INTO backups (id, server_id, backup_type, status, metadata, created_at)
         VALUES ($1, $2, $3, 'pending', $4, NOW())`,
        [
          backupId,
          serverId,
          backupType,
          JSON.stringify({
            paths,
            ...options,
            isManual: true,
          }),
        ]
      );

      // Enqueue backup job
      const job = await backupQueue.add(JobType.BACKUP_MANUAL, {
        serverId,
        backupId,
        userId,
        options: {
          backup_type: backupType,
          paths,
          exclusions: [],
          compression: options.compression !== false,
          encryption: options.encryption === true,
        },
        isScheduled: false,
      });

      logger.info('Manual backup created and enqueued', {
        userId,
        serverId,
        serverName: server.name,
        backupId,
        jobId: job.id,
        backupType,
        paths,
      });

      res.status(201).json({
        success: true,
        message: 'Backup job created successfully',
        data: {
          backupId,
          jobId: job.id,
          serverId,
          serverName: server.name,
          status: 'pending',
          backupType,
          paths,
          options,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        throw new AppError('Invalid request data', 400);
      }
      logger.error('Failed to create manual backup', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * GET /api/backups
 * List all backups with pagination (join with servers table)
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

      const result = await pool.query(
        `SELECT b.id, b.server_id, b.backup_type, b.status,
                b.file_size as size,
                EXTRACT(EPOCH FROM (b.completed_at - b.started_at))::INTEGER as duration,
                b.started_at, b.completed_at, b.created_at, s.name as server_name, s.ip as server_ip,
                COUNT(*) OVER() as total_count
         FROM backups b
         INNER JOIN servers s ON b.server_id = s.id
         WHERE s.user_id = $1
         ORDER BY b.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      // Extract total count from first row (or 0 if no rows)
      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

      // Remove total_count from data
      const backups = result.rows.map(row => {
        const { total_count, ...backupData } = row;
        return backupData;
      });

      // Build paginated response
      const paginatedData = buildPaginatedResponse(backups, paginationParams, totalCount);

      logger.info('Listed backups', {
        userId,
        count: backups.length,
        page: paginationParams.page,
        limit: paginationParams.limit,
        totalCount,
      });

      res.status(200).json({
        success: true,
        message: 'Backups retrieved successfully',
        data: paginatedData,
      });
    } catch (error) {
      logger.error('Failed to list backups', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * GET /api/servers/:id/backups
 * List backups for specific server
 * Requires: authenticateToken, valid UUID in params
 * Returns: All backups for the server ordered by created_at DESC
 */
router.get(
  '/servers/:id/backups',
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
      const serverCheck = await pool.query(
        `SELECT id FROM servers WHERE id = $1 AND user_id = $2`,
        [serverId, userId]
      );

      if (serverCheck.rows.length === 0) {
        throw new AppError('Server not found', 404);
      }

      const result = await pool.query(
        `SELECT b.id, b.server_id, b.backup_type, b.status,
                b.file_size as size,
                EXTRACT(EPOCH FROM (b.completed_at - b.started_at))::INTEGER as duration,
                b.started_at, b.completed_at, b.created_at, s.name as server_name, s.ip as server_ip
         FROM backups b
         INNER JOIN servers s ON b.server_id = s.id
         WHERE b.server_id = $1
         ORDER BY b.created_at DESC`,
        [serverId]
      );

      logger.info('Listed server backups', {
        userId,
        serverId,
        count: result.rows.length,
      });

      res.status(200).json({
        success: true,
        message: 'Server backups retrieved successfully',
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      logger.error('Failed to list server backups', {
        userId,
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * GET /api/backups/:id
 * Get backup details
 * Requires: authenticateToken, valid UUID in params
 */
router.get(
  '/:id',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const backupId = req.params.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      const result = await pool.query(
        `SELECT b.id, b.server_id, b.backup_type, b.status,
                b.file_size as size,
                EXTRACT(EPOCH FROM (b.completed_at - b.started_at))::INTEGER as duration,
                b.started_at, b.completed_at, b.created_at, b.metadata as options,
                s.name as server_name, s.ip as server_ip
         FROM backups b
         INNER JOIN servers s ON b.server_id = s.id
         WHERE b.id = $1 AND s.user_id = $2`,
        [backupId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Backup not found', 404);
      }

      const backup = result.rows[0];

      logger.info('Retrieved backup details', {
        userId,
        backupId,
        serverId: backup.server_id,
      });

      res.status(200).json({
        success: true,
        message: 'Backup details retrieved successfully',
        data: backup,
      });
    } catch (error) {
      logger.error('Failed to retrieve backup details', {
        userId,
        backupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * GET /api/stats
 * Get statistics (total servers, online servers, total backups, recent backups from last 7 days)
 * Requires: authenticateToken
 * Returns: Stats with integer counts
 */
router.get(
  '/api/stats',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Get total servers count
      const serversResult = await pool.query(
        `SELECT COUNT(*)::INTEGER as total,
                SUM(CASE WHEN is_online = true THEN 1 ELSE 0 END)::INTEGER as online
         FROM servers
         WHERE user_id = $1`,
        [userId]
      );

      const { total: totalServers, online: onlineServers } = serversResult.rows[0];

      // Get total backups count
      const totalBackupsResult = await pool.query(
        `SELECT COUNT(*)::INTEGER as total
         FROM backups b
         INNER JOIN servers s ON b.server_id = s.id
         WHERE s.user_id = $1`,
        [userId]
      );

      const totalBackups = totalBackupsResult.rows[0].total;

      // Get backups from last 7 days
      const recentBackupsResult = await pool.query(
        `SELECT COUNT(*)::INTEGER as total
         FROM backups b
         INNER JOIN servers s ON b.server_id = s.id
         WHERE s.user_id = $1 AND b.created_at >= NOW() - INTERVAL '7 days'`,
        [userId]
      );

      const recentBackups = recentBackupsResult.rows[0].total;

      logger.info('Retrieved statistics', {
        userId,
        totalServers,
        onlineServers,
        totalBackups,
        recentBackups,
      });

      res.status(200).json({
        success: true,
        message: 'Statistics retrieved successfully',
        data: {
          servers: {
            total: totalServers,
            online: onlineServers,
          },
          backups: {
            total: totalBackups,
            recentSevenDays: recentBackups,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to retrieve statistics', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

export default router;
