/* The simple calculator's service worker (scope /tools/calculator). It keeps a copy of the calculator so it opens
   from a phone's home screen with no signal: the page, its scripts, styles and fonts, and the icons. Nothing else
   on the website passes through here. The page tells it which files it loaded (basic-calculator.tsx). */

const CACHE = 'calculator-v1';
const PAGE = '/tools/calculator';
const KEEP = [
  PAGE,
  '/calculator.webmanifest',
  '/images/tools/calculator/icon-192.png',
  '/images/tools/calculator/icon-512.png',
  '/images/tools/calculator/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(KEEP)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('calculator-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The page lists the scripts, styles and fonts it loaded; anything not kept yet is fetched into the copy, and
// those of older versions (not in its list) are cleared out.
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type !== 'keep' || !Array.isArray(msg.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const wanted = new Set(msg.urls.map((u) => new URL(u, self.location.origin).href));
      for (const u of wanted) {
        if (await cache.match(u)) continue;
        try {
          const res = await fetch(u);
          if (res.ok) await cache.put(u, res);
        } catch {}
      }
      for (const req of await cache.keys()) {
        if (new URL(req.url).pathname.startsWith('/_next/static/') && !wanted.has(req.url)) await cache.delete(req);
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The page: fresh when there is signal (new versions arrive), the saved copy when there is not.
  if (req.mode === 'navigate') {
    if (url.pathname !== PAGE) return;
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(PAGE, res.clone());
          return res;
        } catch {
          return (await caches.match(PAGE)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Scripts, styles, fonts and icons: their names change with each version, so the saved copy is safe to use.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/images/tools/calculator/') || url.pathname === '/calculator.webmanifest') {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req, { ignoreSearch: !url.pathname.startsWith('/_next/') });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      })(),
    );
  }
});
