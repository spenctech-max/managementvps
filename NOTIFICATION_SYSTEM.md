# Medicine Man Notification System

## Overview

The Medicine Man notification system provides comprehensive alerting for critical events including backup failures, scan failures, disk space issues, and service health problems. The system supports multiple notification channels: Email (SMTP), Slack webhooks, and in-app notifications.

## Features

- **Multi-Channel Support**: Email, Slack, and in-app notifications
- **Smart Rate Limiting**: Prevents notification spam with configurable rate limits
- **Template System**: Pre-built templates for common notification types
- **Notification History**: Complete audit trail of all notifications sent
- **Test Notifications**: Verify channel configuration before going live
- **Admin Dashboard**: View and manage notification settings through the UI
- **Automatic Triggers**: Integration with backup, scan, and health check systems

## Notification Types

### Critical Notifications
- **backup_failure**: Triggered after 3 failed backup retry attempts
- **disk_space_critical**: Disk usage >90% or <10GB free space
- **service_health_degraded**: Critical service failure detected

### Warning Notifications
- **scan_failure**: Server scan failed to complete
- **disk_space_warning**: Disk usage >80%
- **scheduled_backup_missed**: Scheduled backup did not run

### Info Notifications
- **backup_success**: Backup completed successfully
- **ssh_key_rotation_required**: SSH key age exceeds threshold

## Installation

### 1. Install Dependencies

The required packages are already installed during the implementation:

```bash
cd /mnt/user/appdata/medicine-man/backend
npm install nodemailer @slack/webhook @types/nodemailer
```

### 2. Run Database Migration

Apply the notification system database schema:

```bash
cd /mnt/user/appdata/medicine-man/backend
npm run migrate
```

This creates the following tables:
- `notification_settings` - Channel configuration
- `notification_history` - Audit log of sent notifications
- `in_app_notifications` - UI notifications for users
- `notification_rate_limits` - Rate limiting tracker

### 3. Configure Environment Variables

Edit your `.env` file and add notification configuration:

```env
# General Notification Settings
NOTIFICATIONS_ENABLED=true
NOTIFICATION_RATE_LIMIT_MINUTES=60
NOTIFICATION_MAX_RETRIES=3

# Email (SMTP) Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@medicine-man.local
SMTP_FROM_NAME=Medicine Man

# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#alerts
SLACK_USERNAME=Medicine Man
```

See `.env.example` for detailed configuration examples for different SMTP providers.

## Configuration

### Email (SMTP) Setup

#### Gmail
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character app password in `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
```

#### Office 365 / Outlook
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Slack Setup

1. Create a Slack App: https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Add webhook to your workspace
4. Copy the webhook URL
5. Add to `.env`:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
SLACK_CHANNEL=#alerts
```

## API Documentation & Examples

### Authentication

All API requests require authentication. Get your JWT token:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'
```

Include the token in all subsequent requests:
```bash
Authorization: Bearer <your-jwt-token>
```

### Get Notification Settings

```bash
curl -X GET http://localhost:3000/api/notifications/settings \
  -H "Authorization: Bearer <admin-token>"
```

### Configure Email (Gmail Example)

```bash
curl -X POST http://localhost:3000/api/notifications/settings \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_type": "email",
    "is_enabled": true,
    "config": {
      "smtp_host": "smtp.gmail.com",
      "smtp_port": 587,
      "smtp_secure": false,
      "smtp_user": "your-email@gmail.com",
      "smtp_pass": "your-16-char-app-password",
      "from_address": "noreply@medicine-man.local",
      "from_name": "Medicine Man Alerts",
      "recipients": [
        "admin@example.com",
        "devops-team@example.com"
      ]
    }
  }'
```

### Configure Slack

```bash
curl -X POST http://localhost:3000/api/notifications/settings \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_type": "slack",
    "is_enabled": true,
    "config": {
      "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
      "channel": "#server-alerts",
      "username": "Medicine Man Bot",
      "icon_emoji": ":hospital:"
    }
  }'
```

### Send Test Notification

```bash
# Test Email
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"channel": "email"}'

# Test Slack
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"channel": "slack"}'
```

### View Notification History

```bash
# Get all recent notifications
curl -X GET "http://localhost:3000/api/notifications/history?limit=50" \
  -H "Authorization: Bearer <admin-token>"

# Filter by type
curl -X GET "http://localhost:3000/api/notifications/history?type=backup_failure" \
  -H "Authorization: Bearer <admin-token>"

# Filter by severity
curl -X GET "http://localhost:3000/api/notifications/history?severity=critical" \
  -H "Authorization: Bearer <admin-token>"

# Only failed notifications
curl -X GET "http://localhost:3000/api/notifications/history?status=failed" \
  -H "Authorization: Bearer <admin-token>"
```

### Manage In-App Notifications

```bash
# Get your notifications
curl -X GET http://localhost:3000/api/notifications/in-app \
  -H "Authorization: Bearer <user-token>"

# Unread only
curl -X GET "http://localhost:3000/api/notifications/in-app?unread_only=true" \
  -H "Authorization: Bearer <user-token>"

# Mark notification as read
curl -X PATCH http://localhost:3000/api/notifications/in-app/<notification-id>/read \
  -H "Authorization: Bearer <user-token>"

# Mark all as read
curl -X PATCH http://localhost:3000/api/notifications/in-app/read-all \
  -H "Authorization: Bearer <user-token>"
```

### View Statistics

```bash
curl -X GET http://localhost:3000/api/notifications/stats \
  -H "Authorization: Bearer <admin-token>"
```

## Integration Points

### Backup Orchestrator
Location: `/mnt/user/appdata/medicine-man/backend/src/services/backupOrchestrator.ts`

Notifications are automatically sent when:
- Backup fails after retries → `backup_failure` notification
- Backup completes successfully → `backup_success` notification

### Scanner Service
Location: `/mnt/user/appdata/medicine-man/backend/src/services/scanner.ts`

Notifications are automatically sent when:
- Server scan fails → `scan_failure` notification

### Health Check Service
Location: `/mnt/user/appdata/medicine-man/backend/src/services/healthCheckService.ts`

Runs hourly via cron job and sends notifications for:
- Disk usage >90% or <10GB free → `disk_space_critical` notification
- Disk usage >80% → `disk_space_warning` notification
- Service health degraded → `service_health_degraded` notification

## Rate Limiting

Prevents notification spam with intelligent rate limiting:

| Notification Type | Window | Max Count |
|------------------|--------|-----------|
| backup_failure | 60 min | 3 |
| backup_success | 15 min | 10 |
| scan_failure | 60 min | 3 |
| disk_space_critical | 4 hours | 1 |
| disk_space_warning | 12 hours | 1 |
| service_health_degraded | 2 hours | 2 |
| scheduled_backup_missed | 3 hours | 1 |
| ssh_key_rotation_required | 24 hours | 1 |

Rate limits are tracked per resource (e.g., per server, per mount point) to ensure granular control.

## Troubleshooting

### Email Not Sending

1. **Check SMTP credentials:**
   ```bash
   # Test SMTP connection
   curl -v telnet://smtp.gmail.com:587
   ```

2. **Verify environment variables are loaded:**
   ```bash
   # Check server logs
   docker logs medicine-man-backend
   ```

3. **Send test notification:**
   ```bash
   curl -X POST http://localhost:3000/api/notifications/test \
     -H "Authorization: Bearer <admin-token>" \
     -H "Content-Type: application/json" \
     -d '{"channel": "email"}'
   ```

4. **Check notification history for errors:**
   ```bash
   curl http://localhost:3000/api/notifications/history?status=failed \
     -H "Authorization: Bearer <admin-token>"
   ```

### Slack Not Sending

1. **Verify webhook URL is correct:**
   - Should start with `https://hooks.slack.com/services/`
   - Test webhook manually:
     ```bash
     curl -X POST <webhook-url> \
       -H 'Content-Type: application/json' \
       -d '{"text": "Test message"}'
     ```

2. **Check Slack app permissions:**
   - Ensure the webhook is still active
   - Verify the app has permission to post to the channel

### Rate Limiting Issues

If notifications are being rate limited too aggressively:

1. **Check rate limit settings:**
   ```sql
   SELECT * FROM notification_rate_limits
   WHERE notification_key LIKE '%server-id%';
   ```

2. **Adjust rate limits in config:**
   Edit `/mnt/user/appdata/medicine-man/backend/src/config/notifications.ts`

## Database Schema

### notification_settings
```sql
id UUID PRIMARY KEY
channel_type VARCHAR(50) -- email, slack, in_app
is_enabled BOOLEAN
config JSONB
created_at TIMESTAMP
updated_at TIMESTAMP
```

### notification_history
```sql
id UUID PRIMARY KEY
notification_type VARCHAR(100)
severity VARCHAR(50) -- critical, warning, info, success
channel_type VARCHAR(50)
recipient TEXT
subject VARCHAR(500)
message TEXT
metadata JSONB
status VARCHAR(50) -- pending, sent, failed, rate_limited
error_message TEXT
retry_count INTEGER
sent_at TIMESTAMP
created_at TIMESTAMP
```

### in_app_notifications
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
notification_type VARCHAR(100)
severity VARCHAR(50)
title VARCHAR(500)
message TEXT
action_url TEXT
metadata JSONB
is_read BOOLEAN
read_at TIMESTAMP
created_at TIMESTAMP
expires_at TIMESTAMP
```

### notification_rate_limits
```sql
id UUID PRIMARY KEY
notification_key VARCHAR(500) -- Composite: type:resource_id
last_sent_at TIMESTAMP
send_count INTEGER
window_start TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

## Security Considerations

1. **Credential Storage**: SMTP passwords and webhook URLs are stored in the database
2. **API Access**: All notification endpoints require authentication
3. **Admin Only**: Configuration endpoints require admin role
4. **Sanitization**: Sensitive config data is sanitized before sending to client
5. **Rate Limiting**: Prevents abuse and notification spam

## Maintenance

### Cleanup Old Notifications

Run periodically to clean up old data:

```sql
-- Clean up expired in-app notifications
SELECT cleanup_expired_notifications();

-- Clean up old notification history (>90 days)
SELECT cleanup_old_notification_history();
```

### Monitor Notification Health

Check notification statistics:
```bash
GET /api/notifications/stats
```

Review failed notifications:
```bash
GET /api/notifications/history?status=failed&limit=50
```

## Files Created/Modified

### New Files
- `/mnt/user/appdata/medicine-man/backend/src/config/notifications.ts`
- `/mnt/user/appdata/medicine-man/backend/src/services/notificationService.ts`
- `/mnt/user/appdata/medicine-man/backend/src/services/healthCheckService.ts`
- `/mnt/user/appdata/medicine-man/backend/src/routes/notifications.ts`
- `/mnt/user/appdata/medicine-man/backend/migrations/010_notifications.sql`

### Modified Files
- `/mnt/user/appdata/medicine-man/backend/src/index.ts` - Added notification routes and health check cron
- `/mnt/user/appdata/medicine-man/backend/src/services/backupOrchestrator.ts` - Added notification triggers
- `/mnt/user/appdata/medicine-man/backend/src/services/scanner.ts` - Added notification triggers
- `/mnt/user/appdata/medicine-man/backend/.env.example` - Added notification configuration
- `/mnt/user/appdata/medicine-man/backend/package.json` - Added nodemailer and @slack/webhook
