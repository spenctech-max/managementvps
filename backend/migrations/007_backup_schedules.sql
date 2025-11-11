-- Migration 007: Backup Schedules
-- Creates table for automated backup scheduling

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create backup_schedules table
CREATE TABLE IF NOT EXISTS backup_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  source_path TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  compression VARCHAR(10) DEFAULT 'gzip' CHECK (compression IN ('none', 'gzip', 'bzip2')),
  encryption BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  last_status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_backup_schedules_server_id ON backup_schedules(server_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_user_id ON backup_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run) WHERE enabled = true;

-- Compound index for finding due schedules
CREATE INDEX IF NOT EXISTS idx_backup_schedules_due ON backup_schedules(enabled, next_run)
WHERE enabled = true AND next_run IS NOT NULL;

COMMENT ON TABLE backup_schedules IS 'Automated backup scheduling configuration';
COMMENT ON COLUMN backup_schedules.schedule_type IS 'Frequency: daily, weekly, or monthly';
COMMENT ON COLUMN backup_schedules.hour IS 'Hour of day to run (0-23)';
COMMENT ON COLUMN backup_schedules.day_of_week IS 'Day of week for weekly schedules (0=Sunday)';
COMMENT ON COLUMN backup_schedules.day_of_month IS 'Day of month for monthly schedules (1-31)';
COMMENT ON COLUMN backup_schedules.last_run IS 'Timestamp of last execution';
COMMENT ON COLUMN backup_schedules.next_run IS 'Calculated next execution time';
COMMENT ON COLUMN backup_schedules.last_status IS 'Status of last execution: success, failure, running';
