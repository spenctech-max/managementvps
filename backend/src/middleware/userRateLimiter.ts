/**
 * User-Based Rate Limiting Middleware
 * Limits requests per user (via JWT) instead of per IP
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import { RateLimitError } from '../errors';
import { env } from '../config/env';

/**
 * Rate limit configuration by role
 */
const RATE_LIMITS = {
  admin: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: 1000, // 1000 requests per 15 minutes
  },
  user: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS, // 100 requests per 15 minutes
  },
  viewer: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: 50, // 50 requests per 15 minutes
  },
  unauthenticated: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: 20, // 20 requests per 15 minutes
  },
};

/**
 * User-based rate limiting middleware
 */
export const userRateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Determine user identifier and role
    const userId = req.user?.id || req.ip || 'anonymous';
    const userRole = req.user?.role || 'unauthenticated';

    // Get rate limit config for role
    const config = RATE_LIMITS[userRole as keyof typeof RATE_LIMITS] || RATE_LIMITS.unauthenticated;

    // Create Redis key for this user
    const key = `ratelimit:${userId}`;

    // Get current count
    const current = await redisClient.get(key);
    const count = current ? parseInt(current, 10) : 0;

    // Check if limit exceeded
    if (count >= config.max) {
      const ttl = await redisClient.ttl(key);
      const retryAfter = ttl > 0 ? ttl : Math.floor(config.windowMs / 1000);

      logger.warn('Rate limit exceeded', {
        requestId: req.id,
        userId,
        userRole,
        count,
        limit: config.max,
        path: req.path,
      });

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', (Date.now() + retryAfter * 1000).toString());
      res.setHeader('Retry-After', retryAfter.toString());

      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }

    // Increment counter
    if (count === 0) {
      // First request in window - set with expiration
      await redisClient.setEx(key, Math.floor(config.windowMs / 1000), '1');
    } else {
      // Increment existing counter
      await redisClient.incr(key);
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.max.toString());
    res.setHeader('X-RateLimit-Remaining', (config.max - count - 1).toString());

    const ttl = await redisClient.ttl(key);
    if (ttl > 0) {
      res.setHeader('X-RateLimit-Reset', (Date.now() + ttl * 1000).toString());
    }

    next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      next(error);
    } else {
      // If Redis is down, log error but don't block requests
      logger.error('Rate limiter error (allowing request)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.id,
      });
      next();
    }
  }
};

/**
 * Reset rate limit for a specific user (admin function)
 */
export const resetUserRateLimit = async (userId: string): Promise<void> => {
  const key = `ratelimit:${userId}`;
  await redisClient.del(key);
  logger.info('Rate limit reset for user', { userId });
};

/**
 * Get rate limit status for a user
 */
export const getUserRateLimitStatus = async (userId: string, role: string): Promise<{
  limit: number;
  remaining: number;
  resetAt: Date | null;
}> => {
  const config = RATE_LIMITS[role as keyof typeof RATE_LIMITS] || RATE_LIMITS.unauthenticated;
  const key = `ratelimit:${userId}`;

  const current = await redisClient.get(key);
  const count = current ? parseInt(current, 10) : 0;
  const remaining = Math.max(0, config.max - count);

  const ttl = await redisClient.ttl(key);
  const resetAt = ttl > 0 ? new Date(Date.now() + ttl * 1000) : null;

  return {
    limit: config.max,
    remaining,
    resetAt,
  };
};
