import { dbReady, hqApi, type PushSub } from '@/lib/db';
import { morningNotes } from '@/lib/morning';
import { pushReady, sendTo } from '@/lib/push';
import { getReport } from '@/lib/report';

/* Alerts on this phone: { action: 'add', sub, label } | { action: 'off', endpoint } | { action: 'test', endpoint }
   | { action: 'list' }. Behind the sign-in (proxy). */
export async function POST(req: Request) {
  if (!dbReady() || !pushReady()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  let body: { action?: string; sub?: PushSub['sub']; endpoint?: string; label?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  try {
    if (body.action === 'add') {
      const sub = body.sub;
      if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) {
        return Response.json({ error: 'bad' }, { status: 400 });
      }
      await hqApi('push_add', { endpoint: sub.endpoint, sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, label: String(body.label ?? '').slice(0, 60) });
      return Response.json({ ok: true });
    }
    if (body.action === 'off' && body.endpoint) {
      await hqApi('push_off', { endpoint: body.endpoint });
      return Response.json({ ok: true });
    }
    if (body.action === 'list') {
      const subs = await hqApi<PushSub[]>('push_list');
      return Response.json({ devices: subs.map((s) => ({ endpoint: s.endpoint, label: s.label, created: s.created_at, lastOk: s.last_ok })) });
    }
    if (body.action === 'test' && body.endpoint) {
      const subs = (await hqApi<PushSub[]>('push_list')).filter((s) => s.endpoint === body.endpoint);
      if (!subs.length) return Response.json({ error: 'not-on' }, { status: 404 });
      const r = await getReport();
      const notes = morningNotes(r, Date.now() - 24 * 3600 * 1000).slice(0, 1);
      const out = await sendTo(subs, notes);
      return Response.json(out);
    }
  } catch (e) {
    return Response.json({ error: 'store', detail: (e as Error).message }, { status: 502 });
  }
  return Response.json({ error: 'bad' }, { status: 400 });
}
