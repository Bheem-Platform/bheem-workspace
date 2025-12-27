import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Globe,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Mail,
  Video,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import StatusBadge from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/Modal';
import { useAdminStore } from '@/stores/adminStore';
import * as adminApi from '@/lib/adminApi';
import type { Domain, DNSRecord } from '@/types/admin';

export default function DomainDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { domains, fetchDomains, verifyDomain, loading } = useAdminStore();

  const [domain, setDomain] = useState<Domain | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);

  const tenantId = 'current-tenant-id';

  useEffect(() => {
    if (domains.length === 0) {
      fetchDomains(tenantId);
    }
  }, [domains.length, fetchDomains, tenantId]);

  useEffect(() => {
    if (id && typeof id === 'string' && domains.length > 0) {
      const found = domains.find((d) => d.id === id);
      if (found) setDomain(found);
    }
  }, [id, domains]);

  useEffect(() => {
    const loadDnsRecords = async () => {
      if (!id || typeof id !== 'string') return;
      setLoadingRecords(true);
      try {
        const response = await adminApi.getDomainDNSRecords(tenantId, id);
        setDnsRecords(response.data.email_records || []);
      } catch (err) {
        console.error('Failed to load DNS records:', err);
      }
      setLoadingRecords(false);
    };
    if (domain) {
      loadDnsRecords();
    }
  }, [domain, id, tenantId]);

  const handleVerify = async () => {
    if (!id || typeof id !== 'string') return;
    setVerifying(true);
    await verifyDomain(tenantId, id);
    setVerifying(false);
  };

  const handleDelete = async () => {
    // API would delete domain here
    setShowDeleteDialog(false);
    router.push('/admin/domains');
  };

  const handleCopyRecord = (value: string, recordId: string) => {
    navigator.clipboard.writeText(value);
    setCopiedRecord(recordId);
    setTimeout(() => setCopiedRecord(null), 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'failed':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-yellow-500" size={20} />;
    }
  };

  if (loading.domains || !domain) {
    return (
      <AdminLayout isSuperAdmin={false}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Domains', href: '/admin/domains' },
        { label: domain.domain },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/admin/domains')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Domains
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                <Globe className="text-green-600" size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{domain.domain}</h1>
                <div className="flex items-center space-x-2 mt-2">
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
                  {domain.is_primary && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      Primary
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {domain.verification_status !== 'verified' && (
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <RefreshCw size={18} className="mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} className="mr-2" />
                      Verify Now
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                <Trash2 size={18} className="mr-2" />
                Remove
              </button>
            </div>
          </div>
        </div>

        {/* DNS Records */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">DNS Records</h2>
          <p className="text-sm text-gray-500 mb-6">
            Add these DNS records to your domain provider to verify ownership and enable services.
          </p>

          {loadingRecords ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : dnsRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No DNS records to configure
            </div>
          ) : (
            <div className="space-y-4">
              {dnsRecords.map((record) => (
                <div
                  key={record.id}
                  className={`p-4 rounded-lg border ${
                    record.is_verified
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-mono rounded">
                          {record.record_type}
                        </span>
                        <span className="text-sm text-gray-600">{record.purpose}</span>
                        {record.is_verified && (
                          <CheckCircle className="text-green-500" size={16} />
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Name/Host</p>
                          <div className="flex items-center space-x-2">
                            <code className="bg-white px-2 py-1 rounded border text-xs">
                              {record.name}
                            </code>
                            <button
                              onClick={() => handleCopyRecord(record.name, `${record.id}-name`)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              {copiedRecord === `${record.id}-name` ? (
                                <Check size={14} className="text-green-500" />
                              ) : (
                                <Copy size={14} className="text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-500">Value</p>
                          <div className="flex items-center space-x-2">
                            <code className="bg-white px-2 py-1 rounded border text-xs truncate max-w-xs">
                              {record.value}
                            </code>
                            <button
                              onClick={() => handleCopyRecord(record.value, `${record.id}-value`)}
                              className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                            >
                              {copiedRecord === `${record.id}-value` ? (
                                <Check size={14} className="text-green-500" />
                              ) : (
                                <Copy size={14} className="text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>
                        {record.priority && (
                          <div>
                            <p className="text-gray-500">Priority</p>
                            <code className="bg-white px-2 py-1 rounded border text-xs">
                              {record.priority}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Services */}
        {domain.verification_status === 'verified' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Mail className="text-purple-600" size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Email</p>
                      <p className="text-sm text-gray-500">
                        {domain.mail_enabled ? 'Enabled' : 'Not configured'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/admin/mail')}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Configure
                  </button>
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Video className="text-orange-600" size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Meet</p>
                      <p className="text-sm text-gray-500">
                        {domain.meet_enabled ? 'Enabled' : 'Not configured'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/admin/meet')}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Configure
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
          title="Remove Domain"
          message={`Are you sure you want to remove "${domain.domain}"? All associated email addresses and services will be disabled.`}
          confirmText="Remove"
          danger
        />
      </div>
    </AdminLayout>
  );
}
