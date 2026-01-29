/**
 * Bheem Workspace - Search Store
 *
 * Zustand store for unified search state management.
 * Phase 8: Search Enhancement
 */

import { create } from 'zustand';
import {
  searchApi,
  SearchResultItem,
  SuggestionItem,
  RecentItem,
  SearchFilters,
  SearchableApp,
} from '@/lib/searchApi';

interface SearchState {
  // Search state
  query: string;
  results: SearchResultItem[];
  total: number;
  suggestions: SuggestionItem[];
  recentItems: RecentItem[];

  // Filters
  filters: SearchFilters;
  selectedApps: SearchableApp[];

  // UI state
  loading: boolean;
  loadingSuggestions: boolean;
  error: string | null;
  searchOpen: boolean;
  hasSearched: boolean;

  // Pagination
  skip: number;
  limit: number;
  hasMore: boolean;

  // Actions
  setQuery: (query: string) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  toggleApp: (app: SearchableApp) => void;
  setSelectedApps: (apps: SearchableApp[]) => void;

  // Search actions
  search: () => Promise<void>;
  loadMore: () => Promise<void>;
  fetchSuggestions: (prefix: string) => Promise<void>;
  fetchRecentItems: () => Promise<void>;

  // UI actions
  openSearch: () => void;
  closeSearch: () => void;
  clearSearch: () => void;
  clearError: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  // Initial state
  query: '',
  results: [],
  total: 0,
  suggestions: [],
  recentItems: [],
  filters: {},
  selectedApps: [],
  loading: false,
  loadingSuggestions: false,
  error: null,
  searchOpen: false,
  hasSearched: false,
  skip: 0,
  limit: 20,
  hasMore: false,

  // Setters
  setQuery: (query) => set({ query }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  toggleApp: (app) =>
    set((state) => {
      const selected = state.selectedApps.includes(app)
        ? state.selectedApps.filter((a) => a !== app)
        : [...state.selectedApps, app];
      return { selectedApps: selected };
    }),

  setSelectedApps: (apps) => set({ selectedApps: apps }),

  // Search actions
  search: async () => {
    const { query, selectedApps, filters, limit } = get();

    if (!query.trim()) {
      set({ results: [], total: 0, hasSearched: false });
      return;
    }

    set({ loading: true, error: null, skip: 0 });

    try {
      const searchFilters: SearchFilters = {
        ...filters,
        apps: selectedApps.length > 0 ? selectedApps : undefined,
      };

      const response = await searchApi.search(query, searchFilters, 0, limit);

      set({
        results: response.results,
        total: response.total,
        hasSearched: true,
        loading: false,
        skip: limit,
        hasMore: response.results.length < response.total,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Search failed',
        loading: false,
        hasSearched: true,
      });
    }
  },

  loadMore: async () => {
    const { query, selectedApps, filters, skip, limit, results, loading, hasMore } =
      get();

    if (loading || !hasMore || !query.trim()) return;

    set({ loading: true });

    try {
      const searchFilters: SearchFilters = {
        ...filters,
        apps: selectedApps.length > 0 ? selectedApps : undefined,
      };

      const response = await searchApi.search(query, searchFilters, skip, limit);

      set({
        results: [...results, ...response.results],
        loading: false,
        skip: skip + limit,
        hasMore: results.length + response.results.length < response.total,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to load more results',
        loading: false,
      });
    }
  },

  fetchSuggestions: async (prefix) => {
    if (prefix.length < 2) {
      set({ suggestions: [] });
      return;
    }

    set({ loadingSuggestions: true });

    try {
      const suggestions = await searchApi.getSuggestions(prefix);
      set({ suggestions, loadingSuggestions: false });
    } catch (error) {
      set({ suggestions: [], loadingSuggestions: false });
    }
  },

  fetchRecentItems: async () => {
    try {
      const recentItems = await searchApi.getRecentItems();
      set({ recentItems });
    } catch (error) {
      // Silently fail for recent items
    }
  },

  // UI actions
  openSearch: () => {
    set({ searchOpen: true });
    get().fetchRecentItems();
  },

  closeSearch: () => set({ searchOpen: false }),

  clearSearch: () =>
    set({
      query: '',
      results: [],
      total: 0,
      suggestions: [],
      hasSearched: false,
      skip: 0,
      hasMore: false,
      selectedApps: [],
      filters: {},
    }),

  clearError: () => set({ error: null }),
}));

export default useSearchStore;
