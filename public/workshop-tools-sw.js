/* Workshop Tools service worker (scope /tools/workshop). It keeps a copy of the app so it opens with no signal
   on site: the app page, its scripts, styles and fonts, and the icons. Nothing else on the website passes
   through here. The page tells it which files it loaded (src/lib/workshop-tools/install.ts keepOffline). */

const CACHE = 'workshop-tools-v1';
const APP = '/tools/workshop/app';
const PAGE = '/tools/workshop';
const KEEP = [
  APP,
  '/workshop-tools.webmanifest',
  '/fonts/workshop/archivo-latin-wght.woff2',
  '/fonts/workshop/jetbrains-mono-latin-wght.woff2',
  '/images/tools/workshop/icon-192.png',
  '/images/tools/workshop/icon-512.png',
  '/images/tools/workshop/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(KEEP)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('workshop-tools-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The page lists what it loaded; anything not kept yet is fetched into the copy. From the app itself, the
// scripts and styles of older versions (not in its list) are cleared out.
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
      if (msg.prune) {
        for (const req of await cache.keys()) {
          const p = new URL(req.url).pathname;
          if (p.startsWith('/_next/static/') && !wanted.has(req.url)) await cache.delete(req);
        }
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The pages: fresh when there is signal (new versions arrive), the saved copy when there is not.
  if (req.mode === 'navigate') {
    if (!url.pathname.startsWith(PAGE)) return;
    const key = url.pathname.startsWith(APP) ? APP : PAGE;
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(key, res.clone());
          return res;
        } catch {
          const hit = await caches.match(key);
          if (hit) return hit;
          // no copy of the page they asked for: go to the app's (its own address, so it starts cleanly)
          if (key !== APP && (await caches.match(APP))) return Response.redirect(APP, 302);
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Scripts, styles, fonts and icons: their names change with each version, so the saved copy is safe to use.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/workshop/') || url.pathname.startsWith('/images/tools/workshop/') || url.pathname === '/workshop-tools.webmanifest') {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req, { ignoreSearch: url.pathname.startsWith('/images/') || url.pathname.startsWith('/fonts/') });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      })(),
    );
  }
});
