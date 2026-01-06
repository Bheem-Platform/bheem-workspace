/**
 * Bheem Mail - Service Worker for Offline Support
 * Phase 5.2: Enterprise Feature
 *
 * Features:
 * - Cache recent emails for offline viewing
 * - Queue sends when offline
 * - Sync when back online
 * - Background sync support
 */

const CACHE_VERSION = 'bheem-mail-v1';
const MAIL_CACHE = 'bheem-mail-cache-v1';
const STATIC_CACHE = 'bheem-static-v1';

// What to cache
const STATIC_ASSETS = [
  '/mail',
  '/mail/inbox',
  '/mail/sent',
  '/mail/drafts',
];

const API_CACHE_PATTERNS = [
  /\/api\/v1\/mail\/messages/,
  /\/api\/v1\/mail\/folders/,
  /\/api\/v1\/mail\/session\/status/,
];

// Maximum items to cache
const MAX_CACHED_EMAILS = 100;
const MAX_CACHED_FOLDERS = 10;

// Offline queue for pending actions
let offlineQueue = [];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Mail SW] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Mail SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );

  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[Mail SW] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('bheem-') && name !== MAIL_CACHE && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );

  // Take control immediately
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (but handle offline queue)
  if (request.method !== 'GET') {
    if (!navigator.onLine) {
      event.respondWith(handleOfflineAction(request));
    }
    return;
  }

  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/v1/mail/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Static assets - cache first
  if (url.pathname.startsWith('/mail') || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Mail SW] Background sync:', event.tag);

  if (event.tag === 'mail-outbox') {
    event.waitUntil(processOfflineQueue());
  }
});

// Push notification for new emails
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  if (data.type === 'new_email') {
    event.waitUntil(
      self.registration.showNotification('New Email', {
        body: data.subject || 'You have a new email',
        icon: '/mail-icon.png',
        badge: '/mail-badge.png',
        tag: 'new-email',
        data: {
          url: '/mail/inbox',
          messageId: data.message_id,
        },
      })
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  if (data && data.url) {
    event.waitUntil(
      clients.openWindow(data.url)
    );
  }
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'CACHE_EMAILS':
      cacheEmails(payload.emails, payload.folder);
      break;

    case 'CLEAR_CACHE':
      clearCache();
      break;

    case 'GET_CACHED_EMAILS':
      getCachedEmails(payload.folder).then((emails) => {
        event.source.postMessage({
          type: 'CACHED_EMAILS',
          payload: { emails, folder: payload.folder },
        });
      });
      break;

    case 'QUEUE_ACTION':
      queueOfflineAction(payload);
      break;

    case 'GET_OFFLINE_STATUS':
      event.source.postMessage({
        type: 'OFFLINE_STATUS',
        payload: {
          isOnline: navigator.onLine,
          queuedActions: offlineQueue.length,
        },
      });
      break;
  }
});

// ===========================================
// Cache Strategies
// ===========================================

async function networkFirstWithCache(request) {
  const cache = await caches.open(MAIL_CACHE);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      // Clone response before caching
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[Mail SW] Network failed, trying cache:', request.url);

    // Network failed, try cache
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Add header to indicate cached response
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Bheem-Cached', 'true');

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    }

    // Return offline page or error
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'You are offline and this content is not cached.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Return cached response and update cache in background
    fetchAndCache(request);
    return cachedResponse;
  }

  return fetchAndCache(request);
}

async function fetchAndCache(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return offline fallback
    return new Response('Offline', { status: 503 });
  }
}

// ===========================================
// Email Caching
// ===========================================

async function cacheEmails(emails, folder) {
  const cache = await caches.open(MAIL_CACHE);
  const cacheKey = `/api/v1/mail/cache/${folder}`;

  // Get existing cached emails
  let cachedData = await getCachedData(cacheKey) || { emails: [], lastUpdated: null };

  // Merge new emails (avoid duplicates)
  const existingIds = new Set(cachedData.emails.map((e) => e.id || e.message_id));
  const newEmails = emails.filter((e) => !existingIds.has(e.id || e.message_id));

  cachedData.emails = [...newEmails, ...cachedData.emails].slice(0, MAX_CACHED_EMAILS);
  cachedData.lastUpdated = new Date().toISOString();

  // Save to cache
  const response = new Response(JSON.stringify(cachedData), {
    headers: { 'Content-Type': 'application/json' },
  });

  await cache.put(cacheKey, response);
  console.log(`[Mail SW] Cached ${emails.length} emails for ${folder}`);
}

async function getCachedEmails(folder) {
  const cacheKey = `/api/v1/mail/cache/${folder}`;
  const cachedData = await getCachedData(cacheKey);

  return cachedData ? cachedData.emails : [];
}

async function getCachedData(cacheKey) {
  const cache = await caches.open(MAIL_CACHE);
  const response = await cache.match(cacheKey);

  if (response) {
    return response.json();
  }

  return null;
}

// ===========================================
// Offline Queue
// ===========================================

async function handleOfflineAction(request) {
  const action = {
    id: Date.now().toString(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: new Date().toISOString(),
  };

  queueOfflineAction(action);

  return new Response(
    JSON.stringify({
      queued: true,
      message: 'Action queued for when you are back online.',
      actionId: action.id,
    }),
    {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function queueOfflineAction(action) {
  offlineQueue.push(action);
  saveOfflineQueue();

  // Try to register background sync
  if ('sync' in self.registration) {
    self.registration.sync.register('mail-outbox');
  }

  // Notify clients
  notifyClients({
    type: 'ACTION_QUEUED',
    payload: { actionId: action.id, queueLength: offlineQueue.length },
  });
}

async function processOfflineQueue() {
  console.log('[Mail SW] Processing offline queue:', offlineQueue.length, 'items');

  const queue = [...offlineQueue];
  offlineQueue = [];

  for (const action of queue) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body || undefined,
      });

      if (response.ok) {
        console.log('[Mail SW] Synced action:', action.id);
        notifyClients({
          type: 'ACTION_SYNCED',
          payload: { actionId: action.id },
        });
      } else {
        // Re-queue failed actions
        offlineQueue.push(action);
      }
    } catch (error) {
      console.error('[Mail SW] Failed to sync action:', action.id, error);
      offlineQueue.push(action);
    }
  }

  saveOfflineQueue();
}

function saveOfflineQueue() {
  // Store queue in IndexedDB for persistence
  // (Simplified - would use IndexedDB in production)
  try {
    // Use cache API as simple storage
    caches.open(MAIL_CACHE).then((cache) => {
      const response = new Response(JSON.stringify(offlineQueue), {
        headers: { 'Content-Type': 'application/json' },
      });
      cache.put('/offline-queue', response);
    });
  } catch (error) {
    console.error('[Mail SW] Failed to save offline queue:', error);
  }
}

async function loadOfflineQueue() {
  try {
    const cache = await caches.open(MAIL_CACHE);
    const response = await cache.match('/offline-queue');

    if (response) {
      offlineQueue = await response.json();
    }
  } catch (error) {
    console.error('[Mail SW] Failed to load offline queue:', error);
  }
}

// Load queue on startup
loadOfflineQueue();

// ===========================================
// Utilities
// ===========================================

async function clearCache() {
  await caches.delete(MAIL_CACHE);
  offlineQueue = [];
  saveOfflineQueue();
  console.log('[Mail SW] Cache cleared');
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });

  for (const client of clients) {
    client.postMessage(message);
  }
}

// Online/offline detection
self.addEventListener('online', () => {
  console.log('[Mail SW] Back online, processing queue...');
  processOfflineQueue();
});
