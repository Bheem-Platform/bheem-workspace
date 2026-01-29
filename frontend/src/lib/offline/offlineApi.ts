/**
 * Bheem Workspace - Offline-Ready API Client
 *
 * Wraps API calls with offline support, falling back to cached data
 * and queuing mutations when offline.
 * Phase 3: Offline Support
 */

import { addToSyncQueue, triggerSync } from './syncManager';
import {
  cacheEmails,
  getCachedEmails,
  getCachedEmail,
  cacheFolders,
  getCachedFolders,
  updateCachedEmail,
  deleteCachedEmail,
  moveCachedEmail,
  saveDraft as saveLocalDraft,
  getDrafts as getLocalDrafts,
  deleteDraft as deleteLocalDraft,
  queueEmailSend,
  type EmailRecord,
  type FolderRecord,
  type DraftRecord,
} from './emailStore';
import {
  cacheNotes,
  getCachedNotes,
  getCachedNote,
  createCachedNote,
  updateCachedNote,
  deleteCachedNote,
  type NoteRecord,
} from './notesStore';

export interface OfflineApiOptions {
  tenantId: string;
  baseUrl?: string;
  getToken?: () => Promise<string | null>;
}

export interface ApiResponse<T> {
  data: T;
  fromCache: boolean;
  error?: string;
}

/**
 * Create an offline-ready API client
 */
export function createOfflineApi(options: OfflineApiOptions) {
  const { tenantId, baseUrl = '/api/v1', getToken } = options;

  /**
   * Make an API request with offline fallback
   */
  async function request<T>(
    path: string,
    init?: RequestInit,
    cacheHandler?: {
      getCached: () => Promise<T | null>;
      setCached: (data: T) => Promise<void>;
    }
  ): Promise<ApiResponse<T>> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string>) || {}),
    };

    // Add auth token if available
    if (getToken) {
      const token = await getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // Try online request first
    if (navigator.onLine) {
      try {
        const response = await fetch(url, {
          ...init,
          headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache the response if handler provided
        if (cacheHandler?.setCached) {
          cacheHandler.setCached(data).catch(console.error);
        }

        return { data, fromCache: false };
      } catch (error) {
        console.warn('[OfflineApi] Request failed, trying cache:', error);
        // Fall through to cache
      }
    }

    // Offline or request failed - try cache
    if (cacheHandler?.getCached) {
      const cachedData = await cacheHandler.getCached();
      if (cachedData !== null) {
        return { data: cachedData, fromCache: true };
      }
    }

    throw new Error('No network connection and no cached data available');
  }

  // ============================================
  // Email API
  // ============================================

  const email = {
    /**
     * Get emails for a folder
     */
    async getEmails(folder: string, options: { limit?: number; offset?: number } = {}): Promise<ApiResponse<EmailRecord[]>> {
      return request<EmailRecord[]>(
        `/mail/messages?folder=${folder}&limit=${options.limit || 50}&offset=${options.offset || 0}`,
        { method: 'GET' },
        {
          getCached: () => getCachedEmails(folder, tenantId, options),
          setCached: (data) => cacheEmails(data, tenantId),
        }
      );
    },

    /**
     * Get a single email
     */
    async getEmail(emailId: string): Promise<ApiResponse<EmailRecord>> {
      return request<EmailRecord>(
        `/mail/messages/${emailId}`,
        { method: 'GET' },
        {
          getCached: () => getCachedEmail(emailId) as Promise<EmailRecord | null>,
          setCached: (data) => cacheEmails([data], tenantId),
        }
      );
    },

    /**
     * Get folders
     */
    async getFolders(): Promise<ApiResponse<FolderRecord[]>> {
      return request<FolderRecord[]>(
        `/mail/folders`,
        { method: 'GET' },
        {
          getCached: () => getCachedFolders(tenantId),
          setCached: (data) => cacheFolders(data, tenantId),
        }
      );
    },

    /**
     * Mark email as read
     */
    async markAsRead(emailId: string, isRead: boolean): Promise<void> {
      if (navigator.onLine) {
        await fetch(`${baseUrl}/mail/messages/${emailId}/read`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: isRead }),
        });
      }
      await updateCachedEmail(emailId, { is_read: isRead }, !navigator.onLine);
    },

    /**
     * Star/unstar email
     */
    async toggleStar(emailId: string, isStarred: boolean): Promise<void> {
      if (navigator.onLine) {
        await fetch(`${baseUrl}/mail/messages/${emailId}/star`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_starred: isStarred }),
        });
      }
      await updateCachedEmail(emailId, { is_starred: isStarred }, !navigator.onLine);
    },

    /**
     * Move email to folder
     */
    async moveToFolder(emailId: string, folder: string): Promise<void> {
      if (navigator.onLine) {
        await fetch(`${baseUrl}/mail/messages/${emailId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder }),
        });
      }
      await moveCachedEmail(emailId, folder, !navigator.onLine);
    },

    /**
     * Delete email
     */
    async deleteEmail(emailId: string): Promise<void> {
      if (navigator.onLine) {
        await fetch(`${baseUrl}/mail/messages/${emailId}`, {
          method: 'DELETE',
        });
      }
      await deleteCachedEmail(emailId, !navigator.onLine);
    },

    /**
     * Save draft
     */
    async saveDraft(draft: Omit<DraftRecord, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
      return saveLocalDraft(draft, tenantId);
    },

    /**
     * Get drafts
     */
    async getDrafts(): Promise<DraftRecord[]> {
      return getLocalDrafts(tenantId);
    },

    /**
     * Delete draft
     */
    async deleteDraft(draftId: string): Promise<void> {
      return deleteLocalDraft(draftId);
    },

    /**
     * Send email (queues if offline)
     */
    async sendEmail(draft: DraftRecord): Promise<{ queued: boolean; id: string }> {
      if (navigator.onLine) {
        const response = await fetch(`${baseUrl}/mail/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: draft.to,
            cc: draft.cc,
            bcc: draft.bcc,
            subject: draft.subject,
            body: draft.body,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send email');
        }

        const data = await response.json();
        await deleteLocalDraft(draft.id);
        return { queued: false, id: data.id };
      } else {
        const queueId = await queueEmailSend(draft, tenantId);
        return { queued: true, id: queueId };
      }
    },
  };

  // ============================================
  // Notes API
  // ============================================

  const notes = {
    /**
     * Get all notes
     */
    async getNotes(options: { archived?: boolean; trashed?: boolean; labelId?: string } = {}): Promise<ApiResponse<NoteRecord[]>> {
      const params = new URLSearchParams();
      if (options.archived !== undefined) params.append('archived', String(options.archived));
      if (options.trashed !== undefined) params.append('trashed', String(options.trashed));
      if (options.labelId) params.append('label_id', options.labelId);

      return request<NoteRecord[]>(
        `/notes?${params.toString()}`,
        { method: 'GET' },
        {
          getCached: () => getCachedNotes(tenantId, options),
          setCached: (data) => cacheNotes(data, tenantId),
        }
      );
    },

    /**
     * Get a single note
     */
    async getNote(noteId: string): Promise<ApiResponse<NoteRecord>> {
      return request<NoteRecord>(
        `/notes/${noteId}`,
        { method: 'GET' },
        {
          getCached: () => getCachedNote(noteId) as Promise<NoteRecord | null>,
          setCached: (data) => cacheNotes([data], tenantId),
        }
      );
    },

    /**
     * Create note
     */
    async createNote(note: Omit<NoteRecord, 'id' | 'created_at' | 'updated_at' | 'cached_at' | 'tenant_id'>): Promise<{ id: string; fromCache: boolean }> {
      if (navigator.onLine) {
        const response = await fetch(`${baseUrl}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note),
        });

        if (!response.ok) {
          throw new Error('Failed to create note');
        }

        const data = await response.json();
        await cacheNotes([data], tenantId);
        return { id: data.id, fromCache: false };
      } else {
        const id = await createCachedNote(note, tenantId);
        return { id, fromCache: true };
      }
    },

    /**
     * Update note
     */
    async updateNote(noteId: string, updates: Partial<NoteRecord>): Promise<void> {
      if (navigator.onLine) {
        await fetch(`${baseUrl}/notes/${noteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      }
      await updateCachedNote(noteId, updates, !navigator.onLine);
    },

    /**
     * Delete note
     */
    async deleteNote(noteId: string, permanent = false): Promise<void> {
      if (navigator.onLine) {
        await fetch(`${baseUrl}/notes/${noteId}${permanent ? '?permanent=true' : ''}`, {
          method: 'DELETE',
        });
      }
      await deleteCachedNote(noteId, permanent, !navigator.onLine);
    },

    /**
     * Toggle pin
     */
    async togglePin(noteId: string, pinned: boolean): Promise<void> {
      await this.updateNote(noteId, { is_pinned: pinned });
    },

    /**
     * Archive note
     */
    async archiveNote(noteId: string, archived = true): Promise<void> {
      await this.updateNote(noteId, { is_archived: archived });
    },

    /**
     * Change color
     */
    async changeColor(noteId: string, color: string): Promise<void> {
      await this.updateNote(noteId, { color });
    },
  };

  // ============================================
  // Sync utilities
  // ============================================

  const sync = {
    /**
     * Force sync all pending changes
     */
    async syncNow(): Promise<void> {
      if (navigator.onLine) {
        await triggerSync();
      }
    },

    /**
     * Check if online
     */
    isOnline(): boolean {
      return navigator.onLine;
    },
  };

  return {
    email,
    notes,
    sync,
  };
}

export type OfflineApi = ReturnType<typeof createOfflineApi>;
