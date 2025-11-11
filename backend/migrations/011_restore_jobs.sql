-- Restore Jobs Table Migration
-- Tracks backup restore operations with progress and rollback support

-- Restore jobs table
CREATE TABLE restore_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_id UUID REFERENCES backups(id) ON DELETE CASCADE NOT NULL,
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    restore_type VARCHAR(50) NOT NULL CHECK (restore_type IN ('full', 'selective')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'preparing', 'stopping_services', 'verifying', 'restoring', 'restarting_services', 'completed', 'failed', 'rolled_back')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    current_step VARCHAR(255),
    services_to_restore TEXT[], -- Array of service names to restore
    services_restored TEXT[], -- Array of successfully restored services
    services_failed TEXT[], -- Array of failed services
    rollback_path TEXT, -- Path to pre-restore backup for rollback
    error_message TEXT,
    metadata JSONB, -- Additional restore options and details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for restore jobs
CREATE INDEX idx_restore_jobs_backup_id ON restore_jobs(backup_id);
CREATE INDEX idx_restore_jobs_server_id ON restore_jobs(server_id);
CREATE INDEX idx_restore_jobs_user_id ON restore_jobs(user_id);
CREATE INDEX idx_restore_jobs_status ON restore_jobs(status);
CREATE INDEX idx_restore_jobs_created_at ON restore_jobs(created_at DESC);

-- Restore audit logs table (detailed step-by-step logging)
CREATE TABLE restore_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restore_job_id UUID REFERENCES restore_jobs(id) ON DELETE CASCADE NOT NULL,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
    message TEXT,
    details JSONB,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for restore audit logs
CREATE INDEX idx_restore_audit_logs_restore_job_id ON restore_audit_logs(restore_job_id);
CREATE INDEX idx_restore_audit_logs_created_at ON restore_audit_logs(created_at DESC);

-- Comments
COMMENT ON TABLE restore_jobs IS 'Tracks backup restore operations with progress tracking and rollback capability';
COMMENT ON TABLE restore_audit_logs IS 'Detailed step-by-step audit log for restore operations';
COMMENT ON COLUMN restore_jobs.rollback_path IS 'Path to pre-restore snapshot for automatic rollback on failure';
COMMENT ON COLUMN restore_jobs.metadata IS 'Contains selective restore options, verification checksums, etc';
