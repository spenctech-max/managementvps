/**
 * Backup Scheduler Service
 * Handles automated backup scheduling with node-cron and BullMQ queues
 */

import cron from 'node-cron';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { backupQueue } from '../queues/queueManager';
import { JobType, JobPriority } from '../queues/queueManager';
import { BackupJobData } from '../queues/jobs/backupJobs';

/**
 * Active cron jobs map
 */
const activeJobs = new Map<string, cron.ScheduledTask>();

/**
 * Backup Scheduler Service
 */
export class BackupScheduler {
  /**
   * Start the scheduler (load all active schedules from database)
   */
  static async start(): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT * FROM backup_schedules WHERE enabled = true'
      );

      for (const schedule of result.rows) {
        this.scheduleBackup(schedule);
      }

      logger.info(`Backup scheduler started with ${result.rows.length} active schedules`);
    } catch (error) {
      logger.error('Failed to start backup scheduler', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Schedule a backup job
   */
  static scheduleBackup(schedule: any): void {
    const scheduleId = schedule.id;

    // Remove existing job if any
    this.unscheduleBackup(scheduleId);

    // Create cron expression
    const cronExpression = this.createCronExpression(schedule);

    if (!cron.validate(cronExpression)) {
      logger.error('Invalid cron expression', { scheduleId, cronExpression });
      return;
    }

    // Schedule the job
    const job = cron.schedule(cronExpression, async () => {
      await this.executeScheduledBackup(schedule);
    });

    activeJobs.set(scheduleId, job);

    // Calculate and save next run time
    this.updateNextRunTime(scheduleId);

    logger.info('Backup scheduled', {
      scheduleId,
      serverId: schedule.server_id,
      cronExpression,
    });
  }

  /**
   * Unschedule a backup job
   */
  static unscheduleBackup(scheduleId: string): void {
    const existingJob = activeJobs.get(scheduleId);
    if (existingJob) {
      existingJob.stop();
      activeJobs.delete(scheduleId);
      logger.info('Backup unscheduled', { scheduleId });
    }
  }

  /**
   * Execute a scheduled backup (enqueues job to BullMQ)
   */
  private static async executeScheduledBackup(schedule: any): Promise<void> {
    const scheduleId = schedule.id;

    try {
      logger.info('Enqueuing scheduled backup', {
        scheduleId,
        serverId: schedule.server_id,
      });

      // Update last_run
      await pool.query(
        'UPDATE backup_schedules SET last_run = NOW(), last_status = $1 WHERE id = $2',
        ['pending', scheduleId]
      );

      // Get server details to find user_id
      const serverResult = await pool.query(
        'SELECT user_id FROM servers WHERE id = $1',
        [schedule.server_id]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }

      const userId = serverResult.rows[0].user_id;

      // Create backup record
      const backupResult = await pool.query(
        `INSERT INTO backups (server_id, backup_type, status, options, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [
          schedule.server_id,
          'full',
          'pending',
          JSON.stringify({
            source_path: schedule.source_path,
            destination_path: schedule.destination_path,
            compression: schedule.compression,
            encryption: schedule.encryption,
          }),
          JSON.stringify({ scheduleId, isScheduled: true }),
        ]
      );

      const backupId = backupResult.rows[0].id;

      // Enqueue backup job
      const jobData: BackupJobData = {
        serverId: schedule.server_id,
        backupId,
        userId,
        options: {
          backup_type: 'full',
          paths: schedule.source_path ? [schedule.source_path] : undefined,
          compression: schedule.compression,
          encryption: schedule.encryption,
        },
        scheduleId,
        isScheduled: true,
      };

      const job = await backupQueue.add(JobType.BACKUP_SCHEDULED, jobData, {
        priority: JobPriority.HIGH,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      logger.info('Scheduled backup enqueued', {
        scheduleId,
        backupId,
        jobId: job.id,
      });

      // Calculate next run time
      await this.updateNextRunTime(scheduleId);
    } catch (error) {
      logger.error('Failed to enqueue scheduled backup', {
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await pool.query(
        'UPDATE backup_schedules SET last_status = $1 WHERE id = $2',
        ['failure', scheduleId]
      );
    }
  }

  /**
   * Create cron expression from schedule
   */
  private static createCronExpression(schedule: any): string {
    const { schedule_type, hour, day_of_week, day_of_month } = schedule;

    switch (schedule_type) {
      case 'daily':
        // Run daily at specified hour
        return `0 ${hour} * * *`;

      case 'weekly':
        // Run weekly on specified day at specified hour
        return `0 ${hour} * * ${day_of_week}`;

      case 'monthly':
        // Run monthly on specified day at specified hour
        return `0 ${hour} ${day_of_month} * *`;

      default:
        throw new Error(`Unknown schedule type: ${schedule_type}`);
    }
  }

  /**
   * Calculate and update next run time
   */
  private static async updateNextRunTime(scheduleId: string): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT schedule_type, hour, day_of_week, day_of_month FROM backup_schedules WHERE id = $1',
        [scheduleId]
      );

      if (result.rows.length === 0) return;

      const schedule = result.rows[0];
      const nextRun = this.calculateNextRun(schedule);

      await pool.query('UPDATE backup_schedules SET next_run = $1 WHERE id = $2', [
        nextRun,
        scheduleId,
      ]);
    } catch (error) {
      logger.error('Failed to update next run time', {
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Calculate next run time based on schedule
   */
  private static calculateNextRun(schedule: any): Date {
    const now = new Date();
    const { schedule_type, hour, day_of_week, day_of_month } = schedule;

    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);

    switch (schedule_type) {
      case 'daily':
        // If time has passed today, schedule for tomorrow
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;

      case 'weekly':
        // Find next occurrence of day_of_week
        const currentDay = next.getDay();
        const daysUntilNext = (day_of_week - currentDay + 7) % 7;
        if (daysUntilNext === 0 && next <= now) {
          next.setDate(next.getDate() + 7);
        } else {
          next.setDate(next.getDate() + daysUntilNext);
        }
        break;

      case 'monthly':
        // Set to specified day of month
        next.setDate(day_of_month);
        // If date has passed this month, move to next month
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
    }

    return next;
  }

  /**
   * Get all active schedules
   */
  static getActiveSchedules(): string[] {
    return Array.from(activeJobs.keys());
  }

  /**
   * Stop all scheduled jobs
   */
  static stopAll(): void {
    for (const [scheduleId, job] of activeJobs) {
      job.stop();
      logger.info('Stopped backup schedule', { scheduleId });
    }
    activeJobs.clear();
  }
}

export default BackupScheduler;
