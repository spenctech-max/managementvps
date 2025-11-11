/**
 * Queue Manager
 * Central management for BullMQ queues
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import { env } from '../config/env';

/**
 * Redis connection configuration for BullMQ
 */
const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
};

/**
 * Queue names
 */
export enum QueueName {
  BACKUP = 'backup-queue',
  SCAN = 'scan-queue',
  UPDATE = 'update-queue',
}

/**
 * Job types
 */
export enum JobType {
  BACKUP_MANUAL = 'backup:manual',
  BACKUP_SCHEDULED = 'backup:scheduled',
  SCAN_FULL = 'scan:full',
  SCAN_QUICK = 'scan:quick',
  UPDATE_SERVER = 'update:server',
}

/**
 * Job priorities
 */
export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
}

/**
 * Default queue options
 */
const defaultQueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000, // Start with 5 seconds
    },
    removeOnComplete: {
      age: 86400 * 7, // Keep completed jobs for 7 days
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400 * 7, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Queue instances
 */
export const backupQueue = new Queue(QueueName.BACKUP, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: JobPriority.HIGH,
  },
});

export const scanQueue = new Queue(QueueName.SCAN, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: JobPriority.NORMAL,
  },
});

export const updateQueue = new Queue(QueueName.UPDATE, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: JobPriority.CRITICAL,
  },
});

/**
 * Queue Events for monitoring
 */
export const backupQueueEvents = new QueueEvents(QueueName.BACKUP, { connection });
export const scanQueueEvents = new QueueEvents(QueueName.SCAN, { connection });
export const updateQueueEvents = new QueueEvents(QueueName.UPDATE, { connection });

/**
 * Queue Manager class
 */
export class QueueManager {
  private static initialized = false;

  /**
   * Initialize all queues and set up event listeners
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Queue manager already initialized');
      return;
    }

    try {
      logger.info('Initializing queue manager...');

      // Set up backup queue events
      this.setupQueueEvents(backupQueueEvents, QueueName.BACKUP);
      this.setupQueueEvents(scanQueueEvents, QueueName.SCAN);
      this.setupQueueEvents(updateQueueEvents, QueueName.UPDATE);

      // Verify queues are ready
      await Promise.all([
        backupQueue.waitUntilReady(),
        scanQueue.waitUntilReady(),
        updateQueue.waitUntilReady(),
      ]);

      this.initialized = true;
      logger.info('Queue manager initialized successfully');

      // Log current queue stats
      await this.logQueueStats();
    } catch (error) {
      logger.error('Failed to initialize queue manager', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Set up event listeners for a queue
   */
  private static setupQueueEvents(queueEvents: QueueEvents, queueName: string): void {
    queueEvents.on('waiting', ({ jobId }) => {
      logger.debug('Job waiting', { queueName, jobId });
    });

    queueEvents.on('active', ({ jobId }) => {
      logger.info('Job started', { queueName, jobId });
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info('Job completed', {
        queueName,
        jobId,
        result: returnvalue,
      });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', {
        queueName,
        jobId,
        reason: failedReason,
      });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', {
        queueName,
        jobId,
        progress: data,
      });
    });

    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn('Job stalled', { queueName, jobId });
    });

    queueEvents.on('error', (error) => {
      logger.error('Queue error', {
        queueName,
        error: error.message,
      });
    });
  }

  /**
   * Log current queue statistics
   */
  static async logQueueStats(): Promise<void> {
    try {
      const [backupCounts, scanCounts, updateCounts] = await Promise.all([
        backupQueue.getJobCounts(),
        scanQueue.getJobCounts(),
        updateQueue.getJobCounts(),
      ]);

      logger.info('Queue statistics', {
        backup: backupCounts,
        scan: scanCounts,
        update: updateCounts,
      });
    } catch (error) {
      logger.error('Failed to get queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get queue by name
   */
  static getQueue(name: QueueName): Queue {
    switch (name) {
      case QueueName.BACKUP:
        return backupQueue;
      case QueueName.SCAN:
        return scanQueue;
      case QueueName.UPDATE:
        return updateQueue;
      default:
        throw new Error(`Unknown queue: ${name}`);
    }
  }

  /**
   * Get all queue counts
   */
  static async getAllQueueCounts(): Promise<{
    backup: any;
    scan: any;
    update: any;
  }> {
    const [backup, scan, update] = await Promise.all([
      backupQueue.getJobCounts(),
      scanQueue.getJobCounts(),
      updateQueue.getJobCounts(),
    ]);

    return { backup, scan, update };
  }

  /**
   * Get job by ID from any queue
   */
  static async getJob(jobId: string): Promise<any> {
    // Try to find job in all queues
    const jobs = await Promise.all([
      backupQueue.getJob(jobId),
      scanQueue.getJob(jobId),
      updateQueue.getJob(jobId),
    ]);

    return jobs.find((job) => job !== undefined);
  }

  /**
   * Clean old jobs from all queues
   */
  static async cleanOldJobs(): Promise<void> {
    try {
      logger.info('Cleaning old jobs from queues...');

      const gracePeriod = 86400 * 7 * 1000; // 7 days in milliseconds

      await Promise.all([
        backupQueue.clean(gracePeriod, 1000, 'completed'),
        backupQueue.clean(gracePeriod, 1000, 'failed'),
        scanQueue.clean(gracePeriod, 1000, 'completed'),
        scanQueue.clean(gracePeriod, 1000, 'failed'),
        updateQueue.clean(gracePeriod, 1000, 'completed'),
        updateQueue.clean(gracePeriod, 1000, 'failed'),
      ]);

      logger.info('Old jobs cleaned successfully');
    } catch (error) {
      logger.error('Failed to clean old jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Pause all queues
   */
  static async pauseAll(): Promise<void> {
    logger.info('Pausing all queues...');
    await Promise.all([backupQueue.pause(), scanQueue.pause(), updateQueue.pause()]);
    logger.info('All queues paused');
  }

  /**
   * Resume all queues
   */
  static async resumeAll(): Promise<void> {
    logger.info('Resuming all queues...');
    await Promise.all([backupQueue.resume(), scanQueue.resume(), updateQueue.resume()]);
    logger.info('All queues resumed');
  }

  /**
   * Close all queues
   */
  static async closeAll(): Promise<void> {
    try {
      logger.info('Closing all queues...');

      await Promise.all([
        backupQueue.close(),
        scanQueue.close(),
        updateQueue.close(),
        backupQueueEvents.close(),
        scanQueueEvents.close(),
        updateQueueEvents.close(),
      ]);

      this.initialized = false;
      logger.info('All queues closed successfully');
    } catch (error) {
      logger.error('Failed to close queues', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Obliterate a queue (remove all jobs)
   */
  static async obliterateQueue(queueName: QueueName): Promise<void> {
    try {
      logger.warn('Obliterating queue', { queueName });
      const queue = this.getQueue(queueName);
      await queue.obliterate({ force: true });
      logger.info('Queue obliterated', { queueName });
    } catch (error) {
      logger.error('Failed to obliterate queue', {
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export default QueueManager;
