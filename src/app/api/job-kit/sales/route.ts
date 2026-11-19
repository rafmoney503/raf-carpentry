import { pinGuard } from '@/lib/job-kit-server';
import { StatsError, statsRpc, statsSetUp } from '@/lib/site-stats-server';

/* Guide sales in the Job Kit, behind the PIN (src/app/job-kit/guide-sales.tsx). From rafsite.guide_sales through
   public.rafsite_guide (the visit counter's secret); the buyer's first name only, never their email.
   { action: 'list' }        every sale, newest first (500 at most), and the totals
   { action: 'seen', upto }  Raf has seen the sales up to that time (ISO), so the To do line goes on every device */
const noStore = { 'Cache-Control': 'no-store' };

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
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    if (!(e instanceof StatsError)) console.error('job-kit sales', e);
    return Response.json({ error: e instanceof StatsError ? e.code : 'stats-down' }, { status: 502, headers: noStore });
  }
}
