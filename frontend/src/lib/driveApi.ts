/**
 * Bheem Drive API Client
 * API calls for Drive file management
 */

const API_BASE = '/api/v1/drive';

// Get auth token from localStorage
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Types
export interface DriveFile {
  id: string;
  name: string;
  file_type: 'file' | 'folder';
  mime_type?: string;
  size?: number;
  parent_id?: string;
  path: string;
  description?: string;
  is_starred: boolean;
  is_trashed: boolean;
  is_deleted: boolean;
  thumbnail_url?: string;
  download_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  share_count?: number;
}

export interface DriveShare {
  id: string;
  file_id: string;
  user_id?: string;
  user_email?: string;
  permission: 'view' | 'comment' | 'edit';
  is_link_share: boolean;
  link_token?: string;
  expires_at?: string;
  created_at: string;
}

export interface CreateFolderRequest {
  name: string;
  parent_id?: string;
  description?: string;
}

export interface UploadFileRequest {
  file: File;
  parent_id?: string;
  description?: string;
  onProgress?: (progress: number) => void;
}

export interface MoveFileRequest {
  file_id: string;
  new_parent_id?: string;
}

export interface RenameFileRequest {
  file_id: string;
  new_name: string;
}

export interface ShareFileRequest {
  user_email?: string;
  permission: 'view' | 'comment' | 'edit';
  is_link_share?: boolean;
  expires_at?: string;
}

export interface ListFilesParams {
  parent_id?: string;
  file_type?: 'file' | 'folder';
  is_starred?: boolean;
  is_trashed?: boolean;
  search?: string;
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'size';
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

// API Functions

export async function listFiles(params: ListFilesParams = {}): Promise<DriveFile[]> {
  const queryParams = new URLSearchParams();

  if (params.parent_id) queryParams.append('parent_id', params.parent_id);
  if (params.file_type) queryParams.append('file_type', params.file_type);
  if (params.is_starred !== undefined) queryParams.append('is_starred', String(params.is_starred));
  if (params.is_trashed !== undefined) queryParams.append('is_trashed', String(params.is_trashed));
  if (params.search) queryParams.append('search', params.search);
  if (params.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params.sort_order) queryParams.append('sort_order', params.sort_order);
  if (params.skip !== undefined) queryParams.append('skip', String(params.skip));
  if (params.limit !== undefined) queryParams.append('limit', String(params.limit));

  const url = `${API_BASE}/files${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to list files');
  }

  return response.json();
}

export async function getFile(fileId: string): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get file');
  }

  return response.json();
}

export async function createFolder(data: CreateFolderRequest): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create folder');
  }

  return response.json();
}

export async function uploadFile(request: UploadFileRequest): Promise<DriveFile> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', request.file);
  if (request.parent_id) formData.append('parent_id', request.parent_id);
  if (request.description) formData.append('description', request.description);

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && request.onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        request.onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.open('POST', `${API_BASE}/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function renameFile(fileId: string, newName: string): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name: newName }),
  });

  if (!response.ok) {
    throw new Error('Failed to rename file');
  }

  return response.json();
}

export async function moveFile(fileId: string, newParentId: string | null): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}/move`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ new_parent_id: newParentId }),
  });

  if (!response.ok) {
    throw new Error('Failed to move file');
  }

  return response.json();
}

export async function copyFile(fileId: string, newParentId?: string): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}/copy`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ new_parent_id: newParentId }),
  });

  if (!response.ok) {
    throw new Error('Failed to copy file');
  }

  return response.json();
}

export async function deleteFile(fileId: string, permanent: boolean = false): Promise<void> {
  const response = await fetch(`${API_BASE}/files/${fileId}?permanent=${permanent}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete file');
  }
}

export async function trashFile(fileId: string): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}/trash`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to trash file');
  }

  return response.json();
}

export async function restoreFile(fileId: string): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to restore file');
  }

  return response.json();
}

export async function starFile(fileId: string): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}/star`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to star file');
  }

  return response.json();
}

export async function unstarFile(fileId: string): Promise<DriveFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}/unstar`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to unstar file');
  }

  return response.json();
}

export async function getDownloadUrl(fileId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/files/${fileId}/download`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get download URL');
  }

  const data = await response.json();
  return data.download_url;
}

export async function downloadFile(fileId: string, fileName: string): Promise<void> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/files/${fileId}/download`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download file');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Sharing

export async function getShares(fileId: string): Promise<DriveShare[]> {
  const response = await fetch(`${API_BASE}/files/${fileId}/shares`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get shares');
  }

  return response.json();
}

export async function shareFile(fileId: string, data: ShareFileRequest): Promise<DriveShare> {
  const response = await fetch(`${API_BASE}/files/${fileId}/share`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to share file');
  }

  return response.json();
}

export async function removeShare(fileId: string, shareId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/files/${fileId}/shares/${shareId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to remove share');
  }
}

// Storage

export async function getStorageUsage(): Promise<{ used: number; total: number; percentage: number }> {
  const response = await fetch(`${API_BASE}/storage`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get storage usage');
  }

  return response.json();
}

// Recent & Starred

export async function getRecentFiles(limit: number = 20): Promise<DriveFile[]> {
  const response = await fetch(`${API_BASE}/recent?limit=${limit}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get recent files');
  }

  return response.json();
}

export async function getStarredFiles(): Promise<DriveFile[]> {
  return listFiles({ is_starred: true });
}

export async function getTrashFiles(): Promise<DriveFile[]> {
  return listFiles({ is_trashed: true });
}

export async function emptyTrash(): Promise<void> {
  const response = await fetch(`${API_BASE}/trash/empty`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to empty trash');
  }
}

// Helpers
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileIcon(file: DriveFile): string {
  if (file.file_type === 'folder') return 'folder';

  const mime = file.mime_type || '';

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('word') || mime.includes('document')) return 'doc';
  if (mime.includes('sheet') || mime.includes('excel')) return 'sheet';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'slides';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive')) return 'archive';
  if (mime.includes('text') || mime.includes('code')) return 'code';

  return 'file';
}
