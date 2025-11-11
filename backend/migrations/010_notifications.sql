-- Notification System Migration
-- Adds tables for notification settings, history, and in-app notifications

-- Notification settings table
-- Stores configuration for different notification channels
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('email', 'slack', 'in_app')),
    is_enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL, -- Channel-specific configuration (SMTP, webhook URL, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_type)
);

-- Notification history table
-- Logs all notifications sent through the system
CREATE TABLE notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_type VARCHAR(100) NOT NULL CHECK (notification_type IN (
        'backup_failure',
        'backup_success',
        'scan_failure',
        'disk_space_critical',
        'disk_space_warning',
        'service_health_degraded',
        'scheduled_backup_missed',
        'ssh_key_rotation_required',
        'general'
    )),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('critical', 'warning', 'info', 'success')),
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('email', 'slack', 'in_app')),
    recipient TEXT NOT NULL, -- Email address, webhook URL, or user ID
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB, -- Additional context (server_id, backup_id, etc.)
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'rate_limited')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- In-app notifications table
-- Stores notifications displayed in the UI
CREATE TABLE in_app_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(100) NOT NULL CHECK (notification_type IN (
        'backup_failure',
        'backup_success',
        'scan_failure',
        'disk_space_critical',
        'disk_space_warning',
        'service_health_degraded',
        'scheduled_backup_missed',
        'ssh_key_rotation_required',
        'general'
    )),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('critical', 'warning', 'info', 'success')),
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT, -- Optional link to related resource
    metadata JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- Optional expiration for auto-cleanup
);

-- Notification rate limit table
-- Prevents spam by tracking notification frequency
CREATE TABLE notification_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_key VARCHAR(500) NOT NULL, -- Composite key: type + resource_id
    last_sent_at TIMESTAMP NOT NULL,
    send_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_key)
);

-- Create indexes for performance
CREATE INDEX idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX idx_notification_history_severity ON notification_history(severity);
CREATE INDEX idx_notification_history_channel ON notification_history(channel_type);
CREATE INDEX idx_notification_history_status ON notification_history(status);
CREATE INDEX idx_notification_history_created_at ON notification_history(created_at DESC);

CREATE INDEX idx_in_app_notifications_user_id ON in_app_notifications(user_id);
CREATE INDEX idx_in_app_notifications_is_read ON in_app_notifications(is_read);
CREATE INDEX idx_in_app_notifications_created_at ON in_app_notifications(created_at DESC);
CREATE INDEX idx_in_app_notifications_type ON in_app_notifications(notification_type);
CREATE INDEX idx_in_app_notifications_severity ON in_app_notifications(severity);

CREATE INDEX idx_notification_rate_limits_key ON notification_rate_limits(notification_key);
CREATE INDEX idx_notification_rate_limits_window ON notification_rate_limits(window_start);

-- Add triggers for updated_at
CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_rate_limits_updated_at
    BEFORE UPDATE ON notification_rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification settings (disabled by default for safety)
INSERT INTO notification_settings (channel_type, is_enabled, config) VALUES
    ('email', false, '{
        "smtp_host": "",
        "smtp_port": 587,
        "smtp_secure": false,
        "smtp_user": "",
        "smtp_pass": "",
        "from_address": "noreply@medicine-man.local",
        "from_name": "Medicine Man",
        "recipients": []
    }'::jsonb),
    ('slack', false, '{
        "webhook_url": "",
        "channel": "#alerts",
        "username": "Medicine Man",
        "icon_emoji": ":hospital:"
    }'::jsonb),
    ('in_app', true, '{
        "enabled_types": [
            "backup_failure",
            "backup_success",
            "scan_failure",
            "disk_space_critical",
            "disk_space_warning",
            "service_health_degraded",
            "scheduled_backup_missed"
        ],
        "retention_days": 30
    }'::jsonb);

-- Create view for unread notification counts per user
CREATE VIEW user_notification_counts AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE is_read = false) as unread_count,
    COUNT(*) FILTER (WHERE is_read = false AND severity = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE is_read = false AND severity = 'warning') as warning_count,
    MAX(created_at) FILTER (WHERE is_read = false) as latest_unread_at
FROM in_app_notifications
GROUP BY user_id;

-- Create function to auto-expire old notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM in_app_notifications
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old notification history (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notification_history()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notification_history
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment documentation
COMMENT ON TABLE notification_settings IS 'Configuration for different notification channels (email, Slack, in-app)';
COMMENT ON TABLE notification_history IS 'Audit log of all notifications sent through the system';
COMMENT ON TABLE in_app_notifications IS 'Notifications displayed in the web UI for users';
COMMENT ON TABLE notification_rate_limits IS 'Rate limiting to prevent notification spam';
COMMENT ON FUNCTION cleanup_expired_notifications() IS 'Removes expired in-app notifications';
COMMENT ON FUNCTION cleanup_old_notification_history() IS 'Archives notification history older than 90 days';
