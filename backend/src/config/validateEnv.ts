/**
 * Environment Variable Validation
 *
 * This module validates all required environment variables at application startup.
 * If any required variable is missing or invalid, the application will exit with
 * a clear error message to prevent running with insecure defaults.
 */

// List of insecure default values that should never be used in production
const FORBIDDEN_VALUES = [
  'your-secret',
  'your_secret',
  'changeme',
  'change-me',
  'change_me',
  'postgres',
  'password',
  'admin',
  'secret',
  'test',
  'example',
  'your-secret-key-change-in-production',
  '0123456789abcdef',
];

/**
 * Validates that all required environment variables are set and secure
 * Exits the process if validation fails
 */
export function validateEnvironment(): boolean {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate NODE_ENV
  if (!process.env.NODE_ENV) {
    errors.push('NODE_ENV must be set (either "production" or "development")');
  } else if (!['production', 'development'].includes(process.env.NODE_ENV)) {
    errors.push('NODE_ENV must be either "production" or "development"');
  }

  // Validate ENCRYPTION_KEY (must be exactly 64 hex characters)
  if (!process.env.ENCRYPTION_KEY) {
    errors.push('ENCRYPTION_KEY is required');
  } else if (!/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
    errors.push('ENCRYPTION_KEY must be exactly 64 hexadecimal characters (use: openssl rand -hex 32)');
  } else if (isForbiddenValue(process.env.ENCRYPTION_KEY)) {
    errors.push('ENCRYPTION_KEY is using an insecure default value');
  }

  // Validate JWT_SECRET (minimum 32 characters)
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  } else if (isForbiddenValue(process.env.JWT_SECRET)) {
    errors.push('JWT_SECRET is using an insecure default value');
  }

  // Validate SESSION_SECRET (minimum 32 characters)
  if (!process.env.SESSION_SECRET) {
    errors.push('SESSION_SECRET is required');
  } else if (process.env.SESSION_SECRET.length < 32) {
    errors.push('SESSION_SECRET must be at least 32 characters long');
  } else if (isForbiddenValue(process.env.SESSION_SECRET)) {
    errors.push('SESSION_SECRET is using an insecure default value');
  }

  // Validate DB_PASSWORD
  if (!process.env.DB_PASSWORD) {
    errors.push('DB_PASSWORD is required');
  } else if (isForbiddenValue(process.env.DB_PASSWORD)) {
    errors.push('DB_PASSWORD is using an insecure default value');
  } else if (process.env.DB_PASSWORD.length < 12) {
    warnings.push('DB_PASSWORD should be at least 12 characters for better security');
  }

  // Validate REDIS_PASSWORD
  if (!process.env.REDIS_PASSWORD) {
    errors.push('REDIS_PASSWORD is required');
  } else if (isForbiddenValue(process.env.REDIS_PASSWORD)) {
    errors.push('REDIS_PASSWORD is using an insecure default value');
  }

  // Validate database connection settings
  if (!process.env.DB_HOST) {
    errors.push('DB_HOST is required');
  }
  if (!process.env.DB_NAME) {
    errors.push('DB_NAME is required');
  }
  if (!process.env.DB_USER) {
    errors.push('DB_USER is required');
  }

  // Validate Redis connection
  if (!process.env.REDIS_HOST) {
    errors.push('REDIS_HOST is required');
  }

  // Production-specific validations
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.includes('localhost')) {
      warnings.push('CORS_ORIGIN should be set to your production domain, not localhost');
    }

    if (process.env.LOG_IP === 'true') {
      warnings.push('LOG_IP is enabled in production - this may compromise user anonymity');
    }

    if (process.env.LOG_USER_AGENT === 'true') {
      warnings.push('LOG_USER_AGENT is enabled in production - this may compromise user anonymity');
    }
  }

  // Display results
  if (warnings.length > 0) {
    console.warn('\n\u26A0\uFE0F  Environment Validation Warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn('');
  }

  if (errors.length > 0) {
    console.error('\n\u274C Environment Validation Failed:');
    console.error('   The following critical issues must be fixed:\n');
    errors.forEach(error => console.error(`   - ${error}`));
    console.error('\n   Please update your .env file and restart the application.\n');
    process.exit(1);
  }

  console.log('\u2705 Environment validation passed');
  return true;
}

/**
 * Checks if a value matches any forbidden default values
 */
function isForbiddenValue(value: string): boolean {
  const lowerValue = value.toLowerCase();
  return FORBIDDEN_VALUES.some(forbidden => lowerValue.includes(forbidden));
}
