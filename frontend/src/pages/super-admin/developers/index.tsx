import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Plus, Search, Code2, Key, Copy, Check } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import StatusBadge from '@/components/admin/StatusBadge';
import Modal from '@/components/admin/Modal';
import DeveloperForm from '@/components/admin/forms/DeveloperForm';
import { useAdminStore } from '@/stores/adminStore';
import type { Developer, DeveloperCreate } from '@/types/admin';

export default function DevelopersPage() {
  const router = useRouter();
  const { developers, fetchDevelopers, createDeveloper, loading, error } = useAdminStore();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchDevelopers();
  }, [fetchDevelopers]);

  const handleCreateDeveloper = async (data: DeveloperCreate) => {
    setCreating(true);
    const developer = await createDeveloper(data);
    setCreating(false);
    if (developer) {
      setShowCreateModal(false);
    }
  };

  const handleCopyKey = (apiKey: string, devId: string) => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(devId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredDevelopers = developers.filter(
    (dev) =>
      dev.name.toLowerCase().includes(search.toLowerCase()) ||
      dev.email.toLowerCase().includes(search.toLowerCase()) ||
      (dev.company && dev.company.toLowerCase().includes(search.toLowerCase()))
  );

  const columns = [
    {
      key: 'name',
      header: 'Developer',
      render: (dev: Developer) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Code2 className="text-green-600" size={20} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{dev.name}</p>
            <p className="text-sm text-gray-500">{dev.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      render: (dev: Developer) => (
        <span className="text-gray-600">{dev.company || '-'}</span>
      ),
    },
    {
      key: 'api_key',
      header: 'API Key',
      render: (dev: Developer) => (
        <div className="flex items-center space-x-2">
          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
            {dev.api_key.substring(0, 12)}...
          </code>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyKey(dev.api_key, dev.id);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Copy API Key"
          >
            {copiedKey === dev.id ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <Copy size={16} className="text-gray-400" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: 'projects',
      header: 'Projects',
      render: (dev: Developer) => (
        <span className="text-gray-600">{dev.projects?.length || 0}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (dev: Developer) => (
        <StatusBadge status={dev.is_active ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (dev: Developer) => (
        <span className="text-gray-500 text-sm">
          {new Date(dev.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Super Admin', href: '/super-admin' },
        { label: 'Developers' },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Developers</h1>
            <p className="text-gray-500">Manage API access for third-party developers</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Add Developer
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search developers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Table */}
        <DataTable
          data={filteredDevelopers}
          columns={columns}
          loading={loading.developers}
          emptyMessage="No developers found"
          onRowClick={(dev) => router.push(`/super-admin/developers/${dev.id}`)}
        />

        {/* Create Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Add New Developer"
        >
          <DeveloperForm
            onSubmit={handleCreateDeveloper}
            onCancel={() => setShowCreateModal(false)}
            loading={creating}
          />
        </Modal>
      </div>
    </AdminLayout>
  );
}
