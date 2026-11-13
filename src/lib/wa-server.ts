import { createHmac, timingSafeEqual } from 'node:crypto';
import { jobkitRpc, syncSetUp } from './job-kit-sync-server';
import { D360Error, mediaBytes } from './d360';
import { jpegOf, sniff } from './photo-jpeg';
import { noteClaude } from './ai-usage';
import { redact } from './draft-reply';
import { londonAt, storable, type LiveMsg, type Parsed } from './wa-live';

/* The server side of live WhatsApp (src/lib/wa-live.ts says what it is): the store (Supabase jobkit.wa_*, through
   public.jobkit_wa with the Job Kit's secret), what the webhook does with each delivery (the messages kept, photos
   and PDFs copied while WhatsApp still has them: a photo from a webhook is only there for 7 days), and Claude's
   reading of a chat (what it is and what they want), which the Job Kit turns into a job with one tap. */

export const waRpc = (action: string, p: Record<string, unknown> = {}, timeoutMs = 15000) => jobkitRpc('jobkit_wa', { p_action: action, p }, timeoutMs);
export const waStoreSetUp = syncSetUp;

/* The webhook's own secret, made from the Job Kit's (or WA_WEBHOOK_SECRET): it goes in the address 360dialog posts
   to, so nothing else can post made-up messages. */
export function hookSecret() {
  if (process.env.WA_WEBHOOK_SECRET) return process.env.WA_WEBHOOK_SECRET;
  const s = process.env.JOBKIT_SYNC_SECRET;
  return s ? createHmac('sha256', s).update('whatsapp-webhook').digest('hex').slice(0, 40) : '';
}
export function hookOk(req: Request) {
  const want = hookSecret();
  const got = new URL(req.url).searchParams.get('k') || req.headers.get('x-wa-secret') || '';
  if (!want || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
export function hookUrl(origin = 'https://www.rafcarpentry.com') {
  return `${origin.replace(/\/$/, '')}/api/whatsapp/webhook?k=${hookSecret()}`;
}

/* ---------- a delivery from the webhook ---------- */

const PDF_MAX = 4 * 1024 * 1024;

/* Copies one photo or PDF into the store: photos as a 1600 px JPEG (no GPS or other hidden data) with a 200 px
   preview for the list. Returns false when WhatsApp no longer has it. */
export async function keepFile(m: Pick<LiveMsg, 'id' | 'type' | 'media'>): Promise<boolean> {
  const kind = storable(m);
  if (!kind || !m.media) return false;
  let got: { bytes: Uint8Array; mime: string };
  try {
    got = await mediaBytes(m.media.id, m.media.url);
  } catch (e) {
    if (!(e instanceof D360Error)) console.error('wa media', m.id, e);
    return false;
  }
  const type = sniff(got.bytes);
  if (kind === 'pdf' || type === 'application/pdf') {
    if (type !== 'application/pdf' || got.bytes.length > PDF_MAX) return false;
    await waRpc('file-put', { id: m.id, mime: 'application/pdf', b64: Buffer.from(got.bytes).toString('base64') }, 30000);
    return true;
  }
  try {
    const full = await jpegOf(got.bytes, 1600, 80);
    const small = await jpegOf(got.bytes, 200, 60);
    await waRpc('file-put', { id: m.id, mime: 'image/jpeg', b64: Buffer.from(full).toString('base64'), thumb: `data:image/jpeg;base64,${Buffer.from(small).toString('base64')}` }, 30000);
    return true;
  } catch (e) {
    console.error('wa photo', m.id, e);
    return false;
  }
}

/* Everything one delivery holds, kept; then its photos copied (up to `maxFiles`, so a big history chunk can't run
   past the function's time: the rest are copied the first time the Job Kit asks for them). */
export async function ingest(p: Parsed, maxFiles = 16) {
  const msgs = p.msgs.map((m) => ({ ...m, media: m.media ? { id: m.media.id, mime: m.media.mime, name: m.media.name, caption: m.media.caption } : undefined }));
  for (let i = 0; i < Math.max(1, Math.ceil(msgs.length / 400)); i++) {
    await waRpc('put', {
      msgs: msgs.slice(i * 400, i * 400 + 400),
      contacts: i ? [] : p.contacts,
      statuses: i ? [] : p.statuses,
      event: { fields: p.fields, n: p.msgs.length },
    }, 30000);
  }
  if (p.historyOff) await waRpc('meta-put', { key: 'history', value: { off: true } }).catch(() => null);
  else if (p.history) await waRpc('meta-put', { key: 'history', value: p.history }).catch(() => null);
  if (p.business) await waRpc('meta-put', { key: 'business', value: p.business }).catch(() => null);
  let n = 0;
  // newest first: a customer's photos from today matter more than last spring's
  for (const m of [...p.msgs].sort((a, b) => b.at - a.at)) {
    if (n >= maxFiles) break;
    if (!storable(m)) continue;
    n++;
    await keepFile(m);
  }
}

/* ---------- Claude reads a chat ---------- */

const API = () => (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/$/, '');
const MODEL = () => process.env.WA_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-sonnet-5';

export type WaRead = {
  kind: 'new_enquiry' | 'customer_update' | 'supplier' | 'personal' | 'other';
  first?: string;
  what?: string;
  summary?: string;
  details?: string[];
  photos?: string;
  waiting?: 'raf' | 'them' | 'nobody';
  next?: string;
  upto: number; // their newest message read
  at: number;
  model?: string;
  photosSent?: number;
};

const KINDS = ['new_enquiry', 'customer_update', 'supplier', 'personal', 'other'] as const;
const TOOL = {
  name: 'chat_read',
  description: 'What this WhatsApp chat is, for Raf’s job list.',
  input_schema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: KINDS,
        description:
          'new_enquiry: someone asking about carpentry work they want done (a first enquiry, or a returning customer asking about a new job). customer_update: about a job already under way or quoted (photos, sizes, questions, dates, payment). supplier: a supplier, trade or company (deliveries, materials, invoices, subcontracting). personal: family, friends or nothing to do with work. other: anything else.',
      },
      first_name: { type: 'string', description: 'Their first name if they gave it or it shows in the chat, else empty.' },
      what: { type: 'string', description: 'What they want made or done, in up to 8 words, starting with a capital: "Fitted wardrobe in an alcove". Empty if not work.' },
      summary: { type: 'string', description: 'One or two short sentences for Raf about where the chat is up to.' },
      details: { type: 'array', items: { type: 'string' }, description: 'Up to 6 facts they gave: sizes, room, materials, timing, budget, access. Only what is written or clearly shown.' },
      photos: { type: 'string', description: 'What the photos show, in one sentence, or empty.' },
      waiting_on: { type: 'string', enum: ['raf', 'them', 'nobody'], description: 'Who needs to reply next.' },
      next: { type: 'string', description: 'What Raf could do next, in up to 15 words.' },
    },
    required: ['kind', 'what', 'summary', 'waiting_on'],
  },
} as const;

const SYSTEM = `You read WhatsApp chats for Raf, a carpenter in London who runs Raf Carpentry: fitted wardrobes, alcove units and bookcases, wall panelling, window seats, desks, cupboards and built-in storage, kitchen fitting, doors, flooring and stud walls. His Job Kit app uses your reading to put new enquiries into his job list, so be accurate.

Messages marked RAF are his; THEM are the other person's. Some details (phone numbers, emails, addresses) have been taken out and show as [phone], [email], [address] or [postcode].

Use only what is in the messages and photos. Never guess sizes, prices or dates. Write in UK English, plain and short, with no dashes between words and no emoji.`;

type Content = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };
type Row = { id: string; dir: 'in' | 'out'; src: string; at: number; type: string; body?: string | null; file?: string | null; media?: { name?: string } | null };

export class ReadError extends Error {
  constructor(
    public code: 'ai-not-set-up' | 'ai-key' | 'ai-limit' | 'ai-busy' | 'ai-error' | 'nothing',
    public detail = '',
  ) {
    super(code);
  }
}

async function ask(model: string, content: Content[]) {
  try {
    const res = await fetch(`${API()}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1500, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(50000),
    });
    return { res, text: await res.text().catch(() => '') };
  } catch {
    throw new ReadError('ai-busy', 'no answer');
  }
}

/* The stretch of the chat that matters now: after the last gap of a week (a returning customer's new job), at most
   the last 40 messages, with a few before it for context. */
export function stretchOf<T extends { at: number }>(rows: T[]): T[] {
  let start = 0;
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i].at - rows[i - 1].at >= 7 * 864e5) {
      start = i;
      break;
    }
  }
  return rows.slice(Math.max(0, Math.min(start, rows.length - 40) - 3));
}

// Claude sometimes fills a blank with a placeholder ('<UNKNOWN>', 'N/A', 'Not stated'): those count as empty
const BLANK = /^[<[(]?\s*(unknown|n\/?a|none|null|nothing|not (known|given|stated|clear|mentioned)|-+)\s*[>\])]?\.?$/i;
const clip = (s: unknown, n: number) => {
  const t = typeof s === 'string' ? s.replace(/[–—]/g, ',').replace(/\s+/g, ' ').trim().slice(0, n) : '';
  return BLANK.test(t) ? '' : t;
};

export async function readChat(wa: string): Promise<WaRead> {
  if (!process.env.ANTHROPIC_API_KEY) throw new ReadError('ai-not-set-up');
  const t = (await waRpc('thread', { wa, limit: 120, thumbs: false })) as { msgs?: Row[]; chat?: { name?: string; profile?: string } | null };
  const rows = (t.msgs ?? []).filter((m) => m.type !== 'reaction');
  const theirs = rows.filter((m) => m.dir === 'in');
  if (!theirs.length) throw new ReadError('nothing');
  const name = t.chat?.name || t.chat?.profile || '';
  const part = stretchOf(rows);
  const lines = part.map((m) => {
    const what = m.type === 'image' ? '[photo]' : m.type === 'document' ? `[file${m.media?.name ? ` ${m.media.name}` : ''}]` : m.type === 'video' ? '[video]' : m.type === 'audio' ? '[voice note]' : m.type === 'sticker' ? '[sticker]' : '';
    // "it's Sarah Testwood" -> "it's Sarah": only first names go to Claude
    const words = redact((m.body ?? '').replace(/\b(it[’']?s|this is|i[’']?m|i am|my name is)\s+([A-Z][a-z]+)\s+[A-Z][\w’'-]+/g, '$1 $2'), name).slice(0, 1500);
    return `${londonAt(m.at)} ${m.dir === 'out' ? 'RAF' : 'THEM'}: ${[what, words].filter(Boolean).join(' ')}`;
  });
  const content: Content[] = [{ type: 'text', text: `The chat (oldest first):\n${lines.join('\n')}` }];
  // up to 3 of their newest photos in that stretch
  const photoIds = part.filter((m) => m.dir === 'in' && m.file === 'photo').slice(-3).map((m) => m.id);
  let sent = 0;
  for (const id of photoIds) {
    const f = (await waRpc('file-get', { id }, 20000).catch(() => null)) as { b64?: string; mime?: string } | null;
    if (!f?.b64 || f.mime !== 'image/jpeg') continue;
    // Postgres's encode(..., 'base64') breaks the text every 76 characters; Claude turns the photo down with them in
    const data = f.b64.replace(/\s+/g, '');
    content.push({ type: 'text', text: `Photo ${++sent} they sent:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
  }
  let model = MODEL();
  let { res, text } = await ask(model, content);
  if (res.status === 404 || (res.status === 400 && /model/i.test(text) && !/usage limit/i.test(text))) {
    model = FALLBACK_MODEL;
    ({ res, text } = await ask(model, content));
  }
  await noteClaude('whatsapp', model, res.status, text);
  const short = text.replace(/\s+/g, ' ').slice(0, 200);
  if (res.status === 401 || res.status === 403) throw new ReadError('ai-key', short);
  if (/usage limit|spend limit|credit balance/i.test(text)) throw new ReadError('ai-limit', short);
  if (res.status === 429 || res.status === 529 || res.status >= 500) throw new ReadError('ai-busy', short);
  if (!res.ok) throw new ReadError('ai-error', `${res.status} ${short}`);
  let body: { content?: { type: string; name?: string; input?: Record<string, unknown> }[] };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ReadError('ai-error', 'unreadable answer');
  }
  const x = (body.content ?? []).find((c) => c.type === 'tool_use' && c.name === TOOL.name)?.input;
  if (!x) throw new ReadError('ai-error', 'no reading in the answer');
  const kind = (KINDS as readonly string[]).includes(String(x.kind)) ? (x.kind as WaRead['kind']) : 'other';
  const waiting = ['raf', 'them', 'nobody'].includes(String(x.waiting_on)) ? (x.waiting_on as WaRead['waiting']) : undefined;
  return {
    kind,
    first: clip(x.first_name, 40).split(' ')[0] || undefined,
    what: clip(x.what, 80) || undefined,
    summary: clip(x.summary, 400) || undefined,
    details: Array.isArray(x.details) ? x.details.map((d) => clip(d, 140)).filter(Boolean).slice(0, 6) : undefined,
    photos: clip(x.photos, 240) || undefined,
    waiting,
    next: clip(x.next, 140) || undefined,
    upto: theirs[theirs.length - 1].at,
    at: Date.now(),
    model,
    photosSent: sent,
  };
}

/* Claims and reads one chat, and keeps the answer (or the failure). Never throws. */
export async function runRead(wa: string, force = false): Promise<{ ok: boolean; read?: WaRead; error?: string }> {
  const claim = (await waRpc('read-claim', { wa }).catch(() => null)) as { ok?: boolean } | null;
  if (!claim?.ok && !force) return { ok: false, error: 'busy' };
  try {
    const read = await readChat(wa);
    await waRpc('read-save', { wa, state: 'ready', read });
    return { ok: true, read };
  } catch (e) {
    const code = e instanceof ReadError ? e.code : 'ai-error';
    if (!(e instanceof ReadError)) console.error('wa read', wa, e);
    else if (code === 'ai-error') console.error('wa read', code, e.detail);
    await waRpc('read-save', { wa, state: 'failed', read: { error: code } }).catch(() => null);
    return { ok: false, error: code };
  }
}

/* Reads the chats waiting for it (something new from them, quiet for 90 s, nothing still coming in for 20 s), up to
   `max`, within `budgetMs`. */
export async function readPending(max = 1, budgetMs = 40000) {
  if (!process.env.ANTHROPIC_API_KEY) return 0;
  const started = Date.now();
  const list = ((await waRpc('read-pending').catch(() => [])) as string[]) ?? [];
  let n = 0;
  for (const wa of list.slice(0, max)) {
    if (Date.now() - started > budgetMs) break;
    await runRead(wa);
    n++;
  }
  return n;
}
