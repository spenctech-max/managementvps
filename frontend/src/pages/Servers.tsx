import { useEffect, useState, lazy, Suspense } from 'react';
import api, { handleApiError } from '../lib/api';
import { showSuccess, showInfo } from '../lib/toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { Server as ServerIcon, Plus, Trash2, Edit, TestTube, Check, X, AlertCircle, Terminal as TerminalIcon, ScanLine, Archive } from 'lucide-react';
import type { Server, ApiResponse } from '@medicine-man/shared';

// Lazy load Terminal component (includes heavy xterm library)
const Terminal = lazy(() => import('../components/Terminal'));

interface ScanSummary {
  id: string;
  scan_type: string;
  status: string;
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
}

export default function Servers() {
  const { confirmDialog, showConfirm } = useConfirmDialog();
  const [servers, setServers] = useState<Server[]>([]);
  const [scanSummaries, setScanSummaries] = useState<Record<string, ScanSummary | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [terminalServer, setTerminalServer] = useState<Server | null>(null);
  const [backingUpId, setBackingUpId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    port: 22,
    username: '',
    auth_type: 'password' as 'password' | 'key',
    credential: '',
    tags: '',
    description: '',
  });

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<{items: Server[], pagination: any}>>('/servers');
      const serverList = res.data.data?.items || [];
      setServers(serverList);

      // Fetch scan summaries for each server
      const summaries: Record<string, ScanSummary | null> = {};
      await Promise.all(
        serverList.map(async (server) => {
          try {
            const scanRes = await api.get(`/servers/${server.id}/scan-summary`);
            summaries[server.id] = scanRes.data.data?.latestScan || null;
          } catch (err) {
            // No scan available for this server yet
            summaries[server.id] = null;
          }
        })
      );
      setScanSummaries(summaries);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingServer) {
        await api.put(`/servers/${editingServer.id}`, formData);
      } else {
        await api.post('/servers', formData);
      }
      setShowModal(false);
      resetForm();
      fetchServers();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Server',
      message: 'Are you sure you want to delete this server?\n\nThis action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete Server',
    });

    if (!confirmed) return;

    try {
      await api.delete(`/servers/${id}`);
      showSuccess('Server deleted successfully');
      fetchServers();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await api.post(`/servers/${id}/test`);
      fetchServers();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setTestingId(null);
    }
  };

  const handleOrchestratedBackup = async (id: string, serverName: string) => {
    const confirmed = await showConfirm({
      title: `Orchestrated Backup - ${serverName}`,
      message: `This will perform a coordinated backup:\n\n1. Stop services gracefully (databases last)\n2. Perform backups (hot backups for databases)\n3. Restart services (databases first)\n\nServices will have brief downtime during this process.\n\nContinue?`,
      variant: 'warning',
      confirmText: 'Start Backup',
    });

    if (!confirmed) return;

    setBackingUpId(id);
    try {
      const response = await api.post(`/servers/${id}/orchestrated-backup`, {
        backupType: 'full',
        selectedServices: []
      });

      showInfo(
        `Orchestrated backup started for ${serverName}! The backup is running in the background. Services will be stopped, backed up, and restarted automatically. Check the Backups page for progress.`,
        6000
      );

      // Refresh servers after a delay to show updated status
      setTimeout(() => fetchServers(), 2000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setBackingUpId(null);
    }
  };

  const openModal = (server?: Server) => {
    if (server) {
      setEditingServer(server);
      setFormData({
        name: server.name,
        ip: server.ip,
        port: server.port,
        username: server.username,
        auth_type: server.auth_type,
        credential: '',
        tags: server.tags || '',
        description: server.description || '',
      });
    }
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ip: '',
      port: 22,
      username: '',
      auth_type: 'password',
      credential: '',
      tags: '',
      description: '',
    });
    setEditingServer(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Servers</h1>
          <p className="mt-1 text-sm text-slate-400">Manage your server infrastructure</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Server
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : servers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {servers.map((server) => (
            <div key={server.id} className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${server.is_online ? 'bg-green-400' : 'bg-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-white truncate">{server.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">{server.ip}:{server.port}</p>
                    {server.description && (
                      <p className="text-sm text-slate-500 mt-2">{server.description}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-3">
                      <span className="text-xs text-slate-500">
                        <span className="font-medium">User:</span> {server.username}
                      </span>
                      <span className="text-xs text-slate-500">
                        <span className="font-medium">Auth:</span> {server.auth_type}
                      </span>
                    </div>
                    {scanSummaries[server.id] && scanSummaries[server.id]?.summary && (
                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <ScanLine className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-slate-300">Latest Scan</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(scanSummaries[server.id]!.started_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div className="bg-slate-800/50 rounded-lg p-2">
                            <p className="text-xs text-slate-400">Services</p>
                            <p className="text-lg font-semibold text-white mt-1">
                              {scanSummaries[server.id]!.summary!.services_count || 0}
                            </p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-2">
                            <p className="text-xs text-slate-400">Critical</p>
                            <p className="text-lg font-semibold text-orange-400 mt-1">
                              {scanSummaries[server.id]!.summary!.critical_services || 0}
                            </p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-2">
                            <p className="text-xs text-slate-400">Filesystems</p>
                            <p className="text-lg font-semibold text-white mt-1">
                              {scanSummaries[server.id]!.summary!.filesystems_count || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setTerminalServer(server)}
                  disabled={!server.is_online}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-blue-700 shadow-sm text-sm font-medium rounded-md text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={server.is_online ? 'Open Terminal' : 'Server offline'}
                >
                  <TerminalIcon className="w-4 h-4 mr-2" />
                  Terminal
                </button>
                <button
                  onClick={() => handleOrchestratedBackup(server.id, server.name)}
                  disabled={!server.is_online || backingUpId === server.id}
                  className="inline-flex justify-center items-center px-3 py-2 border border-green-700 shadow-sm text-sm font-medium rounded-md text-green-400 bg-green-900/20 hover:bg-green-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={server.is_online ? 'Orchestrated Backup (Stop → Backup → Restart)' : 'Server offline'}
                >
                  {backingUpId === server.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleTest(server.id)}
                  disabled={testingId === server.id}
                  className="inline-flex justify-center items-center px-3 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                >
                  {testingId === server.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => openModal(server)}
                  className="inline-flex items-center px-3 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(server.id)}
                  className="inline-flex items-center px-3 py-2 border border-red-700 shadow-sm text-sm font-medium rounded-md text-red-400 bg-red-900/20 hover:bg-red-900/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-lg">
          <ServerIcon className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-2 text-sm font-medium text-white">No servers</h3>
          <p className="mt-1 text-sm text-slate-400">Get started by adding a server.</p>
          <div className="mt-6">
            <button
              onClick={() => openModal()}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Server
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingServer ? 'Edit Server' : 'Add Server'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Server Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Production Server 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">IP Address</label>
                  <input
                    type="text"
                    required
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Port</label>
                  <input
                    type="number"
                    required
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="root"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Auth Type</label>
                  <select
                    value={formData.auth_type}
                    onChange={(e) => setFormData({ ...formData, auth_type: e.target.value as 'password' | 'key' })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="password">Password</option>
                    <option value="key">SSH Key</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {formData.auth_type === 'password' ? 'Password' : 'SSH Private Key'}
                  </label>
                  <textarea
                    required={!editingServer}
                    value={formData.credential}
                    onChange={(e) => setFormData({ ...formData, credential: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    rows={formData.auth_type === 'key' ? 4 : 1}
                    placeholder={formData.auth_type === 'password' ? 'Enter password' : 'Paste SSH private key'}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Server description"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800"
                >
                  <X className="w-4 h-4 inline mr-2" />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
                >
                  <Check className="w-4 h-4 inline mr-2" />
                  {editingServer ? 'Update' : 'Add'} Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminal Modal */}
      {terminalServer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-lg max-w-6xl w-full shadow-2xl">
            <Suspense fallback={
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="mt-4 text-slate-400 text-sm">Loading terminal...</p>
                </div>
              </div>
            }>
              <Terminal
                serverId={terminalServer.id}
                serverName={terminalServer.name}
                onClose={() => setTerminalServer(null)}
              />
            </Suspense>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
