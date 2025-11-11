/**
 * Shared Constants
 * Application-wide constants
 */
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly ACCEPTED: 202;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly SERVICE_UNAVAILABLE: 503;
};
export declare const USER_ROLES: {
    readonly ADMIN: "admin";
    readonly USER: "user";
    readonly VIEWER: "viewer";
};
export declare const ROLE_PERMISSIONS: Record<string, string[]>;
export declare const SCAN_TYPES: {
    readonly QUICK: "quick";
    readonly FULL: "full";
    readonly SERVICES: "services";
    readonly FILESYSTEMS: "filesystems";
};
export declare const AUTH_TYPES: {
    readonly PASSWORD: "password";
    readonly KEY: "key";
};
export declare const BACKUP_TYPES: {
    readonly FULL: "full";
    readonly INCREMENTAL: "incremental";
    readonly DIFFERENTIAL: "differential";
    readonly HOME: "home";
    readonly CONFIG: "config";
    readonly DATABASE: "database";
};
export declare const BACKUP_PRIORITIES: {
    readonly CRITICAL: "critical";
    readonly HIGH: "high";
    readonly MEDIUM: "medium";
    readonly LOW: "low";
};
export declare const JOB_STATUS: {
    readonly PENDING: "pending";
    readonly ACTIVE: "active";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly DELAYED: "delayed";
    readonly PAUSED: "paused";
};
export declare const SCAN_STATUS: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
};
export declare const BACKUP_STATUS: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly VERIFIED: "verified";
};
export declare const NOTIFICATION_TYPES: {
    readonly BACKUP_COMPLETED: "backup_completed";
    readonly BACKUP_FAILED: "backup_failed";
    readonly SERVER_DOWN: "server_down";
    readonly HEALTH_ALERT: "health_alert";
};
export declare const NOTIFICATION_METHODS: {
    readonly EMAIL: "email";
    readonly WEBHOOK: "webhook";
    readonly SMS: "sms";
};
export declare const HEALTH_STATUS: {
    readonly HEALTHY: "healthy";
    readonly UNHEALTHY: "unhealthy";
    readonly DEGRADED: "degraded";
};
export declare const EXPORT_FORMATS: {
    readonly CSV: "csv";
    readonly JSON: "json";
    readonly PDF: "pdf";
};
export declare const TIME_LIMITS: {
    readonly SSH_TIMEOUT: 30000;
    readonly SCAN_TIMEOUT: 300000;
    readonly BACKUP_TIMEOUT: 3600000;
    readonly REQUEST_TIMEOUT: 60000;
    readonly SESSION_EXPIRY: 3600000;
    readonly CACHE_TTL: 300;
};
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_LIMIT: 20;
    readonly MAX_LIMIT: 100;
    readonly MIN_LIMIT: 1;
};
export declare const VALIDATION_LIMITS: {
    readonly MIN_USERNAME_LENGTH: 3;
    readonly MAX_USERNAME_LENGTH: 50;
    readonly MIN_PASSWORD_LENGTH: 8;
    readonly MAX_PASSWORD_LENGTH: 128;
    readonly MAX_EMAIL_LENGTH: 255;
    readonly MAX_SERVER_NAME_LENGTH: 255;
    readonly MAX_DESCRIPTION_LENGTH: 1000;
    readonly MAX_TAGS_LENGTH: 500;
    readonly MAX_FILE_SIZE: 52428800;
};
export declare const QUEUE_NAMES: {
    readonly BACKUP: "backup";
    readonly SCAN: "scan";
    readonly RESTORE: "restore";
    readonly UPDATE: "update";
};
export declare const DEFAULT_CRON_SCHEDULES: {
    readonly DAILY_MIDNIGHT: "0 0 * * *";
    readonly DAILY_NOON: "0 12 * * *";
    readonly WEEKLY: "0 0 * * 0";
    readonly MONTHLY: "0 0 1 * *";
    readonly EVERY_HOUR: "0 * * * *";
    readonly EVERY_5_MINUTES: "*/5 * * * *";
};
export declare const ERROR_CODES: {
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR";
    readonly AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR";
};
export declare const LOG_LEVELS: {
    readonly ERROR: "error";
    readonly WARN: "warn";
    readonly INFO: "info";
    readonly HTTP: "http";
    readonly VERBOSE: "verbose";
    readonly DEBUG: "debug";
    readonly SILLY: "silly";
};
//# sourceMappingURL=index.d.ts.map