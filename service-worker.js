const CACHE_NAME = 'my-app-cache-v1';

const urlsToPrecache = [
  '/',
  '/index.html',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json',
  '/qrCode.js',
  '/mathjax.js',
  '/Editor/',
  '/Editor/index.html',
  '/Editor/tic80.js',
  '/Editor/tic80.wasm',
  'export/1.1/html',
  'export/1.1/linux',
  'export/1.1/tic80.deb',
  'export/1.1/tic80.exe',
  'export/1.1/tic80.apk',
  'export/1.1/win'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.all(
          urlsToPrecache.map((url) => {
            return fetch(url)
              .then((response) => {
                if (!response.ok) {
                  throw new Error(`Request for ${url} failed with status ${response.status}`);
                }
                return cache.put(url, response);
              });
          })
        );
      })
      .catch((error) => {
        console.error('[Service Worker] Failed to pre-cache:', error);
      })
  );
});


self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return caches.match(event.request);
        }

        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        }).catch((error) => {
          console.error(`[Service Worker] Failed to cache ${event.request.url}:`, error);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('<h1>Offline</h1><p>You are offline and this content is not available in the cache.</p>', {
            headers: { 'Content-Type': 'text/html' }
          });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
