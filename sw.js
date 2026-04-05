const CACHE_NAME = 'todo-cache-v65';
const CACHE_PREFIX = 'todo-cache-';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css?v=20260330-problem-review-1',
  './app/app.js?v=20260331-recurrence-sync-fix-1',
  './app/db.js?v=20260328-sync-fix-2',
  './app/sync.js?v=20260331-recurrence-sync-fix-1',
  './app/storage-scope.js?v=20260328-sync-fix-2',
  './app/manifest.json?v=20260330-problem-review-1',
  './app/bgm.js?v=20260328-sync-fix-2',
  './assets/bgm/pinknoise.m4a',
  './app/icon.svg?v=2',
  './sw.js?v=20260331-recurrence-sync-fix-1'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Force network revalidation during install so a new worker does not
      // seed its cache from stale HTTP cache entries.
      await Promise.all(
        CORE_ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })))
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

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const networkResponse = await fetch(event.request, { cache: 'no-store' });
          if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
            await cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return cache.match('./index.html');
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      const networkPromise = fetch(event.request)
        .then(async response => {
          if (response && response.ok && response.status === 200) {
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        void networkPromise;
        return cached;
      }

      const networkResponse = await networkPromise;
      if (networkResponse) return networkResponse;
      return caches.match(event.request);
    })()
  );
});
