import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Zap, Loader, Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react';
import api, { handleApiError } from '../lib/api';
import { showSuccess, showError } from '../lib/toast';
import { useConfirmDialog } from './ConfirmDialog';

interface BitlaunchStatus {
  isConnected: boolean;
  apiKeySet: boolean;
  lastSyncTime: string | null;
  lastError: string | null;
  syncInProgress: boolean;
}

export default function BitlaunchSettings() {
  const { confirmDialog, showConfirm } = useConfirmDialog();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [status, setStatus] = useState<BitlaunchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await api.get('/bitlaunch/status');
      setStatus(response.data.data);
    } catch (err) {
      console.error('Failed to fetch Bitlaunch status:', err);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    try {
      setLoading(true);
      await api.post('/bitlaunch/config', { apiKey: apiKey.trim() });
      setSuccess('API key configured successfully!');
      setApiKey('');
      fetchStatus();
      showSuccess('API key saved successfully!');
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setError('');
    setSuccess('');

    try {
      setTesting(true);
      const response = await api.post('/bitlaunch/test');
      setSuccess('Connection successful! API key is valid.');
      showSuccess('Connection successful!');
      fetchStatus();
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleManualSync = async () => {
    setError('');
    setSuccess('');

    try {
      setSyncing(true);
      const response = await api.post('/bitlaunch/sync');
      setSuccess('Data synchronized successfully!');
      showSuccess('Bitlaunch data synced successfully!');
      fetchStatus();
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setSyncing(false);
    }
  };

  const handleRemoveApiKey = async () => {
    const confirmed = await showConfirm({
      title: 'Remove Bitlaunch Integration',
      message: 'Are you sure you want to remove the Bitlaunch API key? This will disconnect the integration.',
      variant: 'danger',
      confirmText: 'Remove',
    });

    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      setLoading(true);
      await api.delete('/bitlaunch/config');
      setSuccess('Bitlaunch integration removed');
      showSuccess('Integration removed successfully!');
      setApiKey('');
      fetchStatus();
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
      {confirmDialog}

      <div className="flex items-center mb-6">
        <Zap className="w-5 h-5 text-yellow-400 mr-2" />
        <h2 className="text-xl font-semibold text-white">Bitlaunch Integration</h2>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-900/20 border border-green-700 rounded-lg p-3 flex items-start">
          <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-400">{success}</p>
        </div>
      )}

      {/* Status Display */}
      {status && (
        <div className="mb-6 space-y-3">
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">Connection Status</span>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  status.isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-sm font-medium ${
                  status.isConnected ? 'text-green-400' : 'text-red-400'
                }`}>
                  {status.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {status.lastError ? `Error: ${status.lastError}` : 'Ready to use'}
            </p>
          </div>

          {status.lastSyncTime && (
            <div className="bg-slate-800 rounded-lg p-4">
              <span className="text-sm font-medium text-slate-400">Last Sync</span>
              <p className="text-sm text-slate-300 mt-1">
                {new Date(status.lastSyncTime).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* API Key Configuration */}
      {!status?.apiKeySet ? (
        <form onSubmit={handleSaveApiKey} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Bitlaunch API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Bitlaunch API key from https://developers.bitlaunch.io/"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-400"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Get your API key from <a href="https://developers.bitlaunch.io/" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:text-yellow-300">Bitlaunch Developer Console</a>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save API Key'
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">API Key Status</p>
            <p className="text-sm text-green-400 font-medium">✓ API key is configured</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition text-sm flex items-center justify-center"
            >
              {testing ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>

            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition text-sm flex items-center justify-center"
            >
              {syncing ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Manual Sync
                </>
              )}
            </button>
          </div>

          <button
            onClick={handleRemoveApiKey}
            disabled={loading}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center justify-center text-sm"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Integration
              </>
            )}
          </button>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        The Bitlaunch integration allows all users to view your account balance and performance metrics from the dashboard. Data is cached and synced automatically every 5 minutes.
      </p>
    </div>
  );
}
