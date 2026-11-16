/* Khelog service worker — offline support
   Strategy:
   - Apne pages/JS/CSS: network-first (naya content turant), offline pe cache
   - CDN (Tailwind/fonts/icons/images): cache-first (fast) + background update */

const CACHE = 'gamehub-v4';
const SHELL = ['index.html', './', 'manifest.webmanifest', 'icon.svg', 'icon-maskable.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;

  const saveToCache = (res) => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(e.request, copy));
    }
    return res;
  };

  if (sameOrigin) {
    // Network-first: naya content hamesha, offline pe cache fallback
    e.respondWith(
      fetch(e.request)
        .then(saveToCache)
        .catch(() => caches.match(e.request).then((c) => c || caches.match('index.html')))
    );
  } else {
    // CDN: cache-first + background refresh
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const network = fetch(e.request)
          .then(saveToCache)
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
