/* The address the Facebook login comes back to has to match the one it was opened with, letter for letter, and be
   listed in the Meta app. Both are worked out from the request's own host, so on rafcarpentry.com it's
   https://www.rafcarpentry.com (rafcarpentry.com redirects there before anything runs). */
export function connectOrigin(req: Request) {
  const u = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || u.host;
  const proto = req.headers.get('x-forwarded-proto') || u.protocol.replace(':', '');
  return `${proto}://${host}`;
}
