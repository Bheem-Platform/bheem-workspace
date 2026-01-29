/**
 * Bheem Sites - API Client
 *
 * Frontend API client for Sites/Wiki functionality.
 * Phase 5: Bheem Sites/Wiki
 */

const API_BASE = '/api/v1/sites';

// Types
export type SiteVisibility = 'private' | 'internal' | 'public';
export type PageType = 'standard' | 'wiki' | 'blog' | 'landing' | 'embed';

export interface Site {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  favicon_url?: string;
  theme_color: string;
  visibility: SiteVisibility;
  allow_comments: boolean;
  allow_search: boolean;
  show_navigation: boolean;
  show_breadcrumbs: boolean;
  navigation?: NavigationItem[];
  owner_id: string;
  is_published: boolean;
  published_at?: string;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface NavigationItem {
  title: string;
  page_id: string;
  children?: NavigationItem[];
}

export interface SitePage {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  page_type: PageType;
  content?: string;
  content_format: string;
  excerpt?: string;
  cover_image_url?: string;
  cover_position?: string;
  parent_id?: string;
  path: string;
  depth: number;
  order: number;
  is_homepage: boolean;
  is_draft: boolean;
  show_title: boolean;
  show_toc: boolean;
  allow_comments: boolean;
  view_count: number;
  author_id: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface PageTreeNode {
  id: string;
  title: string;
  slug: string;
  path: string;
  is_draft: boolean;
  is_homepage: boolean;
  children: PageTreeNode[];
}

export interface Collaborator {
  id: string;
  site_id: string;
  user_id: string;
  role: string;
  can_publish: boolean;
  can_manage_collaborators: boolean;
  added_at: string;
}

export interface Comment {
  id: string;
  page_id: string;
  content: string;
  author_id: string;
  author_name: string;
  parent_id?: string;
  is_resolved: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageVersion {
  id: string;
  page_id: string;
  version_number: number;
  title: string;
  author_id: string;
  created_at: string;
  change_summary?: string;
}

export interface SiteTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  preview_image_url?: string;
  is_system: boolean;
}

// ===========================================
// Helper Functions
// ===========================================

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = `${API_BASE}${endpoint}`;

  if (!params) return url;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================
// Site API
// ============================================

export const sitesApi = {
  // Sites
  async createSite(data: {
    name: string;
    description?: string;
    visibility?: SiteVisibility;
    template_id?: string;
  }): Promise<Site> {
    return apiRequest<Site>(buildUrl(''), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listSites(params?: {
    visibility?: SiteVisibility;
    include_archived?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<Site[]> {
    return apiRequest<Site[]>(buildUrl('', params as Record<string, string | number | boolean | undefined>), {
      method: 'GET',
    });
  },

  async getSite(siteId: string): Promise<Site> {
    return apiRequest<Site>(buildUrl(`/${siteId}`), {
      method: 'GET',
    });
  },

  async getSiteBySlug(slug: string): Promise<Site> {
    return apiRequest<Site>(buildUrl(`/by-slug/${slug}`), {
      method: 'GET',
    });
  },

  async updateSite(siteId: string, data: Partial<Site>): Promise<Site> {
    return apiRequest<Site>(buildUrl(`/${siteId}`), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async publishSite(siteId: string): Promise<void> {
    return apiRequest<void>(buildUrl(`/${siteId}/publish`), {
      method: 'POST',
    });
  },

  async archiveSite(siteId: string): Promise<void> {
    return apiRequest<void>(buildUrl(`/${siteId}/archive`), {
      method: 'POST',
    });
  },

  async deleteSite(siteId: string): Promise<void> {
    return apiRequest<void>(buildUrl(`/${siteId}`), {
      method: 'DELETE',
    });
  },

  // Pages
  async createPage(siteId: string, data: {
    title: string;
    content?: string;
    page_type?: PageType;
    parent_id?: string;
    is_draft?: boolean;
  }): Promise<SitePage> {
    return apiRequest<SitePage>(buildUrl(`/${siteId}/pages`), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listPages(siteId: string, params?: {
    parent_id?: string;
    include_drafts?: boolean;
  }): Promise<SitePage[]> {
    return apiRequest<SitePage[]>(buildUrl(`/${siteId}/pages`, params as Record<string, string | number | boolean | undefined>), {
      method: 'GET',
    });
  },

  async getPageTree(siteId: string): Promise<PageTreeNode[]> {
    return apiRequest<PageTreeNode[]>(buildUrl(`/${siteId}/pages/tree`), {
      method: 'GET',
    });
  },

  async getPage(siteId: string, pageId: string): Promise<SitePage> {
    return apiRequest<SitePage>(buildUrl(`/${siteId}/pages/${pageId}`), {
      method: 'GET',
    });
  },

  async getPageByPath(siteId: string, path: string): Promise<SitePage> {
    return apiRequest<SitePage>(buildUrl(`/${siteId}/pages/by-path/${path}`), {
      method: 'GET',
    });
  },

  async updatePage(
    siteId: string,
    pageId: string,
    data: Partial<SitePage>,
    createVersion = true
  ): Promise<SitePage> {
    return apiRequest<SitePage>(buildUrl(`/${siteId}/pages/${pageId}`, { create_version: createVersion }), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async publishPage(siteId: string, pageId: string): Promise<void> {
    return apiRequest<void>(buildUrl(`/${siteId}/pages/${pageId}/publish`), {
      method: 'POST',
    });
  },

  async movePage(siteId: string, pageId: string, data: {
    parent_id?: string;
    order: number;
  }): Promise<void> {
    return apiRequest<void>(buildUrl(`/${siteId}/pages/${pageId}/move`), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deletePage(siteId: string, pageId: string): Promise<void> {
    return apiRequest<void>(buildUrl(`/${siteId}/pages/${pageId}`), {
      method: 'DELETE',
    });
  },

  // Versions
  async listPageVersions(siteId: string, pageId: string): Promise<PageVersion[]> {
    return apiRequest<PageVersion[]>(buildUrl(`/${siteId}/pages/${pageId}/versions`), {
      method: 'GET',
    });
  },

  async restoreVersion(siteId: string, pageId: string, versionId: string): Promise<void> {
    return apiRequest<void>(buildUrl(`/${siteId}/pages/${pageId}/versions/${versionId}/restore`), {
      method: 'POST',
    });
  },

  // Collaborators
  async listCollaborators(siteId: string): Promise<Collaborator[]> {
    return apiRequest<Collaborator[]>(buildUrl(`/${siteId}/collaborators`), {
      method: 'GET',
    });
  },

  async addCollaborator(siteId: string, data: {
    user_id: string;
    role?: string;
  }): Promise<Collaborator> {
    return apiRequest<Collaborator>(buildUrl(`/${siteId}/collaborators`), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async removeCollaborator(siteId: string, userId: string): Promise<void> {
    return apiRequest<void>(buildUrl(`/${siteId}/collaborators/${userId}`), {
      method: 'DELETE',
    });
  },

  // Comments
  async listComments(siteId: string, pageId: string): Promise<Comment[]> {
    return apiRequest<Comment[]>(buildUrl(`/${siteId}/pages/${pageId}/comments`), {
      method: 'GET',
    });
  },

  async addComment(siteId: string, pageId: string, data: {
    content: string;
    author_name: string;
    parent_id?: string;
  }): Promise<Comment> {
    return apiRequest<Comment>(buildUrl(`/${siteId}/pages/${pageId}/comments`), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Templates
  async listTemplates(category?: string): Promise<SiteTemplate[]> {
    return apiRequest<SiteTemplate[]>(buildUrl('/templates', { category }), {
      method: 'GET',
    });
  },
};

export default sitesApi;
