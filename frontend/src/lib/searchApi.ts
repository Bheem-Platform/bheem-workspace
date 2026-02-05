/**
 * Bheem Workspace - Search API Client
 *
 * Frontend API client for unified search.
 * Phase 8: Search Enhancement
 */

import { api as baseApi } from '@/lib/api';

// Create a wrapper that prepends the search path
const api = {
  get: (url: string, config?: any) => baseApi.get(`/search${url}`, config),
  post: (url: string, data?: any, config?: any) => baseApi.post(`/search${url}`, data, config),
  put: (url: string, data?: any, config?: any) => baseApi.put(`/search${url}`, data, config),
  patch: (url: string, data?: any, config?: any) => baseApi.patch(`/search${url}`, data, config),
  delete: (url: string, config?: any) => baseApi.delete(`/search${url}`, config),
};

// Types
export interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  snippet?: string;
  score: number;
  created_at?: string;
  updated_at?: string;
  mime_type?: string;
  size?: number;
  slide_count?: number;
  response_count?: number;
  meeting_code?: string;
  scheduled_start?: string;
  email?: string;
  // Additional fields for notes/sites
  color?: string;
  is_pinned?: boolean;
  slug?: string;
  visibility?: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResultItem[];
}

export interface SuggestionItem {
  type: string;
  text: string;
  result_count?: number;
  search_count?: number;
}

export interface RecentItem {
  id: string;
  type: string;
  title: string;
  updated_at?: string;
}

export interface SearchFilters {
  apps?: string[];
  file_types?: string[];
  date_from?: Date;
  date_to?: Date;
  owner_id?: string;
  shared_with_me?: boolean;
}

// Available apps for search
export const SEARCHABLE_APPS = [
  { id: 'mail', label: 'Mail', icon: 'Mail' },
  { id: 'drive', label: 'Drive', icon: 'HardDrive' },
  { id: 'docs', label: 'Docs', icon: 'FileText' },
  { id: 'sheets', label: 'Sheets', icon: 'Table' },
  { id: 'slides', label: 'Slides', icon: 'Presentation' },
  { id: 'forms', label: 'Forms', icon: 'ListChecks' },
  { id: 'meet', label: 'Meet', icon: 'Video' },
  { id: 'contacts', label: 'Contacts', icon: 'Users' },
  { id: 'notes', label: 'Notes', icon: 'StickyNote' },
  { id: 'sites', label: 'Sites', icon: 'Globe' },
] as const;

export type SearchableApp = typeof SEARCHABLE_APPS[number]['id'];

// ============================================
// Search API
// ============================================

export const searchApi = {
  /**
   * Unified search across all apps
   */
  async search(
    query: string,
    filters?: SearchFilters,
    skip = 0,
    limit = 20
  ): Promise<SearchResponse> {
    const params: Record<string, any> = {
      q: query,
      skip,
      limit,
    };

    if (filters?.apps?.length) {
      params.apps = filters.apps.join(',');
    }
    if (filters?.file_types?.length) {
      params.file_types = filters.file_types.join(',');
    }
    if (filters?.date_from) {
      params.date_from = filters.date_from.toISOString();
    }
    if (filters?.date_to) {
      params.date_to = filters.date_to.toISOString();
    }
    if (filters?.owner_id) {
      params.owner_id = filters.owner_id;
    }
    if (filters?.shared_with_me) {
      params.shared_with_me = true;
    }

    const response = await api.get('', { params });
    return response.data;
  },

  /**
   * Search specific app
   */
  async searchApp(
    app: SearchableApp,
    query: string,
    options?: {
      date_from?: Date;
      date_to?: Date;
      skip?: number;
      limit?: number;
    }
  ): Promise<SearchResponse> {
    const params: Record<string, any> = {
      q: query,
      skip: options?.skip || 0,
      limit: options?.limit || 20,
    };

    if (options?.date_from) {
      params.date_from = options.date_from.toISOString();
    }
    if (options?.date_to) {
      params.date_to = options.date_to.toISOString();
    }

    const response = await api.get(`/${app}`, { params });
    return response.data;
  },

  /**
   * Get search suggestions
   */
  async getSuggestions(prefix: string, limit = 5): Promise<SuggestionItem[]> {
    const response = await api.get('/suggestions', {
      params: { prefix, limit },
    });
    return response.data;
  },

  /**
   * Get recent items
   */
  async getRecentItems(apps?: string[], limit = 20): Promise<RecentItem[]> {
    const params: Record<string, any> = { limit };
    if (apps?.length) {
      params.apps = apps.join(',');
    }
    const response = await api.get('/recent', { params });
    return response.data;
  },
};

export default searchApi;
