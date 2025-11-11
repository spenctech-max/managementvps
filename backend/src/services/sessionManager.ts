/**
 * Session Management Service
 * Handles session invalidation and management across Redis
 */

import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import AuditLogger, { AuditAction, ResourceType } from './auditLogger';

/**
 * Session Manager Service
 */
export class SessionManager {
  /**
   * Invalidate all sessions for a user except the current one
   */
  static async invalidateUserSessions(
    userId: string,
    currentSessionId?: string
  ): Promise<number> {
    try {
      // Find all session keys for this user
      const pattern = `sess:*`;
      const keys = await redisClient.keys(pattern);

      let invalidatedCount = 0;

      for (const key of keys) {
        try {
          const sessionData = await redisClient.get(key);
          if (!sessionData) continue;

          const session = JSON.parse(sessionData);

          // Check if this session belongs to the user
          if (session.passport?.user?.id === userId || session.userId === userId) {
            // Skip current session if provided
            if (currentSessionId && key.includes(currentSessionId)) {
              continue;
            }

            // Delete the session
            await redisClient.del(key);
            invalidatedCount++;
          }
        } catch (error) {
          // Skip malformed sessions
          logger.warn('Failed to parse session', {
            key,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info('User sessions invalidated', {
        userId,
        count: invalidatedCount,
        keptCurrent: !!currentSessionId,
      });

      return invalidatedCount;
    } catch (error) {
      logger.error('Failed to invalidate user sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Invalidate a specific session
   */
  static async invalidateSession(sessionId: string): Promise<boolean> {
    try {
      const key = `sess:${sessionId}`;
      const result = await redisClient.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Failed to invalidate session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<any[]> {
    try {
      const pattern = `sess:*`;
      const keys = await redisClient.keys(pattern);

      const userSessions: any[] = [];

      for (const key of keys) {
        try {
          const sessionData = await redisClient.get(key);
          if (!sessionData) continue;

          const session = JSON.parse(sessionData);

          if (session.passport?.user?.id === userId || session.userId === userId) {
            const ttl = await redisClient.ttl(key);

            userSessions.push({
              sessionId: key.replace('sess:', ''),
              createdAt: session.cookie?.originalMaxAge
                ? new Date(Date.now() - session.cookie.originalMaxAge)
                : null,
              expiresAt: ttl > 0 ? new Date(Date.now() + ttl * 1000) : null,
              lastActivity: session.lastActivity || null,
            });
          }
        } catch (error) {
          // Skip malformed sessions
          continue;
        }
      }

      return userSessions;
    } catch (error) {
      logger.error('Failed to get user sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Invalidate all sessions for a user and log audit event
   */
  static async invalidateUserSessionsWithAudit(
    userId: string,
    currentSessionId: string | undefined,
    reason: string
  ): Promise<number> {
    const count = await this.invalidateUserSessions(userId, currentSessionId);

    await AuditLogger.log({
      userId,
      action: AuditAction.SESSION_INVALIDATE,
      resourceType: ResourceType.SESSION,
      details: {
        reason,
        sessionsInvalidated: count,
        keptCurrent: !!currentSessionId,
      },
      status: 'success',
    });

    return count;
  }

  /**
   * Cleanup expired sessions (optional - Redis handles this automatically)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    // This is optional as Redis automatically removes expired keys
    // But can be used for manual cleanup or monitoring
    let cleaned = 0;

    try {
      const pattern = `sess:*`;
      const keys = await redisClient.keys(pattern);

      for (const key of keys) {
        const ttl = await redisClient.ttl(key);
        if (ttl === -2) {
          // Key doesn't exist anymore
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired sessions`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Session cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}

export default SessionManager;
