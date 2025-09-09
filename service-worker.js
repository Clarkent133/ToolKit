const CACHE_NAME = 'my-app-cache-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json',
  '/qrCode.js',
  '/Editor/',
  '/Editor/index.html',
  '/Editor/tic80.js',
  '/Editor/tic80.wasm',
  '/export/1.1/html',
  '/export/1.1/linux',
  '/export/1.1/tic80.deb',
  '/export/1.1/tic80.exe',
  '/export/1.1/tic80.apk',
  '/export/1.1/win'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })().catch(err => {
    console.error('[SW] Precache failed:', err);
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.map((name) => (name !== CACHE_NAME ? caches.delete(name) : null))
    );
    await self.clients.claim();
  })());
});

const isSameOrigin = (url) => {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const sameOrigin = isSameOrigin(request.url);

  if (!sameOrigin) {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('Offline fetching third-party resource.', {
          status: 504,
          statusText: 'Gateway Timeout'
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone()).catch((err) => {
          console.warn('[SW] Cache put failed:', err);
        });
      }
      return networkResponse;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await caches.match('/index.html');
        if (shell) return shell;
      }
      return new Response(
        '<h1>Offline</h1><p>You are offline and this content is not available in the cache.</p>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
