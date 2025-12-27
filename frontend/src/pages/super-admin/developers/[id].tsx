import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Code2,
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import StatusBadge from '@/components/admin/StatusBadge';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import { useAdminStore } from '@/stores/adminStore';
import * as adminApi from '@/lib/adminApi';
import type { Developer, DeveloperProject } from '@/types/admin';

export default function DeveloperDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { developers, fetchDevelopers, loading } = useAdminStore();

  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (developers.length === 0) {
      fetchDevelopers();
    }
  }, [developers.length, fetchDevelopers]);

  useEffect(() => {
    if (id && typeof id === 'string' && developers.length > 0) {
      const found = developers.find((d) => d.id === id);
      if (found) setDeveloper(found);
    }
  }, [id, developers]);

  const handleCopyKey = () => {
    if (developer) {
      navigator.clipboard.writeText(developer.api_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCreateProject = async () => {
    if (!id || typeof id !== 'string' || !projectName.trim()) return;
    setCreating(true);
    try {
      await adminApi.grantProjectAccess(id, { project_name: projectName.trim(), access_level: 'developer' });
      await fetchDevelopers();
      setShowProjectModal(false);
      setProjectName('');
    } catch (err) {
      console.error('Failed to create project:', err);
    }
    setCreating(false);
  };

  const handleRegenerateKey = async () => {
    // API would regenerate key here
    setShowRegenerateDialog(false);
    // In a real implementation, call the API and refresh
  };

  const handleDelete = async () => {
    // API would delete developer here
    setShowDeleteDialog(false);
    router.push('/super-admin/developers');
  };

  if (loading.developers || !developer) {
    return (
      <AdminLayout>
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
        { label: 'Super Admin', href: '/super-admin' },
        { label: 'Developers', href: '/super-admin/developers' },
        { label: developer.name },
      ]}
    >
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/super-admin/developers')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Developers
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                <Code2 className="text-green-600" size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{developer.name}</h1>
                <p className="text-gray-500">{developer.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <StatusBadge status={developer.is_active ? 'active' : 'inactive'} />
                  {developer.company && (
                    <span className="text-sm text-gray-500">• {developer.company}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
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

        {/* API Key Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">API Credentials</h2>
            <button
              onClick={() => setShowRegenerateDialog(true)}
              className="inline-flex items-center text-sm text-orange-600 hover:text-orange-700"
            >
              <RefreshCw size={16} className="mr-1" />
              Regenerate Key
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">API Key</p>
                <code className="text-sm font-mono bg-gray-200 px-3 py-1 rounded">
                  {developer.api_key}
                </code>
              </div>
              <button
                onClick={handleCopyKey}
                className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {copiedKey ? (
                  <>
                    <Check size={16} className="mr-2 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} className="mr-2" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Keep this key secret. If compromised, regenerate immediately.
          </p>
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            <button
              onClick={() => setShowProjectModal(true)}
              className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              <Plus size={16} className="mr-1" />
              Add Project
            </button>
          </div>

          {developer.projects && developer.projects.length > 0 ? (
            <div className="space-y-3">
              {developer.projects.map((project: DeveloperProject) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <p className="text-sm text-gray-500">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {project.webhook_url && (
                    <a
                      href={project.webhook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700"
                    >
                      <ExternalLink size={18} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Code2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No projects yet</p>
              <p className="text-sm text-gray-400">Create a project to start integrating</p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Developer Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{developer.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Company</p>
              <p className="font-medium">{developer.company || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Website</p>
              {developer.website ? (
                <a
                  href={developer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-purple-600 hover:text-purple-700"
                >
                  {developer.website}
                </a>
              ) : (
                <p className="font-medium">-</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="font-medium">
                {new Date(developer.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Add Project Modal */}
        <Modal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          title="Add New Project"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="My Integration"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creating || !projectName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Regenerate Key Dialog */}
        <ConfirmDialog
          isOpen={showRegenerateDialog}
          onConfirm={handleRegenerateKey}
          onCancel={() => setShowRegenerateDialog(false)}
          title="Regenerate API Key"
          message="Are you sure you want to regenerate the API key? The current key will be invalidated immediately and all integrations will stop working until updated."
          confirmText="Regenerate"
          danger
        />

        {/* Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
          title="Delete Developer"
          message={`Are you sure you want to delete "${developer.name}"? This will revoke API access and delete all projects.`}
          confirmText="Delete"
          danger
        />
      </div>
    </AdminLayout>
  );
}
