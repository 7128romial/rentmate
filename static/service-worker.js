/* RentMate service worker — cache-first for static assets, network-first for APIs. */
const CACHE_VERSION = 'rm-v1';
const APP_SHELL = [
  '/',
  '/offline',
  '/static/css/style.css',
  '/static/js/swipe.js',
  '/static/js/rm-core.js',
  '/static/js/chat-socket.js',
  '/static/js/match-celebration.js',
  '/static/js/pwa-register.js',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Network-first for API calls — fall back to cache only on outright failure.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for image thumbs
  if (url.pathname.includes('/static/uploads/')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached ||
        fetch(event.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(event.request, copy));
          return res;
        })
      )
    );
    return;
  }

  // Stale-while-revalidate for app shell
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(event.request, copy));
        return res;
      }).catch(() => cached || caches.match('/offline'));
      return cached || fetchPromise;
    })
  );
});
