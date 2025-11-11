/**
 * Metrics API Routes
 * Provides system metrics for monitoring and debugging
 */

import express, { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import CacheService from '../services/cache';
import { sendSuccess } from '../types/responses';
import { ForbiddenError, ServiceUnavailableError } from '../errors';
import { QueueManager } from '../queues/queueManager';

const router = express.Router();

/**
 * GET /api/metrics/db-pool
 * Get database connection pool statistics
 * Requires: Admin role
 */
router.get(
  '/db-pool',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const poolMetrics = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      maxConnections: 50,
      usage: {
        active: pool.totalCount - pool.idleCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        utilization: pool.totalCount > 0 ? ((pool.totalCount - pool.idleCount) / 50) * 100 : 0,
      },
      health: {
        status: pool.totalCount <= 50 && pool.waitingCount === 0 ? 'healthy' : 'degraded',
        message:
          pool.waitingCount > 0
            ? `${pool.waitingCount} clients waiting for connection`
            : pool.totalCount > 45
            ? 'Connection pool near capacity'
            : 'All systems operational',
      },
    };

    sendSuccess(res, poolMetrics, 'Database pool metrics retrieved');
  })
);

/**
 * GET /api/metrics/cache
 * Get Redis cache statistics
 * Requires: Admin role
 */
router.get(
  '/cache',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const stats = CacheService.getStats();
    const hitRate = CacheService.getHitRate();

    // Get Redis info
    let redisInfo: any = {};
    try {
      const info = await redisClient.info('memory');
      const lines = info.split('\r\n');

      lines.forEach((line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          redisInfo[key] = value;
        }
      });
    } catch (error) {
      redisInfo = { error: 'Failed to fetch Redis info' };
    }

    const cacheMetrics = {
      statistics: {
        hits: stats.hits,
        misses: stats.misses,
        sets: stats.sets,
        deletes: stats.deletes,
        hitRate: `${hitRate.toFixed(2)}%`,
      },
      redis: {
        connected: redisClient.isOpen,
        memoryUsed: redisInfo.used_memory_human || 'N/A',
        memoryPeak: redisInfo.used_memory_peak_human || 'N/A',
      },
      health: {
        status: redisClient.isOpen && hitRate > 50 ? 'healthy' : hitRate > 20 ? 'degraded' : 'poor',
        message: !redisClient.isOpen
          ? 'Redis disconnected'
          : hitRate > 50
          ? 'Cache performing well'
          : hitRate > 20
          ? 'Consider increasing cache TTL'
          : 'Low cache hit rate',
      },
    };

    sendSuccess(res, cacheMetrics, 'Cache metrics retrieved');
  })
);

/**
 * GET /api/metrics/queues
 * Get job queue statistics
 * Requires: Admin role
 */
router.get(
  '/queues',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    try {
      const counts = await QueueManager.getAllQueueCounts();

      const queueMetrics = {
        backup: {
          waiting: counts.backup.waiting || 0,
          active: counts.backup.active || 0,
          completed: counts.backup.completed || 0,
          failed: counts.backup.failed || 0,
          delayed: counts.backup.delayed || 0,
          paused: counts.backup.paused || 0,
          total:
            (counts.backup.waiting || 0) +
            (counts.backup.active || 0) +
            (counts.backup.completed || 0) +
            (counts.backup.failed || 0) +
            (counts.backup.delayed || 0),
        },
        scan: {
          waiting: counts.scan.waiting || 0,
          active: counts.scan.active || 0,
          completed: counts.scan.completed || 0,
          failed: counts.scan.failed || 0,
          delayed: counts.scan.delayed || 0,
          paused: counts.scan.paused || 0,
          total:
            (counts.scan.waiting || 0) +
            (counts.scan.active || 0) +
            (counts.scan.completed || 0) +
            (counts.scan.failed || 0) +
            (counts.scan.delayed || 0),
        },
        update: {
          waiting: counts.update.waiting || 0,
          active: counts.update.active || 0,
          completed: counts.update.completed || 0,
          failed: counts.update.failed || 0,
          delayed: counts.update.delayed || 0,
          paused: counts.update.paused || 0,
          total:
            (counts.update.waiting || 0) +
            (counts.update.active || 0) +
            (counts.update.completed || 0) +
            (counts.update.failed || 0) +
            (counts.update.delayed || 0),
        },
        health: {
          status:
            (counts.backup.active || 0) <= 2 &&
            (counts.scan.active || 0) <= 5 &&
            (counts.backup.failed || 0) < 10 &&
            (counts.scan.failed || 0) < 10
              ? 'healthy'
              : 'degraded',
          message:
            (counts.backup.active || 0) > 2
              ? 'Backup queue running at capacity'
              : (counts.scan.active || 0) > 5
              ? 'Scan queue running at capacity'
              : (counts.backup.failed || 0) >= 10 || (counts.scan.failed || 0) >= 10
              ? 'High number of failed jobs'
              : 'All queues operating normally',
        },
      };

      sendSuccess(res, queueMetrics, 'Queue metrics retrieved');
    } catch (error) {
      throw new ServiceUnavailableError('Failed to retrieve queue metrics');
    }
  })
);

/**
 * GET /api/metrics/system
 * Get overall system health metrics
 * Requires: Admin role
 */
router.get(
  '/system',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    // Database health
    let dbHealth = 'unknown';
    try {
      await pool.query('SELECT 1');
      dbHealth = 'healthy';
    } catch (error) {
      dbHealth = 'unhealthy';
    }

    // Redis health
    const redisHealth = redisClient.isOpen ? 'healthy' : 'unhealthy';

    // Queue health
    let queueHealth = 'unknown';
    let queueCounts: any = {};
    try {
      queueCounts = await QueueManager.getAllQueueCounts();
      queueHealth =
        (queueCounts.backup.active || 0) <= 2 &&
        (queueCounts.scan.active || 0) <= 5 &&
        (queueCounts.backup.failed || 0) < 10 &&
        (queueCounts.scan.failed || 0) < 10
          ? 'healthy'
          : 'degraded';
    } catch (error) {
      queueHealth = 'unhealthy';
    }

    // Memory usage (Node.js process)
    const memoryUsage = process.memoryUsage();

    // Uptime
    const uptime = process.uptime();

    const systemMetrics = {
      services: {
        database: {
          status: dbHealth,
          connections: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        },
        redis: {
          status: redisHealth,
          connected: redisClient.isOpen,
        },
        cache: {
          hitRate: `${CacheService.getHitRate().toFixed(2)}%`,
          stats: CacheService.getStats(),
        },
        queues: {
          status: queueHealth,
          backup: {
            active: queueCounts.backup?.active || 0,
            waiting: queueCounts.backup?.waiting || 0,
            failed: queueCounts.backup?.failed || 0,
          },
          scan: {
            active: queueCounts.scan?.active || 0,
            waiting: queueCounts.scan?.waiting || 0,
            failed: queueCounts.scan?.failed || 0,
          },
        },
      },
      process: {
        uptime: {
          seconds: uptime,
          formatted: formatUptime(uptime),
        },
        memory: {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
        },
        version: process.version,
        platform: process.platform,
      },
      health: {
        status:
          dbHealth === 'healthy' &&
          redisHealth === 'healthy' &&
          queueHealth === 'healthy'
            ? 'healthy'
            : 'degraded',
        timestamp: new Date().toISOString(),
      },
    };

    sendSuccess(res, systemMetrics, 'System metrics retrieved');
  })
);

/**
 * POST /api/metrics/cache/reset
 * Reset cache statistics
 * Requires: Admin role
 */
router.post(
  '/cache/reset',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    CacheService.resetStats();

    sendSuccess(res, null, 'Cache statistics reset successfully');
  })
);

/**
 * Helper function to format uptime
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

export default router;
