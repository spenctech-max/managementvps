import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { handleApiError } from '../lib/api';
import {
  Server,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Database,
  Container,
  HardDrive,
  Globe,
  Code,
  Zap,
  AlertTriangle,
  Info,
  CheckCircle2,
  FolderTree,
  Package,
  Activity
} from 'lucide-react';

interface ScanDetail {
  scan: {
    id: string;
    server_id: string;
    scan_type: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    started_at: string;
    completed_at: string;
    scan_duration: number;
    summary: {
      services_count?: number;
      critical_services?: number;
      filesystems_count?: number;
      total_estimated_size?: number;
      recommendations_count?: number;
      critical_recommendations?: number;
    } | null;
    error_message: string | null;
    created_at: string;
  };
  services: Array<{
    id: string;
    service_name: string;
    service_type: string;
    status: string;
    process_id: number | null;
    port_bindings: string[] | null;
    config_paths: string[] | null;
    data_paths: string[] | null;
    log_paths: string[] | null;
    service_details: any;
    backup_priority: string;
    backup_strategy: string | null;
  }>;
  filesystems: Array<{
    id: string;
    mount_point: string;
    device_name: string;
    filesystem_type: string;
    total_size: number;
    used_size: number;
    available_size: number;
    usage_percentage: number;
    is_system_drive: boolean;
    contains_data: boolean;
    backup_recommended: boolean;
    backup_priority: string;
    estimated_backup_size: number;
    exclusion_patterns: string[] | null;
  }>;
  recommendations: Array<{
    id: string;
    recommendation_type: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    backup_paths: string[] | null;
    exclusion_patterns: string[] | null;
    estimated_size: number;
    backup_frequency: string | null;
    retention_period: string | null;
    backup_method: string | null;
    implementation_notes: string | null;
  }>;
}

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scanDetail, setScanDetail] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchScanDetail();
    }
  }, [id]);

  const fetchScanDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/scans/${id}`);
      setScanDetail(response.data.data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-900/20 text-green-400 border-green-700';
      case 'failed':
        return 'bg-red-900/20 text-red-400 border-red-700';
      case 'running':
        return 'bg-blue-900/20 text-blue-400 border-blue-700';
      default:
        return 'bg-yellow-900/20 text-yellow-400 border-yellow-700';
    }
  };

  const getServiceIcon = (serviceType: string) => {
    const type = serviceType.toLowerCase();
    if (type.includes('docker')) return <Container className="w-5 h-5" />;
    if (type.includes('database') || type.includes('postgres') || type.includes('mysql') || type.includes('mongo') || type.includes('redis')) {
      return <Database className="w-5 h-5" />;
    }
    if (type.includes('web') || type.includes('nginx') || type.includes('apache')) {
      return <Globe className="w-5 h-5" />;
    }
    if (type.includes('node') || type.includes('application')) {
      return <Code className="w-5 h-5" />;
    }
    return <Activity className="w-5 h-5" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-red-900/30 text-red-400 border-red-700';
      case 'high':
        return 'bg-orange-900/30 text-orange-400 border-orange-700';
      case 'medium':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
      default:
        return 'bg-blue-900/30 text-blue-400 border-blue-700';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'high':
        return <AlertCircle className="w-4 h-4" />;
      case 'medium':
        return <Info className="w-4 h-4" />;
      default:
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !scanDetail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/scans')}
            className="inline-flex items-center px-4 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Scans
          </button>
        </div>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
          <p className="text-sm text-red-400">{error || 'Scan not found'}</p>
        </div>
      </div>
    );
  }

  const { scan, services, filesystems, recommendations } = scanDetail;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/scans')}
            className="inline-flex items-center px-4 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Scan Details</h1>
            <p className="mt-1 text-sm text-slate-400">Detailed scan results and analysis</p>
          </div>
        </div>
        <button
          onClick={fetchScanDetail}
          className="inline-flex items-center px-4 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Scan Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Scan Overview</h2>
          <div className={`inline-flex items-center px-3 py-1 rounded border ${getStatusColor(scan.status)}`}>
            {getStatusIcon(scan.status)}
            <span className="ml-2 text-sm font-medium capitalize">{scan.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center text-slate-400 text-sm mb-2">
              <Server className="w-4 h-4 mr-2" />
              Scan Type
            </div>
            <p className="text-lg font-semibold text-white capitalize">{scan.scan_type}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center text-slate-400 text-sm mb-2">
              <Clock className="w-4 h-4 mr-2" />
              Duration
            </div>
            <p className="text-lg font-semibold text-white">{formatDuration(scan.scan_duration)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center text-slate-400 text-sm mb-2">
              <Clock className="w-4 h-4 mr-2" />
              Started At
            </div>
            <p className="text-sm font-semibold text-white">{new Date(scan.started_at).toLocaleString()}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center text-slate-400 text-sm mb-2">
              <CheckCircle className="w-4 h-4 mr-2" />
              Completed At
            </div>
            <p className="text-sm font-semibold text-white">
              {scan.completed_at ? new Date(scan.completed_at).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        {scan.summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-400 mb-1">Services Detected</p>
              <p className="text-2xl font-bold text-white">{scan.summary.services_count || 0}</p>
              {scan.summary.critical_services ? (
                <p className="text-xs text-orange-400 mt-1">{scan.summary.critical_services} critical</p>
              ) : null}
            </div>
            <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
              <p className="text-sm text-purple-400 mb-1">Filesystems</p>
              <p className="text-2xl font-bold text-white">{scan.summary.filesystems_count || 0}</p>
              {scan.summary.total_estimated_size ? (
                <p className="text-xs text-slate-400 mt-1">{formatBytes(scan.summary.total_estimated_size)} total</p>
              ) : null}
            </div>
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
              <p className="text-sm text-green-400 mb-1">Recommendations</p>
              <p className="text-2xl font-bold text-white">{scan.summary.recommendations_count || 0}</p>
              {scan.summary.critical_recommendations ? (
                <p className="text-xs text-red-400 mt-1">{scan.summary.critical_recommendations} critical</p>
              ) : null}
            </div>
          </div>
        )}

        {scan.error_message && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mt-4">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-sm font-medium text-red-400">Error</span>
            </div>
            <p className="text-sm text-red-300 mt-2">{scan.error_message}</p>
          </div>
        )}
      </div>

      {/* Detected Services */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Activity className="w-5 h-5 text-blue-400 mr-2" />
          <h2 className="text-xl font-semibold text-white">Detected Services</h2>
          <span className="ml-2 px-2 py-1 bg-slate-800 text-slate-300 rounded text-sm">{services.length}</span>
        </div>

        {services.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ports</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Backup Strategy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {services.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {getServiceIcon(service.service_type)}
                        <span className="ml-2 text-sm font-medium text-white">{service.service_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded">
                        {service.service_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-slate-300">{service.status || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-slate-300">
                        {service.port_bindings && service.port_bindings.length > 0
                          ? service.port_bindings.join(', ')
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(service.backup_priority)}`}>
                        {service.backup_priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-slate-300">{service.backup_strategy || 'N/A'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">No services detected</p>
          </div>
        )}
      </div>

      {/* Filesystems */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <HardDrive className="w-5 h-5 text-purple-400 mr-2" />
          <h2 className="text-xl font-semibold text-white">Filesystems</h2>
          <span className="ml-2 px-2 py-1 bg-slate-800 text-slate-300 rounded text-sm">{filesystems.length}</span>
        </div>

        {filesystems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Mount Point</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Total Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Used</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Available</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Backup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filesystems.map((fs) => (
                  <tr key={fs.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <FolderTree className="w-4 h-4 text-slate-400 mr-2" />
                        <span className="text-sm font-medium text-white">{fs.mount_point}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded">
                        {fs.filesystem_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {formatBytes(fs.total_size)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {formatBytes(fs.used_size)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {formatBytes(fs.available_size)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              fs.usage_percentage > 90
                                ? 'bg-red-500'
                                : fs.usage_percentage > 75
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(fs.usage_percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-300">{fs.usage_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fs.backup_recommended ? (
                        <div className="flex flex-col">
                          <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(fs.backup_priority)}`}>
                            {fs.backup_priority}
                          </span>
                          {fs.estimated_backup_size > 0 && (
                            <span className="text-xs text-slate-500 mt-1">~{formatBytes(fs.estimated_backup_size)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Not recommended</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <HardDrive className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">No filesystems detected</p>
          </div>
        )}
      </div>

      {/* Backup Recommendations */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Zap className="w-5 h-5 text-green-400 mr-2" />
          <h2 className="text-xl font-semibold text-white">Backup Recommendations</h2>
          <span className="ml-2 px-2 py-1 bg-slate-800 text-slate-300 rounded text-sm">{recommendations.length}</span>
        </div>

        {recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getPriorityIcon(rec.priority)}
                      <h3 className="text-lg font-semibold">{rec.title}</h3>
                      <span className="px-2 py-1 text-xs rounded border uppercase">
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-sm mb-3">{rec.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {rec.recommendation_type && (
                        <div>
                          <span className="text-slate-400">Type:</span>
                          <span className="ml-2 px-2 py-0.5 bg-slate-800 rounded text-xs">{rec.recommendation_type}</span>
                        </div>
                      )}
                      {rec.backup_frequency && (
                        <div>
                          <span className="text-slate-400">Frequency:</span>
                          <span className="ml-2">{rec.backup_frequency}</span>
                        </div>
                      )}
                      {rec.retention_period && (
                        <div>
                          <span className="text-slate-400">Retention:</span>
                          <span className="ml-2">{rec.retention_period}</span>
                        </div>
                      )}
                      {rec.backup_method && (
                        <div>
                          <span className="text-slate-400">Method:</span>
                          <span className="ml-2">{rec.backup_method}</span>
                        </div>
                      )}
                      {rec.estimated_size > 0 && (
                        <div>
                          <span className="text-slate-400">Estimated Size:</span>
                          <span className="ml-2">{formatBytes(rec.estimated_size)}</span>
                        </div>
                      )}
                    </div>

                    {rec.backup_paths && rec.backup_paths.length > 0 && (
                      <div className="mt-3">
                        <span className="text-slate-400 text-sm">Backup Paths:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {rec.backup_paths.map((path, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-slate-800 rounded text-xs font-mono">
                              {path}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {rec.implementation_notes && (
                      <div className="mt-3 p-3 bg-slate-800/50 rounded">
                        <span className="text-slate-400 text-sm">Implementation Notes:</span>
                        <p className="text-sm mt-1">{rec.implementation_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">No recommendations available</p>
          </div>
        )}
      </div>
    </div>
  );
}
