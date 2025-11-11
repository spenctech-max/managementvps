import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Clock, Activity } from 'lucide-react';
import api, { handleApiError } from '../lib/api';

interface RestoreJobStatusProps {
  restoreJobId: string;
  showDetails?: boolean;
}

interface RestoreJob {
  id: string;
  backup_id: string;
  server_id: string;
  restore_type: string;
  status: 'pending' | 'preparing' | 'stopping_services' | 'verifying' | 'restoring' | 'restarting_services' | 'completed' | 'failed' | 'rolled_back';
  started_at: string;
  completed_at: string | null;
  progress_percentage: number;
  current_step: string | null;
  services_to_restore: string[];
  services_restored: string[];
  services_failed: string[];
  rollback_path: string | null;
  error_message: string | null;
  metadata: any;
}

export default function RestoreJobStatus({ restoreJobId, showDetails = true }: RestoreJobStatusProps) {
  const [job, setJob] = useState<RestoreJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJobStatus();
    const interval = setInterval(() => {
      if (job?.status && !['completed', 'failed', 'rolled_back'].includes(job.status)) {
        fetchJobStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [restoreJobId, job?.status]);

  const fetchJobStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/backups/restore-jobs/${restoreJobId}`);
      setJob(response.data.data);
      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'failed':
      case 'rolled_back':
        return <XCircle className="w-6 h-6 text-red-400" />;
      case 'pending':
      case 'preparing':
        return <Clock className="w-6 h-6 text-yellow-400" />;
      default:
        return <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-900/20 border-green-700 text-green-400';
      case 'failed':
      case 'rolled_back':
        return 'bg-red-900/20 border-red-700 text-red-400';
      case 'pending':
      case 'preparing':
        return 'bg-yellow-900/20 border-yellow-700 text-yellow-400';
      default:
        return 'bg-blue-900/20 border-blue-700 text-blue-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'preparing':
        return 'Preparing';
      case 'stopping_services':
        return 'Stopping Services';
      case 'verifying':
        return 'Verifying Backup';
      case 'restoring':
        return 'Restoring Data';
      case 'restarting_services':
        return 'Restarting Services';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'rolled_back':
        return 'Rolled Back';
      default:
        return status;
    }
  };

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const durationSeconds = Math.floor((end - start) / 1000);

    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  if (loading && !job) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
        <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
        <p className="text-sm text-slate-400">Restore job not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className={`border rounded-lg p-6 ${getStatusColor(job.status)}`}>
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            {getStatusIcon(job.status)}
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-white">
              {getStatusText(job.status)}
            </h4>
            {job.current_step && (
              <p className="text-sm mt-1 opacity-90">
                {job.current_step}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {job.progress_percentage}%
            </div>
            <div className="text-xs opacity-90 mt-1">
              Progress
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 bg-slate-900 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              job.status === 'completed'
                ? 'bg-green-400'
                : job.status === 'failed' || job.status === 'rolled_back'
                ? 'bg-red-400'
                : 'bg-blue-400'
            }`}
            style={{ width: `${job.progress_percentage}%` }}
          />
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-slate-400 mb-1">Restore Type</div>
              <div className="text-white font-medium capitalize">{job.restore_type}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">Duration</div>
              <div className="text-white font-medium">
                {formatDuration(job.started_at, job.completed_at)}
              </div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">Services to Restore</div>
              <div className="text-white font-medium">{job.services_to_restore?.length || 0}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">Started At</div>
              <div className="text-white font-medium">
                {new Date(job.started_at).toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Services Progress */}
          {(job.services_restored.length > 0 || job.services_failed.length > 0) && (
            <div className="border-t border-slate-700 pt-4">
              <div className="flex items-center mb-3">
                <Activity className="w-4 h-4 text-slate-400 mr-2" />
                <h5 className="text-sm font-medium text-white">Service Status</h5>
              </div>
              <div className="space-y-2">
                {job.services_restored.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Restored</span>
                    <span className="text-green-400 font-medium">
                      {job.services_restored.length} services
                    </span>
                  </div>
                )}
                {job.services_failed.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Failed</span>
                    <span className="text-red-400 font-medium">
                      {job.services_failed.length} services
                    </span>
                  </div>
                )}
              </div>

              {/* Failed Services List */}
              {job.services_failed.length > 0 && (
                <div className="mt-3 bg-slate-900 rounded p-3">
                  <div className="text-xs font-medium text-slate-400 mb-2">Failed Services:</div>
                  <div className="text-xs text-slate-300 space-y-1">
                    {job.services_failed.map((service, idx) => (
                      <div key={idx} className="flex items-center">
                        <XCircle className="w-3 h-3 text-red-400 mr-2" />
                        {service}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Restored Services List */}
              {job.services_restored.length > 0 && showDetails && (
                <div className="mt-3 bg-slate-900 rounded p-3">
                  <div className="text-xs font-medium text-slate-400 mb-2">Restored Services:</div>
                  <div className="text-xs text-slate-300 space-y-1">
                    {job.services_restored.map((service, idx) => (
                      <div key={idx} className="flex items-center">
                        <CheckCircle className="w-3 h-3 text-green-400 mr-2" />
                        {service}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {job.error_message && (
            <div className="border-t border-slate-700 pt-4">
              <div className="bg-red-900/20 border border-red-700 rounded p-3">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-red-300">{job.error_message}</div>
                </div>
              </div>
            </div>
          )}

          {/* Rollback Info */}
          {job.rollback_path && (
            <div className="border-t border-slate-700 pt-4">
              <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
                <div className="text-xs text-blue-300">
                  <span className="font-medium">Rollback Point:</span> {job.rollback_path}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
