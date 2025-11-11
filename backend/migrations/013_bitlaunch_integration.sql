-- Migration 013: Bitlaunch Integration
-- Adds tables for Bitlaunch API credentials, cached data, and synchronization tracking

-- ============================================================================
-- BITLAUNCH SETTINGS TABLE
-- ============================================================================

-- Table for storing Bitlaunch configuration and state
-- Encrypted API keys are stored using AES-256-GCM with salt and auth tag
CREATE TABLE IF NOT EXISTS bitlaunch_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(255) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE bitlaunch_settings IS
'Stores Bitlaunch API configuration, last sync time, and error tracking. API keys are encrypted.';

COMMENT ON COLUMN bitlaunch_settings.setting_key IS
'Key identifier: api_key (encrypted), last_sync (ISO 8601), last_error (error message)';

COMMENT ON COLUMN bitlaunch_settings.setting_value IS
'Encrypted value for api_key (format: salt:iv:authTag:encrypted), or plain text for timestamps/errors';

-- Index for fast lookups by setting key
CREATE INDEX IF NOT EXISTS idx_bitlaunch_settings_key
ON bitlaunch_settings(setting_key);

COMMENT ON INDEX idx_bitlaunch_settings_key IS
'Fast lookup of specific Bitlaunch settings by key';

-- ============================================================================
-- BITLAUNCH CACHE TABLES
-- ============================================================================

-- Table for caching Bitlaunch billing information
CREATE TABLE IF NOT EXISTS bitlaunch_billing_cache (
    id SERIAL PRIMARY KEY,
    account_balance DECIMAL(15, 2) NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'USD',
    current_month_usage DECIMAL(15, 2),
    current_month_estimated_cost DECIMAL(15, 2),
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes')
);

COMMENT ON TABLE bitlaunch_billing_cache IS
'Caches Bitlaunch account billing information with 5-minute TTL to reduce API calls';

-- Index for finding valid cache entries (order by expires_at for cleanup)
CREATE INDEX IF NOT EXISTS idx_bitlaunch_billing_cache_expires
ON bitlaunch_billing_cache(expires_at);

COMMENT ON INDEX idx_bitlaunch_billing_cache_expires IS
'Index for finding and cleaning up expired billing cache entries';

-- Table for caching Bitlaunch performance metrics
CREATE TABLE IF NOT EXISTS bitlaunch_metrics_cache (
    id SERIAL PRIMARY KEY,
    server_count INTEGER NOT NULL DEFAULT 0,
    total_uptime DECIMAL(5, 2) NOT NULL DEFAULT 0,
    avg_cpu_usage DECIMAL(5, 2) NOT NULL DEFAULT 0,
    avg_memory_usage DECIMAL(5, 2) NOT NULL DEFAULT 0,
    avg_network_traffic DECIMAL(15, 2) NOT NULL DEFAULT 0,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes')
);

COMMENT ON TABLE bitlaunch_metrics_cache IS
'Caches Bitlaunch performance metrics with 5-minute TTL to reduce API calls';

-- Index for finding valid cache entries (order by expires_at for cleanup)
CREATE INDEX IF NOT EXISTS idx_bitlaunch_metrics_cache_expires
ON bitlaunch_metrics_cache(expires_at);

COMMENT ON INDEX idx_bitlaunch_metrics_cache_expires IS
'Index for finding and cleaning up expired metrics cache entries';

-- ============================================================================
-- BITLAUNCH AUDIT TABLE
-- ============================================================================

-- Table for auditing Bitlaunch API interactions and sync events
CREATE TABLE IF NOT EXISTS bitlaunch_audit (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_description TEXT,
    api_endpoint VARCHAR(255),
    request_status INTEGER,
    error_message TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE bitlaunch_audit IS
'Audit trail for all Bitlaunch API interactions, connection tests, and sync events';

COMMENT ON COLUMN bitlaunch_audit.event_type IS
'Type of event: api_call, sync_success, sync_failure, connection_test, api_key_update, api_key_removed';

-- Index for querying audit by event type
CREATE INDEX IF NOT EXISTS idx_bitlaunch_audit_event_type
ON bitlaunch_audit(event_type, created_at DESC);

COMMENT ON INDEX idx_bitlaunch_audit_event_type IS
'Index for filtering audit events by type and chronological order';

-- Index for user's Bitlaunch interactions
CREATE INDEX IF NOT EXISTS idx_bitlaunch_audit_user
ON bitlaunch_audit(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_bitlaunch_audit_user IS
'Partial index for tracking user-specific Bitlaunch interactions';

-- Index for recent audit events (cleanup and monitoring)
CREATE INDEX IF NOT EXISTS idx_bitlaunch_audit_created
ON bitlaunch_audit(created_at DESC);

COMMENT ON INDEX idx_bitlaunch_audit_created IS
'Index for finding recent Bitlaunch audit events for monitoring and cleanup';

-- ============================================================================
-- CLEANUP FUNCTIONS AND MAINTENANCE
-- ============================================================================

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_bitlaunch_cache()
RETURNS TABLE(billing_deleted INT, metrics_deleted INT) AS $$
DECLARE
    billing_count INT;
    metrics_count INT;
BEGIN
    DELETE FROM bitlaunch_billing_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS billing_count = ROW_COUNT;

    DELETE FROM bitlaunch_metrics_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS metrics_count = ROW_COUNT;

    RETURN QUERY SELECT billing_count, metrics_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_bitlaunch_cache() IS
'Removes expired Bitlaunch cache entries. Called periodically for maintenance.';

-- Function to clean up old audit entries (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_bitlaunch_audit()
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM bitlaunch_audit
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_bitlaunch_audit() IS
'Removes Bitlaunch audit entries older than 90 days to manage table size.';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Ensure bitlaunch_settings table has default empty state
-- (API key will be added when user configures Bitlaunch)

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
--
-- Setup Instructions:
-- 1. Users configure Bitlaunch API key through the Settings UI
-- 2. API key is encrypted using AES-256-GCM and stored in bitlaunch_settings
-- 3. Background job syncs data every 5 minutes if API key is configured
-- 4. Billing and metrics data cached with 5-minute TTL to reduce API calls
-- 5. All API interactions logged to bitlaunch_audit for transparency
--
-- Maintenance:
-- - Run cleanup_bitlaunch_cache() regularly (e.g., every hour)
-- - Run cleanup_bitlaunch_audit() regularly (e.g., daily) to maintain table size
-- - Monitor bitlaunch_audit for repeated connection failures
--
-- Security Considerations:
-- - API keys encrypted at rest using AES-256-GCM
-- - Encryption uses PBKDF2 with salt for key derivation
-- - All API calls include authentication bearer token
-- - Audit trail maintains all API interactions for compliance
--

-- Migration complete
