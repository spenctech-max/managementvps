/**
 * Backup Job Handlers
 * Defines backup job types and their processing logic
 */

import { Job } from 'bullmq';
import { Pool } from 'pg';
import { Logger } from 'winston';
import { BackupService, BackupOptions } from '../../services/backup';

/**
 * Backup job data interface
 */
export interface BackupJobData {
  serverId: string;
  backupId: string;
  userId: string;
  options: BackupOptions;
  scheduleId?: string; // Optional: if triggered by a schedule
  isScheduled: boolean;
}

/**
 * Backup job result interface
 */
export interface BackupJobResult {
  backupId: string;
  serverId: string;
  status: 'completed' | 'failed';
  size?: number;
  path?: string;
  duration: number;
  error?: string;
}

/**
 * Backup Job Handler
 */
export class BackupJobHandler {
  private backupService: BackupService;
  private pool: Pool;
  private logger: Logger;

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
    this.backupService = new BackupService(pool, logger);
  }

  /**
   * Process backup job
   */
  async process(job: Job<BackupJobData>): Promise<BackupJobResult> {
    const { serverId, backupId, userId, options, isScheduled, scheduleId } = job.data;
    const startTime = Date.now();

    this.logger.info('Processing backup job', {
      jobId: job.id,
      backupId,
      serverId,
      userId,
      isScheduled,
    });

    try {
      // Update job progress
      await job.updateProgress(10);

      // Verify server exists and belongs to user
      const serverResult = await this.pool.query(
        'SELECT id, name, ip FROM servers WHERE id = $1',
        [serverId]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }

      const server = serverResult.rows[0];
      await job.updateProgress(20);

      // Store job ID in backup record for tracking
      await this.pool.query(
        'UPDATE backups SET metadata = metadata || $1 WHERE id = $2',
        [JSON.stringify({ jobId: job.id }), backupId]
      );

      await job.updateProgress(30);

      // Execute the backup
      this.logger.info('Starting backup execution', {
        jobId: job.id,
        backupId,
        serverId,
        serverName: server.name,
      });

      await job.updateProgress(40);

      // Perform the actual backup
      await this.backupService.executeBackup(serverId, backupId, options);

      await job.updateProgress(90);

      // Update schedule if this was a scheduled backup
      if (isScheduled && scheduleId) {
        await this.pool.query(
          'UPDATE backup_schedules SET last_status = $1, last_run = NOW() WHERE id = $2',
          ['success', scheduleId]
        );
      }

      await job.updateProgress(100);

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Get final backup info
      const backupResult = await this.pool.query(
        'SELECT file_size, file_path FROM backups WHERE id = $1',
        [backupId]
      );

      const backup = backupResult.rows[0];

      const result: BackupJobResult = {
        backupId,
        serverId,
        status: 'completed',
        size: backup?.file_size,
        path: backup?.file_path,
        duration,
      };

      this.logger.info('Backup job completed', {
        jobId: job.id,
        backupId,
        serverId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Backup job failed', {
        jobId: job.id,
        backupId,
        serverId,
        error: errorMessage,
      });

      // Update schedule if this was a scheduled backup
      if (isScheduled && scheduleId) {
        await this.pool.query(
          'UPDATE backup_schedules SET last_status = $1, last_run = NOW() WHERE id = $2',
          ['failure', scheduleId]
        );
      }

      const result: BackupJobResult = {
        backupId,
        serverId,
        status: 'failed',
        duration,
        error: errorMessage,
      };

      // Re-throw to let BullMQ handle retries
      throw error;
    }
  }

  /**
   * Handle job failure after all retries
   */
  async onFailed(job: Job<BackupJobData>, error: Error): Promise<void> {
    const { backupId, serverId, scheduleId, isScheduled } = job.data;

    this.logger.error('Backup job failed permanently', {
      jobId: job.id,
      backupId,
      serverId,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });

    // Update backup record
    await this.pool.query(
      `UPDATE backups
       SET status = 'failed',
           error_message = $1,
           completed_at = NOW()
       WHERE id = $2`,
      [error.message, backupId]
    );

    // Update schedule if this was a scheduled backup
    if (isScheduled && scheduleId) {
      await this.pool.query(
        'UPDATE backup_schedules SET last_status = $1 WHERE id = $2',
        ['failure', scheduleId]
      );
    }
  }

  /**
   * Handle job completion
   */
  async onCompleted(job: Job<BackupJobData>, result: BackupJobResult): Promise<void> {
    this.logger.info('Backup job completed successfully', {
      jobId: job.id,
      backupId: result.backupId,
      serverId: result.serverId,
      duration: result.duration,
    });

    // Additional cleanup or notifications can be added here
  }
}

export default BackupJobHandler;
