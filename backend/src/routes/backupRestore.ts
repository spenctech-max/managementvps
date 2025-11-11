import { Router, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { validateUuidParam } from '@medicine-man/shared';
import { BackupRestoreService, RestoreOptions } from '../services/backupRestoreService';
import { AuditLogger, AuditAction, ResourceType } from '../services/auditLogger';

const router = Router();

// Initialize restore service
const restoreService = new BackupRestoreService(pool, logger);

/**
 * POST /api/backups/:id/restore
 * Restore a backup to its original server
 * Requires: authenticateToken, valid UUID in params
 *
 * Body:
 * - restoreType: 'full' | 'selective' (required)
 * - selectedServices: string[] (optional, required if restoreType is 'selective')
 * - verifyIntegrity: boolean (optional, default: true)
 * - createRollbackPoint: boolean (optional, default: true)
 * - skipHealthChecks: boolean (optional, default: false)
 */
router.post(
  '/:id/restore',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const backupId = req.params.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    // Validate request body
    const {
      restoreType = 'full',
      selectedServices,
      verifyIntegrity = true,
      createRollbackPoint = true,
      skipHealthChecks = false,
    } = req.body;

    // Validate restoreType
    if (!['full', 'selective'].includes(restoreType)) {
      throw new AppError('Invalid restoreType. Must be "full" or "selective"', 400);
    }

    // Validate selectedServices for selective restore
    if (restoreType === 'selective') {
      if (!selectedServices || !Array.isArray(selectedServices) || selectedServices.length === 0) {
        throw new AppError('selectedServices is required for selective restore and must be a non-empty array', 400);
      }
    }

    const options: RestoreOptions = {
      restoreType,
      selectedServices,
      verifyIntegrity,
      createRollbackPoint,
      skipHealthChecks,
    };

    try {
      logger.info('Restore request received', {
        userId,
        backupId,
        options,
      });

      // Log audit event - restore started
      await AuditLogger.logFromRequest(
        req,
        AuditAction.BACKUP_RESTORE_START,
        ResourceType.BACKUP,
        backupId,
        { restoreType, selectedServices }
      );

      // Execute restore operation (async)
      const result = await restoreService.orchestrateRestore(backupId, userId, options);

      // Log audit event - restore completed
      await AuditLogger.logFromRequest(
        req,
        AuditAction.BACKUP_RESTORE_COMPLETE,
        ResourceType.BACKUP,
        backupId,
        {
          restoreJobId: result.restoreJobId,
          servicesRestored: result.servicesRestored.length,
          servicesFailed: result.servicesFailed.length,
          rolledBack: result.rolledBack,
        },
        result.success ? 'success' : 'failure',
        result.errors.join('; ')
      );

      if (!result.success) {
        throw new AppError(
          `Restore failed: ${result.errors.join('; ')}`,
          500
        );
      }

      logger.info('Restore completed successfully', {
        userId,
        backupId,
        restoreJobId: result.restoreJobId,
        duration: result.restoreDuration,
      });

      res.status(200).json({
        success: true,
        message: 'Backup restored successfully',
        data: {
          restoreJobId: result.restoreJobId,
          servicesRestored: result.servicesRestored,
          servicesFailed: result.servicesFailed,
          duration: result.restoreDuration,
          rolledBack: result.rolledBack,
        },
      });
    } catch (error) {
      logger.error('Restore failed', {
        userId,
        backupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Log audit event - restore failed
      await AuditLogger.logFromRequest(
        req,
        AuditAction.BACKUP_RESTORE_COMPLETE,
        ResourceType.BACKUP,
        backupId,
        { restoreType },
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  })
);

/**
 * GET /api/backups/restore-jobs
 * List all restore jobs for the authenticated user
 * Requires: authenticateToken
 *
 * Query params:
 * - limit: number (optional, default: 50, max: 100)
 */
router.get(
  '/restore-jobs',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);

    try {
      const jobs = await restoreService.listRestoreJobs(userId, limit);

      logger.info('Listed restore jobs', {
        userId,
        count: jobs.length,
      });

      res.status(200).json({
        success: true,
        message: 'Restore jobs retrieved successfully',
        data: jobs,
        count: jobs.length,
      });
    } catch (error) {
      logger.error('Failed to list restore jobs', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * GET /api/backups/restore-jobs/:id
 * Get detailed status of a restore job
 * Requires: authenticateToken, valid UUID in params
 */
router.get(
  '/restore-jobs/:id',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const restoreJobId = req.params.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      const job = await restoreService.getRestoreJobStatus(restoreJobId, userId);

      if (!job) {
        throw new AppError('Restore job not found', 404);
      }

      logger.info('Retrieved restore job status', {
        userId,
        restoreJobId,
        status: job.status,
      });

      res.status(200).json({
        success: true,
        message: 'Restore job status retrieved successfully',
        data: job,
      });
    } catch (error) {
      logger.error('Failed to retrieve restore job status', {
        userId,
        restoreJobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

/**
 * POST /api/backups/:id/verify
 * Verify backup integrity without performing restore
 * Requires: authenticateToken, valid UUID in params
 */
router.post(
  '/:id/verify',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const backupId = req.params.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Verify user has access to backup
      const backupResult = await pool.query(
        `SELECT b.*, s.user_id
         FROM backups b
         INNER JOIN servers s ON b.server_id = s.id
         WHERE b.id = $1 AND s.user_id = $2`,
        [backupId, userId]
      );

      if (backupResult.rows.length === 0) {
        throw new AppError('Backup not found', 404);
      }

      const backup = backupResult.rows[0];

      // Use the restore service's verification method
      const restoreServiceInstance = new BackupRestoreService(pool, logger);
      const isValid = await (restoreServiceInstance as any).verifyBackupIntegrity(backup);

      // Log audit event
      await AuditLogger.logFromRequest(
        req,
        AuditAction.BACKUP_VERIFY,
        ResourceType.BACKUP,
        backupId,
        { isValid },
        isValid ? 'success' : 'failure'
      );

      logger.info('Backup verification completed', {
        userId,
        backupId,
        isValid,
      });

      res.status(200).json({
        success: true,
        message: isValid ? 'Backup is valid' : 'Backup verification failed',
        data: {
          backupId,
          isValid,
          filePath: backup.file_path,
          fileSize: backup.file_size,
        },
      });
    } catch (error) {
      logger.error('Backup verification failed', {
        userId,
        backupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Log audit event
      await AuditLogger.logFromRequest(
        req,
        AuditAction.BACKUP_VERIFY,
        ResourceType.BACKUP,
        backupId,
        {},
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  })
);

/**
 * GET /api/backups/:id/restore-preview
 * Preview what will be restored (services, paths, etc.) without executing restore
 * Requires: authenticateToken, valid UUID in params
 *
 * Query params:
 * - restoreType: 'full' | 'selective' (optional, default: 'full')
 * - selectedServices: comma-separated service IDs (optional, for selective preview)
 */
router.get(
  '/:id/restore-preview',
  authenticateToken,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const backupId = req.params.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    const restoreType = (req.query.restoreType as string) || 'full';
    const selectedServicesParam = req.query.selectedServices as string;
    const selectedServices = selectedServicesParam ? selectedServicesParam.split(',') : undefined;

    try {
      // Verify backup exists and user has access
      const backupResult = await pool.query(
        `SELECT b.*, s.user_id, s.name as server_name
         FROM backups b
         INNER JOIN servers s ON b.server_id = s.id
         WHERE b.id = $1 AND s.user_id = $2`,
        [backupId, userId]
      );

      if (backupResult.rows.length === 0) {
        throw new AppError('Backup not found', 404);
      }

      const backup = backupResult.rows[0];

      // Get services that would be restored
      const servicesResult = await pool.query(
        `SELECT ds.*
         FROM detected_services ds
         INNER JOIN server_scans ss ON ds.scan_id = ss.id
         WHERE ss.server_id = $1 AND ss.status = 'completed'
         ORDER BY ss.started_at DESC
         LIMIT 100`,
        [backup.server_id]
      );

      let services = servicesResult.rows;

      // Filter for selective restore
      if (restoreType === 'selective' && selectedServices) {
        services = services.filter(s =>
          selectedServices.includes(s.id) || selectedServices.includes(s.service_name)
        );
      }

      logger.info('Generated restore preview', {
        userId,
        backupId,
        servicesCount: services.length,
      });

      res.status(200).json({
        success: true,
        message: 'Restore preview generated successfully',
        data: {
          backup: {
            id: backup.id,
            backupType: backup.backup_type,
            createdAt: backup.created_at,
            fileSize: backup.file_size,
            serverName: backup.server_name,
          },
          restoreType,
          services: services.map(s => ({
            id: s.id,
            name: s.service_name,
            type: s.service_type,
            status: s.status,
            configPaths: s.config_paths,
            dataPaths: s.data_paths,
            backupPriority: s.backup_priority,
          })),
          servicesCount: services.length,
          estimatedDuration: services.length * 30, // Rough estimate: 30 seconds per service
        },
      });
    } catch (error) {
      logger.error('Failed to generate restore preview', {
        userId,
        backupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  })
);

export default router;
