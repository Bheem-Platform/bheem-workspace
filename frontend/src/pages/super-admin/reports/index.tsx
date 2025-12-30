import { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  Users,
  TrendingUp,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  HardDrive,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import StatusBadge from '@/components/admin/StatusBadge';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import * as adminApi from '@/lib/adminApi';
import { formatMB, formatHours, getPlanColor } from '@/lib/adminApi';

interface TenantsOverview {
  summary: {
    total_tenants: number;
    active_tenants: number;
    suspended_tenants: number;
    total_users: number;
  };
  by_plan: Record<string, number>;
  storage_usage: {
    meet_hours: number;
    docs_mb: number;
    mail_mb: number;
    recordings_mb: number;
  };
  recent_tenants: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    created_at: string;
  }>;
}

interface HealthStatus {
  status: string;
  timestamp: string;
  services: Record<string, {
    status: string;
    latency_ms: number | null;
    message: string;
  }>;
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    unconfigured: number;
  };
}

export default function SuperAdminReportsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'bulk'>('overview');
  const [overview, setOverview] = useState<TenantsOverview | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bulk operations state
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'suspend' | 'activate' | 'update_plan'>('suspend');
  const [bulkPlan, setBulkPlan] = useState<string>('starter');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (activeTab) {
        case 'overview':
          const overviewRes = await adminApi.getTenantsOverview();
          setOverview(overviewRes.data);
          break;
        case 'health':
          const healthRes = await adminApi.getDetailedHealth();
          setHealth(healthRes.data);
          break;
        case 'bulk':
          const tenantsRes = await adminApi.listTenants();
          setTenants(tenantsRes.data || []);
          break;
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data');
    }
    setLoading(false);
  };

  const handleBulkOperation = async () => {
    if (selectedTenants.length === 0) return;
    setBulkLoading(true);
    try {
      await adminApi.bulkTenantOperation({
        action: bulkAction,
        tenant_ids: selectedTenants,
        plan: bulkAction === 'update_plan' ? bulkPlan : undefined,
      });
      setShowBulkConfirm(false);
      setSelectedTenants([]);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Bulk operation failed');
    }
    setBulkLoading(false);
  };

  const toggleTenantSelection = (tenantId: string) => {
    setSelectedTenants(prev =>
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const selectAllTenants = () => {
    if (selectedTenants.length === tenants.length) {
      setSelectedTenants([]);
    } else {
      setSelectedTenants(tenants.map(t => t.id));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'unhealthy':
        return <XCircle size={20} className="text-red-500" />;
      case 'degraded':
        return <AlertTriangle size={20} className="text-yellow-500" />;
      default:
        return <AlertTriangle size={20} className="text-gray-400" />;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Platform Overview', icon: BarChart3 },
    { id: 'health', label: 'System Health', icon: TrendingUp },
    { id: 'bulk', label: 'Bulk Operations', icon: Building2 },
  ];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Super Admin', href: '/super-admin' },
        { label: 'Reports' },
      ]}
      isSuperAdmin={true}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Reports</h1>
            <p className="text-gray-500">Platform-wide analytics, health monitoring, and bulk operations</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon size={18} className="mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Tenants</p>
                        <p className="text-3xl font-bold text-gray-900">{overview.summary.total_tenants}</p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Building2 size={24} className="text-purple-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Active Tenants</p>
                        <p className="text-3xl font-bold text-green-600">{overview.summary.active_tenants}</p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <CheckCircle size={24} className="text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Suspended</p>
                        <p className="text-3xl font-bold text-red-600">{overview.summary.suspended_tenants}</p>
                      </div>
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <Pause size={24} className="text-red-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Users</p>
                        <p className="text-3xl font-bold text-blue-600">{overview.summary.total_users}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users size={24} className="text-blue-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Plans Breakdown */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenants by Plan</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(overview.by_plan).map(([plan, count]) => (
                      <div key={plan} className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-gray-900">{count}</p>
                        <p className={`text-sm font-medium capitalize text-${getPlanColor(plan)}-600`}>{plan}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Storage Usage */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Storage Usage</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{formatHours(overview.storage_usage.meet_hours)}</p>
                      <p className="text-sm text-gray-500">Meet Hours</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{formatMB(overview.storage_usage.docs_mb)}</p>
                      <p className="text-sm text-gray-500">Docs Storage</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{formatMB(overview.storage_usage.mail_mb)}</p>
                      <p className="text-sm text-gray-500">Mail Storage</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{formatMB(overview.storage_usage.recordings_mb)}</p>
                      <p className="text-sm text-gray-500">Recordings</p>
                    </div>
                  </div>
                </div>

                {/* Recent Tenants */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tenants</h3>
                  <div className="space-y-3">
                    {overview.recent_tenants.map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Building2 size={20} className="text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-sm text-gray-500">{tenant.slug}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={tenant.plan} />
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(tenant.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Health Tab */}
            {activeTab === 'health' && health && (
              <div className="space-y-6">
                {/* Health Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{health.summary.healthy}</p>
                    <p className="text-sm text-green-700">Healthy</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-600">{health.summary.degraded}</p>
                    <p className="text-sm text-yellow-700">Degraded</p>
                  </div>
                  <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
                    <p className="text-3xl font-bold text-red-600">{health.summary.unhealthy}</p>
                    <p className="text-sm text-red-700">Unhealthy</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
                    <p className="text-3xl font-bold text-gray-600">{health.summary.unconfigured}</p>
                    <p className="text-sm text-gray-700">Unconfigured</p>
                  </div>
                </div>

                {/* Services Status */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h3>
                  <div className="space-y-3">
                    {Object.entries(health.services).map(([name, service]) => (
                      <div key={name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(service.status)}
                          <div>
                            <p className="font-medium text-gray-900 capitalize">{name.replace('_', ' ')}</p>
                            <p className="text-sm text-gray-500">{service.message}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={service.status} />
                          {service.latency_ms && (
                            <p className="text-xs text-gray-500 mt-1">{service.latency_ms.toFixed(0)}ms</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Operations Tab */}
            {activeTab === 'bulk' && (
              <div className="space-y-6">
                {/* Bulk Actions Bar */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedTenants.length === tenants.length && tenants.length > 0}
                        onChange={selectAllTenants}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-600">
                        {selectedTenants.length} selected
                      </span>
                    </div>

                    <select
                      value={bulkAction}
                      onChange={(e) => setBulkAction(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="suspend">Suspend</option>
                      <option value="activate">Activate</option>
                      <option value="update_plan">Update Plan</option>
                    </select>

                    {bulkAction === 'update_plan' && (
                      <select
                        value={bulkPlan}
                        onChange={(e) => setBulkPlan(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="starter">Starter</option>
                        <option value="business">Business</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    )}

                    <button
                      onClick={() => setShowBulkConfirm(true)}
                      disabled={selectedTenants.length === 0}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply to Selected
                    </button>
                  </div>
                </div>

                {/* Tenants List */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tenants.map((tenant) => (
                          <tr key={tenant.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedTenants.includes(tenant.id)}
                                onChange={() => toggleTenantSelection(tenant.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-medium text-gray-900">{tenant.name}</p>
                                <p className="text-sm text-gray-500">{tenant.slug}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full bg-${getPlanColor(tenant.plan)}-100 text-${getPlanColor(tenant.plan)}-800`}>
                                {tenant.plan}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={tenant.is_active ? 'active' : 'suspended'} />
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                              {tenant.user_count || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Bulk Confirm Dialog */}
        <ConfirmDialog
          isOpen={showBulkConfirm}
          onConfirm={handleBulkOperation}
          onCancel={() => setShowBulkConfirm(false)}
          title="Confirm Bulk Operation"
          message={`Are you sure you want to ${bulkAction.replace('_', ' ')} ${selectedTenants.length} tenant(s)?`}
          confirmText={bulkLoading ? 'Processing...' : 'Confirm'}
          danger={bulkAction === 'suspend'}
        />
      </div>
    </AdminLayout>
  );
}
