/**
 * Notification Service
 * Core service for sending notifications via Email, Slack, and In-App channels
 */

import nodemailer, { Transporter } from 'nodemailer';
import { IncomingWebhook } from '@slack/webhook';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import {
  NotificationType,
  NotificationSeverity,
  NotificationChannel,
  NotificationMetadata,
  notificationTemplates,
  notificationSeverityMap,
  rateLimitConfig,
  notificationConfig,
  criticalAlertChannels,
} from '../config/notifications';

/**
 * Notification settings from database
 */
interface NotificationSettings {
  id: string;
  channel_type: NotificationChannel;
  is_enabled: boolean;
  config: Record<string, any>;
}

/**
 * Notification payload
 */
export interface NotificationPayload {
  type: NotificationType;
  metadata: NotificationMetadata;
  channels?: NotificationChannel[]; // Override default channels
  skipRateLimit?: boolean; // Force send, ignoring rate limits
}

/**
 * Notification Service Class
 */
export class NotificationService {
  private emailTransporter: Transporter | null = null;
  private slackWebhook: IncomingWebhook | null = null;
  private settingsCache: Map<NotificationChannel, NotificationSettings> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor() {
    this.initializeChannels();
  }

  /**
   * Initialize notification channels
   */
  private async initializeChannels(): Promise<void> {
    try {
      await this.loadSettings();
      await this.setupEmailTransporter();
      await this.setupSlackWebhook();
    } catch (error) {
      logger.error('Failed to initialize notification channels', { error });
    }
  }

  /**
   * Load notification settings from database
   */
  private async loadSettings(): Promise<void> {
    try {
      const result = await pool.query<NotificationSettings>(
        'SELECT id, channel_type, is_enabled, config FROM notification_settings'
      );

      this.settingsCache.clear();
      result.rows.forEach((setting) => {
        this.settingsCache.set(setting.channel_type, setting);
      });

      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      logger.debug('Notification settings loaded', {
        channels: result.rows.map((r) => r.channel_type),
      });
    } catch (error) {
      logger.error('Failed to load notification settings', { error });
      throw error;
    }
  }

  /**
   * Get settings for a specific channel
   */
  private async getSettings(channel: NotificationChannel): Promise<NotificationSettings | null> {
    // Refresh cache if expired
    if (Date.now() > this.cacheExpiry) {
      await this.loadSettings();
    }

    return this.settingsCache.get(channel) || null;
  }

  /**
   * Setup email transporter
   */
  private async setupEmailTransporter(): Promise<void> {
    const settings = await this.getSettings('email');

    if (!settings || !settings.is_enabled) {
      logger.debug('Email notifications disabled');
      return;
    }

    const config = settings.config;

    try {
      this.emailTransporter = nodemailer.createTransport({
        host: config.smtp_host || notificationConfig.SMTP_HOST,
        port: config.smtp_port || notificationConfig.SMTP_PORT,
        secure: config.smtp_secure || notificationConfig.SMTP_SECURE,
        auth: config.smtp_user
          ? {
              user: config.smtp_user || notificationConfig.SMTP_USER,
              pass: config.smtp_pass || notificationConfig.SMTP_PASS,
            }
          : undefined,
      });

      // Verify connection
      await this.emailTransporter.verify();
      logger.info('Email transporter configured successfully');
    } catch (error) {
      logger.error('Failed to setup email transporter', { error });
      this.emailTransporter = null;
    }
  }

  /**
   * Setup Slack webhook
   */
  private async setupSlackWebhook(): Promise<void> {
    const settings = await this.getSettings('slack');

    if (!settings || !settings.is_enabled) {
      logger.debug('Slack notifications disabled');
      return;
    }

    const webhookUrl =
      settings.config.webhook_url || notificationConfig.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    try {
      this.slackWebhook = new IncomingWebhook(webhookUrl);
      logger.info('Slack webhook configured successfully');
    } catch (error) {
      logger.error('Failed to setup Slack webhook', { error });
      this.slackWebhook = null;
    }
  }

  /**
   * Check rate limits for notification
   */
  private async checkRateLimit(
    notificationType: NotificationType,
    resourceKey: string
  ): Promise<boolean> {
    const rateLimit = rateLimitConfig[notificationType];
    const notificationKey = `${notificationType}:${resourceKey}`;

    try {
      const result = await pool.query(
        `SELECT last_sent_at, send_count, window_start
         FROM notification_rate_limits
         WHERE notification_key = $1`,
        [notificationKey]
      );

      if (result.rows.length === 0) {
        // First time sending this notification
        return true;
      }

      const { window_start, send_count } = result.rows[0];
      const windowStartTime = new Date(window_start).getTime();
      const now = Date.now();
      const windowEndTime = windowStartTime + rateLimit.windowMinutes * 60 * 1000;

      if (now > windowEndTime) {
        // Window expired, reset
        return true;
      }

      // Check if limit exceeded
      return send_count < rateLimit.maxCount;
    } catch (error) {
      logger.error('Error checking rate limit', { error, notificationKey });
      return true; // Allow on error
    }
  }

  /**
   * Update rate limit counter
   */
  private async updateRateLimit(
    notificationType: NotificationType,
    resourceKey: string
  ): Promise<void> {
    const rateLimit = rateLimitConfig[notificationType];
    const notificationKey = `${notificationType}:${resourceKey}`;

    try {
      await pool.query(
        `INSERT INTO notification_rate_limits (notification_key, last_sent_at, send_count, window_start)
         VALUES ($1, NOW(), 1, NOW())
         ON CONFLICT (notification_key) DO UPDATE
         SET last_sent_at = NOW(),
             send_count = CASE
               WHEN notification_rate_limits.window_start < NOW() - INTERVAL '1 minute' * $2
               THEN 1
               ELSE notification_rate_limits.send_count + 1
             END,
             window_start = CASE
               WHEN notification_rate_limits.window_start < NOW() - INTERVAL '1 minute' * $2
               THEN NOW()
               ELSE notification_rate_limits.window_start
             END,
             updated_at = NOW()`,
        [notificationKey, rateLimit.windowMinutes]
      );
    } catch (error) {
      logger.error('Error updating rate limit', { error, notificationKey });
    }
  }

  /**
   * Send notification via email
   */
  private async sendEmail(
    subject: string,
    message: string,
    recipients: string[]
  ): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    const settings = await this.getSettings('email');
    if (!settings) {
      throw new Error('Email settings not found');
    }

    const config = settings.config;
    const fromAddress = config.from_address || notificationConfig.SMTP_FROM;
    const fromName = config.from_name || notificationConfig.SMTP_FROM_NAME;

    const mailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to: recipients.join(', '),
      subject,
      text: message,
      html: message.replace(/\n/g, '<br>'),
    };

    await this.emailTransporter.sendMail(mailOptions);
    logger.info('Email notification sent', { subject, recipients: recipients.length });
  }

  /**
   * Send notification via Slack
   */
  private async sendSlack(
    subject: string,
    message: string,
    color: string = '#757575'
  ): Promise<void> {
    if (!this.slackWebhook) {
      throw new Error('Slack webhook not configured');
    }

    const settings = await this.getSettings('slack');
    if (!settings) {
      throw new Error('Slack settings not found');
    }

    const config = settings.config;

    await this.slackWebhook.send({
      username: config.username || notificationConfig.SLACK_USERNAME,
      channel: config.channel || notificationConfig.SLACK_CHANNEL,
      icon_emoji: config.icon_emoji || ':hospital:',
      attachments: [
        {
          color,
          title: subject,
          text: message,
          footer: 'Medicine Man',
          ts: Math.floor(Date.now() / 1000).toString(),
        },
      ],
    });

    logger.info('Slack notification sent', { subject });
  }

  /**
   * Send in-app notification
   */
  private async sendInApp(
    type: NotificationType,
    severity: NotificationSeverity,
    title: string,
    message: string,
    metadata: NotificationMetadata,
    actionUrl?: string
  ): Promise<void> {
    try {
      // Get all admin users
      const adminResult = await pool.query(
        `SELECT u.id FROM users u
         INNER JOIN user_roles ur ON u.id = ur.user_id
         WHERE ur.role = 'admin' AND u.is_active = true`
      );

      if (adminResult.rows.length === 0) {
        logger.warn('No admin users found for in-app notification');
        return;
      }

      // Insert notification for each admin
      const values = adminResult.rows.map((row, idx) => {
        const offset = idx * 7;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
      });

      const params = adminResult.rows.flatMap((row) => [
        row.id,
        type,
        severity,
        title,
        message,
        actionUrl || null,
        JSON.stringify(metadata),
      ]);

      await pool.query(
        `INSERT INTO in_app_notifications
         (user_id, notification_type, severity, title, message, action_url, metadata)
         VALUES ${values.join(', ')}`,
        params
      );

      logger.info('In-app notifications sent', {
        type,
        recipients: adminResult.rows.length,
      });
    } catch (error) {
      logger.error('Failed to send in-app notification', { error });
      throw error;
    }
  }

  /**
   * Log notification to history
   */
  private async logNotification(
    type: NotificationType,
    severity: NotificationSeverity,
    channel: NotificationChannel,
    recipient: string,
    subject: string,
    message: string,
    metadata: NotificationMetadata,
    status: 'sent' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO notification_history
         (notification_type, severity, channel_type, recipient, subject, message, metadata, status, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          type,
          severity,
          channel,
          recipient,
          subject,
          message,
          JSON.stringify(metadata),
          status,
          errorMessage || null,
        ]
      );
    } catch (error) {
      logger.error('Failed to log notification', { error });
    }
  }

  /**
   * Send notification
   */
  public async send(payload: NotificationPayload): Promise<void> {
    const { type, metadata, channels, skipRateLimit } = payload;

    // Generate notification content
    const template = notificationTemplates[type](metadata);
    const severity = notificationSeverityMap[type];

    // Determine which channels to use
    let targetChannels: NotificationChannel[] = channels || ['email', 'slack', 'in_app'];

    // Critical alerts should use all channels
    if (severity === 'critical' && !channels) {
      targetChannels = criticalAlertChannels;
    }

    // Check rate limit
    const resourceKey = metadata.server_id || metadata.scan_id || metadata.backup_id || 'global';
    if (!skipRateLimit) {
      const allowed = await this.checkRateLimit(type, resourceKey);
      if (!allowed) {
        logger.info('Notification rate limited', { type, resourceKey });
        await this.logNotification(
          type,
          severity,
          'in_app',
          'rate_limited',
          template.subject,
          template.message,
          metadata,
          'failed',
          'Rate limit exceeded'
        );
        return;
      }
    }

    // Update rate limit counter
    await this.updateRateLimit(type, resourceKey);

    // Send to each channel
    const promises = targetChannels.map(async (channel) => {
      const settings = await this.getSettings(channel);

      if (!settings || !settings.is_enabled) {
        logger.debug(`Channel ${channel} disabled, skipping`);
        return;
      }

      try {
        switch (channel) {
          case 'email':
            if (settings.config.recipients && settings.config.recipients.length > 0) {
              await this.sendEmail(
                template.subject,
                template.message,
                settings.config.recipients
              );
              await this.logNotification(
                type,
                severity,
                channel,
                settings.config.recipients.join(', '),
                template.subject,
                template.message,
                metadata,
                'sent'
              );
            }
            break;

          case 'slack':
            await this.sendSlack(
              template.subject,
              template.message,
              template.slackColor
            );
            await this.logNotification(
              type,
              severity,
              channel,
              settings.config.webhook_url || 'default',
              template.subject,
              template.message,
              metadata,
              'sent'
            );
            break;

          case 'in_app':
            await this.sendInApp(
              type,
              severity,
              template.subject,
              template.message,
              metadata,
              template.actionUrl
            );
            await this.logNotification(
              type,
              severity,
              channel,
              'all_admins',
              template.subject,
              template.message,
              metadata,
              'sent'
            );
            break;
        }
      } catch (error) {
        logger.error(`Failed to send notification via ${channel}`, { error, type });
        await this.logNotification(
          type,
          severity,
          channel,
          'error',
          template.subject,
          template.message,
          metadata,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Send test notification
   */
  public async sendTest(channel: NotificationChannel): Promise<void> {
    const testPayload: NotificationPayload = {
      type: 'general',
      metadata: {
        subject: 'Test Notification',
        message: 'This is a test notification from Medicine Man. If you receive this, your notification channel is configured correctly.',
        action_url: '/',
      },
      channels: [channel],
      skipRateLimit: true,
    };

    await this.send(testPayload);
  }

  /**
   * Update notification settings
   */
  public async updateSettings(
    channel: NotificationChannel,
    isEnabled: boolean,
    config: Record<string, any>
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE notification_settings
         SET is_enabled = $1, config = $2, updated_at = NOW()
         WHERE channel_type = $3`,
        [isEnabled, JSON.stringify(config), channel]
      );

      // Refresh settings cache
      await this.loadSettings();

      // Reinitialize channels
      await this.initializeChannels();

      logger.info('Notification settings updated', { channel, isEnabled });
    } catch (error) {
      logger.error('Failed to update notification settings', { error });
      throw error;
    }
  }

  /**
   * Get notification history
   */
  public async getHistory(
    limit: number = 100,
    offset: number = 0,
    filters?: {
      type?: NotificationType;
      severity?: NotificationSeverity;
      channel?: NotificationChannel;
      status?: string;
    }
  ): Promise<any[]> {
    let query = 'SELECT * FROM notification_history WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.type) {
      query += ` AND notification_type = $${paramIndex++}`;
      params.push(filters.type);
    }

    if (filters?.severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(filters.severity);
    }

    if (filters?.channel) {
      query += ` AND channel_type = $${paramIndex++}`;
      params.push(filters.channel);
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
