/**
 * Bheem Drive - Main Page
 * Google Drive-like file management interface
 */
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FolderPlus,
  Grid,
  List,
  Search,
  ChevronRight,
  HardDrive,
  Clock,
  Star,
  Trash2,
  Settings,
  Plus,
  FileUp,
  FolderUp,
  SortAsc,
  SortDesc,
  MoreHorizontal,
} from 'lucide-react';

import AppSwitcher from '@/components/shared/AppSwitcher';
import FileGrid from '@/components/drive/FileGrid';
import {
  CreateFolderModal,
  RenameModal,
  ShareModal,
  DeleteConfirmModal,
  UploadModal,
} from '@/components/drive/DriveModals';
import { useDriveStore } from '@/stores/driveStore';
import { useRequireAuth } from '@/stores/authStore';
import { formatFileSize } from '@/lib/driveApi';
import type { DriveFile } from '@/lib/driveApi';

export default function DrivePage() {
  const router = useRouter();
  const { isAuthenticated: isLoggedIn, isLoading: authLoading } = useRequireAuth();

  const {
    files,
    currentFolderId,
    breadcrumb,
    selectedFiles,
    viewMode,
    sortBy,
    sortOrder,
    searchQuery,
    activeFilter,
    loading,
    error,
    uploadQueue,
    isUploading,
    storageUsed,
    storageTotal,
    fetchFiles,
    fetchRecentFiles,
    fetchStarredFiles,
    fetchTrashFiles,
    navigateToFolder,
    uploadFiles,
    deleteFiles,
    emptyTrash,
    setViewMode,
    setSortBy,
    setSortOrder,
    setSearchQuery,
    setActiveFilter,
    selectAll,
    clearSelection,
    clearError,
    openCreateFolderModal,
    fetchStorageUsage,
  } = useDriveStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Fetch files on mount
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      fetchFiles();
      fetchStorageUsage();
    }
  }, [authLoading, isLoggedIn]);

  // Drag and drop
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadFiles(acceptedFiles);
      }
    },
    [uploadFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const handleFileOpen = (file: DriveFile) => {
    // Open file in appropriate viewer/editor
    if (file.mime_type?.includes('document') || file.mime_type?.includes('word')) {
      router.push(`/docs/editor/${file.id}`);
    } else if (file.mime_type?.includes('spreadsheet') || file.mime_type?.includes('excel')) {
      router.push(`/sheets/${file.id}`);
    } else if (file.mime_type?.includes('presentation') || file.mime_type?.includes('powerpoint')) {
      router.push(`/slides/${file.id}`);
    } else if (file.mime_type?.startsWith('image/')) {
      window.open(`/api/v1/drive/files/${file.id}/preview`, '_blank');
    } else if (file.mime_type?.includes('pdf')) {
      window.open(`/api/v1/drive/files/${file.id}/preview`, '_blank');
    } else {
      // Download other files
      window.open(`/api/v1/drive/files/${file.id}/download`, '_blank');
    }
  };

  const handleSidebarNav = (filter: 'all' | 'recent' | 'starred' | 'trash') => {
    if (filter === 'all') {
      setActiveFilter('all');
      navigateToFolder(null);
    } else if (filter === 'recent') {
      fetchRecentFiles();
    } else if (filter === 'starred') {
      fetchStarredFiles();
    } else if (filter === 'trash') {
      fetchTrashFiles();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length > 0) {
      await deleteFiles(selectedFiles, activeFilter === 'trash');
    }
  };

  // Calculate storage percentage
  const storagePercentage = storageTotal > 0 ? (storageUsed / storageTotal) * 100 : 0;

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Drive | Bheem</title>
      </Head>

      <div
        {...getRootProps()}
        className={`min-h-screen flex bg-gray-50 ${isDragActive ? 'bg-blue-50' : ''}`}
      >
        <input {...getInputProps()} />

        {/* Drag overlay */}
        {isDragActive && (
          <div className="fixed inset-0 z-50 bg-blue-500/10 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Upload size={64} className="mx-auto text-blue-500 mb-4" />
              <p className="text-xl font-medium text-blue-700">Drop files to upload</p>
            </div>
          </div>
        )}

        {/* App Switcher */}
        <AppSwitcher
          activeApp="drive"
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Drive Sidebar */}
        <aside
          className="fixed top-0 bg-white border-r border-gray-200 h-screen overflow-y-auto transition-all duration-300 z-10"
          style={{
            left: sidebarCollapsed ? 64 : 240,
            width: 240,
          }}
        >
          <div className="p-4">
            {/* New Button */}
            <div className="relative mb-6">
              <button
                onClick={() => setShowNewMenu(!showNewMenu)}
                className="w-full flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-gray-700 font-medium"
              >
                <Plus size={24} className="text-gray-600" />
                <span>New</span>
              </button>

              {showNewMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowNewMenu(false)} />
                  <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                    <button
                      onClick={() => {
                        openCreateFolderModal();
                        setShowNewMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <FolderPlus size={20} className="text-gray-500" />
                      <span>New folder</span>
                    </button>
                    <hr className="my-2" />
                    <button
                      onClick={() => {
                        setShowUploadModal(true);
                        setShowNewMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <FileUp size={20} className="text-gray-500" />
                      <span>File upload</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowUploadModal(true);
                        setShowNewMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <FolderUp size={20} className="text-gray-500" />
                      <span>Folder upload</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              <button
                onClick={() => handleSidebarNav('all')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-left transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <HardDrive size={20} />
                <span className="font-medium">My Drive</span>
              </button>

              <button
                onClick={() => handleSidebarNav('recent')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-left transition-colors ${
                  activeFilter === 'recent'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Clock size={20} />
                <span>Recent</span>
              </button>

              <button
                onClick={() => handleSidebarNav('starred')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-left transition-colors ${
                  activeFilter === 'starred'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Star size={20} />
                <span>Starred</span>
              </button>

              <button
                onClick={() => handleSidebarNav('trash')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-left transition-colors ${
                  activeFilter === 'trash'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Trash2 size={20} />
                <span>Trash</span>
              </button>
            </nav>

            {/* Storage */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={18} className="text-gray-400" />
                <span className="text-sm text-gray-600">Storage</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    storagePercentage > 90 ? 'bg-red-500' : storagePercentage > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {formatFileSize(storageUsed)} of {formatFileSize(storageTotal)} used
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div
          className="flex-1 transition-all duration-300"
          style={{ marginLeft: sidebarCollapsed ? 64 + 240 : 240 + 240 }}
        >
          <div className="max-w-7xl mx-auto px-6 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-gray-600">
                {breadcrumb.map((item, index) => (
                  <div key={item.id || 'root'} className="flex items-center">
                    {index > 0 && <ChevronRight size={16} className="mx-1 text-gray-400" />}
                    <button
                      onClick={() => navigateToFolder(item.id, item.name)}
                      className={`px-2 py-1 rounded hover:bg-gray-100 ${
                        index === breadcrumb.length - 1
                          ? 'text-gray-900 font-medium'
                          : 'text-gray-600'
                      }`}
                    >
                      {item.name}
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search in Drive"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-100 rounded-full border-0 focus:ring-2 focus:ring-blue-500 text-sm w-72"
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
                      className={viewMode === 'grid' ? 'text-blue-500' : 'text-gray-500'}
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
                      className={viewMode === 'list' ? 'text-blue-500' : 'text-gray-500'}
                    />
                  </button>
                </div>

                {/* Sort */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    {sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
                  </button>

                  {showSortMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        {['name', 'created_at', 'updated_at', 'size'].map((field) => (
                          <button
                            key={field}
                            onClick={() => {
                              if (sortBy === field) {
                                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortBy(field as any);
                                setSortOrder('asc');
                              }
                              setShowSortMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${
                              sortBy === field ? 'text-blue-600' : 'text-gray-700'
                            }`}
                          >
                            <span className="capitalize">{field.replace('_', ' ')}</span>
                            {sortBy === field && (
                              sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
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

            {/* Bulk Actions Bar */}
            {selectedFiles.length > 0 && (
              <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-blue-700 font-medium">
                    {selectedFiles.length} selected
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    <Trash2 size={16} />
                    {activeFilter === 'trash' ? 'Delete permanently' : 'Move to trash'}
                  </button>
                </div>
                <button
                  onClick={clearSelection}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear selection
                </button>
              </div>
            )}

            {/* Trash actions */}
            {activeFilter === 'trash' && files.length > 0 && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={emptyTrash}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Empty trash
                </button>
              </div>
            )}

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
                            className={`h-1.5 rounded-full transition-all ${
                              item.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {item.status === 'error' ? 'Failed' : `${item.progress}%`}
                      </span>
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
        <CreateFolderModal />
        <RenameModal />
        <ShareModal />
        <DeleteConfirmModal />
        <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
      </div>
    </>
  );
}
