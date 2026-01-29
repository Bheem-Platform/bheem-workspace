/**
 * Mail Search Store - Email and conversation search
 */
import { create } from 'zustand';
import * as mailApi from '@/lib/mailApi';
import { checkSession, handleApiError, parseEmailAddress } from './mailHelpers';
import type { Email, MailSearchParams } from './mailTypes';
import { useMailInboxStore } from './mailInboxStore';
import { useMailConversationStore } from './mailConversationStore';

interface MailSearchState {
  // Search state
  isSearchActive: boolean;
  searchQuery: string;
  searchParams: MailSearchParams;
  searchResults: Email[];
  searchResultsCount: number;
  searchByFolder: Record<string, number>;

  // Loading
  loading: {
    search: boolean;
  };

  // Error
  error: string | null;

  // Actions
  searchEmails: (query: string, folder?: string) => Promise<void>;
  searchConversations: (query: string, folder?: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSearchParams: (params: MailSearchParams) => void;
  clearSearch: () => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  isSearchActive: false,
  searchQuery: '',
  searchParams: {} as MailSearchParams,
  searchResults: [] as Email[],
  searchResultsCount: 0,
  searchByFolder: {} as Record<string, number>,
  loading: {
    search: false,
  },
  error: null as string | null,
};

export const useMailSearchStore = create<MailSearchState>((set, get) => ({
  ...initialState,

  // ===========================================
  // Search emails
  // ===========================================
  searchEmails: async (query: string, folder?: string) => {
    if (!checkSession()) {
      set({ error: 'Mail session expired. Please login again.' });
      return;
    }

    if (!query.trim()) {
      get().clearSearch();
      return;
    }

    set((state) => ({
      loading: { ...state.loading, search: true },
      error: null,
      searchQuery: query,
      isSearchActive: true,
    }));

    try {
      const response = await mailApi.searchEmails(query, folder || undefined);

      // Parse results into Email format
      const searchResults: Email[] = (response.results || []).map((e: any) => ({
        id: e.id || e.message_id,
        messageId: e.message_id || e.id,
        from: parseEmailAddress(e.from),
        to: Array.isArray(e.to) ? e.to.map(parseEmailAddress) : [parseEmailAddress(e.to)],
        cc: [],
        subject: e.subject || '(No Subject)',
        body: e.preview || '',
        bodyHtml: '',
        date: e.date || '',
        isRead: e.read ?? true,
        isStarred: false,
        isFlagged: false,
        hasAttachments: false,
        attachments: [],
        folder: e.folder || folder || 'INBOX',
        labels: [],
      }));

      set({
        searchResults,
        searchResultsCount: response.count || 0,
        searchByFolder: response.by_folder || {},
      });
    } catch (error: any) {
      set({ error: handleApiError(error) });
    } finally {
      set((state) => ({ loading: { ...state.loading, search: false } }));
    }
  },

  // ===========================================
  // Search conversations
  // ===========================================
  searchConversations: async (query: string, folder?: string) => {
    if (!checkSession()) {
      set({ error: 'Mail session expired. Please login again.' });
      return;
    }

    if (!query.trim()) {
      get().clearSearch();
      return;
    }

    set((state) => ({
      loading: { ...state.loading, search: true },
      error: null,
      searchQuery: query,
      isSearchActive: true,
    }));

    try {
      const response = await mailApi.searchConversations(query, folder || undefined);

      // Update conversation store with results
      useMailConversationStore.setState({
        conversations: response.conversations || [],
      });

      set({
        searchResultsCount: response.conversation_count || 0,
      });
    } catch (error: any) {
      set({ error: handleApiError(error) });
    } finally {
      set((state) => ({ loading: { ...state.loading, search: false } }));
    }
  },

  // ===========================================
  // Set search query
  // ===========================================
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  // ===========================================
  // Set search params
  // ===========================================
  setSearchParams: (params: MailSearchParams) => {
    set({ searchParams: params });
  },

  // ===========================================
  // Clear search
  // ===========================================
  clearSearch: () => {
    const conversationStore = useMailConversationStore.getState();

    set({
      isSearchActive: false,
      searchQuery: '',
      searchResults: [],
      searchResultsCount: 0,
      searchByFolder: {},
    });

    // Refresh the current view
    if (conversationStore.viewMode === 'threaded') {
      conversationStore.fetchConversations();
    } else {
      useMailInboxStore.getState().fetchEmails();
    }
  },

  // ===========================================
  // Clear error
  // ===========================================
  clearError: () => {
    set({ error: null });
  },

  // ===========================================
  // Reset
  // ===========================================
  reset: () => {
    set(initialState);
  },
}));
