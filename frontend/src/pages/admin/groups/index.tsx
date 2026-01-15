/**
 * User Groups Management Page
 * Create and manage user groups with membership
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Users,
  Plus,
  Search,
  Mail,
  Edit2,
  Trash2,
  UserPlus,
  Settings,
  RefreshCw,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  group_email: string | null;
  group_type: 'static' | 'dynamic';
  member_count: number;
  is_public: boolean;
  allow_external_members: boolean;
  created_at: string;
}

interface GroupMember {
  membership_id: string;
  member_role: string;
  can_post: boolean;
  can_invite: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export default function GroupsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    group_email: '',
    group_type: 'static' as 'static' | 'dynamic',
    is_public: false,
    allow_external_members: false,
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchGroups();
    }
  }, [isAuthenticated, authLoading]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/groups');
      setGroups(response.data.groups);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (groupId: string) => {
    try {
      setMembersLoading(true);
      const response = await api.get(`/admin/groups/${groupId}/members`);
      setMembers(response.data.members);
    } catch (err: any) {
      console.error('Failed to load members:', err);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/admin/groups', formData);
      setShowCreateModal(false);
      resetForm();
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create group');
    }
  };

  const handleUpdate = async () => {
    if (!selectedGroup) return;
    try {
      await api.put(`/admin/groups/${selectedGroup.id}`, formData);
      setShowCreateModal(false);
      setEditMode(false);
      resetForm();
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update group');
    }
  };

  const handleDelete = async () => {
    if (!selectedGroup) return;
    try {
      await api.delete(`/admin/groups/${selectedGroup.id}`);
      setShowDeleteDialog(false);
      setSelectedGroup(null);
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete group');
    }
  };

  const handleSyncDynamicGroup = async (groupId: string) => {
    try {
      await api.post(`/admin/groups/${groupId}/sync`);
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to sync group');
    }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    try {
      await api.delete(`/admin/groups/${groupId}/members/${userId}`);
      fetchMembers(groupId);
      fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove member');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      group_email: '',
      group_type: 'static',
      is_public: false,
      allow_external_members: false,
    });
    setSelectedGroup(null);
  };

  const openEditModal = (group: UserGroup) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      group_email: group.group_email || '',
      group_type: group.group_type,
      is_public: group.is_public,
      allow_external_members: group.allow_external_members,
    });
    setEditMode(true);
    setShowCreateModal(true);
  };

  const openMembersModal = (group: UserGroup) => {
    setSelectedGroup(group);
    setShowMembersModal(true);
    fetchMembers(group.id);
  };

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesType = !typeFilter || g.group_type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Groups' }]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Groups</h1>
            <p className="text-gray-500">Create and manage groups for your organization</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditMode(false);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} className="mr-2" />
            Create Group
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="static">Static</option>
            <option value="dynamic">Dynamic</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Groups</p>
            <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Static Groups</p>
            <p className="text-2xl font-bold text-blue-600">
              {groups.filter((g) => g.group_type === 'static').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Dynamic Groups</p>
            <p className="text-2xl font-bold text-purple-600">
              {groups.filter((g) => g.group_type === 'dynamic').length}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Groups List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-500">No groups found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className="p-4 hover:bg-gray-50 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-2 rounded-lg ${
                        group.group_type === 'dynamic' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}
                    >
                      <Users
                        className={
                          group.group_type === 'dynamic' ? 'text-purple-600' : 'text-blue-600'
                        }
                        size={20}
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{group.name}</p>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                            group.group_type === 'dynamic'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {group.group_type}
                          </span>
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-500">{group.description}</p>
                      )}
                      {group.group_email && (
                        <div className="flex items-center space-x-1 text-sm text-gray-400 mt-1">
                          <Mail size={14} />
                          <span>{group.group_email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => openMembersModal(group)}
                      className="flex items-center space-x-1 text-gray-500 hover:text-blue-600"
                    >
                      <Users size={16} />
                      <span className="text-sm">{group.member_count} members</span>
                    </button>
                    {group.group_type === 'dynamic' && (
                      <button
                        onClick={() => handleSyncDynamicGroup(group.id)}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                        title="Sync dynamic membership"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(group)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedGroup(group);
                        setShowDeleteDialog(true);
                      }}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditMode(false);
            resetForm();
          }}
          title={editMode ? 'Edit Group' : 'Create Group'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Engineering Team"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Email</label>
              <input
                type="email"
                value={formData.group_email}
                onChange={(e) => setFormData({ ...formData, group_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., engineering@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Type</label>
              <select
                value={formData.group_type}
                onChange={(e) =>
                  setFormData({ ...formData, group_type: e.target.value as 'static' | 'dynamic' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={editMode}
              >
                <option value="static">Static (Manual membership)</option>
                <option value="dynamic">Dynamic (Rule-based membership)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Public group (discoverable by users)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.allow_external_members}
                  onChange={(e) =>
                    setFormData({ ...formData, allow_external_members: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Allow external members</span>
              </label>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editMode ? handleUpdate : handleCreate}
                disabled={!formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editMode ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Members Modal */}
        <Modal
          isOpen={showMembersModal}
          onClose={() => {
            setShowMembersModal(false);
            setSelectedGroup(null);
            setMembers([]);
          }}
          title={`${selectedGroup?.name} - Members`}
        >
          <div className="space-y-4">
            {membersLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : members.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No members in this group</div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-200">
                {members.map((member) => (
                  <div key={member.membership_id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {member.user.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.user.name}</p>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 capitalize">{member.member_role}</span>
                      {selectedGroup?.group_type === 'static' && (
                        <button
                          onClick={() => handleRemoveMember(selectedGroup.id, member.user.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>

        {/* Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteDialog(false);
            setSelectedGroup(null);
          }}
          title="Delete Group"
          message={`Are you sure you want to delete "${selectedGroup?.name}"? This will remove all ${selectedGroup?.member_count || 0} members from the group.`}
          confirmText="Delete"
          danger
        />
      </div>
    </AdminLayout>
  );
}
