/**
 * Super Admin Dashboard - Platform Management
 * Brand colors: #FFCCF2, #977DFF, #0033FF
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Building2,
  Users,
  Globe,
  Activity,
  TrendingUp,
  Code2,
  Plus,
  Sparkles,
  Crown,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import StatsCard from '@/components/admin/StatsCard';
import { useAdminStore } from '@/stores/adminStore';
import AppsCarousel from '@/components/shared/AppsCarousel';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { tenants, developers, fetchTenants, fetchDevelopers, loading } = useAdminStore();
  const [platformStats, setPlatformStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    totalDomains: 0,
  });

  useEffect(() => {
    fetchTenants();
    fetchDevelopers();
  }, [fetchTenants, fetchDevelopers]);

  useEffect(() => {
    // Calculate platform stats from tenants
    if (tenants.length > 0) {
      const activeTenants = tenants.filter((t) => t.is_active);
      const totalUsers = tenants.reduce((sum, t) => sum + t.user_count, 0);

      setPlatformStats({
        totalTenants: tenants.length,
        activeTenants: activeTenants.length,
        totalUsers,
        totalDomains: 0,
      });
    }
  }, [tenants]);

  return (
    <AdminLayout
      title="Platform Dashboard"
      breadcrumbs={[{ label: 'Super Admin' }, { label: 'Dashboard' }]}
    >
      <div className="space-y-6">
        {/* Welcome Banner with Brand Colors */}
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
                  <h1 className="text-2xl font-bold">Welcome to Super Admin</h1>
                  <Sparkles size={20} className="text-white/80" />
                </div>
                <p className="mt-1 text-white/80">
                  Manage the entire Bheem Workspace platform from here.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Tenants"
            value={platformStats.totalTenants}
            icon={Building2}
            color="purple"
            href="/super-admin/tenants"
            subtitle={`${platformStats.activeTenants} active`}
          />
          <StatsCard
            title="Total Users"
            value={platformStats.totalUsers}
            icon={Users}
            color="blue"
            subtitle="Across all tenants"
          />
          <StatsCard
            title="Developers"
            value={developers.length}
            icon={Code2}
            color="green"
            href="/super-admin/developers"
          />
          <StatsCard
            title="Platform Health"
            value="99.9%"
            icon={TrendingUp}
            color="green"
            subtitle="Uptime this month"
          />
        </div>

        {/* Quick Actions & Recent Tenants */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/super-admin/tenants/new')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-[#FFCCF2]/30 text-[#977DFF] rounded-lg hover:bg-[#FFCCF2]/50 transition-colors"
              >
                <Plus size={20} />
                <span className="font-medium">Create New Tenant</span>
              </button>
              <button
                onClick={() => router.push('/super-admin/developers')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-[#977DFF]/20 text-[#977DFF] rounded-lg hover:bg-[#977DFF]/30 transition-colors"
              >
                <Code2 size={20} />
                <span className="font-medium">Manage Developers</span>
              </button>
              <button
                onClick={() => router.push('/super-admin/activity')}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-[#0033FF]/10 text-[#0033FF] rounded-lg hover:bg-[#0033FF]/20 transition-colors"
              >
                <Activity size={20} />
                <span className="font-medium">View Activity Logs</span>
              </button>
            </div>
          </div>

          {/* Recent Tenants */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Tenants</h2>
              <button
                onClick={() => router.push('/super-admin/tenants')}
                className="text-sm text-[#977DFF] hover:text-[#0033FF] font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {loading.tenants ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              ) : tenants.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No tenants yet</p>
              ) : (
                tenants.slice(0, 5).map((tenant) => (
                  <div
                    key={tenant.id}
                    onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-[#FFCCF2]/20 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2] to-[#977DFF] rounded-lg flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {tenant.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tenant.name}</p>
                        <p className="text-sm text-gray-500">{tenant.slug}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        tenant.plan === 'enterprise' ? 'bg-[#977DFF]/20 text-[#977DFF]' :
                        tenant.plan === 'business' ? 'bg-[#0033FF]/10 text-[#0033FF]' :
                        tenant.plan === 'starter' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {tenant.plan}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{tenant.user_count} users</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Apps Carousel */}
        <AppsCarousel />

        {/* Plan Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Distribution</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['free', 'starter', 'business', 'enterprise'].map((plan) => {
              const count = tenants.filter((t) => t.plan === plan).length;
              const percent = tenants.length > 0 ? (count / tenants.length) * 100 : 0;
              const colors: Record<string, string> = {
                free: 'bg-gray-500',
                starter: 'bg-emerald-500',
                business: 'bg-[#0033FF]',
                enterprise: 'bg-[#977DFF]',
              };

              return (
                <div key={plan} className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{count}</div>
                  <div className="text-sm text-gray-500 capitalize">{plan}</div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[plan]} rounded-full`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
