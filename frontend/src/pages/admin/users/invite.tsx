import { useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, UserPlus, Mail } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import UserForm from '@/components/admin/forms/UserForm';
import { useAdminStore } from '@/stores/adminStore';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import type { TenantUserCreate } from '@/types/admin';

export default function InviteUserPage() {
  const router = useRouter();
  const { addUser } = useAdminStore();
  const [inviting, setInviting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Require authentication
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  // Get tenant ID from auth context
  const tenantId = useCurrentTenantId();

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleInvite = async (data: TenantUserCreate) => {
    setInviting(true);
    const user = await addUser(tenantId, data);
    setInviting(false);
    if (user) {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <AdminLayout
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users', href: '/admin/users' },
          { label: 'Invite User' },
        ]}
        isSuperAdmin={false}
      >
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="text-green-600" size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invitation Sent!</h2>
            <p className="text-gray-500 mb-6">
              The user will receive an email invitation to join your workspace.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setSuccess(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Invite Another
              </button>
              <button
                onClick={() => router.push('/admin/users')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Users
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Users', href: '/admin/users' },
        { label: 'Invite User' },
      ]}
      isSuperAdmin={false}
    >
      <div className="max-w-lg mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/admin/users')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Users
        </button>

        {/* Form Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlus className="text-blue-600" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invite User</h1>
              <p className="text-sm text-gray-500">
                Send an invitation email to join your workspace
              </p>
            </div>
          </div>

          <UserForm
            onSubmit={handleInvite}
            onCancel={() => router.push('/admin/users')}
            loading={inviting}
          />
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Invited users will receive an email with a link to create
            their account. The invitation expires after 7 days.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
