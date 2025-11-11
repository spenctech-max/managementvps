import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import api from '../lib/api';

interface BackupSchedule {
  id: string;
  serverId: string;
  serverName: string;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  hour: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  sourcePath: string;
  destinationPath: string;
  compression: 'none' | 'gzip' | 'bzip2';
  encryption: boolean;
  enabled: boolean;
  nextRun: string;
  lastRun?: string;
  lastStatus?: 'success' | 'failure' | 'running';
  createdAt: string;
}

interface ServerOption {
  id: string;
  name: string;
  hostname: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COMPRESSION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'gzip', label: 'Gzip' },
  { value: 'bzip2', label: 'Bzip2' },
];

export function BackupSchedules() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BackupSchedule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
    fetchServers();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/backup-schedules');
      setSchedules(response.data.data?.items || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch backup schedules');
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

  const handleCreateSchedule = async (formData: any) => {
    try {
      await api.post('/backup-schedules', formData);
      setShowCreateModal(false);
      fetchSchedules();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to create schedule');
    }
  };

  const handleUpdateSchedule = async (id: string, formData: any) => {
    try {
      await api.put(`/backup-schedules/${id}`, formData);
      setEditingSchedule(null);
      fetchSchedules();
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await api.delete(`/backup-schedules/${id}`);
      setDeleteConfirmId(null);
      fetchSchedules();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete schedule');
    }
  };

  const handleToggleEnabled = async (schedule: BackupSchedule) => {
    try {
      await api.put(`/backup-schedules/${schedule.id}`, {
        enabled: !schedule.enabled,
      });
      fetchSchedules();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle schedule');
    }
  };

  const formatNextRun = (nextRun: string) => {
    const date = new Date(nextRun);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    return 'soon';
  };

  const getScheduleDescription = (schedule: BackupSchedule) => {
    const time = `${schedule.hour.toString().padStart(2, '0')}:00`;
    switch (schedule.scheduleType) {
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        return `Weekly on ${DAYS_OF_WEEK[schedule.dayOfWeek!]} at ${time}`;
      case 'monthly':
        return `Monthly on day ${schedule.dayOfMonth} at ${time}`;
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Backup Schedules</h1>
          <p className="mt-1 text-sm text-slate-400">Manage automated backup schedules for your servers</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Schedule
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-400 mr-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-2 text-sm font-medium text-white">No backup schedules configured</h3>
          <p className="mt-1 text-sm text-slate-400">Create your first schedule to automate backups</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <ul className="divide-y divide-slate-800">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="px-6 py-5 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Server className="h-5 w-5 text-slate-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-white">{schedule.serverName}</p>
                        <p className="text-sm text-slate-400">{getScheduleDescription(schedule)}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center text-xs text-slate-500 space-x-4">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Next run: {formatNextRun(schedule.nextRun)}
                      </span>
                      {schedule.lastRun && (
                        <span className="flex items-center">
                          {schedule.lastStatus === 'success' ? (
                            <CheckCircle className="w-3 h-3 mr-1 text-green-400" />
                          ) : schedule.lastStatus === 'failure' ? (
                            <XCircle className="w-3 h-3 mr-1 text-red-400" />
                          ) : null}
                          Last run: {new Date(schedule.lastRun).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center space-x-3 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {schedule.sourcePath}
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {schedule.destinationPath}
                      </span>
                      {schedule.compression !== 'none' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/20 text-blue-400 border border-blue-700">
                          {schedule.compression}
                        </span>
                      )}
                      {schedule.encryption && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/20 text-green-400 border border-green-700">
                          encrypted
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleToggleEnabled(schedule)}
                      className={`p-2 rounded-md transition-colors ${
                        schedule.enabled
                          ? 'text-green-400 hover:bg-green-900/20'
                          : 'text-slate-500 hover:bg-slate-800'
                      }`}
                      title={schedule.enabled ? 'Disable' : 'Enable'}
                    >
                      {schedule.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setEditingSchedule(schedule)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(schedule.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ScheduleModal
          servers={servers}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSchedule}
        />
      )}

      {/* Edit Modal */}
      {editingSchedule && (
        <ScheduleModal
          servers={servers}
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSubmit={(data) => handleUpdateSchedule(editingSchedule.id, data)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <DeleteConfirmModal
          onConfirm={() => handleDeleteSchedule(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}

interface ScheduleModalProps {
  servers: ServerOption[];
  schedule?: BackupSchedule;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

function ScheduleModal({ servers, schedule, onClose, onSubmit }: ScheduleModalProps) {
  const [formData, setFormData] = useState({
    serverId: schedule?.serverId || '',
    scheduleType: schedule?.scheduleType || 'daily',
    hour: schedule?.hour || 2,
    dayOfWeek: schedule?.dayOfWeek || 0,
    dayOfMonth: schedule?.dayOfMonth || 1,
    sourcePath: schedule?.sourcePath || '/var/backups',
    destinationPath: schedule?.destinationPath || '/backups',
    compression: schedule?.compression || 'gzip',
    encryption: schedule?.encryption || false,
    enabled: schedule?.enabled !== false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 z-40" onClick={onClose}></div>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full border border-slate-800">
            <div className="px-6 py-4 border-b border-slate-800">
              <h3 className="text-lg font-medium text-white">
                {schedule ? 'Edit Backup Schedule' : 'Create Backup Schedule'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4">
              {error && (
                <div className="mb-4 bg-red-900/20 border border-red-700 rounded-md p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Server Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Server</label>
                  <select
                    value={formData.serverId}
                    onChange={(e) => setFormData({ ...formData, serverId: e.target.value })}
                    className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={!!schedule}
                  >
                    <option value="">Select a server</option>
                    {servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Schedule Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Schedule Type</label>
                  <div className="flex space-x-4">
                    {['daily', 'weekly', 'monthly'].map((type) => (
                      <label key={type} className="inline-flex items-center">
                        <input
                          type="radio"
                          value={type}
                          checked={formData.scheduleType === type}
                          onChange={(e) =>
                            setFormData({ ...formData, scheduleType: e.target.value as any })
                          }
                          className="form-radio h-4 w-4 text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span className="ml-2 text-sm capitalize text-slate-300">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Hour */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Time (Hour)</label>
                  <select
                    value={formData.hour}
                    onChange={(e) => setFormData({ ...formData, hour: parseInt(e.target.value) })}
                    className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>

                {/* Day of Week (for weekly) */}
                {formData.scheduleType === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Day of Week</label>
                    <select
                      value={formData.dayOfWeek}
                      onChange={(e) =>
                        setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })
                      }
                      className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {DAYS_OF_WEEK.map((day, index) => (
                        <option key={index} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Day of Month (for monthly) */}
                {formData.scheduleType === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Day of Month</label>
                    <select
                      value={formData.dayOfMonth}
                      onChange={(e) =>
                        setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })
                      }
                      className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Source Path */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Source Path</label>
                  <input
                    type="text"
                    value={formData.sourcePath}
                    onChange={(e) => setFormData({ ...formData, sourcePath: e.target.value })}
                    className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="/var/www/data"
                    required
                  />
                </div>

                {/* Destination Path */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Destination Path</label>
                  <input
                    type="text"
                    value={formData.destinationPath}
                    onChange={(e) => setFormData({ ...formData, destinationPath: e.target.value })}
                    className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="/backups/data"
                    required
                  />
                </div>

                {/* Compression */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Compression</label>
                  <select
                    value={formData.compression}
                    onChange={(e) => setFormData({ ...formData, compression: e.target.value as any })}
                    className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {COMPRESSION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Encryption and Enabled */}
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.encryption}
                      onChange={(e) => setFormData({ ...formData, encryption: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700 rounded"
                    />
                    <span className="ml-2 text-sm text-slate-300">Enable encryption</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700 rounded"
                    />
                    <span className="ml-2 text-sm text-slate-300">Enable schedule</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : schedule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

interface DeleteConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 z-40" onClick={onCancel}></div>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-800">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-400 mr-3" />
              <h3 className="text-lg font-medium text-white">Delete Backup Schedule</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to delete this backup schedule? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
