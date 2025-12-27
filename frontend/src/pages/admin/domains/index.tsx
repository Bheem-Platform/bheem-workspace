import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Plus, Globe, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import StatusBadge from '@/components/admin/StatusBadge';
import Modal from '@/components/admin/Modal';
import DomainForm from '@/components/admin/forms/DomainForm';
import { useAdminStore } from '@/stores/adminStore';
import type { Domain, DomainCreate } from '@/types/admin';

export default function DomainsPage() {
  const router = useRouter();
  const { domains, fetchDomains, addDomain, verifyDomain, loading, error } = useAdminStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  // In real app, get tenant ID from auth context
  const tenantId = 'current-tenant-id';

  useEffect(() => {
    fetchDomains(tenantId);
  }, [fetchDomains, tenantId]);

  const handleAddDomain = async (data: DomainCreate) => {
    setAdding(true);
    const domain = await addDomain(tenantId, data);
    setAdding(false);
    if (domain) {
      setShowAddModal(false);
      router.push(`/admin/domains/${domain.id}`);
    }
  };

  const handleVerify = async (domainId: string) => {
    setVerifying(domainId);
    await verifyDomain(tenantId, domainId);
    setVerifying(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="text-green-500" size={18} />;
      case 'failed':
        return <XCircle className="text-red-500" size={18} />;
      default:
        return <Clock className="text-yellow-500" size={18} />;
    }
  };

  const columns = [
    {
      key: 'domain',
      header: 'Domain',
      render: (domain: Domain) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Globe className="text-green-600" size={20} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{domain.domain}</p>
            {domain.is_primary && (
              <span className="text-xs text-blue-600">Primary</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (domain: Domain) => (
        <div className="flex items-center space-x-2">
          {getStatusIcon(domain.verification_status)}
          <StatusBadge
            status={
              domain.verification_status === 'verified'
                ? 'active'
                : domain.verification_status === 'failed'
                ? 'inactive'
                : 'pending'
            }
          />
        </div>
      ),
    },
    {
      key: 'services',
      header: 'Services',
      render: (domain: Domain) => (
        <div className="flex items-center space-x-2">
          {domain.mail_enabled && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
              Mail
            </span>
          )}
          {domain.meet_enabled && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
              Meet
            </span>
          )}
          {!domain.mail_enabled && !domain.meet_enabled && (
            <span className="text-gray-400 text-sm">None configured</span>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Added',
      render: (domain: Domain) => (
        <span className="text-gray-500 text-sm">
          {new Date(domain.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (domain: Domain) => (
        <div className="flex items-center justify-end">
          {domain.verification_status !== 'verified' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVerify(domain.id);
              }}
              disabled={verifying === domain.id}
              className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
            >
              {verifying === domain.id ? (
                <>
                  <RefreshCw size={14} className="mr-1 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <RefreshCw size={14} className="mr-1" />
                  Verify
                </>
              )}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Domains' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
            <p className="text-gray-500">Manage custom domains for your workspace</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Add Domain
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Add your own domain to use custom email addresses and branded
            meeting links. You'll need to configure DNS records to verify ownership.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Table */}
        <DataTable
          data={domains}
          columns={columns}
          loading={loading.domains}
          emptyMessage="No domains added yet"
          onRowClick={(domain) => router.push(`/admin/domains/${domain.id}`)}
        />

        {/* Add Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Domain"
        >
          <DomainForm
            onSubmit={handleAddDomain}
            onCancel={() => setShowAddModal(false)}
            loading={adding}
          />
        </Modal>
      </div>
    </AdminLayout>
  );
}
