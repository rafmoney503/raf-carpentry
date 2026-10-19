'use client';
import { useSyncExternalStore } from 'react';
import { unzipSync } from 'fflate';
import { guessMe, isNumber, kindOf, lastStretch, mergeMsgs, nameFromFile, parseChat, sameName, type WaKind, type WaMsg } from '@/lib/whatsapp-chat';
import { shrinkPhoto } from './media';
import { readPin } from './uploader';
import { post } from './sm8-post';

/* WhatsApp chats brought into the Job Kit (whatsapp.tsx), kept on this phone in their own IndexedDB
   ('raf-job-kit-wa'): the messages, what's ticked, where they went in ServiceM8, and the photos and PDFs from the
   export (videos, voice notes and stickers are left in WhatsApp). Nothing here goes anywhere until Raf sends it to a
   job; then the ticked photos go to /api/job-kit/attach one at a time (redrawn as JPEG first, so no GPS), a note
   with the ticked messages for a job that was there already, and the job is saved once so they show in its diary.
   The sending runs here, outside the screens, so it carries on while Raf looks at the job; it's written down after
   each file, so a reload or no signal carries on from where it stopped. */

export type WaFile = { name: string; kind: WaKind; bytes: number };
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
};

/* ---------- storage ---------- */

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('raf-job-kit-wa', 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('chats', { keyPath: 'id' });
        d.createObjectStore('files');
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
export const getWaFile = (chat: string, name: string) => run<Blob | undefined>('files', 'readonly', (s) => s.get(fileKey(chat, name)));

/* ---------- the list, shared by every screen ---------- */

let chats: WaChat[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: WaChat[] = [];
function emit() {
  for (const l of listeners) l();
}
async function load() {
  try {
    chats = ((await run<WaChat[]>('chats', 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    chats = [];
  }
  emit();
  void kick();
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

async function save(c: WaChat) {
  await run<void>('chats', 'readwrite', (s) => s.put(c));
  chats = [c, ...(chats ?? []).filter((x) => x.id !== c.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  emit();
}
/* A change to one chat (ticks, the customer picked); the latest copy is always the one changed. */
export async function updateChat(id: string, change: (c: WaChat) => WaChat, touch = false) {
  const c = waChat(id);
  if (!c) return;
  await save({ ...change(c), ...(touch ? { updatedAt: Date.now() } : {}) });
}
export async function removeChat(id: string) {
  await run<void>('chats', 'readwrite', (s) => s.delete(id));
  await run<void>('files', 'readwrite', (s) => s.delete(IDBKeyRange.bound(`${id}/`, `${id}/￿`)));
  chats = (chats ?? []).filter((c) => c.id !== id);
  emit();
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
    chat = { ...old, msgs: merged.msgs, people: [...new Set([...old.people, ...people])], me, files, picked, updatedAt: now, added };
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
    };
    added = msgs.length;
  }
  for (const f of keep) await run<void>('files', 'readwrite', (s) => s.put(f.blob, fileKey(chat.id, f.name)));
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
