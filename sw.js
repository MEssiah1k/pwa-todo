const CACHE_NAME = 'todo-cache-v73';
const CACHE_PREFIX = 'todo-cache-';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css?v=20260602-chip-2',
  './app/app.js?v=20260602-chip-2',
  './app/db.js?v=20260328-sync-fix-2',
  './app/sync.js?v=20260601-sync-fix-1',
  './app/storage-scope.js?v=20260328-sync-fix-2',
  './app/manifest.json?v=20260330-problem-review-1',
  './app/bgm.js?v=20260328-sync-fix-2',
  './assets/bgm/pinknoise.m4a',
  './app/icon.svg?v=2',
  './sw.js?v=20260605-cache-fix-1'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        CORE_ASSETS.map(url =>
          cache.add(url).catch(() => {})
        )
      );
      const clients = await self.clients.matchAll({ type: 'window' });
      if (self.registration.active && clients.length) {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATE_READY' }));
      }
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key =>
          key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
            ? caches.delete(key)
            : null
        )
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (event.request.headers.has('range')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) {
        // Background update — don't await, serve cache immediately
        fetch(event.request)
          .then(response => {
            if (response && response.ok && response.status === 200) {
              cache.put(event.request, response.clone());
            }
          })
          .catch(() => {});
        return cached;
      }
      // Not cached — try network, then fall back to index.html for navigations
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        if (event.request.mode === 'navigate') {
          const fallback = await cache.match('./index.html');
          if (fallback) return fallback;
        }
        return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
      }
    })()
  );
});
