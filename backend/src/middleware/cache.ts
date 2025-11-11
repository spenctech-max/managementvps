/**
 * Redis Cache Middleware
 * Provides intelligent caching for expensive queries with TTL, key generation, and cache headers
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { logger } from '../config/logger';
import { CacheService } from '../services/cacheService';
import { env } from '../config/env';

/**
 * Cache configuration interface
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  includeUser?: boolean; // Include user ID in cache key (default: true)
  includeQuery?: boolean; // Include query params in cache key (default: false)
  keyPrefix?: string; // Custom key prefix (default: route path)
  varyBy?: string[]; // Additional fields to vary cache by (e.g., ['userId', 'serverId'])
}

/**
 * Generate a cache key based on request and options
 */
function generateCacheKey(req: AuthRequest, options: CacheOptions): string {
  const parts: string[] = [];

  // Add prefix (custom or route path)
  const prefix = options.keyPrefix || `route:${req.method}:${req.path}`;
  parts.push(prefix);

  // Add user ID if requested
  if (options.includeUser !== false && req.user?.id) {
    parts.push(`user:${req.user.id}`);
  }

  // Add route params
  if (req.params && Object.keys(req.params).length > 0) {
    const paramsStr = Object.entries(req.params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(':');
    parts.push(paramsStr);
  }

  // Add query params if requested
  if (options.includeQuery && req.query && Object.keys(req.query).length > 0) {
    const queryStr = Object.entries(req.query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(':');
    parts.push(`query:${queryStr}`);
  }

  // Add custom vary-by fields
  if (options.varyBy) {
    options.varyBy.forEach((field) => {
      const value = (req as any)[field] || (req.params as any)?.[field] || (req.query as any)?.[field];
      if (value) {
        parts.push(`${field}:${value}`);
      }
    });
  }

  return parts.join(':');
}

/**
 * Cache middleware factory
 * Creates a middleware that caches GET responses
 *
 * Usage:
 *   router.get('/api/servers', authenticateToken, cache({ ttl: 120 }), handler)
 */
export function cache(options: CacheOptions = {}) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check if caching is enabled
    if (!env.CACHE_ENABLED) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = generateCacheKey(req, options);

      // Try to get from cache
      const cachedData = await CacheService.get(cacheKey);

      if (cachedData !== null) {
        // Cache hit
        logger.debug('Cache HIT', {
          key: cacheKey,
          userId: req.user?.id,
          path: req.path
        });

        // Set cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);

        // Return cached response
        return res.status(200).json(cachedData);
      }

      // Cache miss - continue to handler
      logger.debug('Cache MISS', {
        key: cacheKey,
        userId: req.user?.id,
        path: req.path
      });

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function (body: any): Response {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const ttl = options.ttl || env.CACHE_DEFAULT_TTL;

          // Cache the response asynchronously (don't wait)
          CacheService.set(cacheKey, body, ttl).catch((error) => {
            logger.error('Failed to cache response', {
              key: cacheKey,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });

          // Set cache headers
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Key', cacheKey);
          res.setHeader('Cache-Control', `private, max-age=${ttl}`);
        }

        // Call original json method
        return originalJson(body);
      };

      next();
    } catch (error) {
      // On error, continue without caching
      logger.error('Cache middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });
      next();
    }
  };
}

/**
 * Cache invalidation helper
 * Invalidates cache entries matching a pattern
 *
 * Usage in routes:
 *   await invalidateCache('servers:*')
 *   await invalidateCache('route:GET:/api/servers:user:*')
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    await CacheService.deletePattern(pattern);
    logger.info('Cache invalidated', { pattern });
  } catch (error) {
    logger.error('Cache invalidation error', {
      pattern,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Cache invalidation middleware factory
 * Automatically invalidates cache after successful mutations
 *
 * Usage:
 *   router.post('/api/servers', authenticateToken, invalidateCacheAfter(['servers:*']), handler)
 */
export function invalidateCacheAfter(patterns: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to invalidate cache after response
    res.json = function (body: any): Response {
      // Only invalidate on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Invalidate cache asynchronously (don't wait)
        Promise.all(patterns.map(pattern => {
          // Replace placeholders in pattern with actual values
          let resolvedPattern = pattern
            .replace(':userId', req.user?.id || '*')
            .replace(':serverId', req.params.serverId || req.params.id || '*')
            .replace(':id', req.params.id || '*');

          return invalidateCache(resolvedPattern);
        })).catch((error) => {
          logger.error('Failed to invalidate cache', {
            patterns,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }

      // Call original json method
      return originalJson(body);
    };

    next();
  };
}

/**
 * Pre-built cache configurations for common routes
 */
export const CacheConfig = {
  // Server routes
  serverList: { ttl: 120, keyPrefix: 'servers:list', includeUser: true }, // 2 minutes
  serverDetail: { ttl: 60, keyPrefix: 'servers:detail', includeUser: true }, // 1 minute
  serverServices: { ttl: 30, keyPrefix: 'servers:services', includeUser: true }, // 30 seconds

  // Scan routes
  scanList: { ttl: 300, keyPrefix: 'scans:list', includeUser: true }, // 5 minutes
  scanDetail: { ttl: 300, keyPrefix: 'scans:detail', includeUser: true }, // 5 minutes

  // Backup routes
  backupList: { ttl: 300, keyPrefix: 'backups:list', includeUser: true }, // 5 minutes
  backupDetail: { ttl: 300, keyPrefix: 'backups:detail', includeUser: true }, // 5 minutes
} as const;

/**
 * Pre-built invalidation patterns
 */
export const InvalidationPatterns = {
  // Invalidate all server-related caches
  allServers: ['route:GET:/api/servers:*', 'servers:*'],

  // Invalidate specific server caches
  server: (serverId?: string) => [
    `route:GET:/api/servers/${serverId || ':id'}:*`,
    `servers:detail:*:id:${serverId || ':id'}:*`,
    `servers:services:*:id:${serverId || ':id'}:*`,
    'route:GET:/api/servers:*', // Also invalidate list
  ],

  // Invalidate all scan-related caches
  allScans: ['route:GET:/api/scans:*', 'scans:*'],

  // Invalidate specific scan caches
  scan: (scanId?: string) => [
    `route:GET:/api/scans/${scanId || ':id'}:*`,
    `scans:detail:*:id:${scanId || ':id'}:*`,
    'route:GET:/api/scans:*', // Also invalidate list
  ],

  // Invalidate all backup-related caches
  allBackups: ['route:GET:/api/backups:*', 'backups:*'],

  // Invalidate specific backup caches
  backup: (backupId?: string) => [
    `route:GET:/api/backups/${backupId || ':id'}:*`,
    `backups:detail:*:id:${backupId || ':id'}:*`,
    'route:GET:/api/backups:*', // Also invalidate list
  ],
} as const;
