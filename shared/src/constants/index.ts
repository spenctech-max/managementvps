/**
 * Shared Constants
 * Application-wide constants
 */

// ============================================================================
// HTTP STATUS CODES
// ============================================================================

export const HTTP_STATUS = {
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
} as const;

// ============================================================================
// USER ROLES
// ============================================================================

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
} as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['read', 'create', 'update', 'delete', 'manage_users'],
  user: ['read', 'create', 'update', 'delete'],
  viewer: ['read'],
};

// ============================================================================
// SCAN TYPES
// ============================================================================

export const SCAN_TYPES = {
  QUICK: 'quick',
  FULL: 'full',
  SERVICES: 'services',
  FILESYSTEMS: 'filesystems',
} as const;

// ============================================================================
// AUTH TYPES
// ============================================================================

export const AUTH_TYPES = {
  PASSWORD: 'password',
  KEY: 'key',
} as const;

// ============================================================================
// BACKUP TYPES
// ============================================================================

export const BACKUP_TYPES = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
  DIFFERENTIAL: 'differential',
  HOME: 'home',
  CONFIG: 'config',
  DATABASE: 'database',
} as const;

export const BACKUP_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

// ============================================================================
// JOB STATUSES
// ============================================================================

export const JOB_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  PAUSED: 'paused',
} as const;

export const SCAN_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const BACKUP_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  VERIFIED: 'verified',
} as const;

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export const NOTIFICATION_TYPES = {
  BACKUP_COMPLETED: 'backup_completed',
  BACKUP_FAILED: 'backup_failed',
  SERVER_DOWN: 'server_down',
  HEALTH_ALERT: 'health_alert',
} as const;

export const NOTIFICATION_METHODS = {
  EMAIL: 'email',
  WEBHOOK: 'webhook',
  SMS: 'sms',
} as const;

// ============================================================================
// HEALTH STATUS
// ============================================================================

export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  DEGRADED: 'degraded',
} as const;

// ============================================================================
// EXPORT FORMATS
// ============================================================================

export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  PDF: 'pdf',
} as const;

// ============================================================================
// TIME LIMITS (in milliseconds)
// ============================================================================

export const TIME_LIMITS = {
  SSH_TIMEOUT: 30000,           // 30 seconds
  SCAN_TIMEOUT: 300000,         // 5 minutes
  BACKUP_TIMEOUT: 3600000,      // 1 hour
  REQUEST_TIMEOUT: 60000,       // 1 minute
  SESSION_EXPIRY: 3600000,      // 1 hour
  CACHE_TTL: 300,               // 5 minutes
} as const;

// ============================================================================
// PAGINATION
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

// ============================================================================
// VALIDATION LIMITS
// ============================================================================

export const VALIDATION_LIMITS = {
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MAX_EMAIL_LENGTH: 255,
  MAX_SERVER_NAME_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_TAGS_LENGTH: 500,
  MAX_FILE_SIZE: 52428800,  // 50MB
} as const;

// ============================================================================
// QUEUE NAMES
// ============================================================================

export const QUEUE_NAMES = {
  BACKUP: 'backup',
  SCAN: 'scan',
  RESTORE: 'restore',
  UPDATE: 'update',
} as const;

// ============================================================================
// CRON SCHEDULES
// ============================================================================

export const DEFAULT_CRON_SCHEDULES = {
  DAILY_MIDNIGHT: '0 0 * * *',
  DAILY_NOON: '0 12 * * *',
  WEEKLY: '0 0 * * 0',
  MONTHLY: '0 0 1 * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
} as const;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

// ============================================================================
// LOG LEVELS
// ============================================================================

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly',
} as const;
