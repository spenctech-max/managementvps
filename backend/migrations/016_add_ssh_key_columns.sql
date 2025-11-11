-- Migration 015: Add SSH Key Columns
-- Adds private_key and public_key columns for SSH key authentication
-- Date: 2025-11-05

BEGIN;

-- Add columns for SSH key pairs
ALTER TABLE servers
ADD COLUMN IF NOT EXISTS private_key TEXT,
ADD COLUMN IF NOT EXISTS public_key TEXT;

COMMENT ON COLUMN servers.private_key IS 'Current SSH private key (encrypted, for key-based auth)';
COMMENT ON COLUMN servers.public_key IS 'Current SSH public key (for key-based auth)';
COMMENT ON COLUMN servers.credential IS 'Encrypted credential: password for password auth, or private key for key auth (deprecated for keys, use private_key instead)';

-- Create index for efficient key queries
CREATE INDEX IF NOT EXISTS idx_servers_auth_type_keys ON servers(auth_type)
WHERE auth_type = 'key';

COMMIT;

-- Note: Existing servers using key-based auth may need migration:
-- For servers where auth_type='key' and credential contains a key,
-- the credential should be copied to private_key column.
-- This migration does NOT automatically migrate data to avoid disruption.
