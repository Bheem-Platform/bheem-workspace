/**
 * Bheem Workspace - Security Dashboard
 * Monitor security metrics, audit logs, and active sessions
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Users,
  Key,
  Activity,
  Globe,
  Smartphone,
  Monitor,
  Clock,
  XCircle,
  RefreshCw,
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  UserPlus,
  Lock,
  Unlock,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface SecurityDashboardData {
  users_with_2fa: number;
  total_users: number;
  recent_logins: LoginEvent[];
  suspicious_activity: SuspiciousActivity[];
  active_sessions: number;
  password_health: {
    strong: number;
    medium: number;
    weak: number;
  };
}

interface LoginEvent {
  id: string;
  user_email: string;
  user_name: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  created_at: string;
  location?: string;
}

interface SuspiciousActivity {
  id: string;
  type: string;
  severity: string;
  message: string;
  user_email?: string;
  ip_address?: string;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  user_id: string;
  user_email?: string;
  ip_address: string;
  extra_data: Record<string, any>;
  created_at: string;
}

interface ActiveSession {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  ip_address: string;
  device_name: string;
  device_type: string;
  location: string;
  last_activity: string;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  login: <LogIn size={16} />,
  logout: <LogOut size={16} />,
  login_failed: <XCircle size={16} />,
  user_created: <UserPlus size={16} />,
  password_changed: <Key size={16} />,
  '2fa_enabled': <Lock size={16} />,
  '2fa_disabled': <Unlock size={16} />,
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function SecurityDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useRequireAuth();
  const tenantId = useCurrentTenantId();

  const [dashboard, setDashboard] = useState<SecurityDashboardData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'sessions'>('overview');

  // Filter states
  const [auditFilter, setAuditFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    fetchDashboard();
    fetchAuditLogs();
    fetchSessions();
  }, [isAuthenticated, isLoading, tenantId]);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/security/dashboard');
      setDashboard(res.data);
    } catch (err) {
      console.error('Failed to fetch security dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/security/audit-log', {
        params: {
          limit: 50,
          action_type: auditFilter || undefined,
        }
      });
      setAuditLogs(res.data.logs || res.data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get('/security/sessions');
      setSessions(res.data.sessions || res.data || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this session?')) return;
    try {
      await api.delete(`/security/sessions/${sessionId}`);
      fetchSessions();
    } catch (err) {
      console.error('Failed to terminate session:', err);
    }
  };

  const exportAuditLog = async () => {
    try {
      const res = await api.get('/security/audit-log/export', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-log-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export audit log:', err);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'mobile': return <Smartphone size={16} />;
      case 'desktop': return <Monitor size={16} />;
      default: return <Globe size={16} />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (isLoading || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  const twoFaPercentage = dashboard?.total_users
    ? Math.round((dashboard.users_with_2fa / dashboard.total_users) * 100)
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="text-blue-600" />
              Security Dashboard
            </h1>
            <p className="text-gray-600">Monitor security metrics and audit activity</p>
          </div>
          <button
            onClick={() => {
              fetchDashboard();
              fetchAuditLogs();
              fetchSessions();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={20} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'audit', label: 'Audit Log' },
              { id: 'sessions', label: 'Active Sessions' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && dashboard && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 2FA Adoption */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-green-100 rounded-xl text-green-600">
                    <Key size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">2FA Enabled</p>
                    <p className="text-2xl font-bold text-gray-900">{twoFaPercentage}%</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${twoFaPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {dashboard.users_with_2fa} of {dashboard.total_users} users
                </p>
              </div>

              {/* Active Sessions */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                    <Activity size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboard.active_sessions}</p>
                  </div>
                </div>
              </div>

              {/* Recent Logins */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                    <LogIn size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Logins (24h)</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboard.recent_logins?.length || 0}</p>
                  </div>
                </div>
              </div>

              {/* Suspicious Activity */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    (dashboard.suspicious_activity?.length || 0) > 0
                      ? 'bg-red-100 text-red-600'
                      : 'bg-green-100 text-green-600'
                  }`}>
                    {(dashboard.suspicious_activity?.length || 0) > 0
                      ? <AlertTriangle size={24} />
                      : <CheckCircle size={24} />
                    }
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Security Alerts</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboard.suspicious_activity?.length || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Password Health */}
            {dashboard.password_health && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Password Health</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-green-600">Strong</span>
                      <span>{dashboard.password_health.strong}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${(dashboard.password_health.strong / dashboard.total_users) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-amber-600">Medium</span>
                      <span>{dashboard.password_health.medium}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{
                          width: `${(dashboard.password_health.medium / dashboard.total_users) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-red-600">Weak</span>
                      <span>{dashboard.password_health.weak}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{
                          width: `${(dashboard.password_health.weak / dashboard.total_users) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Security Alerts */}
            {dashboard.suspicious_activity && dashboard.suspicious_activity.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-500" />
                  Recent Security Alerts
                </h3>
                <div className="space-y-3">
                  {dashboard.suspicious_activity.map(activity => (
                    <div
                      key={activity.id}
                      className={`p-4 rounded-lg border ${SEVERITY_COLORS[activity.severity] || 'bg-gray-100'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{activity.message}</p>
                          <p className="text-sm opacity-75 mt-1">
                            {activity.user_email && `User: ${activity.user_email}`}
                            {activity.ip_address && ` • IP: ${activity.ip_address}`}
                          </p>
                        </div>
                        <span className="text-xs opacity-75">
                          {formatTimeAgo(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Logins */}
            {dashboard.recent_logins && dashboard.recent_logins.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Recent Login Activity</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <th className="pb-3 font-medium">User</th>
                        <th className="pb-3 font-medium">IP Address</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dashboard.recent_logins.slice(0, 10).map(login => (
                        <tr key={login.id} className="text-sm">
                          <td className="py-3">
                            <div>
                              <p className="font-medium text-gray-900">{login.user_name}</p>
                              <p className="text-gray-500">{login.user_email}</p>
                            </div>
                          </td>
                          <td className="py-3 text-gray-600">{login.ip_address}</td>
                          <td className="py-3">
                            {login.success ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                <CheckCircle size={12} /> Success
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                                <XCircle size={12} /> Failed
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-gray-500">{formatTimeAgo(login.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search audit logs..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={auditFilter}
                onChange={(e) => {
                  setAuditFilter(e.target.value);
                  fetchAuditLogs();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Actions</option>
                <option value="login">Login</option>
                <option value="login_failed">Failed Login</option>
                <option value="logout">Logout</option>
                <option value="user_created">User Created</option>
                <option value="password_changed">Password Changed</option>
              </select>
              <button
                onClick={exportAuditLog}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download size={20} />
                Export
              </button>
            </div>

            {/* Audit Log Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-sm text-gray-500">
                      <th className="px-6 py-4 font-medium">Action</th>
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">IP Address</th>
                      <th className="px-6 py-4 font-medium">Details</th>
                      <th className="px-6 py-4 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditLogs
                      .filter(log =>
                        !auditSearch ||
                        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                        log.user_email?.toLowerCase().includes(auditSearch.toLowerCase())
                      )
                      .map(log => (
                        <tr key={log.id} className="text-sm hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">
                                {ACTION_ICONS[log.action] || <Activity size={16} />}
                              </span>
                              <span className="font-medium text-gray-900 capitalize">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{log.user_email || log.user_id}</td>
                          <td className="px-6 py-4 text-gray-600 font-mono text-xs">{log.ip_address}</td>
                          <td className="px-6 py-4 text-gray-500 text-xs max-w-xs truncate">
                            {JSON.stringify(log.extra_data)}
                          </td>
                          <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {auditLogs.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No audit logs found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <p className="text-sm text-gray-600">
                  {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="divide-y">
                {sessions.map(session => (
                  <div key={session.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-100 rounded-xl text-gray-600">
                          {getDeviceIcon(session.device_type)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{session.user_name}</p>
                          <p className="text-sm text-gray-500">{session.user_email}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Globe size={14} />
                              {session.ip_address}
                            </span>
                            <span className="flex items-center gap-1">
                              <Monitor size={14} />
                              {session.device_name || session.device_type || 'Unknown device'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              Last active: {formatTimeAgo(session.last_activity)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => terminateSession(session.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Terminate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {sessions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No active sessions
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
