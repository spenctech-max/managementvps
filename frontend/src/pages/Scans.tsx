import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { handleApiError } from '../lib/api';
import {
  ScanLine,
  Server,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Filter,
  PlayCircle,
  Eye,
  GitCompare
} from 'lucide-react';

interface Scan {
  id: string;
  server_id: string;
  server_name: string;
  server_ip: string;
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
}

interface Server {
  id: string;
  name: string;
  ip: string;
}

export default function Scans() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [filteredScans, setFilteredScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterServer, setFilterServer] = useState<string>('all');
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [scanType, setScanType] = useState<string>('full');
  const [initiating, setInitiating] = useState(false);
  const [selectedScans, setSelectedScans] = useState<string[]>([]);

  useEffect(() => {
    fetchScans();
    fetchServers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filterStatus, filterServer, scans]);

  const fetchScans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/scans?limit=50');
      const scanData = response.data.data?.items || [];
      setScans(scanData);

      // Extract unique server names for filter
      const uniqueServers = [...new Set(scanData.map((s: Scan) => s.server_name))] as string[];
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    try {
      const response = await api.get('/servers');
      setServers(response.data.data?.items || []);
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...scans];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    if (filterServer !== 'all') {
      filtered = filtered.filter(s => s.server_name === filterServer);
    }

    setFilteredScans(filtered);
  };

  const handleInitiateScan = async () => {
    if (!selectedServerId) {
      setError('Please select a server');
      return;
    }

    try {
      setInitiating(true);
      setError('');
      await api.post(`/servers/${selectedServerId}/scan`, { scan_type: scanType });
      setShowScanModal(false);
      setSelectedServerId('');
      setScanType('full');

      // Wait a moment then refresh
      setTimeout(() => {
        fetchScans();
      }, 1000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setInitiating(false);
    }
  };

  const handleViewDetails = (scanId: string) => {
    navigate(`/scans/${scanId}`);
  };

  const handleCompareScan = (scanId: string) => {
    if (selectedScans.includes(scanId)) {
      setSelectedScans(selectedScans.filter(id => id !== scanId));
    } else if (selectedScans.length < 2) {
      setSelectedScans([...selectedScans, scanId]);
    }
  };

  const handleCompareSelected = () => {
    if (selectedScans.length === 2) {
      navigate(`/scan-comparison?scanIds=${selectedScans[0]}&scanIds=${selectedScans[1]}`);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
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

  const stats = {
    total: scans.length,
    completed: scans.filter(s => s.status === 'completed').length,
    failed: scans.filter(s => s.status === 'failed').length,
    running: scans.filter(s => s.status === 'running').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Server Scans</h1>
          <p className="mt-1 text-sm text-slate-400">View scan history and initiate new scans</p>
        </div>
        <div className="flex space-x-3">
          {selectedScans.length === 2 && (
            <button
              onClick={handleCompareSelected}
              className="inline-flex items-center px-4 py-2 border border-purple-600 shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Compare Selected
            </button>
          )}
          <button
            onClick={fetchScans}
            className="inline-flex items-center px-4 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setShowScanModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Initiate Scan
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Scans</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <ScanLine className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Completed</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Failed</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Running</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{stats.running}</p>
            </div>
            <RefreshCw className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <div className="flex-1 flex items-center space-x-4">
            <div>
              <label className="text-sm text-slate-400 mr-2">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mr-2">Server:</label>
              <select
                value={filterServer}
                onChange={(e) => setFilterServer(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Servers</option>
                {[...new Set(scans.map(s => s.server_name))].map(serverName => (
                  <option key={serverName} value={serverName}>{serverName}</option>
                ))}
              </select>
            </div>
          </div>
          {selectedScans.length > 0 && (
            <div className="text-sm text-slate-400">
              {selectedScans.length} selected for comparison
            </div>
          )}
        </div>
      </div>

      {/* Scans Table */}
      {filteredScans.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Select
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Services
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredScans.map((scan) => (
                <tr key={scan.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedScans.includes(scan.id)}
                      onChange={() => handleCompareScan(scan.id)}
                      disabled={!selectedScans.includes(scan.id) && selectedScans.length >= 2}
                      className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Server className="w-5 h-5 text-slate-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-white">{scan.server_name}</div>
                        <div className="text-sm text-slate-500">{scan.server_ip}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded capitalize">
                      {scan.scan_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center px-2 py-1 rounded border ${getStatusColor(scan.status)}`}>
                      {getStatusIcon(scan.status)}
                      <span className="ml-2 text-xs font-medium capitalize">{scan.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-slate-300">
                      <Clock className="w-4 h-4 mr-1 text-slate-400" />
                      {formatDuration(scan.scan_duration)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {scan.summary?.services_count || 0} services
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {new Date(scan.started_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(scan.id)}
                      className="text-blue-400 hover:text-blue-300"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
          <ScanLine className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-2 text-sm font-medium text-white">No scans found</h3>
          <p className="mt-1 text-sm text-slate-400">
            {filterStatus !== 'all' || filterServer !== 'all'
              ? 'Try adjusting your filters.'
              : 'Initiate a scan to get started.'}
          </p>
        </div>
      )}

      {/* Initiate Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Initiate Server Scan</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Server</label>
                <select
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Choose a server...</option>
                  {servers.map(server => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.ip})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Scan Type</label>
                <select
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="full">Full Scan (recommended)</option>
                  <option value="quick">Quick Scan</option>
                  <option value="ports">Port Scan Only</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Full scan detects services, filesystems, and generates backup recommendations
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowScanModal(false);
                    setSelectedServerId('');
                    setError('');
                  }}
                  className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitiateScan}
                  disabled={initiating || !selectedServerId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                >
                  {initiating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Start Scan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
