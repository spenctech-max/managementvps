/**
 * Shared Validation Schemas
 * Zod schemas used across backend and frontend
 */

import { z } from 'zod';

// ============================================================================
// USER SCHEMAS
// ============================================================================

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

export type RegisterData = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginData = z.infer<typeof loginSchema>;

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

export type CreateUserData = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  is_active: z.boolean().optional(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
});

export type UpdateUserData = z.infer<typeof updateUserSchema>;

// ============================================================================
// SERVER SCHEMAS
// ============================================================================

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export const createServerSchema = z.object({
  name: z.string()
    .min(1, 'Server name is required')
    .max(255, 'Server name must be less than 255 characters'),
  ip: z.string()
    .regex(ipRegex, 'Invalid IP address or hostname'),
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

export type CreateServerData = z.infer<typeof createServerSchema>;

export const updateServerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ip: z.string().regex(ipRegex).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().min(1).max(255).optional(),
  auth_type: z.enum(['password', 'key']).optional(),
  credential: z.string().min(1).max(10000).optional(),
  tags: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
});

export type UpdateServerData = z.infer<typeof updateServerSchema>;

// ============================================================================
// BACKUP SCHEMAS
// ============================================================================

export const createBackupSchema = z.object({
  backup_type: z.enum(['full', 'incremental', 'differential', 'home', 'config', 'database'])
    .default('full'),
  options: z.object({
    compression_level: z.number().min(1).max(9).optional(),
    exclude_paths: z.array(z.string()).optional(),
  }).optional(),
});

export type CreateBackupData = z.infer<typeof createBackupSchema>;

export const createBackupScheduleSchema = z.object({
  backup_id: z.string().uuid('Invalid backup ID'),
  cron_expression: z.string()
    .min(1, 'Cron expression is required')
    .max(100, 'Cron expression is too long'),
  enabled: z.boolean().default(true),
});

export type CreateBackupScheduleData = z.infer<typeof createBackupScheduleSchema>;

// ============================================================================
// SCAN SCHEMAS
// ============================================================================

export const createScanSchema = z.object({
  scan_type: z.enum(['quick', 'full', 'services', 'filesystems'])
    .default('full'),
});

export type CreateScanData = z.infer<typeof createScanSchema>;

// ============================================================================
// UUID VALIDATION
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

// ============================================================================
// NOTIFICATION SCHEMAS
// ============================================================================

export const createNotificationSubscriptionSchema = z.object({
  event_type: z.string().min(1, 'Event type is required'),
  method: z.enum(['email', 'webhook', 'sms']),
  destination: z.string().min(1, 'Destination is required'),
  enabled: z.boolean().default(true),
});

export type CreateNotificationSubscriptionData = z.infer<typeof createNotificationSubscriptionSchema>;

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

export const exportSchema = z.object({
  format: z.enum(['csv', 'json', 'pdf']).default('csv'),
  includeFilters: z.object({}).optional(),
});

export type ExportQuery = z.infer<typeof exportSchema>;

// ============================================================================
// VALIDATION UTILITIES (Node.js - Backend only)
// ============================================================================

/**
 * Validation middleware factory (Express.js)
 * Only available in Node.js environment
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
