/**
 * Backup Schedules API Routes
 * CRUD operations for automated backup scheduling
 */

import express, { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../types/responses';
import { NotFoundError, ValidationError } from '../errors';
import { validate, createBackupScheduleSchema } from '../utils/validators';
import BackupScheduler from '../services/backupScheduler';
import AuditLogger, { AuditAction, ResourceType } from '../services/auditLogger';

const router = express.Router();

/**
 * GET /api/backup-schedules
 * Get all backup schedules for the user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      `SELECT
        bs.*,
        s.name as server_name
      FROM backup_schedules bs
      JOIN servers s ON bs.server_id = s.id
      WHERE bs.user_id = $1
      ORDER BY bs.created_at DESC`,
      [req.user!.id]
    );

    sendSuccess(res, result.rows, 'Backup schedules retrieved');
  })
);

/**
 * GET /api/backup-schedules/:id
 * Get a specific backup schedule
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        bs.*,
        s.name as server_name
      FROM backup_schedules bs
      JOIN servers s ON bs.server_id = s.id
      WHERE bs.id = $1 AND bs.user_id = $2`,
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Backup schedule', id);
    }

    sendSuccess(res, result.rows[0], 'Backup schedule retrieved');
  })
);

/**
 * POST /api/backup-schedules
 * Create a new backup schedule
 */
router.post(
  '/',
  authenticate,
  validate(createBackupScheduleSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      serverId,
      scheduleType,
      hour,
      dayOfWeek,
      dayOfMonth,
      sourcePath,
      destinationPath,
      compression,
      encryption,
      enabled,
    } = req.body;

    // Verify server exists and belongs to user
    const serverResult = await pool.query(
      'SELECT id FROM servers WHERE id = $1 AND user_id = $2',
      [serverId, req.user!.id]
    );

    if (serverResult.rows.length === 0) {
      throw new NotFoundError('Server', serverId);
    }

    // Calculate next run time
    const nextRun = calculateNextRun({ schedule_type: scheduleType, hour, day_of_week: dayOfWeek, day_of_month: dayOfMonth });

    // Create schedule
    const result = await pool.query(
      `INSERT INTO backup_schedules
        (server_id, user_id, schedule_type, hour, day_of_week, day_of_month,
         source_path, destination_path, compression, encryption, enabled, next_run)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        serverId,
        req.user!.id,
        scheduleType,
        hour,
        dayOfWeek,
        dayOfMonth,
        sourcePath,
        destinationPath,
        compression,
        encryption,
        enabled !== false,
        nextRun,
      ]
    );

    const schedule = result.rows[0];

    // Schedule the job if enabled
    if (schedule.enabled) {
      BackupScheduler.scheduleBackup(schedule);
    }

    // Log audit event
    await AuditLogger.logFromRequest(
      req,
      AuditAction.BACKUP_SCHEDULE_CREATE,
      ResourceType.BACKUP_SCHEDULE,
      schedule.id,
      { serverId, scheduleType, enabled: schedule.enabled }
    );

    sendCreated(res, schedule, 'Backup schedule created');
  })
);

/**
 * PUT /api/backup-schedules/:id
 * Update a backup schedule
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { scheduleType, hour, dayOfWeek, dayOfMonth, sourcePath, destinationPath, compression, encryption, enabled } = req.body;

    // Verify schedule exists and belongs to user
    const existingResult = await pool.query(
      'SELECT * FROM backup_schedules WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (existingResult.rows.length === 0) {
      throw new NotFoundError('Backup schedule', id);
    }

    const existing = existingResult.rows[0];

    // Calculate new next run time if schedule details changed
    let nextRun = existing.next_run;
    if (scheduleType !== undefined || hour !== undefined || dayOfWeek !== undefined || dayOfMonth !== undefined) {
      nextRun = calculateNextRun({
        schedule_type: scheduleType || existing.schedule_type,
        hour: hour !== undefined ? hour : existing.hour,
        day_of_week: dayOfWeek !== undefined ? dayOfWeek : existing.day_of_week,
        day_of_month: dayOfMonth !== undefined ? dayOfMonth : existing.day_of_month,
      });
    }

    // Update schedule
    const result = await pool.query(
      `UPDATE backup_schedules SET
        schedule_type = COALESCE($1, schedule_type),
        hour = COALESCE($2, hour),
        day_of_week = COALESCE($3, day_of_week),
        day_of_month = COALESCE($4, day_of_month),
        source_path = COALESCE($5, source_path),
        destination_path = COALESCE($6, destination_path),
        compression = COALESCE($7, compression),
        encryption = COALESCE($8, encryption),
        enabled = COALESCE($9, enabled),
        next_run = $10,
        updated_at = NOW()
      WHERE id = $11 AND user_id = $12
      RETURNING *`,
      [scheduleType, hour, dayOfWeek, dayOfMonth, sourcePath, destinationPath, compression, encryption, enabled, nextRun, id, req.user!.id]
    );

    const schedule = result.rows[0];

    // Reschedule the job
    if (schedule.enabled) {
      BackupScheduler.scheduleBackup(schedule);
    } else {
      BackupScheduler.unscheduleBackup(id);
    }

    // Log audit event
    await AuditLogger.logFromRequest(
      req,
      AuditAction.BACKUP_SCHEDULE_UPDATE,
      ResourceType.BACKUP_SCHEDULE,
      id,
      { enabled: schedule.enabled }
    );

    sendSuccess(res, schedule, 'Backup schedule updated');
  })
);

/**
 * DELETE /api/backup-schedules/:id
 * Delete a backup schedule
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Verify schedule exists and belongs to user
    const result = await pool.query(
      'DELETE FROM backup_schedules WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Backup schedule', id);
    }

    // Unschedule the job
    BackupScheduler.unscheduleBackup(id);

    // Log audit event
    await AuditLogger.logFromRequest(
      req,
      AuditAction.BACKUP_SCHEDULE_DELETE,
      ResourceType.BACKUP_SCHEDULE,
      id
    );

    sendNoContent(res);
  })
);

/**
 * Helper function to calculate next run time
 */
function calculateNextRun(schedule: any): Date {
  const now = new Date();
  const { schedule_type, hour, day_of_week, day_of_month } = schedule;

  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);

  switch (schedule_type) {
    case 'daily':
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'weekly':
      const currentDay = next.getDay();
      const daysUntilNext = (day_of_week - currentDay + 7) % 7;
      if (daysUntilNext === 0 && next <= now) {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + daysUntilNext);
      }
      break;

    case 'monthly':
      next.setDate(day_of_month);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }

  return next;
}

export default router;
