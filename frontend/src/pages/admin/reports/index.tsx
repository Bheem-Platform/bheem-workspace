import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Users,
  HardDrive,
  Video,
  Mail,
  FileText,
  Activity,
  RefreshCw,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import UsageProgressBar from '@/components/admin/UsageProgressBar';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import { formatMB, formatHours } from '@/lib/adminApi';

interface UsageReport {
  tenant_id: string;
  tenant_name: string;
  period: string;
  period_start: string;
  period_end: string;
  users: {
    total: number;
    max: number;
    new_in_period: number;
    usage_percent: number;
  };
  domains: number;
  storage: {
    meet: { used_hours: number; quota_hours: number; usage_percent: number };
    docs: { used_mb: number; quota_mb: number; usage_percent: number };
    mail: { used_mb: number; quota_mb: number; usage_percent: number };
    recordings: { used_mb: number; quota_mb: number; usage_percent: number };
  };
  activity: {
    total_actions: number;
    by_action: Record<string, number>;
  };
}

interface ActivityReport {
  tenant_id: string;
  period: string;
  group_by: string;
  timeline: Array<{
    period: string;
    count: number;
    by_action: Record<string, number>;
  }>;
  total_activities: number;
}

export default function ReportsPage() {
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [activityReport, setActivityReport] = useState<ActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const tenantId = useCurrentTenantId();

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    loadReports();
  }, [period, tenantId, isAuthenticated, authLoading]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usageRes, activityRes] = await Promise.all([
        adminApi.getUsageReport(tenantId, { period }),
        adminApi.getActivityReport(tenantId, { period: period === 'year' ? 'month' : period }),
      ]);
      setUsageReport(usageRes.data);
      setActivityReport(activityRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load reports');
    }
    setLoading(false);
  };

  const handleExport = async (type: 'users' | 'activity', format: 'json' | 'csv') => {
    setExporting(true);
    try {
      let response;
      if (type === 'users') {
        response = await adminApi.exportUsers(tenantId, format);
      } else {
        response = await adminApi.exportActivity(tenantId, { format, period });
      }

      const data = response.data;
      const blob = new Blob(
        [format === 'json' ? JSON.stringify(data, null, 2) : convertToCSV(data)],
        { type: format === 'json' ? 'application/json' : 'text/csv' }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to export data');
    }
    setExporting(false);
  };

  const convertToCSV = (data: any) => {
    if (Array.isArray(data.users)) {
      const headers = Object.keys(data.users[0] || {}).join(',');
      const rows = data.users.map((row: any) => Object.values(row).join(','));
      return [headers, ...rows].join('\n');
    }
    return JSON.stringify(data);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Reports' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usage Reports</h1>
            <p className="text-gray-500">Analytics and usage statistics for your workspace</p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
            </select>
            <button
              onClick={loadReports}
              disabled={loading}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading reports...</p>
          </div>
        ) : usageReport ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">{usageReport.users.total}</p>
                    <p className="text-sm text-green-600">+{usageReport.users.new_in_period} new</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users size={24} className="text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Domains</p>
                    <p className="text-3xl font-bold text-gray-900">{usageReport.domains}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Activity size={24} className="text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Activities</p>
                    <p className="text-3xl font-bold text-gray-900">{usageReport.activity.total_actions}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp size={24} className="text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Period</p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">{period}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(usageReport.period_start).toLocaleDateString()} - {new Date(usageReport.period_end).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Calendar size={24} className="text-orange-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Usage */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Storage Usage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Video size={18} className="text-blue-500" />
                      <span className="font-medium">Meet</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatHours(usageReport.storage.meet.used_hours)} / {formatHours(usageReport.storage.meet.quota_hours)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full"
                      style={{ width: `${Math.min(usageReport.storage.meet.usage_percent, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FileText size={18} className="text-green-500" />
                      <span className="font-medium">Docs</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatMB(usageReport.storage.docs.used_mb)} / {formatMB(usageReport.storage.docs.quota_mb)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-500 h-3 rounded-full"
                      style={{ width: `${Math.min(usageReport.storage.docs.usage_percent, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Mail size={18} className="text-purple-500" />
                      <span className="font-medium">Mail</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatMB(usageReport.storage.mail.used_mb)} / {formatMB(usageReport.storage.mail.quota_mb)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-purple-500 h-3 rounded-full"
                      style={{ width: `${Math.min(usageReport.storage.mail.usage_percent, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <HardDrive size={18} className="text-orange-500" />
                      <span className="font-medium">Recordings</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatMB(usageReport.storage.recordings.used_mb)} / {formatMB(usageReport.storage.recordings.quota_mb)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-orange-500 h-3 rounded-full"
                      style={{ width: `${Math.min(usageReport.storage.recordings.usage_percent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Breakdown */}
            {usageReport.activity.by_action && Object.keys(usageReport.activity.by_action).length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(usageReport.activity.by_action).map(([action, count]) => (
                    <div key={action} className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                      <p className="text-sm text-gray-500 capitalize">{action.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            {activityReport && activityReport.timeline && activityReport.timeline.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
                <div className="flex items-end space-x-2 h-40">
                  {activityReport.timeline.map((item, idx) => {
                    const maxCount = Math.max(...activityReport.timeline.map(t => t.count), 1);
                    const height = (item.count / maxCount) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{ height: `${Math.max(height, 5)}%` }}
                          title={`${item.count} activities`}
                        />
                        <p className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                          {new Date(item.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Export Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleExport('users', 'json')}
                  disabled={exporting}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download size={18} className="mr-2" />
                  Export Users (JSON)
                </button>
                <button
                  onClick={() => handleExport('users', 'csv')}
                  disabled={exporting}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download size={18} className="mr-2" />
                  Export Users (CSV)
                </button>
                <button
                  onClick={() => handleExport('activity', 'json')}
                  disabled={exporting}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download size={18} className="mr-2" />
                  Export Activity (JSON)
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">No report data available</div>
        )}
      </div>
    </AdminLayout>
  );
}
