/**
 * Prometheus Metrics Service
 * Provides application metrics in Prometheus format
 */

import { Request, Response, NextFunction } from 'express';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';

/**
 * Prometheus Registry
 */
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

/**
 * Custom HTTP Metrics
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

/**
 * WebSocket Metrics
 */
export const websocketConnectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const websocketMessagesTotal = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type'],
  registers: [register],
});

/**
 * Database Metrics
 */
export const dbPoolTotal = new Gauge({
  name: 'db_pool_connections_total',
  help: 'Total number of database pool connections',
  registers: [register],
});

export const dbPoolIdle = new Gauge({
  name: 'db_pool_connections_idle',
  help: 'Number of idle database pool connections',
  registers: [register],
});

export const dbPoolWaiting = new Gauge({
  name: 'db_pool_connections_waiting',
  help: 'Number of clients waiting for database connection',
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

/**
 * Redis Metrics
 */
export const redisConnected = new Gauge({
  name: 'redis_connected',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const redisCacheHits = new Counter({
  name: 'redis_cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register],
});

export const redisCacheMisses = new Counter({
  name: 'redis_cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register],
});

/**
 * Server Scan Metrics
 */
export const serverScansTotal = new Counter({
  name: 'server_scans_total',
  help: 'Total number of server scans',
  labelNames: ['status'],
  registers: [register],
});

export const serverScanDuration = new Histogram({
  name: 'server_scan_duration_seconds',
  help: 'Duration of server scans in seconds',
  labelNames: ['scan_type'],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register],
});

/**
 * Backup Metrics
 */
export const backupsTotal = new Counter({
  name: 'backups_total',
  help: 'Total number of backups',
  labelNames: ['status'],
  registers: [register],
});

export const backupDuration = new Histogram({
  name: 'backup_duration_seconds',
  help: 'Duration of backups in seconds',
  buckets: [1, 10, 30, 60, 300, 600],
  registers: [register],
});

/**
 * Update database pool metrics
 */
export function updateDbPoolMetrics(): void {
  dbPoolTotal.set(pool.totalCount);
  dbPoolIdle.set(pool.idleCount);
  dbPoolWaiting.set(pool.waitingCount);
}

/**
 * Update Redis connection status
 */
export function updateRedisMetrics(): void {
  redisConnected.set(redisClient.isOpen ? 1 : 0);
}

/**
 * Middleware to track HTTP metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Track response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
      },
      duration
    );
  });

  next();
}

/**
 * Metrics endpoint handler
 */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  // Update dynamic metrics before serving
  updateDbPoolMetrics();
  updateRedisMetrics();

  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
}

/**
 * Initialize metrics collection
 */
export function initializeMetrics(): void {
  // Update metrics every 30 seconds
  setInterval(() => {
    updateDbPoolMetrics();
    updateRedisMetrics();
  }, 30000);

  logger.info('Prometheus metrics initialized');
}
