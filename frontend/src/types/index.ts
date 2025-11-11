// User types
export interface User {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  role: 'admin' | 'user' | 'viewer';
  created_at: string;
  updated_at?: string;
}

// Auth types
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

// Server types
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

// Scan types
export interface Scan {
  id: string;
  server_id: string;
  scan_type: 'quick' | 'full' | 'services' | 'filesystems';
  status: 'pending' | 'running' | 'completed' | 'failed';
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

// Service types
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

// Filesystem types
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

// Backup recommendation types
export interface BackupRecommendation {
  id: string;
  recommendation_type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
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

// API Response types
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
