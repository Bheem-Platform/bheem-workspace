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

import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import AppLauncher from '@/components/shared/AppLauncher';
import DriveSidebar from '@/components/drive/DriveSidebar';
import DriveFilterBar, { FilterState } from '@/components/drive/DriveFilterBar';
import FileGrid from '@/components/drive/FileGrid';
import FileDetailsPanel from '@/components/drive/FileDetailsPanel';
import ActivityFeed from '@/components/drive/ActivityFeed';
import HomeView from '@/components/drive/HomeView';
import {
  CreateFolderModal,
  RenameModal,
  ShareModal,
  DeleteConfirmModal,
  UploadModal,
  MoveModal,
  FilePreviewModal,
} from '@/components/drive/DriveModals';
import { useDriveStore } from '@/stores/driveStore';
import { useRequireAuth } from '@/stores/authStore';
import BheemLoader from '@/components/shared/BheemLoader';
import type { DriveFile } from '@/lib/driveApi';
import { getPreviewUrl, getDownloadUrl } from '@/lib/driveApi';

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
    openShareModal,
    openRenameModal,
    openDeleteConfirm,
    toggleStar,
    downloadFile,
    trashFile,
  } = useDriveStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [detailsFile, setDetailsFile] = useState<DriveFile | null>(null);

  // Fetch files on mount
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      fetchFiles();
      fetchStorageUsage();
    }
  }, [authLoading, isLoggedIn]);

  // Update details panel when selection changes
  useEffect(() => {
    if (selectedFiles.length === 1) {
      const file = files.find(f => f.id === selectedFiles[0]);
      if (file) {
        setDetailsFile(file);
      }
    } else if (selectedFiles.length === 0) {
      setDetailsFile(null);
    }
  }, [selectedFiles, files]);

  const handleToggleDetailsPanel = () => {
    if (showDetailsPanel) {
      setShowDetailsPanel(false);
    } else {
      setShowDetailsPanel(true);
    }
  };

  const handleFileOpen = useCallback((file: DriveFile) => {
    if (file.mime_type?.includes('document') || file.mime_type?.includes('word')) {
      router.push(`/docs/editor/${file.id}`);
    } else if (file.mime_type?.includes('spreadsheet') || file.mime_type?.includes('excel')) {
      router.push(`/sheets/${file.id}`);
    } else if (file.mime_type?.includes('presentation') || file.mime_type?.includes('powerpoint')) {
      router.push(`/slides/${file.id}`);
    } else if (file.mime_type?.startsWith('image/') || file.mime_type?.includes('pdf')) {
      // Open images and PDFs in preview modal
      setPreviewFile(file);
      setShowPreviewModal(true);
    } else {
      // Download other files
      window.open(getDownloadUrl(file.id), '_blank');
    }
  }, [router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Delete key - move selected files to trash
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFiles.length > 0 && !ctrlOrCmd) {
          e.preventDefault();
          if (activeFilter === 'trash') {
            // Permanent delete if in trash
            deleteFiles(selectedFiles, true);
          } else {
            deleteFiles(selectedFiles, false);
          }
        }
      }

      // Ctrl/Cmd + A - Select all
      if (ctrlOrCmd && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }

      // Escape - Clear selection
      if (e.key === 'Escape') {
        clearSelection();
        setShowPreviewModal(false);
      }

      // / or Ctrl/Cmd + F - Focus search
      if (e.key === '/' || (ctrlOrCmd && e.key === 'f')) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search in Drive"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Ctrl/Cmd + N - New folder
      if (ctrlOrCmd && e.key === 'n') {
        e.preventDefault();
        openCreateFolderModal();
      }

      // Enter - Open selected file (if only one selected)
      if (e.key === 'Enter' && selectedFiles.length === 1) {
        e.preventDefault();
        const file = files.find(f => f.id === selectedFiles[0]);
        if (file) {
          if (file.file_type === 'folder') {
            navigateToFolder(file.id, file.name);
          } else {
            handleFileOpen(file);
          }
        }
      }

      // i - Toggle details panel
      if (e.key === 'i' && !ctrlOrCmd) {
        handleToggleDetailsPanel();
      }

      // g then d - Go to My Drive
      // g then h - Go to Home
      // g then s - Go to Starred

      // Star with 's' key
      if (e.key === 's' && !ctrlOrCmd && selectedFiles.length === 1) {
        const file = files.find(f => f.id === selectedFiles[0]);
        if (file) {
          toggleStar(file.id, file.is_starred);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedFiles,
    files,
    activeFilter,
    deleteFiles,
    selectAll,
    clearSelection,
    openCreateFolderModal,
    navigateToFolder,
    handleFileOpen,
    toggleStar,
    showDetailsPanel,
  ]);

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

  const handlePreviewNavigate = (file: DriveFile) => {
    setPreviewFile(file);
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
      <BheemLoader
        size="lg"
        variant="spinner"
        text="Loading Drive..."
        fullScreen
        transparent
      />
    );
  }

  // Drive sidebar component
  const driveSidebar = (
    <DriveSidebar
      onNewFolder={openCreateFolderModal}
      onUpload={() => setShowUploadModal(true)}
    />
  );

  return (
    <>
      <Head>
        <title>{getPageTitle()} | Bheem Drive</title>
      </Head>

      <WorkspaceLayout
        title="Drive"
        secondarySidebar={driveSidebar}
        secondarySidebarWidth={264}
        hideHeader
      >
        <div
          {...getRootProps()}
          className={`h-full bg-gray-50 ${isDragActive ? 'bg-[#FFCCF2]/10' : ''}`}
        >
          <input {...getInputProps()} />

          {/* Drag overlay */}
          {isDragActive && (
            <div className="fixed inset-0 z-50 bg-[#977DFF]/10 border-4 border-dashed border-[#977DFF] flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Upload size={64} className="mx-auto text-[#977DFF] mb-4" />
                <p className="text-xl font-medium text-[#0033FF]">Drop files to upload</p>
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className={`h-full overflow-y-auto transition-all ${showDetailsPanel ? 'mr-80' : ''}`}>
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
                      className="pl-10 pr-4 py-2 bg-gray-100 rounded-full border-0 focus:ring-2 focus:ring-[#977DFF] focus:bg-white text-sm w-80 transition-all"
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
                        className={viewMode === 'grid' ? 'text-[#977DFF]' : 'text-gray-500'}
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
                        className={viewMode === 'list' ? 'text-[#977DFF]' : 'text-gray-500'}
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
                                sortBy === field ? 'text-[#0033FF] bg-[#FFCCF2]/20' : 'text-gray-700'
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
                  <button
                    onClick={handleToggleDetailsPanel}
                    className={`p-2 rounded-lg transition-colors ${
                      showDetailsPanel ? 'bg-[#FFCCF2]/30 text-[#977DFF]' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title="Details"
                  >
                    <Info size={18} />
                  </button>

                  {/* App Launcher */}
                  <AppLauncher />
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
                <div className="mb-4 px-4 py-3 bg-[#FFCCF2]/20 border border-[#977DFF]/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[#0033FF] font-medium">
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
                    className="text-sm text-[#977DFF] hover:text-[#0033FF]"
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
                                item.status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF]'
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
                <HomeView onFileOpen={handleFileOpen} />
              )}

              {/* Activity View */}
              {activeFilter === 'activity' && (
                <div className="mb-6">
                  <ActivityFeed />
                </div>
              )}

              {/* Files Grid/List */}
              {activeFilter !== 'home' && activeFilter !== 'activity' && (
                <FileGrid onFileOpen={handleFileOpen} />
              )}
            </div>
          </main>

          {/* Details Panel */}
          {showDetailsPanel && (
            <div className="fixed right-0 top-0 h-full z-10">
              <FileDetailsPanel
                file={detailsFile}
                isOpen={showDetailsPanel}
                onClose={() => setShowDetailsPanel(false)}
                onStar={() => detailsFile && toggleStar(detailsFile.id, detailsFile.is_starred)}
                onShare={() => detailsFile && openShareModal(detailsFile)}
                onRename={() => detailsFile && openRenameModal(detailsFile)}
                onTrash={() => detailsFile && trashFile(detailsFile.id)}
                onDownload={() => detailsFile && downloadFile(detailsFile)}
              />
            </div>
          )}

          {/* Modals */}
          <CreateFolderModal />
          <RenameModal />
          <ShareModal />
          <MoveModal />
          <DeleteConfirmModal />
          <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
          <FilePreviewModal
            file={previewFile}
            isOpen={showPreviewModal}
            onClose={() => {
              setShowPreviewModal(false);
              setPreviewFile(null);
            }}
            files={files}
            onNavigate={handlePreviewNavigate}
          />
        </div>
      </WorkspaceLayout>
    </>
  );
}
