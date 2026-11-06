import { checkout, OrderError } from '@/lib/drawings-order';
import { stripeSetUp, StripeError } from '@/lib/stripe-checkout';
import { SITE_URL } from '@/lib/seo';

/* Drawings service, step 3: a Stripe Checkout page for the order's full price with VAT. The thank-you and cancel
   addresses come back to the site the visitor is on (a preview or localhost too), else the live site. */
export const maxDuration = 30;

function originOf(req: Request) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const proto = req.headers.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https');
  return /^(www\.rafcarpentry\.com|[a-z0-9-]+\.vercel\.app|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/.test(host) ? `${proto}://${host}` : SITE_URL;
}

export async function POST(req: Request) {
  if (!stripeSetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  let token: unknown;
  try {
    token = ((await req.json()) as { token?: unknown }).token;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  try {
    return Response.json(await checkout(token, originOf(req)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.code }, { status: e.status });
    if (e instanceof StripeError) {
      console.error('[drawings] checkout', e.code, e.detail);
      return Response.json({ error: e.code }, { status: 502 });
    }
    return Response.json({ error: 'error' }, { status: 502 });
  }
}
