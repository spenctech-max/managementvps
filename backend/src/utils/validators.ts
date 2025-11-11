/**
 * Zod Input Validation Schemas
 * Centralized validation for all API endpoints
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors';

/**
 * Authentication Schemas
 */
export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number'),
});

/**
 * Server Schemas
 */
const baseServerSchema = z.object({
  name: z.string()
    .min(1, 'Server name is required')
    .max(255, 'Server name must be at most 255 characters'),
  hostname: z.string()
    .min(1, 'Hostname is required')
    .max(255, 'Hostname must be at most 255 characters')
    .regex(/^[a-zA-Z0-9.-]+$/, 'Invalid hostname format'),
  port: z.number()
    .int('Port must be an integer')
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must be at most 65535')
    .default(22),
  username: z.string()
    .min(1, 'Username is required')
    .max(255, 'Username must be at most 255 characters'),
  authMethod: z.enum(['password', 'key']).default('password'),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional(),
  tags: z.array(z.string().max(50)).optional(),
});

export const createServerSchema = baseServerSchema.refine(
  (data) => {
    if (data.authMethod === 'password') {
      return !!data.password;
    } else if (data.authMethod === 'key') {
      return !!data.privateKey;
    }
    return true;
  },
  {
    message: 'Password is required for password auth, private key is required for key auth',
    path: ['authMethod'],
  }
);

export const updateServerSchema = baseServerSchema.partial();

/**
 * Scan Schemas
 */
export const createScanSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  scanType: z.enum(['quick', 'full', 'custom']).default('quick'),
  ports: z.string()
    .regex(/^[\d,-]+$/, 'Invalid port format. Use comma-separated ports or ranges (e.g., 80,443,8000-9000)')
    .optional(),
});

/**
 * Backup Schemas
 */
export const createBackupSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  sourcePath: z.string()
    .min(1, 'Source path is required')
    .max(1000, 'Source path must be at most 1000 characters'),
  destinationPath: z.string()
    .min(1, 'Destination path is required')
    .max(1000, 'Destination path must be at most 1000 characters'),
  compression: z.enum(['none', 'gzip', 'bzip2']).default('gzip'),
  encryption: z.boolean().default(false),
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional(),
});

/**
 * Backup Schedule Schemas
 */
export const createBackupScheduleSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  scheduleType: z.enum(['daily', 'weekly', 'monthly']),
  hour: z.number().int().min(0).max(23),
  dayOfWeek: z.number().int().min(0).max(6).optional(), // 0 = Sunday
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  sourcePath: z.string().min(1).max(1000),
  destinationPath: z.string().min(1).max(1000),
  compression: z.enum(['none', 'gzip', 'bzip2']).default('gzip'),
  encryption: z.boolean().default(false),
  enabled: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.scheduleType === 'weekly') {
      return data.dayOfWeek !== undefined;
    }
    if (data.scheduleType === 'monthly') {
      return data.dayOfMonth !== undefined;
    }
    return true;
  },
  {
    message: 'Day of week is required for weekly schedules, day of month for monthly',
    path: ['scheduleType'],
  }
);

/**
 * Query Parameter Schemas
 */
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const serverFilterSchema = paginationSchema.extend({
  status: z.enum(['online', 'offline', 'unknown']).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});

/**
 * UUID Parameter Schema
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

/**
 * Validation Middleware Factory
 * Creates middleware that validates request body, query, or params against a schema
 */
export function validate(schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);
      req[source] = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        next(new ValidationError('Validation failed', { errors }));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Optional validation - doesn't throw error if field is missing
 */
export function validateOptional(schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      if (data && Object.keys(data).length > 0) {
        const validated = schema.parse(data);
        req[source] = validated;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        next(new ValidationError('Validation failed', { errors }));
      } else {
        next(error);
      }
    }
  };
}
