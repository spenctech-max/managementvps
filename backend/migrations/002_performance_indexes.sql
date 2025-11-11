-- Performance Optimization Migration
-- Adds compound indexes for common query patterns

-- Compound index for servers filtered by user and online status
-- Used in: GET /api/servers (filtered views)
CREATE INDEX IF NOT EXISTS idx_servers_user_online
ON servers(user_id, is_online);

-- Compound index for servers with user and creation date
-- Used in: Server list ordering by creation date
CREATE INDEX IF NOT EXISTS idx_servers_user_created
ON servers(user_id, created_at DESC);

-- Compound index for scans with server and creation date
-- Used in: GET /api/scans?serverId=X (scan history)
CREATE INDEX IF NOT EXISTS idx_scans_server_created
ON server_scans(server_id, created_at DESC);

-- Compound index for scans with server and status
-- Used in: Filtering scans by status per server
CREATE INDEX IF NOT EXISTS idx_scans_server_status
ON server_scans(server_id, status);

-- Compound index for backups with server, status, and date
-- Used in: GET /api/backups?serverId=X&status=Y
CREATE INDEX IF NOT EXISTS idx_backups_server_status_created
ON backups(server_id, status, created_at DESC);

-- Compound index for backups per server ordered by date
-- Used in: Backup history per server
CREATE INDEX IF NOT EXISTS idx_backups_server_created
ON backups(server_id, created_at DESC);

-- Compound index for user activity logs
-- Used in: Activity feed per user
CREATE INDEX IF NOT EXISTS idx_activity_user_created
ON user_activity_logs(user_id, created_at DESC);

-- Partial index for active users only
-- Used in: Authentication and active user queries
CREATE INDEX IF NOT EXISTS idx_users_active_username
ON users(username) WHERE is_active = true;

-- Partial index for active users by email
-- Used in: Email lookups for active users
CREATE INDEX IF NOT EXISTS idx_users_active_email
ON users(email) WHERE is_active = true;

-- Compound index for user roles lookup
-- Used in: Authorization checks
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
ON user_roles(user_id, role);

-- Index for detecting services by type (for aggregations)
-- Used in: Service type statistics and filtering
CREATE INDEX IF NOT EXISTS idx_services_type_scan
ON detected_services(service_type, scan_id);

-- Index for filesystem usage analysis
-- Used in: Storage capacity queries
CREATE INDEX IF NOT EXISTS idx_filesystems_scan_usage
ON detected_filesystems(scan_id, usage_percentage DESC);

-- Index for backup recommendations by priority
-- Used in: Prioritized recommendation lists
CREATE INDEX IF NOT EXISTS idx_recommendations_scan_priority
ON backup_recommendations(scan_id, priority);

-- Add missing user_id foreign key index on servers if not exists
-- (Foreign keys should always have indexes for JOIN performance)
CREATE INDEX IF NOT EXISTS idx_servers_user_id
ON servers(user_id);

-- Comment on indexes for documentation
COMMENT ON INDEX idx_servers_user_online IS 'Optimizes server list queries filtered by online status';
COMMENT ON INDEX idx_scans_server_created IS 'Optimizes scan history queries ordered by date';
COMMENT ON INDEX idx_backups_server_status_created IS 'Optimizes backup queries with multiple filters';
