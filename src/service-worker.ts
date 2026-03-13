/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Bump this version on every deploy to force cache invalidation
const CACHE_VERSION = Date.now().toString();
const CACHE_NAME = `gestao-ac-v${CACHE_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  // Skip waiting immediately to activate new SW fast
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // Always network-first for API calls and OAuth
  if (event.request.url.includes('supabase') || event.request.url.includes('/~oauth')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For navigation requests (HTML pages), always go network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/index.html')).then(r => r || new Response('Offline', { status: 503 })))
    );
    return;
  }
  
  // Network first, fallback to cache for assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  // Delete ALL old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for skip waiting message from UpdateNotification
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Force update: clear all caches and reload clients
  if (event.data?.type === 'FORCE_UPDATE') {
    caches.keys().then((names) => Promise.all(names.map(n => caches.delete(n))))
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach(c => c.navigate(c.url)));
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'Nova notificação do AC Service Pro',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: data.tag || 'general',
    data: {
      dateOfArrival: Date.now(),
      url: data.url || '/'
    }
  } as NotificationOptions;

  event.waitUntil(
    self.registration.showNotification(data.title || 'AC Service Pro', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
