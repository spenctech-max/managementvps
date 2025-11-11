import { useEffect, useState } from 'react';
import api, { handleApiError } from '../lib/api';
import { Archive, Server, Clock, HardDrive, CheckCircle, XCircle, AlertCircle, RefreshCw, Filter, Plus, X, RotateCcw } from 'lucide-react';
import { showSuccess, showError } from '../lib/toast';

interface Backup {
  id: string;
  server_id: string;
  server_name: string;
  server_ip: string;
  backup_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  size: number;
  duration: number;
  started_at: string;
  completed_at: string;
  created_at: string;
}

interface ServerOption {
  id: string;
  name: string;
  ip: string;
}

export default function Backups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [filteredBackups, setFilteredBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterServer, setFilterServer] = useState<string>('all');
  const [servers, setServers] = useState<string[]>([]);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serverOptions, setServerOptions] = useState<ServerOption[]>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Form state
  const [selectedServerId, setSelectedServerId] = useState('');
  const [backupType, setBackupType] = useState<'full' | 'incremental' | 'differential'>('full');
  const [paths, setPaths] = useState<string[]>(['/home', '/etc']);
  const [newPath, setNewPath] = useState('');
  const [compression, setCompression] = useState(true);
  const [encryption, setEncryption] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);

  // Restore modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreBackup, setRestoreBackup] = useState<Backup | null>(null);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restorePath, setRestorePath] = useState('');
  const [restoreServerId, setRestoreServerId] = useState('');
  const [overwriteFiles, setOverwriteFiles] = useState(false);
  const [preservePermissions, setPreservePermissions] = useState(true);

  useEffect(() => {
    fetchBackups();
    fetchServers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filterStatus, filterServer, backups]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const response = await api.get('/backups');
      const backupData = response.data.data?.items || [];
      setBackups(backupData);

      // Extract unique server names for filter
      const uniqueServers = [...new Set(backupData.map((b: Backup) => b.server_name))] as string[];
      setServers(uniqueServers);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    try {
      const response = await api.get('/servers');
      setServerOptions(response.data.data?.items || []);
    } catch (err) {
      showError('Failed to load servers');
    }
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setSelectedServerId('');
    setBackupType('full');
    setPaths(['/home', '/etc']);
    setNewPath('');
    setCompression(true);
    setEncryption(false);
    setRetentionDays(30);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleAddPath = () => {
    if (newPath.trim() && !paths.includes(newPath.trim())) {
      setPaths([...paths, newPath.trim()]);
      setNewPath('');
    }
  };

  const handleRemovePath = (pathToRemove: string) => {
    setPaths(paths.filter(p => p !== pathToRemove));
  };

  const handleCreateBackup = async () => {
    if (!selectedServerId) {
      showError('Please select a server');
      return;
    }

    if (paths.length === 0) {
      showError('Please add at least one path to backup');
      return;
    }

    try {
      setCreatingBackup(true);
      await api.post('/backups', {
        serverId: selectedServerId,
        backupType,
        paths,
        options: {
          compression,
          encryption,
          retentionDays,
        },
      });

      showSuccess('Backup job created successfully');
      setShowCreateModal(false);
      fetchBackups(); // Refresh the backup list
    } catch (err) {
      showError(handleApiError(err));
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleOpenRestoreModal = (backup: Backup) => {
    setRestoreBackup(backup);
    setRestorePath('/restore');
    setRestoreServerId(backup.server_id);
    setOverwriteFiles(false);
    setPreservePermissions(true);
    setShowRestoreModal(true);
  };

  const handleCloseRestoreModal = () => {
    setShowRestoreModal(false);
    setRestoreBackup(null);
  };

  const handleRestoreBackup = async () => {
    if (!restoreBackup) return;

    if (!restorePath.trim()) {
      showError('Please enter a restore path');
      return;
    }

    try {
      setRestoringBackup(true);
      await api.post(`/backups/${restoreBackup.id}/restore`, {
        target_server_id: restoreServerId,
        restore_path: restorePath,
        options: {
          overwrite: overwriteFiles,
          preserve_permissions: preservePermissions,
        },
      });

      showSuccess('Restore job started successfully');
      setShowRestoreModal(false);
      fetchBackups(); // Refresh backup list
    } catch (err) {
      showError(handleApiError(err));
    } finally {
      setRestoringBackup(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...backups];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus);
    }

    if (filterServer !== 'all') {
      filtered = filtered.filter(b => b.server_name === filterServer);
    }

    setFilteredBackups(filtered);
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
    total: backups.length,
    completed: backups.filter(b => b.status === 'completed').length,
    failed: backups.filter(b => b.status === 'failed').length,
    running: backups.filter(b => b.status === 'running').length,
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
          <h1 className="text-3xl font-bold text-white">Backups</h1>
          <p className="mt-1 text-sm text-slate-400">View and manage all backup operations</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Backup
          </button>
          <button
            onClick={fetchBackups}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
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
              <p className="text-sm text-slate-400">Total Backups</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <Archive className="w-8 h-8 text-blue-400" />
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
                {servers.map(server => (
                  <option key={server} value={server}>{server}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Backups Table */}
      {filteredBackups.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800">
              <tr>
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
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredBackups.map((backup) => (
                <tr key={backup.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Server className="w-5 h-5 text-slate-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-white">{backup.server_name}</div>
                        <div className="text-sm text-slate-500">{backup.server_ip}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded">
                      {backup.backup_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center px-2 py-1 rounded border ${getStatusColor(backup.status)}`}>
                      {getStatusIcon(backup.status)}
                      <span className="ml-2 text-xs font-medium capitalize">{backup.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-slate-300">
                      <HardDrive className="w-4 h-4 mr-1 text-slate-400" />
                      {formatBytes(backup.size)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-slate-300">
                      <Clock className="w-4 h-4 mr-1 text-slate-400" />
                      {formatDuration(backup.duration)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {new Date(backup.started_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleOpenRestoreModal(backup)}
                      disabled={backup.status !== 'completed'}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={backup.status === 'completed' ? 'Restore backup' : 'Only completed backups can be restored'}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
          <Archive className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-2 text-sm font-medium text-white">No backups found</h3>
          <p className="mt-1 text-sm text-slate-400">
            {filterStatus !== 'all' || filterServer !== 'all'
              ? 'Try adjusting your filters.'
              : 'Backups will appear here once they are created.'}
          </p>
        </div>
      )}

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Create Manual Backup</h2>
              <button
                onClick={handleCloseCreateModal}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Server Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Server *
                </label>
                <select
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a server...</option>
                  {serverOptions.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.ip})
                    </option>
                  ))}
                </select>
              </div>

              {/* Backup Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Backup Type
                </label>
                <select
                  value={backupType}
                  onChange={(e) => setBackupType(e.target.value as 'full' | 'incremental' | 'differential')}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="full">Full Backup</option>
                  <option value="incremental">Incremental</option>
                  <option value="differential">Differential</option>
                </select>
              </div>

              {/* Paths */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Backup Paths *
                </label>
                <div className="space-y-2">
                  {paths.map((path, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2">
                        {path}
                      </div>
                      <button
                        onClick={() => handleRemovePath(path)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPath()}
                    placeholder="/path/to/backup"
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddPath}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compression}
                      onChange={(e) => setCompression(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-300">Enable Compression</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={encryption}
                      onChange={(e) => setEncryption(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-300">Enable Encryption</span>
                  </label>
                </div>
              </div>

              {/* Retention Days */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Retention Days
                </label>
                <input
                  type="number"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                  min="1"
                  max="365"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCloseCreateModal}
                disabled={creatingBackup}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup || !selectedServerId || paths.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center"
              >
                {creatingBackup ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Backup
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && restoreBackup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Restore Backup</h2>
              <button
                onClick={handleCloseRestoreModal}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Server className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-sm font-medium text-white">{restoreBackup.server_name}</div>
                  <div className="text-sm text-slate-400">{restoreBackup.server_ip}</div>
                </div>
              </div>
              <div className="text-sm text-slate-400">
                Backup Type: <span className="text-white">{restoreBackup.backup_type}</span>
              </div>
              <div className="text-sm text-slate-400">
                Size: <span className="text-white">{formatBytes(restoreBackup.size)}</span>
              </div>
              <div className="text-sm text-slate-400">
                Created: <span className="text-white">{new Date(restoreBackup.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Target Server */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target Server
                </label>
                <select
                  value={restoreServerId}
                  onChange={(e) => setRestoreServerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {serverOptions.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.ip})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Select where to restore the backup
                </p>
              </div>

              {/* Restore Path */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Restore Path *
                </label>
                <input
                  type="text"
                  value={restorePath}
                  onChange={(e) => setRestorePath(e.target.value)}
                  placeholder="/path/to/restore"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Destination path on the target server
                </p>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteFiles}
                    onChange={(e) => setOverwriteFiles(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Overwrite existing files</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preservePermissions}
                    onChange={(e) => setPreservePermissions(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Preserve file permissions</span>
                </label>
              </div>

              <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-300">
                    <strong>Warning:</strong> This will restore files to the specified path. Existing files may be overwritten if that option is enabled. Make sure you have a recent backup before proceeding.
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCloseRestoreModal}
                disabled={restoringBackup}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={restoringBackup || !restorePath.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center"
              >
                {restoringBackup ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Start Restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
