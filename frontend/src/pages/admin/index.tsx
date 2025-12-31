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
  Crown,
  Building2,
  RefreshCw,
  CreditCard,
  Link2,
  ArrowRight,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import StatsCard from '@/components/admin/StatsCard';
import UsageProgressBar from '@/components/admin/UsageProgressBar';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { useAdminStore } from '@/stores/adminStore';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import type { TenantDashboard, Tenant, SubscriptionStatus } from '@/types/admin';

export default function TenantAdminDashboard() {
  const router = useRouter();
  const { currentTenant, activityLogs, fetchTenant, fetchActivityLogs, loading } = useAdminStore();
  const [dashboard, setDashboard] = useState<TenantDashboard | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  // Require authentication - redirect to login if not authenticated
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  // Get tenant ID from auth context
  const tenantId = useCurrentTenantId();

  // Check tenant mode
  const isInternalMode = tenant?.tenant_mode === 'internal';

  useEffect(() => {
    // Don't fetch if not authenticated or still loading auth
    if (!isAuthenticated || authLoading) return;

    // Fetch tenant dashboard data
    const loadDashboard = async () => {
      try {
        // Fetch tenant details first
        const tenantRes = await adminApi.getTenant(tenantId);
        setTenant(tenantRes.data);

        // Fetch dashboard
        const response = await adminApi.getAdminDashboard(tenantId);
        const data = response.data as unknown as TenantDashboard;
        setDashboard(data);

        // Fetch subscription for external tenants
        if (tenantRes.data.tenant_mode !== 'internal') {
          try {
            const subRes = await adminApi.getSubscriptionStatus(tenantId);
            setSubscription(subRes.data);
          } catch (e) {
            setSubscription(null);
          }
        }
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
      isInternalMode={isInternalMode}
    >
      <div className="space-y-6">
        {/* Welcome Banner - Different for Internal vs External */}
        {isInternalMode ? (
          <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <Crown size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">Workspace Admin</h1>
                    <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full">
                      Internal
                    </span>
                  </div>
                  <p className="mt-1 text-purple-200">
                    Bheemverse Subsidiary - {tenant?.erp_company_code} | Enterprise Access
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/erp-sync')}
                className="hidden md:inline-flex items-center px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                <RefreshCw size={18} className="mr-2" />
                ERP Sync
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <Building2 size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">Workspace Admin</h1>
                    {subscription?.status === 'active' && (
                      <span className="px-2 py-0.5 bg-green-500/30 text-green-100 text-xs font-medium rounded-full">
                        {subscription.plan}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-blue-200">
                    {subscription?.status === 'active'
                      ? `Subscription active until ${subscription.period_end ? new Date(subscription.period_end).toLocaleDateString() : 'renewal'}`
                      : 'Manage users, domains, and services for your organization.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/billing')}
                className="hidden md:inline-flex items-center px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                <CreditCard size={18} className="mr-2" />
                {subscription?.status === 'active' ? 'Manage Billing' : 'Subscribe'}
              </button>
            </div>
          </div>
        )}

        {/* Subscription Alert for External Tenants without Active Subscription */}
        {!isInternalMode && subscription?.status !== 'active' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">No Active Subscription</p>
                <p className="text-sm text-yellow-600">Subscribe to unlock all features and remove limits.</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin/billing')}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
            >
              View Plans
            </button>
          </div>
        )}

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
              {isInternalMode ? (
                <button
                  onClick={() => router.push('/admin/erp-sync')}
                  className="w-full flex items-center space-x-3 px-4 py-3 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  <RefreshCw size={20} />
                  <span className="font-medium">Sync from ERP</span>
                </button>
              ) : (
                <button
                  onClick={() => router.push('/admin/billing')}
                  className="w-full flex items-center space-x-3 px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Settings size={20} />
                  <span className="font-medium">View Plan & Billing</span>
                </button>
              )}
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
            {!isInternalMode && (
              <button
                onClick={() => router.push('/admin/billing')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Upgrade Plan
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UsageProgressBar
              label="Users"
              used={dashboard?.usage?.users_used || 0}
              quota={isInternalMode ? -1 : (dashboard?.usage?.users_quota || 10)}
              unit="users"
            />
            <UsageProgressBar
              label="Meet Hours"
              used={dashboard?.usage?.meet_used || 0}
              quota={isInternalMode ? -1 : (dashboard?.usage?.meet_quota || 100)}
              unit="hours"
            />
            <UsageProgressBar
              label="Docs Storage"
              used={dashboard?.usage?.docs_used_mb || 0}
              quota={isInternalMode ? -1 : (dashboard?.usage?.docs_quota_mb || 5120)}
              unit="MB"
            />
            <UsageProgressBar
              label="Mail Storage"
              used={dashboard?.usage?.mail_used_mb || 0}
              quota={isInternalMode ? -1 : (dashboard?.usage?.mail_quota_mb || 10240)}
              unit="MB"
            />
          </div>
        </div>

        {/* ERP Integration Card for Internal Tenants */}
        {isInternalMode && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Link2 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">ERP Integration</h2>
                  <p className="text-sm text-gray-500">Connected to Bheem Core ERP</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/erp-sync')}
                className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Manage Sync
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Company Code</p>
                <p className="font-semibold text-gray-900">{tenant?.erp_company_code || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Tenant Mode</p>
                <p className="font-semibold text-gray-900">Internal (Subsidiary)</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Plan</p>
                <p className="font-semibold text-gray-900">Enterprise (Included)</p>
              </div>
            </div>
          </div>
        )}

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
