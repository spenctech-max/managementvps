import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api, { handleApiError } from '../lib/api';
import { showSuccess, showError } from '../lib/toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { usePromptDialog } from '../components/PromptDialog';
import BitlaunchSettings from '../components/BitlaunchSettings';
import NotificationSettings from '../components/NotificationSettings';
import { User, Lock, Mail, Save, AlertCircle, CheckCircle, Shield, Smartphone, Copy, RefreshCw, XCircle, Bell } from 'lucide-react';

interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
}

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export default function Settings() {
  const { user } = useAuth();
  const { confirmDialog, showConfirm } = useConfirmDialog();
  const { promptDialog, showPrompt } = usePromptDialog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'integrations'>('profile');

  // 2FA State
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setLoading(true);
      await api.put(`/users/${user?.id}`, {
        username: profileData.username,
        email: profileData.email,
      });
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/users/${user?.id}/password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setSuccess('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // 2FA Functions
  useEffect(() => {
    fetchTwoFactorStatus();
  }, []);

  const fetchTwoFactorStatus = async () => {
    try {
      const response = await api.get('/auth/2fa/status');
      setTwoFactorStatus(response.data.data);
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    }
  };

  const handleSetup2FA = async () => {
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const response = await api.post('/auth/2fa/setup');
      setTwoFactorSetup(response.data.data);
      setShow2FASetup(true);
      setBackupCodes(response.data.data.backupCodes);
      setShowBackupCodes(true);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      await api.post('/auth/2fa/enable', { token: twoFactorToken });
      setSuccess('2FA enabled successfully! Please save your backup codes securely.');
      setShow2FASetup(false);
      setTwoFactorToken('');
      fetchTwoFactorStatus();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      await api.post('/auth/2fa/disable', { password: twoFactorPassword });
      setSuccess('2FA disabled successfully');
      setTwoFactorPassword('');
      setBackupCodes([]);
      setShowBackupCodes(false);
      fetchTwoFactorStatus();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const confirmed = await showConfirm({
      title: 'Regenerate Backup Codes',
      message: 'Are you sure you want to regenerate backup codes?\n\nYour old codes will no longer work.',
      variant: 'warning',
      confirmText: 'Regenerate Codes',
    });

    if (!confirmed) {
      return;
    }

    const password = await showPrompt({
      title: 'Enter Password',
      message: 'Please enter your password to regenerate backup codes',
      inputType: 'password',
      required: true,
      placeholder: 'Enter your password',
    });

    if (!password) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const response = await api.post('/auth/2fa/regenerate-backup-codes', {
        password,
      });
      setBackupCodes(response.data.data.backupCodes);
      setShowBackupCodes(true);
      setSuccess('Backup codes regenerated successfully! Please save them securely.');
      showSuccess('Backup codes regenerated successfully!');
    } catch (err) {
      setError(handleApiError(err));
      showError('Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard!');
  };

  const copyAllBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    copyToClipboard(codesText);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your account settings and preferences</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Information */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center mb-6">
            <User className="w-5 h-5 text-blue-400 mr-2" />
            <h2 className="text-xl font-semibold text-white">Account Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">User ID</label>
              <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-500 text-sm font-mono">
                {user?.id}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
              <div className="inline-flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                <Shield className="w-4 h-4 text-blue-400 mr-2" />
                <span className="text-white font-medium capitalize">{user?.role}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Member Since</label>
              <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center mb-6">
            <User className="w-5 h-5 text-blue-400 mr-2" />
            <h2 className="text-xl font-semibold text-white">Profile Settings</h2>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Username
              </label>
              <input
                type="text"
                value={profileData.username}
                onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Profile
            </button>
          </form>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Smartphone className="w-5 h-5 text-blue-400 mr-2" />
            <h2 className="text-xl font-semibold text-white">Two-Factor Authentication</h2>
          </div>
          {twoFactorStatus && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
              twoFactorStatus.enabled
                ? 'bg-green-900/20 text-green-400 border-green-700'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {twoFactorStatus.enabled ? 'Enabled' : 'Disabled'}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-400 mb-6">
          Add an extra layer of security to your account by enabling two-factor authentication using a mobile authenticator app.
        </p>

        {!twoFactorStatus?.enabled && !show2FASetup && (
          <button
            onClick={handleSetup2FA}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <Shield className="w-4 h-4 mr-2" />
            Enable 2FA
          </button>
        )}

        {show2FASetup && twoFactorSetup && (
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Step 1: Scan QR Code</h3>
              <p className="text-sm text-slate-400 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              <div className="flex justify-center bg-white p-4 rounded-lg mb-4">
                <img src={twoFactorSetup.qrCodeUrl} alt="2FA QR Code" className="w-64 h-64" />
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded p-3">
                <p className="text-xs text-slate-400 mb-1">Or enter this code manually:</p>
                <div className="flex items-center justify-between">
                  <code className="text-sm text-white font-mono">{twoFactorSetup.secret}</code>
                  <button
                    onClick={() => copyToClipboard(twoFactorSetup.secret)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {showBackupCodes && backupCodes.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6">
                <h3 className="text-lg font-medium text-yellow-400 mb-2">Important: Save Your Backup Codes</h3>
                <p className="text-sm text-yellow-300 mb-4">
                  Store these backup codes in a safe place. You can use them to access your account if you lose your phone.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="bg-slate-900 border border-slate-700 rounded p-2 font-mono text-sm text-white text-center">
                      {code}
                    </div>
                  ))}
                </div>
                <button
                  onClick={copyAllBackupCodes}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-yellow-700 text-sm font-medium rounded-md text-yellow-300 hover:bg-yellow-900/30"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All Codes
                </button>
              </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Step 2: Verify Code</h3>
              <form onSubmit={handleEnable2FA} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Enter the 6-digit code from your authenticator app
                  </label>
                  <input
                    type="text"
                    value={twoFactorToken}
                    onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={loading || twoFactorToken.length !== 6}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Enable 2FA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShow2FASetup(false);
                      setTwoFactorSetup(null);
                      setTwoFactorToken('');
                      setBackupCodes([]);
                      setShowBackupCodes(false);
                    }}
                    className="px-4 py-2 border border-slate-700 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {twoFactorStatus?.enabled && (
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">2FA Status</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Enabled on {twoFactorStatus.enabledAt ? new Date(twoFactorStatus.enabledAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-white">Backup Codes</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {twoFactorStatus.backupCodesRemaining} codes remaining
                  </p>
                </div>
                <button
                  onClick={handleRegenerateBackupCodes}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-1.5 border border-slate-700 text-xs font-medium rounded-md text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Regenerate
                </button>
              </div>
              {twoFactorStatus.backupCodesRemaining <= 2 && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded p-2 mt-2">
                  <p className="text-xs text-yellow-300">
                    Warning: You're running low on backup codes. Consider regenerating them.
                  </p>
                </div>
              )}
            </div>

            {showBackupCodes && backupCodes.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-yellow-400 mb-3">New Backup Codes</h4>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="bg-slate-900 border border-slate-700 rounded p-2 font-mono text-xs text-white text-center">
                      {code}
                    </div>
                  ))}
                </div>
                <button
                  onClick={copyAllBackupCodes}
                  className="w-full inline-flex justify-center items-center px-3 py-1.5 border border-yellow-700 text-xs font-medium rounded-md text-yellow-300 hover:bg-yellow-900/30"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy All Codes
                </button>
              </div>
            )}

            <form onSubmit={handleDisable2FA} className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center">
                <XCircle className="w-4 h-4 mr-2" />
                Disable Two-Factor Authentication
              </h4>
              <p className="text-xs text-red-300 mb-3">
                This will remove the extra security layer from your account. Enter your password to confirm.
              </p>
              <div className="flex space-x-3">
                <input
                  type="password"
                  value={twoFactorPassword}
                  onChange={(e) => setTwoFactorPassword(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-red-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-500"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  Disable
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center mb-6">
          <Lock className="w-5 h-5 text-blue-400 mr-2" />
          <h2 className="text-xl font-semibold text-white">Change Password</h2>
        </div>

        <form onSubmit={handlePasswordChange} className="max-w-2xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-slate-500">Must be at least 8 characters long</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4 mr-2" />
            Change Password
          </button>
        </form>
      </div>

      {/* Bitlaunch Integration */}
      {user?.role === 'admin' && <BitlaunchSettings />}

      {/* Application Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Application Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Version</p>
            <p className="text-white font-medium mt-1">1.0.0</p>
          </div>
          <div>
            <p className="text-slate-400">Environment</p>
            <p className="text-white font-medium mt-1">Production</p>
          </div>
          <div>
            <p className="text-slate-400">API Status</p>
            <p className="text-green-400 font-medium mt-1">Connected</p>
          </div>
        </div>
      </div>
      {confirmDialog}
      {promptDialog}
    </div>
  );
}
