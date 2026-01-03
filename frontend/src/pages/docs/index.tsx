import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FolderPlus,
  Grid,
  List,
  Search,
  ArrowUp,
  SortAsc,
  Trash2,
  Download,
} from 'lucide-react';
import AppSwitcher from '@/components/shared/AppSwitcher';
import FileGrid from '@/components/docs/FileGrid';
import Breadcrumb from '@/components/docs/Breadcrumb';
import { UploadModal } from '@/components/docs/UploadArea';
import CreateFolderModal from '@/components/docs/CreateFolderModal';
import ShareModal from '@/components/docs/ShareModal';
import { useDocsStore } from '@/stores/docsStore';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { useRequireAuth } from '@/stores/authStore';
import type { FileItem } from '@/types/docs';

export default function DocsPage() {
  const { isAuthenticated: isLoggedIn, isLoading: authLoading } = useRequireAuth();
  const { isNextcloudAuthenticated } = useCredentialsStore();

  const {
    files,
    currentPath,
    selectedFiles,
    viewMode,
    loading,
    error,
    isCreateFolderModalOpen,
    isShareModalOpen,
    isDeleteConfirmOpen,
    selectedForAction,
    uploadQueue,
    isUploading,
    fetchFiles,
    uploadFiles,
    deleteFiles,
    downloadFile,
    setViewMode,
    navigateUp,
    selectAll,
    clearSelection,
    clearError,
    openCreateFolderModal,
    closeCreateFolderModal,
    closeShareModal,
    closeDeleteConfirm,
  } = useDocsStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCredentialsPrompt, setShowCredentialsPrompt] = useState(false);

  // Fetch files on mount
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      if (!isNextcloudAuthenticated) {
        setShowCredentialsPrompt(true);
      } else {
        fetchFiles();
      }
    }
  }, [authLoading, isLoggedIn, isNextcloudAuthenticated, currentPath]);

  // Drag and drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadFiles(acceptedFiles);
    }
  }, [uploadFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  // Filter files by search
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileOpen = (file: FileItem) => {
    // Open file preview or editor
    if (file.mimeType?.includes('pdf') || file.mimeType?.startsWith('image/')) {
      // Open preview
      window.open(`/docs/preview?path=${encodeURIComponent(file.path)}`, '_blank');
    } else if (
      file.mimeType?.includes('word') ||
      file.mimeType?.includes('spreadsheet') ||
      file.mimeType?.includes('presentation')
    ) {
      // Open in OnlyOffice
      window.open(`/docs/edit?path=${encodeURIComponent(file.path)}`, '_blank');
    } else {
      // Download
      downloadFile(file);
    }
  };

  const handleBulkDelete = async () => {
    const filesToDelete = files
      .filter((f) => selectedFiles.includes(f.id))
      .map((f) => f.path);

    if (filesToDelete.length > 0) {
      await deleteFiles(filesToDelete);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  // Show credentials prompt
  if (showCredentialsPrompt) {
    return (
      <NextcloudLoginPrompt
        onSuccess={() => {
          setShowCredentialsPrompt(false);
          fetchFiles();
        }}
      />
    );
  }

  return (
    <>
      <Head>
        <title>Docs | Bheem</title>
      </Head>

      <div
        {...getRootProps()}
        className={`min-h-screen flex bg-gray-100 ${isDragActive ? 'bg-purple-50' : ''}`}
      >
        <input {...getInputProps()} />

        {/* Drag overlay */}
        {isDragActive && (
          <div className="fixed inset-0 z-50 bg-purple-500/10 border-4 border-dashed border-purple-500 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Upload size={64} className="mx-auto text-purple-500 mb-4" />
              <p className="text-xl font-medium text-purple-700">Drop files to upload</p>
            </div>
          </div>
        )}

        {/* App Switcher */}
        <AppSwitcher
          activeApp="docs"
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content */}
        <div
          className="flex-1 transition-all duration-300"
          style={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
        >
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Bheem Docs</h1>
                <p className="text-gray-500">Manage and collaborate on documents</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Upload size={20} />
                  <span>Upload</span>
                </button>
                <button
                  onClick={openCreateFolderModal}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <FolderPlus size={20} />
                  <span>New Folder</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <span className="text-sm text-red-700">{error}</span>
                <button
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Toolbar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                {/* Breadcrumb & Navigation */}
                <div className="flex items-center gap-4">
                  {currentPath !== '/' && (
                    <button
                      onClick={navigateUp}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Go up"
                    >
                      <ArrowUp size={20} className="text-gray-600" />
                    </button>
                  )}
                  <Breadcrumb />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  {/* Bulk actions */}
                  {selectedFiles.length > 0 && (
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
                      <span className="text-sm text-gray-600">
                        {selectedFiles.length} selected
                      </span>
                      <button
                        onClick={handleBulkDelete}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete selected"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={clearSelection}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-0 focus:ring-2 focus:ring-purple-500 text-sm w-64"
                    />
                  </div>

                  {/* View Toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'grid' ? 'bg-white shadow-sm' : ''
                      }`}
                    >
                      <Grid
                        size={18}
                        className={viewMode === 'grid' ? 'text-purple-500' : 'text-gray-500'}
                      />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'list' ? 'bg-white shadow-sm' : ''
                      }`}
                    >
                      <List
                        size={18}
                        className={viewMode === 'list' ? 'text-purple-500' : 'text-gray-500'}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && uploadQueue.length > 0 && (
              <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Uploading {uploadQueue.length} file(s)...
                </h3>
                <div className="space-y-2">
                  {uploadQueue.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 truncate">{item.filename}</p>
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-purple-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{item.progress}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files Grid/List */}
            <FileGrid onFileOpen={handleFileOpen} />
          </div>
        </div>

        {/* Modals */}
        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
        />
        <CreateFolderModal
          isOpen={isCreateFolderModalOpen}
          onClose={closeCreateFolderModal}
        />
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={closeShareModal}
        />

        {/* Delete Confirmation */}
        {isDeleteConfirmOpen && (
          <DeleteConfirmModal
            file={selectedForAction}
            onConfirm={() => {
              if (selectedForAction) {
                deleteFiles([selectedForAction.path]);
              }
            }}
            onCancel={closeDeleteConfirm}
          />
        )}
      </div>
    </>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  file,
  onConfirm,
  onCancel,
}: {
  file: FileItem | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete {file?.type || 'item'}?</h2>
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete "{file?.name}"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Nextcloud Login Prompt
import { Lock, Cloud } from 'lucide-react';

function NextcloudLoginPrompt({ onSuccess }: { onSuccess: () => void }) {
  const { setNextcloudCredentials } = useCredentialsStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      setNextcloudCredentials({ username, password });
      onSuccess();
    } catch (err: any) {
      setError('Failed to save credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
            <Cloud size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Bheem Docs</h1>
          <p className="text-white/80 mt-2">Connect your Nextcloud account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your Nextcloud username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your Nextcloud password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Connecting...' : 'Connect Docs'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Your credentials are stored securely in your browser.
          </p>
        </div>

        <div className="text-center mt-6">
          <a href="/dashboard" className="text-white/80 hover:text-white text-sm underline">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
