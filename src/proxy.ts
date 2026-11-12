import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, sessionOk } from './lib/session';

/* Every page and API asks for the sign-in, except the sign-in itself, the morning job and the buzz from the Job Kit
   (each has its own secret) and the files a phone needs to add HQ to its home screen. */
export async function proxy(req: NextRequest) {
  if (await sessionOk(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'sign-in' }, { status: 401 });
  const to = new URL('/login', req.url);
  if (pathname !== '/') to.searchParams.set('next', pathname + search);
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ['/((?!login|api/login|api/cron|api/notify|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|icons/).*)'],
};
