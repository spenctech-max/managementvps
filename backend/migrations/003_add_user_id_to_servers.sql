-- Add user_id foreign key to servers table
-- This links servers to their owners

-- Add user_id column (nullable first for existing data)
ALTER TABLE servers
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add foreign key constraint
ALTER TABLE servers
ADD CONSTRAINT fk_servers_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add NOT NULL constraint (after data is populated in production)
-- NOTE: In production, you would need to populate user_id first
-- For new installations, this is fine
ALTER TABLE servers
ALTER COLUMN user_id SET NOT NULL;

-- Add index for foreign key (if not created in migration 002)
CREATE INDEX IF NOT EXISTS idx_servers_user_id
ON servers(user_id);
