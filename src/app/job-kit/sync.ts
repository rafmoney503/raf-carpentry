import { readMarks, saveMarks, type Marks } from './current';
import { allItems, allJobs, delFile, delItem, delJob, getItem, getJob, putItem, putJob, type Item, type Job } from './store';
import { onChange, readPin, wake } from './uploader';
import { deviceLabel } from './device';
import { getWaThumb, onWaChange, waChatNow, waForSync, waKick, waTakeChat, waTakeThumb, type WaChat } from './wa-store';

/* The phone and the computer in step (19 Oct 2026, Raf: 'Is there a possibility to create Desktop version of JobKit
   that syncs with current mobile one', stage 2). What the Job Kit keeps on one device goes through a small private
   table in the cabinetos Supabase project (schema jobkit, POST /api/job-kit/sync behind the PIN):
     mark    a ServiceM8 job's marks (quote sent, progress, visits done, review asked, hidden, emails seen)
     posted  a post pack's ticks
     job     a Job Kit job or a design request, without the customer's mobile (that stays on the device it was typed on)
     item    a photo or clip's details and its small thumbnail; the file itself stays on the device that took it, which
             sends it to the inbox (marked `remote` on the other one)
     wa      a WhatsApp chat brought in (wa-store.ts): its messages, ticks and trips to ServiceM8 (since 19 Oct 2026, Raf
             said yes to having them on the computer too); its photos and PDFs stay on the device that brought it in,
             which sends them to ServiceM8, even for a trip started on the other device
     wafile  a small preview of one of a chat's photos (200 px)
   Not kept in step: drafts, and the lists that come from ServiceM8, the inbox and the website (each device fetches
   its own).

   Each round: what changed here since the last round (a hash per thing) goes up with the time it changed, the later
   change wins, and what the other device changed comes back. A change made here while a round is out, or one not
   sent yet that is newer, wins. Clearing a job deletes it on both, except on a device that still has its photos to
   send. Runs on open, when the app comes back, every 30 s while it's open, and a few seconds after a change. */

export type SyncKind = 'mark' | 'posted' | 'job' | 'item' | 'wa' | 'wafile';
type Data = Record<string, unknown>;
type Doc = { kind: SyncKind; id: string; at: number; data: Data | null };
type Local = { kind: SyncKind; id: string; data: Data; hash: string };
type Pend = Record<string, { h: string; at: number }>; // h '' = deleted here
export type Other = { label: string | null; seen: number };
export type SyncState = {
  state: 'idle' | 'syncing' | 'offline' | 'no-pin' | 'not-set-up' | 'wrong-pin' | 'error';
  at: number; // the last round that went through
  others: Other[]; // the other devices, last seen
  waiting: number; // changes here not in the store yet
};

export const POSTED_KEY = 'raf_jobkit_posted';
const DEVICE_KEY = 'raf_jobkit_device';
const REV_KEY = 'raf_jobkit_sync_rev'; // how far through the store's changes this device is (missing: never synced)
const SEEN_KEY = 'raf_jobkit_sync_seen'; // key -> hash of what this device and the store both have
const PEND_KEY = 'raf_jobkit_sync_pend'; // key -> a change here still to go up
const LAST_KEY = 'raf_jobkit_sync_last'; // { at, others } for the Settings line
const CHUNK = 1_400_000; // what goes up in one request (a Vercel function takes 4.5 MB)
const BIGGEST = 300_000; // bytes: one thing bigger than this stays on its device (the store takes 400 KB)

/* ---------- storage ---------- */

function read<T>(key: string, empty: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? empty : (JSON.parse(v) as T) ?? empty;
  } catch {
    return empty;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the next round tries again */
  }
}

export function deviceId() {
  let id = read<string>(DEVICE_KEY, '');
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
    id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    write(DEVICE_KEY, id);
  }
  return id;
}

export { deviceLabel };

/* ---------- the form each thing travels in ---------- */

/* Keys in order, nothing undefined, no NUL characters (the store refuses them), so the same thing always gives the
   same text, whichever device and whatever order its fields were written in. */
function clean(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.includes('\u0000') ? v.replace(/\u0000/g, '') : v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(clean);
  if (typeof v === 'object') {
    const out: Data = {};
    for (const k of Object.keys(v as Data).sort()) {
      const x = (v as Data)[k];
      if (x !== undefined && typeof x !== 'function') out[k] = clean(x);
    }
    return out;
  }
  return null;
}

/* A short fingerprint of the text (cyrb53). */
function hashOf(s: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + `.${s.length.toString(36)}`;
}
const hashData = (d: Data) => hashOf(JSON.stringify(d));

/* A job without the customer's mobile; a photo without what only its own device needs. */
const jobForm = (j: Job) => clean({ ...j, syncedIn: undefined, design: j.design ? { ...j.design, mobile: undefined } : undefined }) as Data;
const itemForm = (i: Item) => clean({ ...i, parts: undefined, sentParts: undefined, sentAt: undefined, remote: undefined }) as Data;
const waForm = (c: WaChat) => clean({ ...c, remote: undefined }) as Data;
const thumbKey = (key: string) => {
  const i = key.indexOf('/');
  return { chat: key.slice(0, i), name: key.slice(i + 1) };
};

const keyOf = (kind: SyncKind, id: string) => `${kind}:${id}`;

function readPosted() {
  return read<Record<string, Record<string, string>>>(POSTED_KEY, {});
}

async function collect(): Promise<Map<string, Local>> {
  const out = new Map<string, Local>();
  const add = (kind: SyncKind, id: string, raw: unknown) => {
    const data = clean(raw) as Data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    out.set(keyOf(kind, id), { kind, id, data, hash: hashData(data) });
  };
  for (const [id, m] of Object.entries(readMarks())) add('mark', id, m);
  for (const [id, p] of Object.entries(readPosted())) add('posted', id, p);
  const [jobs, items] = await Promise.all([allJobs(), allItems()]);
  for (const j of jobs) add('job', j.id, jobForm(j));
  for (const i of items) add('item', i.id, itemForm(i));
  const wa = await waForSync();
  for (const c of wa.chats) add('wa', c.id, waForm(c));
  for (const t of wa.thumbs) add('wafile', t.key, { chat: t.chat, name: t.name, thumb: t.thumb });
  return out;
}

/* The fingerprint of one thing as it is here now ('' = not here). */
async function hashNow(kind: SyncKind, id: string): Promise<string> {
  let d: Data | null = null;
  if (kind === 'mark') d = (readMarks()[id] as Data | undefined) ?? null;
  else if (kind === 'posted') d = readPosted()[id] ?? null;
  else if (kind === 'job') {
    const j = await getJob(id);
    d = j ? jobForm(j) : null;
  } else if (kind === 'item') {
    const i = await getItem(id);
    d = i ? itemForm(i) : null;
  } else if (kind === 'wa') {
    const c = await waChatNow(id);
    d = c ? waForm(c) : null;
  } else {
    const t = thumbKey(id);
    const thumb = await getWaThumb(t.chat, t.name);
    d = thumb ? { chat: t.chat, name: t.name, thumb } : null;
  }
  return d ? hashData(clean(d) as Data) : '';
}

/* ---------- taking in a change from the other device ---------- */

/* 'kept': not applied (this device still has photos of that job to send), so this device's copy goes back up. */
async function apply(d: Doc, gone: Set<string>): Promise<'applied' | 'kept'> {
  if (d.kind === 'wa') return waTakeChat(d.id, d.data as unknown as WaChat | null);
  if (d.kind === 'wafile') {
    await waTakeThumb(d.id, typeof d.data?.thumb === 'string' ? d.data.thumb : null);
    return 'applied';
  }
  if (d.kind === 'mark') {
    const m = readMarks();
    if (d.data) m[d.id] = d.data as Marks[string];
    else delete m[d.id];
    saveMarks(m);
    return 'applied';
  }
  if (d.kind === 'posted') {
    const p = readPosted();
    if (d.data) p[d.id] = d.data as Record<string, string>;
    else delete p[d.id];
    write(POSTED_KEY, p);
    return 'applied';
  }
  if (d.kind === 'job') {
    const local = await getJob(d.id);
    if (!d.data) {
      const unsent = (await allItems()).some((i) => i.jobId === d.id && !i.remote && !i.sent && !i.lost);
      if (unsent) return 'kept';
      if (local) await delJob(d.id);
      return 'applied';
    }
    const j = d.data as unknown as Job;
    const next: Job = {
      ...j,
      // two devices adding files at once mustn't give a number twice
      seq: Math.max(Number(j.seq) || 0, local?.seq || 0),
      design: j.design ? { ...j.design, mobile: local?.design?.mobile ?? '' } : j.design,
      syncedIn: j.updatedAt,
    };
    await putJob(next);
    return 'applied';
  }
  const local = await getItem(d.id);
  if (!d.data) {
    if (!local) return 'applied';
    // a photo still to send here, of a job cleared on the other device: kept, with its job
    if (!local.remote && !local.sent && !local.lost && (gone.has(local.jobId) || !(await getJob(local.jobId)))) return 'kept';
    await delFile(d.id);
    await delItem(d.id);
    return 'applied';
  }
  const i = d.data as unknown as Item;
  // this device has the file: it alone says whether it's sent; the other can change the caption
  const next: Item =
    local && !local.remote ? { ...local, caption: typeof i.caption === 'string' ? i.caption : local.caption } : { ...i, parts: 0, sentParts: 0, remote: true };
  await putItem(next);
  return 'applied';
}

/* ---------- one round ---------- */

type Answer = { saved: number; lost: Doc[]; docs: Doc[]; rev: number; more: boolean; devices: Other[]; now: number };

let state: SyncState = { state: 'idle', at: 0, others: [], waiting: 0 };
const subs = new Set<(s: SyncState) => void>();
const appliedSubs = new Set<(kinds: Set<SyncKind>) => void>();
const setState = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f(state));
};

/* The Settings line follows this. */
export function onSync(fn: (s: SyncState) => void) {
  if (!state.at) {
    const last = read<{ at: number; others: Other[] }>(LAST_KEY, { at: 0, others: [] });
    state = { ...state, at: last.at, others: last.others, waiting: Object.keys(read<Pend>(PEND_KEY, {})).length };
  }
  subs.add(fn);
  fn(state);
  return () => void subs.delete(fn);
}
/* The app reloads what changed. */
export function onApplied(fn: (kinds: Set<SyncKind>) => void) {
  appliedSubs.add(fn);
  return () => void appliedSubs.delete(fn);
}

const ORDER: Record<SyncKind, number> = { mark: 0, posted: 1, job: 2, wa: 3, item: 4, wafile: 5 };

async function round(): Promise<boolean> {
  const pin = readPin();
  if (!pin) {
    setState({ state: 'no-pin' });
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setState({ state: 'offline' });
    return false;
  }
  const local = await collect();
  const seen = read<Record<string, string>>(SEEN_KEY, {});
  const pend = read<Pend>(PEND_KEY, {});
  const since = read<number | null>(REV_KEY, null);
  const now = Date.now();
  // Never in step before: what's here counts as the oldest, so the store's copy wins where both have something.
  const at = since === null ? 1 : now;
  for (const [k, l] of local) {
    if (seen[k] === l.hash) delete pend[k];
    else if (pend[k]?.h !== l.hash) pend[k] = { h: l.hash, at };
  }
  for (const k of Object.keys(seen)) if (!local.has(k) && pend[k]?.h !== '') pend[k] = { h: '', at: now };
  for (const k of Object.keys(pend)) if (!local.has(k) && !(k in seen)) delete pend[k];

  // what goes up this round: marks and ticks first, then jobs, then photos; about 1.4 MB at most
  const sending: { doc: Doc; h: string }[] = [];
  let size = 0;
  const keys = Object.keys(pend).sort((a, b) => ORDER[a.split(':')[0] as SyncKind] - ORDER[b.split(':')[0] as SyncKind] || pend[a].at - pend[b].at);
  for (const k of keys) {
    const p = pend[k];
    const [kind, ...rest] = k.split(':');
    const l = local.get(k);
    const doc: Doc = { kind: kind as SyncKind, id: rest.join(':'), at: p.at, data: p.h ? l?.data ?? null : null };
    if (p.h && !l) continue;
    const text = JSON.stringify(doc);
    const s = text.length;
    if (s > BIGGEST / 4 && new TextEncoder().encode(text).length > BIGGEST) {
      // far too big to keep in step: it stays on this device
      seen[k] = p.h;
      delete pend[k];
      continue;
    }
    if (sending.length && (size + s > CHUNK || sending.length >= 300)) break;
    sending.push({ doc, h: p.h });
    size += s;
  }
  write(PEND_KEY, pend);
  write(SEEN_KEY, seen);
  setState({ state: 'syncing', waiting: Object.keys(pend).length });

  let res: Response;
  try {
    res = await fetch('/api/job-kit/sync', {
      method: 'POST',
      headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' },
      body: JSON.stringify({ device: deviceId(), label: deviceLabel(), since: since ?? 0, docs: sending.map((s) => s.doc) }),
      cache: 'no-store',
    });
  } catch {
    setState({ state: 'offline' });
    return false;
  }
  if (!res.ok) {
    let code = '';
    try {
      code = ((await res.json()) as { error?: string }).error || '';
    } catch {
      /* Vercel's own page */
    }
    setState({ state: res.status === 401 ? 'wrong-pin' : code === 'not-set-up' || code === 'sync-not-set-up' ? 'not-set-up' : 'error' });
    return false;
  }
  const r = (await res.json()) as Answer;

  // what went up
  const lostKeys = new Set(r.lost.map((d) => keyOf(d.kind, d.id)));
  for (const { doc, h } of sending) {
    const k = keyOf(doc.kind, doc.id);
    if (lostKeys.has(k)) continue;
    if (h) seen[k] = h;
    else delete seen[k];
    if (pend[k]?.h === h) delete pend[k];
  }

  // what came back: the store's newer copies of things sent, then the other device's changes
  const kinds = new Set<SyncKind>();
  const gone = new Set(
    r.docs
      .concat(r.lost)
      .filter((d) => d.kind === 'job' && !d.data)
      .map((d) => d.id)
  );
  for (const d of [...r.lost, ...r.docs]) {
    const k = keyOf(d.kind, d.id);
    const before = local.get(k)?.hash ?? '';
    const here = await hashNow(d.kind, d.id);
    if (here !== before) continue; // changed here while the round was out: this device's change goes next
    if (!lostKeys.has(k) && pend[k] && pend[k].at > d.at) continue; // a newer change here, still to go up
    const data = d.data ? (clean(d.data) as Data) : null;
    const theirs = data ? hashData(data) : '';
    const done = await apply({ ...d, data }, gone);
    const after = await hashNow(d.kind, d.id);
    if (theirs) seen[k] = theirs;
    else delete seen[k];
    // this device's copy goes back up: later than the change it answers, whatever the other device's clock said
    if (done === 'kept' || after !== theirs) pend[k] = { h: after, at: Math.max(Date.now(), Number(d.at) + 1) };
    else delete pend[k];
    if (done === 'applied') kinds.add(d.kind);
  }
  write(SEEN_KEY, seen);
  write(PEND_KEY, pend);
  write(REV_KEY, Math.max(Number(r.rev) || 0, since ?? 0));
  const others = (r.devices || []).map((o) => ({ label: o.label, seen: Number(o.seen) || 0 }));
  write(LAST_KEY, { at: Date.now(), others });
  setState({ state: 'idle', at: Date.now(), others, waiting: Object.keys(pend).length });
  if (kinds.size) {
    appliedSubs.forEach((f) => f(kinds));
    if (kinds.has('job') || kinds.has('item')) wake(); // a job whose photos are now all sent can send its details
    if (kinds.has('wa')) waKick(); // a trip started on the other device, with files that are here
  }
  return Boolean(r.more) || Object.keys(pend).some((k) => !sending.some((s) => keyOf(s.doc.kind, s.doc.id) === k));
}

/* ---------- when ---------- */

let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;

async function run() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  if (retry) clearTimeout(retry);
  try {
    for (let n = 0; n < 25; n++) {
      again = false;
      let more = false;
      try {
        more = await round();
      } catch {
        setState({ state: 'error' });
      }
      if (!more && !again) break;
    }
  } finally {
    running = false;
  }
  // something stopped it: try again later by itself
  const s = state.state;
  if (s === 'offline' || s === 'error') retry = setTimeout(() => void run(), s === 'offline' ? 30_000 : 60_000);
  else if (s === 'not-set-up') retry = setTimeout(() => void run(), 600_000);
}

/* A change was made here: in step a few seconds later (several changes go together). */
export function syncSoon(ms = 2500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void run();
  }, ms);
}
export const syncNow = () => syncSoon(0);

/* Started once by the app; the returned function stops it. */
export function startSync() {
  syncSoon(300);
  const tick = setInterval(() => {
    if (document.visibilityState === 'visible') syncSoon(0);
  }, 30_000);
  // going into the background: what's changed goes up straight away; back: the other device's changes come in
  const vis = () => syncSoon(document.visibilityState === 'visible' ? 200 : 0);
  const online = () => syncSoon(0);
  const offChange = onChange(() => syncSoon(3000));
  const offWa = onWaChange(() => syncSoon());
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('online', online);
  return () => {
    clearInterval(tick);
    if (timer) clearTimeout(timer);
    if (retry) clearTimeout(retry);
    offChange();
    offWa();
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('online', online);
  };
}

/* ---------- words ---------- */

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 36 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
};

/* One line for Today and Settings. */
export function syncWords(s: SyncState): string {
  const other = s.others[0];
  const name = other?.label ? `your ${other.label}` : 'your other device';
  if (s.state === 'no-pin') return 'Add your PIN to keep this in step with your phone or computer.';
  if (s.state === 'not-set-up') return 'Keeping in step with your phone or computer isn’t set up on the website yet.';
  if (s.state === 'wrong-pin') return 'Not in step with your other device: the PIN isn’t right.';
  if (s.state === 'offline') return 'No signal: changes wait here and go when it’s back.';
  if (s.state === 'error') return 'Couldn’t reach the store to keep in step just now. It tries again in a minute.';
  if (!s.at) return 'Getting in step…';
  if (!other) return 'Open the Job Kit on your computer or phone with the same PIN and it shows the same jobs.';
  return `In step with ${name}, last there ${ago(other.seen)}.`;
}
