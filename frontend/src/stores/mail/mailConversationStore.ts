/**
 * Mail Conversation Store - Email threading and conversations
 */
import { create } from 'zustand';
import * as mailApi from '@/lib/mailApi';
import { checkSession, handleApiError } from './mailHelpers';
import type { Conversation, PaginationState } from './mailTypes';
import { useMailInboxStore } from './mailInboxStore';

interface MailConversationState {
  // Data
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  viewMode: 'list' | 'threaded';

  // Pagination
  conversationPagination: PaginationState;

  // Loading
  loading: {
    conversations: boolean;
    conversation: boolean;
  };

  // Error
  error: string | null;

  // Actions
  fetchConversations: (folder?: string, page?: number) => Promise<void>;
  fetchConversation: (threadId: string) => Promise<void>;
  fetchMessageThread: (messageId: string) => Promise<void>;
  selectConversation: (conversation: Conversation | null) => void;
  setViewMode: (mode: 'list' | 'threaded') => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  conversations: [] as Conversation[],
  selectedConversation: null as Conversation | null,
  viewMode: 'list' as const,
  conversationPagination: {
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false,
  },
  loading: {
    conversations: false,
    conversation: false,
  },
  error: null as string | null,
};

export const useMailConversationStore = create<MailConversationState>((set, get) => ({
  ...initialState,

  // ===========================================
  // Fetch conversations
  // ===========================================
  fetchConversations: async (folder?: string, page: number = 1) => {
    if (!checkSession()) {
      set({ error: 'Mail session expired. Please login again.' });
      return;
    }

    const inboxStore = useMailInboxStore.getState();
    const targetFolder = folder || inboxStore.currentFolder;

    set((state) => ({
      loading: { ...state.loading, conversations: true },
      error: null,
    }));

    // Update folder in inbox store
    if (folder) {
      useMailInboxStore.setState({ currentFolder: targetFolder });
    }

    try {
      const response = await mailApi.getConversations(targetFolder, page, 50);

      set({
        conversations: response.conversations || [],
        conversationPagination: {
          page,
          limit: 50,
          total: response.total_conversations || 0,
          hasMore: (response.conversations?.length || 0) >= 50,
        },
      });
    } catch (error: any) {
      set({ error: handleApiError(error) });
    } finally {
      set((state) => ({ loading: { ...state.loading, conversations: false } }));
    }
  },

  // ===========================================
  // Fetch single conversation
  // ===========================================
  fetchConversation: async (threadId: string) => {
    if (!checkSession()) return;

    set((state) => ({ loading: { ...state.loading, conversation: true } }));

    try {
      const inboxStore = useMailInboxStore.getState();
      const conversation = await mailApi.getConversation(threadId, inboxStore.currentFolder);
      set({ selectedConversation: conversation });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch conversation' });
    } finally {
      set((state) => ({ loading: { ...state.loading, conversation: false } }));
    }
  },

  // ===========================================
  // Fetch message thread
  // ===========================================
  fetchMessageThread: async (messageId: string) => {
    if (!checkSession()) return;

    set((state) => ({ loading: { ...state.loading, conversation: true } }));

    try {
      const inboxStore = useMailInboxStore.getState();
      const thread = await mailApi.getMessageThread(messageId, inboxStore.currentFolder);

      // Convert to Conversation format
      const conversation: Conversation = {
        thread_id: thread.thread_id,
        subject: thread.messages[0]?.subject || '(No Subject)',
        message_count: thread.message_count,
        participants: [],
        latest_date: thread.messages[thread.messages.length - 1]?.date || '',
        oldest_date: thread.messages[0]?.date || '',
        preview: (thread.messages[thread.messages.length - 1] as any)?.preview ||
          thread.messages[thread.messages.length - 1]?.body?.slice(0, 100) || '',
        has_unread: false,
        messages: thread.messages,
      };

      set({ selectedConversation: conversation });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch thread' });
    } finally {
      set((state) => ({ loading: { ...state.loading, conversation: false } }));
    }
  },

  // ===========================================
  // Select conversation
  // ===========================================
  selectConversation: (conversation: Conversation | null) => {
    set({ selectedConversation: conversation });
  },

  // ===========================================
  // Set view mode
  // ===========================================
  setViewMode: (mode: 'list' | 'threaded') => {
    set({ viewMode: mode });

    // Refresh data when switching modes
    if (mode === 'threaded') {
      get().fetchConversations();
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
