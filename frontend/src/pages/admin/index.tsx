/**
 * Tenant Admin Dashboard - Enhanced with brand colors
 * Brand colors: #FFCCF2, #977DFF, #0033FF
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Users,
  Globe,
  Mail,
  Video,
  FileText,
  Plus,
  Settings,
  Crown,
  Building2,
  RefreshCw,
  CreditCard,
  Link2,
  ArrowRight,
  Calendar,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import StatsCard from '@/components/admin/StatsCard';
import UsageProgressBar from '@/components/admin/UsageProgressBar';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { useAdminStore } from '@/stores/adminStore';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import type { TenantDashboard, Tenant, SubscriptionStatus } from '@/types/admin';
import { ServiceCard } from '@/components/dashboard';
import { DonutChart } from '@/components/charts';
import { formatStorageSize } from '@/lib/dashboardApi';
import AppsCarousel from '@/components/shared/AppsCarousel';

export default function TenantAdminDashboard() {
  const router = useRouter();
  const { currentTenant, activityLogs, fetchTenant, fetchActivityLogs, loading } = useAdminStore();
  const [dashboard, setDashboard] = useState<TenantDashboard | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const tenantId = useCurrentTenantId();
  const isInternalMode = tenant?.tenant_mode === 'internal';

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    const loadDashboard = async () => {
      try {
        const tenantRes = await adminApi.getTenant(tenantId);
        setTenant(tenantRes.data);

        const response = await adminApi.getAdminDashboard(tenantId);
        const data = response.data as unknown as TenantDashboard;
        setDashboard(data);

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

  // Skip showing loading screen - LoginLoader already handles the transition
  if (authLoading) {
    return null;
  }

  // Calculate storage breakdown for donut chart with brand colors
  const storageData = [
    { label: 'Mail', value: dashboard?.usage?.mail_used_mb || 0, color: '#FFCCF2' },
    { label: 'Docs', value: dashboard?.usage?.docs_used_mb || 0, color: '#977DFF' },
    { label: 'Meet', value: dashboard?.usage?.meet_used || 0, color: '#0033FF' },
  ].filter(item => item.value > 0);

  const hasStorageData = storageData.length > 0;
  const totalStorage = storageData.reduce((acc, item) => acc + item.value, 0);

  return (
    <AdminLayout
      title="Workspace Dashboard"
      breadcrumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]}
      isSuperAdmin={false}
      isInternalMode={isInternalMode}
    >
      <div className="space-y-6">
        {/* Welcome Banner with Brand Colors */}
        {isInternalMode ? (
          <div className="bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <Crown size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">Workspace Admin</h1>
                    <span className="px-2.5 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                      Internal
                    </span>
                    <Sparkles size={18} className="text-white/80" />
                  </div>
                  <p className="mt-1 text-white/80">
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
          <div className="bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <Building2 size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">Workspace Admin</h1>
                    {subscription?.status === 'active' && (
                      <span className="px-2.5 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                        {subscription.plan}
                      </span>
                    )}
                    <Sparkles size={18} className="text-white/80" />
                  </div>
                  <p className="mt-1 text-white/80">
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

        {/* Subscription Alert */}
        {!isInternalMode && subscription?.status !== 'active' && (
          <div className="bg-[#FFCCF2]/30 border border-[#977DFF]/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-[#977DFF]" />
              <div>
                <p className="font-medium text-gray-800">No Active Subscription</p>
                <p className="text-sm text-gray-600">Subscribe to unlock all features and remove limits.</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin/billing')}
              className="px-4 py-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
            >
              View Plans
            </button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Users"
            value={dashboard?.users?.total || 0}
            icon={Users}
            color="purple"
            href="/admin/users"
            subtitle={`${dashboard?.users?.active || 0} active`}
          />
          <StatsCard
            title="Domains"
            value={dashboard?.domains?.total || 0}
            icon={Globe}
            color="blue"
            href="/admin/domains"
            subtitle={`${dashboard?.domains?.verified || 0} verified`}
          />
          <StatsCard
            title="Total Storage"
            value={formatStorageSize(totalStorage)}
            icon={HardDrive}
            color="purple"
            href="/admin/storage"
            subtitle="Used"
          />
          <StatsCard
            title="Activity Today"
            value={activityLogs.filter(a => {
              const today = new Date().toDateString();
              return new Date(a.created_at).toDateString() === today;
            }).length}
            icon={Calendar}
            color="orange"
            href="/admin/activity"
            subtitle="actions"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Storage Breakdown Donut Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Storage Breakdown</h3>
                <p className="text-sm text-gray-500 mt-1">Usage by service</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{formatStorageSize(totalStorage)}</p>
                <p className="text-sm text-gray-500">Total used</p>
              </div>
            </div>
            {hasStorageData ? (
              <DonutChart
                data={storageData}
                size={200}
                thickness={35}
                showLegend={true}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <HardDrive size={40} className="text-gray-300 mb-3" />
                <p className="text-gray-500">No storage data available</p>
                <p className="text-sm text-gray-400 mt-1">Start using services to see breakdown</p>
              </div>
            )}
          </div>

          {/* Apps Carousel */}
          <AppsCarousel />
        </div>

        {/* Quick Actions & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/admin/users/invite')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-[#FFCCF2]/30 text-[#977DFF] rounded-lg hover:bg-[#FFCCF2]/50 transition-colors"
              >
                <Plus size={20} />
                <span className="font-medium">Invite User</span>
              </button>
              <button
                onClick={() => router.push('/admin/domains/new')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Globe size={20} />
                <span className="font-medium">Add Domain</span>
              </button>
              <button
                onClick={() => router.push('/admin/mail')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-[#977DFF]/20 text-[#977DFF] rounded-lg hover:bg-[#977DFF]/30 transition-colors"
              >
                <Mail size={20} />
                <span className="font-medium">Create Mailbox</span>
              </button>
              {isInternalMode ? (
                <button
                  onClick={() => router.push('/admin/erp-sync')}
                  className="w-full flex items-center space-x-3 px-4 py-3 bg-[#0033FF]/10 text-[#0033FF] rounded-lg hover:bg-[#0033FF]/20 transition-colors"
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
                className="text-sm text-[#977DFF] hover:text-[#0033FF] font-medium"
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
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Resource Quotas</h2>
              <p className="text-sm text-gray-500 mt-1">Monitor your usage limits</p>
            </div>
            {!isInternalMode && (
              <button
                onClick={() => router.push('/admin/billing')}
                className="text-sm text-[#977DFF] hover:text-[#0033FF] font-medium flex items-center gap-1"
              >
                Upgrade Plan <ArrowRight size={14} />
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
                <div className="p-2 bg-[#977DFF]/20 rounded-lg">
                  <Link2 className="h-5 w-5 text-[#977DFF]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">ERP Integration</h2>
                  <p className="text-sm text-gray-500">Connected to Bheem Core ERP</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/erp-sync')}
                className="inline-flex items-center text-sm text-[#977DFF] hover:text-[#0033FF] font-medium"
              >
                Manage Sync
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#FFCCF2]/20 rounded-lg">
                <p className="text-sm text-gray-500">Company Code</p>
                <p className="font-semibold text-gray-900">{tenant?.erp_company_code || 'N/A'}</p>
              </div>
              <div className="p-4 bg-[#977DFF]/10 rounded-lg">
                <p className="text-sm text-gray-500">Tenant Mode</p>
                <p className="font-semibold text-gray-900">Internal (Subsidiary)</p>
              </div>
              <div className="p-4 bg-[#0033FF]/10 rounded-lg">
                <p className="text-sm text-gray-500">Plan</p>
                <p className="font-semibold text-gray-900">Enterprise (Included)</p>
              </div>
            </div>
          </div>
        )}

        {/* Service Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ServiceCard
            name="Bheem Mail"
            icon={Mail}
            status="operational"
            color="purple"
            metrics={[
              { label: 'Mailboxes', value: dashboard?.mail?.mailboxes || 0 },
              { label: 'Storage', value: formatStorageSize(dashboard?.usage?.mail_used_mb || 0) },
            ]}
            actionLabel="Manage"
            actionHref="/admin/mail"
          />
          <ServiceCard
            name="Bheem Meet"
            icon={Video}
            status="operational"
            color="green"
            metrics={[
              { label: 'Rooms', value: dashboard?.meet?.rooms || 0 },
              { label: 'Hours Used', value: `${dashboard?.usage?.meet_used || 0}h` },
            ]}
            actionLabel="Manage"
            actionHref="/admin/meet"
          />
          <ServiceCard
            name="Bheem Docs"
            icon={FileText}
            status="operational"
            color="purple"
            metrics={[
              { label: 'Storage', value: formatStorageSize(dashboard?.usage?.docs_used_mb || 0) },
              { label: 'Quota', value: formatStorageSize(dashboard?.usage?.docs_quota_mb || 5120) },
            ]}
            actionLabel="Manage"
            actionHref="/admin/docs"
          />
        </div>
      </div>
    </AdminLayout>
  );
}
