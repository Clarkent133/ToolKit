const cacheName = 'my-pwa-cache-v1';
const staticAssets = [
  './', // Caches the root (your index.html)
  './index.html', // Explicitly cache index.html (redundant but clear)
  './manifest.json' // Ensure the manifest is cached
  // Add other static assets like './style.css' if you have them
];

// Install event: Cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(staticAssets);
      })
      .catch(err => console.error('[Service Worker] Error caching static assets:', err))
  );
  self.skipWaiting(); // Immediately activate the new service worker
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(existingCacheName => {
          if (existingCacheName !== cacheName) {
            console.log('[Service Worker] Clearing old cache:', existingCacheName);
            return caches.delete(existingCacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients as soon as possible
});

// Fetch event: Serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Not in cache - fetch from network
        return fetch(event.request).then(
          function(response) {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response can only be consumed
            // once.
            const responseToCache = response.clone();

            caches.open(cacheName)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            // Return the original response
            return response;
          }
        );
      })
  );
});
