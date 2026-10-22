import { cleanHit, recordHere, ROBOT_UA, statsRpc, statsSetUp } from '@/lib/site-stats-server';

/* The website's visitor counter (src/components/SiteStats.tsx) sends each page view here, as it starts and again when
   it's left. Always answers 204, so nothing about the stats can break a page. Nothing is recorded off
   www.rafcarpentry.com, from robots, or when the stats database isn't set up (src/lib/site-stats-server.ts). */
export const maxDuration = 10;

const done = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if (!statsSetUp() || !recordHere(req.headers.get('host') || '')) return done();
  const ua = req.headers.get('user-agent') || '';
  if (!ua || ROBOT_UA.test(ua)) return done();
  // only from the website's own pages
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return done();
  const text = await req.text().catch(() => '');
  if (!text || text.length > 40_000) return done();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return done();
  }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  // roughly where, from the connection (Vercel's own lookup): town or city, the region, a UK postcode's first half
  const h = (k: string) => req.headers.get(k) || '';
  const p = cleanHit(raw, {
    ip,
    ua,
    country: h('x-vercel-ip-country').toUpperCase(),
    city: h('x-vercel-ip-city'),
    region: h('x-vercel-ip-country-region'),
    postal: h('x-vercel-ip-postal-code'),
  });
  if (!p) return done();
  try {
    await statsRpc('rafsite_hit_place', { p }, 4000);
  } catch {
    /* the stats are best effort */
  }
  return done();
}
