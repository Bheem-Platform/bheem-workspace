/**
 * Bheem Workspace - Offline Notes Store
 *
 * Handles offline notes storage and operations.
 * Phase 3: Offline Support
 */

import { getDatabase, NoteRecord } from './database';
import { addToSyncQueue, registerSyncHandler, SyncQueueItem, SyncResult } from './syncManager';

// Re-export types for consumers
export type { NoteRecord };

/**
 * Cache notes to IndexedDB
 */
export async function cacheNotes(
  notes: NoteRecord[],
  tenantId: string
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('notes', 'readwrite');
  const cachedAt = new Date().toISOString();

  await Promise.all([
    ...notes.map(note =>
      tx.store.put({
        ...note,
        tenant_id: tenantId,
        cached_at: cachedAt,
      })
    ),
    tx.done,
  ]);

  console.log(`[NotesStore] Cached ${notes.length} notes`);
}

/**
 * Get all cached notes
 */
export async function getCachedNotes(
  tenantId: string,
  options: {
    archived?: boolean;
    trashed?: boolean;
    labelId?: string;
  } = {}
): Promise<NoteRecord[]> {
  const db = await getDatabase();
  const allNotes = await db.getAllFromIndex('notes', 'by-tenant', tenantId);

  let filtered = allNotes;

  // Filter by archived status
  if (options.archived !== undefined) {
    filtered = filtered.filter(n => n.is_archived === options.archived);
  }

  // Filter by trashed status
  if (options.trashed !== undefined) {
    filtered = filtered.filter(n => n.is_trashed === options.trashed);
  }

  // Filter by label
  if (options.labelId) {
    filtered = filtered.filter(n =>
      n.labels?.some(l => l.id === options.labelId)
    );
  }

  // Sort by pinned first, then by updated_at
  return filtered.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

/**
 * Get a single cached note
 */
export async function getCachedNote(noteId: string): Promise<NoteRecord | undefined> {
  const db = await getDatabase();
  return db.get('notes', noteId);
}

/**
 * Search cached notes
 */
export async function searchCachedNotes(
  query: string,
  tenantId: string
): Promise<NoteRecord[]> {
  const db = await getDatabase();
  const allNotes = await db.getAllFromIndex('notes', 'by-tenant', tenantId);

  const queryLower = query.toLowerCase();
  return allNotes.filter(note =>
    !note.is_trashed && (
      note.title?.toLowerCase().includes(queryLower) ||
      note.content?.toLowerCase().includes(queryLower) ||
      note.checklist_items?.some(item =>
        item.text.toLowerCase().includes(queryLower)
      )
    )
  );
}

/**
 * Create note offline
 */
export async function createCachedNote(
  note: Omit<NoteRecord, 'id' | 'created_at' | 'updated_at' | 'cached_at' | 'tenant_id'>,
  tenantId: string
): Promise<string> {
  const db = await getDatabase();
  const id = `note-offline-${Date.now()}`;
  const now = new Date().toISOString();

  const newNote: NoteRecord = {
    ...note,
    id,
    tenant_id: tenantId,
    created_at: now,
    updated_at: now,
    cached_at: now,
  };

  await db.put('notes', newNote);

  // Queue for sync
  await addToSyncQueue('notes', 'create', { note: newNote }, id, tenantId);

  console.log(`[NotesStore] Created offline note:`, id);
  return id;
}

/**
 * Update note
 */
export async function updateCachedNote(
  noteId: string,
  updates: Partial<NoteRecord>,
  offline = false
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get('notes', noteId);

  if (existing) {
    const now = new Date().toISOString();
    await db.put('notes', {
      ...existing,
      ...updates,
      updated_at: now,
      cached_at: now,
    });

    if (offline) {
      await addToSyncQueue('notes', 'update', { noteId, updates }, noteId, existing.tenant_id);
    }
  }
}

/**
 * Delete note (move to trash)
 */
export async function deleteCachedNote(
  noteId: string,
  permanent = false,
  offline = false
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get('notes', noteId);

  if (existing) {
    if (permanent) {
      await db.delete('notes', noteId);
    } else {
      await db.put('notes', {
        ...existing,
        is_trashed: true,
        updated_at: new Date().toISOString(),
        cached_at: new Date().toISOString(),
      });
    }

    if (offline) {
      await addToSyncQueue(
        'notes',
        'delete',
        { noteId, permanent },
        noteId,
        existing.tenant_id
      );
    }
  }
}

/**
 * Archive note
 */
export async function archiveCachedNote(
  noteId: string,
  archived = true,
  offline = false
): Promise<void> {
  await updateCachedNote(noteId, { is_archived: archived }, offline);
}

/**
 * Pin note
 */
export async function pinCachedNote(
  noteId: string,
  pinned = true,
  offline = false
): Promise<void> {
  await updateCachedNote(noteId, { is_pinned: pinned }, offline);
}

/**
 * Change note color
 */
export async function changeNoteCachedColor(
  noteId: string,
  color: string,
  offline = false
): Promise<void> {
  await updateCachedNote(noteId, { color }, offline);
}

// ============================================
// Sync Handlers
// ============================================

/**
 * Register notes sync handlers
 */
export function registerNotesSyncHandlers(
  apiClient: {
    createNote: (data: Record<string, unknown>) => Promise<{ id: string }>;
    updateNote: (id: string, updates: Record<string, unknown>) => Promise<void>;
    deleteNote: (id: string, permanent?: boolean) => Promise<void>;
  }
): void {
  // Create handler
  registerSyncHandler('notes', 'create', async (item: SyncQueueItem): Promise<SyncResult> => {
    try {
      const { note } = item.payload as { note: NoteRecord };
      const result = await apiClient.createNote({
        title: note.title,
        content: note.content,
        color: note.color,
        is_pinned: note.is_pinned,
        is_checklist: note.is_checklist,
        checklist_items: note.checklist_items,
      });

      // Update local note with server ID
      const db = await getDatabase();
      const offlineNote = await db.get('notes', note.id);
      if (offlineNote) {
        await db.delete('notes', note.id);
        await db.put('notes', {
          ...offlineNote,
          id: result.id,
        });
      }

      return { success: true, itemId: item.id };
    } catch (error) {
      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Failed to create note',
      };
    }
  });

  // Update handler
  registerSyncHandler('notes', 'update', async (item: SyncQueueItem): Promise<SyncResult> => {
    try {
      const { noteId, updates } = item.payload as { noteId: string; updates: Record<string, unknown> };
      await apiClient.updateNote(noteId, updates);
      return { success: true, itemId: item.id };
    } catch (error) {
      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Failed to update note',
      };
    }
  });

  // Delete handler
  registerSyncHandler('notes', 'delete', async (item: SyncQueueItem): Promise<SyncResult> => {
    try {
      const { noteId, permanent } = item.payload as { noteId: string; permanent?: boolean };
      await apiClient.deleteNote(noteId, permanent);
      return { success: true, itemId: item.id };
    } catch (error) {
      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Failed to delete note',
      };
    }
  });

  console.log('[NotesStore] Sync handlers registered');
}

/**
 * Clear all notes cache for tenant
 */
export async function clearNotesCache(tenantId: string): Promise<void> {
  const db = await getDatabase();
  const notes = await db.getAllFromIndex('notes', 'by-tenant', tenantId);

  const tx = db.transaction('notes', 'readwrite');
  await Promise.all([...notes.map(n => tx.store.delete(n.id)), tx.done]);

  console.log('[NotesStore] Cache cleared for tenant:', tenantId);
}

/**
 * Get notes cache statistics
 */
export async function getNotesCacheStats(tenantId: string): Promise<{
  totalNotes: number;
  activeNotes: number;
  archivedNotes: number;
  trashedNotes: number;
  pinnedNotes: number;
}> {
  const db = await getDatabase();
  const notes = await db.getAllFromIndex('notes', 'by-tenant', tenantId);

  return {
    totalNotes: notes.length,
    activeNotes: notes.filter(n => !n.is_archived && !n.is_trashed).length,
    archivedNotes: notes.filter(n => n.is_archived).length,
    trashedNotes: notes.filter(n => n.is_trashed).length,
    pinnedNotes: notes.filter(n => n.is_pinned && !n.is_archived && !n.is_trashed).length,
  };
}
