/**
 * Bheem Workspace - Service Worker
 * Provides offline support, caching, and push notifications
 */

const CACHE_NAME = 'bheem-workspace-v1';
const DYNAMIC_CACHE = 'bheem-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/mail',
  '/meet',
  '/docs',
  '/calendar',
  '/offline',
  '/manifest.json'
];

// API routes that should use network-first strategy
const API_ROUTES = [
  '/api/v1/auth',
  '/api/v1/mail',
  '/api/v1/calendar',
  '/api/v1/meet',
  '/api/v1/docs'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache failed:', error);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip WebSocket connections
  if (url.protocol === 'wss:' || url.protocol === 'ws:') {
    return;
  }

  // API requests - network first, fallback to cache
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - cache first, fallback to network
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }

    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful API responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(
      JSON.stringify({ error: 'Offline', message: 'Please check your connection' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Check if request is an API request
function isApiRequest(url) {
  return API_ROUTES.some(route => url.pathname.startsWith(route));
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {
    title: 'Bheem Workspace',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'bheem-notification'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard',
      timestamp: Date.now()
    },
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background sync event (for offline actions)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-mail') {
    event.waitUntil(syncMail());
  } else if (event.tag === 'sync-calendar') {
    event.waitUntil(syncCalendar());
  }
});

// Sync mail in background
async function syncMail() {
  try {
    const response = await fetch('/api/v1/mail/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('[SW] Mail sync completed:', response.ok);
  } catch (error) {
    console.error('[SW] Mail sync failed:', error);
  }
}

// Sync calendar in background
async function syncCalendar() {
  try {
    const response = await fetch('/api/v1/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('[SW] Calendar sync completed:', response.ok);
  } catch (error) {
    console.error('[SW] Calendar sync failed:', error);
  }
}

// Message handling
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

console.log('[SW] Service Worker loaded');
