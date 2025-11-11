-- Critical Schema Fixes
-- Migration 014
-- Date: 2025-11-04
-- Purpose: Fix critical schema issues identified during codebase review

BEGIN;

-- 1. Add missing assigned_at column to user_roles
ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to have created_at value
UPDATE user_roles SET assigned_at = created_at WHERE assigned_at IS NULL;

-- 2. Add missing options column to backups table
ALTER TABLE backups
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN backups.options IS 'Backup configuration options for orchestrated backups (paths, excluded_paths, etc.)';

-- 3. Update backup_type enum to include orchestrated backup types
-- Drop the existing constraint
ALTER TABLE backups DROP CONSTRAINT IF EXISTS backups_backup_type_check;

-- Add new constraint with orchestrated types
ALTER TABLE backups
ADD CONSTRAINT backups_backup_type_check
CHECK (backup_type IN (
    'full',
    'incremental',
    'differential',
    'home',
    'config',
    'database',
    'orchestrated_full',
    'orchestrated_selective'
));

-- 4. Add NOT NULL constraints to server_scans foreign keys (if not already set)
-- This prevents orphaned scan records
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'server_scans'
        AND column_name = 'server_id'
        AND is_nullable = 'YES'
    ) THEN
        -- Delete any orphaned scans first
        DELETE FROM server_scans WHERE server_id IS NULL;
        -- Add NOT NULL constraint
        ALTER TABLE server_scans ALTER COLUMN server_id SET NOT NULL;
    END IF;
END $$;

-- 5. Ensure status columns have proper defaults
ALTER TABLE backups
ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE server_scans
ALTER COLUMN status SET DEFAULT 'pending';

-- 6. Add validation constraint for backup file_size (must be non-negative)
ALTER TABLE backups
ADD CONSTRAINT backups_file_size_positive
CHECK (file_size IS NULL OR file_size >= 0);

-- 7. Add index for backup queries by type and status (performance improvement)
CREATE INDEX IF NOT EXISTS idx_backups_type_status
ON backups(backup_type, status);

-- 8. Add index for server scans by type and status (performance improvement)
CREATE INDEX IF NOT EXISTS idx_server_scans_type_status
ON server_scans(scan_type, status);

-- 9. Add index for querying recent backups per server (performance improvement)
CREATE INDEX IF NOT EXISTS idx_backups_server_created
ON backups(server_id, created_at DESC);

-- 10. Add constraint to ensure completed_at is after started_at for backups
ALTER TABLE backups
ADD CONSTRAINT backups_completed_after_started
CHECK (completed_at IS NULL OR completed_at >= started_at);

-- 11. Add constraint to ensure completed_at is after started_at for scans
ALTER TABLE server_scans
ADD CONSTRAINT scans_completed_after_started
CHECK (completed_at IS NULL OR completed_at >= started_at);

-- 12. Create function to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 13. Add triggers for auto-updating updated_at columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_servers_updated_at'
    ) THEN
        CREATE TRIGGER update_servers_updated_at
        BEFORE UPDATE ON servers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
    ) THEN
        CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

COMMIT;

-- Verification queries (commented out for migration)
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_roles' AND column_name = 'assigned_at';

-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'backups' AND column_name = 'options';

-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'backups'::regclass AND conname = 'backups_backup_type_check';
