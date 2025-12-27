import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Users,
  Globe,
  Mail,
  Video,
  FileText,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import StatsCard from '@/components/admin/StatsCard';
import StatusBadge from '@/components/admin/StatusBadge';
import UsageProgressBar from '@/components/admin/UsageProgressBar';
import ActivityFeed from '@/components/admin/ActivityFeed';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import TenantForm from '@/components/admin/forms/TenantForm';
import { useAdminStore } from '@/stores/adminStore';
import * as adminApi from '@/lib/adminApi';
import type { TenantUpdate } from '@/types/admin';

export default function TenantDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const {
    currentTenant,
    activityLogs,
    fetchTenant,
    fetchActivityLogs,
    updateTenant,
    deleteTenant,
    loading,
  } = useAdminStore();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchTenant(id);
      fetchActivityLogs(id, { limit: 10 });
    }
  }, [id, fetchTenant, fetchActivityLogs]);

  const handleUpdate = async (data: TenantUpdate) => {
    if (!id || typeof id !== 'string') return;
    setUpdating(true);
    await updateTenant(id, data);
    setUpdating(false);
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    if (!id || typeof id !== 'string') return;
    setUpdating(true);
    const success = await deleteTenant(id);
    setUpdating(false);
    if (success) {
      router.push('/super-admin/tenants');
    }
  };

  const handleSuspend = async () => {
    if (!id || typeof id !== 'string' || !currentTenant) return;
    setUpdating(true);
    await updateTenant(id, { is_active: !currentTenant.is_active });
    setUpdating(false);
    setShowSuspendDialog(false);
  };

  if (loading.tenant || !currentTenant) {
    return (
      <AdminLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Super Admin', href: '/super-admin' },
        { label: 'Tenants', href: '/super-admin/tenants' },
        { label: currentTenant.name },
      ]}
    >
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/super-admin/tenants')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Tenants
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-purple-600 font-bold text-2xl">
                  {currentTenant.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{currentTenant.name}</h1>
                <p className="text-gray-500">{currentTenant.slug} • {currentTenant.owner_email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <StatusBadge
                    status={currentTenant.is_suspended ? 'suspended' : currentTenant.is_active ? 'active' : 'inactive'}
                  />
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    currentTenant.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                    currentTenant.plan === 'business' ? 'bg-blue-100 text-blue-700' :
                    currentTenant.plan === 'starter' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {currentTenant.plan} plan
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Edit size={18} className="mr-2" />
                Edit
              </button>
              <button
                onClick={() => setShowSuspendDialog(true)}
                className={`inline-flex items-center px-4 py-2 rounded-lg ${
                  currentTenant.is_active
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {currentTenant.is_active ? (
                  <>
                    <Ban size={18} className="mr-2" />
                    Suspend
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} className="mr-2" />
                    Activate
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                <Trash2 size={18} className="mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Users"
            value={`${currentTenant.user_count} / ${currentTenant.max_users}`}
            icon={Users}
            color="purple"
          />
          <StatsCard
            title="Meet Hours"
            value={`${currentTenant.meet_used_hours.toFixed(1)} / ${currentTenant.meet_quota_hours}`}
            icon={Video}
            color="blue"
          />
          <StatsCard
            title="Docs Storage"
            value={`${(currentTenant.docs_used_mb / 1024).toFixed(1)} GB`}
            icon={FileText}
            color="green"
            subtitle={`of ${(currentTenant.docs_quota_mb / 1024).toFixed(0)} GB`}
          />
          <StatsCard
            title="Mail Storage"
            value={`${(currentTenant.mail_used_mb / 1024).toFixed(1)} GB`}
            icon={Mail}
            color="orange"
            subtitle={`of ${(currentTenant.mail_quota_mb / 1024).toFixed(0)} GB`}
          />
        </div>

        {/* Usage & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Usage */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Resource Usage</h2>
            <div className="space-y-6">
              <UsageProgressBar
                label="Users"
                used={currentTenant.user_count}
                quota={currentTenant.max_users}
                unit="users"
              />
              <UsageProgressBar
                label="Meet Hours"
                used={currentTenant.meet_used_hours}
                quota={currentTenant.meet_quota_hours}
                unit="hours"
              />
              <UsageProgressBar
                label="Docs Storage"
                used={currentTenant.docs_used_mb}
                quota={currentTenant.docs_quota_mb}
                unit="MB"
              />
              <UsageProgressBar
                label="Mail Storage"
                used={currentTenant.mail_used_mb}
                quota={currentTenant.mail_quota_mb}
                unit="MB"
              />
              <UsageProgressBar
                label="Recordings"
                used={currentTenant.recordings_used_mb}
                quota={currentTenant.recordings_quota_mb}
                unit="MB"
              />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <ActivityFeed activities={activityLogs} loading={loading.activity} />
          </div>
        </div>

        {/* Edit Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Tenant"
          size="lg"
        >
          <TenantForm
            initialData={currentTenant}
            onSubmit={handleUpdate}
            onCancel={() => setShowEditModal(false)}
            isEdit
            loading={updating}
          />
        </Modal>

        {/* Suspend Dialog */}
        <ConfirmDialog
          isOpen={showSuspendDialog}
          onConfirm={handleSuspend}
          onCancel={() => setShowSuspendDialog(false)}
          title={currentTenant.is_active ? 'Suspend Tenant' : 'Activate Tenant'}
          message={
            currentTenant.is_active
              ? `Are you sure you want to suspend "${currentTenant.name}"? Users will not be able to access the workspace.`
              : `Are you sure you want to activate "${currentTenant.name}"? Users will regain access to the workspace.`
          }
          confirmText={currentTenant.is_active ? 'Suspend' : 'Activate'}
          danger={currentTenant.is_active}
          loading={updating}
        />

        {/* Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
          title="Delete Tenant"
          message={`Are you sure you want to delete "${currentTenant.name}"? This action cannot be undone.`}
          confirmText="Delete"
          danger
          loading={updating}
        />
      </div>
    </AdminLayout>
  );
}
