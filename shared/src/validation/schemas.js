"use strict";
/**
 * Shared Validation Schemas
 * Zod schemas used across backend and frontend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSchema = exports.createNotificationSubscriptionSchema = exports.paginationSchema = exports.uuidSchema = exports.createScanSchema = exports.createBackupScheduleSchema = exports.createBackupSchema = exports.updateServerSchema = exports.createServerSchema = exports.updateUserSchema = exports.createUserSchema = exports.loginSchema = exports.registerSchema = void 0;
exports.validateRequest = validateRequest;
exports.validateUuidParam = validateUuidParam;
const zod_1 = require("zod");
// ============================================================================
// USER SCHEMAS
// ============================================================================
exports.registerSchema = zod_1.z.object({
    username: zod_1.z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be less than 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    email: zod_1.z.string()
        .email('Invalid email address')
        .max(255, 'Email must be less than 255 characters'),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be less than 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, 'Username is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.createUserSchema = zod_1.z.object({
    username: zod_1.z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be less than 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    email: zod_1.z.string()
        .email('Invalid email address')
        .max(255, 'Email must be less than 255 characters'),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be less than 128 characters'),
    role: zod_1.z.enum(['admin', 'user', 'viewer']).default('viewer'),
});
exports.updateUserSchema = zod_1.z.object({
    is_active: zod_1.z.boolean().optional(),
    role: zod_1.z.enum(['admin', 'user', 'viewer']).optional(),
});
// ============================================================================
// SERVER SCHEMAS
// ============================================================================
const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
exports.createServerSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(1, 'Server name is required')
        .max(255, 'Server name must be less than 255 characters'),
    ip: zod_1.z.string()
        .regex(ipRegex, 'Invalid IP address or hostname'),
    port: zod_1.z.number()
        .int('Port must be an integer')
        .min(1, 'Port must be between 1 and 65535')
        .max(65535, 'Port must be between 1 and 65535')
        .default(22),
    username: zod_1.z.string()
        .min(1, 'Username is required')
        .max(255, 'Username must be less than 255 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    auth_type: zod_1.z.enum(['password', 'key'], {
        errorMap: () => ({ message: 'Auth type must be either "password" or "key"' })
    }),
    credential: zod_1.z.string()
        .min(1, 'Credential is required')
        .max(10000, 'Credential is too long'),
    tags: zod_1.z.string()
        .max(500, 'Tags must be less than 500 characters')
        .optional(),
    description: zod_1.z.string()
        .max(1000, 'Description must be less than 1000 characters')
        .optional(),
});
exports.updateServerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    ip: zod_1.z.string().regex(ipRegex).optional(),
    port: zod_1.z.number().int().min(1).max(65535).optional(),
    username: zod_1.z.string().min(1).max(255).optional(),
    auth_type: zod_1.z.enum(['password', 'key']).optional(),
    credential: zod_1.z.string().min(1).max(10000).optional(),
    tags: zod_1.z.string().max(500).optional(),
    description: zod_1.z.string().max(1000).optional(),
});
// ============================================================================
// BACKUP SCHEMAS
// ============================================================================
exports.createBackupSchema = zod_1.z.object({
    backup_type: zod_1.z.enum(['full', 'incremental', 'differential', 'home', 'config', 'database'])
        .default('full'),
    options: zod_1.z.object({
        compression_level: zod_1.z.number().min(1).max(9).optional(),
        exclude_paths: zod_1.z.array(zod_1.z.string()).optional(),
    }).optional(),
});
exports.createBackupScheduleSchema = zod_1.z.object({
    backup_id: zod_1.z.string().uuid('Invalid backup ID'),
    cron_expression: zod_1.z.string()
        .min(1, 'Cron expression is required')
        .max(100, 'Cron expression is too long'),
    enabled: zod_1.z.boolean().default(true),
});
// ============================================================================
// SCAN SCHEMAS
// ============================================================================
exports.createScanSchema = zod_1.z.object({
    scan_type: zod_1.z.enum(['quick', 'full', 'services', 'filesystems'])
        .default('full'),
});
// ============================================================================
// UUID VALIDATION
// ============================================================================
exports.uuidSchema = zod_1.z.string().uuid('Invalid UUID format');
// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.number().int().min(1).default(1),
    limit: zod_1.z.number().int().min(1).max(100).default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
// ============================================================================
// NOTIFICATION SCHEMAS
// ============================================================================
exports.createNotificationSubscriptionSchema = zod_1.z.object({
    event_type: zod_1.z.string().min(1, 'Event type is required'),
    method: zod_1.z.enum(['email', 'webhook', 'sms']),
    destination: zod_1.z.string().min(1, 'Destination is required'),
    enabled: zod_1.z.boolean().default(true),
});
// ============================================================================
// EXPORT SCHEMAS
// ============================================================================
exports.exportSchema = zod_1.z.object({
    format: zod_1.z.enum(['csv', 'json', 'pdf']).default('csv'),
    includeFilters: zod_1.z.object({}).optional(),
});
// ============================================================================
// VALIDATION UTILITIES (Node.js - Backend only)
// ============================================================================
/**
 * Validation middleware factory (Express.js)
 * Only available in Node.js environment
 */
function validateRequest(schema) {
    return async (req, res, next) => {
        try {
            req.validatedData = await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
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
function validateUuidParam(paramName = 'id') {
    return (req, res, next) => {
        try {
            exports.uuidSchema.parse(req.params[paramName]);
            next();
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: `Invalid ${paramName} parameter`,
            });
        }
    };
}
//# sourceMappingURL=schemas.js.map