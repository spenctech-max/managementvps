import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { handleApiError } from '../lib/api';
import { Server, ScanLine, Archive, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import type { Server as ServerType, Scan, ApiResponse } from '@medicine-man/shared';

export default function Dashboard() {
  const [servers, setServers] = useState<ServerType[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [serversRes, scansRes] = await Promise.all([
        api.get<ApiResponse<{items: ServerType[], pagination: any}>>('/servers'),
        api.get<ApiResponse<{items: Scan[], pagination: any}>>('/scans?limit=5'),
      ]);

      // Ensure we always set arrays, never null/undefined
      // API returns {data: {items: [], pagination: {}}}
      const serverData = serversRes?.data?.data?.items;
      const scanData = scansRes?.data?.data?.items;

      console.log('[Dashboard] Full response:', {
        serversRes: serversRes?.data,
        scansRes: scansRes?.data,
        serverDataStructure: JSON.stringify(serversRes?.data),
        scanDataStructure: JSON.stringify(scansRes?.data),
      });

      console.log('[Dashboard] serverData:', serverData);
      console.log('[Dashboard] scanData:', scanData);

      console.log('[Dashboard] Received data:', {
        servers: Array.isArray(serverData) ? serverData.length : 'not array',
        scans: Array.isArray(scanData) ? scanData.length : 'not array'
      });

      setServers(Array.isArray(serverData) ? serverData : []);
      setScans(Array.isArray(scanData) ? scanData : []);
    } catch (err) {
      console.error('[Dashboard] Error fetching data:', err);
      setError(handleApiError(err));
      // Set empty arrays on error
      setServers([]);
      setScans([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const onlineServers = servers && Array.isArray(servers) ? servers.filter(s => s.is_online).length : 0;
  const recentScans = scans && Array.isArray(scans) ? scans.filter(s => s.status === 'completed').length : 0;
  const runningScans = scans && Array.isArray(scans) ? scans.filter(s => s.status === 'running').length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Overview of your server infrastructure and recent activity
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Server className="h-8 w-8 text-blue-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Total Servers</dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-white">{Array.isArray(servers) ? servers.length : 0}</div>
                  <div className="ml-2 text-sm text-green-400">{onlineServers} online</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="h-8 w-8 text-green-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Server Status</dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-white">
                    {Array.isArray(servers) && servers.length > 0 ? Math.round((onlineServers / servers.length) * 100) : 0}%
                  </div>
                  <div className="ml-2 text-sm text-slate-400">uptime</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ScanLine className="h-8 w-8 text-purple-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Recent Scans</dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-white">{recentScans}</div>
                  {runningScans > 0 && (
                    <div className="ml-2 text-sm text-yellow-400">{runningScans} running</div>
                  )}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Archive className="h-8 w-8 text-orange-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Backups</dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-white">-</div>
                  <div className="ml-2 text-sm text-slate-400">pending</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/servers"
              className="block w-full text-left px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Server className="inline w-5 h-5 mr-2" />
              Add New Server
            </Link>
            <Link
              to="/scans"
              className="block w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <ScanLine className="inline w-5 h-5 mr-2" />
              Run Scan
            </Link>
            <Link
              to="/backups"
              className="block w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <Archive className="inline w-5 h-5 mr-2" />
              View Backups
            </Link>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          {Array.isArray(scans) && scans.length > 0 ? (
            <div className="space-y-3">
              {scans.slice(0, 5).map((scan) => (
                <div key={scan.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{scan.scan_type} scan</p>
                    <p className="text-xs text-slate-400">
                      {new Date(scan.started_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    scan.status === 'completed' ? 'bg-green-900/20 text-green-400' :
                    scan.status === 'running' ? 'bg-yellow-900/20 text-yellow-400' :
                    scan.status === 'failed' ? 'bg-red-900/20 text-red-400' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {scan.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No recent scans</p>
          )}
        </div>
      </div>

      {/* Servers List */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Servers</h2>
          <Link to="/servers" className="text-sm text-blue-400 hover:text-blue-300">
            View all →
          </Link>
        </div>
        {Array.isArray(servers) && servers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.slice(0, 6).map((server) => (
              <div key={server.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-white">{server.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{server.ip}:{server.port}</p>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${server.is_online ? 'bg-green-400' : 'bg-slate-600'}`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Server className="mx-auto h-12 w-12 text-slate-600" />
            <h3 className="mt-2 text-sm font-medium text-white">No servers</h3>
            <p className="mt-1 text-sm text-slate-400">Get started by adding a server.</p>
            <div className="mt-6">
              <Link
                to="/servers"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Add Server
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
