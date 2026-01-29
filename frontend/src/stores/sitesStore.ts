/**
 * Bheem Sites - State Management
 *
 * Zustand store for Sites/Wiki functionality.
 * Phase 5: Bheem Sites/Wiki
 */

import { create } from 'zustand';
import { sitesApi, Site, SitePage, PageTreeNode, Collaborator, Comment, PageVersion, SiteTemplate } from '@/lib/sitesApi';

interface SitesState {
  // Sites
  sites: Site[];
  currentSite: Site | null;

  // Pages
  pages: SitePage[];
  pageTree: PageTreeNode[];
  currentPage: SitePage | null;
  pageVersions: PageVersion[];

  // Collaborators
  collaborators: Collaborator[];

  // Comments
  comments: Comment[];

  // Templates
  templates: SiteTemplate[];

  // UI State
  loading: {
    sites: boolean;
    pages: boolean;
    page: boolean;
    saving: boolean;
  };
  error: string | null;
  editMode: boolean;
  sidebarOpen: boolean;

  // Site actions
  fetchSites: () => Promise<void>;
  fetchSite: (siteId: string) => Promise<void>;
  fetchSiteBySlug: (slug: string) => Promise<void>;
  createSite: (data: { name: string; description?: string; template_id?: string }) => Promise<Site | null>;
  updateSite: (siteId: string, data: Partial<Site>) => Promise<void>;
  publishSite: (siteId: string) => Promise<void>;
  deleteSite: (siteId: string) => Promise<void>;

  // Page actions
  fetchPages: (siteId: string) => Promise<void>;
  fetchPageTree: (siteId: string) => Promise<void>;
  fetchPage: (siteId: string, pageId: string) => Promise<void>;
  fetchPageByPath: (siteId: string, path: string) => Promise<void>;
  createPage: (siteId: string, data: { title: string; content?: string; parent_id?: string }) => Promise<SitePage | null>;
  updatePage: (siteId: string, pageId: string, data: Partial<SitePage>) => Promise<void>;
  publishPage: (siteId: string, pageId: string) => Promise<void>;
  deletePage: (siteId: string, pageId: string) => Promise<void>;

  // Version actions
  fetchPageVersions: (siteId: string, pageId: string) => Promise<void>;
  restoreVersion: (siteId: string, pageId: string, versionId: string) => Promise<void>;

  // Collaborator actions
  fetchCollaborators: (siteId: string) => Promise<void>;
  addCollaborator: (siteId: string, userId: string, role: string) => Promise<void>;
  removeCollaborator: (siteId: string, userId: string) => Promise<void>;

  // Comment actions
  fetchComments: (siteId: string, pageId: string) => Promise<void>;
  addComment: (siteId: string, pageId: string, content: string, authorName: string) => Promise<void>;

  // Template actions
  fetchTemplates: () => Promise<void>;

  // UI actions
  setEditMode: (mode: boolean) => void;
  toggleSidebar: () => void;
  clearError: () => void;
  clearCurrentSite: () => void;
  clearCurrentPage: () => void;
}

export const useSitesStore = create<SitesState>((set, get) => ({
  // Initial state
  sites: [],
  currentSite: null,
  pages: [],
  pageTree: [],
  currentPage: null,
  pageVersions: [],
  collaborators: [],
  comments: [],
  templates: [],
  loading: {
    sites: false,
    pages: false,
    page: false,
    saving: false,
  },
  error: null,
  editMode: false,
  sidebarOpen: true,

  // Site actions
  fetchSites: async () => {
    set({ loading: { ...get().loading, sites: true }, error: null });
    try {
      const sites = await sitesApi.listSites();
      set({ sites, loading: { ...get().loading, sites: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch sites',
        loading: { ...get().loading, sites: false }
      });
    }
  },

  fetchSite: async (siteId: string) => {
    set({ loading: { ...get().loading, sites: true }, error: null });
    try {
      const site = await sitesApi.getSite(siteId);
      set({ currentSite: site, loading: { ...get().loading, sites: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch site',
        loading: { ...get().loading, sites: false }
      });
    }
  },

  fetchSiteBySlug: async (slug: string) => {
    set({ loading: { ...get().loading, sites: true }, error: null });
    try {
      const site = await sitesApi.getSiteBySlug(slug);
      set({ currentSite: site, loading: { ...get().loading, sites: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch site',
        loading: { ...get().loading, sites: false }
      });
    }
  },

  createSite: async (data) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      const site = await sitesApi.createSite(data);
      set({
        sites: [site, ...get().sites],
        currentSite: site,
        loading: { ...get().loading, saving: false }
      });
      return site;
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to create site',
        loading: { ...get().loading, saving: false }
      });
      return null;
    }
  },

  updateSite: async (siteId, data) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      const site = await sitesApi.updateSite(siteId, data);
      set({
        currentSite: site,
        sites: get().sites.map(s => s.id === siteId ? site : s),
        loading: { ...get().loading, saving: false }
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to update site',
        loading: { ...get().loading, saving: false }
      });
    }
  },

  publishSite: async (siteId) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      await sitesApi.publishSite(siteId);
      const { currentSite, sites } = get();
      if (currentSite?.id === siteId) {
        set({ currentSite: { ...currentSite, is_published: true } });
      }
      set({
        sites: sites.map(s => s.id === siteId ? { ...s, is_published: true } : s),
        loading: { ...get().loading, saving: false }
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to publish site',
        loading: { ...get().loading, saving: false }
      });
    }
  },

  deleteSite: async (siteId) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      await sitesApi.deleteSite(siteId);
      set({
        sites: get().sites.filter(s => s.id !== siteId),
        currentSite: get().currentSite?.id === siteId ? null : get().currentSite,
        loading: { ...get().loading, saving: false }
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to delete site',
        loading: { ...get().loading, saving: false }
      });
    }
  },

  // Page actions
  fetchPages: async (siteId) => {
    set({ loading: { ...get().loading, pages: true }, error: null });
    try {
      const pages = await sitesApi.listPages(siteId);
      set({ pages, loading: { ...get().loading, pages: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch pages',
        loading: { ...get().loading, pages: false }
      });
    }
  },

  fetchPageTree: async (siteId) => {
    set({ loading: { ...get().loading, pages: true }, error: null });
    try {
      const pageTree = await sitesApi.getPageTree(siteId);
      set({ pageTree, loading: { ...get().loading, pages: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch page tree',
        loading: { ...get().loading, pages: false }
      });
    }
  },

  fetchPage: async (siteId, pageId) => {
    set({ loading: { ...get().loading, page: true }, error: null });
    try {
      const page = await sitesApi.getPage(siteId, pageId);
      set({ currentPage: page, loading: { ...get().loading, page: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch page',
        loading: { ...get().loading, page: false }
      });
    }
  },

  fetchPageByPath: async (siteId, path) => {
    set({ loading: { ...get().loading, page: true }, error: null });
    try {
      const page = await sitesApi.getPageByPath(siteId, path);
      set({ currentPage: page, loading: { ...get().loading, page: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch page',
        loading: { ...get().loading, page: false }
      });
    }
  },

  createPage: async (siteId, data) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      const page = await sitesApi.createPage(siteId, data);
      set({
        pages: [...get().pages, page],
        currentPage: page,
        loading: { ...get().loading, saving: false }
      });
      // Refresh tree
      get().fetchPageTree(siteId);
      return page;
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to create page',
        loading: { ...get().loading, saving: false }
      });
      return null;
    }
  },

  updatePage: async (siteId, pageId, data) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      const page = await sitesApi.updatePage(siteId, pageId, data);
      set({
        currentPage: page,
        pages: get().pages.map(p => p.id === pageId ? page : p),
        loading: { ...get().loading, saving: false }
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to update page',
        loading: { ...get().loading, saving: false }
      });
    }
  },

  publishPage: async (siteId, pageId) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      await sitesApi.publishPage(siteId, pageId);
      const { currentPage, pages } = get();
      if (currentPage?.id === pageId) {
        set({ currentPage: { ...currentPage, is_draft: false } });
      }
      set({
        pages: pages.map(p => p.id === pageId ? { ...p, is_draft: false } : p),
        loading: { ...get().loading, saving: false }
      });
      get().fetchPageTree(siteId);
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to publish page',
        loading: { ...get().loading, saving: false }
      });
    }
  },

  deletePage: async (siteId, pageId) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      await sitesApi.deletePage(siteId, pageId);
      set({
        pages: get().pages.filter(p => p.id !== pageId),
        currentPage: get().currentPage?.id === pageId ? null : get().currentPage,
        loading: { ...get().loading, saving: false }
      });
      get().fetchPageTree(siteId);
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to delete page',
        loading: { ...get().loading, saving: false }
      });
    }
  },

  // Version actions
  fetchPageVersions: async (siteId, pageId) => {
    try {
      const versions = await sitesApi.listPageVersions(siteId, pageId);
      set({ pageVersions: versions });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch versions' });
    }
  },

  restoreVersion: async (siteId, pageId, versionId) => {
    set({ loading: { ...get().loading, saving: true }, error: null });
    try {
      await sitesApi.restoreVersion(siteId, pageId, versionId);
      await get().fetchPage(siteId, pageId);
      await get().fetchPageVersions(siteId, pageId);
      set({ loading: { ...get().loading, saving: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to restore version',
        loading: { ...get().loading, saving: false }
      });
    }
  },

  // Collaborator actions
  fetchCollaborators: async (siteId) => {
    try {
      const collaborators = await sitesApi.listCollaborators(siteId);
      set({ collaborators });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch collaborators' });
    }
  },

  addCollaborator: async (siteId, userId, role) => {
    try {
      const collaborator = await sitesApi.addCollaborator(siteId, { user_id: userId, role });
      set({ collaborators: [...get().collaborators, collaborator] });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to add collaborator' });
    }
  },

  removeCollaborator: async (siteId, userId) => {
    try {
      await sitesApi.removeCollaborator(siteId, userId);
      set({ collaborators: get().collaborators.filter(c => c.user_id !== userId) });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to remove collaborator' });
    }
  },

  // Comment actions
  fetchComments: async (siteId, pageId) => {
    try {
      const comments = await sitesApi.listComments(siteId, pageId);
      set({ comments });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch comments' });
    }
  },

  addComment: async (siteId, pageId, content, authorName) => {
    try {
      const comment = await sitesApi.addComment(siteId, pageId, { content, author_name: authorName });
      set({ comments: [...get().comments, comment] });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to add comment' });
    }
  },

  // Template actions
  fetchTemplates: async () => {
    try {
      const templates = await sitesApi.listTemplates();
      set({ templates });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch templates' });
    }
  },

  // UI actions
  setEditMode: (mode) => set({ editMode: mode }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  clearError: () => set({ error: null }),
  clearCurrentSite: () => set({ currentSite: null, pages: [], pageTree: [], currentPage: null }),
  clearCurrentPage: () => set({ currentPage: null }),
}));

export default useSitesStore;
