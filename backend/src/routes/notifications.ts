/**
 * Notification Routes
 * API endpoints for managing notification settings, history, and sending test notifications
 */

import { Router, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { logger } from '../config/logger';
import { pool } from '../config/database';
import { NotificationChannel, NotificationType, NotificationSeverity } from '../config/notifications';

const router = Router();

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get(
  '/settings',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT channel_type, is_enabled, config FROM notification_settings ORDER BY channel_type'
      );

      // Sanitize sensitive data (passwords, tokens, etc.)
      const sanitizedSettings = result.rows.map((setting) => ({
        channel_type: setting.channel_type,
        is_enabled: setting.is_enabled,
        config: sanitizeConfig(setting.channel_type, setting.config),
      }));

      res.json({
        success: true,
        data: sanitizedSettings,
      });
    } catch (error) {
      logger.error('Error fetching notification settings', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification settings',
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/settings:
 *   post:
 *     summary: Update notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel_type:
 *                 type: string
 *                 enum: [email, slack, in_app]
 *               is_enabled:
 *                 type: boolean
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post(
  '/settings',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { channel_type, is_enabled, config } = req.body;

      // Validate input
      if (!channel_type || !['email', 'slack', 'in_app'].includes(channel_type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid channel_type. Must be email, slack, or in_app',
        });
      }

      if (typeof is_enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'is_enabled must be a boolean',
        });
      }

      if (!config || typeof config !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'config must be an object',
        });
      }

      // Validate channel-specific config
      const validationError = validateChannelConfig(channel_type, config);
      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }

      // Update settings
      await notificationService.updateSettings(
        channel_type as NotificationChannel,
        is_enabled,
        config
      );

      res.json({
        success: true,
        message: 'Notification settings updated successfully',
      });
    } catch (error) {
      logger.error('Error updating notification settings', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings',
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: Send test notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [email, slack, in_app]
 *     responses:
 *       200:
 *         description: Test notification sent
 *       400:
 *         description: Invalid channel
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post(
  '/test',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { channel } = req.body;

      if (!channel || !['email', 'slack', 'in_app'].includes(channel)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid channel. Must be email, slack, or in_app',
        });
      }

      await notificationService.sendTest(channel as NotificationChannel);

      res.json({
        success: true,
        message: `Test notification sent via ${channel}`,
      });
    } catch (error) {
      logger.error('Error sending test notification', { error });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send test notification',
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/history:
 *   get:
 *     summary: Get notification history
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification history retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get(
  '/history',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const filters: any = {};
      if (req.query.type) filters.type = req.query.type as NotificationType;
      if (req.query.severity) filters.severity = req.query.severity as NotificationSeverity;
      if (req.query.channel) filters.channel = req.query.channel as NotificationChannel;
      if (req.query.status) filters.status = req.query.status as string;

      const history = await notificationService.getHistory(limit, offset, filters);

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) FROM notification_history WHERE 1=1';
      const countParams: any[] = [];
      let paramIndex = 1;

      if (filters.type) {
        countQuery += ` AND notification_type = $${paramIndex++}`;
        countParams.push(filters.type);
      }
      if (filters.severity) {
        countQuery += ` AND severity = $${paramIndex++}`;
        countParams.push(filters.severity);
      }
      if (filters.channel) {
        countQuery += ` AND channel_type = $${paramIndex++}`;
        countParams.push(filters.channel);
      }
      if (filters.status) {
        countQuery += ` AND status = $${paramIndex++}`;
        countParams.push(filters.status);
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: {
          history,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching notification history', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification history',
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/in-app:
 *   get:
 *     summary: Get in-app notifications for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unread_only
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: In-app notifications retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/in-app', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const unreadOnly = req.query.unread_only === 'true';
    const limit = parseInt(req.query.limit as string) || 50;

    let query = `
      SELECT id, notification_type, severity, title, message, action_url,
             metadata, is_read, read_at, created_at
      FROM in_app_notifications
      WHERE user_id = $1
    `;

    if (unreadOnly) {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2';

    const result = await pool.query(query, [userId, limit]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching in-app notifications', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
});

/**
 * @swagger
 * /api/notifications/in-app/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found
 */
router.patch('/in-app/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await pool.query(
      `UPDATE in_app_notifications
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Error marking notification as read', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
    });
  }
});

/**
 * @swagger
 * /api/notifications/in-app/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Unauthorized
 */
router.patch('/in-app/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    await pool.query(
      `UPDATE in_app_notifications
       SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    logger.error('Error marking all notifications as read', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications',
    });
  }
});

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/stats', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get stats from last 30 days
    const statsResult = await pool.query(`
      SELECT
        notification_type,
        severity,
        channel_type,
        status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '7 days') as last_7d
      FROM notification_history
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY notification_type, severity, channel_type, status
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: statsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching notification stats', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
    });
  }
});

/**
 * Helper function to sanitize config before sending to client
 */
function sanitizeConfig(channelType: string, config: any): any {
  const sanitized = { ...config };

  if (channelType === 'email') {
    if (sanitized.smtp_pass) {
      sanitized.smtp_pass = '********';
    }
  }

  if (channelType === 'slack') {
    if (sanitized.webhook_url) {
      // Show only last 10 characters of webhook URL
      const url = sanitized.webhook_url;
      sanitized.webhook_url = `***${url.slice(-10)}`;
    }
  }

  return sanitized;
}

/**
 * Validate channel-specific configuration
 */
function validateChannelConfig(channelType: string, config: any): string | null {
  if (channelType === 'email') {
    if (config.smtp_host && !config.smtp_user) {
      return 'SMTP user is required when SMTP host is configured';
    }
    if (config.smtp_user && !config.smtp_host) {
      return 'SMTP host is required when SMTP user is configured';
    }
    if (config.recipients && !Array.isArray(config.recipients)) {
      return 'Recipients must be an array of email addresses';
    }
    if (config.recipients) {
      for (const email of config.recipients) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return `Invalid email address: ${email}`;
        }
      }
    }
  }

  if (channelType === 'slack') {
    if (config.webhook_url && !config.webhook_url.startsWith('https://hooks.slack.com/')) {
      return 'Invalid Slack webhook URL';
    }
  }

  return null;
}

export default router;
