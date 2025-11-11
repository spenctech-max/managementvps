import { useEffect, useState } from 'react';
import api, { handleApiError } from '../lib/api';
import JobStats from '../components/JobStats';
import JobDetailsModal from '../components/JobDetailsModal';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Filter,
  Eye,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Job {
  id: string;
  queue: string;
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
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Filters
  const [filterQueue, setFilterQueue] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');

  useEffect(() => {
    fetchJobs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filterQueue, filterState, jobs]);

  const fetchJobs = async () => {
    try {
      const params: any = { limit: 200 };
      if (filterQueue !== 'all') params.queue = filterQueue;
      if (filterState !== 'all') params.state = filterState;

      const response = await api.get('/jobs', { params });
      const jobsData = response.data.data?.jobs || [];
      setJobs(jobsData);
      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...jobs];

    if (filterQueue !== 'all') {
      filtered = filtered.filter((j) => j.queue === filterQueue);
    }

    if (filterState !== 'all') {
      filtered = filtered.filter((j) => j.state === filterState);
    }

    setFilteredJobs(filtered);
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.post(`/jobs/${jobId}/retry`);
      toast.success('Job retry initiated');
      fetchJobs();
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await api.delete(`/jobs/${jobId}`);
      toast.success('Job cancelled successfully');
      fetchJobs();
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'active':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'waiting':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'completed':
        return 'bg-green-900/20 text-green-400 border-green-500/50';
      case 'failed':
        return 'bg-red-900/20 text-red-400 border-red-500/50';
      case 'active':
        return 'bg-blue-900/20 text-blue-400 border-blue-500/50';
      case 'waiting':
        return 'bg-yellow-900/20 text-yellow-400 border-yellow-500/50';
      default:
        return 'bg-gray-900/20 text-gray-400 border-gray-500/50';
    }
  };

  const getQueueColor = (queue: string) => {
    switch (queue) {
      case 'backup':
        return 'bg-purple-900/20 text-purple-400 border-purple-500/50';
      case 'scan':
        return 'bg-cyan-900/20 text-cyan-400 border-cyan-500/50';
      case 'update':
        return 'bg-orange-900/20 text-orange-400 border-orange-500/50';
      default:
        return 'bg-gray-900/20 text-gray-400 border-gray-500/50';
    }
  };

  const getProgressPercent = (progress: number | { percent?: number; [key: string]: any }): number => {
    if (typeof progress === 'number') return progress;
    if (typeof progress === 'object' && 'percent' in progress) {
      return progress.percent || 0;
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

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Job Queue</h1>
          <p className="text-slate-400">Monitor and manage background jobs</p>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <JobStats />

      {/* Filters */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Queue Type</label>
            <select
              value={filterQueue}
              onChange={(e) => setFilterQueue(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Queues</option>
              <option value="backup">Backup</option>
              <option value="scan">Scan</option>
              <option value="update">Update</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="waiting">Waiting</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/50">
          <h2 className="text-lg font-semibold text-white">
            Jobs ({filteredJobs.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4">
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Activity className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg">No jobs found</p>
            <p className="text-slate-500 text-sm mt-2">Jobs will appear here when created</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Queue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Server
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.state)}
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-lg border capitalize ${getStatusColor(job.state)}`}
                        >
                          {job.state}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-lg border capitalize ${getQueueColor(job.queue)}`}
                      >
                        {job.queue}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-300 capitalize">{job.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-300">
                        {job.data.serverName || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(job.state === 'active' || job.state === 'completed') && (
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 bg-slate-700/50 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
                              style={{ width: `${getProgressPercent(job.progress)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 min-w-[3ch]">
                            {getProgressPercent(job.progress)}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-400">
                        {formatDuration(job.processedOn, job.finishedOn)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-400">
                        {job.processedOn ? formatTimestamp(job.processedOn) : 'Waiting'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedJobId(job.id)}
                          className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {job.state === 'failed' && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="p-2 text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Retry Job"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {(job.state === 'waiting' || job.state === 'failed') && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove Job"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      {selectedJobId && (
        <JobDetailsModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onJobUpdated={fetchJobs}
        />
      )}
    </div>
  );
}
