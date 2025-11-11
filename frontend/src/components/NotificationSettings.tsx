import { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, Save, Send, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import api, { handleApiError } from '../lib/api';
import { showSuccess, showError } from '../lib/toast';

interface NotificationChannel {
  channel_type: 'email' | 'slack' | 'in_app';
  is_enabled: boolean;
  config: {
    // Email config
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_pass?: string;
    smtp_from?: string;
    recipients?: string[];
    // Slack config
    webhook_url?: string;
    channel?: string;
    // In-app config
    types?: string[];
  };
}

interface NotificationHistory {
  id: string;
  notification_type: string;
  severity: string;
  channel_type: string;
  status: string;
  sent_at: string;
  error_message?: string;
  created_at: string;
}

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Settings state
  const [emailSettings, setEmailSettings] = useState<NotificationChannel['config']>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    recipients: [],
  });
  const [emailEnabled, setEmailEnabled] = useState(false);

  const [slackSettings, setSlackSettings] = useState<NotificationChannel['config']>({
    webhook_url: '',
    channel: '#alerts',
  });
  const [slackEnabled, setSlackEnabled] = useState(false);

  const [inAppEnabled, setInAppEnabled] = useState(true);

  // Notification type preferences
  const [notificationTypes, setNotificationTypes] = useState({
    backup_complete: true,
    backup_failure: true,
    scan_complete: true,
    disk_space_critical: true,
    disk_space_warning: true,
    service_health_degraded: true,
  });

  // Recipient email input
  const [newRecipient, setNewRecipient] = useState('');

  // History state
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications/settings');
      const settings = response.data.data as NotificationChannel[];

      settings.forEach((setting) => {
        if (setting.channel_type === 'email') {
          setEmailSettings(setting.config);
          setEmailEnabled(setting.is_enabled);
        } else if (setting.channel_type === 'slack') {
          setSlackSettings(setting.config);
          setSlackEnabled(setting.is_enabled);
        } else if (setting.channel_type === 'in_app') {
          setInAppEnabled(setting.is_enabled);
        }
      });
    } catch (err) {
      setError(handleApiError(err));
      showError('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await api.get('/notifications/history', {
        params: { limit: 50 },
      });
      setHistory(response.data.data.history);
    } catch (err) {
      showError('Failed to load notification history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveSettings = async (channel: 'email' | 'slack' | 'in_app') => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      let config: any = {};
      let is_enabled = false;

      if (channel === 'email') {
        config = emailSettings;
        is_enabled = emailEnabled;
      } else if (channel === 'slack') {
        config = slackSettings;
        is_enabled = slackEnabled;
      } else if (channel === 'in_app') {
        config = { types: Object.keys(notificationTypes).filter(key => notificationTypes[key as keyof typeof notificationTypes]) };
        is_enabled = inAppEnabled;
      }

      await api.post('/notifications/settings', {
        channel_type: channel,
        is_enabled,
        config,
      });

      setSuccess(`${channel} notification settings saved successfully`);
      showSuccess(`${channel} settings saved`);
      fetchSettings();
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async (channel: 'email' | 'slack' | 'in_app') => {
    setTesting(channel);
    try {
      await api.post('/notifications/test', { channel });
      showSuccess(`Test notification sent via ${channel}`);
    } catch (err) {
      const errorMsg = handleApiError(err);
      showError(`Test failed: ${errorMsg}`);
    } finally {
      setTesting(null);
    }
  };

  const addRecipient = () => {
    if (!newRecipient) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newRecipient)) {
      showError('Invalid email address');
      return;
    }

    if (emailSettings.recipients?.includes(newRecipient)) {
      showError('Email already added');
      return;
    }

    setEmailSettings({
      ...emailSettings,
      recipients: [...(emailSettings.recipients || []), newRecipient],
    });
    setNewRecipient('');
  };

  const removeRecipient = (email: string) => {
    setEmailSettings({
      ...emailSettings,
      recipients: emailSettings.recipients?.filter(r => r !== email),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Bell className="w-6 h-6 mr-2 text-blue-400" />
          Notification Settings
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Configure how and when you receive notifications
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
          <p className="text-sm text-green-400">{success}</p>
        </div>
      )}

      {/* Email Notifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Mail className="w-5 h-5 text-blue-400 mr-2" />
            <h3 className="text-xl font-semibold text-white">Email Notifications</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">SMTP Host</label>
              <input
                type="text"
                value={emailSettings.smtp_host || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                placeholder="smtp.gmail.com"
                disabled={!emailEnabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">SMTP Port</label>
              <input
                type="number"
                value={emailSettings.smtp_port || 587}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                disabled={!emailEnabled}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">SMTP User</label>
              <input
                type="text"
                value={emailSettings.smtp_user || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                placeholder="your-email@gmail.com"
                disabled={!emailEnabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">SMTP Password</label>
              <input
                type="password"
                value={emailSettings.smtp_pass || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtp_pass: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Your SMTP password or app password"
                disabled={!emailEnabled}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">From Email</label>
            <input
              type="email"
              value={emailSettings.smtp_from || ''}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtp_from: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              placeholder="noreply@yourdomain.com"
              disabled={!emailEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Recipients</label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                placeholder="admin@yourdomain.com"
                disabled={!emailEnabled}
              />
              <button
                onClick={addRecipient}
                disabled={!emailEnabled}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {emailSettings.recipients?.map((email) => (
                <div key={email} className="inline-flex items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-1">
                  <span className="text-sm text-white mr-2">{email}</span>
                  <button
                    onClick={() => removeRecipient(email)}
                    disabled={!emailEnabled}
                    className="text-slate-400 hover:text-red-400"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={() => handleSaveSettings('email')}
              disabled={saving || !emailEnabled}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={() => handleTestNotification('email')}
              disabled={testing === 'email' || !emailEnabled}
              className="px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-400 hover:bg-blue-900/20"
            >
              <Send className="w-4 h-4 inline mr-2" />
              {testing === 'email' ? 'Sending...' : 'Test Email'}
            </button>
          </div>
        </div>
      </div>

      {/* Slack Notifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <MessageSquare className="w-5 h-5 text-blue-400 mr-2" />
            <h3 className="text-xl font-semibold text-white">Slack Notifications</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={slackEnabled}
              onChange={(e) => setSlackEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Webhook URL</label>
            <input
              type="text"
              value={slackSettings.webhook_url || ''}
              onChange={(e) => setSlackSettings({ ...slackSettings, webhook_url: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              placeholder="https://hooks.slack.com/services/..."
              disabled={!slackEnabled}
            />
            <p className="mt-1 text-xs text-slate-500">
              Create a webhook in your Slack workspace settings
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Channel</label>
            <input
              type="text"
              value={slackSettings.channel || ''}
              onChange={(e) => setSlackSettings({ ...slackSettings, channel: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              placeholder="#alerts"
              disabled={!slackEnabled}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={() => handleSaveSettings('slack')}
              disabled={saving || !slackEnabled}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={() => handleTestNotification('slack')}
              disabled={testing === 'slack' || !slackEnabled}
              className="px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-400 hover:bg-blue-900/20"
            >
              <Send className="w-4 h-4 inline mr-2" />
              {testing === 'slack' ? 'Sending...' : 'Test Slack'}
            </button>
          </div>
        </div>
      </div>

      {/* In-App Notifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-blue-400 mr-2" />
            <h3 className="text-xl font-semibold text-white">In-App Notifications</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={inAppEnabled}
              onChange={(e) => setInAppEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-slate-400 mb-4">Choose which notification types to receive:</p>

          {Object.entries(notificationTypes).map(([key, value]) => (
            <label key={key} className="flex items-center p-3 bg-slate-800 rounded-lg hover:bg-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setNotificationTypes({ ...notificationTypes, [key]: e.target.checked })}
                disabled={!inAppEnabled}
                className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-white capitalize">{key.replace(/_/g, ' ')}</span>
            </label>
          ))}

          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={() => handleSaveSettings('in_app')}
              disabled={saving || !inAppEnabled}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={() => handleTestNotification('in_app')}
              disabled={testing === 'in_app' || !inAppEnabled}
              className="px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-400 hover:bg-blue-900/20"
            >
              <Send className="w-4 h-4 inline mr-2" />
              {testing === 'in_app' ? 'Sending...' : 'Test In-App'}
            </button>
          </div>
        </div>
      </div>

      {/* Notification History */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Notification History</h3>
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory && history.length === 0) {
                fetchHistory();
              }
            }}
            className="px-4 py-2 border border-slate-700 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-800"
          >
            {showHistory ? 'Hide' : 'Show'} History
          </button>
        </div>

        {showHistory && (
          <div className="mt-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No notification history found</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {history.map((item) => (
                  <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.severity === 'critical' ? 'bg-red-900/20 text-red-400 border border-red-700' :
                            item.severity === 'warning' ? 'bg-yellow-900/20 text-yellow-400 border border-yellow-700' :
                            item.severity === 'success' ? 'bg-green-900/20 text-green-400 border border-green-700' :
                            'bg-blue-900/20 text-blue-400 border border-blue-700'
                          }`}>
                            {item.severity}
                          </span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300">
                            {item.channel_type}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.status === 'sent' ? 'bg-green-900/20 text-green-400 border border-green-700' :
                            'bg-red-900/20 text-red-400 border border-red-700'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-sm text-white mt-2 capitalize">{item.notification_type.replace(/_/g, ' ')}</p>
                        {item.error_message && (
                          <p className="text-xs text-red-400 mt-1">{item.error_message}</p>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(item.sent_at || item.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
