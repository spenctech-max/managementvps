import { useState, useEffect } from 'react';
import { X, RotateCcw, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import api, { handleApiError } from '../lib/api';
import RestoreJobStatus from './RestoreJobStatus';

interface RestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  backup: {
    id: string;
    server_name: string;
    server_ip: string;
    backup_type: string;
    size: number;
    created_at: string;
  };
  onRestoreComplete?: () => void;
}

interface RestorePreview {
  backup: {
    id: string;
    backupType: string;
    createdAt: string;
    fileSize: number;
    serverName: string;
  };
  restoreType: string;
  services: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    configPaths: string[];
    dataPaths: string[];
    backupPriority: string;
  }>;
  servicesCount: number;
  estimatedDuration: number;
}

interface RestoreJobResponse {
  success: boolean;
  message: string;
  data: {
    restoreJobId: string;
    servicesRestored: string[];
    servicesFailed: string[];
    duration: number;
    rolledBack: boolean;
  };
}

export default function RestoreDialog({ isOpen, onClose, backup, onRestoreComplete }: RestoreDialogProps) {
  const [step, setStep] = useState<'options' | 'preview' | 'progress' | 'result'>('options');
  const [restoreType, setRestoreType] = useState<'full' | 'selective'>('full');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [verifyIntegrity, setVerifyIntegrity] = useState(true);
  const [createRollbackPoint, setCreateRollbackPoint] = useState(true);
  const [skipHealthChecks, setSkipHealthChecks] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreJobResponse['data'] | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setStep('options');
      setRestoreType('full');
      setSelectedServices([]);
      setVerifyIntegrity(true);
      setCreateRollbackPoint(true);
      setSkipHealthChecks(false);
      setError('');
      setPreview(null);
      setRestoreJobId(null);
      setRestoreResult(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (step === 'progress') {
      // Don't allow closing during restore
      return;
    }
    onClose();
  };

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        restoreType,
        ...(restoreType === 'selective' && selectedServices.length > 0 ? { selectedServices: selectedServices.join(',') } : {})
      });
      const response = await api.get(`/backups/${backup.id}/restore-preview?${params}`);
      setPreview(response.data.data);
      setStep('preview');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToPreview = async () => {
    if (restoreType === 'selective' && selectedServices.length === 0) {
      setError('Please select at least one service for selective restore');
      return;
    }
    await fetchPreview();
  };

  const handleStartRestore = async () => {
    try {
      setLoading(true);
      setError('');
      setStep('progress');

      const response = await api.post(`/backups/${backup.id}/restore`, {
        restoreType,
        selectedServices: restoreType === 'selective' ? selectedServices : undefined,
        verifyIntegrity,
        createRollbackPoint,
        skipHealthChecks,
      });

      const result: RestoreJobResponse = response.data;
      setRestoreJobId(result.data.restoreJobId);
      setRestoreResult(result.data);

      // Poll for completion
      pollRestoreStatus(result.data.restoreJobId);
    } catch (err) {
      setError(handleApiError(err));
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const pollRestoreStatus = async (jobId: string) => {
    const maxAttempts = 120; // 10 minutes max (5 second intervals)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await api.get(`/backups/restore-jobs/${jobId}`);
        const job = response.data.data;

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'rolled_back') {
          setRestoreResult({
            restoreJobId: job.id,
            servicesRestored: job.services_restored || [],
            servicesFailed: job.services_failed || [],
            duration: job.completed_at ?
              (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000 : 0,
            rolledBack: job.status === 'rolled_back',
          });
          setStep('result');
          if (onRestoreComplete) {
            onRestoreComplete();
          }
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setError('Restore operation timed out. Please check the restore jobs page for status.');
          setStep('result');
        }
      } catch (err) {
        setError(handleApiError(err));
        setStep('result');
      }
    };

    poll();
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 bg-blue-900/20 rounded-full p-3">
              <RotateCcw className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Restore Backup</h3>
              <p className="text-sm text-slate-400">
                {backup.server_name} ({backup.server_ip})
              </p>
            </div>
          </div>
          {step !== 'progress' && (
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="m-6 bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Options Step */}
        {step === 'options' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Restore Type</label>
              <div className="space-y-2">
                <label className="flex items-center p-4 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-750">
                  <input
                    type="radio"
                    value="full"
                    checked={restoreType === 'full'}
                    onChange={(e) => setRestoreType(e.target.value as 'full')}
                    className="mr-3"
                  />
                  <div>
                    <div className="text-white font-medium">Full Restore</div>
                    <div className="text-sm text-slate-400">
                      Restore all services and data from this backup
                    </div>
                  </div>
                </label>
                <label className="flex items-center p-4 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-750">
                  <input
                    type="radio"
                    value="selective"
                    checked={restoreType === 'selective'}
                    onChange={(e) => setRestoreType(e.target.value as 'selective')}
                    className="mr-3"
                  />
                  <div>
                    <div className="text-white font-medium">Selective Restore</div>
                    <div className="text-sm text-slate-400">
                      Choose specific services to restore
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={verifyIntegrity}
                  onChange={(e) => setVerifyIntegrity(e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <div className="text-white text-sm font-medium">Verify Backup Integrity</div>
                  <div className="text-xs text-slate-400">
                    Check backup file before restoring (recommended)
                  </div>
                </div>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={createRollbackPoint}
                  onChange={(e) => setCreateRollbackPoint(e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <div className="text-white text-sm font-medium">Create Rollback Point</div>
                  <div className="text-xs text-slate-400">
                    Create snapshot before restore for automatic rollback on failure
                  </div>
                </div>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={skipHealthChecks}
                  onChange={(e) => setSkipHealthChecks(e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <div className="text-white text-sm font-medium">Skip Health Checks</div>
                  <div className="text-xs text-slate-400">
                    Skip post-restore service health verification (not recommended)
                  </div>
                </div>
              </label>
            </div>

            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 flex items-start">
              <Info className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">Important Information</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Services will be stopped during restore</li>
                  <li>Restore can take several minutes depending on data size</li>
                  <li>Automatic rollback will occur if restore fails (if rollback point is enabled)</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-slate-700 rounded-md text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleContinueToPreview}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && preview && (
          <div className="p-6 space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Restore Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-400">Backup Type</div>
                  <div className="text-white">{preview.backup.backupType}</div>
                </div>
                <div>
                  <div className="text-slate-400">Backup Size</div>
                  <div className="text-white">{formatBytes(preview.backup.fileSize)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Services to Restore</div>
                  <div className="text-white">{preview.servicesCount} services</div>
                </div>
                <div>
                  <div className="text-slate-400">Estimated Duration</div>
                  <div className="text-white">{formatDuration(preview.estimatedDuration)}</div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-white mb-3">Services ({preview.services.length})</h4>
              <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  {preview.services.map((service) => (
                    <div
                      key={service.id}
                      className="p-4 border-b border-slate-700 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-white font-medium">{service.name}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Type: {service.type} | Priority: {service.backupPriority}
                          </div>
                        </div>
                        {restoreType === 'selective' && (
                          <input
                            type="checkbox"
                            checked={selectedServices.includes(service.id)}
                            onChange={() => toggleService(service.id)}
                            className="ml-3"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setStep('options')}
                className="px-4 py-2 border border-slate-700 rounded-md text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700"
              >
                Back
              </button>
              <button
                onClick={handleStartRestore}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
              >
                {loading ? 'Starting...' : 'Start Restore'}
              </button>
            </div>
          </div>
        )}

        {/* Progress Step */}
        {step === 'progress' && restoreJobId && (
          <div className="p-6">
            <RestoreJobStatus restoreJobId={restoreJobId} />
          </div>
        )}

        {/* Result Step */}
        {step === 'result' && restoreResult && (
          <div className="p-6 space-y-6">
            <div className={`border rounded-lg p-6 flex items-start ${
              restoreResult.rolledBack
                ? 'bg-yellow-900/20 border-yellow-700'
                : restoreResult.servicesFailed.length === 0
                ? 'bg-green-900/20 border-green-700'
                : 'bg-red-900/20 border-red-700'
            }`}>
              <div className="flex-shrink-0 mr-4">
                {restoreResult.rolledBack ? (
                  <AlertCircle className="w-8 h-8 text-yellow-400" />
                ) : restoreResult.servicesFailed.length === 0 ? (
                  <CheckCircle className="w-8 h-8 text-green-400" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <h4 className={`text-lg font-semibold ${
                  restoreResult.rolledBack
                    ? 'text-yellow-400'
                    : restoreResult.servicesFailed.length === 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {restoreResult.rolledBack
                    ? 'Restore Failed - Rolled Back'
                    : restoreResult.servicesFailed.length === 0
                    ? 'Restore Completed Successfully'
                    : 'Restore Completed with Errors'}
                </h4>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-white">
                    <span>Services Restored:</span>
                    <span className="font-medium">{restoreResult.servicesRestored.length}</span>
                  </div>
                  {restoreResult.servicesFailed.length > 0 && (
                    <div className="flex items-center justify-between text-white">
                      <span>Services Failed:</span>
                      <span className="font-medium">{restoreResult.servicesFailed.length}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-white">
                    <span>Duration:</span>
                    <span className="font-medium">{formatDuration(restoreResult.duration)}</span>
                  </div>
                </div>
                {restoreResult.servicesFailed.length > 0 && (
                  <div className="mt-4 bg-slate-800 rounded p-3">
                    <div className="text-xs font-medium text-slate-400 mb-2">Failed Services:</div>
                    <div className="text-xs text-slate-300">
                      {restoreResult.servicesFailed.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
