-- Migration: Add backup_duration column to backups table
-- This column tracks how long each backup operation took

-- Add backup_duration column (in seconds)
ALTER TABLE backups ADD COLUMN IF NOT EXISTS backup_duration INTEGER;

-- Add comment
COMMENT ON COLUMN backups.backup_duration IS 'Duration of backup operation in seconds';

-- Add index for performance analysis queries
CREATE INDEX IF NOT EXISTS idx_backups_duration ON backups(backup_duration) WHERE backup_duration IS NOT NULL;

-- Add check constraint to ensure reasonable values (max 24 hours = 86400 seconds)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_backup_duration_positive'
    AND conrelid = 'backups'::regclass
  ) THEN
    ALTER TABLE backups ADD CONSTRAINT chk_backup_duration_positive
      CHECK (backup_duration IS NULL OR (backup_duration >= 0 AND backup_duration <= 86400));
  END IF;
END $$;
