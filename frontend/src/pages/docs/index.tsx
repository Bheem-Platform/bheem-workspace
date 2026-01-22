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
  FilePlus,
  FileText,
  LayoutTemplate,
  Table,
  Presentation,
  Video,
  ClipboardList,
  Star,
  Clock,
  MoreVertical,
} from 'lucide-react';
import { useRouter } from 'next/router';
import * as docsEditorApi from '@/lib/docsEditorApi';
import * as productivityApi from '@/lib/productivityApi';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import AppLauncher from '@/components/shared/AppLauncher';
import FileGrid from '@/components/docs/FileGrid';
import Breadcrumb from '@/components/docs/Breadcrumb';
import { UploadModal } from '@/components/docs/UploadArea';
import CreateFolderModal from '@/components/docs/CreateFolderModal';
import ShareModal from '@/components/docs/ShareModal';
import DocsSidebar from '@/components/docs/DocsSidebar';
import { useDocsStore } from '@/stores/docsStore';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { useRequireAuth } from '@/stores/authStore';
import type { FileItem } from '@/types/docs';

export default function DocsPage() {
  const router = useRouter();
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
  const [showNewDocDropdown, setShowNewDocDropdown] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);

  // Unified view state
  const [showUnifiedHome, setShowUnifiedHome] = useState(true);
  const [quickFilter, setQuickFilter] = useState<'recent' | 'starred' | 'all'>('recent');
  const [quickAccessFilter, setQuickAccessFilter] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [unifiedDocs, setUnifiedDocs] = useState<productivityApi.UnifiedDocument[]>([]);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [stats, setStats] = useState<productivityApi.ProductivityStats | null>(null);

  // Create new document
  const handleCreateNewDocument = async () => {
    setIsCreatingDoc(true);
    try {
      const doc = await docsEditorApi.createDocument({
        title: 'Untitled Document',
        folder_id: currentPath !== '/' ? currentPath : undefined,
      });
      router.push(`/docs/editor/${doc.id}`);
    } catch (err) {
      console.error('Failed to create document:', err);
    } finally {
      setIsCreatingDoc(false);
      setShowNewDocDropdown(false);
    }
  };

  // V2 API uses JWT auth, doesn't need Nextcloud credentials
  const USE_V2_API = true;

  // Check if we should show unified home based on route
  useEffect(() => {
    const { type, folder } = router.query;
    // Show unified home when on /docs without type or folder query
    setShowUnifiedHome(!type && !folder && currentPath === '/');
  }, [router.query, currentPath]);

  // Fetch unified documents for home view
  const fetchUnifiedDocs = useCallback(async () => {
    if (!showUnifiedHome && !quickAccessFilter) return;

    setUnifiedLoading(true);
    try {
      const typeFilter = selectedTypes.length === 1
        ? selectedTypes[0] as productivityApi.DocumentTypeFilter
        : 'all';

      const params: productivityApi.UnifiedDocumentsParams = {
        type_filter: typeFilter,
        starred_only: quickAccessFilter === 'starred',
        shared_only: quickAccessFilter === 'shared',
        deleted_only: quickAccessFilter === 'trash',
        limit: 50,
        sort_by: quickAccessFilter === 'recent' || !quickAccessFilter ? 'updated_at' : 'title',
        sort_order: 'desc',
        search: searchQuery || undefined,
      };

      const response = await productivityApi.getUnifiedDocuments(params);
      setUnifiedDocs(response.items);

      // Also fetch stats
      const statsData = await productivityApi.getProductivityStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch unified documents:', error);
    } finally {
      setUnifiedLoading(false);
    }
  }, [showUnifiedHome, quickAccessFilter, selectedTypes, searchQuery]);

  useEffect(() => {
    if ((showUnifiedHome || quickAccessFilter) && isLoggedIn && !authLoading) {
      fetchUnifiedDocs();
    }
  }, [showUnifiedHome, quickAccessFilter, isLoggedIn, authLoading, fetchUnifiedDocs]);

  // Fetch files on mount only (not on every path change - navigation handles that)
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      if (USE_V2_API) {
        // V2 API uses JWT auth - always fetch files (for both Home and Documents views)
        fetchFiles();
      } else if (!isNextcloudAuthenticated) {
        // Legacy API needs Nextcloud credentials
        setShowCredentialsPrompt(true);
      } else {
        fetchFiles();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn, isNextcloudAuthenticated, showUnifiedHome]);

  // Handle type filter toggle
  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Handle opening unified document
  const handleUnifiedDocOpen = (doc: productivityApi.UnifiedDocument) => {
    router.push(productivityApi.getDocumentRoute(doc));
  };

  // Handle star toggle
  const handleStarToggle = async (doc: productivityApi.UnifiedDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await productivityApi.toggleStar(doc.type, doc.id);
      fetchUnifiedDocs();
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

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
    if (USE_V2_API) {
      // V2 API: Open all documents in the Bheem Docs editor/viewer
      // The editor will handle different file types appropriately
      router.push(`/docs/editor/${file.id}`);
      return;
    }

    // Legacy Nextcloud mode: Check file types
    const isBheemDoc = file.mimeType === 'application/vnd.bheem.document' ||
                       file.name.endsWith('.bheem') ||
                       file.path.includes('/bheem-docs/');

    if (isBheemDoc) {
      // Open in Bheem Docs editor
      router.push(`/docs/editor/${file.id}`);
    } else if (file.mimeType?.includes('pdf') || file.mimeType?.startsWith('image/')) {
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
    // V2 API expects file IDs, not paths
    const fileIdsToDelete = files
      .filter((f) => selectedFiles.includes(f.id))
      .map((f) => f.id);

    if (fileIdsToDelete.length > 0) {
      await deleteFiles(fileIdsToDelete);
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

  // Docs sidebar component
  const docsSidebar = (
    <DocsSidebar
      activeType={showUnifiedHome ? 'home' : 'docs'}
      activeQuickAccess={quickAccessFilter || undefined}
      onQuickAccessChange={(id) => {
        setQuickAccessFilter(id);
        if (id === 'recent') setQuickFilter('recent');
        else if (id === 'starred') setQuickFilter('starred');
        else setQuickFilter('all');
      }}
      onCreateNew={openCreateFolderModal}
      onUpload={() => setShowUploadModal(true)}
    />
  );

  return (
    <>
      <Head>
        <title>Docs | Bheem</title>
      </Head>

      <WorkspaceLayout
        title="Docs"
        secondarySidebar={docsSidebar}
        secondarySidebarWidth={240}
        hideHeader
      >
        <div
          {...getRootProps()}
          className={`min-h-full flex flex-col bg-gray-100 ${isDragActive ? 'bg-purple-50' : ''}`}
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

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
          <div className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {quickAccessFilter === 'recent' ? 'Recent' :
                   quickAccessFilter === 'starred' ? 'Starred' :
                   quickAccessFilter === 'shared' ? 'Shared with me' :
                   quickAccessFilter === 'trash' ? 'Trash' :
                   showUnifiedHome ? 'Home' : 'Documents'}
                </h1>
                <p className="text-gray-500">
                  {quickAccessFilter === 'recent' ? 'Recently opened documents' :
                   quickAccessFilter === 'starred' ? 'Your starred documents' :
                   quickAccessFilter === 'shared' ? 'Documents shared with you' :
                   quickAccessFilter === 'trash' ? 'Deleted documents' :
                   showUnifiedHome ? 'All your documents in one place' : 'Manage and collaborate on documents'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* App Launcher */}
                <AppLauncher />
                {/* New Document Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowNewDocDropdown(!showNewDocDropdown)}
                    disabled={isCreatingDoc}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50"
                  >
                    <FilePlus size={20} />
                    <span>{isCreatingDoc ? 'Creating...' : 'New Document'}</span>
                  </button>
                  {showNewDocDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowNewDocDropdown(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                        <button
                          onClick={handleCreateNewDocument}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                        >
                          <FileText size={18} className="text-blue-500" />
                          <div>
                            <p className="font-medium text-gray-900">Blank Document</p>
                            <p className="text-xs text-gray-500">Start from scratch</p>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setShowNewDocDropdown(false);
                            router.push('/docs/templates');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                        >
                          <LayoutTemplate size={18} className="text-purple-500" />
                          <div>
                            <p className="font-medium text-gray-900">From Template</p>
                            <p className="text-xs text-gray-500">Use a pre-built template</p>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
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

            {/* Home View shows both folders/files and unified documents */}
            {(showUnifiedHome || quickAccessFilter) ? (
              <div className="space-y-6">
                {/* Show folders and files from the file system */}
                {loading.files ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                  </div>
                ) : (
                  <>
                    {/* Files Grid - shows folders and documents */}
                    {filteredFiles.length > 0 && (
                      <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Files</h2>
                        <FileGrid onFileOpen={handleFileOpen} />
                      </div>
                    )}

                    {/* Unified Documents from productivity API */}
                    {unifiedLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                      </div>
                    ) : unifiedDocs.length > 0 ? (
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Documents</h2>
                        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                          {unifiedDocs.map((doc) => (
                            <UnifiedDocCard
                              key={`${doc.type}-${doc.id}`}
                              doc={doc}
                              viewMode={viewMode}
                              onOpen={() => handleUnifiedDocOpen(doc)}
                              onStar={(e) => handleStarToggle(doc, e)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Empty state when nothing is found */}
                    {filteredFiles.length === 0 && unifiedDocs.length === 0 && !unifiedLoading && (
                      <div className="text-center py-20">
                        <FileText size={64} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
                        <p className="text-gray-500">
                          {quickAccessFilter === 'starred'
                            ? 'Star some documents to see them here'
                            : quickAccessFilter === 'shared'
                            ? 'No documents have been shared with you yet'
                            : quickAccessFilter === 'trash'
                            ? 'Your trash is empty'
                            : 'Create a new document or folder to get started'
                          }
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <FileGrid onFileOpen={handleFileOpen} />
            )}
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
                // V2 API expects file ID, not path
                deleteFiles([selectedForAction.id]);
              }
            }}
            onCancel={closeDeleteConfirm}
          />
        )}
        </div>
      </WorkspaceLayout>
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

// Unified Document Card Component
interface UnifiedDocCardProps {
  doc: productivityApi.UnifiedDocument;
  viewMode: 'grid' | 'list';
  onOpen: () => void;
  onStar: (e: React.MouseEvent) => void;
}

function UnifiedDocCard({ doc, viewMode, onOpen, onStar }: UnifiedDocCardProps) {
  const config = productivityApi.typeConfig[doc.type];

  const iconMap: Record<string, React.ReactNode> = {
    FileText: <FileText size={viewMode === 'grid' ? 40 : 24} />,
    Table: <Table size={viewMode === 'grid' ? 40 : 24} />,
    Presentation: <Presentation size={viewMode === 'grid' ? 40 : 24} />,
    Video: <Video size={viewMode === 'grid' ? 40 : 24} />,
    ClipboardList: <ClipboardList size={viewMode === 'grid' ? 40 : 24} />,
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={onOpen}
        className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-gray-300 cursor-pointer transition-all group"
      >
        <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
          {iconMap[config.icon]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{doc.title}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className={config.color}>{config.label}</span>
            <span>•</span>
            <span>{productivityApi.formatRelativeTime(doc.updated_at)}</span>
          </div>
        </div>
        <button
          onClick={onStar}
          className={`p-2 rounded-lg transition-colors ${
            doc.is_starred
              ? 'text-yellow-500 hover:bg-yellow-50'
              : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50 opacity-0 group-hover:opacity-100'
          }`}
        >
          <Star size={18} fill={doc.is_starred ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 cursor-pointer transition-all overflow-hidden group"
    >
      {/* Thumbnail/Icon Area */}
      <div className={`h-32 flex items-center justify-center ${config.bgColor}`}>
        {doc.thumbnail_url ? (
          <img src={doc.thumbnail_url} alt={doc.title} className="w-full h-full object-cover" />
        ) : (
          <div className={config.color}>{iconMap[config.icon]}</div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate" title={doc.title}>
              {doc.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span className={config.color}>{config.label}</span>
              <span>•</span>
              <span>{productivityApi.formatRelativeTime(doc.updated_at)}</span>
            </div>
          </div>
          <button
            onClick={onStar}
            className={`p-1.5 rounded-lg transition-colors ${
              doc.is_starred
                ? 'text-yellow-500 hover:bg-yellow-50'
                : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50 opacity-0 group-hover:opacity-100'
            }`}
          >
            <Star size={16} fill={doc.is_starred ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Extra info for specific types */}
        {doc.extra && (
          <div className="mt-2 text-xs text-gray-500">
            {doc.type === 'forms' && doc.extra.response_count !== undefined && (
              <span>{doc.extra.response_count} responses</span>
            )}
            {doc.type === 'videos' && doc.extra.duration && (
              <span>{Math.floor(doc.extra.duration / 60)}:{(doc.extra.duration % 60).toString().padStart(2, '0')}</span>
            )}
          </div>
        )}
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
