import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Server,
  Zap,
  Clock,
  Cpu,
  HardDrive,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import api from '../lib/api';

interface SystemMetrics {
  services: {
    database: {
      status: string;
      connections: {
        total: number;
        idle: number;
        waiting: number;
      };
    };
    redis: {
      status: string;
      connected: boolean;
    };
    cache: {
      hitRate: string;
      stats: {
        hits: number;
        misses: number;
        sets: number;
        deletes: number;
      };
    };
  };
  process: {
    uptime: {
      seconds: number;
      formatted: string;
    };
    memory: {
      rss: string;
      heapUsed: string;
      heapTotal: string;
      external: string;
    };
    version: string;
    platform: string;
  };
  health: {
    status: string;
    timestamp: string;
  };
}

export function HealthDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      setError(null);
      const response = await api.get('/metrics/system');
      setMetrics(response.data.data);
      setLastUpdate(new Date());
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Admin access required to view health metrics');
      } else {
        setError(err.response?.data?.message || 'Failed to fetch system metrics');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return 'bg-green-900/20 text-green-400 border-green-700';
      case 'degraded':
        return 'bg-yellow-900/20 text-yellow-400 border-yellow-700';
      case 'unhealthy':
      case 'error':
        return 'bg-red-900/20 text-red-400 border-red-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="space-y-6">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const dbUtilization = metrics.services.database.connections.total > 0
    ? ((metrics.services.database.connections.total - metrics.services.database.connections.idle) / 50) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">System Health</h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time monitoring of system resources and services
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
              autoRefresh
                ? 'border-green-700 text-green-400 bg-green-900/20'
                : 'border-slate-700 text-slate-300 bg-slate-800'
            }`}
          >
            <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </button>
          <button
            onClick={fetchMetrics}
            className="inline-flex items-center px-3 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Health Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {getStatusIcon(metrics.health.status)}
            <h2 className="ml-3 text-xl font-semibold text-white">
              System Status:{' '}
              <span className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(metrics.health.status)}`}>
                {metrics.health.status.charAt(0).toUpperCase() + metrics.health.status.slice(1)}
              </span>
            </h2>
          </div>
          <div className="text-sm text-slate-400">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Service Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Database */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Database className="w-6 h-6 text-blue-400 mr-3" />
              <h3 className="text-lg font-medium text-white">Database</h3>
            </div>
            {getStatusIcon(metrics.services.database.status)}
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Connection Pool</span>
                <span className="font-medium text-white">
                  {metrics.services.database.connections.total - metrics.services.database.connections.idle}/50
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    dbUtilization > 80 ? 'bg-red-500' : dbUtilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${dbUtilization}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-slate-800 border border-slate-700 p-2 rounded">
                <div className="text-slate-400 text-xs">Total</div>
                <div className="font-semibold text-white">{metrics.services.database.connections.total}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-2 rounded">
                <div className="text-slate-400 text-xs">Idle</div>
                <div className="font-semibold text-white">{metrics.services.database.connections.idle}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-2 rounded">
                <div className="text-slate-400 text-xs">Waiting</div>
                <div className="font-semibold text-white">{metrics.services.database.connections.waiting}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Redis Cache */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Zap className="w-6 h-6 text-yellow-400 mr-3" />
              <h3 className="text-lg font-medium text-white">Redis Cache</h3>
            </div>
            {getStatusIcon(metrics.services.redis.status)}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Connection</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                metrics.services.redis.connected ? 'bg-green-900/20 text-green-400 border-green-700' : 'bg-red-900/20 text-red-400 border-red-700'
              }`}>
                {metrics.services.redis.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Hit Rate</span>
              <span className="text-lg font-semibold text-white">{metrics.services.cache.hitRate}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-slate-800 border border-slate-700 p-2 rounded">
                <div className="text-slate-400 text-xs">Hits</div>
                <div className="font-semibold text-green-400">{metrics.services.cache.stats.hits}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-2 rounded">
                <div className="text-slate-400 text-xs">Misses</div>
                <div className="font-semibold text-red-400">{metrics.services.cache.stats.misses}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Process Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Memory Usage */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <HardDrive className="w-6 h-6 text-blue-400 mr-3" />
            <h3 className="text-lg font-medium text-white">Memory Usage</h3>
          </div>

          <div className="space-y-2">
            {Object.entries(metrics.process.memory).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="font-medium text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Server className="w-6 h-6 text-purple-400 mr-3" />
            <h3 className="text-lg font-medium text-white">System Info</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center">
              <Clock className="w-4 h-4 text-slate-400 mr-2" />
              <div className="flex-1">
                <div className="text-sm text-slate-400">Uptime</div>
                <div className="font-medium text-white">{metrics.process.uptime.formatted}</div>
              </div>
            </div>

            <div className="flex items-center">
              <Cpu className="w-4 h-4 text-slate-400 mr-2" />
              <div className="flex-1">
                <div className="text-sm text-slate-400">Node.js Version</div>
                <div className="font-medium text-white">{metrics.process.version}</div>
              </div>
            </div>

            <div className="flex items-center">
              <Server className="w-4 h-4 text-slate-400 mr-2" />
              <div className="flex-1">
                <div className="text-sm text-slate-400">Platform</div>
                <div className="font-medium capitalize text-white">{metrics.process.platform}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-center text-sm text-slate-500">
        Metrics captured at {new Date(metrics.health.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
