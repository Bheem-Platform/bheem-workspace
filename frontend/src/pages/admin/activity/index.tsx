import { useEffect, useState } from 'react';
import { Activity, Filter, Download } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { useAdminStore } from '@/stores/adminStore';
import { useCurrentTenantId } from '@/stores/authStore';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'user_added', label: 'User Added' },
  { value: 'user_removed', label: 'User Removed' },
  { value: 'domain_added', label: 'Domain Added' },
  { value: 'domain_verified', label: 'Domain Verified' },
  { value: 'mailbox_created', label: 'Mailbox Created' },
  { value: 'meeting_started', label: 'Meeting Started' },
  { value: 'file_uploaded', label: 'File Uploaded' },
  { value: 'settings_updated', label: 'Settings Updated' },
];

export default function TenantActivityPage() {
  const { activityLogs, fetchActivityLogs, loading } = useAdminStore();
  const [actionFilter, setActionFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Get tenant ID from auth context
  const tenantId = useCurrentTenantId();

  useEffect(() => {
    fetchActivityLogs(tenantId, {
      action: actionFilter || undefined,
      limit: 100,
    });
  }, [tenantId, actionFilter, fetchActivityLogs]);

  const handleExport = () => {
    // Export activity logs as CSV
    const headers = ['Date', 'Action', 'Description', 'User'];
    const rows = activityLogs.map((log) => [
      new Date(log.created_at).toISOString(),
      log.action,
      log.description || '',
      log.user_email || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Activity' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
            <p className="text-gray-500">Track all actions in your workspace</p>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={20} className="mr-2" />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Filter size={20} className="text-gray-400" />
            <h2 className="font-medium text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Events</p>
            <p className="text-2xl font-bold text-gray-900">{activityLogs.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">User Events</p>
            <p className="text-2xl font-bold text-blue-600">
              {activityLogs.filter((a) => a.action.includes('user')).length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Domain Events</p>
            <p className="text-2xl font-bold text-green-600">
              {activityLogs.filter((a) => a.action.includes('domain')).length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Service Events</p>
            <p className="text-2xl font-bold text-purple-600">
              {
                activityLogs.filter(
                  (a) =>
                    a.action.includes('mailbox') ||
                    a.action.includes('meeting') ||
                    a.action.includes('file')
                ).length
              }
            </p>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <ActivityFeed activities={activityLogs} loading={loading.activity} />
        </div>
      </div>
    </AdminLayout>
  );
}
