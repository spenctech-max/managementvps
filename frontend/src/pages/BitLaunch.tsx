import { useEffect, useState } from 'react';
import api, { handleApiError } from '../lib/api';
import { showSuccess, showError } from '../lib/toast';
import {
  DollarSign,
  Server,
  Activity,
  Cpu,
  HardDrive,
  Network,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';

interface BillingInfo {
  accountBalance: number;
  currencyCode: string;
  currentMonthUsage: number;
  currentMonthEstimatedCost: number;
  lastUpdated: string;
}

interface PerformanceMetrics {
  serverCount: number;
  totalUptime: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgNetworkTraffic: number;
  lastUpdated: string;
}

interface BitLaunchStatus {
  isConnected: boolean;
  apiKeySet: boolean;
  lastSyncTime: string | null;
  lastError: string | null;
  syncInProgress: boolean;
}

interface BitLaunchServer {
  id: string;
  name: string;
  ipv4: string;
  ipv6: string;
  status: string;
  size: string;
  region: string;
  image: string;
  diskGB: number;
  rate: number;
  created: string;
  bandwidthUsed: number;
  backupsEnabled: boolean;
}

export default function BitLaunch() {
  const [status, setStatus] = useState<BitLaunchStatus | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [servers, setServers] = useState<BitLaunchServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch status
      const statusRes = await api.get('/bitlaunch/status');
      setStatus(statusRes.data.data);

      // If connected, fetch billing, metrics, and servers
      if (statusRes.data.data.isConnected) {
        try {
          const billingRes = await api.get('/bitlaunch/billing');
          setBilling(billingRes.data.data);
        } catch (err) {
          console.error('Failed to fetch billing:', err);
        }

        try {
          const metricsRes = await api.get('/bitlaunch/metrics');
          setMetrics(metricsRes.data.data);
        } catch (err) {
          console.error('Failed to fetch metrics:', err);
        }

        try {
          const serversRes = await api.get('/bitlaunch/servers');
          setServers(serversRes.data.data || []);
        } catch (err) {
          console.error('Failed to fetch servers:', err);
        }
      }
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setError('');
      const response = await api.post('/bitlaunch/test');
      showSuccess('Connection test successful!');
      await fetchData();
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      showError('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError('');
      await api.post('/bitlaunch/sync');
      showSuccess('Data synchronized successfully!');
      await fetchData();
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      showError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    // BitLaunch stores amounts in cents
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatUptime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
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
          <h1 className="text-3xl font-bold text-white">BitLaunch Integration</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor your BitLaunch account billing and server performance
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleTestConnection}
            disabled={testing || !status?.apiKeySet}
            className="inline-flex items-center px-4 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Test Connection
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !status?.isConnected}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync Data
          </button>
          <button
            onClick={fetchData}
            className="inline-flex items-center px-4 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700"
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

      {/* Connection Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-lg ${status?.isConnected ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
              {status?.isConnected ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Connection Status</h2>
              <p className={`text-sm ${status?.isConnected ? 'text-green-400' : 'text-red-400'}`}>
                {status?.isConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">API Key</p>
            <p className={`font-medium ${status?.apiKeySet ? 'text-green-400' : 'text-slate-500'}`}>
              {status?.apiKeySet ? 'Configured' : 'Not Set'}
            </p>
          </div>
        </div>

        {status?.lastSyncTime && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center text-sm text-slate-400">
              <Calendar className="w-4 h-4 mr-2" />
              Last sync: {formatDate(status.lastSyncTime)}
            </div>
          </div>
        )}

        {status?.lastError && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mr-2" />
              {status.lastError}
            </div>
          </div>
        )}
      </div>

      {!status?.isConnected && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-2 text-sm font-medium text-white">BitLaunch Not Connected</h3>
          <p className="mt-1 text-sm text-slate-400">
            Configure your BitLaunch API key to view billing and performance data.
          </p>
        </div>
      )}

      {status?.isConnected && (
        <>
          {/* Billing Information */}
          {billing && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <div className="flex items-center mb-6">
                <DollarSign className="w-6 h-6 text-green-400 mr-2" />
                <h2 className="text-xl font-bold text-white">Billing Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Account Balance</p>
                      <p className="text-2xl font-bold text-green-400 mt-1">
                        {formatCurrency(billing.accountBalance, billing.currencyCode)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-400 opacity-50" />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Monthly Usage</p>
                      <p className="text-2xl font-bold text-blue-400 mt-1">
                        {formatCurrency(billing.currentMonthUsage, billing.currencyCode)}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-400 opacity-50" />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Estimated Cost</p>
                      <p className="text-2xl font-bold text-yellow-400 mt-1">
                        {formatCurrency(billing.currentMonthEstimatedCost, billing.currencyCode)}
                      </p>
                    </div>
                    <Activity className="w-8 h-8 text-yellow-400 opacity-50" />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Currency</p>
                      <p className="text-2xl font-bold text-slate-300 mt-1">
                        {billing.currencyCode}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-slate-400 opacity-50" />
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Last updated: {formatDate(billing.lastUpdated)}
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {metrics && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <div className="flex items-center mb-6">
                <Activity className="w-6 h-6 text-purple-400 mr-2" />
                <h2 className="text-xl font-bold text-white">Performance Metrics</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Servers</p>
                      <p className="text-2xl font-bold text-blue-400 mt-1">
                        {metrics.serverCount}
                      </p>
                    </div>
                    <Server className="w-8 h-8 text-blue-400 opacity-50" />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Avg Uptime</p>
                      <p className="text-xl font-bold text-green-400 mt-1">
                        {formatUptime(metrics.totalUptime)}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-400 opacity-50" />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Avg CPU</p>
                      <p className="text-2xl font-bold text-yellow-400 mt-1">
                        {metrics.avgCpuUsage.toFixed(1)}%
                      </p>
                    </div>
                    <Cpu className="w-8 h-8 text-yellow-400 opacity-50" />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Avg Memory</p>
                      <p className="text-2xl font-bold text-orange-400 mt-1">
                        {metrics.avgMemoryUsage.toFixed(1)}%
                      </p>
                    </div>
                    <HardDrive className="w-8 h-8 text-orange-400 opacity-50" />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Network</p>
                      <p className="text-xl font-bold text-purple-400 mt-1">
                        {(metrics.avgNetworkTraffic / 1024 / 1024).toFixed(1)} GB
                      </p>
                    </div>
                    <Network className="w-8 h-8 text-purple-400 opacity-50" />
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Last updated: {formatDate(metrics.lastUpdated)}
              </div>
            </div>
          )}

          {/* Servers List */}
          {servers.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <div className="flex items-center mb-6">
                <Server className="w-6 h-6 text-blue-400 mr-2" />
                <h2 className="text-xl font-bold text-white">BitLaunch Servers ({servers.length})</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-slate-800">
                      <th className="pb-3 text-sm font-medium text-slate-400">Server Name</th>
                      <th className="pb-3 text-sm font-medium text-slate-400">IP Address</th>
                      <th className="pb-3 text-sm font-medium text-slate-400">Size</th>
                      <th className="pb-3 text-sm font-medium text-slate-400">Region</th>
                      <th className="pb-3 text-sm font-medium text-slate-400">Disk</th>
                      <th className="pb-3 text-sm font-medium text-slate-400">Rate</th>
                      <th className="pb-3 text-sm font-medium text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servers.map((server) => (
                      <tr key={server.id} className="border-b border-slate-800/50">
                        <td className="py-4">
                          <div>
                            <p className="text-white font-medium">{server.name}</p>
                            <p className="text-xs text-slate-500">{server.image}</p>
                          </div>
                        </td>
                        <td className="py-4">
                          <code className="text-sm text-blue-400">{server.ipv4}</code>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-slate-300">{server.size}</span>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-slate-300">{server.region}</span>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-slate-300">{server.diskGB}GB</span>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-green-400">${(server.rate / 100).toFixed(2)}/mo</span>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            server.status === 'ok'
                              ? 'bg-green-900/20 text-green-400 border border-green-700'
                              : 'bg-red-900/20 text-red-400 border border-red-700'
                          }`}>
                            {server.status === 'ok' ? 'Running' : server.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
