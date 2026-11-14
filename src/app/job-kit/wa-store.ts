'use client';
import { useSyncExternalStore } from 'react';
import { unzipSync } from 'fflate';
import { guessMe, isNumber, kindOf, lastStretch, mergeMsgs, nameFromFile, parseChat, sameName, type WaKind, type WaMsg } from '@/lib/whatsapp-chat';
import { londonAt, showNumber } from '@/lib/wa-live';
import { shrinkPhoto } from './media';
import { readPin } from './uploader';
import { post } from './sm8-post';
import { deviceLabel } from './device';

/* WhatsApp chats brought into the Job Kit (whatsapp.tsx), kept on this phone in their own IndexedDB
   ('raf-job-kit-wa'): the messages, what's ticked, where they went in ServiceM8, and the photos and PDFs from the
   export (videos, voice notes and stickers are left in WhatsApp). Nothing here goes anywhere until Raf sends it to a
   job; then the ticked photos go to /api/job-kit/attach one at a time (redrawn as JPEG first, so no GPS), a note
   with the ticked messages for a job that was there already, and the job is saved once so they show in its diary.
   The sending runs here, outside the screens, so it carries on while Raf looks at the job; it's written down after
   each file, so a reload or no signal carries on from where it stopped.
   Since 19 Oct 2026 (Raf, after the computer got the Job Kit: 'WhatsApp chats' not in step) each chat is kept in
   step with the other device by sync.ts, with a small preview of each photo ('thumbs'); the photos and PDFs
   themselves stay on the device that brought the chat in (the other one marks the chat `remote`), and a trip with
   files started on the other device is sent from that one. */

export type WaFile = { name: string; kind: WaKind; bytes: number; msg?: string }; // msg: a live chat's message id (the file is on the server)
/* One trip to ServiceM8: a new job made from the chat, or ticked things added to a job they had already. */
export type WaSend = {
  job: string;
  number?: string;
  what?: string;
  mode: 'new' | 'added';
  at: number;
  files: string[];
  sent: string[];
  failed: string[];
  note?: string; // the ticked messages, for a job that was there already
  noteDone?: boolean;
  touched?: boolean;
  error?: string;
};
export type WaChat = {
  id: string;
  name: string; // as the chat is named on the phone (the zip's name)
  number?: string; // when the contact isn't saved, the name is their number
  me?: string; // which writer is Raf
  people: string[];
  msgs: WaMsg[];
  files: WaFile[]; // the photos and PDFs kept on this phone
  importedAt: number;
  updatedAt: number;
  added?: number; // new messages the last time it was brought in again
  client?: string; // the ServiceM8 customer it's for
  clientName?: string;
  picked: string[]; // message ids ticked; a message with a photo or PDF takes its file
  sends: WaSend[];
  design?: string; // a design request made from it
  importedOn?: string; // the device it was brought into (iPhone, Mac...): it has the photos and PDFs
  remote?: boolean; // on this device the photos and PDFs aren't here, only their previews (stays on the device)
  // live chats (WhatsApp linked through 360dialog, since 13 Nov 2026): kept on the server, id 'live-<number>'
  live?: boolean;
  wa?: string; // their number, digits
  profile?: string; // the name on their WhatsApp profile
  read?: WaRead; // Claude's reading
  readState?: string; // working | ready | failed
  liveInAt?: number; // their last message since the link: WhatsApp's 24 hours run from it
  stateAt?: number; // when Raf's picks last changed (shared with the computer through the server)
  hidden?: boolean;
  threadAt?: number; // when the whole thread was last fetched
};
export type WaRead = {
  kind: 'new_enquiry' | 'customer_update' | 'supplier' | 'personal' | 'other';
  first?: string;
  what?: string;
  summary?: string;
  details?: string[];
  photos?: string;
  waiting?: 'raf' | 'them' | 'nobody';
  next?: string;
  upto?: number;
  at?: number;
  error?: string;
};

/* ---------- storage ---------- */

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('raf-job-kit-wa', 2);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('chats')) d.createObjectStore('chats', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
        // small previews of the photos (data URLs), kept in step with the other device
        if (!d.objectStoreNames.contains('thumbs')) d.createObjectStore('thumbs');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbp = null;
        reject(req.error);
      };
    });
  return dbp;
}
async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve((req ? req.result : undefined) as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Storage refused'));
  });
}
const fileKey = (chat: string, name: string) => `${chat}/${name}`;
/* A chat's photo or PDF. A live chat's comes from the server the first time and is kept here after that. */
export async function getWaFile(chat: string, name: string): Promise<Blob | undefined> {
  const b = await run<Blob | undefined>('files', 'readonly', (s) => s.get(fileKey(chat, name)));
  if (b) return b;
  const c = waChat(chat);
  const f = c?.live ? c.files.find((x) => x.name === name) : undefined;
  if (!f?.msg) return undefined;
  const got = await liveFile(f.msg);
  if (got) await run<void>('files', 'readwrite', (s) => s.put(got, fileKey(chat, name))).catch(() => undefined);
  return got;
}
export const getWaThumb = (chat: string, name: string) => run<string | undefined>('thumbs', 'readonly', (s) => s.get(fileKey(chat, name)));

/* A small preview of a photo for the other device: 200 px, about 8 KB. */
async function previewOf(blob: Blob): Promise<string | undefined> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}
/* Previews for the photos of chats brought in here that don't have one yet (chats from before 19 Oct 2026). */
let thumbing = false;
async function ensureThumbs() {
  if (thumbing || !chats) return;
  thumbing = true;
  try {
    let made = false;
    for (const c of chats.filter((x) => !x.remote)) {
      for (const f of c.files.filter((x) => x.kind === 'photo')) {
        if (await getWaThumb(c.id, f.name)) continue;
        const b = await getWaFile(c.id, f.name);
        const t = b ? await previewOf(b) : undefined;
        if (t) {
          await run<void>('thumbs', 'readwrite', (s) => s.put(t, fileKey(c.id, f.name)));
          made = true;
        }
      }
    }
    if (made) changed();
  } finally {
    thumbing = false;
  }
}

/* ---------- the list, shared by every screen ---------- */

let chats: WaChat[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: WaChat[] = [];
function emit() {
  for (const l of listeners) l();
}
/* A change made here (not one taken in from the other device): sync.ts sends it. */
const changeSubs = new Set<() => void>();
const changed = () => changeSubs.forEach((f) => f());
export function onWaChange(fn: () => void) {
  changeSubs.add(fn);
  return () => void changeSubs.delete(fn);
}
async function load() {
  try {
    chats = ((await run<WaChat[]>('chats', 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    chats = [];
  }
  emit();
  void kick();
  void ensureThumbs();
}
function subscribe(l: () => void) {
  listeners.add(l);
  if (chats === null) void load();
  return () => listeners.delete(l);
}
export function useWaChats(): WaChat[] {
  return useSyncExternalStore(subscribe, () => chats ?? EMPTY, () => EMPTY);
}
export const waChat = (id: string) => (chats ?? []).find((c) => c.id === id);

async function save(c0: WaChat, quiet = false) {
  // a change Raf made in a live chat: kept on the server, so the computer gets it with the messages
  const c = c0.live && !quiet ? { ...c0, stateAt: Date.now() } : c0;
  await run<void>('chats', 'readwrite', (s) => s.put(c));
  chats = [c, ...(chats ?? []).filter((x) => x.id !== c.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  emit();
  if (quiet) return;
  if (c.live) pushSoon(c.id);
  else changed();
}
/* A change to one chat (ticks, the customer picked); the latest copy is always the one changed. */
export async function updateChat(id: string, change: (c: WaChat) => WaChat, touch = false) {
  const c = waChat(id);
  if (!c) return;
  await save({ ...change(c), ...(touch ? { updatedAt: Date.now() } : {}) });
}
export async function removeChat(id: string, quiet = false) {
  await run<void>('chats', 'readwrite', (s) => s.delete(id));
  await run<void>('files', 'readwrite', (s) => s.delete(IDBKeyRange.bound(`${id}/`, `${id}/\uffff`)));
  await run<void>('thumbs', 'readwrite', (s) => s.delete(IDBKeyRange.bound(`${id}/`, `${id}/\uffff`)));
  chats = (chats ?? []).filter((c) => c.id !== id);
  emit();
  if (!quiet) changed();
}

/* ---------- bringing a chat in ---------- */

const KEEP: WaKind[] = ['photo', 'pdf'];
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };
const mimeOf = (name: string) => MIME[name.toLowerCase().split('.').pop() ?? ''] ?? 'application/octet-stream';

export class WaImportError extends Error {}

/* What a chat starts with ticked: in the last stretch (after the last gap of a week), their messages and every photo
   or PDF, so a returning customer's new job doesn't drag in last year's. */
export function defaultPicks(msgs: WaMsg[], me?: string) {
  return msgs
    .slice(lastStretch(msgs))
    .filter((m) => !m.system && !m.omitted && ((m.file && KEEP.includes(m.kind!)) || (m.text && m.from !== me)))
    .map((m) => m.id);
}

/* Reads the exported zip (or just the _chat.txt), keeps the photos and PDFs, and adds the chat, or adds what's new to
   the same chat brought in before (matched by its name or number). */
export async function bringIn(file: File): Promise<{ id: string; added: number; isNew: boolean }> {
  let text = '';
  const names: string[] = [];
  const media: { name: string; kind: WaKind; blob: Blob }[] = [];
  if (/\.txt$/i.test(file.name) || file.type === 'text/plain') {
    text = await file.text();
  } else {
    let entries: Record<string, Uint8Array>;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      entries = unzipSync(buf, {
        filter: (f) => {
          const base = f.name.replace(/^.*\//, '');
          if (!base || base.startsWith('.') || f.name.startsWith('__MACOSX')) return false;
          names.push(base);
          return /\.txt$/i.test(base) || KEEP.includes(kindOf(base));
        },
      });
    } catch {
      throw new WaImportError('That file isn’t a WhatsApp export. In WhatsApp: the chat, their name, Export Chat, Attach Media, Save to Files, then pick that file here.');
    }
    const txts = Object.keys(entries).filter((n) => /\.txt$/i.test(n));
    const chatTxt = txts.find((n) => /(^|\/)_chat\.txt$/i.test(n)) ?? txts.sort((a, b) => entries[b].length - entries[a].length)[0];
    if (!chatTxt) throw new WaImportError('There’s no chat in that zip. Export the chat from WhatsApp again (Export Chat, Attach Media).');
    text = new TextDecoder('utf-8').decode(entries[chatTxt]);
    for (const [n, bytes] of Object.entries(entries)) {
      const base = n.replace(/^.*\//, '');
      const kind = kindOf(base);
      if (KEEP.includes(kind)) media.push({ name: base, kind, blob: new Blob([bytes as BlobPart], { type: mimeOf(base) }) });
    }
  }
  const { msgs, people } = parseChat(text, names);
  if (!msgs.some((m) => !m.system)) throw new WaImportError('No messages found in that chat. Is it the right file?');
  const fromFile = nameFromFile(file.name);
  const name = fromFile || people.find((p) => !/\b(raf|rafal|rafał)\b/i.test(p)) || people[0] || 'WhatsApp chat';
  const number = isNumber(name) ? name.trim() : undefined;
  // only the files the chat refers to
  const used = new Set(msgs.map((m) => m.file).filter(Boolean));
  const keep = media.filter((f) => used.has(f.name));
  const list = chats ?? (await run<WaChat[]>('chats', 'readonly', (s) => s.getAll())) ?? [];
  const old = list.find((c) => sameName(c.name, name) || (number && c.number === number));
  const now = Date.now();
  let chat: WaChat;
  let added = 0;
  if (old) {
    const merged = mergeMsgs(old.msgs, msgs);
    added = merged.added;
    const have = new Set(old.msgs.map((m) => m.id));
    const me = old.me ?? guessMe(people, name);
    const fresh = merged.msgs.filter((m) => !have.has(m.id));
    // New messages after it went to a job are probably about something new: they're what's ticked now.
    const freshPicks = defaultPicks(fresh, me).filter((id) => fresh.some((m) => m.id === id));
    const picked = old.sends.length ? (freshPicks.length ? freshPicks : old.picked) : [...new Set([...old.picked, ...freshPicks])];
    const files = [...old.files, ...keep.filter((f) => !old.files.some((x) => x.name === f.name)).map((f) => ({ name: f.name, kind: f.kind, bytes: f.blob.size }))];
    // brought in here: this device has the photos and PDFs now
    chat = { ...old, msgs: merged.msgs, people: [...new Set([...old.people, ...people])], me, files, picked, updatedAt: now, added, remote: undefined, importedOn: keep.length ? deviceLabel() : old.importedOn };
  } else {
    const me = guessMe(people, name);
    chat = {
      id: `wa-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      number,
      me,
      people,
      msgs,
      files: keep.map((f) => ({ name: f.name, kind: f.kind, bytes: f.blob.size })),
      importedAt: now,
      updatedAt: now,
      picked: defaultPicks(msgs, me),
      sends: [],
      importedOn: deviceLabel(),
    };
    added = msgs.length;
  }
  for (const f of keep) {
    await run<void>('files', 'readwrite', (s) => s.put(f.blob, fileKey(chat.id, f.name)));
    const t = f.kind === 'photo' ? await previewOf(f.blob) : undefined;
    if (t) await run<void>('thumbs', 'readwrite', (s) => s.put(t, fileKey(chat.id, f.name)));
  }
  await save(chat);
  return { id: chat.id, added, isNew: !old };
}

/* ---------- what's ticked, in words ---------- */

export const fileOf = (c: WaChat, m: WaMsg) => (m.file && c.files.some((f) => f.name === m.file) ? m.file : undefined);
export function pickedOf(c: WaChat) {
  const set = new Set(c.picked);
  const msgs = c.msgs.filter((m) => set.has(m.id));
  const files = msgs.map((m) => fileOf(c, m)).filter((f): f is string => Boolean(f));
  const texts = msgs.filter((m) => m.text);
  return { msgs, files, texts, photos: files.filter((f) => kindOf(f) === 'photo').length, pdfs: files.filter((f) => kindOf(f) === 'pdf').length };
}
export const firstName = (name: string) => (isNumber(name) ? '' : name.trim().split(/\s+/)[0] ?? '');
/* The ticked messages as lines for ServiceM8: just their words when they're all theirs, else each with who wrote it. */
export function pickedText(c: WaChat) {
  const { texts } = pickedOf(c);
  const mixed = texts.some((m) => m.from === c.me) && texts.some((m) => m.from !== c.me);
  return texts.map((m) => (mixed ? `${m.from === c.me ? 'Raf' : firstName(m.from) || 'Them'}: ${m.text}` : m.text)).join('\n');
}
const day = (at: string) => new Date(`${at.slice(0, 10)}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export function noteText(c: WaChat) {
  const { msgs, photos, pdfs } = pickedOf(c);
  const when = msgs.length ? (day(msgs[0].at) === day(msgs[msgs.length - 1].at) ? day(msgs[0].at) : `${day(msgs[0].at)} to ${day(msgs[msgs.length - 1].at)}`) : '';
  const files = [photos ? `${photos} photo${photos === 1 ? '' : 's'}` : '', pdfs ? `${pdfs} PDF${pdfs === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
  return [`From WhatsApp${when ? `, ${when}` : ''}:`, pickedText(c), files ? `(${files} added to the job)` : ''].filter(Boolean).join('\n');
}

/* ---------- sending to ServiceM8 ---------- */

/* Starts a trip: the ticked photos and PDFs to that job, and (for a job they had already) a note with the words. */
export async function sendToJob(id: string, s: Omit<WaSend, 'at' | 'sent' | 'failed'>) {
  await updateChat(id, (c) => ({ ...c, sends: [...c.sends, { ...s, at: Date.now(), sent: [], failed: [] }] }), true);
  void kick();
}
/* Send the ones that didn't go again. */
export async function retrySend(id: string, at: number) {
  await updateChat(id, (c) => ({ ...c, sends: c.sends.map((s) => (s.at === at ? { ...s, failed: [], error: undefined } : s)) }));
  void kick();
}
export const pending = (s: WaSend) => s.files.filter((f) => !s.sent.includes(f) && !s.failed.includes(f));
export const sendBusy = (s: WaSend) => pending(s).length > 0 || (Boolean(s.note) && !s.noteDone) || !s.touched;

let running = false;
async function upload(chat: string, s: WaSend, name: string): Promise<string> {
  const blob = await getWaFile(chat, name);
  if (!blob) return 'gone';
  let body: Blob = blob;
  let sendName = name;
  if (kindOf(name) === 'photo') {
    try {
      body = (await shrinkPhoto(blob)).blob;
      sendName = name.replace(/\.[^.]+$/, '.jpg');
    } catch {
      return 'type';
    }
  }
  if (body.size > 4 * 1024 * 1024) return 'too-big';
  const fd = new FormData();
  fd.set('job', s.job);
  fd.set('key', `${chat}:${name}`);
  fd.set('name', `WhatsApp ${sendName.replace(/^\d{8}-/, '')}`);
  fd.set('file', body, sendName);
  try {
    const res = await fetch('/api/job-kit/attach', { method: 'POST', headers: { 'x-job-kit-pin': readPin() }, body: fd, cache: 'no-store' });
    if (res.ok) return '';
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return j.error || 'error';
  } catch {
    return 'offline';
  }
}
/* Works through every trip still going, one file at a time; stops on no signal or no PIN and starts again on the
   next kick (a new trip, the app coming back, Send again). */
export async function kick() {
  if (running || !chats) return;
  running = true;
  try {
    for (const c0 of [...chats]) {
      for (const s0 of c0.sends) {
        // the photos and PDFs are on the other device: it sends this trip (and its note)
        if (c0.remote && s0.files.length) continue;
        let s = s0;
        const mark = async (patch: Partial<WaSend>) => {
          s = { ...s, ...patch };
          const at = s.at;
          await updateChat(c0.id, (c) => ({ ...c, sends: c.sends.map((x) => (x.at === at ? s : x)) }));
        };
        for (const name of pending(s)) {
          const err = await upload(c0.id, s, name);
          if (err === 'offline' || err === 'wrong-pin' || err === 'not-set-up') {
            await mark({ error: err });
            return;
          }
          if (err) await mark({ failed: [...s.failed, name], error: err });
          else await mark({ sent: [...s.sent, name], error: undefined });
        }
        if (s.note && !s.noteDone) {
          const r = await post<{ ok: true }>(readPin(), { action: 'note', job: s.job, text: s.note, key: `${c0.id}-${s.at}` });
          if (!r.ok) {
            await mark({ error: r.error });
            if (r.error === 'offline' || r.error === 'no-pin' || r.error === 'wrong-pin') return;
          } else await mark({ noteDone: true });
        }
        if (!s.touched && !pending(s).length) {
          const r = await post<{ ok: true }>(readPin(), { action: 'touch', job: s.job });
          if (r.ok || r.error !== 'offline') await mark({ touched: true });
        }
      }
    }
  } finally {
    running = false;
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void kick());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void kick();
  });
}

/* ---------- kept in step with the other device (sync.ts) ---------- */

export type WaThumb = { key: string; chat: string; name: string; thumb: string };
export async function waForSync(): Promise<{ chats: WaChat[]; thumbs: WaThumb[] }> {
  // live chats aren't sent between devices: both get them from the server
  const list = (chats ?? (await run<WaChat[]>('chats', 'readonly', (s) => s.getAll())) ?? []).filter((c) => !c.live);
  const d = await db();
  const thumbs = await new Promise<WaThumb[]>((resolve, reject) => {
    const out: WaThumb[] = [];
    const req = d.transaction('thumbs', 'readonly').objectStore('thumbs').openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(out);
      const key = String(cur.key);
      const i = key.indexOf('/');
      if (!key.startsWith('live-')) out.push({ key, chat: key.slice(0, i), name: key.slice(i + 1), thumb: String(cur.value) });
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
  return { chats: list, thumbs };
}
export async function waChatNow(id: string) {
  return run<WaChat | undefined>('chats', 'readonly', (s) => s.get(id));
}

/* Two copies of a chat put together: every message either has, every file, every trip with whatever either has
   sent; the ticks, the customer and the design from the newer copy (`theirs` won by time). */
function mergeChat(mine: WaChat, theirs: WaChat): WaChat {
  const msgs = mergeMsgs(mine.msgs, theirs.msgs).msgs;
  const files = [...theirs.files, ...mine.files.filter((f) => !theirs.files.some((x) => x.name === f.name))];
  const sends = [...theirs.sends];
  for (const m of mine.sends) {
    const i = sends.findIndex((x) => x.at === m.at);
    if (i < 0) sends.push(m);
    else {
      const t = sends[i];
      const sent = [...new Set([...t.sent, ...m.sent])];
      sends[i] = { ...t, sent, failed: [...new Set([...t.failed, ...m.failed])].filter((f) => !sent.includes(f)), noteDone: t.noteDone || m.noteDone, touched: t.touched || m.touched };
    }
  }
  sends.sort((a, b) => a.at - b.at);
  return { ...theirs, msgs, files, sends, people: [...new Set([...theirs.people, ...mine.people])], importedOn: theirs.importedOn ?? mine.importedOn, remote: mine.remote };
}

/* A chat from the other device ('kept': not taken off here while this device still has its files to send). */
export async function waTakeChat(id: string, data: WaChat | null): Promise<'applied' | 'kept'> {
  if (id.startsWith('live-')) return 'applied'; // live chats come from the server, not the other device
  if (chats === null) await load();
  const mine = await waChatNow(id);
  if (!data) {
    if (!mine) return 'applied';
    if (!mine.remote && mine.sends.some((x) => pending(x).length)) return 'kept';
    await removeChat(id, true);
    return 'applied';
  }
  const theirs = { ...data, id } as WaChat;
  await save(mine ? mergeChat(mine, theirs) : { ...theirs, remote: true }, true);
  return 'applied';
}
export async function waTakeThumb(key: string, thumb: string | null) {
  if (thumb) await run<void>('thumbs', 'readwrite', (s) => s.put(thumb, key));
  else await run<void>('thumbs', 'readwrite', (s) => s.delete(key));
  emit();
}
/* After chats came in: a trip started on the other device for files that are here goes now. */
export const waKick = () => void kick();

/* ---------- live chats (Raf's WhatsApp linked through 360dialog, 13 Nov 2026) ---------- */
/* Every chat on his number comes to the server (/api/whatsapp/webhook, src/lib/wa-live.ts); the Job Kit pulls what
   changed since its last pull (the last 30 days) into this same store as chats 'live-<number>', so the chat screen,
   the ticks, the customer, New job, Add to #101 and design requests work as for an exported chat. Their photos and
   PDFs stay on the server until opened or sent; Raf's ticks, customer and trips are kept on the server too (state),
   so the computer shows the same. Claude reads each chat with something new (wa-server.ts readChat). */

const ME = 'Raf';
const REV_KEY = 'raf_jobkit_wa_rev';
const WA_PATH = '/api/job-kit/wa';
export type LiveRow = { id: string; wa: string; dir: 'in' | 'out'; src: string; at: number; type: string; body?: string | null; media?: { mime?: string; name?: string; caption?: string } | null; file?: string | null; thumb?: string | null; status?: string | null };
export type LiveChatRow = { wa: string; name?: string | null; profile?: string | null; lastAt?: number | null; lastInAt?: number | null; liveInAt?: number | null; read?: WaRead | null; readState?: string | null; state?: Partial<LiveState> | null; stateAt?: number; rev?: number };
type LiveState = { picked: string[]; client: string | null; clientName: string | null; sends: WaSend[]; design: string | null; hidden: boolean };

export const liveId = (wa: string) => `live-${wa}`;

/* What the screens know about the link: linked (null = not asked yet), the last good pull, the last problem. */
export type LiveInfo = { linked: boolean | null; at: number; error: string; reading: string };
let info: LiveInfo = { linked: null, at: 0, error: '', reading: '' };
const infoSubs = new Set<() => void>();
function setInfo(patch: Partial<LiveInfo>) {
  info = { ...info, ...patch };
  infoSubs.forEach((f) => f());
}
export function useLiveInfo(): LiveInfo {
  return useSyncExternalStore(
    (l) => {
      infoSubs.add(l);
      return () => void infoSubs.delete(l);
    },
    () => info,
    () => info,
  );
}

async function ask<T>(body: Record<string, unknown>) {
  return post<T>(readPin(), body, WA_PATH);
}

async function liveFile(id: string): Promise<Blob | undefined> {
  const pin = readPin();
  if (!pin) return undefined;
  try {
    const res = await fetch(WA_PATH, { method: 'POST', headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'file', id }), cache: 'no-store' });
    if (!res.ok) return undefined;
    const b = await res.blob();
    return b.size ? b : undefined;
  } catch {
    return undefined;
  }
}

/* A row from the server as a chat message. */
function rowToMsg(r: LiveRow, name: string): WaMsg {
  const safe = r.id.replace(/[^A-Za-z0-9]/g, '').slice(-28) || String(r.at);
  const mime = r.media?.mime ?? '';
  let file: string | undefined;
  let kind: WaKind | undefined;
  if (r.type === 'image' || (r.type === 'document' && (r.file === 'photo' || /^image\//.test(mime)))) [file, kind] = [`${safe}.jpg`, 'photo'];
  else if (r.type === 'document') {
    // the file's own name after the id ("x1y2-sketch.pdf"), so the chat can show it
    const own = (r.media?.name ?? '').replace(/[^\w. ()-]/g, '').trim();
    const pdf = r.file === 'pdf' || mime === 'application/pdf' || /\.pdf$/i.test(own);
    [file, kind] = pdf ? [`${safe}-${own.replace(/\.pdf$/i, '') || 'document'}.pdf`, 'pdf'] : [`${safe}-${own || 'file'}`, 'other'];
  }
  else if (r.type === 'video') [file, kind] = [`${safe}.mp4`, 'video'];
  else if (r.type === 'audio') [file, kind] = [`${safe}.ogg`, 'audio'];
  else if (r.type === 'sticker') [file, kind] = [`${safe}.webp`, 'sticker'];
  const from = r.dir === 'out' ? ME : name;
  const text =
    r.type === 'reaction'
      ? `${r.dir === 'out' ? 'You' : name} reacted ${r.body ?? ''}`.trim()
      : r.type === 'unsupported'
        ? 'A message the Job Kit can’t show: open it in WhatsApp'
        : r.type === 'placeholder'
          ? ''
          : (r.body ?? '');
  return {
    id: r.id,
    at: londonAt(r.at),
    ts: r.at,
    from,
    text,
    file: r.type === 'placeholder' ? `${safe}.jpg` : file,
    kind: r.type === 'placeholder' ? 'photo' : kind,
    omitted: r.type === 'placeholder' || undefined,
    system: r.type === 'reaction' || undefined,
  };
}

/* What a live chat starts with ticked: their messages, photos and PDFs since their last gap of a week (the gaps
   counted between their own messages, so Raf's reply after a quiet spell doesn't hide what they sent). */
function livePicks(msgs: WaMsg[]) {
  const theirs = msgs.filter((m) => m.from !== ME && !m.system);
  const from = theirs[lastStretch(theirs)];
  if (!from) return [];
  const i = msgs.indexOf(from);
  return msgs
    .slice(i)
    .filter((m) => !m.system && !m.omitted && ((m.file && (m.kind === 'photo' || m.kind === 'pdf')) || (m.text && m.from !== ME)))
    .map((m) => m.id);
}

/* Server rows into the store: new messages added (changed ones replaced), their previews kept, and Raf's picks from
   the server when they're newer than this device's. New messages from them are ticked as an exported chat's are. */
async function mergeLive(rows: LiveChatRow[], msgRows: LiveRow[]) {
  if (chats === null) await load();
  const byWa = new Map<string, LiveRow[]>();
  for (const r of msgRows) byWa.set(r.wa, [...(byWa.get(r.wa) ?? []), r]);
  const chatRows = new Map(rows.map((r) => [r.wa, r]));
  for (const wa of byWa.keys()) if (!chatRows.has(wa)) chatRows.set(wa, { wa });
  for (const [wa, row] of chatRows) {
    const id = liveId(wa);
    const old = waChat(id);
    const name = row.name || row.profile || old?.name || showNumber(wa);
    const fresh = (byWa.get(wa) ?? []).map((r) => rowToMsg(r, name));
    const map = new Map((old?.msgs ?? []).map((m) => [m.id, m.from !== ME && m.from !== name ? { ...m, from: name } : m]));
    const have = new Set(map.keys());
    for (const m of fresh) map.set(m.id, m);
    const msgs = [...map.values()].sort((a, b) => (a.ts ?? Date.parse(`${a.at}:00`)) - (b.ts ?? Date.parse(`${b.at}:00`)));
    const files = [...(old?.files ?? [])];
    for (const r of byWa.get(wa) ?? []) {
      const m = msgs.find((x) => x.id === r.id);
      if (!m?.file || (m.kind !== 'photo' && m.kind !== 'pdf') || m.omitted) continue;
      if (!files.some((f) => f.name === m.file)) files.push({ name: m.file, kind: m.kind, bytes: 0, msg: r.id });
      if (r.thumb) await run<void>('thumbs', 'readwrite', (s) => s.put(r.thumb, fileKey(id, m.file!))).catch(() => undefined);
    }
    const added = msgs.filter((m) => !have.has(m.id));
    let picked = old?.picked ?? livePicks(msgs);
    if (old && added.length) {
      const freshPicks = livePicks(added);
      picked = old.sends.length ? (freshPicks.length ? freshPicks : old.picked) : [...new Set([...old.picked, ...freshPicks])];
    }
    let c: WaChat = {
      ...(old ?? { importedAt: Date.now(), sends: [], picked: [] }),
      id,
      live: true,
      wa,
      name,
      number: showNumber(wa),
      profile: row.profile ?? old?.profile,
      me: ME,
      people: [name, ME],
      msgs,
      files,
      picked,
      updatedAt: row.lastAt ?? old?.updatedAt ?? Date.now(),
      read: row.read === undefined ? old?.read : (row.read ?? undefined),
      readState: row.readState === undefined ? old?.readState : (row.readState ?? undefined),
      liveInAt: row.liveInAt ?? old?.liveInAt,
    } as WaChat;
    const st = row.state;
    if (st && (row.stateAt ?? 0) > (old?.stateAt ?? 0) && !dirty.has(id)) {
      c = { ...c, picked: st.picked ?? c.picked, client: st.client ?? undefined, clientName: st.clientName ?? undefined, sends: st.sends ?? c.sends, design: st.design ?? undefined, hidden: Boolean(st.hidden), stateAt: row.stateAt };
    }
    await save(c, true);
  }
}

/* Raf's picks for a live chat, to the server (a moment after the last change). */
const dirty = new Set<string>();
let pushTimer: ReturnType<typeof setTimeout> | undefined;
function pushSoon(id: string) {
  dirty.add(id);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), 800);
}
async function pushNow() {
  for (const id of [...dirty]) {
    const c = waChat(id);
    if (!c?.live || !c.wa) {
      dirty.delete(id);
      continue;
    }
    const state: LiveState = { picked: c.picked, client: c.client ?? null, clientName: c.clientName ?? null, sends: c.sends, design: c.design ?? null, hidden: Boolean(c.hidden) };
    const r = await ask<{ ok: true }>({ action: 'state', wa: c.wa, state, at: c.stateAt ?? Date.now() });
    if (r.ok) dirty.delete(id);
    else return; // no signal: tried again with the next pull
  }
}

let pulling: Promise<void> | null = null;
let lastPull = 0;
/* What changed on the server since this device's last pull (at most every 15 s unless asked). */
export function pullLive(force = false): Promise<void> {
  if (pulling) return pulling;
  if (!readPin() || (!force && Date.now() - lastPull < 15000)) return Promise.resolve();
  pulling = (async () => {
    try {
      let since = Number(localStorage.getItem(REV_KEY) || 0) || 0;
      for (let i = 0; i < 10; i++) {
        const r = await ask<{ msgs: LiveRow[]; chats: LiveChatRow[]; rev: number; more: boolean; linked: boolean }>({ action: 'pull', since });
        if (!r.ok) {
          setInfo({ error: r.error });
          return;
        }
        await mergeLive(r.data.chats ?? [], r.data.msgs ?? []);
        since = Math.max(since, Number(r.data.rev) || 0);
        try {
          localStorage.setItem(REV_KEY, String(since));
        } catch {
          /* storage full or blocked: the next pull starts from the same place */
        }
        setInfo({ linked: Boolean(r.data.linked), at: Date.now(), error: '' });
        if (!r.data.more) break;
      }
      if (dirty.size) await pushNow();
      void kick();
    } finally {
      lastPull = Date.now();
      pulling = null;
    }
  })();
  return pulling;
}

/* The whole of one chat (a pull only brings the last 30 days of active chats). */
export async function loadThread(id: string) {
  const c = waChat(id);
  if (!c?.live || !c.wa) return;
  const r = await ask<{ msgs: LiveRow[]; chat: LiveChatRow | null }>({ action: 'thread', wa: c.wa });
  if (!r.ok) return;
  await mergeLive(r.data.chat ? [r.data.chat] : [], r.data.msgs ?? []);
  const now = waChat(id);
  if (now) await save({ ...now, threadAt: Date.now() }, true);
}

/* Claude reads a chat now (Read it again, or the first time). */
export async function readLive(id: string, force = true): Promise<string> {
  const c = waChat(id);
  if (!c?.wa) return 'bad';
  setInfo({ reading: id });
  try {
    const r = await ask<{ ok: boolean; error?: string }>({ action: 'read', wa: c.wa, force });
    if (!r.ok) return r.error;
    await pullLive(true);
    return r.data.ok ? '' : r.data.error || 'ai-error';
  } finally {
    setInfo({ reading: '' });
  }
}

let lastQueue = 0;
/* The chats waiting for Claude (something new from them, quiet for 90 s): read one at a time, at most every 2 min.
   The webhook reads them too; this catches the ones it didn't get to. */
export async function readWaiting() {
  if (!readPin() || Date.now() - lastQueue < 120000 || info.reading) return;
  lastQueue = Date.now();
  const r = await ask<{ list: string[] }>({ action: 'pending' });
  if (!r.ok || !r.data.list?.length) return;
  for (const wa of r.data.list.slice(0, 3)) {
    if (!waChat(liveId(wa))) continue;
    await readLive(liveId(wa), false);
  }
}

/* Words to them through WhatsApp (within 24 hours of their last message), or an approved template. The message
   shows in the chat straight away. */
export async function sendLive(id: string, body: { text: string } | { template: string; values: string[] }): Promise<{ error: string; detail?: string } | null> {
  const c = waChat(id);
  if (!c?.wa) return { error: 'bad' };
  const r = await ask<{ ok: true; msg: LiveRow }>('text' in body ? { action: 'send', wa: c.wa, text: body.text } : { action: 'template', wa: c.wa, name: body.template, values: body.values });
  if (!r.ok) return { error: r.error, detail: r.detail };
  await mergeLive([{ wa: c.wa }], [r.data.msg]);
  return null;
}

/* Words to a number straight from the Job Kit (a quote from its screen), not from an open chat: the chat on this
   device gets the message too. */
export async function sendLiveTo(wa: string, text: string): Promise<{ msg: LiveRow } | { error: string; detail?: string }> {
  const r = await ask<{ ok: true; msg: LiveRow }>({ action: 'send', wa, text });
  if (!r.ok) return { error: r.error, detail: r.detail };
  await mergeLive([{ wa }], [r.data.msg]).catch(() => undefined);
  return { msg: r.data.msg };
}

/* Can words go to this number now, and how a message sent to it went (sent / delivered / read / failed). */
export type WaCheck = { linked: boolean; chat: { name: string; liveInAt: number | null; lastInAt: number | null } | null; msg: { status: string | null; at: number } | null; now: number };
export async function checkWa(wa: string, id?: string): Promise<WaCheck | { error: string; detail?: string }> {
  const r = await ask<WaCheck>({ action: 'check', wa, id });
  return r.ok ? r.data : { error: r.error, detail: r.detail };
}

export async function hideLive(id: string, hidden: boolean) {
  await updateChat(id, (c) => ({ ...c, hidden }));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (dirty.size) void pushNow();
  });
}
