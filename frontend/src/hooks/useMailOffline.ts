/**
 * Bheem Mail - Offline Support Hook
 * Phase 5.2: Offline Support with Service Worker
 */
import { useEffect, useState, useCallback, useRef } from 'react';

export interface OfflineStatus {
  /** Whether the browser is online */
  isOnline: boolean;
  /** Whether service worker is registered and active */
  isServiceWorkerActive: boolean;
  /** Number of actions queued for sync */
  queuedActions: number;
  /** Last sync timestamp */
  lastSyncTime: Date | null;
}

export interface CachedEmail {
  id: string;
  message_id?: string;
  subject: string;
  from: any;
  date: string;
  snippet?: string;
  is_read?: boolean;
  is_starred?: boolean;
}

export interface UseMailOfflineOptions {
  /** Called when an action is synced */
  onActionSynced?: (actionId: string) => void;
  /** Called when an action is queued */
  onActionQueued?: (actionId: string) => void;
  /** Called when online status changes */
  onOnlineStatusChange?: (isOnline: boolean) => void;
}

export interface UseMailOfflineReturn {
  /** Current offline status */
  status: OfflineStatus;
  /** Cache emails for offline access */
  cacheEmails: (emails: CachedEmail[], folder: string) => void;
  /** Get cached emails for a folder */
  getCachedEmails: (folder: string) => Promise<CachedEmail[]>;
  /** Clear all cached data */
  clearCache: () => void;
  /** Check if a response is from cache */
  isCachedResponse: (response: Response) => boolean;
  /** Register service worker (if not already) */
  registerServiceWorker: () => Promise<boolean>;
  /** Unregister service worker */
  unregisterServiceWorker: () => Promise<boolean>;
}

const SERVICE_WORKER_PATH = '/mail-sw.js';

export function useMailOffline(options: UseMailOfflineOptions = {}): UseMailOfflineReturn {
  const { onActionSynced, onActionQueued, onOnlineStatusChange } = options;

  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isServiceWorkerActive: false,
    queuedActions: 0,
    lastSyncTime: null,
  });

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      onOnlineStatusChange?.(true);
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
      onOnlineStatusChange?.(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOnlineStatusChange]);

  // Handle service worker messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'ACTION_SYNCED':
          onActionSynced?.(payload.actionId);
          setStatus((prev) => ({
            ...prev,
            queuedActions: Math.max(0, prev.queuedActions - 1),
            lastSyncTime: new Date(),
          }));
          break;

        case 'ACTION_QUEUED':
          onActionQueued?.(payload.actionId);
          setStatus((prev) => ({
            ...prev,
            queuedActions: payload.queueLength,
          }));
          break;

        case 'OFFLINE_STATUS':
          setStatus((prev) => ({
            ...prev,
            isOnline: payload.isOnline,
            queuedActions: payload.queuedActions,
          }));
          break;

        case 'CACHED_EMAILS':
          // Handled by getCachedEmails callback
          break;
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [onActionSynced, onActionQueued]);

  // Register service worker on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }

    return () => {
      // Don't unregister on unmount - keep service worker active
    };
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) {
      console.warn('[useMailOffline] Service workers not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
        scope: '/mail',
      });

      registrationRef.current = registration;

      // Check if active
      const isActive = !!registration.active;
      setStatus((prev) => ({ ...prev, isServiceWorkerActive: isActive }));

      // Listen for state changes
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            setStatus((prev) => ({ ...prev, isServiceWorkerActive: true }));
          }
        });
      });

      console.log('[useMailOffline] Service worker registered');
      return true;
    } catch (error) {
      console.error('[useMailOffline] Service worker registration failed:', error);
      return false;
    }
  }, []);

  // Unregister service worker
  const unregisterServiceWorker = useCallback(async (): Promise<boolean> => {
    if (!registrationRef.current) {
      return false;
    }

    try {
      await registrationRef.current.unregister();
      registrationRef.current = null;
      setStatus((prev) => ({ ...prev, isServiceWorkerActive: false }));
      console.log('[useMailOffline] Service worker unregistered');
      return true;
    } catch (error) {
      console.error('[useMailOffline] Service worker unregistration failed:', error);
      return false;
    }
  }, []);

  // Cache emails for offline access
  const cacheEmails = useCallback((emails: CachedEmail[], folder: string) => {
    if (!navigator.serviceWorker?.controller) {
      console.warn('[useMailOffline] No active service worker');
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_EMAILS',
      payload: { emails, folder },
    });
  }, []);

  // Get cached emails for a folder
  const getCachedEmails = useCallback(async (folder: string): Promise<CachedEmail[]> => {
    if (!navigator.serviceWorker?.controller) {
      return [];
    }

    return new Promise((resolve) => {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'CACHED_EMAILS' && event.data.payload.folder === folder) {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          resolve(event.data.payload.emails || []);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'GET_CACHED_EMAILS',
          payload: { folder },
        });
      } else {
        // No controller available, resolve with empty array
        navigator.serviceWorker.removeEventListener('message', handleMessage);
        resolve([]);
        return;
      }

      // Timeout after 5 seconds
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
        resolve([]);
      }, 5000);
    });
  }, []);

  // Clear all cached data
  const clearCache = useCallback(() => {
    if (!navigator.serviceWorker?.controller) {
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE',
    });
  }, []);

  // Check if a response is from cache
  const isCachedResponse = useCallback((response: Response): boolean => {
    return response.headers.get('X-Bheem-Cached') === 'true';
  }, []);

  return {
    status,
    cacheEmails,
    getCachedEmails,
    clearCache,
    isCachedResponse,
    registerServiceWorker,
    unregisterServiceWorker,
  };
}

export default useMailOffline;
