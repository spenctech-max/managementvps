/**
 * Audit Logging Service
 * Provides comprehensive audit trail for security-critical operations
 */

import { pool } from '../config/database';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth';

/**
 * Audit action types
 */
export enum AuditAction {
  // Authentication
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  SESSION_INVALIDATE = 'SESSION_INVALIDATE',

  // User Management
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',

  // Server Management
  SERVER_CREATE = 'SERVER_CREATE',
  SERVER_UPDATE = 'SERVER_UPDATE',
  SERVER_DELETE = 'SERVER_DELETE',
  SERVER_CREDENTIALS_VIEW = 'SERVER_CREDENTIALS_VIEW',
  SERVER_CREDENTIALS_UPDATE = 'SERVER_CREDENTIALS_UPDATE',

  // SSH Operations
  SSH_KEY_GENERATE = 'SSH_KEY_GENERATE',
  SSH_KEY_ROTATE = 'SSH_KEY_ROTATE',
  SSH_CONNECTION_OPEN = 'SSH_CONNECTION_OPEN',
  SSH_CONNECTION_CLOSE = 'SSH_CONNECTION_CLOSE',

  // Backup Operations
  BACKUP_CREATE = 'BACKUP_CREATE',
  BACKUP_EXECUTE = 'BACKUP_EXECUTE',
  BACKUP_DELETE = 'BACKUP_DELETE',
  BACKUP_VERIFY = 'BACKUP_VERIFY',
  BACKUP_SCHEDULE_CREATE = 'BACKUP_SCHEDULE_CREATE',
  BACKUP_SCHEDULE_UPDATE = 'BACKUP_SCHEDULE_UPDATE',
  BACKUP_SCHEDULE_DELETE = 'BACKUP_SCHEDULE_DELETE',

  // Restore Operations
  BACKUP_RESTORE_START = 'BACKUP_RESTORE_START',
  BACKUP_RESTORE_COMPLETE = 'BACKUP_RESTORE_COMPLETE',
  BACKUP_RESTORE_ROLLBACK = 'BACKUP_RESTORE_ROLLBACK',

  // Scan Operations
  SCAN_START = 'SCAN_START',
  SCAN_COMPLETE = 'SCAN_COMPLETE',

  // Security Events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  ENCRYPTION_KEY_ACCESS = 'ENCRYPTION_KEY_ACCESS',
}

/**
 * Resource types
 */
export enum ResourceType {
  USER = 'user',
  SERVER = 'server',
  BACKUP = 'backup',
  SCAN = 'scan',
  CREDENTIALS = 'credentials',
  SSH_KEY = 'ssh_key',
  SESSION = 'session',
  BACKUP_SCHEDULE = 'backup_schedule',
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failure' | 'partial';
  errorMessage?: string;
}

/**
 * Audit Logger Service
 */
export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Sanitize details to ensure no sensitive data is logged
      const sanitizedDetails = this.sanitizeDetails(entry.details);

      await pool.query(
        `INSERT INTO audit_logs
        (user_id, action, resource_type, resource_id, details, ip_address, user_agent, status, error_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.userId || null,
          entry.action,
          entry.resourceType,
          entry.resourceId || null,
          sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.status || 'success',
          entry.errorMessage || null,
        ]
      );

      // Also log to application logger for real-time monitoring
      logger.info('Audit event', {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        userId: entry.userId,
        status: entry.status || 'success',
      });
    } catch (error) {
      // Critical: Audit logging failure should be logged but not throw
      logger.error('Failed to write audit log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        entry,
      });
    }
  }

  /**
   * Log audit event from Express request
   */
  static async logFromRequest(
    req: AuthRequest,
    action: AuditAction,
    resourceType: ResourceType,
    resourceId?: string,
    details?: Record<string, any>,
    status?: 'success' | 'failure' | 'partial',
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      userId: req.user?.id,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status,
      errorMessage,
    });
  }

  /**
   * Query audit logs with filters
   */
  static async query(filters: {
    userId?: string;
    action?: AuditAction;
    resourceType?: ResourceType;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(filters.action);
    }

    if (filters.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      values.push(filters.resourceType);
    }

    if (filters.resourceId) {
      conditions.push(`resource_id = $${paramIndex++}`);
      values.push(filters.resourceId);
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const logsResult = await pool.query(
      `SELECT
        al.*,
        u.username,
        u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      logs: logsResult.rows,
      total,
    };
  }

  /**
   * Sanitize details to remove sensitive information
   */
  private static sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) return undefined;

    const sanitized = { ...details };
    const sensitiveKeys = [
      'password',
      'privateKey',
      'private_key',
      'secret',
      'token',
      'encryptionKey',
      'encryption_key',
      'apiKey',
      'api_key',
    ];

    // Remove or mask sensitive keys
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get audit statistics
   */
  static async getStatistics(userId?: string): Promise<any> {
    const userFilter = userId ? 'WHERE user_id = $1' : '';
    const params = userId ? [userId] : [];

    const result = await pool.query(
      `SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed_events,
        COUNT(CASE WHEN action LIKE '%CREDENTIALS%' THEN 1 END) as credential_events,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as events_last_24h,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as events_last_7d
      FROM audit_logs
      ${userFilter}`,
      params
    );

    return result.rows[0];
  }
}

export default AuditLogger;
