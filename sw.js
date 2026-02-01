// ============================================
// SERVICE WORKER — Pink Pony Fractals
// 
// Why a service worker?
// 1. Enables "Add to Home Screen" / install prompt
// 2. Caches files so the app works offline
// 3. Required for PWA installability
//
// Strategy: Cache-first for app shell files,
// network-first for Google Fonts (so they update
// but still work offline if cached).
// ============================================

const CACHE_NAME = 'pink-pony-v8';

// Files that make up the "app shell" — everything
// needed to render the app without network access
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ---- INSTALL EVENT ----
// Fires when the SW is first registered.
// We pre-cache the app shell so it's ready for offline use.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  // Skip waiting: activate immediately instead of
  // waiting for all tabs to close
  self.skipWaiting();
});

// ---- ACTIVATE EVENT ----
// Fires when a new SW takes over. We clean up
// old caches here so stale versions don't linger.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  // Claim all open clients so the SW controls
  // pages immediately (no reload needed)
  self.clients.claim();
});

// ---- FETCH EVENT ----
// Intercepts every network request. Strategy:
// 1. Try cache first (fast, works offline)
// 2. Fall back to network if not cached
// 3. Cache successful network responses for next time
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        // Don't cache non-OK responses or non-GET requests
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }

        // Clone the response — one copy goes to cache,
        // one goes to the browser. Responses are streams
        // and can only be consumed once.
        const responseClone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      }).catch(() => {
        // Network failed and nothing in cache —
        // for navigation requests, we could show an
        // offline page here, but our app shell should
        // already be cached from install.
      });
    })
  );
});
