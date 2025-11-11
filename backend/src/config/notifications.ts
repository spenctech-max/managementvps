/**
 * Notification System Configuration
 * Handles notification templates, rate limiting, and environment configuration
 */

import { z } from 'zod';

// Notification environment schema
const notificationEnvSchema = z.object({
  // Email (SMTP) Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).transform(Number).optional().default('587'),
  SMTP_SECURE: z.string().transform((val) => val === 'true').optional().default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().optional().default('Medicine Man'),

  // Slack Configuration
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  SLACK_CHANNEL: z.string().optional().default('#alerts'),
  SLACK_USERNAME: z.string().optional().default('Medicine Man'),

  // General Notification Settings
  NOTIFICATIONS_ENABLED: z.string().transform((val) => val !== 'false').optional().default('true'),
  NOTIFICATION_RATE_LIMIT_MINUTES: z.string().regex(/^\d+$/).transform(Number).optional().default('60'),
  NOTIFICATION_MAX_RETRIES: z.string().regex(/^\d+$/).transform(Number).optional().default('3'),
});

// Validate notification environment variables (non-fatal if missing)
let notificationEnv: z.infer<typeof notificationEnvSchema>;
try {
  notificationEnv = notificationEnvSchema.parse(process.env);
} catch (error) {
  console.warn('Warning: Some notification environment variables are missing or invalid.');
  console.warn('Notification features may be limited. Please configure .env file.');
  // Use defaults
  notificationEnv = {
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_FROM_NAME: 'Medicine Man',
    SLACK_CHANNEL: '#alerts',
    SLACK_USERNAME: 'Medicine Man',
    NOTIFICATIONS_ENABLED: true,
    NOTIFICATION_RATE_LIMIT_MINUTES: 60,
    NOTIFICATION_MAX_RETRIES: 3,
  };
}

export const notificationConfig = notificationEnv;

/**
 * Notification type definitions
 */
export type NotificationType =
  | 'backup_failure'
  | 'backup_success'
  | 'scan_failure'
  | 'disk_space_critical'
  | 'disk_space_warning'
  | 'service_health_degraded'
  | 'scheduled_backup_missed'
  | 'ssh_key_rotation_required'
  | 'general';

export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success';

export type NotificationChannel = 'email' | 'slack' | 'in_app';

/**
 * Notification template interface
 */
export interface NotificationTemplate {
  subject: string;
  message: string;
  slackColor?: string; // Slack attachment color
  actionUrl?: string; // Link to relevant resource
}

/**
 * Notification metadata interface
 */
export interface NotificationMetadata {
  server_id?: string;
  server_name?: string;
  backup_id?: string;
  scan_id?: string;
  error_message?: string;
  disk_usage_percent?: number;
  free_space_gb?: number;
  mount_point?: string;
  retry_count?: number;
  [key: string]: any; // Allow additional metadata
}

/**
 * Notification templates
 * Dynamic templates with placeholders for metadata
 */
export const notificationTemplates: Record<
  NotificationType,
  (metadata: NotificationMetadata) => NotificationTemplate
> = {
  backup_failure: (metadata) => ({
    subject: `Backup Failed: ${metadata.server_name || 'Unknown Server'}`,
    message: `Backup operation failed for server "${metadata.server_name || 'Unknown'}" (${metadata.server_id || 'N/A'}).\n\nError: ${metadata.error_message || 'Unknown error'}\n\nRetry count: ${metadata.retry_count || 0}\n\nPlease investigate immediately.`,
    slackColor: '#d32f2f',
    actionUrl: metadata.server_id ? `/servers/${metadata.server_id}/backups` : undefined,
  }),

  backup_success: (metadata) => ({
    subject: `Backup Completed: ${metadata.server_name || 'Unknown Server'}`,
    message: `Backup operation completed successfully for server "${metadata.server_name || 'Unknown'}" (${metadata.server_id || 'N/A'}).\n\nBackup ID: ${metadata.backup_id || 'N/A'}\nSize: ${metadata.backup_size_mb ? `${metadata.backup_size_mb} MB` : 'N/A'}\nDuration: ${metadata.duration_minutes ? `${metadata.duration_minutes} minutes` : 'N/A'}`,
    slackColor: '#4caf50',
    actionUrl: metadata.backup_id ? `/backups/${metadata.backup_id}` : undefined,
  }),

  scan_failure: (metadata) => ({
    subject: `Server Scan Failed: ${metadata.server_name || 'Unknown Server'}`,
    message: `Server scan failed for "${metadata.server_name || 'Unknown'}" (${metadata.server_id || 'N/A'}).\n\nScan Type: ${metadata.scan_type || 'N/A'}\nError: ${metadata.error_message || 'Unknown error'}\n\nPlease check server connectivity and credentials.`,
    slackColor: '#f57c00',
    actionUrl: metadata.server_id ? `/servers/${metadata.server_id}` : undefined,
  }),

  disk_space_critical: (metadata) => ({
    subject: `CRITICAL: Low Disk Space on ${metadata.server_name || 'Server'}`,
    message: `Critical disk space warning for server "${metadata.server_name || 'Unknown'}" (${metadata.server_id || 'N/A'}).\n\nMount Point: ${metadata.mount_point || 'N/A'}\nUsage: ${metadata.disk_usage_percent || 'N/A'}%\nFree Space: ${metadata.free_space_gb || 'N/A'} GB\n\nIMMEDIATE ACTION REQUIRED: Free up disk space to prevent service disruption.`,
    slackColor: '#d32f2f',
    actionUrl: metadata.server_id ? `/servers/${metadata.server_id}` : undefined,
  }),

  disk_space_warning: (metadata) => ({
    subject: `WARNING: Low Disk Space on ${metadata.server_name || 'Server'}`,
    message: `Disk space warning for server "${metadata.server_name || 'Unknown'}" (${metadata.server_id || 'N/A'}).\n\nMount Point: ${metadata.mount_point || 'N/A'}\nUsage: ${metadata.disk_usage_percent || 'N/A'}%\nFree Space: ${metadata.free_space_gb || 'N/A'} GB\n\nPlease monitor and plan to free up disk space.`,
    slackColor: '#ff9800',
    actionUrl: metadata.server_id ? `/servers/${metadata.server_id}` : undefined,
  }),

  service_health_degraded: (metadata) => ({
    subject: `Service Health Degraded: ${metadata.service_name || 'Unknown Service'}`,
    message: `Health check detected degraded service on "${metadata.server_name || 'Unknown'}" (${metadata.server_id || 'N/A'}).\n\nService: ${metadata.service_name || 'N/A'}\nStatus: ${metadata.service_status || 'N/A'}\nDetails: ${metadata.error_message || 'No details available'}\n\nPlease investigate service status.`,
    slackColor: '#ff9800',
    actionUrl: metadata.server_id ? `/servers/${metadata.server_id}` : undefined,
  }),

  scheduled_backup_missed: (metadata) => ({
    subject: `Missed Scheduled Backup: ${metadata.server_name || 'Unknown Server'}`,
    message: `A scheduled backup was missed for server "${metadata.server_name || 'Unknown'}" (${metadata.server_id || 'N/A'}).\n\nSchedule: ${metadata.schedule_name || 'N/A'}\nExpected Time: ${metadata.expected_time || 'N/A'}\nReason: ${metadata.error_message || 'Unknown'}\n\nPlease review backup schedule configuration.`,
    slackColor: '#f57c00',
    actionUrl: metadata.server_id ? `/servers/${metadata.server_id}/schedules` : undefined,
  }),

  ssh_key_rotation_required: (metadata) => ({
    subject: `SSH Key Rotation Required: ${metadata.server_name || 'Server'}`,
    message: `SSH key rotation is recommended for server "${metadata.server_name || 'Unknown'}" (${metadata.server_id || 'N/A'}).\n\nKey Age: ${metadata.key_age_days || 'N/A'} days\nLast Rotation: ${metadata.last_rotation || 'Never'}\n\nPlease rotate SSH keys for improved security.`,
    slackColor: '#2196f3',
    actionUrl: metadata.server_id ? `/servers/${metadata.server_id}/settings` : undefined,
  }),

  general: (metadata) => ({
    subject: metadata.subject || 'Medicine Man Notification',
    message: metadata.message || 'A notification was triggered.',
    slackColor: '#757575',
    actionUrl: metadata.action_url,
  }),
};

/**
 * Notification severity mapping
 */
export const notificationSeverityMap: Record<NotificationType, NotificationSeverity> = {
  backup_failure: 'critical',
  backup_success: 'success',
  scan_failure: 'warning',
  disk_space_critical: 'critical',
  disk_space_warning: 'warning',
  service_health_degraded: 'warning',
  scheduled_backup_missed: 'warning',
  ssh_key_rotation_required: 'info',
  general: 'info',
};

/**
 * Rate limiting configuration
 * Defines how often the same notification type can be sent
 */
export const rateLimitConfig: Record<NotificationType, { windowMinutes: number; maxCount: number }> = {
  backup_failure: { windowMinutes: 60, maxCount: 3 }, // Max 3 per hour per server
  backup_success: { windowMinutes: 15, maxCount: 10 }, // Max 10 per 15 min
  scan_failure: { windowMinutes: 60, maxCount: 3 }, // Max 3 per hour per server
  disk_space_critical: { windowMinutes: 240, maxCount: 1 }, // Max 1 per 4 hours per mount
  disk_space_warning: { windowMinutes: 720, maxCount: 1 }, // Max 1 per 12 hours per mount
  service_health_degraded: { windowMinutes: 120, maxCount: 2 }, // Max 2 per 2 hours per service
  scheduled_backup_missed: { windowMinutes: 180, maxCount: 1 }, // Max 1 per 3 hours per schedule
  ssh_key_rotation_required: { windowMinutes: 1440, maxCount: 1 }, // Max 1 per day per server
  general: { windowMinutes: 30, maxCount: 5 }, // Max 5 per 30 min
};

/**
 * Default email recipients for admin notifications
 */
export const defaultAdminRecipients: string[] = [];

/**
 * Notification channels that should always be used for critical alerts
 */
export const criticalAlertChannels: NotificationChannel[] = ['email', 'slack', 'in_app'];

/**
 * Export configuration for use in services
 */
export default {
  config: notificationConfig,
  templates: notificationTemplates,
  severityMap: notificationSeverityMap,
  rateLimitConfig,
  defaultAdminRecipients,
  criticalAlertChannels,
};
