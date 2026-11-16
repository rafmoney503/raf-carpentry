import { guideSalesSetUp, MAX_DOWNLOADS, saleOf, sessionOk } from '@/lib/guide-sales';

/* The thank-you page asks here until Stripe's webhook has recorded the sale (src/lib/guide-sales.ts).
   GET ?session=<Checkout Session id> → { found, email, downloads, max }. */
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get('session') ?? '';
  if (!sessionOk(session)) return Response.json({ error: 'bad' }, { status: 400, headers });
  if (!guideSalesSetUp()) return Response.json({ error: 'not-set-up' }, { status: 503, headers });
  try {
    const sale = await saleOf(session);
    if (!sale.found) return Response.json({ found: false }, { headers });
    return Response.json({ found: true, product: sale.product, email: sale.email ?? '', downloads: sale.downloads ?? 0, max: MAX_DOWNLOADS }, { headers });
  } catch {
    return Response.json({ error: 'down' }, { status: 502, headers });
  }
}
