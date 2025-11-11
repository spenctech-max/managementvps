-- Migration: Add Two-Factor Authentication (2FA) fields
-- Description: Adds TOTP 2FA support to users table

-- Add 2FA columns to users table
ALTER TABLE users
ADD COLUMN twofa_secret TEXT DEFAULT NULL,
ADD COLUMN twofa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN twofa_backup_codes TEXT[] DEFAULT NULL,
ADD COLUMN twofa_enabled_at TIMESTAMP DEFAULT NULL;

-- Add indexes for 2FA queries
CREATE INDEX idx_users_twofa_enabled ON users(twofa_enabled) WHERE twofa_enabled = true;

-- Add comments for documentation
COMMENT ON COLUMN users.twofa_secret IS 'Base32-encoded TOTP secret for 2FA';
COMMENT ON COLUMN users.twofa_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.twofa_backup_codes IS 'Array of hashed backup codes for 2FA recovery';
COMMENT ON COLUMN users.twofa_enabled_at IS 'Timestamp when 2FA was last enabled';
