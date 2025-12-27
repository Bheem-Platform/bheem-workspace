import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Plus, Search, UserPlus, MoreVertical, Shield, User, UserX } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import StatusBadge from '@/components/admin/StatusBadge';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import UserForm from '@/components/admin/forms/UserForm';
import { useAdminStore } from '@/stores/adminStore';
import type { TenantUser, TenantUserCreate, TenantUserUpdate } from '@/types/admin';

export default function UsersPage() {
  const router = useRouter();
  const { users, fetchUsers, addUser, removeUser, loading, error } = useAdminStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [inviting, setInviting] = useState(false);

  // In real app, get tenant ID from auth context
  const tenantId = 'current-tenant-id';

  useEffect(() => {
    fetchUsers(tenantId);
  }, [fetchUsers, tenantId]);

  const handleInviteUser = async (data: TenantUserCreate) => {
    setInviting(true);
    const user = await addUser(tenantId, data);
    setInviting(false);
    if (user) {
      setShowInviteModal(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    await removeUser(tenantId, selectedUser.id);
    setShowDeleteDialog(false);
    setSelectedUser(null);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield size={14} className="text-purple-500" />;
      case 'member':
        return <User size={14} className="text-blue-500" />;
      case 'guest':
        return <UserX size={14} className="text-gray-500" />;
      default:
        return <User size={14} />;
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (user: TenantUser) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: TenantUser) => (
        <div className="flex items-center space-x-2">
          {getRoleIcon(user.role)}
          <span className="capitalize text-gray-700">{user.role}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: TenantUser) => (
        <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'last_login',
      header: 'Last Login',
      render: (user: TenantUser) => (
        <span className="text-gray-500 text-sm">
          {user.last_login_at
            ? new Date(user.last_login_at).toLocaleDateString()
            : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (user: TenantUser) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(user);
              setShowDeleteDialog(true);
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Remove User"
          >
            <UserX size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Users' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-gray-500">Manage workspace members and their permissions</p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus size={20} className="mr-2" />
            Invite User
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Admins</p>
            <p className="text-2xl font-bold text-purple-600">
              {users.filter((u) => u.role === 'admin').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Members</p>
            <p className="text-2xl font-bold text-blue-600">
              {users.filter((u) => u.role === 'member').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Guests</p>
            <p className="text-2xl font-bold text-gray-600">
              {users.filter((u) => u.role === 'guest').length}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Table */}
        <DataTable
          data={filteredUsers}
          columns={columns}
          loading={loading.users}
          emptyMessage="No users found"
          onRowClick={(user) => router.push(`/admin/users/${user.id}`)}
        />

        {/* Invite Modal */}
        <Modal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title="Invite New User"
        >
          <UserForm
            onSubmit={handleInviteUser}
            onCancel={() => setShowInviteModal(false)}
            loading={inviting}
          />
        </Modal>

        {/* Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onConfirm={handleDeleteUser}
          onCancel={() => {
            setShowDeleteDialog(false);
            setSelectedUser(null);
          }}
          title="Remove User"
          message={`Are you sure you want to remove "${selectedUser?.name}"? They will lose access to the workspace.`}
          confirmText="Remove"
          danger
        />
      </div>
    </AdminLayout>
  );
}
