/**
 * Admin Roles Management Page
 * Custom role-based access control
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  Lock,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  user_count: number;
  created_at: string;
}

interface Permission {
  key: string;
  description: string;
}

interface PermissionCategory {
  name: string;
  permissions: Permission[];
}

export default function AdminRolesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AdminRole | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Users']));

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchRoles();
      fetchPermissions();
    }
  }, [isAuthenticated, authLoading]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/roles');
      setRoles(response.data.roles);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await api.get('/admin/roles/permissions');
      setPermissions(response.data.permissions);
    } catch (err: any) {
      console.error('Failed to load permissions:', err);
    }
  };

  // Group permissions by category
  const groupedPermissions: PermissionCategory[] = [
    {
      name: 'Users',
      permissions: permissions.filter((p) => p.key.startsWith('users.')),
    },
    {
      name: 'Groups',
      permissions: permissions.filter((p) => p.key.startsWith('groups.')),
    },
    {
      name: 'Org Units',
      permissions: permissions.filter((p) => p.key.startsWith('org_units.')),
    },
    {
      name: 'Domains',
      permissions: permissions.filter((p) => p.key.startsWith('domains.')),
    },
    {
      name: 'Security',
      permissions: permissions.filter((p) => p.key.startsWith('security.')),
    },
    {
      name: 'Billing',
      permissions: permissions.filter((p) => p.key.startsWith('billing.')),
    },
    {
      name: 'Reports',
      permissions: permissions.filter((p) => p.key.startsWith('reports.')),
    },
    {
      name: 'Mail',
      permissions: permissions.filter((p) => p.key.startsWith('mail.')),
    },
    {
      name: 'Meet',
      permissions: permissions.filter((p) => p.key.startsWith('meet.')),
    },
    {
      name: 'Docs',
      permissions: permissions.filter((p) => p.key.startsWith('docs.')),
    },
  ].filter((cat) => cat.permissions.length > 0);

  const handleCreate = async () => {
    try {
      await api.post('/admin/roles', formData);
      setShowCreateModal(false);
      resetForm();
      fetchRoles();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create role');
    }
  };

  const handleUpdate = async () => {
    if (!selectedRole) return;
    try {
      await api.put(`/admin/roles/${selectedRole.id}`, formData);
      setShowCreateModal(false);
      setEditMode(false);
      resetForm();
      fetchRoles();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;
    try {
      await api.delete(`/admin/roles/${selectedRole.id}`);
      setShowDeleteDialog(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete role');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: [],
    });
    setSelectedRole(null);
  };

  const openEditModal = (role: AdminRole) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
    });
    setEditMode(true);
    setShowCreateModal(true);
  };

  const togglePermission = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const selectAllInCategory = (category: PermissionCategory) => {
    const categoryKeys = category.permissions.map((p) => p.key);
    const allSelected = categoryKeys.every((k) => formData.permissions.includes(k));
    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => !categoryKeys.includes(p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: Array.from(new Set([...prev.permissions, ...categoryKeys])),
      }));
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Admin Roles' }]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Roles</h1>
            <p className="text-gray-500">Create custom roles with granular permissions</p>
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
            Create Role
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Roles List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : roles.length === 0 ? (
            <div className="col-span-3 p-8 text-center bg-white rounded-xl border border-gray-200">
              <Shield className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-500">No roles found</p>
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        role.is_system ? 'bg-purple-100' : 'bg-blue-100'
                      }`}
                    >
                      <Shield
                        className={role.is_system ? 'text-purple-600' : 'text-blue-600'}
                        size={20}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{role.name}</h3>
                      {role.is_system && (
                        <span className="text-xs text-purple-600 flex items-center gap-1">
                          <Lock size={10} /> System Role
                        </span>
                      )}
                    </div>
                  </div>
                  {!role.is_system && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditModal(role)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRole(role);
                          setShowDeleteDialog(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {role.description && (
                  <p className="text-sm text-gray-500 mb-3">{role.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-1 text-gray-500">
                    <Users size={14} />
                    <span>{role.user_count} users</span>
                  </div>
                  <span className="text-gray-400">{role.permissions.length} permissions</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {role.permissions.slice(0, 3).map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                    >
                      {perm}
                    </span>
                  ))}
                  {role.permissions.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                      +{role.permissions.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))
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
          title={editMode ? 'Edit Role' : 'Create Role'}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., User Manager"
                disabled={editMode && selectedRole?.is_system}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
                placeholder="What can this role do?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                {groupedPermissions.map((category) => {
                  const isExpanded = expandedCategories.has(category.name);
                  const selectedCount = category.permissions.filter((p) =>
                    formData.permissions.includes(p.key)
                  ).length;
                  const allSelected = selectedCount === category.permissions.length;

                  return (
                    <div key={category.name}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category.name)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-2">
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-400" />
                          )}
                          <span className="font-medium text-gray-700">{category.name}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {selectedCount}/{category.permissions.length}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-2 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => selectAllInCategory(category)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            {allSelected ? 'Deselect all' : 'Select all'}
                          </button>
                          {category.permissions.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex items-start space-x-2 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(perm.key)}
                                onChange={() => togglePermission(perm.key)}
                                className="mt-0.5 w-4 h-4 text-blue-600 rounded"
                                disabled={editMode && selectedRole?.is_system}
                              />
                              <div>
                                <p className="text-sm text-gray-700">{perm.key}</p>
                                <p className="text-xs text-gray-500">{perm.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
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
                disabled={!formData.name.trim() || formData.permissions.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editMode ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteDialog(false);
            setSelectedRole(null);
          }}
          title="Delete Role"
          message={`Are you sure you want to delete "${selectedRole?.name}"? Users assigned to this role will lose their permissions.`}
          confirmText="Delete"
          danger
        />
      </div>
    </AdminLayout>
  );
}
