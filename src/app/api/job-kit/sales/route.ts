import { GUIDES, guideEmail, isGuide, saleOf, sessionOk } from '@/lib/guide-sales';
import { pinGuard } from '@/lib/job-kit-server';
import { outlookSetUp, sendNew } from '@/lib/outlook';
import { StatsError, statsRpc, statsSetUp } from '@/lib/site-stats-server';

/* Guide sales in the Job Kit, behind the PIN (src/app/job-kit/guide-sales.tsx). From rafsite.guide_sales through
   public.rafsite_guide (the visit counter's secret), with who bought it (name and email).
   { action: 'list' }        every sale, newest first (500 at most), and the totals
   { action: 'seen', upto }  Raf has seen the sales up to that time (ISO), so the To do line goes on every device
   { action: 'resend', session }  the buyer's email with their download link again, from info@ (to the address they
                             paid with); once a minute at most for a sale
   The list carries each sale's session id, which is the buyer's key to their download, so Raf can copy their link. */
const noStore = { 'Cache-Control': 'no-store' };
const resentAt = new Map<string, number>();

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  if (!statsSetUp()) return Response.json({ error: 'sales-not-set-up' }, { status: 503, headers: noStore });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  try {
    if (body.action === 'list') return Response.json(await statsRpc('rafsite_guide', { p_action: 'sales', p: {} }), { headers: noStore });
    if (body.action === 'seen') {
      // as the list gave it (to the microsecond, so the newest sale itself is included), checked first
      const upto = typeof body.upto === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?(Z|[+-]\d\d:?\d\d)$/.test(body.upto) && !Number.isNaN(Date.parse(body.upto)) ? body.upto : null;
      if (!upto) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      return Response.json(await statsRpc('rafsite_guide', { p_action: 'seen', p: { upto } }), { headers: noStore });
    }
    if (body.action === 'resend') {
      const session = body.session;
      if (!sessionOk(session)) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      if (Date.now() - (resentAt.get(session) ?? 0) < 60_000) return Response.json({ error: 'too-soon' }, { status: 429, headers: noStore });
      const sale = await saleOf(session);
      if (!sale.found) return Response.json({ error: 'sale-gone' }, { status: 404, headers: noStore });
      if (!sale.email) return Response.json({ error: 'no-email' }, { status: 409, headers: noStore });
      if (!outlookSetUp()) return Response.json({ error: 'outlook-not-set-up' }, { status: 503, headers: noStore });
      const id = isGuide(sale.product) ? sale.product : 'pax-guide';
      const link = `${new URL(req.url).origin}${GUIDES[id].page}/thanks?session_id=${encodeURIComponent(session)}`;
      resentAt.set(session, Date.now());
      try {
        await sendNew({ to: { email: sale.email, name: sale.name ?? '' }, ...guideEmail(id, link, sale.name ?? '') });
      } catch (e) {
        resentAt.delete(session);
        console.error('job-kit sales resend', e);
        return Response.json({ error: 'email-failed' }, { status: 502, headers: noStore });
      }
      await statsRpc('rafsite_guide', { p_action: 'emailed', p: { session } }).catch(() => null);
      return Response.json({ ok: true, at: new Date().toISOString() }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    if (!(e instanceof StatsError)) console.error('job-kit sales', e);
    return Response.json({ error: e instanceof StatsError ? e.code : 'stats-down' }, { status: 502, headers: noStore });
  }
}
