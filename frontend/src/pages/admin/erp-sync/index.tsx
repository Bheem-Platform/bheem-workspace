import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Users,
  Briefcase,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Building2,
  Link2,
  Link2Off,
  ArrowRight,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useCurrentTenantId } from '@/stores/authStore';
import * as adminApi from '@/lib/adminApi';
import type { Tenant, ERPSyncStatus, ERPSyncResult } from '@/types/admin';

interface SyncCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  lastSync?: string;
  synced?: number;
  action: () => Promise<void>;
  loading: boolean;
}

export default function ERPSyncPage() {
  const router = useRouter();
  const tenantId = useCurrentTenantId();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [syncStatus, setSyncStatus] = useState<ERPSyncStatus | null>(null);
  const [syncingEmployees, setSyncingEmployees] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState(false);
  const [syncResult, setSyncResult] = useState<ERPSyncResult | null>(null);
  const [erpConnected, setErpConnected] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch tenant details
      const tenantRes = await adminApi.getTenant(tenantId);
      setTenant(tenantRes.data);

      // Check if internal mode
      if (tenantRes.data.tenant_mode !== 'internal') {
        router.replace('/admin');
        return;
      }

      // Fetch ERP sync status
      try {
        const statusRes = await adminApi.getERPSyncStatus(tenantId);
        setSyncStatus(statusRes.data);
      } catch (e) {
        setSyncStatus(null);
      }

      // Check ERP connection
      try {
        const erpRes = await adminApi.getERPIntegrationStatus();
        setErpConnected(erpRes.data.erp_connected);
      } catch (e) {
        setErpConnected(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load ERP sync data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync employees
  const handleSyncEmployees = async () => {
    if (!tenantId) return;

    setSyncingEmployees(true);
    setSyncResult(null);
    setError(null);

    try {
      const result = await adminApi.syncEmployees(tenantId);
      setSyncResult(result.data);
      await loadData(); // Refresh status
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to sync employees');
    } finally {
      setSyncingEmployees(false);
    }
  };

  // Sync projects
  const handleSyncProjects = async () => {
    if (!tenantId) return;

    setSyncingProjects(true);
    setSyncResult(null);
    setError(null);

    try {
      const result = await adminApi.syncProjects(tenantId);
      setSyncResult(result.data);
      await loadData(); // Refresh status
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to sync projects');
    } finally {
      setSyncingProjects(false);
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <AdminLayout
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'ERP Sync' },
        ]}
        isSuperAdmin={false}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  // Not internal mode - redirect
  if (tenant?.tenant_mode !== 'internal') {
    return null;
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'ERP Sync' },
      ]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ERP Integration</h1>
          <p className="text-gray-500">
            Sync employees and projects from Bheem Core ERP
          </p>
        </div>

        {/* Connection Status */}
        <div className={`rounded-xl p-4 flex items-center gap-4 ${
          erpConnected
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {erpConnected ? (
            <>
              <div className="p-2 bg-green-100 rounded-lg">
                <Link2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">Connected to Bheem Core ERP</p>
                <p className="text-sm text-green-600">
                  Company: {tenant?.erp_company_code} ({tenant?.name})
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-red-100 rounded-lg">
                <Link2Off className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-red-800">ERP Connection Failed</p>
                <p className="text-sm text-red-600">
                  Unable to connect to Bheem Core ERP. Please check configuration.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Sync Result */}
        {syncResult && (
          <div className={`rounded-xl p-4 ${
            syncResult.status === 'completed'
              ? 'bg-green-50 border border-green-200'
              : syncResult.status === 'failed'
                ? 'bg-red-50 border border-red-200'
                : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              {syncResult.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : syncResult.status === 'failed' ? (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              ) : (
                <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  syncResult.status === 'completed'
                    ? 'text-green-800'
                    : syncResult.status === 'failed'
                      ? 'text-red-800'
                      : 'text-blue-800'
                }`}>
                  Sync {syncResult.status === 'completed' ? 'Completed' : syncResult.status === 'failed' ? 'Failed' : 'In Progress'}
                </p>
                <p className="text-sm text-gray-600">
                  {syncResult.synced} of {syncResult.total} items synced
                </p>
                {syncResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-red-700">Errors:</p>
                    <ul className="text-sm text-red-600 list-disc list-inside">
                      {syncResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err.error}</li>
                      ))}
                      {syncResult.errors.length > 5 && (
                        <li>...and {syncResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sync Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employee Sync */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Employee Sync</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sync employees from HR module to workspace users
                </p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Last sync:</span>
                    <span className="text-gray-700">{formatDate(syncStatus?.last_employee_sync)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Synced users:</span>
                    <span className="text-gray-700">{syncStatus?.employees_synced || 0}</span>
                  </div>
                </div>

                <button
                  onClick={handleSyncEmployees}
                  disabled={syncingEmployees || !erpConnected}
                  className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {syncingEmployees ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Employees
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Project Sync */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Briefcase className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Project Sync</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sync projects from PM module to workspace
                </p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Last sync:</span>
                    <span className="text-gray-700">{formatDate(syncStatus?.last_project_sync)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Synced projects:</span>
                    <span className="text-gray-700">{syncStatus?.projects_synced || 0}</span>
                  </div>
                </div>

                <button
                  onClick={handleSyncProjects}
                  disabled={syncingProjects || !erpConnected}
                  className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {syncingProjects ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Projects
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ERP Modules Access */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">ERP Module Access</h2>
          <p className="text-sm text-gray-500 mb-4">
            As a Bheemverse subsidiary, you have access to the following ERP modules:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'HR Module', description: 'Employee management, payroll, attendance', icon: Users, color: 'blue' },
              { name: 'PM Module', description: 'Projects, tasks, team management', icon: Briefcase, color: 'purple' },
              { name: 'CRM Module', description: 'Contacts, accounts, opportunities', icon: Building2, color: 'green' },
            ].map((module) => (
              <div
                key={module.name}
                className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg"
              >
                <div className={`p-2 bg-${module.color}-100 rounded-lg`}>
                  <module.icon className={`h-5 w-5 text-${module.color}-600`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{module.name}</p>
                  <p className="text-sm text-gray-500">{module.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <a
              href="https://backend.agentbheem.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
            >
              Open Bheem Core ERP
              <ArrowRight className="h-4 w-4 ml-1" />
            </a>
          </div>
        </div>

        {/* Sync Errors */}
        {syncStatus?.sync_errors && syncStatus.sync_errors.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Sync Errors</h2>
            <div className="space-y-2">
              {syncStatus.sync_errors.map((error, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-3 bg-red-50 rounded-lg"
                >
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
