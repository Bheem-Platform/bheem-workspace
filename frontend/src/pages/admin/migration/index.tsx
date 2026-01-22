/**
 * One-Click Migration Page
 * Import emails, contacts, and files from Google Workspace / Microsoft 365
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Cloud,
  Mail,
  Users,
  HardDrive,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Play,
  ArrowRight,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import * as migrationApi from '@/lib/migrationApi';
import type { MigrationConnection, MigrationPreview, MigrationJob, StartMigrationRequest } from '@/lib/migrationApi';

// ==================== PROVIDER CARD COMPONENT ====================

interface ProviderCardProps {
  provider: 'google' | 'microsoft' | 'imap';
  title: string;
  description: string;
  icon: React.ReactNode;
  bgColor: string;
  onConnect: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function ProviderCard({ provider, title, description, icon, bgColor, onConnect, loading, disabled }: ProviderCardProps) {
  return (
    <div className="bg-white rounded-xl border-2 border-gray-100 p-6 hover:border-blue-200 hover:shadow-lg transition-all">
      <div className={`w-14 h-14 rounded-xl ${bgColor} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{description}</p>
      <button
        onClick={onConnect}
        disabled={loading || disabled}
        className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Connect
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

// ==================== CONNECTION ITEM COMPONENT ====================

interface ConnectionItemProps {
  connection: MigrationConnection;
  onMigrate: () => void;
  onDelete: () => void;
}

function ConnectionItem({ connection, onMigrate, onDelete }: ConnectionItemProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          connection.provider === 'google' ? 'bg-red-100' :
          connection.provider === 'microsoft' ? 'bg-blue-100' : 'bg-gray-100'
        }`}>
          {connection.provider === 'google' && (
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {connection.provider === 'microsoft' && (
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z"/>
              <path fill="#7FBA00" d="M13 1h10v10H13z"/>
              <path fill="#00A4EF" d="M1 13h10v10H1z"/>
              <path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
          )}
          {connection.provider === 'imap' && <Mail className="h-6 w-6 text-gray-600" />}
        </div>
        <div>
          <p className="font-medium text-gray-900">{connection.email}</p>
          <p className="text-sm text-gray-500 capitalize">{connection.provider}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onMigrate}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Play className="h-4 w-4" />
          Migrate
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ==================== MIGRATION MODAL COMPONENT ====================

interface MigrationModalProps {
  connection: MigrationConnection;
  onClose: () => void;
  onStart: (config: StartMigrationRequest) => void;
}

function MigrationModal({ connection, onClose, onStart }: MigrationModalProps) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [migrateEmail, setMigrateEmail] = useState(true);
  const [migrateContacts, setMigrateContacts] = useState(true);
  const [migrateDrive, setMigrateDrive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const data = await migrationApi.getPreview(connection.id);
        setPreview(data);
      } catch (err: any) {
        console.error('Failed to load preview:', err);
        setError(err.response?.data?.detail || 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };
    loadPreview();
  }, [connection.id]);

  const handleStart = () => {
    onStart({
      connection_id: connection.id,
      migrate_email: migrateEmail,
      migrate_contacts: migrateContacts,
      migrate_drive: migrateDrive,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Migrate from {connection.email}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <p>{error}</p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <p className="text-gray-600">What would you like to import?</p>

              {/* Email Option */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={migrateEmail}
                    onChange={(e) => setMigrateEmail(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Mail className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Emails</span>
                </div>
                <span className="text-gray-500">{preview.email_count.toLocaleString()} messages</span>
              </label>

              {/* Contacts Option */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={migrateContacts}
                    onChange={(e) => setMigrateContacts(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Users className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Contacts</span>
                </div>
                <span className="text-gray-500">{preview.contact_count.toLocaleString()} contacts</span>
              </label>

              {/* Drive Option */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={migrateDrive}
                    onChange={(e) => setMigrateDrive(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <HardDrive className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Drive Files</span>
                </div>
                <span className="text-gray-500">{migrationApi.formatBytes(preview.drive_size_bytes)}</span>
              </label>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <p>Failed to load preview. Please try again.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={loading || error !== null || (!migrateEmail && !migrateContacts && !migrateDrive)}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Play className="h-4 w-4" />
            Start Migration
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== PROGRESS MODAL COMPONENT ====================

interface ProgressModalProps {
  jobId: string;
  onClose: () => void;
}

function ProgressModal({ jobId, onClose }: ProgressModalProps) {
  const [job, setJob] = useState<MigrationJob | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const status = await migrationApi.getJobStatus(jobId);
        setJob(status);

        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Failed to get job status:', error);
      }
    };

    pollStatus();
    interval = setInterval(pollStatus, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'running': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      case 'skipped': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Check className="h-5 w-5" />;
      case 'running': return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'failed': return <X className="h-5 w-5" />;
      default: return <div className="h-5 w-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Migration Progress</h2>
        </div>

        <div className="p-6">
          {job ? (
            <div className="space-y-6">
              {/* Overall Progress */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-gray-900">{job.current_task}</span>
                  <span className="text-gray-500">{job.progress_percent}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      job.status === 'failed' ? 'bg-red-600' :
                      job.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${job.progress_percent}%` }}
                  />
                </div>
              </div>

              {/* Sub-tasks */}
              <div className="space-y-4">
                {/* Email */}
                <div className="flex items-center gap-4">
                  <div className={`${getStatusColor(job.email_status)}`}>
                    {getStatusIcon(job.email_status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700">Emails</span>
                      <span className="text-gray-500 text-sm">
                        {job.email_processed.toLocaleString()} / {job.email_total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${job.email_progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Contacts */}
                <div className="flex items-center gap-4">
                  <div className={`${getStatusColor(job.contacts_status)}`}>
                    {getStatusIcon(job.contacts_status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700">Contacts</span>
                      <span className="text-gray-500 text-sm">
                        {job.contacts_processed.toLocaleString()} / {job.contacts_total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${job.contacts_progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Drive */}
                <div className="flex items-center gap-4">
                  <div className={`${getStatusColor(job.drive_status)}`}>
                    {getStatusIcon(job.drive_status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700">Drive Files</span>
                      <span className="text-gray-500 text-sm">
                        {job.drive_processed.toLocaleString()} / {job.drive_total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full transition-all"
                        style={{ width: `${job.drive_progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {job.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 font-medium mb-2">Errors ({job.errors.length})</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {job.errors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end">
          {job?.status === 'completed' || job?.status === 'failed' || job?.status === 'cancelled' ? (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Run in Background
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE COMPONENT ====================

export default function MigrationPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<MigrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<MigrationConnection | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to extract error message from API responses
  const getErrorMessage = useCallback((err: any, defaultMsg: string): string => {
    const detail = err.response?.data?.detail;
    if (!detail) return defaultMsg;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      // Pydantic validation errors
      return detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
    }
    if (typeof detail === 'object') {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
    return defaultMsg;
  }, []);

  // Load connections
  const loadConnections = useCallback(async () => {
    try {
      const data = await migrationApi.getConnections();
      setConnections(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load connections:', err);
      setError(getErrorMessage(err, 'Failed to load connections'));
    } finally {
      setLoading(false);
    }
  }, [getErrorMessage]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Handle OAuth callback
  useEffect(() => {
    if (router.query.connected) {
      loadConnections();
      // Clear query params
      router.replace('/admin/migration', undefined, { shallow: true });
    }
  }, [router.query.connected, loadConnections, router]);

  // Connect to Google
  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const authUrl = await migrationApi.connectGoogle();
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('Failed to connect Google:', err);
      setError(getErrorMessage(err, 'Failed to connect Google. Make sure GOOGLE_CLIENT_ID is configured.'));
      setConnectingGoogle(false);
    }
  };

  // Connect to Microsoft
  const handleConnectMicrosoft = async () => {
    setConnectingMicrosoft(true);
    try {
      const authUrl = await migrationApi.connectMicrosoft();
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('Failed to connect Microsoft:', err);
      setError(getErrorMessage(err, 'Failed to connect Microsoft. Make sure MICROSOFT_CLIENT_ID is configured.'));
      setConnectingMicrosoft(false);
    }
  };

  // Delete connection
  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;

    try {
      await migrationApi.deleteConnection(connectionId);
      setConnections(connections.filter(c => c.id !== connectionId));
    } catch (err: any) {
      console.error('Failed to delete connection:', err);
      setError(getErrorMessage(err, 'Failed to delete connection'));
    }
  };

  // Start migration
  const handleStartMigration = async (config: StartMigrationRequest) => {
    try {
      const { job_id } = await migrationApi.startMigration(config);
      setSelectedConnection(null);
      setActiveJobId(job_id);
    } catch (err: any) {
      console.error('Failed to start migration:', err);
      setError(getErrorMessage(err, 'Failed to start migration'));
    }
  };

  return (
    <AdminLayout title="Data Migration">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Migrate Your Data
          </h1>
          <p className="text-gray-600">
            Import your emails, contacts, and files from your existing workspace with just one click.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-100 rounded"
            >
              <X className="h-4 w-4 text-red-500" />
            </button>
          </div>
        )}

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ProviderCard
            provider="google"
            title="Google Workspace"
            description="Gmail, Contacts, Drive"
            icon={
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            }
            bgColor="bg-red-100"
            onConnect={handleConnectGoogle}
            loading={connectingGoogle}
          />

          <ProviderCard
            provider="microsoft"
            title="Microsoft 365"
            description="Outlook, Contacts, OneDrive"
            icon={
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
            }
            bgColor="bg-blue-100"
            onConnect={handleConnectMicrosoft}
            loading={connectingMicrosoft}
          />

          <ProviderCard
            provider="imap"
            title="Other Email"
            description="IMAP connection"
            icon={<Mail className="h-8 w-8 text-gray-600" />}
            bgColor="bg-gray-100"
            onConnect={() => alert('IMAP migration coming soon!')}
            disabled={true}
          />
        </div>

        {/* Connected Accounts */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Connected Accounts</h2>
            <button
              onClick={loadConnections}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Cloud className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">No connected accounts</p>
                <p className="text-sm">Connect a Google or Microsoft account to start migrating.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((connection) => (
                  <ConnectionItem
                    key={connection.id}
                    connection={connection}
                    onMigrate={() => setSelectedConnection(connection)}
                    onDelete={() => handleDeleteConnection(connection.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Migration Modal */}
        {selectedConnection && (
          <MigrationModal
            connection={selectedConnection}
            onClose={() => setSelectedConnection(null)}
            onStart={handleStartMigration}
          />
        )}

        {/* Progress Modal */}
        {activeJobId && (
          <ProgressModal
            jobId={activeJobId}
            onClose={() => setActiveJobId(null)}
          />
        )}
      </div>
    </AdminLayout>
  );
}
