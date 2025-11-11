/**
 * Enhanced Redis Caching Service
 * Provides structured caching with TTL, invalidation patterns, compression, and statistics
 */

import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Cache key prefixes for different data types
 */
export const CachePrefix = {
  SERVER_LIST: 'servers:list',
  SERVER_DETAIL: 'servers:detail',
  SCAN_RESULT: 'scans:result',
  BACKUP_LIST: 'backups:list',
  USER_SESSIONS: 'sessions:user',
  RATE_LIMIT: 'ratelimit',
} as const;

/**
 * Default TTL values (in seconds)
 */
export const CacheTTL = {
  SERVER_LIST: 120, // 2 minutes
  SERVER_DETAIL: 60, // 1 minute
  SERVER_SERVICES: 30, // 30 seconds
  SCAN_RESULT: 300, // 5 minutes
  BACKUP_LIST: 300, // 5 minutes
  USER_SESSION: 86400, // 24 hours
  RATE_LIMIT: 900, // 15 minutes
} as const;

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  compressionSaves: number;
}

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  compressionSaves: 0,
};

/**
 * Compression threshold (compress if larger than 1KB)
 */
const COMPRESSION_THRESHOLD = 1024;

/**
 * Enhanced cache service with compression support
 */
export class CacheService {
  /**
   * Get value from cache with automatic decompression
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);

      if (value) {
        stats.hits++;

        // Check if value is compressed (starts with special marker)
        if (value.startsWith('GZIP:')) {
          try {
            const compressed = Buffer.from(value.substring(5), 'base64');
            const decompressed = await gunzipAsync(compressed);
            return JSON.parse(decompressed.toString('utf-8')) as T;
          } catch (decompressionError) {
            logger.error('Cache decompression error:', {
              key,
              error: decompressionError instanceof Error ? decompressionError.message : 'Unknown error',
            });
            // Fall through to try parsing as regular JSON
          }
        }

        return JSON.parse(value) as T;
      }

      stats.misses++;
      return null;
    } catch (error) {
      logger.error('Cache get error:', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Set value in cache with TTL and automatic compression for large values
   */
  static async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      let toStore = serialized;

      // Compress if value is larger than threshold
      if (serialized.length > COMPRESSION_THRESHOLD) {
        try {
          const compressed = await gzipAsync(Buffer.from(serialized, 'utf-8'));
          const compressedStr = 'GZIP:' + compressed.toString('base64');

          // Only use compression if it actually saves space
          if (compressedStr.length < serialized.length) {
            toStore = compressedStr;
            stats.compressionSaves++;

            logger.debug('Cache compression applied', {
              key,
              originalSize: serialized.length,
              compressedSize: compressedStr.length,
              savingsPercent: Math.round((1 - compressedStr.length / serialized.length) * 100),
            });
          }
        } catch (compressionError) {
          logger.warn('Cache compression failed, storing uncompressed', {
            key,
            error: compressionError instanceof Error ? compressionError.message : 'Unknown error',
          });
          // Fall back to uncompressed
        }
      }

      if (ttl) {
        await redisClient.setEx(key, ttl, toStore);
      } else {
        await redisClient.set(key, toStore);
      }

      stats.sets++;
    } catch (error) {
      logger.error('Cache set error:', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete specific key
   */
  static async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
      stats.deletes++;
    } catch (error) {
      logger.error('Cache delete error:', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete all keys matching a pattern
   * Uses SCAN for better performance on large keysets
   */
  static async deletePattern(pattern: string): Promise<void> {
    try {
      let cursor = 0;
      let deletedCount = 0;

      do {
        // Use SCAN instead of KEYS for better performance
        const result = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });

        cursor = result.cursor;
        const keys = result.keys;

        if (keys.length > 0) {
          await redisClient.del(keys);
          deletedCount += keys.length;
          stats.deletes += keys.length;
        }
      } while (cursor !== 0);

      if (deletedCount > 0) {
        logger.info(`Deleted ${deletedCount} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error('Cache delete pattern error:', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Alias for deletePattern for backward compatibility
   */
  static async flushPattern(pattern: string): Promise<void> {
    return this.deletePattern(pattern);
  }

  /**
   * Flush all cache entries
   */
  static async flush(): Promise<void> {
    try {
      await redisClient.flushDb();
      logger.info('All cache entries flushed');
    } catch (error) {
      logger.error('Cache flush error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get time to live for a key
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      logger.error('Cache TTL error:', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return -1;
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): CacheStats {
    return { ...stats };
  }

  /**
   * Reset cache statistics
   */
  static resetStats(): void {
    stats.hits = 0;
    stats.misses = 0;
    stats.sets = 0;
    stats.deletes = 0;
    stats.compressionSaves = 0;
  }

  /**
   * Get cache hit rate
   */
  static getHitRate(): number {
    const total = stats.hits + stats.misses;
    return total === 0 ? 0 : (stats.hits / total) * 100;
  }

  /**
   * Invalidate all caches for a specific user
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    await Promise.all([
      this.deletePattern(`${CachePrefix.SERVER_LIST}:${userId}:*`),
      this.deletePattern(`${CachePrefix.BACKUP_LIST}:${userId}:*`),
      this.deletePattern(`*user:${userId}*`),
    ]);
  }

  /**
   * Invalidate all caches for a specific server
   */
  static async invalidateServerCache(serverId: string): Promise<void> {
    await Promise.all([
      this.deletePattern(`${CachePrefix.SERVER_DETAIL}:${serverId}`),
      this.deletePattern(`${CachePrefix.SERVER_LIST}:*`), // Invalidate all server lists
      this.deletePattern(`${CachePrefix.SCAN_RESULT}:${serverId}:*`),
      this.deletePattern(`${CachePrefix.BACKUP_LIST}:*:${serverId}`),
      this.deletePattern(`*:id:${serverId}:*`),
    ]);
  }

  /**
   * Cache key builders
   */
  static keys = {
    serverList: (userId: string, filters?: Record<string, any>) => {
      const filterStr = filters ? `:${JSON.stringify(filters)}` : '';
      return `${CachePrefix.SERVER_LIST}:${userId}${filterStr}`;
    },

    serverDetail: (serverId: string) => {
      return `${CachePrefix.SERVER_DETAIL}:${serverId}`;
    },

    scanResult: (serverId: string, scanId: string) => {
      return `${CachePrefix.SCAN_RESULT}:${serverId}:${scanId}`;
    },

    backupList: (userId: string, serverId?: string) => {
      const serverStr = serverId ? `:${serverId}` : '';
      return `${CachePrefix.BACKUP_LIST}:${userId}${serverStr}`;
    },

    userSessions: (userId: string) => {
      return `${CachePrefix.USER_SESSIONS}:${userId}`;
    },

    rateLimit: (userId: string) => {
      return `${CachePrefix.RATE_LIMIT}:${userId}`;
    },
  };

  /**
   * Cache-aside pattern helper
   * Gets from cache or fetches from source and caches
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetcher();

    // Store in cache
    await this.set(key, value, ttl);

    return value;
  }
}

export default CacheService;
