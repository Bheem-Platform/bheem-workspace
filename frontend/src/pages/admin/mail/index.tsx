import { useEffect, useState } from 'react';
import { Mail, Plus, Search, Settings, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import StatsCard from '@/components/admin/StatsCard';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import type { Mailbox } from '@/types/admin';

interface MailDomain {
  id: string;
  domain: string;
  is_active: boolean;
  mailboxes: number;
  max_mailboxes: number;
  quota_mb: number;
  used_quota_mb: number;
}

export default function MailSettingsPage() {
  const [mailDomains, setMailDomains] = useState<MailDomain[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailStats, setMailStats] = useState<any>(null);
  const [loadingMailboxes, setLoadingMailboxes] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [newMailbox, setNewMailbox] = useState({
    local_part: '',
    domain: '',
    name: '',
    password: '',
    quota_mb: 1024,
  });

  // Require authentication
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  // Get tenant ID from auth context
  const tenantId = useCurrentTenantId();

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    loadMailData();
  }, [tenantId, isAuthenticated, authLoading]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const loadMailData = async () => {
    setLoadingMailboxes(true);
    try {
      const [boxesResponse, statsResponse, domainsResponse] = await Promise.all([
        adminApi.listMailboxes(tenantId),
        adminApi.getMailStats(tenantId),
        adminApi.listMailDomains(tenantId),
      ]);
      setMailboxes(boxesResponse.data || []);
      setMailStats(statsResponse.data);
      setMailDomains(domainsResponse.data || []);
    } catch (err) {
      console.error('Failed to load mail data:', err);
    }
    setLoadingMailboxes(false);
  };

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await adminApi.createMailbox(tenantId, newMailbox);
      await loadMailData();
      setShowCreateModal(false);
      setNewMailbox({ local_part: '', domain: '', name: '', password: '', quota_mb: 1024 });
    } catch (err: any) {
      console.error('Failed to create mailbox:', err);
      let errorMsg = 'Failed to create mailbox';
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        // Pydantic validation errors
        errorMsg = detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = detail.msg || JSON.stringify(detail);
      } else if (err.message) {
        errorMsg = err.message;
      }
      setCreateError(errorMsg);
    }
    setCreating(false);
  };

  const handleDeleteMailbox = async () => {
    if (!selectedMailbox) return;
    try {
      await adminApi.deleteMailbox(tenantId, selectedMailbox.email);
      await loadMailData();
    } catch (err: any) {
      console.error('Failed to delete mailbox:', err);
      setCreateError(err.response?.data?.detail || 'Failed to delete mailbox');
    }
    setShowDeleteDialog(false);
    setSelectedMailbox(null);
  };

  // Use active mail domains from Mailcow
  const activeDomains = mailDomains.filter((d) => d.is_active);

  const filteredMailboxes = mailboxes.filter(
    (m) =>
      (m.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (m.display_name?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'email',
      header: 'Email Address',
      render: (mailbox: Mailbox) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Mail className="text-purple-600" size={20} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{mailbox.email}</p>
            <p className="text-sm text-gray-500">{mailbox.display_name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'storage',
      header: 'Storage Used',
      render: (mailbox: Mailbox) => (
        <div>
          <p className="text-gray-900">{(mailbox.storage_used_mb / 1024).toFixed(2)} GB</p>
          <p className="text-xs text-gray-500">
            of {(mailbox.storage_quota_mb / 1024).toFixed(0)} GB
          </p>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (mailbox: Mailbox) => (
        <span className="text-gray-500 text-sm">
          {new Date(mailbox.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (mailbox: Mailbox) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedMailbox(mailbox);
            setShowDeleteDialog(true);
          }}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
          title="Delete Mailbox"
        >
          <Trash2 size={18} />
        </button>
      ),
    },
  ];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Mail Settings' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mail Settings</h1>
            <p className="text-gray-500">Manage email accounts for your workspace</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={activeDomains.length === 0}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} className="mr-2" />
            Create Mailbox
          </button>
        </div>

        {/* No mail domains warning */}
        {activeDomains.length === 0 && !loadingMailboxes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>No mail domains available.</strong> Please contact your administrator to
              configure mail domains in Mailcow.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard
            title="Total Mailboxes"
            value={mailStats?.total_mailboxes || 0}
            icon={Mail}
            color="purple"
          />
          <StatsCard
            title="Storage Used"
            value={`${((mailStats?.total_storage_used_mb || 0) / 1024).toFixed(1)} GB`}
            icon={Mail}
            color="blue"
          />
          <StatsCard
            title="Emails Sent (Today)"
            value={mailStats?.emails_sent_today || 0}
            icon={Mail}
            color="green"
          />
          <StatsCard
            title="Emails Received (Today)"
            value={mailStats?.emails_received_today || 0}
            icon={Mail}
            color="orange"
          />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search mailboxes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        {/* Mailboxes Table */}
        <DataTable
          data={filteredMailboxes}
          columns={columns}
          loading={loadingMailboxes}
          emptyMessage="No mailboxes created yet"
        />

        {/* Create Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setCreateError(null);
          }}
          title="Create Mailbox"
        >
          <form onSubmit={handleCreateMailbox} className="space-y-4">
            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{createError}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={newMailbox.name}
                onChange={(e) =>
                  setNewMailbox({ ...newMailbox, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={newMailbox.local_part}
                  onChange={(e) =>
                    setNewMailbox({ ...newMailbox, local_part: e.target.value })
                  }
                  className="flex-1 px-4 py-2 border border-r-0 border-gray-300 rounded-l-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="john"
                  required
                />
                <span className="px-3 py-2 bg-gray-100 border border-gray-300 text-gray-500">
                  @
                </span>
                <select
                  value={newMailbox.domain}
                  onChange={(e) =>
                    setNewMailbox({ ...newMailbox, domain: e.target.value })
                  }
                  className="px-4 py-2 border border-l-0 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select domain</option>
                  {activeDomains.map((d) => (
                    <option key={d.id} value={d.domain}>
                      {d.domain}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={newMailbox.password}
                onChange={(e) =>
                  setNewMailbox({ ...newMailbox, password: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="••••••••"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Mailbox'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onConfirm={handleDeleteMailbox}
          onCancel={() => {
            setShowDeleteDialog(false);
            setSelectedMailbox(null);
          }}
          title="Delete Mailbox"
          message={`Are you sure you want to delete "${selectedMailbox?.email}"? All emails will be permanently deleted.`}
          confirmText="Delete"
          danger
        />
      </div>
    </AdminLayout>
  );
}
