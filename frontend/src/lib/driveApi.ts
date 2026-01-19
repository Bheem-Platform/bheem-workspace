/**
 * Bheem Drive API Client
 * API calls for Drive file management
 */

const API_BASE = '/api/v1/drive';

// Get auth token from localStorage
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
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
  const token = localStorage.getItem('auth_token');
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

    xhr.open('POST', `${API_BASE}/files/upload`);
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

/**
 * Get a direct download URL with token (for opening in new tab or direct link)
 */
export function getDownloadUrl(fileId: string): string {
  const token = localStorage.getItem('auth_token');
  return `${API_BASE}/files/${fileId}/download${token ? `?token=${token}` : ''}`;
}

/**
 * Get a preview URL with token (for viewing files inline - images, PDFs, etc.)
 */
export function getPreviewUrl(fileId: string): string {
  const token = localStorage.getItem('auth_token');
  return `${API_BASE}/files/${fileId}/preview${token ? `?token=${token}` : ''}`;
}

/**
 * Download a file by triggering browser download
 */
export async function downloadFile(fileId: string, fileName: string): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE}/files/${fileId}/download${token ? `?token=${token}` : ''}`, {
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

/**
 * Open file in new tab for preview
 */
export function openFilePreview(fileId: string): void {
  const url = getPreviewUrl(fileId);
  window.open(url, '_blank');
}

/**
 * Open file download in new tab
 */
export function openFileDownload(fileId: string): void {
  const url = getDownloadUrl(fileId);
  window.open(url, '_blank');
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

// Activity
export interface DriveActivity {
  id: string;
  file_id: string;
  file_name: string;
  action: string;
  actor_name: string;
  actor_email: string;
  created_at: string;
  details?: Record<string, any>;
}

export async function getActivity(limit: number = 50): Promise<DriveActivity[]> {
  const response = await fetch(`${API_BASE}/activity?limit=${limit}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get activity');
  }

  return response.json();
}

// Home (Quick Access)
export async function getHomeFiles(): Promise<DriveFile[]> {
  const response = await fetch(`${API_BASE}/home`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get home files');
  }

  return response.json();
}

// Workspace Files
export async function getWorkspaceFiles(): Promise<DriveFile[]> {
  const response = await fetch(`${API_BASE}/workspace`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get workspace files');
  }

  return response.json();
}

// Shared with me
export async function getSharedWithMe(): Promise<DriveFile[]> {
  const response = await fetch(`${API_BASE}/shared-with-me`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get shared files');
  }

  return response.json();
}

// Spam
export async function getSpamFiles(): Promise<DriveFile[]> {
  const response = await fetch(`${API_BASE}/spam`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get spam files');
  }

  return response.json();
}

// Shared Drives
export interface SharedDrive {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export async function getSharedDrives(): Promise<SharedDrive[]> {
  const response = await fetch(`${API_BASE}/shared-drives`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get shared drives');
  }

  return response.json();
}

export async function getSharedDriveContents(driveId: string): Promise<DriveFile[]> {
  const response = await fetch(`${API_BASE}/shared-drives/${driveId}/contents`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get shared drive contents');
  }

  return response.json();
}

// Advanced Filtering
export interface AdvancedFilterParams {
  type?: string; // folder, document, spreadsheet, presentation, pdf, image, video, audio, archive
  people?: string; // me, not-me
  modified?: string; // today, yesterday, week, month, year
  location?: string; // my-drive, shared-with-me, starred, trash
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

export async function listFilesAdvanced(params: AdvancedFilterParams = {}): Promise<DriveFile[]> {
  const queryParams = new URLSearchParams();

  if (params.type) queryParams.append('type', params.type);
  if (params.people) queryParams.append('people', params.people);
  if (params.modified) queryParams.append('modified', params.modified);
  if (params.location) queryParams.append('location', params.location);
  if (params.search) queryParams.append('search', params.search);
  if (params.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params.sort_order) queryParams.append('sort_order', params.sort_order);
  if (params.skip !== undefined) queryParams.append('skip', String(params.skip));
  if (params.limit !== undefined) queryParams.append('limit', String(params.limit));

  const url = `${API_BASE}/files/search${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to search files');
  }

  return response.json();
}

// Categories (file type summary)
export interface DriveCategories {
  documents: number;
  spreadsheets: number;
  presentations: number;
  pdfs: number;
  images: number;
  videos: number;
  audio: number;
  archives: number;
  others: number;
}

export async function getCategories(): Promise<DriveCategories> {
  const response = await fetch(`${API_BASE}/categories`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get categories');
  }

  return response.json();
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
