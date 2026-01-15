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
  Search,
  ChevronRight,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Trash2,
  Settings,
  Info,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';

import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import DriveSidebar from '@/components/drive/DriveSidebar';
import DriveFilterBar, { FilterState } from '@/components/drive/DriveFilterBar';
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
    fetchFiles,
    navigateToFolder,
    uploadFiles,
    deleteFiles,
    emptyTrash,
    setViewMode,
    setSortBy,
    setSortOrder,
    setSearchQuery,
    selectAll,
    clearSelection,
    clearError,
    openCreateFolderModal,
    fetchStorageUsage,
    setAdvancedFilters,
    advancedFilters,
  } = useDriveStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
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
      window.open(`/api/v1/drive/files/${file.id}/download`, '_blank');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length > 0) {
      await deleteFiles(selectedFiles, activeFilter === 'trash');
    }
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setAdvancedFilters(newFilters);
  };

  const getPageTitle = () => {
    switch (activeFilter) {
      case 'home':
        return 'Home';
      case 'activity':
        return 'Activity';
      case 'workspace':
        return 'Workspace';
      case 'recent':
        return 'Recent';
      case 'starred':
        return 'Starred';
      case 'shared-with-me':
        return 'Shared with me';
      case 'spam':
        return 'Spam';
      case 'trash':
        return 'Trash';
      default:
        return 'My Drive';
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading Drive...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{getPageTitle()} | Bheem Drive</title>
      </Head>

      <div
        {...getRootProps()}
        className={`h-screen bg-gray-50 ${isDragActive ? 'bg-blue-50' : ''}`}
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

        {/* App Switcher Bar (60px) */}
        <AppSwitcherBar activeApp="drive" />

        {/* Main Layout */}
        <div className="flex h-[calc(100vh-60px)] pt-[60px]">
          {/* Drive Sidebar */}
          <div className="fixed left-[60px] top-[60px] h-[calc(100vh-60px)] z-10">
            <DriveSidebar
              onNewFolder={openCreateFolderModal}
              onUpload={() => setShowUploadModal(true)}
            />
          </div>

          {/* Main Content */}
          <main className="flex-1 ml-[324px] overflow-y-auto">
            <div className="max-w-7xl mx-auto px-6 py-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                {/* Title / Breadcrumb */}
                <div className="flex items-center gap-2">
                  {activeFilter === 'all' && breadcrumb.length > 1 ? (
                    <div className="flex items-center gap-1 text-gray-600">
                      {breadcrumb.map((item, index) => (
                        <div key={item.id || 'root'} className="flex items-center">
                          {index > 0 && (
                            <ChevronRight size={16} className="mx-1 text-gray-400" />
                          )}
                          <button
                            onClick={() => navigateToFolder(item.id, item.name)}
                            className={`px-2 py-1 rounded hover:bg-gray-100 ${
                              index === breadcrumb.length - 1
                                ? 'text-gray-900 font-semibold text-xl'
                                : 'text-gray-600'
                            }`}
                          >
                            {item.name}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <h1 className="text-2xl font-semibold text-gray-900">{getPageTitle()}</h1>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search in Drive"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gray-100 rounded-full border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm w-80 transition-all"
                    />
                  </div>

                  {/* View Toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded transition-colors ${
                        viewMode === 'grid' ? 'bg-white shadow-sm' : ''
                      }`}
                      title="Grid view"
                    >
                      <LayoutGrid
                        size={18}
                        className={viewMode === 'grid' ? 'text-blue-600' : 'text-gray-500'}
                      />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded transition-colors ${
                        viewMode === 'list' ? 'bg-white shadow-sm' : ''
                      }`}
                      title="List view"
                    >
                      <LayoutList
                        size={18}
                        className={viewMode === 'list' ? 'text-blue-600' : 'text-gray-500'}
                      />
                    </button>
                  </div>

                  {/* Sort */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSortMenu(!showSortMenu)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Sort options"
                    >
                      {sortOrder === 'asc' ? (
                        <SortAsc size={18} className="text-gray-600" />
                      ) : (
                        <SortDesc size={18} className="text-gray-600" />
                      )}
                    </button>

                    {showSortMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowSortMenu(false)}
                        />
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
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${
                                sortBy === field ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                              }`}
                            >
                              <span className="capitalize">{field.replace('_', ' ')}</span>
                              {sortBy === field &&
                                (sortOrder === 'asc' ? (
                                  <SortAsc size={14} />
                                ) : (
                                  <SortDesc size={14} />
                                ))}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Info */}
                  <button className="p-2 hover:bg-gray-100 rounded-lg" title="Details">
                    <Info size={18} className="text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <DriveFilterBar onFilterChange={handleFilterChange} activeFilters={advancedFilters} />

              {/* Error Banner */}
              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
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
                <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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

              {/* Home View - Quick Access */}
              {activeFilter === 'home' && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Access</h2>
                  <div className="grid grid-cols-4 gap-4">
                    {/* Quick access items would go here */}
                    <div className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                      <p className="text-sm text-gray-500">No recent files</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity View */}
              {activeFilter === 'activity' && (
                <div className="mb-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <p className="text-gray-500 text-center">Activity feed coming soon</p>
                  </div>
                </div>
              )}

              {/* Files Grid/List */}
              {activeFilter !== 'home' && activeFilter !== 'activity' && (
                <FileGrid onFileOpen={handleFileOpen} />
              )}
            </div>
          </main>
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
