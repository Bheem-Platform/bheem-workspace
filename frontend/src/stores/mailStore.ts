import { create } from 'zustand';
import * as mailApi from '@/lib/mailApi';
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

  // UI State
  isComposeOpen: boolean;
  composeData: Partial<ComposeEmail>;
  searchQuery: string;
  searchParams: MailSearchParams;
  selectedEmails: string[];

  // Pagination
  pagination: MailPagination;

  // Loading states
  loading: {
    folders: boolean;
    emails: boolean;
    email: boolean;
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
  loading: {
    folders: false,
    emails: false,
    email: false,
    send: false,
    action: false,
  },
  error: null,
};

export const useMailStore = create<MailState>((set, get) => ({
  ...initialState,

  // Fetch folders
  fetchFolders: async () => {
    const credentials = useCredentialsStore.getState().getMailCredentials();
    if (!credentials) {
      set({ error: 'Mail credentials not found. Please login.' });
      return;
    }

    set((state) => ({ loading: { ...state.loading, folders: true }, error: null }));

    try {
      const folders = await mailApi.getFolders(credentials.email, credentials.password);

      // Map to MailFolder type with defaults
      const mappedFolders: MailFolder[] = folders.map((f: any) => ({
        id: f.id || f.name,
        name: f.name,
        path: f.path || f.name,
        type: getFolderType(f.name),
        unreadCount: f.unread_count || 0,
        totalCount: f.total_count || 0,
        isSystem: isSystemFolder(f.name),
      }));

      set({ folders: mappedFolders });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch folders' });
    } finally {
      set((state) => ({ loading: { ...state.loading, folders: false } }));
    }
  },

  // Fetch emails
  fetchEmails: async (folder?: string, page: number = 1) => {
    const credentials = useCredentialsStore.getState().getMailCredentials();
    if (!credentials) {
      set({ error: 'Mail credentials not found. Please login.' });
      return;
    }

    const targetFolder = folder || get().currentFolder;
    set((state) => ({
      loading: { ...state.loading, emails: true },
      error: null,
      currentFolder: targetFolder,
    }));

    try {
      const response = await mailApi.getMessages(
        credentials.email,
        credentials.password,
        targetFolder,
        page,
        50
      );

      const emails: Email[] = (response.emails || response || []).map((e: any) => ({
        id: e.id || e.message_id,
        messageId: e.message_id || e.id,
        from: e.from || { name: '', email: '' },
        to: e.to || [],
        cc: e.cc || [],
        subject: e.subject || '(No Subject)',
        body: e.body || e.body_text || '',
        bodyHtml: e.body_html || e.body,
        date: e.date || e.received_date || new Date().toISOString(),
        isRead: e.is_read ?? false,
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
          total: response.total || emails.length,
          hasMore: response.hasMore ?? emails.length >= 50,
        },
      });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch emails' });
    } finally {
      set((state) => ({ loading: { ...state.loading, emails: false } }));
    }
  },

  // Fetch single email
  fetchEmail: async (messageId: string) => {
    const credentials = useCredentialsStore.getState().getMailCredentials();
    if (!credentials) return;

    set((state) => ({ loading: { ...state.loading, email: true } }));

    try {
      const email = await mailApi.getMessage(
        credentials.email,
        credentials.password,
        messageId
      );

      set({ selectedEmail: email });

      // Mark as read if not already
      if (!email.isRead) {
        get().markAsRead(messageId, true);
      }
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch email' });
    } finally {
      set((state) => ({ loading: { ...state.loading, email: false } }));
    }
  },

  // Send email
  sendEmail: async (email: ComposeEmail) => {
    const credentials = useCredentialsStore.getState().getMailCredentials();
    if (!credentials) {
      set({ error: 'Mail credentials not found. Please login.' });
      return false;
    }

    set((state) => ({ loading: { ...state.loading, send: true }, error: null }));

    try {
      await mailApi.sendEmail(credentials.email, credentials.password, {
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        isHtml: email.isHtml,
        attachments: email.attachments,
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

  // Move email
  moveEmail: async (messageId: string, targetFolder: string) => {
    const credentials = useCredentialsStore.getState().getMailCredentials();
    if (!credentials) return;

    const { currentFolder, emails } = get();
    set((state) => ({ loading: { ...state.loading, action: true } }));

    try {
      await mailApi.moveEmail(
        credentials.email,
        credentials.password,
        messageId,
        currentFolder,
        targetFolder
      );

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

  // Delete email
  deleteEmail: async (messageId: string) => {
    const credentials = useCredentialsStore.getState().getMailCredentials();
    if (!credentials) return;

    set((state) => ({ loading: { ...state.loading, action: true } }));

    try {
      await mailApi.deleteEmail(credentials.email, credentials.password, messageId);

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

  // Mark as read/unread
  markAsRead: async (messageId: string, isRead: boolean) => {
    const credentials = useCredentialsStore.getState().getMailCredentials();
    if (!credentials) return;

    try {
      await mailApi.markAsRead(credentials.email, credentials.password, messageId, isRead);

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

  // Toggle star
  toggleStar: async (messageId: string) => {
    const credentials = useCredentialsStore.getState().getMailCredentials();
    if (!credentials) return;

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
      await mailApi.toggleStar(
        credentials.email,
        credentials.password,
        messageId,
        newStarred
      );
    } catch (error) {
      // Revert on failure
      set((state) => ({
        emails: state.emails.map((e) =>
          e.id === messageId ? { ...e, isStarred: !newStarred } : e
        ),
      }));
    }
  },

  // UI Actions
  setCurrentFolder: (folder: string) => {
    set({ currentFolder: folder, selectedEmail: null });
    get().fetchEmails(folder);
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

// Helper functions
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

// Hooks for common operations
export function useReplyToEmail(email: Email) {
  const { openCompose } = useMailStore();

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
  const credentials = useCredentialsStore.getState().getMailCredentials();

  return () => {
    const allRecipients = [
      email.from.email,
      ...email.to.map((t) => t.email),
    ].filter((e) => e !== credentials?.email);

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
