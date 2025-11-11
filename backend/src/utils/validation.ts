import { z } from 'zod';

/**
 * Validation schemas using Zod
 */

// User schemas
export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters'),
  role: z.enum(['admin', 'user', 'viewer']).default('viewer'),
});

export const updateUserSchema = z.object({
  is_active: z.boolean().optional(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
});

// Server schemas
export const createServerSchema = z.object({
  name: z.string()
    .min(1, 'Server name is required')
    .max(255, 'Server name must be less than 255 characters'),
  ip: z.string()
    .regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
      'Invalid IP address or hostname'),
  port: z.number()
    .int('Port must be an integer')
    .min(1, 'Port must be between 1 and 65535')
    .max(65535, 'Port must be between 1 and 65535')
    .default(22),
  username: z.string()
    .min(1, 'Username is required')
    .max(255, 'Username must be less than 255 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  auth_type: z.enum(['password', 'key'], {
    errorMap: () => ({ message: 'Auth type must be either "password" or "key"' })
  }),
  credential: z.string()
    .min(1, 'Credential is required')
    .max(10000, 'Credential is too long'),
  tags: z.string()
    .max(500, 'Tags must be less than 500 characters')
    .optional(),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ip: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().min(1).max(255).optional(),
  auth_type: z.enum(['password', 'key']).optional(),
  credential: z.string().min(1).max(10000).optional(),
  tags: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
});

// Backup schemas
export const createBackupSchema = z.object({
  backup_type: z.enum(['full', 'incremental', 'differential', 'home', 'config', 'database'])
    .default('full'),
  options: z.object({
    compression_level: z.number().min(1).max(9).optional(),
    exclude_paths: z.array(z.string()).optional(),
  }).optional(),
});

export const createManualBackupSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  backupType: z.enum(['full', 'incremental', 'differential'], {
    errorMap: () => ({ message: 'Backup type must be full, incremental, or differential' })
  }).default('full'),
  paths: z.array(z.string().min(1, 'Path cannot be empty')).min(1, 'At least one path is required'),
  options: z.object({
    compression: z.boolean().optional().default(true),
    encryption: z.boolean().optional().default(false),
    retentionDays: z.number().int().min(1).max(365).optional().default(30),
  }).optional().default({}),
});

// Scan schemas
export const createScanSchema = z.object({
  scan_type: z.enum(['quick', 'full', 'services', 'filesystems'])
    .default('full'),
});

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Validation middleware factory
 */
export function validateRequest(schema: z.ZodSchema) {
  return async (req: any, res: any, next: any) => {
    try {
      req.validatedData = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Validate UUID parameter middleware
 */
export function validateUuidParam(paramName: string = 'id') {
  return (req: any, res: any, next: any) => {
    try {
      uuidSchema.parse(req.params[paramName]);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} parameter`,
      });
    }
  };
}
