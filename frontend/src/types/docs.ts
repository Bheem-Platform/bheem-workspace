// Docs Types for Bheem Docs

export type FileType = 'file' | 'folder';

export type MimeTypeCategory =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'text'
  | 'other';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: FileType;
  mimeType?: string;
  mimeCategory?: MimeTypeCategory;
  size?: number;
  modified: string;
  created?: string;
  isShared: boolean;
  shareUrl?: string;
  permissions: 'read' | 'write' | 'admin';
  owner?: string;
  isFavorite: boolean;
  parentPath?: string;
  etag?: string;
}

export interface ShareLink {
  id: string;
  url: string;
  token: string;
  path: string;
  expiresAt?: string;
  password?: boolean;
  permissions: 'read' | 'write';
  downloads?: number;
  createdAt: string;
}

export interface ShareSettings {
  path: string;
  shareType: ShareType;
  permissions: SharePermission;
  password?: string;
  expiresInDays?: number;
  note?: string;
}

export enum ShareType {
  USER = 0,
  GROUP = 1,
  PUBLIC_LINK = 3,
  EMAIL = 4,
}

export enum SharePermission {
  READ = 1,
  UPDATE = 2,
  CREATE = 4,
  DELETE = 8,
  SHARE = 16,
  ALL = 31,
}

export interface UploadProgress {
  id: string;
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  size?: number;
  uploadedSize?: number;
}

export type SortField = 'name' | 'modified' | 'size' | 'type';
export type SortOrder = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list';

export interface DocsState {
  // Data
  files: FileItem[];
  currentPath: string;
  selectedFile: FileItem | null;
  recentFiles: FileItem[];
  favorites: FileItem[];

  // UI State
  viewMode: ViewMode;
  sortBy: SortField;
  sortOrder: SortOrder;
  searchQuery: string;
  selectedFiles: string[];

  // Modals
  isUploadModalOpen: boolean;
  isNewFolderModalOpen: boolean;
  isShareModalOpen: boolean;
  isPreviewOpen: boolean;
  isRenameModalOpen: boolean;
  isMoveModalOpen: boolean;

  // Upload state
  uploadQueue: UploadProgress[];
  isUploading: boolean;

  // Context menu
  contextMenuFile: FileItem | null;
  contextMenuPosition: { x: number; y: number } | null;

  // Clipboard
  clipboard: {
    files: FileItem[];
    action: 'copy' | 'cut' | null;
  };

  // Loading
  loading: {
    files: boolean;
    upload: boolean;
    action: boolean;
    preview: boolean;
  };

  // Error
  error: string | null;

  // Credentials
  isAuthenticated: boolean;
}

// File icon mapping
export const FILE_ICONS: Record<MimeTypeCategory, { icon: string; color: string; bgColor: string }> = {
  document: { icon: 'FileText', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  spreadsheet: { icon: 'FileSpreadsheet', color: 'text-green-600', bgColor: 'bg-green-100' },
  presentation: { icon: 'Presentation', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  pdf: { icon: 'FileText', color: 'text-red-600', bgColor: 'bg-red-100' },
  image: { icon: 'Image', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  video: { icon: 'Video', color: 'text-pink-600', bgColor: 'bg-pink-100' },
  audio: { icon: 'Music', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  archive: { icon: 'Archive', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  code: { icon: 'Code', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  text: { icon: 'FileText', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  other: { icon: 'File', color: 'text-gray-500', bgColor: 'bg-gray-100' },
};

// Utility function to determine mime category
export function getMimeCategory(mimeType?: string, fileName?: string): MimeTypeCategory {
  if (!mimeType && !fileName) return 'other';

  const ext = fileName?.split('.').pop()?.toLowerCase();

  // Check by extension first
  if (ext) {
    if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'document';
    if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'spreadsheet';
    if (['ppt', 'pptx', 'odp'].includes(ext)) return 'presentation';
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh'].includes(ext)) return 'code';
    if (['txt', 'md', 'log'].includes(ext)) return 'text';
  }

  // Check by mime type
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive')) return 'archive';
    if (mimeType.startsWith('text/')) return 'text';
  }

  return 'other';
}

// Format file size
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
