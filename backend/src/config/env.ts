/**
 * Environment Variable Validation with Zod
 * Ensures all required environment variables are present and valid at startup
 */

import { z } from 'zod';

// Define the environment schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().regex(/^\d+$/).transform(Number).default('5432'),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().regex(/^\d+$/).transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Authentication & Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be exactly 64 characters (hex)'),

  // CORS
  CORS_ORIGIN: z.string().url().or(z.literal('*')).default('http://localhost:8080'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('900000'), // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('100'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),

  // File Upload
  MAX_FILE_SIZE: z.string().regex(/^\d+$/).transform(Number).default('52428800'), // 50MB

  // SSH
  SSH_CONNECTION_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('30000'), // 30 seconds
  SSH_KEEPALIVE_INTERVAL: z.string().regex(/^\d+$/).transform(Number).default('30000'), // 30 seconds

  // Cache
  CACHE_ENABLED: z.string().transform((val) => val === 'true' || val === '1').default('true'),
  CACHE_DEFAULT_TTL: z.string().regex(/^\d+$/).transform(Number).default('300'), // 5 minutes
});

// Export the type
export type Env = z.infer<typeof envSchema>;

// Validate and parse environment variables
function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        return `${err.path.join('.')}: ${err.message}`;
      });

      // Use process.stderr for early startup errors before logger is initialized
      process.stderr.write('❌ Invalid environment variables:\n');
      errors.forEach((err) => process.stderr.write(`  - ${err}\n`));
      process.stderr.write('\nPlease check your .env file and ensure all required variables are set.\n');

      process.exit(1);
    }
    throw error;
  }
}

// Validate on import
export const env = validateEnv();

// Helper to check if in production
export const isProduction = env.NODE_ENV === 'production';

// Helper to check if in development
export const isDevelopment = env.NODE_ENV === 'development';

// Helper to check if in test
export const isTest = env.NODE_ENV === 'test';
