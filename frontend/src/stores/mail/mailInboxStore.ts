/**
 * Mail Inbox Store - Core emails and folders management
 */
import { create } from 'zustand';
import * as mailApi from '@/lib/mailApi';
import { useCredentialsStore } from '../credentialsStore';
import { checkSession, getFolderType, isSystemFolder, parseEmailAddress, handleApiError } from './mailHelpers';
import type { Email, MailFolder, PaginationState, MailLoadingState } from './mailTypes';

interface MailInboxState {
  // Data
  folders: MailFolder[];
  emails: Email[];
  selectedEmail: Email | null;
  currentFolder: string;
  selectedEmails: string[];

  // Pagination
  pagination: PaginationState;

  // Loading states (subset)
  loading: Pick<MailLoadingState, 'folders' | 'emails' | 'email' | 'action'>;

  // Error
  error: string | null;

  // Actions - Folders
  fetchFolders: () => Promise<void>;
  setCurrentFolder: (folder: string) => void;

  // Actions - Emails
  fetchEmails: (folder?: string, page?: number) => Promise<void>;
  fetchEmail: (messageId: string) => Promise<void>;
  selectEmail: (email: Email | null) => void;

  // Actions - Email Operations
  moveEmail: (messageId: string, targetFolder: string) => Promise<void>;
  deleteEmail: (messageId: string) => Promise<void>;
  markAsRead: (messageId: string, isRead: boolean) => Promise<void>;
  toggleStar: (messageId: string) => Promise<void>;

  // Actions - Selection
  selectMultipleEmails: (ids: string[]) => void;
  toggleEmailSelection: (id: string) => void;
  clearSelection: () => void;

  // Actions - Utility
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  folders: [] as MailFolder[],
  emails: [] as Email[],
  selectedEmail: null as Email | null,
  currentFolder: 'INBOX',
  selectedEmails: [] as string[],
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
    action: false,
  },
  error: null as string | null,
};

export const useMailInboxStore = create<MailInboxState>((set, get) => ({
  ...initialState,

  // ===========================================
  // Fetch folders
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
      set({ error: handleApiError(error) });
    } finally {
      set((state) => ({ loading: { ...state.loading, folders: false } }));
    }
  },

  // ===========================================
  // Set current folder
  // ===========================================
  setCurrentFolder: (folder: string) => {
    set({ currentFolder: folder, selectedEmail: null });
    get().fetchEmails(folder);
  },

  // ===========================================
  // Fetch emails
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

      // Auto-categorize emails in the background
      if (emails.length > 0 && targetFolder === 'INBOX') {
        const emailsToCategeorize = emails.map(e => ({
          id: e.id,
          from: typeof e.from === 'string' ? e.from : e.from.email,
          subject: e.subject,
        }));
        mailApi.bulkCategorizeEmails(emailsToCategeorize).catch(err => {
          console.warn('[Mail] Auto-categorization failed:', err);
        });
      }
    } catch (error: any) {
      set({ error: handleApiError(error) });
    } finally {
      set((state) => ({ loading: { ...state.loading, emails: false } }));
    }
  },

  // ===========================================
  // Fetch single email
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
  // Select email
  // ===========================================
  selectEmail: (email: Email | null) => {
    set({ selectedEmail: email });
    if (email) {
      if (!email.isRead) {
        get().markAsRead(email.id, true);
      }
      get().fetchEmail(email.id);
    }
  },

  // ===========================================
  // Move email
  // ===========================================
  moveEmail: async (messageId: string, targetFolder: string) => {
    if (!checkSession()) return;

    const { currentFolder, emails } = get();
    set((state) => ({ loading: { ...state.loading, action: true } }));

    try {
      await mailApi.moveEmail(messageId, currentFolder, targetFolder);

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
  // Delete email
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
  // Mark as read/unread
  // ===========================================
  markAsRead: async (messageId: string, isRead: boolean) => {
    if (!checkSession()) return;

    try {
      await mailApi.markAsRead(messageId, isRead);

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
      console.error('Failed to mark as read:', error);
    }
  },

  // ===========================================
  // Toggle star
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
  // Selection actions
  // ===========================================
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

  // ===========================================
  // Utility actions
  // ===========================================
  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));
