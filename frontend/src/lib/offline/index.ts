/**
 * Bheem Workspace - Offline Support Module
 *
 * Exports for offline functionality.
 * Phase 3: Offline Support
 */

// Database
export {
  getDatabase,
  closeDatabase,
  clearDatabase,
  getStorageEstimate,
  type BheemDBSchema,
  type EmailRecord,
  type FolderRecord,
  type DraftRecord,
  type EventRecord,
  type NoteRecord,
  type FileRecord,
  type FileContentRecord,
  type SyncQueueRecord,
} from './database';

// Sync Manager
export {
  addToSyncQueue,
  getSyncQueue,
  getSyncQueueCount,
  removeFromSyncQueue,
  clearSyncQueue,
  registerSyncHandler,
  triggerSync,
  onSyncEvent,
  getSyncStatus,
  initSyncManager,
  type SyncActionType,
  type SyncAction,
  type SyncQueueItem,
  type SyncResult,
} from './syncManager';

// Email Store
export {
  cacheEmails,
  getCachedEmails,
  getCachedEmail,
  searchCachedEmails,
  updateCachedEmail,
  deleteCachedEmail,
  moveCachedEmail,
  cacheFolders,
  getCachedFolders,
  saveDraft,
  getDrafts,
  getDraft,
  deleteDraft,
  queueEmailSend,
  registerEmailSyncHandlers,
  clearEmailCache,
  getEmailCacheStats,
} from './emailStore';

// Notes Store
export {
  cacheNotes,
  getCachedNotes,
  getCachedNote,
  searchCachedNotes,
  createCachedNote,
  updateCachedNote,
  deleteCachedNote,
  archiveCachedNote,
  pinCachedNote,
  changeNoteCachedColor,
  registerNotesSyncHandlers,
  clearNotesCache,
  getNotesCacheStats,
} from './notesStore';

// Hooks
export {
  useNetworkStatus,
  useOnlineStatus,
  type NetworkStatus,
} from './useNetworkStatus';

// Offline API Client
export {
  createOfflineApi,
  type OfflineApi,
  type OfflineApiOptions,
  type ApiResponse,
} from './offlineApi';
