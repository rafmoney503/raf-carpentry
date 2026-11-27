import { connectOrigin } from '@/lib/meta-origin';
import { disconnectEtsy, etsyLoginUrl, EtsyError, etsyMissing, etsyOverview, etsySeen } from '@/lib/etsy';
import { pinGuard } from '@/lib/job-kit-server';

/* Etsy in the Job Kit, behind the PIN (src/lib/etsy.ts, the Etsy box on Guide sales).
   { action: 'status' }        the shop, its newest 50 orders and 10 reviews, and the newest order Raf has seen
   { action: 'start' }         Etsy's 'allow access' page to open (the login comes back to ./callback)
   { action: 'seen', upto }    orders up to that time (ISO) have been seen, so the To do line goes on every device
   { action: 'disconnect' }    forget the kept token (Etsy keeps the shop as it is) */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  try {
    if (body.action === 'status') return Response.json(await etsyOverview(), { headers: noStore });
    if (body.action === 'start') return Response.json({ url: etsyLoginUrl(connectOrigin(req)) }, { headers: noStore });
    if (body.action === 'seen') {
      const upto = typeof body.upto === 'string' && !Number.isNaN(Date.parse(body.upto)) && /^\d{4}-\d\d-\d\dT/.test(body.upto) ? body.upto : null;
      if (!upto) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      return Response.json({ at: await etsySeen(upto) }, { headers: noStore });
    }
    if (body.action === 'disconnect') {
      await disconnectEtsy();
      return Response.json({ ok: true }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    if (e instanceof EtsyError) return Response.json({ error: e.code, detail: e.code === 'etsy-not-set-up' ? etsyMissing().join(', ') : e.detail }, { status: e.status, headers: noStore });
    console.error('job-kit etsy', e);
    return Response.json({ error: 'etsy-error' }, { status: 502, headers: noStore });
  }
}
