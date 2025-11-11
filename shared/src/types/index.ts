/**
 * Shared Type Definitions
 * Common types used across backend and frontend
 */

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  role: 'admin' | 'user' | 'viewer';
  created_at: string;
  updated_at?: string;
}

export type UserRole = 'admin' | 'user' | 'viewer';

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

// ============================================================================
// SERVER TYPES
// ============================================================================

export interface Server {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  tags?: string;
  description?: string;
  is_online: boolean;
  created_at: string;
  updated_at: string;
}

export type AuthType = 'password' | 'key';

// ============================================================================
// SCAN TYPES
// ============================================================================

export type ScanType = 'quick' | 'full' | 'services' | 'filesystems';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Scan {
  id: string;
  server_id: string;
  scan_type: ScanType;
  status: ScanStatus;
  started_at: string;
  completed_at?: string;
  scan_duration?: number;
  summary?: {
    services_count: number;
    filesystems_count: number;
    recommendations_count: number;
  };
  error_message?: string;
  created_at: string;
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface DetectedService {
  id: string;
  service_name: string;
  service_type: string;
  status: string;
  process_id?: number;
  port_bindings: string[];
  config_paths: string[];
  data_paths: string[];
  log_paths: string[];
  service_details: Record<string, any>;
  backup_priority: number;
  backup_strategy: string;
  created_at: string;
}

// ============================================================================
// FILESYSTEM TYPES
// ============================================================================

export interface DetectedFilesystem {
  id: string;
  mount_point: string;
  device_name?: string;
  filesystem_type: string;
  total_size: number;
  used_size: number;
  available_size: number;
  usage_percentage: number;
  is_system_drive: boolean;
  contains_data: boolean;
  backup_recommended: boolean;
  backup_priority: number;
  estimated_backup_size: number;
  exclusion_patterns: string[];
  created_at: string;
}

// ============================================================================
// BACKUP TYPES
// ============================================================================

export type BackupType = 'full' | 'incremental' | 'differential' | 'home' | 'config' | 'database';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'verified';
export type BackupPriority = 'critical' | 'high' | 'medium' | 'low';

export interface BackupRecommendation {
  id: string;
  recommendation_type: string;
  priority: BackupPriority;
  title: string;
  description: string;
  backup_paths: string[];
  exclusion_patterns: string[];
  estimated_size: number;
  backup_frequency: string;
  retention_period: string;
  backup_method: string;
  implementation_notes?: string;
  created_at: string;
}

export interface BackupSchedule {
  id: string;
  backup_id: string;
  cron_expression: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface BaseResponse {
  success: boolean;
  message?: string;
}

export interface SuccessResponse<T = any> extends BaseResponse {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

export interface ErrorResponse extends BaseResponse {
  success: false;
  error: {
    code?: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T = any> extends SuccessResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Legacy API response types (for compatibility)
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  count?: number;
}

export interface ApiError {
  success: false;
  message: string;
  stack?: string;
}

// ============================================================================
// JOB & QUEUE TYPES
// ============================================================================

export type JobType = 'backup' | 'scan' | 'restore' | 'health_check';
export type JobStatus = 'pending' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

export interface JobProgress {
  progress: number;
  total: number;
  message?: string;
  status: JobStatus;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

export interface ServerHealth {
  id: string;
  status: HealthStatus;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  uptime?: number;
  last_check: string;
  created_at: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationType = 'backup_completed' | 'backup_failed' | 'server_down' | 'health_alert';
export type NotificationMethod = 'email' | 'webhook' | 'sms';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  method: NotificationMethod;
  message: string;
  read: boolean;
  created_at: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ExportFormat = 'csv' | 'json' | 'pdf';

// ============================================================================
// BITLAUNCH TYPES
// ============================================================================

export interface BitlaunchServer {
  id: string;
  external_id: string;
  name: string;
  ip: string;
  status: 'active' | 'suspended' | 'terminated';
  created_at: string;
  synced_at: string;
}
