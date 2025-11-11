import { useEffect, useState } from 'react';
import api, { handleApiError } from '../lib/api';
import {
  X,
  Server,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  RotateCcw,
  StopCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface JobDetailsModalProps {
  jobId: string;
  onClose: () => void;
  onJobUpdated?: () => void;
}

interface JobDetails {
  id: string;
  name: string;
  data: {
    serverId?: string;
    serverName?: string;
    backupType?: string;
    scanType?: string;
    [key: string]: any;
  };
  state: string;
  progress: number | { percent?: number; [key: string]: any };
  attempts: number;
  maxAttempts: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  result?: any;
}

export default function JobDetailsModal({ jobId, onClose, onJobUpdated }: JobDetailsModalProps) {
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchJobDetails();
    // Auto-refresh every 3 seconds for active jobs
    const interval = setInterval(() => {
      if (job?.state === 'active' || job?.state === 'waiting') {
        fetchJobDetails();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId, job?.state]);

  const fetchJobDetails = async () => {
    try {
      const response = await api.get(`/jobs/${jobId}`);
      setJob(response.data.data);
      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!job) return;

    try {
      setActionLoading(true);
      await api.post(`/jobs/${jobId}/retry`);
      toast.success('Job retry initiated');
      fetchJobDetails();
      onJobUpdated?.();
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!job) return;

    try {
      setActionLoading(true);
      await api.delete(`/jobs/${jobId}`);
      toast.success('Job cancelled successfully');
      onJobUpdated?.();
      onClose();
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-400" />;
      case 'active':
        return <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />;
      case 'waiting':
        return <Clock className="w-6 h-6 text-yellow-400" />;
      default:
        return <AlertCircle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'active':
        return 'text-blue-400';
      case 'waiting':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getProgressPercent = (): number => {
    if (!job?.progress) return 0;
    if (typeof job.progress === 'number') return job.progress;
    if (typeof job.progress === 'object' && 'percent' in job.progress) {
      return job.progress.percent || 0;
    }
    return 0;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start?: number, end?: number) => {
    if (!start) return 'N/A';
    const endTime = end || Date.now();
    const duration = Math.floor((endTime - start) / 1000);

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const canRetry = job?.state === 'failed';
  const canCancel = job?.state === 'active' || job?.state === 'waiting';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Job Details</h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4">
                <p className="text-red-400">{error}</p>
              </div>
            ) : job ? (
              <div className="space-y-6">
                {/* Status Overview */}
                <div className="bg-slate-800/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.state)}
                      <div>
                        <div className="text-sm text-slate-400">Status</div>
                        <div className={`text-lg font-semibold capitalize ${getStatusColor(job.state)}`}>
                          {job.state}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">Job ID</div>
                      <div className="text-sm font-mono text-slate-300">{job.id}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {(job.state === 'active' || job.state === 'completed') && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Progress</span>
                        <span className="text-sm font-medium text-white">{getProgressPercent()}%</span>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
                          style={{ width: `${getProgressPercent()}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Job Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-400">Job Type</span>
                    </div>
                    <div className="text-white font-medium capitalize">{job.name}</div>
                  </div>

                  {job.data.serverName && (
                    <div className="bg-slate-800/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Server className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-400">Server</span>
                      </div>
                      <div className="text-white font-medium">{job.data.serverName}</div>
                    </div>
                  )}

                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-400">Started At</span>
                    </div>
                    <div className="text-white text-sm">
                      {job.processedOn ? formatTimestamp(job.processedOn) : 'Not started'}
                    </div>
                  </div>

                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-400">Duration</span>
                    </div>
                    <div className="text-white font-medium">
                      {formatDuration(job.processedOn, job.finishedOn)}
                    </div>
                  </div>

                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-400">Attempts</span>
                    </div>
                    <div className="text-white font-medium">
                      {job.attempts} / {job.maxAttempts}
                    </div>
                  </div>

                  {job.finishedOn && (
                    <div className="bg-slate-800/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-400">Completed At</span>
                      </div>
                      <div className="text-white text-sm">{formatTimestamp(job.finishedOn)}</div>
                    </div>
                  )}
                </div>

                {/* Job Data */}
                {Object.keys(job.data).length > 0 && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Job Data</h3>
                    <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                      <pre>{JSON.stringify(job.data, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {job.failedReason && (
                  <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium text-red-400 mb-2">Error Message</h3>
                        <p className="text-red-300 text-sm">{job.failedReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result */}
                {job.result && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Result</h3>
                    <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                      <pre>{JSON.stringify(job.result, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">Job not found</div>
            )}
          </div>

          {/* Footer */}
          {job && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Close
              </button>
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <StopCircle className="w-4 h-4" />
                  )}
                  Cancel Job
                </button>
              )}
              {canRetry && (
                <button
                  onClick={handleRetry}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Retry Job
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
