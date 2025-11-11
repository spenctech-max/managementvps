"use strict";
/**
 * Shared Constants
 * Application-wide constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_LEVELS = exports.ERROR_CODES = exports.DEFAULT_CRON_SCHEDULES = exports.QUEUE_NAMES = exports.VALIDATION_LIMITS = exports.PAGINATION = exports.TIME_LIMITS = exports.EXPORT_FORMATS = exports.HEALTH_STATUS = exports.NOTIFICATION_METHODS = exports.NOTIFICATION_TYPES = exports.BACKUP_STATUS = exports.SCAN_STATUS = exports.JOB_STATUS = exports.BACKUP_PRIORITIES = exports.BACKUP_TYPES = exports.AUTH_TYPES = exports.SCAN_TYPES = exports.ROLE_PERMISSIONS = exports.USER_ROLES = exports.HTTP_STATUS = void 0;
// ============================================================================
// HTTP STATUS CODES
// ============================================================================
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
// ============================================================================
// USER ROLES
// ============================================================================
exports.USER_ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    VIEWER: 'viewer',
};
exports.ROLE_PERMISSIONS = {
    admin: ['read', 'create', 'update', 'delete', 'manage_users'],
    user: ['read', 'create', 'update', 'delete'],
    viewer: ['read'],
};
// ============================================================================
// SCAN TYPES
// ============================================================================
exports.SCAN_TYPES = {
    QUICK: 'quick',
    FULL: 'full',
    SERVICES: 'services',
    FILESYSTEMS: 'filesystems',
};
// ============================================================================
// AUTH TYPES
// ============================================================================
exports.AUTH_TYPES = {
    PASSWORD: 'password',
    KEY: 'key',
};
// ============================================================================
// BACKUP TYPES
// ============================================================================
exports.BACKUP_TYPES = {
    FULL: 'full',
    INCREMENTAL: 'incremental',
    DIFFERENTIAL: 'differential',
    HOME: 'home',
    CONFIG: 'config',
    DATABASE: 'database',
};
exports.BACKUP_PRIORITIES = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
};
// ============================================================================
// JOB STATUSES
// ============================================================================
exports.JOB_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    FAILED: 'failed',
    DELAYED: 'delayed',
    PAUSED: 'paused',
};
exports.SCAN_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
};
exports.BACKUP_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    VERIFIED: 'verified',
};
// ============================================================================
// NOTIFICATION TYPES
// ============================================================================
exports.NOTIFICATION_TYPES = {
    BACKUP_COMPLETED: 'backup_completed',
    BACKUP_FAILED: 'backup_failed',
    SERVER_DOWN: 'server_down',
    HEALTH_ALERT: 'health_alert',
};
exports.NOTIFICATION_METHODS = {
    EMAIL: 'email',
    WEBHOOK: 'webhook',
    SMS: 'sms',
};
// ============================================================================
// HEALTH STATUS
// ============================================================================
exports.HEALTH_STATUS = {
    HEALTHY: 'healthy',
    UNHEALTHY: 'unhealthy',
    DEGRADED: 'degraded',
};
// ============================================================================
// EXPORT FORMATS
// ============================================================================
exports.EXPORT_FORMATS = {
    CSV: 'csv',
    JSON: 'json',
    PDF: 'pdf',
};
// ============================================================================
// TIME LIMITS (in milliseconds)
// ============================================================================
exports.TIME_LIMITS = {
    SSH_TIMEOUT: 30000, // 30 seconds
    SCAN_TIMEOUT: 300000, // 5 minutes
    BACKUP_TIMEOUT: 3600000, // 1 hour
    REQUEST_TIMEOUT: 60000, // 1 minute
    SESSION_EXPIRY: 3600000, // 1 hour
    CACHE_TTL: 300, // 5 minutes
};
// ============================================================================
// PAGINATION
// ============================================================================
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1,
};
// ============================================================================
// VALIDATION LIMITS
// ============================================================================
exports.VALIDATION_LIMITS = {
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 50,
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
    MAX_EMAIL_LENGTH: 255,
    MAX_SERVER_NAME_LENGTH: 255,
    MAX_DESCRIPTION_LENGTH: 1000,
    MAX_TAGS_LENGTH: 500,
    MAX_FILE_SIZE: 52428800, // 50MB
};
// ============================================================================
// QUEUE NAMES
// ============================================================================
exports.QUEUE_NAMES = {
    BACKUP: 'backup',
    SCAN: 'scan',
    RESTORE: 'restore',
    UPDATE: 'update',
};
// ============================================================================
// CRON SCHEDULES
// ============================================================================
exports.DEFAULT_CRON_SCHEDULES = {
    DAILY_MIDNIGHT: '0 0 * * *',
    DAILY_NOON: '0 12 * * *',
    WEEKLY: '0 0 * * 0',
    MONTHLY: '0 0 1 * *',
    EVERY_HOUR: '0 * * * *',
    EVERY_5_MINUTES: '*/5 * * * *',
};
// ============================================================================
// ERROR CODES
// ============================================================================
exports.ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
};
// ============================================================================
// LOG LEVELS
// ============================================================================
exports.LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    HTTP: 'http',
    VERBOSE: 'verbose',
    DEBUG: 'debug',
    SILLY: 'silly',
};
//# sourceMappingURL=index.js.map