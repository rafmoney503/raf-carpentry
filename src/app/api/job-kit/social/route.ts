import { guard } from '@/lib/job-kit-server';
import { connectOrigin } from '@/lib/meta-origin';
import { disconnect, loginUrl, markSeen, MetaError, metaMissing, metaSetUp, overview, pickPage, replyTo } from '@/lib/meta-social';

/* The Job Kit's Social screen (src/lib/meta-social.ts), behind the PIN.
   { action: 'overview' }                        Instagram and Facebook: followers (with their history), latest posts,
                                                 comments with their replies; or { connected: false }
   { action: 'start', again? }                   the Facebook login address to open (again: ask for what was turned down)
   { action: 'pick', page }                      which Page (when Raf runs more than one)
   { action: 'seen', at }                        the newest comment Raf has had in front of him
   { action: 'reply', platform, id, text }       a reply under a comment, only because Raf pressed Send reply
   { action: 'disconnect' }                      forget the tokens (Facebook keeps the app until removed there) */
export const maxDuration = 30;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const idOk = (v: string) => /^[0-9_]{3,80}$/.test(v);
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  if (body.action === 'overview' || body.action === 'status') {
    try {
      return Response.json(await overview(), { headers: noStore });
    } catch (e) {
      if (e instanceof MetaError) return Response.json({ error: e.code, detail: e.detail }, { status: e.code === 'meta-busy' ? 503 : 502 });
      console.error('job-kit social', e);
      return Response.json({ error: 'meta-error' }, { status: 502 });
    }
  }
  if (!metaSetUp()) return Response.json({ error: 'meta-not-set-up', detail: metaMissing().join(', ') }, { status: 503 });
  try {
    if (body.action === 'start') return Response.json({ url: loginUrl(connectOrigin(req), body.again === true) }, { headers: noStore });
    if (body.action === 'pick') {
      const page = str(body.page, 80);
      if (!idOk(page)) return Response.json({ error: 'bad' }, { status: 400 });
      await pickPage(page);
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (body.action === 'seen') {
      const at = Math.floor(Number(body.at) || 0);
      if (at > 0) await markSeen(at);
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (body.action === 'reply') {
      const platform = body.platform === 'ig' || body.platform === 'fb' ? body.platform : null;
      const id = str(body.id, 80);
      const text = str(body.text, 2000);
      if (!platform || !idOk(id)) return Response.json({ error: 'bad' }, { status: 400 });
      if (!text) return Response.json({ error: 'missing-text' }, { status: 400 });
      return Response.json(await replyTo(platform, id, text), { headers: noStore });
    }
    if (body.action === 'disconnect') {
      await disconnect();
      return Response.json({ ok: true }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    if (e instanceof MetaError) return Response.json({ error: e.code, detail: e.detail }, { status: e.code === 'meta-busy' ? 503 : 502 });
    console.error('job-kit social', e);
    return Response.json({ error: 'meta-error' }, { status: 502 });
  }
}
