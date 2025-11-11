-- Migration 006: Backup Verification Support
-- Adds fields for backup integrity verification

-- Add verification fields to backups table
ALTER TABLE backups
ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';

-- Create index for verification status
CREATE INDEX IF NOT EXISTS idx_backups_verification_status ON backups(verification_status);

-- Create index for verified backups
CREATE INDEX IF NOT EXISTS idx_backups_verified_at ON backups(verified_at DESC);

-- Add check constraint for verification status
ALTER TABLE backups
ADD CONSTRAINT check_verification_status
CHECK (verification_status IN ('pending', 'verified', 'failed', 'skipped'));

COMMENT ON COLUMN backups.file_hash IS 'SHA-256 hash of backup file for integrity verification';
COMMENT ON COLUMN backups.file_size IS 'Size of backup file in bytes';
COMMENT ON COLUMN backups.verified_at IS 'Timestamp of last successful verification';
COMMENT ON COLUMN backups.verification_status IS 'Verification status: pending, verified, failed, skipped';
