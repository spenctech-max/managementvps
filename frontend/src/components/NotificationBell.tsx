import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, ExternalLink, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { handleApiError } from '../lib/api';
import { showSuccess, showError } from '../lib/toast';

interface InAppNotification {
  id: string;
  notification_type: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  action_url?: string;
  metadata?: any;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications/in-app', {
        params: { limit: 20 },
      });
      const notifs = response.data.data as InAppNotification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);

      // Show toast for critical unread notifications
      const criticalUnread = notifs.filter(n => !n.is_read && n.severity === 'critical');
      if (criticalUnread.length > 0 && !isOpen) {
        criticalUnread.forEach(notif => {
          showError(notif.title, 8000);
        });
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/in-app/${id}/read`);
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      showError('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      setLoading(true);
      await api.patch('/notifications/in-app/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);
      showSuccess('All notifications marked as read');
    } catch (err) {
      showError('Failed to mark all as read');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-900/20 border-red-700';
      case 'warning':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-700';
      case 'success':
        return 'text-green-400 bg-green-900/20 border-green-700';
      default:
        return 'text-blue-400 bg-blue-900/20 border-blue-700';
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchNotifications();
          }
        }}
        className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Bell className="w-5 h-5 mr-2 text-blue-400" />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Bell className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-800/50 transition-colors ${
                      !notification.is_read ? 'bg-slate-800/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="flex-shrink-0 mt-1">
                        {!notification.is_read ? (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="w-2.5 h-2.5 bg-blue-500 rounded-full hover:bg-blue-400"
                            title="Mark as read"
                          />
                        ) : (
                          <div className="w-2.5 h-2.5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-medium text-white line-clamp-1">
                            {notification.title}
                          </h4>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {getRelativeTime(notification.created_at)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                          {notification.message}
                        </p>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(notification.severity)}`}>
                            {notification.severity}
                          </span>
                          {notification.action_url && (
                            <Link
                              to={notification.action_url}
                              onClick={() => {
                                setIsOpen(false);
                                if (!notification.is_read) {
                                  markAsRead(notification.id);
                                }
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                            >
                              View
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Mark as read button */}
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="flex-shrink-0 text-slate-400 hover:text-blue-400"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-800">
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center text-sm text-blue-400 hover:text-blue-300"
              >
                View notification settings
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
