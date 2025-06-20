// service-worker.js

const cacheName = 'my-pwa-cache-v1'; // Increment this for new deployments!
const staticAssets = [
  './',
  './index.html',
  './manifest.json',
  './Editor/', // Directories need trailing slashes if they map to index.html
  './Editor/index.html',
  './Editor/tic80.js',
  './Editor/tic80.wasm',
  './export/1.1/html.zip',
  './export/1.1/linux',
  './export/1.1/win',
  './export/1.1/tic80.apk',
  './export/1.1/tic80.exe',
  './export/1.1/tic80.deb',
  './offline.html' // IMPORTANT: Add your offline fallback page here!
];

// Install event: Cache static assets (app shell)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => {
        console.log('[Service Worker] Caching static assets (app shell)');
        return cache.addAll(staticAssets);
      })
      .catch(err => console.error('[Service Worker] Error caching static assets during install:', err))
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

// Fetch event: Network First, then Cache Fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If the network request is successful, clone it and put it in cache
        // before returning the original response.
        // We only cache valid, basic (same-origin) successful responses.
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone(); // Clone response as it's a stream
          caches.open(cacheName)
            .then(cache => {
              cache.put(event.request, responseToCache);
              console.log(`[Service Worker] Cached new network response for: ${event.request.url}`);
            })
            .catch(err => console.warn(`[Service Worker] Failed to cache: ${event.request.url}`, err));
        }
        return response; // Return the network response (even if not cached, e.g., 404, cross-origin)
      })
      .catch(error => {
        // Network failed. Try to find the resource in the cache.
        console.warn(`[Service Worker] Network failed for ${event.request.url}. Falling back to cache.`, error);
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              console.log(`[Service Worker] Serving from cache for: ${event.request.url}`);
              return cachedResponse;
            }

            // If network failed AND not in cache, and it's a navigation request,
            // serve the offline fallback page.
            // This handles your "new endpoint not visited" scenario when offline.
            if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
                console.log('[Service Worker] No cache match for navigation, serving offline.html.');
                return caches.match('./offline.html'); // Ensure you have this page
            }

            // For other assets (JS, CSS, images) that failed network and are not in cache,
            // you could return a generic fallback, or just let the request fail.
            // console.log('[Service Worker] No cache match and network failed for non-navigation request:', event.request.url);
            // Optionally: return new Response('Network and cache unavailable.', { status: 503, statusText: 'Service Unavailable' });
            throw error; // Re-throw the error if no fallback is appropriate
          });
      })
  );
});
