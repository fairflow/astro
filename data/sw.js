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
 *  - old caches cleaned on activate, and all lookups are scoped to the
 *    current VERSION's cache (not the global `caches.match`, which
 *    searches every cache regardless of name — a stray old-version cache
 *    would otherwise shadow fresh content indefinitely). VERSION is
 *    stamped with the build's git hash by vite.config.ts (see
 *    swVersionStamp) — every deploy gets a fresh cache automatically,
 *    including for unhashed data fetches (authoring batches, text packs)
 *    that would otherwise be stuck cache-first forever. The literal below
 *    is the dev-server/no-git fallback only; never hand-edit it for a
 *    real deploy.
 */
const VERSION = 'astrodynamics-v1';
const openCache = () => caches.open(VERSION);

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
          openCache().then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => openCache().then((c) => c.match(req)).then((hit) => hit ?? openCache().then((c) => c.match('.')))),
    );
    return;
  }

  event.respondWith(
    openCache().then((c) => c.match(req)).then((hit) => hit
      ?? fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          openCache().then((c) => c.put(req, copy));
        }
        return res;
      })),
  );
});
