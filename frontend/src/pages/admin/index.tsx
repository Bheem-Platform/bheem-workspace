import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Users,
  Globe,
  Mail,
  Video,
  FileText,
  Activity,
  Plus,
  Settings,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import StatsCard from '@/components/admin/StatsCard';
import UsageProgressBar from '@/components/admin/UsageProgressBar';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { useAdminStore } from '@/stores/adminStore';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import type { TenantDashboard } from '@/types/admin';

export default function TenantAdminDashboard() {
  const router = useRouter();
  const { currentTenant, activityLogs, fetchTenant, fetchActivityLogs, loading } = useAdminStore();
  const [dashboard, setDashboard] = useState<TenantDashboard | null>(null);

  // Require authentication - redirect to login if not authenticated
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  // Get tenant ID from auth context
  const tenantId = useCurrentTenantId();

  useEffect(() => {
    // Don't fetch if not authenticated or still loading auth
    if (!isAuthenticated || authLoading) return;

    // Fetch tenant dashboard data
    const loadDashboard = async () => {
      try {
        const response = await adminApi.getAdminDashboard(tenantId);
        const data = response.data as unknown as TenantDashboard;
        setDashboard(data);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      }
    };
    loadDashboard();
    fetchActivityLogs(tenantId, { limit: 10 });
  }, [tenantId, fetchActivityLogs, isAuthenticated, authLoading]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AdminLayout
      title="Workspace Dashboard"
      breadcrumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
          <h1 className="text-2xl font-bold">Workspace Admin</h1>
          <p className="mt-1 text-blue-200">
            Manage users, domains, and services for your organization.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Users"
            value={dashboard?.users?.total || 0}
            icon={Users}
            color="blue"
            href="/admin/users"
            subtitle={`${dashboard?.users?.active || 0} active`}
          />
          <StatsCard
            title="Domains"
            value={dashboard?.domains?.total || 0}
            icon={Globe}
            color="green"
            href="/admin/domains"
            subtitle={`${dashboard?.domains?.verified || 0} verified`}
          />
          <StatsCard
            title="Mailboxes"
            value={dashboard?.mail?.mailboxes || 0}
            icon={Mail}
            color="purple"
            href="/admin/mail"
          />
          <StatsCard
            title="Meet Rooms"
            value={dashboard?.meet?.rooms || 0}
            icon={Video}
            color="orange"
            href="/admin/meet"
          />
        </div>

        {/* Quick Actions & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/admin/users/invite')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus size={20} />
                <span className="font-medium">Invite User</span>
              </button>
              <button
                onClick={() => router.push('/admin/domains/new')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Globe size={20} />
                <span className="font-medium">Add Domain</span>
              </button>
              <button
                onClick={() => router.push('/admin/mail')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <Mail size={20} />
                <span className="font-medium">Create Mailbox</span>
              </button>
              <button
                onClick={() => router.push('/admin/billing')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Settings size={20} />
                <span className="font-medium">View Plan & Billing</span>
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <button
                onClick={() => router.push('/admin/activity')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
            <ActivityFeed activities={activityLogs} loading={loading.activity} />
          </div>
        </div>

        {/* Resource Usage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Resource Usage</h2>
            <button
              onClick={() => router.push('/admin/billing')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Upgrade Plan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UsageProgressBar
              label="Users"
              used={dashboard?.usage?.users_used || 0}
              quota={dashboard?.usage?.users_quota || 10}
              unit="users"
            />
            <UsageProgressBar
              label="Meet Hours"
              used={dashboard?.usage?.meet_used || 0}
              quota={dashboard?.usage?.meet_quota || 100}
              unit="hours"
            />
            <UsageProgressBar
              label="Docs Storage"
              used={dashboard?.usage?.docs_used_mb || 0}
              quota={dashboard?.usage?.docs_quota_mb || 5120}
              unit="MB"
            />
            <UsageProgressBar
              label="Mail Storage"
              used={dashboard?.usage?.mail_used_mb || 0}
              quota={dashboard?.usage?.mail_quota_mb || 10240}
              unit="MB"
            />
          </div>
        </div>

        {/* Service Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Mail className="text-purple-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Bheem Mail</h3>
                <p className="text-sm text-green-600">Operational</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {dashboard?.mail?.mailboxes || 0} mailboxes configured
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Video className="text-orange-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Bheem Meet</h3>
                <p className="text-sm text-green-600">Operational</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {dashboard?.meet?.rooms || 0} meeting rooms available
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Bheem Docs</h3>
                <p className="text-sm text-green-600">Operational</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {((dashboard?.usage?.docs_used_mb || 0) / 1024).toFixed(1)} GB used
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
