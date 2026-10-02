/* Delve service worker: cache the app shell, and the on-device narrator library once it has been fetched.
   Model weights are cached by WebLLM itself (Cache Storage), not here. */
const CACHE = 'delve-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('delve-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    /* app shell: instant from cache, refreshed in the background */
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
          return res;
        }).catch(() => hit || caches.match('index.html'));
        return hit || net;
      })
    );
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    /* WebLLM library modules: cache-first so the narrator loads offline after the first time */
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      })
    );
  }
});
