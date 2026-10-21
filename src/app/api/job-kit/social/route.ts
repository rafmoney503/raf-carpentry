import { guard } from '@/lib/job-kit-server';
import { connectOrigin } from '@/lib/meta-origin';
import { disconnectMeta, metaLoginUrl, MetaError, metaMissing, metaSetUp, pickPage, replyMeta } from '@/lib/meta-social';
import { markSeen, overview } from '@/lib/social';
import { StoreError } from '@/lib/social-store';
import { disconnectThreads, replyThreads, ThreadsError, threadsLoginUrl, threadsMissing, threadsSetUp } from '@/lib/threads-social';

/* The Job Kit's Social screen (src/lib/social.ts), behind the PIN.
   { action: 'overview' }                        Instagram, Facebook and Threads: each account's state, followers (with
                                                 their history), latest posts, comments with their replies
   { action: 'start', platform?, again? }        the login address to open: Facebook (meta, the default; again: ask for
                                                 what was turned down) or Threads
   { action: 'pick', page }                      which Facebook Page (when Raf runs more than one)
   { action: 'seen', at }                        the newest comment Raf has had in front of him
   { action: 'reply', platform, id, text }       a reply under a comment, only because Raf pressed Send reply
   { action: 'disconnect', platform? }           forget the tokens (meta or threads; the platform keeps the app until
                                                 removed there) */
export const maxDuration = 30;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const idOk = (v: string) => /^[0-9_]{3,80}$/.test(v);
const noStore = { 'Cache-Control': 'no-store' };

const fail = (e: unknown) => {
  if (e instanceof MetaError || e instanceof ThreadsError) return Response.json({ error: e.code, detail: e.detail }, { status: /busy$/.test(e.code) ? 503 : 502 });
  if (e instanceof StoreError) return Response.json({ error: 'social-store' }, { status: 503 });
  console.error('job-kit social', e);
  return Response.json({ error: 'social-error' }, { status: 502 });
};

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const threads = body.platform === 'threads' || body.platform === 'th';
  try {
    if (body.action === 'overview' || body.action === 'status') return Response.json(await overview(), { headers: noStore });
    if (body.action === 'seen') {
      const at = Math.floor(Number(body.at) || 0);
      if (at > 0) await markSeen(at);
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (threads) {
      if (!threadsSetUp()) return Response.json({ error: 'threads-not-set-up', detail: threadsMissing().join(', ') }, { status: 503 });
      if (body.action === 'start') return Response.json({ url: threadsLoginUrl(connectOrigin(req)) }, { headers: noStore });
      if (body.action === 'reply') {
        const id = str(body.id, 80);
        const text = str(body.text, 500); // Threads takes up to 500 characters
        if (!idOk(id)) return Response.json({ error: 'bad' }, { status: 400 });
        if (!text) return Response.json({ error: 'missing-text' }, { status: 400 });
        return Response.json(await replyThreads(id, text), { headers: noStore });
      }
      if (body.action === 'disconnect') {
        await disconnectThreads();
        return Response.json({ ok: true }, { headers: noStore });
      }
      return Response.json({ error: 'bad' }, { status: 400 });
    }
    if (!metaSetUp()) return Response.json({ error: 'meta-not-set-up', detail: metaMissing().join(', ') }, { status: 503 });
    if (body.action === 'start') return Response.json({ url: metaLoginUrl(connectOrigin(req), body.again === true) }, { headers: noStore });
    if (body.action === 'pick') {
      const page = str(body.page, 80);
      if (!idOk(page)) return Response.json({ error: 'bad' }, { status: 400 });
      await pickPage(page);
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (body.action === 'reply') {
      const platform = body.platform === 'ig' || body.platform === 'fb' ? body.platform : null;
      const id = str(body.id, 80);
      const text = str(body.text, 2000);
      if (!platform || !idOk(id)) return Response.json({ error: 'bad' }, { status: 400 });
      if (!text) return Response.json({ error: 'missing-text' }, { status: 400 });
      return Response.json(await replyMeta(platform, id, text), { headers: noStore });
    }
    if (body.action === 'disconnect') {
      await disconnectMeta();
      return Response.json({ ok: true }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
