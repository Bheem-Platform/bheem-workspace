/**
 * Bheem Workspace - Offline Email Store
 *
 * Handles offline email storage and operations.
 * Phase 3: Offline Support
 */

import { getDatabase, EmailRecord, FolderRecord, DraftRecord } from './database';
import { addToSyncQueue, registerSyncHandler, SyncQueueItem, SyncResult } from './syncManager';

// Re-export types for consumers
export type { EmailRecord, FolderRecord, DraftRecord };

/**
 * Cache emails to IndexedDB
 */
export async function cacheEmails(
  emails: EmailRecord[],
  tenantId: string
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('emails', 'readwrite');
  const cachedAt = new Date().toISOString();

  await Promise.all([
    ...emails.map(email =>
      tx.store.put({
        ...email,
        tenant_id: tenantId,
        cached_at: cachedAt,
      })
    ),
    tx.done,
  ]);

  console.log(`[EmailStore] Cached ${emails.length} emails`);
}

/**
 * Get cached emails by folder
 */
export async function getCachedEmails(
  folder: string,
  tenantId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<EmailRecord[]> {
  const db = await getDatabase();
  const allEmails = await db.getAllFromIndex('emails', 'by-folder', folder);

  // Filter by tenant and sort by date
  const filtered = allEmails
    .filter(email => email.tenant_id === tenantId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Apply pagination
  const { limit = 50, offset = 0 } = options;
  return filtered.slice(offset, offset + limit);
}

/**
 * Get a single cached email
 */
export async function getCachedEmail(
  emailId: string
): Promise<EmailRecord | undefined> {
  const db = await getDatabase();
  return db.get('emails', emailId);
}

/**
 * Search cached emails
 */
export async function searchCachedEmails(
  query: string,
  tenantId: string
): Promise<EmailRecord[]> {
  const db = await getDatabase();
  const allEmails = await db.getAllFromIndex('emails', 'by-tenant', tenantId);

  const queryLower = query.toLowerCase();
  return allEmails.filter(email =>
    email.subject?.toLowerCase().includes(queryLower) ||
    email.body_text?.toLowerCase().includes(queryLower) ||
    email.from.email.toLowerCase().includes(queryLower) ||
    email.from.name?.toLowerCase().includes(queryLower)
  );
}

/**
 * Update email (mark as read, starred, etc.)
 */
export async function updateCachedEmail(
  emailId: string,
  updates: Partial<EmailRecord>,
  offline = false
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get('emails', emailId);

  if (existing) {
    await db.put('emails', {
      ...existing,
      ...updates,
      cached_at: new Date().toISOString(),
    });

    // Queue for sync if offline
    if (offline) {
      await addToSyncQueue('email', 'update', { emailId, updates }, emailId, existing.tenant_id);
    }
  }
}

/**
 * Delete email from cache
 */
export async function deleteCachedEmail(
  emailId: string,
  offline = false
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get('emails', emailId);

  if (existing) {
    await db.delete('emails', emailId);

    if (offline) {
      await addToSyncQueue('email', 'delete', { emailId }, emailId, existing.tenant_id);
    }
  }
}

/**
 * Move email to folder
 */
export async function moveCachedEmail(
  emailId: string,
  toFolder: string,
  offline = false
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get('emails', emailId);

  if (existing) {
    const oldFolder = existing.folder;
    await db.put('emails', {
      ...existing,
      folder: toFolder,
      cached_at: new Date().toISOString(),
    });

    if (offline) {
      await addToSyncQueue(
        'email',
        'move',
        { emailId, fromFolder: oldFolder, toFolder },
        emailId,
        existing.tenant_id
      );
    }
  }
}

// ============================================
// Folders
// ============================================

/**
 * Cache folders
 */
export async function cacheFolders(
  folders: FolderRecord[],
  tenantId: string
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('folders', 'readwrite');
  const cachedAt = new Date().toISOString();

  await Promise.all([
    ...folders.map(folder =>
      tx.store.put({
        ...folder,
        tenant_id: tenantId,
        cached_at: cachedAt,
      })
    ),
    tx.done,
  ]);
}

/**
 * Get cached folders
 */
export async function getCachedFolders(tenantId: string): Promise<FolderRecord[]> {
  const db = await getDatabase();
  return db.getAllFromIndex('folders', 'by-tenant', tenantId);
}

// ============================================
// Drafts
// ============================================

/**
 * Save draft for offline
 */
export async function saveDraft(
  draft: Omit<DraftRecord, 'id' | 'created_at' | 'updated_at'>,
  tenantId: string,
  existingId?: string
): Promise<string> {
  const db = await getDatabase();
  const id = existingId || `draft-${Date.now()}`;
  const now = new Date().toISOString();

  await db.put('drafts', {
    ...draft,
    id,
    tenant_id: tenantId,
    created_at: existingId ? (await db.get('drafts', id))?.created_at || now : now,
    updated_at: now,
  });

  return id;
}

/**
 * Get all drafts
 */
export async function getDrafts(tenantId: string): Promise<DraftRecord[]> {
  const db = await getDatabase();
  const drafts = await db.getAllFromIndex('drafts', 'by-tenant', tenantId);
  return drafts.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

/**
 * Get a single draft
 */
export async function getDraft(draftId: string): Promise<DraftRecord | undefined> {
  const db = await getDatabase();
  return db.get('drafts', draftId);
}

/**
 * Delete draft
 */
export async function deleteDraft(draftId: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('drafts', draftId);
}

/**
 * Queue email send for when back online
 */
export async function queueEmailSend(
  draft: DraftRecord,
  tenantId: string
): Promise<string> {
  return addToSyncQueue(
    'email',
    'send',
    {
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      attachments: draft.attachments?.map(a => ({ id: a.id, name: a.name })),
    },
    draft.id,
    tenantId
  );
}

// ============================================
// Sync Handlers
// ============================================

/**
 * Register email sync handlers
 */
export function registerEmailSyncHandlers(
  apiClient: {
    updateEmail: (id: string, updates: Record<string, unknown>) => Promise<void>;
    deleteEmail: (id: string) => Promise<void>;
    moveEmail: (id: string, folder: string) => Promise<void>;
    sendEmail: (data: Record<string, unknown>) => Promise<void>;
  }
): void {
  // Update handler
  registerSyncHandler('email', 'update', async (item: SyncQueueItem): Promise<SyncResult> => {
    try {
      const { emailId, updates } = item.payload as { emailId: string; updates: Record<string, unknown> };
      await apiClient.updateEmail(emailId, updates);
      return { success: true, itemId: item.id };
    } catch (error) {
      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Failed to update email',
      };
    }
  });

  // Delete handler
  registerSyncHandler('email', 'delete', async (item: SyncQueueItem): Promise<SyncResult> => {
    try {
      const { emailId } = item.payload as { emailId: string };
      await apiClient.deleteEmail(emailId);
      return { success: true, itemId: item.id };
    } catch (error) {
      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Failed to delete email',
      };
    }
  });

  // Move handler
  registerSyncHandler('email', 'move', async (item: SyncQueueItem): Promise<SyncResult> => {
    try {
      const { emailId, toFolder } = item.payload as { emailId: string; toFolder: string };
      await apiClient.moveEmail(emailId, toFolder);
      return { success: true, itemId: item.id };
    } catch (error) {
      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Failed to move email',
      };
    }
  });

  // Send handler
  registerSyncHandler('email', 'send', async (item: SyncQueueItem): Promise<SyncResult> => {
    try {
      await apiClient.sendEmail(item.payload);
      return { success: true, itemId: item.id };
    } catch (error) {
      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  });

  console.log('[EmailStore] Sync handlers registered');
}

/**
 * Clear all email cache for tenant
 */
export async function clearEmailCache(tenantId: string): Promise<void> {
  const db = await getDatabase();

  // Clear emails
  const emails = await db.getAllFromIndex('emails', 'by-tenant', tenantId);
  const tx1 = db.transaction('emails', 'readwrite');
  await Promise.all([...emails.map(e => tx1.store.delete(e.id)), tx1.done]);

  // Clear folders
  const folders = await db.getAllFromIndex('folders', 'by-tenant', tenantId);
  const tx2 = db.transaction('folders', 'readwrite');
  await Promise.all([...folders.map(f => tx2.store.delete(f.id)), tx2.done]);

  // Clear drafts
  const drafts = await db.getAllFromIndex('drafts', 'by-tenant', tenantId);
  const tx3 = db.transaction('drafts', 'readwrite');
  await Promise.all([...drafts.map(d => tx3.store.delete(d.id)), tx3.done]);

  console.log('[EmailStore] Cache cleared for tenant:', tenantId);
}

/**
 * Get email cache statistics
 */
export async function getEmailCacheStats(tenantId: string): Promise<{
  emailCount: number;
  folderCount: number;
  draftCount: number;
  oldestEmail: string | null;
  newestEmail: string | null;
}> {
  const db = await getDatabase();

  const emails = await db.getAllFromIndex('emails', 'by-tenant', tenantId);
  const folders = await db.getAllFromIndex('folders', 'by-tenant', tenantId);
  const drafts = await db.getAllFromIndex('drafts', 'by-tenant', tenantId);

  const sortedEmails = emails.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return {
    emailCount: emails.length,
    folderCount: folders.length,
    draftCount: drafts.length,
    oldestEmail: sortedEmails[0]?.date || null,
    newestEmail: sortedEmails[sortedEmails.length - 1]?.date || null,
  };
}
