import { useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Globe } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import DomainForm from '@/components/admin/forms/DomainForm';
import { useAdminStore } from '@/stores/adminStore';
import { useCurrentTenantId } from '@/stores/authStore';
import type { DomainCreate } from '@/types/admin';

export default function AddDomainPage() {
  const router = useRouter();
  const { addDomain } = useAdminStore();
  const [adding, setAdding] = useState(false);

  // Get tenant ID from auth context
  const tenantId = useCurrentTenantId();

  const handleAddDomain = async (data: DomainCreate) => {
    setAdding(true);
    const domain = await addDomain(tenantId, data);
    setAdding(false);
    if (domain) {
      // Redirect to domain detail to configure DNS
      router.push(`/admin/domains/${domain.id}`);
    }
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Domains', href: '/admin/domains' },
        { label: 'Add Domain' },
      ]}
      isSuperAdmin={false}
    >
      <div className="max-w-lg mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/admin/domains')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Domains
        </button>

        {/* Form Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <Globe className="text-green-600" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Add Domain</h1>
              <p className="text-sm text-gray-500">
                Add a custom domain to your workspace
              </p>
            </div>
          </div>

          <DomainForm
            onSubmit={handleAddDomain}
            onCancel={() => router.push('/admin/domains')}
            loading={adding}
          />
        </div>

        {/* Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-gray-900">How it works:</h3>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Enter your domain name (e.g., workspace.yourcompany.com)</li>
            <li>We'll generate DNS records you need to add</li>
            <li>Add the records to your DNS provider</li>
            <li>Click "Verify" to confirm ownership</li>
            <li>Enable services like Mail and Meet on your domain</li>
          </ol>
        </div>
      </div>
    </AdminLayout>
  );
}
