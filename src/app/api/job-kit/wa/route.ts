import { pinGuard } from '@/lib/job-kit-server';
import { createTemplate, d360SetUp, D360Error, getWebhook, listTemplates, sendTemplate, sendText, setWebhook } from '@/lib/d360';
import { hookUrl, keepFile, runRead, waRpc, waStoreSetUp } from '@/lib/wa-server';
import { digits, fillTemplate, TEMPLATES, windowLeft, type LiveMsg } from '@/lib/wa-live';
import { SyncError } from '@/lib/job-kit-sync-server';

/* Live WhatsApp for the Job Kit, behind the PIN (src/lib/wa-live.ts says what it is):
     status          is it linked, is the webhook pointing here, how much is kept, the templates
     setup           points 360dialog's webhook at the live site (always www.rafcarpentry.com)
     pull {since}    chats and messages changed since the device's last pull (the last 30 days)
     thread {wa}     one chat's messages (the older ones a pull leaves out)
     file {id}       a photo or PDF (fetched from WhatsApp now if it wasn't copied yet)
     state {wa, state, at}   Raf's ticks, customer and trips to ServiceM8 for a chat, shared with the computer
     read {wa}       Claude reads the chat now; pending: the chats waiting for it
     send {wa, text}         words, within 24 hours of their last message (refused here first when it's past them:
                             WhatsApp would take it and then fail it)
     check {wa, id?}         can words go to this number now (their last message), and how a message sent went
     template {wa, name, values}  an approved template, any time
     templates / templates-make   the Job Kit's templates and their state in Meta's review
   Nothing here deletes anything. */
export const maxDuration = 60;

const ORIGIN = () => process.env.WA_HOOK_ORIGIN || 'https://www.rafcarpentry.com';
/* The Job Kit's templates with their state in Meta's review (MISSING = not made yet). */
const withState = (list: { name: string; status: string; category: string; reason?: string }[]) =>
  TEMPLATES.map((t) => {
    const x = list.find((y) => y.name === t.name);
    return { name: t.name, label: t.label, status: x?.status ?? 'MISSING', category: x?.category ?? t.category, reason: x?.reason };
  });
const isWa = (v: unknown) => typeof v === 'string' && /^\d{6,16}$/.test(v);

function fail(e: unknown) {
  if (e instanceof D360Error) return Response.json({ error: e.code, detail: e.detail }, { status: e.code === 'wa-busy' ? 503 : e.code === 'wa-not-set-up' ? 503 : 502 });
  if (e instanceof SyncError) return Response.json({ error: e.code }, { status: 503 });
  console.error('job-kit wa', e);
  return Response.json({ error: 'error' }, { status: 500 });
}

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  if (!waStoreSetUp()) return Response.json({ error: 'sync-not-set-up' }, { status: 503 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const action = String(b.action ?? '');
  const linked = d360SetUp();
  try {
    if (action === 'status') {
      const store = (await waRpc('status')) as Record<string, unknown>;
      let webhook: 'ok' | 'other' | 'none' | 'unknown' = 'unknown';
      let templates: unknown = null;
      if (linked) {
        const url = await getWebhook().catch(() => null);
        webhook = url === null ? 'unknown' : !url ? 'none' : url === hookUrl(ORIGIN()) ? 'ok' : 'other';
        const list = await listTemplates().catch(() => null);
        templates = list ? withState(list) : null;
      }
      return Response.json({ linked, webhook, templates, store });
    }
    if (action === 'setup') {
      if (!linked) return Response.json({ error: 'wa-not-set-up' }, { status: 503 });
      await setWebhook(hookUrl(ORIGIN()));
      return Response.json({ ok: true, webhook: 'ok' });
    }
    if (action === 'pull') {
      const since = Math.max(0, Math.floor(Number(b.since) || 0));
      const r = (await waRpc('pull', { since, limit: 600, days: 30 }, 25000)) as Record<string, unknown>;
      return Response.json({ ...r, linked });
    }
    if (action === 'thread') {
      if (!isWa(b.wa)) return Response.json({ error: 'bad' }, { status: 400 });
      return Response.json(await waRpc('thread', { wa: b.wa, limit: 500 }, 25000));
    }
    if (action === 'state') {
      if (!isWa(b.wa) || !b.state || typeof b.state !== 'object') return Response.json({ error: 'bad' }, { status: 400 });
      return Response.json(await waRpc('state', { wa: b.wa, state: b.state, at: Number(b.at) || Date.now() }));
    }
    if (action === 'file') {
      const id = String(b.id ?? '').slice(0, 200);
      if (!id) return Response.json({ error: 'bad' }, { status: 400 });
      let f = (await waRpc('file-get', { id }, 25000)) as { mime?: string; b64?: string } | null;
      if (!f?.b64) {
        // not copied yet (a big history delivery): from WhatsApp now, while it still has it
        const m = (await waRpc('msg', { id })) as Pick<LiveMsg, 'id' | 'type' | 'media'> | null;
        if (m && linked && (await keepFile(m))) f = (await waRpc('file-get', { id }, 25000)) as { mime?: string; b64?: string } | null;
      }
      if (!f?.b64 || !f.mime) return Response.json({ error: 'gone' }, { status: 404 });
      return new Response(Buffer.from(f.b64, 'base64'), { headers: { 'content-type': f.mime, 'cache-control': 'private, max-age=86400' } });
    }
    if (action === 'read') {
      if (!isWa(b.wa)) return Response.json({ error: 'bad' }, { status: 400 });
      return Response.json(await runRead(String(b.wa), b.force === true));
    }
    if (action === 'pending') return Response.json({ list: await waRpc('read-pending') });
    if (action === 'check') {
      const wa = digits(b.wa);
      if (!isWa(wa)) return Response.json({ error: 'bad' }, { status: 400 });
      const id = typeof b.id === 'string' ? b.id.slice(0, 200) : '';
      const t = (await waRpc('thread', { wa, limit: id ? 200 : 1, thumbs: false }, 20000)) as { msgs?: { id: string; at: number; status?: string | null }[]; chat?: { name?: string | null; profile?: string | null; liveInAt?: number | null; lastInAt?: number | null } | null };
      const c = t?.chat;
      const m = id ? (t?.msgs ?? []).find((x) => x.id === id) : undefined;
      return Response.json({
        linked,
        chat: c ? { name: c.name || c.profile || '', liveInAt: c.liveInAt ?? null, lastInAt: c.lastInAt ?? null } : null,
        msg: m ? { status: m.status ?? null, at: m.at } : null,
        now: Date.now(),
      });
    }
    if (action === 'send') {
      const wa = digits(b.wa);
      const text = String(b.text ?? '').trim().slice(0, 4000);
      if (!isWa(wa) || !text) return Response.json({ error: 'bad' }, { status: 400 });
      if (!linked) return Response.json({ error: 'wa-not-set-up' }, { status: 503 });
      // past the 24 hours WhatsApp takes the words and fails them a moment later, so it's said here instead
      const t = (await waRpc('thread', { wa, limit: 1, thumbs: false }, 15000)) as { chat?: { liveInAt?: number | null } | null };
      if (windowLeft(t?.chat?.liveInAt) < 60_000) return Response.json({ error: 'wa-window', detail: t?.chat?.liveInAt ? String(t.chat.liveInAt) : '' }, { status: 409 });
      const id = await sendText(wa, text);
      const msg = { id: id || `api-${Date.now()}`, wa, dir: 'out', src: 'api', at: Date.now(), type: 'text', body: text };
      await waRpc('put', { msgs: [msg] }).catch(() => null);
      return Response.json({ ok: true, msg });
    }
    if (action === 'template') {
      const wa = digits(b.wa);
      const t = TEMPLATES.find((x) => x.name === b.name);
      const values = Array.isArray(b.values) ? b.values.map((v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)) : [];
      if (!isWa(wa) || !t || values.length !== 2 || values.some((v) => !v)) return Response.json({ error: 'bad' }, { status: 400 });
      const id = await sendTemplate(wa, t.name, values);
      const msg = { id: id || `api-${Date.now()}`, wa, dir: 'out', src: 'api', at: Date.now(), type: 'text', body: fillTemplate(t, values[0], values[1]) };
      await waRpc('put', { msgs: [msg] }).catch(() => null);
      return Response.json({ ok: true, msg });
    }
    if (action === 'templates' || action === 'templates-make') {
      if (!linked) return Response.json({ error: 'wa-not-set-up' }, { status: 503 });
      let list = await listTemplates();
      if (action === 'templates-make') {
        for (const t of TEMPLATES.filter((t) => !list.some((x) => x.name === t.name))) await createTemplate(t);
        list = await listTemplates();
      }
      return Response.json({ templates: withState(list) });
    }
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
