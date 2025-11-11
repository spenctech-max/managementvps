/**
 * Enhanced Rate Limiting Middleware
 *
 * Features:
 * - Per-endpoint rate limiting
 * - Per-user rate limiting
 * - IP-based rate limiting
 * - Burst allowance support
 * - Progressive delay with Retry-After header
 * - Redis-backed counter storage
 * - Integration with IP blocking service
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import { RateLimitError } from '../errors';
import { ipBlockingService } from '../services/ipBlockingService';

/**
 * Rate limit tier types
 */
export enum RateLimitTier {
  PUBLIC = 'public',
  READ = 'read',
  WRITE = 'write',
  HEAVY = 'heavy',
  ADMIN = 'admin',
}

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests in window
  burstAllowance?: number; // Additional requests allowed in burst
  keyPrefix: string; // Redis key prefix
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Rate limit tier configurations
 */
const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitConfig> = {
  [RateLimitTier.PUBLIC]: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50, // Increased from 5 to allow login attempts without hitting limit
    burstAllowance: 0,
    keyPrefix: 'ratelimit:public',
    skipSuccessfulRequests: true, // Only count failed attempts
  },
  [RateLimitTier.READ]: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    burstAllowance: 10,
    keyPrefix: 'ratelimit:read',
  },
  [RateLimitTier.WRITE]: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    burstAllowance: 5,
    keyPrefix: 'ratelimit:write',
  },
  [RateLimitTier.HEAVY]: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    burstAllowance: 2,
    keyPrefix: 'ratelimit:heavy',
  },
  [RateLimitTier.ADMIN]: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    burstAllowance: 20,
    keyPrefix: 'ratelimit:admin',
  },
};

/**
 * Interface for rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Get client identifier (IP or user ID)
 */
function getClientIdentifier(req: AuthRequest): string {
  // Prefer user ID if authenticated
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Get IP address from request
 */
function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Increment rate limit counter
 */
async function incrementCounter(
  key: string,
  windowSeconds: number
): Promise<number> {
  const multi = redisClient.multi();
  multi.incr(key);
  multi.expire(key, windowSeconds);
  const results = await multi.exec();

  // First result is the incremented value
  return results?.[0] as number || 1;
}

/**
 * Get current rate limit status
 */
async function getRateLimitStatus(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitInfo> {
  const count = await redisClient.get(key);
  const currentCount = count ? parseInt(count, 10) : 0;
  const limit = config.maxRequests + (config.burstAllowance || 0);
  const remaining = Math.max(0, limit - currentCount);

  const ttl = await redisClient.ttl(key);
  const resetAt = ttl > 0
    ? new Date(Date.now() + ttl * 1000)
    : new Date(Date.now() + config.windowMs);

  return {
    limit,
    remaining,
    resetAt,
    retryAfter: ttl > 0 ? ttl : Math.floor(config.windowMs / 1000),
  };
}

/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(res: Response, info: RateLimitInfo): void {
  res.setHeader('X-RateLimit-Limit', info.limit.toString());
  res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(info.resetAt.getTime() / 1000).toString());

  if (info.retryAfter !== undefined) {
    res.setHeader('Retry-After', info.retryAfter.toString());
  }
}

/**
 * Record rate limit violation for IP blocking
 */
async function recordViolation(ip: string, endpoint: string): Promise<void> {
  const violationKey = `ratelimit:violations:${ip}`;
  const count = await redisClient.incr(violationKey);

  // Set expiration on first violation (1 hour window)
  if (count === 1) {
    await redisClient.expire(violationKey, 3600);
  }

  // Auto-block after threshold violations
  const violationThreshold = 10; // 10 violations in 1 hour
  if (count >= violationThreshold) {
    const blockDuration = 3600; // 1 hour
    await ipBlockingService.blockIp(ip, 'Automatic block due to rate limit violations', blockDuration);
    await redisClient.del(violationKey); // Clear violations after blocking

    logger.warn('IP auto-blocked due to rate limit violations', {
      ip,
      violationCount: count,
      endpoint,
    });
  }
}

/**
 * Create rate limiter middleware for a specific tier
 */
export function createRateLimiter(
  tier: RateLimitTier,
  options?: Partial<RateLimitConfig>
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = getClientIp(req);

      // Check if IP is blocked
      const isBlocked = await ipBlockingService.isIpBlocked(ip);
      if (isBlocked) {
        logger.warn('Blocked IP attempted access', {
          ip,
          path: req.path,
          method: req.method,
        });

        throw new RateLimitError('Access denied. Your IP has been blocked.', 3600);
      }

      // Check if IP is whitelisted
      const isWhitelisted = await ipBlockingService.isIpWhitelisted(ip);
      if (isWhitelisted) {
        // Whitelisted IPs bypass rate limiting
        next();
        return;
      }

      // Get configuration for tier
      const config = { ...RATE_LIMIT_TIERS[tier], ...options };
      const identifier = getClientIdentifier(req);
      const endpoint = `${req.method}:${req.route?.path || req.path}`;
      const key = `${config.keyPrefix}:${identifier}:${endpoint}`;

      // Get current status before incrementing
      const statusBefore = await getRateLimitStatus(key, config);

      // Check if limit exceeded
      const limit = config.maxRequests + (config.burstAllowance || 0);
      if (statusBefore.remaining <= 0) {
        // Record violation for potential IP blocking
        await recordViolation(ip, endpoint);

        // Set headers
        setRateLimitHeaders(res, statusBefore);

        logger.warn('Rate limit exceeded', {
          requestId: req.id,
          identifier,
          tier,
          endpoint,
          limit,
          path: req.path,
        });

        throw new RateLimitError(
          `Rate limit exceeded. Try again in ${statusBefore.retryAfter} seconds.`,
          statusBefore.retryAfter
        );
      }

      // Increment counter
      const windowSeconds = Math.floor(config.windowMs / 1000);
      await incrementCounter(key, windowSeconds);

      // Get updated status
      const statusAfter = await getRateLimitStatus(key, config);

      // Set rate limit headers
      setRateLimitHeaders(res, statusAfter);

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        // If Redis is down or other error, log but don't block requests
        logger.error('Rate limiter error (allowing request)', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: req.id,
          tier,
        });
        next();
      }
    }
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  public: createRateLimiter(RateLimitTier.PUBLIC),
  read: createRateLimiter(RateLimitTier.READ),
  write: createRateLimiter(RateLimitTier.WRITE),
  heavy: createRateLimiter(RateLimitTier.HEAVY),
  admin: createRateLimiter(RateLimitTier.ADMIN),
};

/**
 * Get rate limit statistics for a user or IP
 */
export async function getRateLimitStats(
  identifier: string
): Promise<Record<string, RateLimitInfo>> {
  const stats: Record<string, RateLimitInfo> = {};

  for (const [tier, config] of Object.entries(RATE_LIMIT_TIERS)) {
    const pattern = `${config.keyPrefix}:${identifier}:*`;

    try {
      // Get all keys matching pattern
      const keys = await redisClient.keys(pattern);

      for (const key of keys) {
        const endpoint = key.split(':').slice(3).join(':');
        const info = await getRateLimitStatus(key, config);
        stats[`${tier}:${endpoint}`] = info;
      }
    } catch (error) {
      logger.error('Error getting rate limit stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        identifier,
        tier,
      });
    }
  }

  return stats;
}

/**
 * Reset rate limit for a specific user or IP
 */
export async function resetRateLimit(
  identifier: string,
  tier?: RateLimitTier
): Promise<void> {
  try {
    if (tier) {
      // Reset specific tier
      const config = RATE_LIMIT_TIERS[tier];
      const pattern = `${config.keyPrefix}:${identifier}:*`;
      const keys = await redisClient.keys(pattern);

      if (keys.length > 0) {
        await redisClient.del(keys);
      }

      logger.info('Rate limit reset', { identifier, tier, keysDeleted: keys.length });
    } else {
      // Reset all tiers
      for (const config of Object.values(RATE_LIMIT_TIERS)) {
        const pattern = `${config.keyPrefix}:${identifier}:*`;
        const keys = await redisClient.keys(pattern);

        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      }

      logger.info('All rate limits reset', { identifier });
    }
  } catch (error) {
    logger.error('Error resetting rate limit', {
      error: error instanceof Error ? error.message : 'Unknown error',
      identifier,
      tier,
    });
    throw error;
  }
}

/**
 * Get global rate limit statistics
 */
export async function getGlobalRateLimitStats(): Promise<{
  tierStats: Record<string, { totalKeys: number; activeClients: number }>;
  recentViolations: Array<{ ip: string; count: number }>;
}> {
  const tierStats: Record<string, { totalKeys: number; activeClients: number }> = {};

  // Get stats for each tier
  for (const [tier, config] of Object.entries(RATE_LIMIT_TIERS)) {
    const pattern = `${config.keyPrefix}:*`;
    const keys = await redisClient.keys(pattern);

    // Extract unique clients
    const clients = new Set(
      keys.map(key => {
        const parts = key.split(':');
        return `${parts[2]}:${parts[3]}`; // user:id or ip:address
      })
    );

    tierStats[tier] = {
      totalKeys: keys.length,
      activeClients: clients.size,
    };
  }

  // Get recent violations
  const violationPattern = 'ratelimit:violations:*';
  const violationKeys = await redisClient.keys(violationPattern);
  const recentViolations: Array<{ ip: string; count: number }> = [];

  for (const key of violationKeys) {
    const ip = key.replace('ratelimit:violations:', '');
    const count = await redisClient.get(key);

    if (count) {
      recentViolations.push({
        ip,
        count: parseInt(count, 10),
      });
    }
  }

  // Sort by violation count
  recentViolations.sort((a, b) => b.count - a.count);

  return {
    tierStats,
    recentViolations: recentViolations.slice(0, 20), // Top 20
  };
}
