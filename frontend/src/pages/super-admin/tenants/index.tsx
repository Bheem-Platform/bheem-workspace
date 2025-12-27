import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Plus, Search, Filter } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import StatusBadge from '@/components/admin/StatusBadge';
import Modal from '@/components/admin/Modal';
import TenantForm from '@/components/admin/forms/TenantForm';
import { useAdminStore } from '@/stores/adminStore';
import type { Tenant, TenantCreate } from '@/types/admin';

export default function TenantsPage() {
  const router = useRouter();
  const { tenants, fetchTenants, createTenant, loading, error } = useAdminStore();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTenants({ search: search || undefined, plan: planFilter || undefined });
  }, [fetchTenants, search, planFilter]);

  const handleCreateTenant = async (data: TenantCreate) => {
    setCreating(true);
    const tenant = await createTenant(data);
    setCreating(false);
    if (tenant) {
      setShowCreateModal(false);
      router.push(`/super-admin/tenants/${tenant.id}`);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Tenant',
      render: (tenant: Tenant) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-purple-600 font-semibold">
              {tenant.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{tenant.name}</p>
            <p className="text-sm text-gray-500">{tenant.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner_email',
      header: 'Owner',
      render: (tenant: Tenant) => (
        <span className="text-gray-600">{tenant.owner_email}</span>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (tenant: Tenant) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          tenant.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
          tenant.plan === 'business' ? 'bg-blue-100 text-blue-700' :
          tenant.plan === 'starter' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {tenant.plan}
        </span>
      ),
    },
    {
      key: 'user_count',
      header: 'Users',
      render: (tenant: Tenant) => (
        <span className="text-gray-600">
          {tenant.user_count} / {tenant.max_users}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (tenant: Tenant) => (
        <StatusBadge
          status={tenant.is_suspended ? 'suspended' : tenant.is_active ? 'active' : 'inactive'}
        />
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (tenant: Tenant) => (
        <span className="text-gray-500 text-sm">
          {new Date(tenant.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Super Admin', href: '/super-admin' },
        { label: 'Tenants' },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
            <p className="text-gray-500">Manage all workspace tenants</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Create Tenant
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Table */}
        <DataTable
          data={tenants}
          columns={columns}
          loading={loading.tenants}
          emptyMessage="No tenants found"
          onRowClick={(tenant) => router.push(`/super-admin/tenants/${tenant.id}`)}
        />

        {/* Create Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Tenant"
          size="lg"
        >
          <TenantForm
            onSubmit={handleCreateTenant}
            onCancel={() => setShowCreateModal(false)}
            loading={creating}
          />
        </Modal>
      </div>
    </AdminLayout>
  );
}
