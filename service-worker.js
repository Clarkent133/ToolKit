// service-worker.js

const cacheName = 'toolkit-cache';

const staticAssets = [
  './',
  './index.html',
  './manifest.json',
  './Editor/',
  './Editor/index.html',
  './Editor/tic80.js',
  './Editor/tic80.wasm',
  './export/1.1/html.zip',
  './export/1.1/linux',
  './export/1.1/win',
  './export/1.1/tic80.apk',
  './export/1.1/tic80.exe',
  './export/1.1/tic80.deb'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => {
        return cache.addAll(staticAssets);
      })
      .catch(err => console.error(err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(existingCacheName => {
          if (existingCacheName !== cacheName) {
            return caches.delete(existingCacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(cacheName)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => console.warn(err));
        }
        return response;
      })
      .catch(error => {
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }

            if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
                return caches.match('./index.html');
            }

            throw error;
          });
      })
  );
});
