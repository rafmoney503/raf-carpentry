import { confirmPaid, OrderError } from '@/lib/drawings-order';
import { sm8SetUp, Sm8Error } from '@/lib/servicem8';
import { stripeSetUp, StripeError } from '@/lib/stripe-checkout';
import { PACK } from '@/lib/drawings-service';

/* Drawings service, step 4, from the thank-you page: { session } is read back from Stripe; once paid, the payment and
   the emails (only the first time). Answers what the page shows: the pack, units, total and the due day. */
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!stripeSetUp() || !sm8SetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  let session = '';
  try {
    session = String(((await req.json()) as { session?: unknown }).session ?? '');
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  try {
    const p = await confirmPaid(session);
    return Response.json({ ok: true, pack: PACK[p.pack].name, units: p.units, total: p.total, due: p.due, email: p.email, name: p.name.split(' ')[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.code }, { status: e.status });
    if (e instanceof StripeError) return Response.json({ error: e.code }, { status: e.status === 404 ? 404 : 502 });
    const code = e instanceof Sm8Error ? e.code : 'error';
    console.error('[drawings] paid', code, e instanceof Sm8Error ? e.detail : e);
    return Response.json({ error: code }, { status: 502 });
  }
}
