-- Migration 005: SSH Key Rotation Support
-- Adds fields for SSH key rotation with grace period

-- Add SSH key rotation fields to servers table
ALTER TABLE servers
ADD COLUMN IF NOT EXISTS previous_private_key TEXT,
ADD COLUMN IF NOT EXISTS previous_public_key TEXT,
ADD COLUMN IF NOT EXISTS key_rotation_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS key_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS key_rotation_required BOOLEAN DEFAULT false;

-- Create index for finding servers that need key rotation
CREATE INDEX IF NOT EXISTS idx_servers_key_expires ON servers(key_expires_at)
WHERE key_expires_at IS NOT NULL;

-- Create index for rotation tracking
CREATE INDEX IF NOT EXISTS idx_servers_rotation_date ON servers(key_rotation_date DESC);

COMMENT ON COLUMN servers.previous_private_key IS 'Previous SSH private key (kept for 24h grace period after rotation)';
COMMENT ON COLUMN servers.previous_public_key IS 'Previous SSH public key';
COMMENT ON COLUMN servers.key_rotation_date IS 'Timestamp of last key rotation';
COMMENT ON COLUMN servers.key_expires_at IS 'When the current key should be rotated';
COMMENT ON COLUMN servers.key_rotation_required IS 'Flag indicating manual rotation is required';
