/**
 * Unified Productivity API Client
 * Fetches documents across all types: Docs, Sheets, Slides, Videos, Forms
 */

import { api } from './api';

export interface UnifiedDocument {
  id: string;
  title: string;
  type: 'docs' | 'sheets' | 'slides' | 'videos' | 'forms';
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  is_starred: boolean;
  thumbnail_url?: string;
  extra?: Record<string, any>;
}

export interface UnifiedListResponse {
  items: UnifiedDocument[];
  total: number;
  has_more: boolean;
}

export interface ProductivityStats {
  docs: number;
  sheets: number;
  slides: number;
  videos: number;
  forms: number;
  total: number;
}

export type DocumentTypeFilter = 'all' | 'docs' | 'sheets' | 'slides' | 'videos' | 'forms';

export interface UnifiedDocumentsParams {
  type_filter?: DocumentTypeFilter;
  search?: string;
  starred_only?: boolean;
  shared_only?: boolean;
  deleted_only?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'updated_at' | 'created_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

/**
 * Get unified list of all document types
 */
export async function getUnifiedDocuments(params: UnifiedDocumentsParams = {}): Promise<UnifiedListResponse> {
  const response = await api.get('/productivity/unified', { params });
  return response.data;
}

/**
 * Get most recent documents across all types
 */
export async function getRecentDocuments(limit: number = 10): Promise<UnifiedDocument[]> {
  const response = await api.get('/productivity/recent', { params: { limit } });
  return response.data;
}

/**
 * Get all starred documents across all types
 */
export async function getStarredDocuments(limit: number = 50): Promise<UnifiedDocument[]> {
  const response = await api.get('/productivity/starred', { params: { limit } });
  return response.data;
}

/**
 * Toggle star status for any document type
 */
export async function toggleStar(docType: string, docId: string): Promise<{ starred: boolean }> {
  const response = await api.post(`/productivity/${docType}/${docId}/star`);
  return response.data;
}

/**
 * Get document counts by type
 */
export async function getProductivityStats(): Promise<ProductivityStats> {
  const response = await api.get('/productivity/stats');
  return response.data;
}

// Type-specific icon and color mappings
export const typeConfig: Record<string, { icon: string; color: string; bgColor: string; label: string }> = {
  docs: {
    icon: 'FileText',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    label: 'Document',
  },
  sheets: {
    icon: 'Table',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: 'Spreadsheet',
  },
  slides: {
    icon: 'Presentation',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    label: 'Presentation',
  },
  videos: {
    icon: 'Video',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    label: 'Video',
  },
  forms: {
    icon: 'ClipboardList',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    label: 'Form',
  },
};

/**
 * Get the route for opening a document
 */
export function getDocumentRoute(doc: UnifiedDocument): string {
  switch (doc.type) {
    case 'docs':
      return `/docs/editor/${doc.id}`;
    case 'sheets':
      return `/sheets/${doc.id}`;
    case 'slides':
      return `/slides/${doc.id}`;
    case 'videos':
      return `/videos/${doc.id}`;
    case 'forms':
      return `/forms/${doc.id}`;
    default:
      return `/docs/editor/${doc.id}`;
  }
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
