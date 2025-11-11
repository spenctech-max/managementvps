import { useEffect, useState } from 'react';
import { DollarSign, Activity, TrendingUp, AlertCircle, Loader } from 'lucide-react';
import api, { handleApiError } from '../lib/api';

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

export default function BitlaunchWidget() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBitlaunchData();
  }, []);

  const fetchBitlaunchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [billingRes, metricsRes] = await Promise.all([
        api.get('/bitlaunch/billing').catch(() => null),
        api.get('/bitlaunch/metrics').catch(() => null),
      ]);

      if (billingRes?.data?.success) {
        setBilling(billingRes.data.data);
      }

      if (metricsRes?.data?.success) {
        setMetrics(metricsRes.data.data);
      }

      // If both failed, set error
      if (!billingRes && !metricsRes) {
        setError('Failed to load Bitlaunch data');
      }
    } catch (err) {
      console.error('Failed to fetch Bitlaunch data:', err);
      setError('Failed to load Bitlaunch data');
    } finally {
      setLoading(false);
    }
  };

  // Don't show widget if no data is available
  if (!billing && !metrics && !loading && !error) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-center h-32">
          <Loader className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-yellow-400 mr-3" />
          <div>
            <h3 className="font-semibold text-white">Bitlaunch Integration</h3>
            <p className="text-sm text-slate-400 mt-1">
              {error} - Configure your API key in Settings
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Billing Information */}
      {billing && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <DollarSign className="w-5 h-5 text-green-400 mr-2" />
            <h3 className="font-semibold text-white">Bitlaunch Billing</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Account Balance
              </p>
              <p className="text-2xl font-bold text-green-400">
                {billing.currencyCode} {billing.accountBalance.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                This Month Usage
              </p>
              <p className="text-2xl font-bold text-blue-400">
                {billing.currencyCode} {billing.currentMonthEstimatedCost.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {billing.currentMonthUsage.toFixed(2)} GB used
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            Last updated: {new Date(billing.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Activity className="w-5 h-5 text-blue-400 mr-2" />
            <h3 className="font-semibold text-white">Bitlaunch Performance</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Servers
              </p>
              <p className="text-2xl font-bold text-yellow-400">
                {metrics.serverCount}
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Avg Uptime
              </p>
              <p className="text-2xl font-bold text-green-400">
                {metrics.totalUptime.toFixed(1)}%
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                CPU Usage
              </p>
              <p className="text-2xl font-bold text-red-400">
                {metrics.avgCpuUsage.toFixed(1)}%
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Memory Usage
              </p>
              <p className="text-2xl font-bold text-purple-400">
                {metrics.avgMemoryUsage.toFixed(1)}%
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 sm:col-span-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Network Traffic
              </p>
              <p className="text-2xl font-bold text-cyan-400">
                {(metrics.avgNetworkTraffic / 1024).toFixed(2)} TB
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
