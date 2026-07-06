/*
 * Astrodynamics service worker — hand-rolled, no dependencies.
 *
 * Strategy:
 *  - navigations (index.html): network-first, cache fallback — so new
 *    builds are picked up when online, and the app still opens offline;
 *  - everything else same-origin (hashed JS/CSS, ephemeris packs,
 *    gazetteer, text packs, icons): cache-first, network fallback —
 *    hashed asset names make this safe, and the data files are
 *    versioned by content in practice;
 *  - old caches cleaned on activate. Bump VERSION to force a full
 *    refetch after breaking data-layout changes.
 */
const VERSION = 'astrodynamics-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(['.', 'manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match('.'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit
      ?? fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })),
  );
});
