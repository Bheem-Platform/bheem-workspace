/**
 * Bheem Workspace - Sync Manager
 *
 * Handles offline queue management and synchronization.
 * Phase 3: Offline Support
 */

import { getDatabase, SyncQueueRecord } from './database';

export type SyncActionType = 'email' | 'calendar' | 'notes' | 'drive';
export type SyncAction = 'create' | 'update' | 'delete' | 'move' | 'send';

export interface SyncQueueItem {
  id: string;
  type: SyncActionType;
  action: SyncAction;
  entityId?: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  retryCount: number;
  lastError?: string;
}

export interface SyncResult {
  success: boolean;
  itemId: string;
  error?: string;
}

// Sync handlers for each type
type SyncHandler = (item: SyncQueueItem) => Promise<SyncResult>;
const syncHandlers: Map<SyncActionType, Map<SyncAction, SyncHandler>> = new Map();

// Event listeners
type SyncEventType = 'sync-start' | 'sync-complete' | 'sync-error' | 'item-synced' | 'item-failed';
type SyncEventListener = (data: unknown) => void;
const eventListeners: Map<SyncEventType, Set<SyncEventListener>> = new Map();

// Sync state
let isSyncing = false;
let lastSyncTime: Date | null = null;

/**
 * Generate unique ID for sync queue items
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add an item to the sync queue
 */
export async function addToSyncQueue(
  type: SyncActionType,
  action: SyncAction,
  payload: Record<string, unknown>,
  entityId?: string,
  tenantId?: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();

  const item: SyncQueueRecord = {
    id,
    type,
    action,
    entity_id: entityId,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
    tenant_id: tenantId || '',
  };

  await db.put('syncQueue', item);
  console.log(`[SyncManager] Added to queue: ${type}/${action}`, id);

  // Try to sync immediately if online
  if (navigator.onLine) {
    triggerSync();
  }

  return id;
}

/**
 * Get all items in the sync queue
 */
export async function getSyncQueue(tenantId?: string): Promise<SyncQueueItem[]> {
  const db = await getDatabase();

  let items: SyncQueueRecord[];
  if (tenantId) {
    items = await db.getAllFromIndex('syncQueue', 'by-tenant', tenantId);
  } else {
    items = await db.getAll('syncQueue');
  }

  return items.map(mapToSyncItem);
}

/**
 * Get sync queue count
 */
export async function getSyncQueueCount(tenantId?: string): Promise<number> {
  const items = await getSyncQueue(tenantId);
  return items.length;
}

/**
 * Remove an item from the sync queue
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('syncQueue', id);
  console.log(`[SyncManager] Removed from queue:`, id);
}

/**
 * Clear the entire sync queue
 */
export async function clearSyncQueue(tenantId?: string): Promise<void> {
  const db = await getDatabase();

  if (tenantId) {
    const items = await db.getAllFromIndex('syncQueue', 'by-tenant', tenantId);
    const tx = db.transaction('syncQueue', 'readwrite');
    await Promise.all([
      ...items.map(item => tx.store.delete(item.id)),
      tx.done,
    ]);
  } else {
    await db.clear('syncQueue');
  }

  console.log(`[SyncManager] Queue cleared`);
}

/**
 * Register a sync handler for a specific type and action
 */
export function registerSyncHandler(
  type: SyncActionType,
  action: SyncAction,
  handler: SyncHandler
): void {
  if (!syncHandlers.has(type)) {
    syncHandlers.set(type, new Map());
  }
  syncHandlers.get(type)!.set(action, handler);
  console.log(`[SyncManager] Registered handler: ${type}/${action}`);
}

/**
 * Trigger a sync operation
 */
export async function triggerSync(): Promise<void> {
  if (isSyncing) {
    console.log('[SyncManager] Sync already in progress');
    return;
  }

  if (!navigator.onLine) {
    console.log('[SyncManager] Offline, skipping sync');
    return;
  }

  isSyncing = true;
  emit('sync-start', { timestamp: new Date() });

  try {
    const db = await getDatabase();
    const items = await db.getAllFromIndex('syncQueue', 'by-created');

    console.log(`[SyncManager] Processing ${items.length} items`);

    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      const syncItem = mapToSyncItem(item);
      const result = await processItem(syncItem);

      if (result.success) {
        await removeFromSyncQueue(item.id);
        successCount++;
        emit('item-synced', { item: syncItem, result });
      } else {
        // Update retry count
        await db.put('syncQueue', {
          ...item,
          retry_count: item.retry_count + 1,
          last_error: result.error,
        });
        failCount++;
        emit('item-failed', { item: syncItem, result });
      }
    }

    lastSyncTime = new Date();
    emit('sync-complete', {
      timestamp: lastSyncTime,
      successCount,
      failCount,
      total: items.length,
    });

    console.log(`[SyncManager] Sync complete: ${successCount} success, ${failCount} failed`);
  } catch (error) {
    console.error('[SyncManager] Sync error:', error);
    emit('sync-error', { error });
  } finally {
    isSyncing = false;
  }
}

/**
 * Process a single sync item
 */
async function processItem(item: SyncQueueItem): Promise<SyncResult> {
  const typeHandlers = syncHandlers.get(item.type);
  if (!typeHandlers) {
    return {
      success: false,
      itemId: item.id,
      error: `No handlers registered for type: ${item.type}`,
    };
  }

  const handler = typeHandlers.get(item.action);
  if (!handler) {
    return {
      success: false,
      itemId: item.id,
      error: `No handler for action: ${item.type}/${item.action}`,
    };
  }

  try {
    return await handler(item);
  } catch (error) {
    return {
      success: false,
      itemId: item.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Map database record to SyncQueueItem
 */
function mapToSyncItem(record: SyncQueueRecord): SyncQueueItem {
  return {
    id: record.id,
    type: record.type,
    action: record.action,
    entityId: record.entity_id,
    payload: record.payload,
    createdAt: new Date(record.created_at),
    retryCount: record.retry_count,
    lastError: record.last_error,
  };
}

/**
 * Subscribe to sync events
 */
export function onSyncEvent(event: SyncEventType, listener: SyncEventListener): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(listener);

  return () => {
    eventListeners.get(event)?.delete(listener);
  };
}

/**
 * Emit sync event
 */
function emit(event: SyncEventType, data: unknown): void {
  eventListeners.get(event)?.forEach(listener => {
    try {
      listener(data);
    } catch (error) {
      console.error(`[SyncManager] Event listener error:`, error);
    }
  });
}

/**
 * Get sync status
 */
export function getSyncStatus(): {
  isSyncing: boolean;
  lastSyncTime: Date | null;
} {
  return {
    isSyncing,
    lastSyncTime,
  };
}

/**
 * Initialize sync manager
 */
export function initSyncManager(): void {
  // Listen for online status
  window.addEventListener('online', () => {
    console.log('[SyncManager] Back online, triggering sync');
    triggerSync();
  });

  // Periodic sync (every 5 minutes when online)
  setInterval(() => {
    if (navigator.onLine) {
      triggerSync();
    }
  }, 5 * 60 * 1000);

  console.log('[SyncManager] Initialized');
}
