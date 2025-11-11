import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../lib/api';

interface Service {
  port: number;
  protocol: string;
  name: string;
  state: string;
  version?: string;
}

interface ServiceChange {
  port: number;
  protocol: string;
  name: string;
  differences: Array<{
    field: string;
    old: any;
    new: any;
  }>;
}

interface ComparisonData {
  server: { id: string; name: string };
  scans: Array<{ id: string; scanType: string; startedAt: string; completedAt: string }>;
  differences: {
    added: Service[];
    removed: Service[];
    changed: ServiceChange[];
    summary: {
      addedCount: number;
      removedCount: number;
      changedCount: number;
      totalChanges: number;
    };
  };
}

export function ScanComparison() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanIds = searchParams.getAll('scanIds');
    if (scanIds.length < 2) {
      setError('At least 2 scans are required for comparison');
      setLoading(false);
      return;
    }

    fetchComparison(scanIds);
  }, [searchParams]);

  const fetchComparison = async (scanIds: string[]) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      scanIds.forEach((id) => params.append('scanIds', id));

      const response = await api.get(`/api/scans/compare?${params.toString()}`);
      setComparison(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to compare scans');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Go Back
        </button>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-white">Scan Comparison</h1>
        <p className="mt-1 text-sm text-slate-400">
          Comparing scans for <span className="font-medium text-white">{comparison.server.name}</span>
        </p>
      </div>

      {/* Scan Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-medium text-white">Scans Being Compared</h3>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comparison.scans.map((scan, index) => (
              <div key={scan.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <p className="text-sm font-medium text-white">
                  Scan {index + 1} ({scan.scanType})
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(scan.startedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <RefreshCw className="h-6 w-6 text-slate-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Total Changes</dt>
                <dd className="text-lg font-semibold text-white">
                  {comparison.differences.summary.totalChanges}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Plus className="h-6 w-6 text-green-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Added</dt>
                <dd className="text-lg font-semibold text-green-400">
                  {comparison.differences.summary.addedCount}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Minus className="h-6 w-6 text-red-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Removed</dt>
                <dd className="text-lg font-semibold text-red-400">
                  {comparison.differences.summary.removedCount}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <RefreshCw className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-slate-400 truncate">Changed</dt>
                <dd className="text-lg font-semibold text-yellow-400">
                  {comparison.differences.summary.changedCount}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Differences */}
      <div className="space-y-6">
        {/* Added Services */}
        {comparison.differences.added.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-green-900/20 border-b border-green-700">
              <h3 className="text-lg font-medium text-green-400 flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                Added Services ({comparison.differences.added.length})
              </h3>
            </div>
            <div>
              <ul className="divide-y divide-slate-800">
                {comparison.differences.added.map((service, index) => (
                  <li key={index} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{service.name}</p>
                        <p className="text-sm text-slate-400">
                          Port {service.port}/{service.protocol} - {service.state}
                        </p>
                        {service.version && (
                          <p className="text-xs text-slate-500 mt-1">Version: {service.version}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Removed Services */}
        {comparison.differences.removed.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-red-900/20 border-b border-red-700">
              <h3 className="text-lg font-medium text-red-400 flex items-center">
                <Minus className="h-5 w-5 mr-2" />
                Removed Services ({comparison.differences.removed.length})
              </h3>
            </div>
            <div>
              <ul className="divide-y divide-slate-800">
                {comparison.differences.removed.map((service, index) => (
                  <li key={index} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{service.name}</p>
                        <p className="text-sm text-slate-400">
                          Port {service.port}/{service.protocol} - {service.state}
                        </p>
                        {service.version && (
                          <p className="text-xs text-slate-500 mt-1">Version: {service.version}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Changed Services */}
        {comparison.differences.changed.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-yellow-900/20 border-b border-yellow-700">
              <h3 className="text-lg font-medium text-yellow-400 flex items-center">
                <RefreshCw className="h-5 w-5 mr-2" />
                Changed Services ({comparison.differences.changed.length})
              </h3>
            </div>
            <div>
              <ul className="divide-y divide-slate-800">
                {comparison.differences.changed.map((change, index) => (
                  <li key={index} className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-white">{change.name}</p>
                      <p className="text-sm text-slate-400">
                        Port {change.port}/{change.protocol}
                      </p>
                      <div className="mt-2 space-y-1">
                        {change.differences.map((diff, diffIndex) => (
                          <div key={diffIndex} className="text-xs">
                            <span className="font-medium text-slate-300 capitalize">{diff.field}:</span>{' '}
                            <span className="text-red-400 line-through">{diff.old}</span>
                            {' → '}
                            <span className="text-green-400">{diff.new}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {comparison.differences.summary.totalChanges === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
            <p className="text-slate-400">No differences found between the selected scans.</p>
          </div>
        )}
      </div>
    </div>
  );
}
