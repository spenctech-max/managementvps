-- Medicine Man Database Schema
-- Initial Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Servers table
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    port INTEGER DEFAULT 22,
    username VARCHAR(255) NOT NULL,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('password', 'key')),
    credential TEXT NOT NULL, -- Encrypted
    tags TEXT,
    description TEXT,
    is_online BOOLEAN DEFAULT false,
    last_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Server scans table
CREATE TABLE server_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN ('quick', 'full', 'services', 'filesystems')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    scan_duration INTEGER, -- seconds
    scan_summary JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Detected services table
CREATE TABLE detected_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES server_scans(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    status VARCHAR(50),
    process_id INTEGER,
    port_bindings TEXT[], -- Array of ports
    config_paths TEXT[], -- Array of config file paths
    data_paths TEXT[], -- Array of data directory paths
    log_paths TEXT[], -- Array of log file paths
    service_details JSONB,
    backup_priority INTEGER DEFAULT 5 CHECK (backup_priority BETWEEN 1 AND 10),
    backup_strategy VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Detected filesystems table
CREATE TABLE detected_filesystems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES server_scans(id) ON DELETE CASCADE,
    mount_point VARCHAR(500) NOT NULL,
    device_name VARCHAR(255),
    filesystem_type VARCHAR(50),
    total_size BIGINT, -- bytes
    used_size BIGINT, -- bytes
    available_size BIGINT, -- bytes
    usage_percentage DECIMAL(5,2),
    is_system_drive BOOLEAN DEFAULT false,
    contains_data BOOLEAN DEFAULT false,
    backup_recommended BOOLEAN DEFAULT false,
    backup_priority INTEGER DEFAULT 5 CHECK (backup_priority BETWEEN 1 AND 10),
    estimated_backup_size BIGINT, -- bytes
    exclusion_patterns TEXT[], -- Array of exclusion patterns
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup recommendations table
CREATE TABLE backup_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES server_scans(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(100) NOT NULL CHECK (recommendation_type IN ('service', 'database', 'filesystem', 'application')),
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    backup_paths TEXT[], -- Array of paths to backup
    exclusion_patterns TEXT[], -- Array of exclusion patterns
    estimated_size BIGINT, -- bytes
    backup_frequency VARCHAR(50), -- daily, weekly, monthly
    retention_period VARCHAR(50), -- 7d, 30d, 90d, 1y
    backup_method VARCHAR(100), -- tar_archive, database_dump, docker_backup, etc.
    implementation_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backups table
CREATE TABLE backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential', 'home', 'config', 'database')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    file_size BIGINT, -- bytes
    file_path TEXT,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User activity logs table
CREATE TABLE user_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_servers_name ON servers(name);
CREATE INDEX idx_servers_is_online ON servers(is_online);
CREATE INDEX idx_server_scans_server_id ON server_scans(server_id);
CREATE INDEX idx_server_scans_status ON server_scans(status);
CREATE INDEX idx_server_scans_created_at ON server_scans(created_at DESC);
CREATE INDEX idx_detected_services_scan_id ON detected_services(scan_id);
CREATE INDEX idx_detected_filesystems_scan_id ON detected_filesystems(scan_id);
CREATE INDEX idx_backup_recommendations_scan_id ON backup_recommendations(scan_id);
CREATE INDEX idx_backups_server_id ON backups(server_id);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
