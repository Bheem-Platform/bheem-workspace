/**
 * Bheem Workspace - IndexedDB Database
 *
 * Provides offline storage for all workspace applications.
 * Phase 3: Offline Support
 */

import { openDB, DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';

// Database schema definition
interface BheemDBSchema extends DBSchema {
  // Email storage
  emails: {
    key: string;
    value: {
      id: string;
      message_id: string;
      folder: string;
      subject: string;
      from: { email: string; name?: string };
      to: Array<{ email: string; name?: string }>;
      cc?: Array<{ email: string; name?: string }>;
      body_text?: string;
      body_html?: string;
      snippet?: string;
      date: string;
      is_read: boolean;
      is_starred: boolean;
      has_attachments: boolean;
      labels?: string[];
      thread_id?: string;
      cached_at: string;
      tenant_id: string;
    };
    indexes: {
      'by-folder': string;
      'by-date': string;
      'by-thread': string;
      'by-tenant': string;
    };
  };

  // Email folders
  folders: {
    key: string;
    value: {
      id: string;
      name: string;
      type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'custom';
      unread_count: number;
      total_count: number;
      tenant_id: string;
      cached_at: string;
    };
    indexes: {
      'by-tenant': string;
    };
  };

  // Draft emails for offline composition
  drafts: {
    key: string;
    value: {
      id: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      attachments?: Array<{
        id: string;
        name: string;
        size: number;
        type: string;
        data?: ArrayBuffer;
      }>;
      created_at: string;
      updated_at: string;
      tenant_id: string;
    };
    indexes: {
      'by-tenant': string;
      'by-updated': string;
    };
  };

  // Calendar events
  events: {
    key: string;
    value: {
      id: string;
      calendar_id: string;
      title: string;
      description?: string;
      start: string;
      end: string;
      all_day: boolean;
      location?: string;
      attendees?: Array<{ email: string; name?: string; status: string }>;
      recurrence?: string;
      color?: string;
      reminders?: Array<{ minutes: number; type: string }>;
      tenant_id: string;
      cached_at: string;
    };
    indexes: {
      'by-calendar': string;
      'by-start': string;
      'by-tenant': string;
    };
  };

  // Notes
  notes: {
    key: string;
    value: {
      id: string;
      title?: string;
      content?: string;
      color: string;
      is_pinned: boolean;
      is_archived: boolean;
      is_trashed: boolean;
      is_checklist: boolean;
      checklist_items?: Array<{
        id: string;
        text: string;
        is_checked: boolean;
        order: number;
      }>;
      labels?: Array<{ id: string; name: string }>;
      reminder?: string;
      created_at: string;
      updated_at: string;
      tenant_id: string;
      cached_at: string;
    };
    indexes: {
      'by-updated': string;
      'by-tenant': string;
      'by-archived': string;
    };
  };

  // Drive files (metadata only, content cached separately)
  files: {
    key: string;
    value: {
      id: string;
      name: string;
      mime_type: string;
      size: number;
      parent_id?: string;
      path: string;
      is_folder: boolean;
      is_starred: boolean;
      is_trashed: boolean;
      shared_with?: Array<{ email: string; permission: string }>;
      thumbnail_url?: string;
      created_at: string;
      updated_at: string;
      tenant_id: string;
      cached_at: string;
      // For offline availability
      is_available_offline: boolean;
      offline_version?: string;
    };
    indexes: {
      'by-parent': string;
      'by-path': string;
      'by-tenant': string;
      'by-offline': string;
    };
  };

  // File content cache (for offline access)
  fileContent: {
    key: string;
    value: {
      file_id: string;
      content: ArrayBuffer;
      mime_type: string;
      version: string;
      cached_at: string;
    };
    indexes: {
      'by-cached': string;
    };
  };

  // Sync queue for offline actions
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: 'email' | 'calendar' | 'notes' | 'drive';
      action: 'create' | 'update' | 'delete' | 'move' | 'send';
      entity_id?: string;
      payload: Record<string, unknown>;
      created_at: string;
      retry_count: number;
      last_error?: string;
      tenant_id: string;
    };
    indexes: {
      'by-type': string;
      'by-created': string;
      'by-tenant': string;
    };
  };

  // App metadata and settings
  metadata: {
    key: string;
    value: {
      key: string;
      value: unknown;
      updated_at: string;
    };
  };

  // User preferences (for offline use)
  preferences: {
    key: string;
    value: {
      tenant_id: string;
      user_id: string;
      settings: Record<string, unknown>;
      updated_at: string;
    };
    indexes: {
      'by-user': string;
    };
  };
}

const DB_NAME = 'bheem-workspace';
const DB_VERSION = 1;

// Database instance singleton
let dbInstance: IDBPDatabase<BheemDBSchema> | null = null;

/**
 * Initialize and get the database instance
 */
export async function getDatabase(): Promise<IDBPDatabase<BheemDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<BheemDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`[DB] Upgrading from v${oldVersion} to v${newVersion}`);

      // Create stores if they don't exist
      if (!db.objectStoreNames.contains('emails')) {
        const emailStore = db.createObjectStore('emails', { keyPath: 'id' });
        emailStore.createIndex('by-folder', 'folder');
        emailStore.createIndex('by-date', 'date');
        emailStore.createIndex('by-thread', 'thread_id');
        emailStore.createIndex('by-tenant', 'tenant_id');
      }

      if (!db.objectStoreNames.contains('folders')) {
        const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
        folderStore.createIndex('by-tenant', 'tenant_id');
      }

      if (!db.objectStoreNames.contains('drafts')) {
        const draftStore = db.createObjectStore('drafts', { keyPath: 'id' });
        draftStore.createIndex('by-tenant', 'tenant_id');
        draftStore.createIndex('by-updated', 'updated_at');
      }

      if (!db.objectStoreNames.contains('events')) {
        const eventStore = db.createObjectStore('events', { keyPath: 'id' });
        eventStore.createIndex('by-calendar', 'calendar_id');
        eventStore.createIndex('by-start', 'start');
        eventStore.createIndex('by-tenant', 'tenant_id');
      }

      if (!db.objectStoreNames.contains('notes')) {
        const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
        noteStore.createIndex('by-updated', 'updated_at');
        noteStore.createIndex('by-tenant', 'tenant_id');
        noteStore.createIndex('by-archived', 'is_archived');
      }

      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('by-parent', 'parent_id');
        fileStore.createIndex('by-path', 'path');
        fileStore.createIndex('by-tenant', 'tenant_id');
        fileStore.createIndex('by-offline', 'is_available_offline');
      }

      if (!db.objectStoreNames.contains('fileContent')) {
        const contentStore = db.createObjectStore('fileContent', { keyPath: 'file_id' });
        contentStore.createIndex('by-cached', 'cached_at');
      }

      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-type', 'type');
        syncStore.createIndex('by-created', 'created_at');
        syncStore.createIndex('by-tenant', 'tenant_id');
      }

      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('preferences')) {
        const prefStore = db.createObjectStore('preferences', { keyPath: 'tenant_id' });
        prefStore.createIndex('by-user', 'user_id');
      }
    },
    blocked() {
      console.warn('[DB] Database upgrade blocked by other tabs');
    },
    blocking() {
      console.warn('[DB] This tab is blocking database upgrade');
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      console.error('[DB] Database connection terminated unexpectedly');
      dbInstance = null;
    },
  });

  return dbInstance;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Clear all data from the database
 */
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  const storeNames: Array<'metadata' | 'notes' | 'emails' | 'folders' | 'drafts' | 'events' | 'files' | 'fileContent' | 'syncQueue' | 'preferences'> = [
    'metadata', 'notes', 'emails', 'folders', 'drafts', 'events', 'files', 'fileContent', 'syncQueue', 'preferences'
  ];

  const tx = db.transaction(storeNames, 'readwrite');

  await Promise.all([
    ...storeNames.map(store => tx.objectStore(store).clear()),
    tx.done,
  ]);

  console.log('[DB] All data cleared');
}

/**
 * Get storage usage estimate
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percent: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    return {
      usage,
      quota,
      percent: quota > 0 ? (usage / quota) * 100 : 0,
    };
  }
  return { usage: 0, quota: 0, percent: 0 };
}

// Export types
export type { BheemDBSchema };
export type EmailRecord = BheemDBSchema['emails']['value'];
export type FolderRecord = BheemDBSchema['folders']['value'];
export type DraftRecord = BheemDBSchema['drafts']['value'];
export type EventRecord = BheemDBSchema['events']['value'];
export type NoteRecord = BheemDBSchema['notes']['value'];
export type FileRecord = BheemDBSchema['files']['value'];
export type FileContentRecord = BheemDBSchema['fileContent']['value'];
export type SyncQueueRecord = BheemDBSchema['syncQueue']['value'];
