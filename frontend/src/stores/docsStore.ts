import { create } from 'zustand';
import * as docsApi from '@/lib/docsApi';
import { useCredentialsStore } from './credentialsStore';
import type { FileItem, UploadProgress } from '@/types/docs';

interface DocsState {
  // Data
  files: FileItem[];
  currentPath: string;
  pathHistory: string[];

  // Selection
  selectedFiles: string[];

  // View
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'modified' | 'size' | 'type';
  sortOrder: 'asc' | 'desc';

  // Upload
  uploadQueue: UploadProgress[];
  isUploading: boolean;

  // UI State
  isCreateFolderModalOpen: boolean;
  isShareModalOpen: boolean;
  isRenameModalOpen: boolean;
  isDeleteConfirmOpen: boolean;
  selectedForAction: FileItem | null;

  // Loading
  loading: {
    files: boolean;
    action: boolean;
  };

  // Error
  error: string | null;

  // Actions - Files
  fetchFiles: (path?: string) => Promise<void>;
  createFolder: (name: string) => Promise<boolean>;
  uploadFiles: (files: File[]) => Promise<void>;
  downloadFile: (file: FileItem) => Promise<void>;
  deleteFiles: (paths: string[]) => Promise<boolean>;
  moveFile: (source: string, destination: string) => Promise<boolean>;
  copyFile: (source: string, destination: string) => Promise<boolean>;
  renameFile: (oldPath: string, newName: string) => Promise<boolean>;

  // Actions - Sharing
  createShareLink: (path: string, expiresDays?: number) => Promise<string | null>;

  // Actions - Navigation
  navigateTo: (path: string) => void;
  navigateUp: () => void;
  navigateBack: () => void;

  // Actions - Selection
  selectFile: (fileId: string) => void;
  toggleFileSelection: (fileId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Actions - View
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'name' | 'modified' | 'size' | 'type') => void;
  toggleSortOrder: () => void;

  // Actions - Modals
  openCreateFolderModal: () => void;
  closeCreateFolderModal: () => void;
  openShareModal: (file: FileItem) => void;
  closeShareModal: () => void;
  openRenameModal: (file: FileItem) => void;
  closeRenameModal: () => void;
  openDeleteConfirm: (file?: FileItem) => void;
  closeDeleteConfirm: () => void;

  // Utils
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  files: [],
  currentPath: '/',
  pathHistory: ['/'],
  selectedFiles: [],
  viewMode: 'grid' as const,
  sortBy: 'name' as const,
  sortOrder: 'asc' as const,
  uploadQueue: [],
  isUploading: false,
  isCreateFolderModalOpen: false,
  isShareModalOpen: false,
  isRenameModalOpen: false,
  isDeleteConfirmOpen: false,
  selectedForAction: null,
  loading: {
    files: false,
    action: false,
  },
  error: null,
};

export const useDocsStore = create<DocsState>((set, get) => ({
  ...initialState,

  fetchFiles: async (path?: string) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) {
      set({ error: 'Nextcloud credentials not found' });
      return;
    }

    const targetPath = path || get().currentPath;
    set((state) => ({ loading: { ...state.loading, files: true }, error: null }));

    try {
      const result = await docsApi.listFiles(
        credentials.username,
        credentials.password,
        targetPath
      );

      // Sort files
      const { sortBy, sortOrder } = get();
      const sortedFiles = sortFiles(result.files, sortBy, sortOrder);

      set({
        files: sortedFiles,
        currentPath: targetPath,
      });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch files' });
    } finally {
      set((state) => ({ loading: { ...state.loading, files: false } }));
    }
  },

  createFolder: async (name: string) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) return false;

    set((state) => ({ loading: { ...state.loading, action: true }, error: null }));

    try {
      await docsApi.createFolder(
        credentials.username,
        credentials.password,
        get().currentPath,
        name
      );

      await get().fetchFiles();
      set({ isCreateFolderModalOpen: false });
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to create folder' });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  uploadFiles: async (files: File[]) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) return;

    set({ isUploading: true });

    // Add files to upload queue
    const queue: UploadProgress[] = files.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      filename: file.name,
      progress: 0,
      status: 'pending',
    }));

    set({ uploadQueue: queue });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      set((state) => ({
        uploadQueue: state.uploadQueue.map((item, idx) =>
          idx === i ? { ...item, status: 'uploading' } : item
        ),
      }));

      try {
        await docsApi.uploadFile(
          credentials.username,
          credentials.password,
          get().currentPath,
          file,
          (progress) => {
            set((state) => ({
              uploadQueue: state.uploadQueue.map((item, idx) =>
                idx === i ? { ...item, progress } : item
              ),
            }));
          }
        );

        set((state) => ({
          uploadQueue: state.uploadQueue.map((item, idx) =>
            idx === i ? { ...item, status: 'completed', progress: 100 } : item
          ),
        }));
      } catch (error) {
        set((state) => ({
          uploadQueue: state.uploadQueue.map((item, idx) =>
            idx === i ? { ...item, status: 'failed' as const } : item
          ),
        }));
      }
    }

    set({ isUploading: false });
    await get().fetchFiles();

    // Clear queue after a delay
    setTimeout(() => {
      set({ uploadQueue: [] });
    }, 3000);
  },

  downloadFile: async (file: FileItem) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) return;

    try {
      const blob = await docsApi.downloadFile(
        credentials.username,
        credentials.password,
        file.path
      );

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to download file' });
    }
  },

  deleteFiles: async (paths: string[]) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) return false;

    set((state) => ({ loading: { ...state.loading, action: true }, error: null }));

    try {
      for (const path of paths) {
        await docsApi.deleteFile(credentials.username, credentials.password, path);
      }

      await get().fetchFiles();
      set({ selectedFiles: [], isDeleteConfirmOpen: false, selectedForAction: null });
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to delete files' });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  moveFile: async (source: string, destination: string) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) return false;

    try {
      await docsApi.moveFile(credentials.username, credentials.password, source, destination);
      await get().fetchFiles();
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to move file' });
      return false;
    }
  },

  copyFile: async (source: string, destination: string) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) return false;

    try {
      await docsApi.copyFile(credentials.username, credentials.password, source, destination);
      await get().fetchFiles();
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to copy file' });
      return false;
    }
  },

  renameFile: async (oldPath: string, newName: string) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) return false;

    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentPath}/${newName}`;

    set((state) => ({ loading: { ...state.loading, action: true }, error: null }));

    try {
      await docsApi.moveFile(credentials.username, credentials.password, oldPath, newPath);
      await get().fetchFiles();
      set({ isRenameModalOpen: false, selectedForAction: null });
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to rename file' });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  createShareLink: async (path: string, expiresDays = 7) => {
    const credentials = useCredentialsStore.getState().getNextcloudCredentials();
    if (!credentials) return null;

    try {
      const result = await docsApi.createShareLink(
        credentials.username,
        credentials.password,
        path,
        expiresDays
      );
      return result.share_url;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to create share link' });
      return null;
    }
  },

  navigateTo: (path: string) => {
    set((state) => ({
      currentPath: path,
      pathHistory: [...state.pathHistory, path],
      selectedFiles: [],
    }));
    get().fetchFiles(path);
  },

  navigateUp: () => {
    const { currentPath } = get();
    if (currentPath === '/') return;

    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = '/' + parts.join('/');

    get().navigateTo(parentPath);
  },

  navigateBack: () => {
    const { pathHistory } = get();
    if (pathHistory.length <= 1) return;

    const newHistory = [...pathHistory];
    newHistory.pop();
    const previousPath = newHistory[newHistory.length - 1];

    set({ pathHistory: newHistory });
    get().fetchFiles(previousPath);
  },

  selectFile: (fileId: string) => {
    set({ selectedFiles: [fileId] });
  },

  toggleFileSelection: (fileId: string) => {
    set((state) => ({
      selectedFiles: state.selectedFiles.includes(fileId)
        ? state.selectedFiles.filter((id) => id !== fileId)
        : [...state.selectedFiles, fileId],
    }));
  },

  selectAll: () => {
    set((state) => ({
      selectedFiles: state.files.map((f) => f.id),
    }));
  },

  clearSelection: () => {
    set({ selectedFiles: [] });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  setSortBy: (sortBy) => {
    const { files, sortOrder } = get();
    set({
      sortBy,
      files: sortFiles(files, sortBy, sortOrder),
    });
  },

  toggleSortOrder: () => {
    const { files, sortBy, sortOrder } = get();
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    set({
      sortOrder: newOrder,
      files: sortFiles(files, sortBy, newOrder),
    });
  },

  openCreateFolderModal: () => set({ isCreateFolderModalOpen: true }),
  closeCreateFolderModal: () => set({ isCreateFolderModalOpen: false }),

  openShareModal: (file) => set({ isShareModalOpen: true, selectedForAction: file }),
  closeShareModal: () => set({ isShareModalOpen: false, selectedForAction: null }),

  openRenameModal: (file) => set({ isRenameModalOpen: true, selectedForAction: file }),
  closeRenameModal: () => set({ isRenameModalOpen: false, selectedForAction: null }),

  openDeleteConfirm: (file) => set({ isDeleteConfirmOpen: true, selectedForAction: file || null }),
  closeDeleteConfirm: () => set({ isDeleteConfirmOpen: false, selectedForAction: null }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));

// Helper function to sort files
function sortFiles(
  files: FileItem[],
  sortBy: 'name' | 'modified' | 'size' | 'type',
  sortOrder: 'asc' | 'desc'
): FileItem[] {
  const sorted = [...files].sort((a, b) => {
    // Folders always come first
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }

    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'modified':
        comparison = new Date(a.modified || 0).getTime() - new Date(b.modified || 0).getTime();
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'type':
        comparison = (a.mimeType || '').localeCompare(b.mimeType || '');
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}
