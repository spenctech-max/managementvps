/**
 * Scan Worker
 * Processes scan jobs from the queue with concurrency control
 */

import { Worker, Job } from 'bullmq';
import { pool } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { QueueName } from '../queueManager';
import { ScanJobHandler, ScanJobData, ScanJobResult } from '../jobs/scanJobs';

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
const CONCURRENCY = 5; // Maximum 5 scan jobs running concurrently

/**
 * Create scan job handler
 */
const scanJobHandler = new ScanJobHandler(pool, logger);

/**
 * Scan Worker
 */
export const scanWorker = new Worker<ScanJobData, ScanJobResult>(
  QueueName.SCAN,
  async (job: Job<ScanJobData>) => {
    logger.info('Scan worker processing job', {
      jobId: job.id,
      scanId: job.data.scanId,
      serverId: job.data.serverId,
      scanType: job.data.scanType,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });

    try {
      // Process the scan job
      const result = await scanJobHandler.process(job);

      // Call completion handler
      await scanJobHandler.onCompleted(job, result);

      return result;
    } catch (error) {
      logger.error('Scan worker job error', {
        jobId: job.id,
        scanId: job.data.scanId,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: job.attemptsMade + 1,
      });

      // If this is the last attempt, call the failure handler
      if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
        await scanJobHandler.onFailed(job, error as Error);
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: CONCURRENCY,
    lockDuration: 120000, // 2 minutes - lock duration for scans
    autorun: true,
  }
);

/**
 * Worker event handlers
 */
scanWorker.on('ready', () => {
  logger.info('Scan worker ready', { concurrency: CONCURRENCY });
});

scanWorker.on('active', (job: Job) => {
  logger.info('Scan worker job active', {
    jobId: job.id,
    scanId: job.data.scanId,
    serverId: job.data.serverId,
    scanType: job.data.scanType,
  });
});

scanWorker.on('completed', (job: Job, result: ScanJobResult) => {
  logger.info('Scan worker job completed', {
    jobId: job.id,
    scanId: result.scanId,
    serverId: result.serverId,
    duration: result.duration,
  });
});

scanWorker.on('failed', (job: Job | undefined, error: Error) => {
  if (job) {
    logger.error('Scan worker job failed', {
      jobId: job.id,
      scanId: job.data.scanId,
      serverId: job.data.serverId,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });
  } else {
    logger.error('Scan worker job failed (no job info)', {
      error: error.message,
    });
  }
});

scanWorker.on('stalled', (jobId: string) => {
  logger.warn('Scan worker job stalled', { jobId });
});

scanWorker.on('error', (error: Error) => {
  logger.error('Scan worker error', {
    error: error.message,
    stack: error.stack,
  });
});

scanWorker.on('closed', () => {
  logger.info('Scan worker closed');
});

/**
 * Graceful shutdown
 */
export async function closeScanWorker(): Promise<void> {
  try {
    logger.info('Closing scan worker...');
    await scanWorker.close();
    logger.info('Scan worker closed successfully');
  } catch (error) {
    logger.error('Error closing scan worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default scanWorker;
