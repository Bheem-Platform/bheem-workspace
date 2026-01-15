/**
 * Bheem Drive Store
 * State management for Drive file operations
 */
import { create } from 'zustand';
import * as driveApi from '@/lib/driveApi';
import type { DriveFile, DriveShare } from '@/lib/driveApi';

interface UploadItem {
  id: string;
  file: File;
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface DriveState {
  // Files
  files: DriveFile[];
  currentFolderId: string | null;
  breadcrumb: BreadcrumbItem[];
  selectedFiles: string[];

  // View
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'created_at' | 'updated_at' | 'size';
  sortOrder: 'asc' | 'desc';
  searchQuery: string;

  // Filter
  activeFilter: 'all' | 'recent' | 'starred' | 'trash';

  // Loading states
  loading: boolean;
  error: string | null;

  // Upload
  uploadQueue: UploadItem[];
  isUploading: boolean;

  // Modals
  isCreateFolderModalOpen: boolean;
  isShareModalOpen: boolean;
  isRenameModalOpen: boolean;
  isMoveModalOpen: boolean;
  isDeleteConfirmOpen: boolean;
  selectedFileForAction: DriveFile | null;

  // Storage
  storageUsed: number;
  storageTotal: number;

  // Actions
  fetchFiles: (folderId?: string | null) => Promise<void>;
  fetchRecentFiles: () => Promise<void>;
  fetchStarredFiles: () => Promise<void>;
  fetchTrashFiles: () => Promise<void>;
  navigateToFolder: (folderId: string | null, folderName?: string) => Promise<void>;
  navigateUp: () => Promise<void>;

  createFolder: (name: string, parentId?: string | null) => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
  moveFile: (fileId: string, newParentId: string | null) => Promise<void>;
  copyFile: (fileId: string, newParentId?: string) => Promise<void>;
  deleteFiles: (fileIds: string[], permanent?: boolean) => Promise<void>;
  trashFile: (fileId: string) => Promise<void>;
  restoreFile: (fileId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;

  toggleStar: (fileId: string, isStarred: boolean) => Promise<void>;
  downloadFile: (file: DriveFile) => Promise<void>;

  // Selection
  toggleSelect: (fileId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // View settings
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'name' | 'created_at' | 'updated_at' | 'size') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: 'all' | 'recent' | 'starred' | 'trash') => void;

  // Modals
  openCreateFolderModal: () => void;
  closeCreateFolderModal: () => void;
  openShareModal: (file: DriveFile) => void;
  closeShareModal: () => void;
  openRenameModal: (file: DriveFile) => void;
  closeRenameModal: () => void;
  openMoveModal: (file: DriveFile) => void;
  closeMoveModal: () => void;
  openDeleteConfirm: (file: DriveFile) => void;
  closeDeleteConfirm: () => void;

  // Storage
  fetchStorageUsage: () => Promise<void>;

  // Errors
  clearError: () => void;
}

export const useDriveStore = create<DriveState>((set, get) => ({
  // Initial state
  files: [],
  currentFolderId: null,
  breadcrumb: [{ id: null, name: 'My Drive' }],
  selectedFiles: [],

  viewMode: 'grid',
  sortBy: 'name',
  sortOrder: 'asc',
  searchQuery: '',

  activeFilter: 'all',

  loading: false,
  error: null,

  uploadQueue: [],
  isUploading: false,

  isCreateFolderModalOpen: false,
  isShareModalOpen: false,
  isRenameModalOpen: false,
  isMoveModalOpen: false,
  isDeleteConfirmOpen: false,
  selectedFileForAction: null,

  storageUsed: 0,
  storageTotal: 15 * 1024 * 1024 * 1024, // 15 GB default

  // Actions
  fetchFiles: async (folderId) => {
    set({ loading: true, error: null });
    try {
      const files = await driveApi.listFiles({
        parent_id: folderId || undefined,
        sort_by: get().sortBy,
        sort_order: get().sortOrder,
      });
      set({ files, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchRecentFiles: async () => {
    set({ loading: true, error: null, activeFilter: 'recent' });
    try {
      const files = await driveApi.getRecentFiles(50);
      set({ files, loading: false, currentFolderId: null, breadcrumb: [{ id: null, name: 'Recent' }] });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchStarredFiles: async () => {
    set({ loading: true, error: null, activeFilter: 'starred' });
    try {
      const files = await driveApi.getStarredFiles();
      set({ files, loading: false, currentFolderId: null, breadcrumb: [{ id: null, name: 'Starred' }] });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchTrashFiles: async () => {
    set({ loading: true, error: null, activeFilter: 'trash' });
    try {
      const files = await driveApi.getTrashFiles();
      set({ files, loading: false, currentFolderId: null, breadcrumb: [{ id: null, name: 'Trash' }] });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  navigateToFolder: async (folderId, folderName) => {
    const { breadcrumb, activeFilter } = get();

    set({ activeFilter: 'all' });

    if (folderId === null) {
      set({
        currentFolderId: null,
        breadcrumb: [{ id: null, name: 'My Drive' }]
      });
    } else {
      // Check if navigating back via breadcrumb
      const existingIndex = breadcrumb.findIndex(b => b.id === folderId);
      if (existingIndex !== -1) {
        set({
          currentFolderId: folderId,
          breadcrumb: breadcrumb.slice(0, existingIndex + 1)
        });
      } else {
        // Navigating into a folder
        set({
          currentFolderId: folderId,
          breadcrumb: [...breadcrumb, { id: folderId, name: folderName || 'Folder' }]
        });
      }
    }

    await get().fetchFiles(folderId);
  },

  navigateUp: async () => {
    const { breadcrumb } = get();
    if (breadcrumb.length <= 1) return;

    const parentBreadcrumb = breadcrumb[breadcrumb.length - 2];
    await get().navigateToFolder(parentBreadcrumb.id, parentBreadcrumb.name);
  },

  createFolder: async (name, parentId) => {
    set({ loading: true, error: null });
    try {
      await driveApi.createFolder({
        name,
        parent_id: parentId || get().currentFolderId || undefined,
      });
      await get().fetchFiles(get().currentFolderId);
      set({ isCreateFolderModalOpen: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  uploadFiles: async (files) => {
    const uploadItems: UploadItem[] = files.map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      file,
      filename: file.name,
      progress: 0,
      status: 'pending' as const,
    }));

    set({ uploadQueue: uploadItems, isUploading: true });

    const currentFolderId = get().currentFolderId;

    for (const item of uploadItems) {
      try {
        set(state => ({
          uploadQueue: state.uploadQueue.map(u =>
            u.id === item.id ? { ...u, status: 'uploading' as const } : u
          ),
        }));

        await driveApi.uploadFile({
          file: item.file,
          parent_id: currentFolderId || undefined,
          onProgress: (progress) => {
            set(state => ({
              uploadQueue: state.uploadQueue.map(u =>
                u.id === item.id ? { ...u, progress } : u
              ),
            }));
          },
        });

        set(state => ({
          uploadQueue: state.uploadQueue.map(u =>
            u.id === item.id ? { ...u, status: 'completed' as const, progress: 100 } : u
          ),
        }));
      } catch (err: any) {
        set(state => ({
          uploadQueue: state.uploadQueue.map(u =>
            u.id === item.id ? { ...u, status: 'error' as const, error: err.message } : u
          ),
        }));
      }
    }

    set({ isUploading: false });
    await get().fetchFiles(currentFolderId);

    // Clear queue after 3 seconds
    setTimeout(() => {
      set({ uploadQueue: [] });
    }, 3000);
  },

  renameFile: async (fileId, newName) => {
    set({ loading: true, error: null });
    try {
      await driveApi.renameFile(fileId, newName);
      await get().fetchFiles(get().currentFolderId);
      set({ isRenameModalOpen: false, selectedFileForAction: null });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  moveFile: async (fileId, newParentId) => {
    set({ loading: true, error: null });
    try {
      await driveApi.moveFile(fileId, newParentId);
      await get().fetchFiles(get().currentFolderId);
      set({ isMoveModalOpen: false, selectedFileForAction: null });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  copyFile: async (fileId, newParentId) => {
    set({ loading: true, error: null });
    try {
      await driveApi.copyFile(fileId, newParentId);
      await get().fetchFiles(get().currentFolderId);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  deleteFiles: async (fileIds, permanent = false) => {
    set({ loading: true, error: null });
    try {
      for (const fileId of fileIds) {
        await driveApi.deleteFile(fileId, permanent);
      }
      set({ selectedFiles: [], isDeleteConfirmOpen: false, selectedFileForAction: null });

      // Refresh based on current view
      const { activeFilter, currentFolderId } = get();
      if (activeFilter === 'trash') {
        await get().fetchTrashFiles();
      } else {
        await get().fetchFiles(currentFolderId);
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  trashFile: async (fileId) => {
    set({ loading: true, error: null });
    try {
      await driveApi.trashFile(fileId);
      await get().fetchFiles(get().currentFolderId);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  restoreFile: async (fileId) => {
    set({ loading: true, error: null });
    try {
      await driveApi.restoreFile(fileId);
      await get().fetchTrashFiles();
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  emptyTrash: async () => {
    set({ loading: true, error: null });
    try {
      await driveApi.emptyTrash();
      await get().fetchTrashFiles();
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  toggleStar: async (fileId, isStarred) => {
    try {
      if (isStarred) {
        await driveApi.unstarFile(fileId);
      } else {
        await driveApi.starFile(fileId);
      }

      // Update file in state
      set(state => ({
        files: state.files.map(f =>
          f.id === fileId ? { ...f, is_starred: !isStarred } : f
        ),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  downloadFile: async (file) => {
    try {
      await driveApi.downloadFile(file.id, file.name);
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  // Selection
  toggleSelect: (fileId) => {
    set(state => ({
      selectedFiles: state.selectedFiles.includes(fileId)
        ? state.selectedFiles.filter(id => id !== fileId)
        : [...state.selectedFiles, fileId],
    }));
  },

  selectAll: () => {
    set(state => ({
      selectedFiles: state.files.map(f => f.id),
    }));
  },

  clearSelection: () => {
    set({ selectedFiles: [] });
  },

  // View settings
  setViewMode: (mode) => set({ viewMode: mode }),

  setSortBy: (sortBy) => {
    set({ sortBy });
    get().fetchFiles(get().currentFolderId);
  },

  setSortOrder: (order) => {
    set({ sortOrder: order });
    get().fetchFiles(get().currentFolderId);
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setActiveFilter: (filter) => set({ activeFilter: filter }),

  // Modals
  openCreateFolderModal: () => set({ isCreateFolderModalOpen: true }),
  closeCreateFolderModal: () => set({ isCreateFolderModalOpen: false }),

  openShareModal: (file) => set({ isShareModalOpen: true, selectedFileForAction: file }),
  closeShareModal: () => set({ isShareModalOpen: false, selectedFileForAction: null }),

  openRenameModal: (file) => set({ isRenameModalOpen: true, selectedFileForAction: file }),
  closeRenameModal: () => set({ isRenameModalOpen: false, selectedFileForAction: null }),

  openMoveModal: (file) => set({ isMoveModalOpen: true, selectedFileForAction: file }),
  closeMoveModal: () => set({ isMoveModalOpen: false, selectedFileForAction: null }),

  openDeleteConfirm: (file) => set({ isDeleteConfirmOpen: true, selectedFileForAction: file }),
  closeDeleteConfirm: () => set({ isDeleteConfirmOpen: false, selectedFileForAction: null }),

  // Storage
  fetchStorageUsage: async () => {
    try {
      const usage = await driveApi.getStorageUsage();
      set({ storageUsed: usage.used, storageTotal: usage.total });
    } catch (err) {
      // Ignore storage fetch errors
    }
  },

  // Errors
  clearError: () => set({ error: null }),
}));
