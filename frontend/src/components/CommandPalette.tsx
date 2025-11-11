import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Command } from 'cmdk';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Server,
  Package,
  ScanLine,
  Archive,
  Users,
  Settings,
  LogOut,
  Calendar,
  Activity,
  GitCompare,
  Plus,
  Play,
  Lock,
  Shield,
  Search,
  FileText,
  Database,
  RefreshCw,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: 'navigation' | 'actions' | 'recent' | 'settings';
  keywords?: string[];
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Toggle command palette with Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on escape
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate]
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
    setOpen(false);
  }, [logout, navigate]);

  // Navigation commands
  const navigationCommands: CommandItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      description: 'View system overview and statistics',
      icon: LayoutDashboard,
      action: () => handleNavigate('/dashboard'),
      category: 'navigation',
      keywords: ['home', 'overview', 'stats'],
    },
    {
      id: 'nav-servers',
      label: 'Servers',
      description: 'Manage and monitor servers',
      icon: Server,
      action: () => handleNavigate('/servers'),
      category: 'navigation',
      keywords: ['machines', 'hosts'],
    },
    {
      id: 'nav-services',
      label: 'Services',
      description: 'View and manage services',
      icon: Package,
      action: () => handleNavigate('/services'),
      category: 'navigation',
      keywords: ['packages', 'apps'],
    },
    {
      id: 'nav-scans',
      label: 'Scans',
      description: 'View security scan results',
      icon: ScanLine,
      action: () => handleNavigate('/scans'),
      category: 'navigation',
      keywords: ['security', 'vulnerability', 'scan'],
    },
    {
      id: 'nav-scan-compare',
      label: 'Scan Comparison',
      description: 'Compare scan results',
      icon: GitCompare,
      action: () => handleNavigate('/scan-comparison'),
      category: 'navigation',
      keywords: ['compare', 'diff', 'changes'],
    },
    {
      id: 'nav-backups',
      label: 'Backups',
      description: 'Manage backup files',
      icon: Archive,
      action: () => handleNavigate('/backups'),
      category: 'navigation',
      keywords: ['restore', 'archive'],
    },
    {
      id: 'nav-schedules',
      label: 'Backup Schedules',
      description: 'Manage backup schedules',
      icon: Calendar,
      action: () => handleNavigate('/backup-schedules'),
      category: 'navigation',
      keywords: ['cron', 'schedule', 'automatic'],
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      description: 'Configure your account',
      icon: Settings,
      action: () => handleNavigate('/settings'),
      category: 'navigation',
      keywords: ['preferences', 'config'],
    },
  ];

  // Add admin-only navigation
  if (user?.role === 'admin') {
    navigationCommands.push(
      {
        id: 'nav-users',
        label: 'Users',
        description: 'Manage user accounts',
        icon: Users,
        action: () => handleNavigate('/users'),
        category: 'navigation',
        keywords: ['accounts', 'team'],
      },
      {
        id: 'nav-health',
        label: 'Health Dashboard',
        description: 'System health monitoring',
        icon: Activity,
        action: () => handleNavigate('/health'),
        category: 'navigation',
        keywords: ['status', 'monitor', 'uptime'],
      }
    );
  }

  // Quick action commands
  const actionCommands: CommandItem[] = [
    {
      id: 'action-new-server',
      label: 'New Server',
      description: 'Add a new server to monitor',
      icon: Plus,
      action: () => {
        handleNavigate('/servers');
        // Note: You can trigger a modal here if you have one
      },
      category: 'actions',
      keywords: ['add', 'create', 'register'],
    },
    {
      id: 'action-start-scan',
      label: 'Start Scan',
      description: 'Initiate a new security scan',
      icon: Play,
      action: () => {
        handleNavigate('/scans');
        // Note: You can trigger scan start here
      },
      category: 'actions',
      keywords: ['run', 'execute', 'security'],
    },
    {
      id: 'action-create-backup',
      label: 'Create Backup',
      description: 'Create a new backup',
      icon: Database,
      action: () => {
        handleNavigate('/backups');
        // Note: You can trigger backup creation here
      },
      category: 'actions',
      keywords: ['save', 'archive'],
    },
    {
      id: 'action-refresh',
      label: 'Refresh Data',
      description: 'Reload current page data',
      icon: RefreshCw,
      action: () => {
        window.location.reload();
        setOpen(false);
      },
      category: 'actions',
      keywords: ['reload', 'update'],
    },
  ];

  // Settings commands
  const settingsCommands: CommandItem[] = [
    {
      id: 'settings-account',
      label: 'Account Settings',
      description: 'Manage your account',
      icon: Settings,
      action: () => handleNavigate('/settings'),
      category: 'settings',
      keywords: ['profile', 'preferences'],
    },
    {
      id: 'settings-security',
      label: 'Security Settings',
      description: 'Configure security options',
      icon: Shield,
      action: () => handleNavigate('/settings'),
      category: 'settings',
      keywords: ['2fa', 'password', 'auth'],
    },
    {
      id: 'settings-change-password',
      label: 'Change Password',
      description: 'Update your password',
      icon: Lock,
      action: () => handleNavigate('/settings'),
      category: 'settings',
      keywords: ['security', 'credentials'],
    },
    {
      id: 'action-logout',
      label: 'Logout',
      description: 'Sign out of your account',
      icon: LogOut,
      action: handleLogout,
      category: 'settings',
      keywords: ['sign out', 'exit'],
    },
  ];

  // Combine all commands
  const allCommands = [
    ...navigationCommands,
    ...actionCommands,
    ...settingsCommands,
  ];

  // Group commands by category
  const groupedCommands = {
    navigation: allCommands.filter((cmd) => cmd.category === 'navigation'),
    actions: allCommands.filter((cmd) => cmd.category === 'actions'),
    settings: allCommands.filter((cmd) => cmd.category === 'settings'),
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Command Palette */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
          <Command
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
            }}
          >
            {/* Search Input */}
            <div className="flex items-center border-b border-slate-800 px-4">
              <Search className="w-5 h-5 text-slate-400 mr-3" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Type a command or search..."
                className="w-full bg-transparent py-4 text-white placeholder-slate-500 outline-none text-base"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 text-xs text-slate-400">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <Command.List className="max-h-[400px] overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-slate-500">
                No results found.
              </Command.Empty>

              {/* Navigation Group */}
              {groupedCommands.navigation.length > 0 && (
                <Command.Group
                  heading="Navigation"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {groupedCommands.navigation.map((command) => {
                    const Icon = command.icon;
                    return (
                      <Command.Item
                        key={command.id}
                        value={`${command.label} ${command.description} ${command.keywords?.join(' ')}`}
                        onSelect={() => command.action()}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer text-slate-300 aria-selected:bg-slate-800 aria-selected:text-white transition-colors mb-1"
                      >
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800/50 aria-selected:bg-slate-700">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{command.label}</div>
                          {command.description && (
                            <div className="text-xs text-slate-500 truncate">
                              {command.description}
                            </div>
                          )}
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {/* Quick Actions Group */}
              {groupedCommands.actions.length > 0 && (
                <Command.Group
                  heading="Quick Actions"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider mt-2"
                >
                  {groupedCommands.actions.map((command) => {
                    const Icon = command.icon;
                    return (
                      <Command.Item
                        key={command.id}
                        value={`${command.label} ${command.description} ${command.keywords?.join(' ')}`}
                        onSelect={() => command.action()}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer text-slate-300 aria-selected:bg-slate-800 aria-selected:text-white transition-colors mb-1"
                      >
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 aria-selected:from-blue-600/30 aria-selected:to-purple-600/30">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{command.label}</div>
                          {command.description && (
                            <div className="text-xs text-slate-500 truncate">
                              {command.description}
                            </div>
                          )}
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {/* Settings Group */}
              {groupedCommands.settings.length > 0 && (
                <Command.Group
                  heading="Settings"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider mt-2"
                >
                  {groupedCommands.settings.map((command) => {
                    const Icon = command.icon;
                    const isLogout = command.id === 'action-logout';
                    return (
                      <Command.Item
                        key={command.id}
                        value={`${command.label} ${command.description} ${command.keywords?.join(' ')}`}
                        onSelect={() => command.action()}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                          isLogout
                            ? 'text-red-400 aria-selected:bg-red-900/20 aria-selected:text-red-300'
                            : 'text-slate-300 aria-selected:bg-slate-800 aria-selected:text-white'
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center w-9 h-9 rounded-lg ${
                            isLogout
                              ? 'bg-red-900/20 aria-selected:bg-red-900/30'
                              : 'bg-slate-800/50 aria-selected:bg-slate-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{command.label}</div>
                          {command.description && (
                            <div className="text-xs text-slate-500 truncate">
                              {command.description}
                            </div>
                          )}
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
            </Command.List>

            {/* Footer */}
            <div className="border-t border-slate-800 px-4 py-3 bg-slate-900/50">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400">
                      ↑↓
                    </kbd>
                    <span>Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400">
                      ↵
                    </kbd>
                    <span>Select</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400">
                      ESC
                    </kbd>
                    <span>Close</span>
                  </div>
                </div>
                <div className="hidden sm:block text-slate-600">
                  Press{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                    ⌘K
                  </kbd>{' '}
                  to toggle
                </div>
              </div>
            </div>
          </Command>
        </div>
      </div>
    </div>
  );
}
