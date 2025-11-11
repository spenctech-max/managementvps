/**
 * Job Status Routes
 * API endpoints for monitoring and managing queue jobs
 */

import { Router, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../config/logger';
import { QueueManager, backupQueue, scanQueue, updateQueue } from '../queues/queueManager';
import { sendSuccess, sendError } from '../types/responses';

const router = Router();

/**
 * GET /api/jobs/:id
 * Get job status by ID
 * Requires: Authentication
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Try to find the job in any queue
      const job = await QueueManager.getJob(jobId);

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // Get job state and progress
      const state = await job.getState();
      const progress = job.progress;
      const failedReason = job.failedReason;
      const returnValue = job.returnvalue;

      // Build response
      const jobInfo = {
        id: job.id,
        name: job.name,
        data: job.data,
        state,
        progress,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts || 3,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason,
        result: returnValue,
      };

      logger.info('Job status retrieved', {
        userId,
        jobId,
        state,
      });

      sendSuccess(res, jobInfo, 'Job status retrieved successfully');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to retrieve job status', {
        userId,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError('Failed to retrieve job status', 500);
    }
  })
);

/**
 * GET /api/jobs
 * List all jobs with filtering
 * Requires: Authentication
 * Query params:
 *  - queue: backup|scan|update (optional)
 *  - state: waiting|active|completed|failed (optional)
 *  - limit: number (default 50, max 200)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const queueName = req.query.queue as string;
    const state = req.query.state as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Determine which queues to query
      let queues = [backupQueue, scanQueue, updateQueue];

      if (queueName) {
        switch (queueName) {
          case 'backup':
            queues = [backupQueue];
            break;
          case 'scan':
            queues = [scanQueue];
            break;
          case 'update':
            queues = [updateQueue];
            break;
          default:
            throw new AppError('Invalid queue name', 400);
        }
      }

      // Determine which states to query
      const states = state ? [state] : ['waiting', 'active', 'completed', 'failed'];

      // Collect jobs from all queues
      const allJobs: any[] = [];

      for (const queue of queues) {
        for (const jobState of states) {
          let jobs: any[] = [];

          switch (jobState) {
            case 'waiting':
              jobs = await queue.getWaiting(0, limit);
              break;
            case 'active':
              jobs = await queue.getActive(0, limit);
              break;
            case 'completed':
              jobs = await queue.getCompleted(0, limit);
              break;
            case 'failed':
              jobs = await queue.getFailed(0, limit);
              break;
            case 'delayed':
              jobs = await queue.getDelayed(0, limit);
              break;
          }

          // Map jobs to response format
          const mappedJobs = await Promise.all(
            jobs.map(async (job) => ({
              id: job.id,
              queue: queue.name,
              name: job.name,
              data: job.data,
              state: await job.getState(),
              progress: job.progress,
              attempts: job.attemptsMade,
              maxAttempts: job.opts.attempts || 3,
              timestamp: job.timestamp,
              processedOn: job.processedOn,
              finishedOn: job.finishedOn,
              failedReason: job.failedReason,
            }))
          );

          allJobs.push(...mappedJobs);
        }
      }

      // Sort by timestamp (newest first) and limit
      allJobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const limitedJobs = allJobs.slice(0, limit);

      logger.info('Jobs list retrieved', {
        userId,
        queueName,
        state,
        count: limitedJobs.length,
      });

      sendSuccess(
        res,
        {
          jobs: limitedJobs,
          count: limitedJobs.length,
          total: allJobs.length,
        },
        'Jobs retrieved successfully'
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to retrieve jobs', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError('Failed to retrieve jobs', 500);
    }
  })
);

/**
 * DELETE /api/jobs/:id
 * Remove a job from the queue
 * Requires: Authentication
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Find the job
      const job = await QueueManager.getJob(jobId);

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      const state = await job.getState();

      // Don't allow removing active jobs
      if (state === 'active') {
        throw new AppError('Cannot remove active job', 400);
      }

      // Remove the job
      await job.remove();

      logger.info('Job removed', {
        userId,
        jobId,
        state,
      });

      sendSuccess(res, null, 'Job removed successfully');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to remove job', {
        userId,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError('Failed to remove job', 500);
    }
  })
);

/**
 * POST /api/jobs/:id/retry
 * Retry a failed job
 * Requires: Authentication
 */
router.post(
  '/:id/retry',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      // Find the job
      const job = await QueueManager.getJob(jobId);

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      const state = await job.getState();

      // Only retry failed jobs
      if (state !== 'failed') {
        throw new AppError('Only failed jobs can be retried', 400);
      }

      // Retry the job
      await job.retry();

      logger.info('Job retried', {
        userId,
        jobId,
      });

      sendSuccess(res, { jobId: job.id }, 'Job retry initiated successfully');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to retry job', {
        userId,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError('Failed to retry job', 500);
    }
  })
);

/**
 * GET /api/jobs/stats
 * Get overall job statistics
 * Requires: Authentication
 */
router.get(
  '/stats/all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User ID is required', 401);
    }

    try {
      const counts = await QueueManager.getAllQueueCounts();

      const stats = {
        backup: {
          ...counts.backup,
          total:
            (counts.backup.waiting || 0) +
            (counts.backup.active || 0) +
            (counts.backup.completed || 0) +
            (counts.backup.failed || 0),
        },
        scan: {
          ...counts.scan,
          total:
            (counts.scan.waiting || 0) +
            (counts.scan.active || 0) +
            (counts.scan.completed || 0) +
            (counts.scan.failed || 0),
        },
        update: {
          ...counts.update,
          total:
            (counts.update.waiting || 0) +
            (counts.update.active || 0) +
            (counts.update.completed || 0) +
            (counts.update.failed || 0),
        },
      };

      logger.info('Job statistics retrieved', {
        userId,
        stats,
      });

      sendSuccess(res, stats, 'Job statistics retrieved successfully');
    } catch (error) {
      logger.error('Failed to retrieve job statistics', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError('Failed to retrieve job statistics', 500);
    }
  })
);

export default router;
