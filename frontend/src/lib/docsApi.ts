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

// =============================================================================
// DOCS V2 API - Uses JWT auth (no Nextcloud credentials required)
// =============================================================================

export interface FolderV2 {
  id: string;
  name: string;
  description?: string;
  path: string;
  level: number;
  parent_id?: string;
  color?: string;
  icon?: string;
  is_system: boolean;
  subfolder_count?: number;
  document_count?: number;
  created_at?: string;
}

export interface DocumentV2 {
  id: string;
  title: string;
  description?: string;
  document_type: string;
  status?: string;
  file_name: string;
  file_extension?: string;
  file_size: number;
  mime_type: string;
  is_editable: boolean;
  current_version?: number;
  tags?: string[];
  view_count?: number;
  download_count?: number;
  created_at?: string;
  updated_at?: string;
}

// List folders using v2 API
export const listFoldersV2 = async (
  parentId?: string
): Promise<FolderV2[]> => {
  const params: Record<string, string> = {};
  if (parentId) {
    params.parent_id = parentId;
  }
  const response = await api.get('/docs/v2/folders', { params });
  return response.data;
};

// Create a folder using v2 API
export const createFolderV2 = async (
  name: string,
  parentId?: string,
  description?: string,
  color?: string,
  icon?: string
): Promise<FolderV2> => {
  const response = await api.post('/docs/v2/folders', {
    name,
    parent_id: parentId || null,
    description,
    color,
    icon,
  });
  return response.data;
};

// Get folder by ID
export const getFolderV2 = async (folderId: string): Promise<FolderV2> => {
  const response = await api.get(`/docs/v2/folders/${folderId}`);
  return response.data;
};

// Update a folder
export const updateFolderV2 = async (
  folderId: string,
  data: { name?: string; description?: string; color?: string; icon?: string }
): Promise<FolderV2> => {
  const response = await api.put(`/docs/v2/folders/${folderId}`, data);
  return response.data;
};

// Delete a folder
export const deleteFolderV2 = async (
  folderId: string,
  recursive: boolean = false
): Promise<{ deleted: boolean }> => {
  const response = await api.delete(`/docs/v2/folders/${folderId}`, {
    params: { recursive },
  });
  return response.data;
};

// Get folder tree
export const getFolderTreeV2 = async (): Promise<{ tree: FolderV2[] }> => {
  const response = await api.get('/docs/v2/folders/tree');
  return response.data;
};

// Get folder breadcrumb
export const getFolderBreadcrumbV2 = async (
  folderId: string
): Promise<{ breadcrumb: FolderV2[] }> => {
  const response = await api.get(`/docs/v2/folders/${folderId}/breadcrumb`);
  return response.data;
};

// List documents using v2 API
export const listDocumentsV2 = async (
  options: {
    folderId?: string;
    documentType?: string;
    status?: string;
    search?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  documents: DocumentV2[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}> => {
  const params: Record<string, string | number> = {};
  if (options.folderId) params.folder_id = options.folderId;
  if (options.documentType) params.document_type = options.documentType;
  if (options.status) params.status = options.status;
  if (options.search) params.search = options.search;
  if (options.tags) params.tags = options.tags.join(',');
  if (options.limit) params.limit = options.limit;
  if (options.offset) params.offset = options.offset;

  const response = await api.get('/docs/v2/documents', { params });
  return response.data;
};

// Upload document using v2 API
export const uploadDocumentV2 = async (
  file: File,
  options: {
    title?: string;
    description?: string;
    folderId?: string;
    tags?: string[];
  } = {},
  onProgress?: (progress: number) => void
): Promise<DocumentV2> => {
  const formData = new FormData();
  formData.append('file', file);

  const params: Record<string, string> = {};
  if (options.title) params.title = options.title;
  if (options.description) params.description = options.description;
  if (options.folderId) params.folder_id = options.folderId;
  if (options.tags) params.tags = options.tags.join(',');

  const response = await api.post('/docs/v2/documents', formData, {
    params,
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

// Get document by ID
export const getDocumentV2 = async (documentId: string): Promise<DocumentV2> => {
  const response = await api.get(`/docs/v2/documents/${documentId}`);
  return response.data;
};

// Update document metadata
export const updateDocumentV2 = async (
  documentId: string,
  data: {
    title?: string;
    description?: string;
    document_type?: string;
    status?: string;
    tags?: string[];
  }
): Promise<DocumentV2> => {
  const response = await api.put(`/docs/v2/documents/${documentId}`, data);
  return response.data;
};

// Delete a document
export const deleteDocumentV2 = async (
  documentId: string,
  permanent: boolean = false
): Promise<{ deleted: boolean }> => {
  const response = await api.delete(`/docs/v2/documents/${documentId}`, {
    params: { permanent },
  });
  return response.data;
};

// Download document
export const downloadDocumentV2 = async (
  documentId: string,
  version?: number
): Promise<Blob> => {
  const params: Record<string, number> = {};
  if (version) params.version = version;

  const response = await api.get(`/docs/v2/documents/${documentId}/download`, {
    params,
    responseType: 'blob',
  });
  return response.data;
};

// Get storage usage
export const getStorageUsageV2 = async (): Promise<{
  used_bytes: number;
  used_mb: number;
  used_gb: number;
  object_count: number;
  quota_bytes?: number;
  quota_used_percent?: number;
}> => {
  const response = await api.get('/docs/v2/storage/usage');
  return response.data;
};

// Get presigned URL for sharing (V2 API)
export const getPresignedUrlV2 = async (
  documentId: string,
  expiresIn: number = 604800 // 7 days in seconds
): Promise<{ url: string; expires_in: number; storage_path?: string }> => {
  const response = await api.get(`/docs/v2/documents/${documentId}/presigned-url`, {
    params: { expires_in: expiresIn },
  });
  return response.data;
};
