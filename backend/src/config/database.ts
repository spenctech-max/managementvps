import { Pool, PoolConfig } from 'pg';
import { logger } from './logger';
import { env } from './env';

/**
 * Database configuration
 */
const poolConfig: PoolConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: 50, // Maximum number of clients in the pool (increased for powerful server)
  min: 5, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection cannot be established
  statement_timeout: 60000, // Abort any statement that takes more than 60 seconds (increased for complex queries)
};

/**
 * Create database pool
 */
export const pool = new Pool(poolConfig);

/**
 * Pool event handlers
 */
pool.on('connect', () => {
  logger.info('New database client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error:', {
    message: err.message,
    stack: err.stack,
  });
});

pool.on('remove', () => {
  logger.info('Database client removed from pool');
});

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Test database connection with retry logic
 * Useful for Docker environments where database may not be immediately available
 */
export async function testDatabaseConnectionWithRetry(
  maxRetries: number = 10,
  delayMs: number = 2000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection successful', { attempt });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (attempt === maxRetries) {
        logger.error('Database connection failed after all retries:', {
          attempt,
          maxRetries,
          message: errorMessage,
        });
        return false;
      }

      const backoffDelay = delayMs * attempt; // Exponential backoff
      logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed, retrying in ${backoffDelay}ms...`, {
        message: errorMessage,
      });

      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  return false;
}

/**
 * Close all database connections
 */
export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error('Error closing database pool:', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Transaction helper
 */
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
