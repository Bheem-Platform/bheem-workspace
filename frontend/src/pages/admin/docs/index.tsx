import { useEffect, useState } from 'react';
import {
  HardDrive,
  Users,
  Share2,
  FolderOpen,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Settings,
  Download,
  Trash2,
  Plus,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import StatusBadge from '@/components/admin/StatusBadge';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import { formatMB } from '@/lib/adminApi';

interface DocsUser {
  username: string;
  display_name: string;
  email: string;
  quota_bytes: number;
  quota_mb: number | null;
  used_bytes: number;
  used_mb: number;
  usage_percent: number;
}

interface DocsShare {
  id: string;
  path: string;
  share_type: string;
  share_with: string;
  permissions: number;
  expiration: string | null;
  token: string;
}

interface DocsGroup {
  name: string;
  members?: string[];
}

interface StorageStats {
  total_users: number;
  storage: {
    used_bytes: number;
    used_mb: number;
    used_gb: number;
    quota_bytes: number | null;
  };
  top_users: Array<{ username: string; used_mb: number }>;
}

export default function DocsAdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'shares' | 'groups' | 'storage'>('users');
  const [users, setUsers] = useState<DocsUser[]>([]);
  const [shares, setShares] = useState<DocsShare[]>([]);
  const [groups, setGroups] = useState<DocsGroup[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showDeleteShareDialog, setShowDeleteShareDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DocsUser | null>(null);
  const [selectedShare, setSelectedShare] = useState<DocsShare | null>(null);
  const [newQuota, setNewQuota] = useState<number>(1024);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const tenantId = useCurrentTenantId();

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    loadData();
  }, [activeTab, tenantId, isAuthenticated, authLoading]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (activeTab) {
        case 'users':
          const usersRes = await adminApi.listDocsUsers(tenantId);
          setUsers(usersRes.data.users || []);
          break;
        case 'shares':
          const sharesRes = await adminApi.listDocsShares(tenantId);
          setShares(sharesRes.data.shares || []);
          break;
        case 'groups':
          const groupsRes = await adminApi.listDocsGroups(tenantId);
          setGroups(groupsRes.data.groups || []);
          break;
        case 'storage':
          const statsRes = await adminApi.getDocsStorageStats(tenantId);
          setStorageStats(statsRes.data);
          break;
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data');
    }
    setLoading(false);
  };

  const handleSetQuota = async () => {
    if (!selectedUser) return;
    try {
      await adminApi.setDocsUserQuota(tenantId, selectedUser.username, newQuota);
      setShowQuotaModal(false);
      setSelectedUser(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to set quota');
    }
  };

  const handleToggleUser = async (user: DocsUser, enable: boolean) => {
    try {
      if (enable) {
        await adminApi.enableDocsUser(tenantId, user.username);
      } else {
        await adminApi.disableDocsUser(tenantId, user.username);
      }
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDeleteShare = async () => {
    if (!selectedShare) return;
    try {
      await adminApi.deleteDocsShare(tenantId, selectedShare.id);
      setShowDeleteShareDialog(false);
      setSelectedShare(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete share');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await adminApi.createDocsGroup(tenantId, newGroupName);
      setShowGroupModal(false);
      setNewGroupName('');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create group');
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username?.toLowerCase().includes(search.toLowerCase()) ||
    user.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getPermissionLabel = (permissions: number) => {
    const perms = [];
    if (permissions & 1) perms.push('Read');
    if (permissions & 2) perms.push('Update');
    if (permissions & 4) perms.push('Create');
    if (permissions & 8) perms.push('Delete');
    if (permissions & 16) perms.push('Share');
    return perms.join(', ') || 'None';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const userColumns = [
    {
      key: 'user',
      header: 'User',
      render: (user: DocsUser) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 font-semibold">
              {(user.display_name || user.username || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{user.display_name || user.username}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'quota',
      header: 'Quota',
      render: (user: DocsUser) => (
        <span className="text-gray-700">
          {user.quota_mb ? formatMB(user.quota_mb) : 'Unlimited'}
        </span>
      ),
    },
    {
      key: 'used',
      header: 'Used',
      render: (user: DocsUser) => (
        <div className="w-32">
          <div className="flex justify-between text-sm mb-1">
            <span>{formatMB(user.used_mb)}</span>
            <span className="text-gray-500">{user.usage_percent?.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                user.usage_percent >= 90 ? 'bg-red-500' :
                user.usage_percent >= 75 ? 'bg-orange-500' :
                user.usage_percent >= 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(user.usage_percent || 0, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (user: DocsUser) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(user);
              setNewQuota(user.quota_mb || 1024);
              setShowQuotaModal(true);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            title="Set Quota"
          >
            <Settings size={18} />
          </button>
        </div>
      ),
    },
  ];

  const shareColumns = [
    {
      key: 'path',
      header: 'Path',
      render: (share: DocsShare) => (
        <div className="flex items-center space-x-2">
          <FolderOpen size={18} className="text-yellow-500" />
          <span className="font-medium text-gray-900">{share.path}</span>
        </div>
      ),
    },
    {
      key: 'shared_with',
      header: 'Shared With',
      render: (share: DocsShare) => (
        <span className="text-gray-700">{share.share_with || 'Public Link'}</span>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (share: DocsShare) => (
        <span className="text-sm text-gray-600">{getPermissionLabel(share.permissions)}</span>
      ),
    },
    {
      key: 'expiration',
      header: 'Expires',
      render: (share: DocsShare) => (
        <span className="text-gray-500">
          {share.expiration ? new Date(share.expiration).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (share: DocsShare) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShare(share);
            setShowDeleteShareDialog(true);
          }}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
          title="Delete Share"
        >
          <Trash2 size={18} />
        </button>
      ),
    },
  ];

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'shares', label: 'Shares', icon: Share2 },
    { id: 'groups', label: 'Groups', icon: FolderOpen },
    { id: 'storage', label: 'Storage', icon: HardDrive },
  ];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Documents' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Storage</h1>
            <p className="text-gray-500">Manage Nextcloud users, shares, and storage quotas</p>
          </div>
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
                    ? 'border-blue-500 text-blue-600'
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

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <DataTable
              data={filteredUsers}
              columns={userColumns}
              loading={loading}
              emptyMessage="No document users found"
            />
          </>
        )}

        {/* Shares Tab */}
        {activeTab === 'shares' && (
          <DataTable
            data={shares}
            columns={shareColumns}
            loading={loading}
            emptyMessage="No shares found"
          />
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <>
            <div className="flex justify-end">
              <button
                onClick={() => setShowGroupModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} className="mr-2" />
                Create Group
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div className="col-span-3 text-center py-8 text-gray-500">Loading...</div>
              ) : groups.length === 0 ? (
                <div className="col-span-3 text-center py-8 text-gray-500">No groups found</div>
              ) : (
                groups.map((group: any) => (
                  <div key={typeof group === 'string' ? group : group.name} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <FolderOpen size={20} className="text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{typeof group === 'string' ? group : group.name}</p>
                          <p className="text-sm text-gray-500">
                            {typeof group === 'object' && group.members ? `${group.members.length} members` : 'Group'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : storageStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{storageStats.total_users}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Used Storage</p>
                    <p className="text-2xl font-bold text-blue-600">{storageStats.storage.used_gb?.toFixed(2)} GB</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Total Quota</p>
                    <p className="text-2xl font-bold text-green-600">
                      {storageStats.storage.quota_bytes ? formatMB(storageStats.storage.quota_bytes / (1024 * 1024)) : 'Unlimited'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Top Users</p>
                    <p className="text-2xl font-bold text-purple-600">{storageStats.top_users?.length || 0}</p>
                  </div>
                </div>

                {storageStats.top_users && storageStats.top_users.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Storage Users</h3>
                    <div className="space-y-3">
                      {storageStats.top_users.map((user, idx) => (
                        <div key={user.username} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-400 w-6">{idx + 1}.</span>
                            <span className="font-medium text-gray-900">{user.username}</span>
                          </div>
                          <span className="text-gray-600">{formatMB(user.used_mb)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">No storage data available</div>
            )}
          </div>
        )}

        {/* Set Quota Modal */}
        <Modal
          isOpen={showQuotaModal}
          onClose={() => {
            setShowQuotaModal(false);
            setSelectedUser(null);
          }}
          title={`Set Quota for ${selectedUser?.display_name || selectedUser?.username}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quota (MB)
              </label>
              <input
                type="number"
                value={newQuota}
                onChange={(e) => setNewQuota(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min={0}
              />
              <p className="text-sm text-gray-500 mt-1">Set to 0 for unlimited quota</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowQuotaModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSetQuota}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>

        {/* Create Group Modal */}
        <Modal
          isOpen={showGroupModal}
          onClose={() => {
            setShowGroupModal(false);
            setNewGroupName('');
          }}
          title="Create New Group"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter group name"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setNewGroupName('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </Modal>

        {/* Delete Share Dialog */}
        <ConfirmDialog
          isOpen={showDeleteShareDialog}
          onConfirm={handleDeleteShare}
          onCancel={() => {
            setShowDeleteShareDialog(false);
            setSelectedShare(null);
          }}
          title="Delete Share"
          message={`Are you sure you want to delete the share for "${selectedShare?.path}"?`}
          confirmText="Delete"
          danger
        />
      </div>
    </AdminLayout>
  );
}
