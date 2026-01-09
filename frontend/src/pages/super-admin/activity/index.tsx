import { useEffect, useState } from 'react';
import { Activity, Filter, Search, Calendar } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { useAdminStore } from '@/stores/adminStore';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'tenant_created', label: 'Tenant Created' },
  { value: 'tenant_updated', label: 'Tenant Updated' },
  { value: 'tenant_deactivated', label: 'Tenant Deactivated' },
  { value: 'user_added', label: 'User Added' },
  { value: 'user_removed', label: 'User Removed' },
  { value: 'domain_added', label: 'Domain Added' },
  { value: 'domain_verified', label: 'Domain Verified' },
  { value: 'developer_created', label: 'Developer Created' },
];

export default function PlatformActivityPage() {
  const { tenants, activityLogs, fetchTenants, fetchActivityLogs, loading } = useAdminStore();
  const [selectedTenant, setSelectedTenant] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    if (selectedTenant) {
      fetchActivityLogs(selectedTenant, {
        action: actionFilter || undefined,
        from_date: dateRange.from || undefined,
        to_date: dateRange.to || undefined,
        limit: 50,
      });
    }
  }, [selectedTenant, actionFilter, dateRange.from, dateRange.to, fetchActivityLogs]);

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Super Admin', href: '/super-admin' },
        { label: 'Activity Logs' },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Activity</h1>
          <p className="text-gray-500">Monitor activity across all tenants</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Filter size={20} className="text-gray-400" />
            <h2 className="font-medium text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tenant Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tenant
              </label>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Select a tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {ACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h2>

          {!selectedTenant ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a tenant to view activity</p>
              <p className="text-sm text-gray-400 mt-1">
                Use the filters above to narrow down the activity log
              </p>
            </div>
          ) : (
            <ActivityFeed
              activities={activityLogs}
              loading={loading.activity}
              showTenant
            />
          )}
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Actions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activityLogs.length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Activity className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tenants Modified</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activityLogs.filter((a) => a.action.includes('tenant')).length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Activity className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Users Changed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activityLogs.filter((a) => a.action.includes('user')).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Activity className="text-green-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Domain Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activityLogs.filter((a) => a.action.includes('domain')).length}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Activity className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
