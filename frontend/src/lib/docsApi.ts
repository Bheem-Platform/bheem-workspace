import { api } from './api';
import type { FileItem, ShareLink } from '@/types/docs';

// List files in a directory
export const listFiles = async (
  ncUser: string,
  ncPass: string,
  path: string = '/'
): Promise<{ path: string; count: number; files: FileItem[] }> => {
  const response = await api.get('/docs/files', {
    params: { path, nc_user: ncUser, nc_pass: ncPass },
  });

  const files = (response.data.files || []).map((f: any) => ({
    id: f.id || f.path,
    name: f.name,
    path: f.path,
    type: f.type as 'file' | 'folder',
    size: f.size || 0,
    modified: f.modified,
    mimeType: f.content_type,
    isShared: false,
  }));

  return {
    path: response.data.path,
    count: response.data.count,
    files,
  };
};

// Create a folder
export const createFolder = async (
  ncUser: string,
  ncPass: string,
  path: string,
  name: string
): Promise<{ success: boolean; path: string }> => {
  const response = await api.post('/docs/folders', {
    path,
    name,
  }, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

// Upload a file
export const uploadFile = async (
  ncUser: string,
  ncPass: string,
  path: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; filename: string; path: string; size: number }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);
  formData.append('nc_user', ncUser);
  formData.append('nc_pass', ncPass);

  const response = await api.post('/docs/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });

  return response.data;
};

// Download a file
export const downloadFile = async (
  ncUser: string,
  ncPass: string,
  path: string
): Promise<Blob> => {
  const response = await api.get('/docs/download', {
    params: { path, nc_user: ncUser, nc_pass: ncPass },
    responseType: 'blob',
  });
  return response.data;
};

// Delete a file or folder
export const deleteFile = async (
  ncUser: string,
  ncPass: string,
  path: string
): Promise<{ success: boolean }> => {
  const response = await api.delete('/docs/files', {
    params: { path, nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

// Move or rename a file
export const moveFile = async (
  ncUser: string,
  ncPass: string,
  source: string,
  destination: string
): Promise<{ success: boolean }> => {
  const response = await api.post('/docs/move', {
    source,
    destination,
  }, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

// Copy a file
export const copyFile = async (
  ncUser: string,
  ncPass: string,
  source: string,
  destination: string
): Promise<{ success: boolean }> => {
  const response = await api.post('/docs/copy', {
    source,
    destination,
  }, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

// Create a share link
export const createShareLink = async (
  ncUser: string,
  ncPass: string,
  path: string,
  expiresDays: number = 7
): Promise<{ success: boolean; share_url: string }> => {
  const response = await api.post('/docs/share', {
    path,
    expires_days: expiresDays,
  }, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

// Helper functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileIcon(mimeType?: string, type?: string): string {
  if (type === 'folder') return 'folder';
  if (!mimeType) return 'file';

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archive';
  if (mimeType.includes('text/')) return 'text';

  return 'file';
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function isPreviewable(mimeType?: string): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/')
  );
}
