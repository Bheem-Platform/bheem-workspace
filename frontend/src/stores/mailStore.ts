import { create } from 'zustand';
import * as mailApi from '@/lib/mailApi';
import type { Conversation, ConversationsResponse, SearchResponse, ConversationSearchResponse } from '@/lib/mailApi';
import { useCredentialsStore } from './credentialsStore';
import type {
  Email,
  MailFolder,
  ComposeEmail,
  MailSearchParams,
  MailPagination,
} from '@/types/mail';

interface MailState {
  // Data
  folders: MailFolder[];
  emails: Email[];
  selectedEmail: Email | null;
  currentFolder: string;

  // Conversation Threading (Phase 2.1)
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  viewMode: 'list' | 'threaded';  // 'list' = flat emails, 'threaded' = grouped conversations

  // UI State
  isComposeOpen: boolean;
  composeData: Partial<ComposeEmail>;
  searchQuery: string;
  searchParams: MailSearchParams;
  selectedEmails: string[];

  // Pagination
  pagination: MailPagination;
  conversationPagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };

  // Loading states
  loading: {
    folders: boolean;
    emails: boolean;
    email: boolean;
    conversations: boolean;
    conversation: boolean;
    search: boolean;
    send: boolean;
    action: boolean;
  };

  // Error
  error: string | null;

  // Actions
  fetchFolders: () => Promise<void>;
  fetchEmails: (folder?: string, page?: number) => Promise<void>;
  fetchEmail: (messageId: string) => Promise<void>;
  sendEmail: (email: ComposeEmail) => Promise<boolean>;
  moveEmail: (messageId: string, targetFolder: string) => Promise<void>;
  deleteEmail: (messageId: string) => Promise<void>;
  markAsRead: (messageId: string, isRead: boolean) => Promise<void>;
  toggleStar: (messageId: string) => Promise<void>;

  // Conversation Actions (Phase 2.1)
  fetchConversations: (folder?: string, page?: number) => Promise<void>;
  fetchConversation: (threadId: string) => Promise<void>;
  fetchMessageThread: (messageId: string) => Promise<void>;
  selectConversation: (conversation: Conversation | null) => void;
  setViewMode: (mode: 'list' | 'threaded') => void;

  // Search Actions (Phase 2.2)
  searchEmails: (query: string, folder?: string) => Promise<void>;
  searchConversations: (query: string, folder?: string) => Promise<void>;
  clearSearch: () => void;
  isSearchActive: boolean;
  searchResults: Email[];
  searchResultsCount: number;
  searchByFolder: Record<string, number>;

  // UI Actions
  setCurrentFolder: (folder: string) => void;
  selectEmail: (email: Email | null) => void;
  openCompose: (prefill?: Partial<ComposeEmail>) => void;
  closeCompose: () => void;
  updateComposeData: (data: Partial<ComposeEmail>) => void;
  setSearchQuery: (query: string) => void;
  selectMultipleEmails: (ids: string[]) => void;
  toggleEmailSelection: (id: string) => void;
  clearSelection: () => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  folders: [],
  emails: [],
  selectedEmail: null,
  currentFolder: 'INBOX',
  // Conversation Threading
  conversations: [],
  selectedConversation: null,
  viewMode: 'threaded' as const,  // Default to threaded view
  // Search (Phase 2.2)
  isSearchActive: false,
  searchResults: [] as Email[],
  searchResultsCount: 0,
  searchByFolder: {} as Record<string, number>,
  // UI State
  isComposeOpen: false,
  composeData: {},
  searchQuery: '',
  searchParams: {},
  selectedEmails: [],
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false,
  },
  conversationPagination: {
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false,
  },
  loading: {
    folders: false,
    emails: false,
    email: false,
    conversations: false,
    conversation: false,
    search: false,
    send: false,
    action: false,
  },
  error: null,
};

/**
 * Check if mail session is valid before API calls.
 * Returns true if authenticated, false otherwise.
 */
function checkSession(): boolean {
  const { isMailAuthenticated, isSessionValid } = useCredentialsStore.getState();
  return isMailAuthenticated && isSessionValid();
}

export const useMailStore = create<MailState>((set, get) => ({
  ...initialState,

  // ===========================================
  // Fetch folders (session-based)
  // ===========================================
  fetchFolders: async () => {
    if (!checkSession()) {
      set({ error: 'Mail session expired. Please login again.' });
      return;
    }

    set((state) => ({ loading: { ...state.loading, folders: true }, error: null }));

    try {
      const response = await mailApi.getFolders();
      const folderNames = response.folders || [];

      // Map to MailFolder type with defaults
      const mappedFolders: MailFolder[] = folderNames.map((name: string) => ({
        id: name,
        name: name,
        path: name,
        type: getFolderType(name),
        unreadCount: 0,
        totalCount: 0,
        isSystem: isSystemFolder(name),
      }));

      set({ folders: mappedFolders });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to fetch folders';

      // Check if it's a session error
      if (error.response?.status === 401) {
        set({ error: 'Mail session expired. Please login again.' });
        useCredentialsStore.getState().destroyMailSession();
      } else {
        set({ error: message });
      }
    } finally {
      set((state) => ({ loading: { ...state.loading, folders: false } }));
    }
  },

  // ===========================================
  // Fetch emails (session-based)
  // ===========================================
  fetchEmails: async (folder?: string, page: number = 1) => {
    if (!checkSession()) {
      set({ error: 'Mail session expired. Please login again.' });
      return;
    }

    const targetFolder = folder || get().currentFolder;
    set((state) => ({
      loading: { ...state.loading, emails: true },
      error: null,
      currentFolder: targetFolder,
    }));

    try {
      const response = await mailApi.getMessages(targetFolder, page, 50);

      const emails: Email[] = (response.messages || response.emails || []).map((e: any) => ({
        id: e.id || e.message_id,
        messageId: e.message_id || e.id,
        from: parseEmailAddress(e.from),
        to: Array.isArray(e.to) ? e.to.map(parseEmailAddress) : [parseEmailAddress(e.to)],
        cc: e.cc ? (Array.isArray(e.cc) ? e.cc.map(parseEmailAddress) : [parseEmailAddress(e.cc)]) : [],
        subject: e.subject || '(No Subject)',
        body: e.body || e.body_text || e.preview || '',
        bodyHtml: e.body_html || e.body,
        date: e.date || e.received_date || new Date().toISOString(),
        isRead: e.is_read ?? e.read ?? false,
        isStarred: e.is_starred ?? false,
        isFlagged: e.is_flagged ?? false,
        hasAttachments: e.has_attachments ?? (e.attachments?.length > 0),
        attachments: e.attachments || [],
        folder: targetFolder,
        labels: e.labels || [],
      }));

      set({
        emails,
        pagination: {
          page,
          limit: 50,
          total: response.total || response.count || emails.length,
          hasMore: response.hasMore ?? emails.length >= 50,
        },
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to fetch emails';

      if (error.response?.status === 401) {
        set({ error: 'Mail session expired. Please login again.' });
        useCredentialsStore.getState().destroyMailSession();
      } else {
        set({ error: message });
      }
    } finally {
      set((state) => ({ loading: { ...state.loading, emails: false } }));
    }
  },

  // ===========================================
  // Fetch single email (session-based)
  // ===========================================
  fetchEmail: async (messageId: string) => {
    if (!checkSession()) return;

    set((state) => ({ loading: { ...state.loading, email: true } }));

    try {
      const rawEmail: any = await mailApi.getMessage(messageId, get().currentFolder);

      const parsedEmail: Email = {
        id: rawEmail.id || messageId,
        messageId: rawEmail.message_id || rawEmail.messageId || messageId,
        from: parseEmailAddress(rawEmail.from),
        to: Array.isArray(rawEmail.to) ? rawEmail.to.map(parseEmailAddress) : [parseEmailAddress(rawEmail.to)],
        cc: rawEmail.cc ? (Array.isArray(rawEmail.cc) ? rawEmail.cc.map(parseEmailAddress) : [parseEmailAddress(rawEmail.cc)]) : [],
        subject: rawEmail.subject || '(No Subject)',
        body: rawEmail.body_text || rawEmail.bodyText || rawEmail.body || '',
        bodyHtml: rawEmail.body_html || rawEmail.bodyHtml || '',
        date: rawEmail.date || new Date().toISOString(),
        isRead: true,
        isStarred: rawEmail.is_starred ?? rawEmail.isStarred ?? false,
        isFlagged: rawEmail.is_flagged ?? rawEmail.isFlagged ?? false,
        hasAttachments: (rawEmail.attachments?.length || 0) > 0,
        attachments: rawEmail.attachments || [],
        folder: get().currentFolder,
        labels: [],
      };

      set({ selectedEmail: parsedEmail });

      // Mark as read if not already
      if (!parsedEmail.isRead) {
        get().markAsRead(messageId, true);
      }
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch email' });
    } finally {
      set((state) => ({ loading: { ...state.loading, email: false } }));
    }
  },

  // ===========================================
  // Send email (session-based)
  // ===========================================
  sendEmail: async (email: ComposeEmail) => {
    if (!checkSession()) {
      set({ error: 'Mail session expired. Please login again.' });
      return false;
    }

    set((state) => ({ loading: { ...state.loading, send: true }, error: null }));

    try {
      await mailApi.sendEmail({
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        isHtml: email.isHtml,
        inReplyTo: email.inReplyTo,
      });

      set({ isComposeOpen: false, composeData: {} });
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to send email' });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, send: false } }));
    }
  },

  // ===========================================
  // Move email (session-based)
  // ===========================================
  moveEmail: async (messageId: string, targetFolder: string) => {
    if (!checkSession()) return;

    const { currentFolder, emails } = get();
    set((state) => ({ loading: { ...state.loading, action: true } }));

    try {
      await mailApi.moveEmail(messageId, currentFolder, targetFolder);

      // Remove from current list
      set({
        emails: emails.filter((e) => e.id !== messageId),
        selectedEmail: get().selectedEmail?.id === messageId ? null : get().selectedEmail,
      });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to move email' });
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  // ===========================================
  // Delete email (session-based)
  // ===========================================
  deleteEmail: async (messageId: string) => {
    if (!checkSession()) return;

    set((state) => ({ loading: { ...state.loading, action: true } }));

    try {
      await mailApi.deleteEmail(messageId, get().currentFolder);

      const { emails, selectedEmail } = get();
      set({
        emails: emails.filter((e) => e.id !== messageId),
        selectedEmail: selectedEmail?.id === messageId ? null : selectedEmail,
      });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to delete email' });
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  // ===========================================
  // Mark as read/unread (session-based)
  // ===========================================
  markAsRead: async (messageId: string, isRead: boolean) => {
    if (!checkSession()) return;

    try {
      await mailApi.markAsRead(messageId, isRead);

      // Update local state
      set((state) => ({
        emails: state.emails.map((e) =>
          e.id === messageId ? { ...e, isRead } : e
        ),
        selectedEmail:
          state.selectedEmail?.id === messageId
            ? { ...state.selectedEmail, isRead }
            : state.selectedEmail,
      }));
    } catch (error) {
      // Silent fail for read status
      console.error('Failed to mark as read:', error);
    }
  },

  // ===========================================
  // Toggle star (session-based)
  // ===========================================
  toggleStar: async (messageId: string) => {
    if (!checkSession()) return;

    const email = get().emails.find((e) => e.id === messageId);
    if (!email) return;

    const newStarred = !email.isStarred;

    // Optimistic update
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === messageId ? { ...e, isStarred: newStarred } : e
      ),
    }));

    try {
      await mailApi.toggleStar(messageId, newStarred);
    } catch (error) {
      // Revert on failure
      set((state) => ({
        emails: state.emails.map((e) =>
          e.id === messageId ? { ...e, isStarred: !newStarred } : e
        ),
      }));
    }
  },

  // ===========================================
  // Conversation Threading (Phase 2.1)
  // ===========================================
  fetchConversations: async (folder?: string, page: number = 1) => {
    if (!checkSession()) {
      set({ error: 'Mail session expired. Please login again.' });
      return;
    }

    const targetFolder = folder || get().currentFolder;
    set((state) => ({
      loading: { ...state.loading, conversations: true },
      error: null,
      currentFolder: targetFolder,
    }));

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
      const message = error.response?.data?.detail || 'Failed to fetch conversations';

      if (error.response?.status === 401) {
        set({ error: 'Mail session expired. Please login again.' });
        useCredentialsStore.getState().destroyMailSession();
      } else {
        set({ error: message });
      }
    } finally {
      set((state) => ({ loading: { ...state.loading, conversations: false } }));
    }
  },

  fetchConversation: async (threadId: string) => {
    if (!checkSession()) return;

    set((state) => ({ loading: { ...state.loading, conversation: true } }));

    try {
      const conversation = await mailApi.getConversation(threadId, get().currentFolder);
      set({ selectedConversation: conversation });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch conversation' });
    } finally {
      set((state) => ({ loading: { ...state.loading, conversation: false } }));
    }
  },

  fetchMessageThread: async (messageId: string) => {
    if (!checkSession()) return;

    set((state) => ({ loading: { ...state.loading, conversation: true } }));

    try {
      const thread = await mailApi.getMessageThread(messageId, get().currentFolder);

      // Convert to Conversation format
      const conversation: Conversation = {
        thread_id: thread.thread_id,
        subject: thread.messages[0]?.subject || '(No Subject)',
        message_count: thread.message_count,
        participants: [],
        latest_date: thread.messages[thread.messages.length - 1]?.date || '',
        oldest_date: thread.messages[0]?.date || '',
        preview: (thread.messages[thread.messages.length - 1] as any)?.preview || thread.messages[thread.messages.length - 1]?.body?.slice(0, 100) || '',
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

  selectConversation: (conversation: Conversation | null) => {
    set({ selectedConversation: conversation });
  },

  setViewMode: (mode: 'list' | 'threaded') => {
    set({ viewMode: mode });
    // Refresh data when switching modes
    if (mode === 'threaded') {
      get().fetchConversations();
    } else {
      get().fetchEmails();
    }
  },

  // ===========================================
  // Search Actions (Phase 2.2)
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
      const message = error.response?.data?.detail || 'Search failed';
      if (error.response?.status === 401) {
        set({ error: 'Mail session expired. Please login again.' });
        useCredentialsStore.getState().destroyMailSession();
      } else {
        set({ error: message });
      }
    } finally {
      set((state) => ({ loading: { ...state.loading, search: false } }));
    }
  },

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

      set({
        conversations: response.conversations || [],
        searchResultsCount: response.conversation_count || 0,
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Search failed';
      if (error.response?.status === 401) {
        set({ error: 'Mail session expired. Please login again.' });
        useCredentialsStore.getState().destroyMailSession();
      } else {
        set({ error: message });
      }
    } finally {
      set((state) => ({ loading: { ...state.loading, search: false } }));
    }
  },

  clearSearch: () => {
    const { viewMode } = get();
    set({
      isSearchActive: false,
      searchQuery: '',
      searchResults: [],
      searchResultsCount: 0,
      searchByFolder: {},
    });

    // Refresh the current view
    if (viewMode === 'threaded') {
      get().fetchConversations();
    } else {
      get().fetchEmails();
    }
  },

  // ===========================================
  // UI Actions
  // ===========================================
  setCurrentFolder: (folder: string) => {
    const { viewMode } = get();
    set({ currentFolder: folder, selectedEmail: null, selectedConversation: null });

    // Fetch based on current view mode
    if (viewMode === 'threaded') {
      get().fetchConversations(folder);
    } else {
      get().fetchEmails(folder);
    }
  },

  selectEmail: (email: Email | null) => {
    set({ selectedEmail: email });
    if (email && !email.isRead) {
      get().markAsRead(email.id, true);
    }
  },

  openCompose: (prefill?: Partial<ComposeEmail>) => {
    set({
      isComposeOpen: true,
      composeData: prefill || {},
    });
  },

  closeCompose: () => {
    set({ isComposeOpen: false, composeData: {} });
  },

  updateComposeData: (data: Partial<ComposeEmail>) => {
    set((state) => ({
      composeData: { ...state.composeData, ...data },
    }));
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  selectMultipleEmails: (ids: string[]) => {
    set({ selectedEmails: ids });
  },

  toggleEmailSelection: (id: string) => {
    set((state) => ({
      selectedEmails: state.selectedEmails.includes(id)
        ? state.selectedEmails.filter((i) => i !== id)
        : [...state.selectedEmails, id],
    }));
  },

  clearSelection: () => {
    set({ selectedEmails: [] });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));

// ===========================================
// Helper functions
// ===========================================

function getFolderType(name: string): MailFolder['type'] {
  const lower = name.toLowerCase();
  if (lower === 'inbox') return 'inbox';
  if (lower === 'sent' || lower.includes('sent')) return 'sent';
  if (lower === 'drafts' || lower.includes('draft')) return 'drafts';
  if (lower === 'spam' || lower === 'junk') return 'spam';
  if (lower === 'trash' || lower.includes('deleted')) return 'trash';
  if (lower === 'archive') return 'archive';
  return 'custom';
}

function isSystemFolder(name: string): boolean {
  const systemFolders = ['inbox', 'sent', 'drafts', 'spam', 'junk', 'trash', 'archive'];
  return systemFolders.includes(name.toLowerCase());
}

function parseEmailAddress(input: any): { name: string; email: string } {
  if (!input) return { name: '', email: '' };

  if (typeof input === 'object' && input.email) {
    return { name: input.name || '', email: input.email };
  }

  if (typeof input === 'string') {
    const match = input.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: '', email: input.trim() };
  }

  return { name: '', email: '' };
}

// ===========================================
// Hooks for common operations
// ===========================================

export function useReplyToEmail(email: Email) {
  const { openCompose } = useMailStore();
  const { mailSession } = useCredentialsStore();

  return () => {
    openCompose({
      to: [email.from.email],
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      replyType: 'reply',
      originalEmail: email,
    });
  };
}

export function useReplyAllToEmail(email: Email) {
  const { openCompose } = useMailStore();
  const { mailSession } = useCredentialsStore();

  return () => {
    const currentEmail = mailSession?.email;
    const allRecipients = [
      email.from.email,
      ...email.to.map((t) => t.email),
    ].filter((e) => e !== currentEmail);

    openCompose({
      to: allRecipients,
      cc: email.cc?.map((c) => c.email),
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      replyType: 'replyAll',
      originalEmail: email,
    });
  };
}

export function useForwardEmail(email: Email) {
  const { openCompose } = useMailStore();

  return () => {
    openCompose({
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n---------- Forwarded message ---------\nFrom: ${email.from.name} <${email.from.email}>\nDate: ${new Date(email.date).toLocaleString()}\nSubject: ${email.subject}\n\n${email.body}`,
      replyType: 'forward',
      originalEmail: email,
    });
  };
}
