import { createClient } from 'redis';
import { logger } from './logger';
import { env } from './env';

/**
 * Redis client configuration
 */
const redisUrl = `redis://${env.REDIS_PASSWORD ? `:${env.REDIS_PASSWORD}@` : ''}${env.REDIS_HOST}:${env.REDIS_PORT}`;

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis max reconnection attempts reached');
        return new Error('Redis max reconnection attempts reached');
      }
      // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
      return Math.min(retries * 50, 3000);
    },
  },
});

/**
 * Redis event handlers
 */
redisClient.on('error', (err) => {
  logger.error('Redis client error:', {
    message: err.message,
    stack: err.stack,
  });
});

redisClient.on('connect', () => {
  logger.info('Redis client connecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('end', () => {
  logger.info('Redis client disconnected');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis client reconnecting...');
});

/**
 * Connect to Redis
 */
export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error disconnecting from Redis:', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  },

  /**
   * Set value in cache with optional expiration
   */
  async set(key: string, value: string, expirationSeconds?: number): Promise<void> {
    try {
      if (expirationSeconds) {
        await redisClient.setEx(key, expirationSeconds, value);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  },

  /**
   * Clear all cache
   */
  async flush(): Promise<void> {
    try {
      await redisClient.flushDb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};

export default redisClient;
