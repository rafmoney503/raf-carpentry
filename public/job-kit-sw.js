/* Job Kit service worker (scope /job-kit). It keeps a copy of the app itself so it opens with no signal,
   on a job with no reception: the page, its scripts, styles and fonts. Photos and clips never pass through
   here; they live in the app's own storage until they are sent. Uploads (/api/) always go to the network. */

const CACHE = 'job-kit-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/job-kit', '/job-kit.webmanifest'])).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('job-kit-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // The page: fresh when there is signal (new versions arrive), the saved copy when there is not.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(CACHE)).put('/job-kit', res.clone());
          return res;
        } catch {
          return (await caches.match('/job-kit')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Scripts, styles, fonts and icons: these file names change with each version, so the saved copy is safe.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/images/job-kit/') || url.pathname === '/job-kit.webmanifest') {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      })(),
    );
  }
});
