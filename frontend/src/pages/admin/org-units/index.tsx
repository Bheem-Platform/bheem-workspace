/**
 * Organizational Units Management Page
 * Hierarchical organization structure management
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Building2,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Users,
  Edit2,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface OrgUnit {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  description: string | null;
  manager_id: string | null;
  manager_name: string | null;
  cost_center: string | null;
  user_count: number;
  children_count: number;
  is_active: boolean;
  children?: OrgUnit[];
}

export default function OrgUnitsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const tenantId = useCurrentTenantId();

  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<OrgUnit | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: '',
    cost_center: '',
    department_code: '',
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchOrgUnits();
    }
  }, [isAuthenticated, authLoading]);

  const fetchOrgUnits = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/org-units?include_inactive=true');
      setOrgUnits(response.data.org_units);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load organizational units');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/admin/org-units', {
        name: formData.name,
        description: formData.description || null,
        parent_id: formData.parent_id || null,
        cost_center: formData.cost_center || null,
        department_code: formData.department_code || null,
      });
      setShowCreateModal(false);
      resetForm();
      fetchOrgUnits();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create org unit');
    }
  };

  const handleUpdate = async () => {
    if (!selectedUnit) return;
    try {
      await api.put(`/admin/org-units/${selectedUnit.id}`, {
        name: formData.name,
        description: formData.description || null,
        cost_center: formData.cost_center || null,
        department_code: formData.department_code || null,
      });
      setShowCreateModal(false);
      setEditMode(false);
      resetForm();
      fetchOrgUnits();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update org unit');
    }
  };

  const handleDelete = async () => {
    if (!selectedUnit) return;
    try {
      await api.delete(`/admin/org-units/${selectedUnit.id}`);
      setShowDeleteDialog(false);
      setSelectedUnit(null);
      fetchOrgUnits();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete org unit');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      parent_id: '',
      cost_center: '',
      department_code: '',
    });
    setSelectedUnit(null);
  };

  const openEditModal = (unit: OrgUnit) => {
    setSelectedUnit(unit);
    setFormData({
      name: unit.name,
      description: unit.description || '',
      parent_id: unit.parent_id || '',
      cost_center: unit.cost_center || '',
      department_code: '',
    });
    setEditMode(true);
    setShowCreateModal(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderOrgUnit = (unit: OrgUnit, depth: number = 0) => {
    const hasChildren = unit.children && unit.children.length > 0;
    const isExpanded = expandedUnits.has(unit.id);

    return (
      <div key={unit.id}>
        <div
          className={`flex items-center justify-between py-3 px-4 hover:bg-gray-50 border-b border-gray-100 ${
            depth > 0 ? 'ml-8' : ''
          }`}
        >
          <div className="flex items-center space-x-3">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(unit.id)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-500" />
                ) : (
                  <ChevronRight size={16} className="text-gray-500" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="text-blue-600" size={18} />
            </div>
            <div>
              <p className="font-medium text-gray-900">{unit.name}</p>
              <p className="text-sm text-gray-500">{unit.path}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-500">
              <Users size={16} />
              <span className="text-sm">{unit.user_count}</span>
            </div>
            {unit.manager_name && (
              <span className="text-sm text-gray-500">Manager: {unit.manager_name}</span>
            )}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => openEditModal(unit)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => {
                  setSelectedUnit(unit);
                  setShowDeleteDialog(true);
                }}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>{unit.children!.map((child) => renderOrgUnit(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  // Flatten tree for search
  const flattenUnits = (units: OrgUnit[]): OrgUnit[] => {
    const result: OrgUnit[] = [];
    const flatten = (items: OrgUnit[]) => {
      items.forEach((item) => {
        result.push(item);
        if (item.children) flatten(item.children);
      });
    };
    flatten(units);
    return result;
  };

  const filteredUnits = search
    ? flattenUnits(orgUnits).filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.path.toLowerCase().includes(search.toLowerCase())
      )
    : orgUnits;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Organizational Units' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organizational Units</h1>
            <p className="text-gray-500">Manage your organization's structure</p>
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
            Add Org Unit
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search organizational units..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Org Units List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-500">No organizational units found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700"
              >
                Create your first org unit
              </button>
            </div>
          ) : search ? (
            // Flat list for search results
            <div>
              {filteredUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 border-b border-gray-100"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="text-blue-600" size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{unit.name}</p>
                      <p className="text-sm text-gray-500">{unit.path}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-gray-500">
                      <Users size={16} />
                      <span className="text-sm">{unit.user_count}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditModal(unit)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUnit(unit);
                          setShowDeleteDialog(true);
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Tree view
            <div>{orgUnits.map((unit) => renderOrgUnit(unit))}</div>
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
          title={editMode ? 'Edit Organizational Unit' : 'Create Organizational Unit'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Engineering"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Optional description"
              />
            </div>
            {!editMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Unit</label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None (Root level)</option>
                  {flattenUnits(orgUnits).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.path}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Center</label>
              <input
                type="text"
                value={formData.cost_center}
                onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., CC-001"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditMode(false);
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

        {/* Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteDialog(false);
            setSelectedUnit(null);
          }}
          title="Delete Organizational Unit"
          message={`Are you sure you want to delete "${selectedUnit?.name}"? ${
            selectedUnit?.user_count
              ? `${selectedUnit.user_count} users will be unassigned.`
              : ''
          }`}
          confirmText="Delete"
          danger
        />
      </div>
    </AdminLayout>
  );
}
