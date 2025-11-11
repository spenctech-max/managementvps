import { useEffect, useState } from 'react';
import api, { handleApiError } from '../lib/api';
import { Activity, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

interface JobStatsData {
  backup: QueueStats;
  scan: QueueStats;
  update: QueueStats;
}

export default function JobStats() {
  const [stats, setStats] = useState<JobStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
    // Refresh stats every 5 seconds
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/jobs/stats/all');
      setStats(response.data.data);
      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const getTotalStats = () => {
    if (!stats) return { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 };

    return {
      waiting: (stats.backup.waiting || 0) + (stats.scan.waiting || 0) + (stats.update.waiting || 0),
      active: (stats.backup.active || 0) + (stats.scan.active || 0) + (stats.update.active || 0),
      completed: (stats.backup.completed || 0) + (stats.scan.completed || 0) + (stats.update.completed || 0),
      failed: (stats.backup.failed || 0) + (stats.scan.failed || 0) + (stats.update.failed || 0),
      total: (stats.backup.total || 0) + (stats.scan.total || 0) + (stats.update.total || 0),
    };
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-800 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-6">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const totalStats = getTotalStats();

  const statCards = [
    {
      label: 'Total Jobs',
      value: totalStats.total,
      icon: Activity,
      color: 'from-blue-600 to-purple-600',
      textColor: 'text-blue-400',
    },
    {
      label: 'Active Jobs',
      value: totalStats.active,
      icon: Loader2,
      color: 'from-yellow-600 to-orange-600',
      textColor: 'text-yellow-400',
      animate: totalStats.active > 0,
    },
    {
      label: 'Completed',
      value: totalStats.completed,
      icon: CheckCircle,
      color: 'from-green-600 to-emerald-600',
      textColor: 'text-green-400',
    },
    {
      label: 'Failed',
      value: totalStats.failed,
      icon: XCircle,
      color: 'from-red-600 to-pink-600',
      textColor: 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 hover:border-slate-700/50 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-400">{card.label}</h3>
              <div className={`p-2 rounded-lg bg-gradient-to-r ${card.color} bg-opacity-10`}>
                <Icon
                  className={`w-5 h-5 ${card.textColor} ${card.animate ? 'animate-spin' : ''}`}
                />
              </div>
            </div>
            <div className="flex items-baseline">
              <p className="text-3xl font-bold text-white">{card.value}</p>
            </div>

            {/* Queue breakdown */}
            {stats && (
              <div className="mt-4 pt-4 border-t border-slate-800/50">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-slate-500">Backup</div>
                    <div className={`font-medium ${card.textColor}`}>
                      {card.label === 'Total Jobs' && stats.backup.total}
                      {card.label === 'Active Jobs' && (stats.backup.active || 0)}
                      {card.label === 'Completed' && (stats.backup.completed || 0)}
                      {card.label === 'Failed' && (stats.backup.failed || 0)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500">Scan</div>
                    <div className={`font-medium ${card.textColor}`}>
                      {card.label === 'Total Jobs' && stats.scan.total}
                      {card.label === 'Active Jobs' && (stats.scan.active || 0)}
                      {card.label === 'Completed' && (stats.scan.completed || 0)}
                      {card.label === 'Failed' && (stats.scan.failed || 0)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500">Update</div>
                    <div className={`font-medium ${card.textColor}`}>
                      {card.label === 'Total Jobs' && stats.update.total}
                      {card.label === 'Active Jobs' && (stats.update.active || 0)}
                      {card.label === 'Completed' && (stats.update.completed || 0)}
                      {card.label === 'Failed' && (stats.update.failed || 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
