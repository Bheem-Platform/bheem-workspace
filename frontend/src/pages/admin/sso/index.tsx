/**
 * SSO Configuration Page
 * SAML and OIDC identity provider management
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Key,
  Plus,
  Shield,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import StatusBadge from '@/components/admin/StatusBadge';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface SSOProvider {
  id: string;
  provider_name: string;
  provider_type: 'saml' | 'oidc';
  is_enabled: boolean;
  is_primary: boolean;
  saml?: {
    entity_id: string;
    sso_url: string;
  };
  oidc?: {
    client_id: string;
    issuer_url: string;
  };
  auto_provision_users: boolean;
  auto_update_profile: boolean;
  default_role: string;
  created_at: string;
}

interface SPMetadata {
  entity_id: string;
  acs_url: string;
  slo_url: string;
  name_id_format: string;
  metadata_url: string;
}

export default function SSOConfigPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [spMetadata, setSPMetadata] = useState<SPMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<SSOProvider | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);

  const [formData, setFormData] = useState({
    provider_name: '',
    provider_type: 'saml' as 'saml' | 'oidc',
    is_enabled: false,
    is_primary: false,
    // SAML
    saml_entity_id: '',
    saml_sso_url: '',
    saml_slo_url: '',
    saml_certificate: '',
    // OIDC
    oidc_client_id: '',
    oidc_client_secret: '',
    oidc_issuer_url: '',
    // Settings
    auto_provision_users: true,
    auto_update_profile: true,
    default_role: 'member',
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchProviders();
      fetchSPMetadata();
    }
  }, [isAuthenticated, authLoading]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/sso');
      setProviders(response.data.providers);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load SSO providers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSPMetadata = async () => {
    try {
      const response = await api.get('/admin/sso/metadata');
      setSPMetadata(response.data);
    } catch (err: any) {
      console.error('Failed to load SP metadata:', err);
    }
  };

  const handleCreate = async () => {
    try {
      const payload: any = {
        provider_name: formData.provider_name,
        provider_type: formData.provider_type,
        is_enabled: formData.is_enabled,
        is_primary: formData.is_primary,
        auto_provision_users: formData.auto_provision_users,
        auto_update_profile: formData.auto_update_profile,
        default_role: formData.default_role,
      };

      if (formData.provider_type === 'saml') {
        payload.saml_config = {
          entity_id: formData.saml_entity_id,
          sso_url: formData.saml_sso_url,
          slo_url: formData.saml_slo_url || null,
          certificate: formData.saml_certificate,
        };
      } else {
        payload.oidc_config = {
          client_id: formData.oidc_client_id,
          client_secret: formData.oidc_client_secret,
          issuer_url: formData.oidc_issuer_url,
        };
      }

      await api.post('/admin/sso', payload);
      setShowCreateModal(false);
      resetForm();
      fetchProviders();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create SSO provider');
    }
  };

  const handleUpdate = async () => {
    if (!selectedProvider) return;
    try {
      const payload: any = {
        provider_name: formData.provider_name,
        is_enabled: formData.is_enabled,
        is_primary: formData.is_primary,
        auto_provision_users: formData.auto_provision_users,
        auto_update_profile: formData.auto_update_profile,
        default_role: formData.default_role,
      };

      if (formData.provider_type === 'saml') {
        payload.saml_config = {
          entity_id: formData.saml_entity_id,
          sso_url: formData.saml_sso_url,
          slo_url: formData.saml_slo_url || null,
          certificate: formData.saml_certificate,
        };
      } else {
        payload.oidc_config = {
          client_id: formData.oidc_client_id,
          client_secret: formData.oidc_client_secret || undefined,
          issuer_url: formData.oidc_issuer_url,
        };
      }

      await api.put(`/admin/sso/${selectedProvider.id}`, payload);
      setShowCreateModal(false);
      setEditMode(false);
      resetForm();
      fetchProviders();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update SSO provider');
    }
  };

  const handleDelete = async () => {
    if (!selectedProvider) return;
    try {
      await api.delete(`/admin/sso/${selectedProvider.id}`);
      setShowDeleteDialog(false);
      setSelectedProvider(null);
      fetchProviders();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete SSO provider');
    }
  };

  const handleToggleEnabled = async (provider: SSOProvider) => {
    try {
      await api.put(`/admin/sso/${provider.id}`, { is_enabled: !provider.is_enabled });
      fetchProviders();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle provider');
    }
  };

  const handleTestConnection = async (providerId: string) => {
    try {
      setTestResult(null);
      const response = await api.post(`/admin/sso/${providerId}/test`);
      setTestResult(response.data);
    } catch (err: any) {
      setTestResult({ status: 'failed', message: err.response?.data?.detail || 'Test failed' });
    }
  };

  const resetForm = () => {
    setFormData({
      provider_name: '',
      provider_type: 'saml',
      is_enabled: false,
      is_primary: false,
      saml_entity_id: '',
      saml_sso_url: '',
      saml_slo_url: '',
      saml_certificate: '',
      oidc_client_id: '',
      oidc_client_secret: '',
      oidc_issuer_url: '',
      auto_provision_users: true,
      auto_update_profile: true,
      default_role: 'member',
    });
    setSelectedProvider(null);
    setTestResult(null);
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openEditModal = async (provider: SSOProvider) => {
    setSelectedProvider(provider);
    // Fetch full details
    try {
      const response = await api.get(`/admin/sso/${provider.id}`);
      const data = response.data;
      setFormData({
        provider_name: data.provider_name,
        provider_type: data.provider_type,
        is_enabled: data.is_enabled,
        is_primary: data.is_primary,
        saml_entity_id: data.saml?.entity_id || '',
        saml_sso_url: data.saml?.sso_url || '',
        saml_slo_url: data.saml?.slo_url || '',
        saml_certificate: data.saml?.certificate || '',
        oidc_client_id: data.oidc?.client_id || '',
        oidc_client_secret: '',
        oidc_issuer_url: data.oidc?.issuer_url || '',
        auto_provision_users: data.auto_provision_users,
        auto_update_profile: data.auto_update_profile,
        default_role: data.default_role,
      });
      setEditMode(true);
      setShowCreateModal(true);
    } catch (err) {
      console.error('Failed to load provider details:', err);
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
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'SSO Configuration' }]}
      isSuperAdmin={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Single Sign-On</h1>
            <p className="text-gray-500">Configure SAML or OIDC identity providers</p>
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
            Add Provider
          </button>
        </div>

        {/* SP Metadata */}
        {spMetadata && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Key size={18} />
              Service Provider (SP) Information
            </h3>
            <p className="text-sm text-blue-700 mb-4">
              Use these values when configuring your Identity Provider
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries({
                'Entity ID': spMetadata.entity_id,
                'ACS URL': spMetadata.acs_url,
                'SLO URL': spMetadata.slo_url,
                'Metadata URL': spMetadata.metadata_url,
              }).map(([label, value]) => (
                <div key={label} className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <div className="flex items-center justify-between">
                    <code className="text-sm text-gray-900 truncate flex-1">{value}</code>
                    <button
                      onClick={() => copyToClipboard(value, label)}
                      className="ml-2 p-1 text-gray-400 hover:text-blue-600"
                    >
                      {copiedField === label ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Providers List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Identity Providers</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : providers.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="mx-auto text-gray-400" size={48} />
              <p className="mt-4 text-gray-500">No SSO providers configured</p>
              <p className="text-sm text-gray-400">
                Add a SAML or OIDC provider to enable single sign-on
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {providers.map((provider) => (
                <div key={provider.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`p-2 rounded-lg ${
                          provider.provider_type === 'saml' ? 'bg-purple-100' : 'bg-green-100'
                        }`}
                      >
                        <Key
                          className={
                            provider.provider_type === 'saml'
                              ? 'text-purple-600'
                              : 'text-green-600'
                          }
                          size={20}
                        />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{provider.provider_name}</h4>
                          <StatusBadge
                            status={provider.is_enabled ? 'active' : 'inactive'}
                          />
                          {provider.is_primary && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {provider.provider_type.toUpperCase()} -{' '}
                          {provider.provider_type === 'saml'
                            ? provider.saml?.entity_id
                            : provider.oidc?.issuer_url}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTestConnection(provider.id)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Test connection"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(provider)}
                        className={`p-2 rounded-lg ${
                          provider.is_enabled
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        title={provider.is_enabled ? 'Disable' : 'Enable'}
                      >
                        {provider.is_enabled ? <Power size={16} /> : <PowerOff size={16} />}
                      </button>
                      <button
                        onClick={() => openEditModal(provider)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProvider(provider);
                          setShowDeleteDialog(true);
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        disabled={provider.is_primary}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                    <span>Auto-provision: {provider.auto_provision_users ? 'Yes' : 'No'}</span>
                    <span>Default role: {provider.default_role}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`p-4 rounded-lg flex items-center gap-3 ${
              testResult.status === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {testResult.status === 'success' ? (
              <Check className="text-green-500" size={20} />
            ) : (
              <AlertCircle className="text-red-500" size={20} />
            )}
            <span className={testResult.status === 'success' ? 'text-green-700' : 'text-red-700'}>
              {testResult.message}
            </span>
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditMode(false);
            resetForm();
          }}
          title={editMode ? 'Edit SSO Provider' : 'Add SSO Provider'}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name *</label>
              <input
                type="text"
                value={formData.provider_name}
                onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Okta, Azure AD, Google"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
              <select
                value={formData.provider_type}
                onChange={(e) =>
                  setFormData({ ...formData, provider_type: e.target.value as 'saml' | 'oidc' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={editMode}
              >
                <option value="saml">SAML 2.0</option>
                <option value="oidc">OpenID Connect (OIDC)</option>
              </select>
            </div>

            {/* SAML Config */}
            {formData.provider_type === 'saml' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IdP Entity ID *
                  </label>
                  <input
                    type="text"
                    value={formData.saml_entity_id}
                    onChange={(e) => setFormData({ ...formData, saml_entity_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://idp.example.com/entity"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SSO URL *</label>
                  <input
                    type="url"
                    value={formData.saml_sso_url}
                    onChange={(e) => setFormData({ ...formData, saml_sso_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://idp.example.com/sso"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SLO URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.saml_slo_url}
                    onChange={(e) => setFormData({ ...formData, saml_slo_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://idp.example.com/slo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    X.509 Certificate *
                  </label>
                  <textarea
                    value={formData.saml_certificate}
                    onChange={(e) => setFormData({ ...formData, saml_certificate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
                    rows={4}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  />
                </div>
              </>
            )}

            {/* OIDC Config */}
            {formData.provider_type === 'oidc' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client ID *</label>
                  <input
                    type="text"
                    value={formData.oidc_client_id}
                    onChange={(e) => setFormData({ ...formData, oidc_client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret {editMode ? '(leave empty to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.oidc_client_secret}
                    onChange={(e) =>
                      setFormData({ ...formData, oidc_client_secret: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issuer URL *
                  </label>
                  <input
                    type="url"
                    value={formData.oidc_issuer_url}
                    onChange={(e) => setFormData({ ...formData, oidc_issuer_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://accounts.google.com"
                  />
                </div>
              </>
            )}

            {/* Settings */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-700 mb-3">User Provisioning</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.auto_provision_users}
                    onChange={(e) =>
                      setFormData({ ...formData, auto_provision_users: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Auto-provision new users</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.auto_update_profile}
                    onChange={(e) =>
                      setFormData({ ...formData, auto_update_profile: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Auto-update user profiles</span>
                </label>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Role</label>
                <select
                  value={formData.default_role}
                  onChange={(e) => setFormData({ ...formData, default_role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Enable this provider</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Set as primary login method</span>
              </label>
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
                disabled={!formData.provider_name.trim()}
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
            setSelectedProvider(null);
          }}
          title="Delete SSO Provider"
          message={`Are you sure you want to delete "${selectedProvider?.provider_name}"? Users will no longer be able to sign in using this provider.`}
          confirmText="Delete"
          danger
        />
      </div>
    </AdminLayout>
  );
}
