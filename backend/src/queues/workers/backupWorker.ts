/**
 * Backup Worker
 * Processes backup jobs from the queue with concurrency control
 */

import { Worker, Job } from 'bullmq';
import { pool } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { QueueName } from '../queueManager';
import { BackupJobHandler, BackupJobData, BackupJobResult } from '../jobs/backupJobs';

/**
 * Redis connection configuration
 */
const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

/**
 * Worker configuration
 */
const CONCURRENCY = 2; // Maximum 2 backup jobs running concurrently

/**
 * Create backup job handler
 */
const backupJobHandler = new BackupJobHandler(pool, logger);

/**
 * Backup Worker
 */
export const backupWorker = new Worker<BackupJobData, BackupJobResult>(
  QueueName.BACKUP,
  async (job: Job<BackupJobData>) => {
    logger.info('Backup worker processing job', {
      jobId: job.id,
      backupId: job.data.backupId,
      serverId: job.data.serverId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });

    try {
      // Process the backup job
      const result = await backupJobHandler.process(job);

      // Call completion handler
      await backupJobHandler.onCompleted(job, result);

      return result;
    } catch (error) {
      logger.error('Backup worker job error', {
        jobId: job.id,
        backupId: job.data.backupId,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: job.attemptsMade + 1,
      });

      // If this is the last attempt, call the failure handler
      if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
        await backupJobHandler.onFailed(job, error as Error);
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: CONCURRENCY,
    lockDuration: 300000, // 5 minutes - lock duration for long-running backups
    autorun: true,
  }
);

/**
 * Worker event handlers
 */
backupWorker.on('ready', () => {
  logger.info('Backup worker ready', { concurrency: CONCURRENCY });
});

backupWorker.on('active', (job: Job) => {
  logger.info('Backup worker job active', {
    jobId: job.id,
    backupId: job.data.backupId,
    serverId: job.data.serverId,
  });
});

backupWorker.on('completed', (job: Job, result: BackupJobResult) => {
  logger.info('Backup worker job completed', {
    jobId: job.id,
    backupId: result.backupId,
    serverId: result.serverId,
    duration: result.duration,
    size: result.size,
  });
});

backupWorker.on('failed', (job: Job | undefined, error: Error) => {
  if (job) {
    logger.error('Backup worker job failed', {
      jobId: job.id,
      backupId: job.data.backupId,
      serverId: job.data.serverId,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });
  } else {
    logger.error('Backup worker job failed (no job info)', {
      error: error.message,
    });
  }
});

backupWorker.on('stalled', (jobId: string) => {
  logger.warn('Backup worker job stalled', { jobId });
});

backupWorker.on('error', (error: Error) => {
  logger.error('Backup worker error', {
    error: error.message,
    stack: error.stack,
  });
});

backupWorker.on('closed', () => {
  logger.info('Backup worker closed');
});

/**
 * Graceful shutdown
 */
export async function closeBackupWorker(): Promise<void> {
  try {
    logger.info('Closing backup worker...');
    await backupWorker.close();
    logger.info('Backup worker closed successfully');
  } catch (error) {
    logger.error('Error closing backup worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default backupWorker;
