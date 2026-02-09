const CACHE_NAME = 'todo-cache-v25';
const CACHE_PREFIX = 'todo-cache-';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app/app.js',
  './app/db.js',
  './app/sync.js',
  './app/manifest.json',
  './app/bgm.js',
  './app/icon.svg',
  './sw.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
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
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
