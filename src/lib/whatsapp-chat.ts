/* Reading a WhatsApp chat exported from the phone (Export Chat, Attach Media): a zip with the chat as text
   (_chat.txt on an iPhone, "WhatsApp Chat with <name>.txt" on Android) and the photos, videos and files beside it.
   No imports, so the Job Kit, the tests and the server can all use it.

   The lines look like this, depending on the phone and its language:
     iPhone   [19/10/2026, 10:21:05] Kasia Nowak: Hello        (also 10/19/26, 10:21:05 AM / 19.10.2026, 10:21:05)
              ‎[19/10/2026, 10:22:11] Kasia Nowak: ‎<attached: 00000012-PHOTO-2026-10-19-10-22-11.jpg>
     Android  19/10/2026, 10:21 - Kasia Nowak: Hello
              19/10/2026, 10:22 - Kasia Nowak: IMG-20261019-WA0003.jpg (file attached)
   A message over several lines carries on without a date. The words round an attachment change with the language,
   so an attachment is found by its file name being one of the files in the zip. */

export type WaKind = 'photo' | 'pdf' | 'video' | 'audio' | 'sticker' | 'other';
export type WaMsg = {
  id: string;
  at: string; // "YYYY-MM-DDTHH:MM", as the phone showed it
  from: string;
  text: string; // without the attachment's name
  file?: string; // a file in the zip
  kind?: WaKind;
  omitted?: boolean; // a photo or file that wasn't in the export (exported without media, or too old)
  system?: boolean; // "Messages and calls are end-to-end encrypted", "This message was deleted"
};

const MARKS = /[‎‏‪-‮⁦-⁩﻿]/g; // direction marks WhatsApp puts round names and files
const clean = (s: string) => s.replace(MARKS, '').replace(/[  ]/g, ' ');

export function kindOf(name: string): WaKind {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['jpg', 'jpeg', 'png', 'heic', 'heif', 'gif'].includes(ext)) return 'photo';
  if (ext === 'webp') return 'sticker';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'm4v', '3gp'].includes(ext)) return 'video';
  if (['opus', 'm4a', 'aac', 'mp3', 'ogg', 'amr', 'wav'].includes(ext)) return 'audio';
  return 'other';
}

/* "WhatsApp Chat - Kasia Nowak.zip", "WhatsApp Chat with Kasia Nowak.zip" -> "Kasia Nowak" */
export function nameFromFile(file: string) {
  const base = file.replace(/^.*[\\/]/, '').replace(/\.(zip|txt)$/i, '').replace(/\s*\(\d+\)$/, '');
  const m = base.match(/^WhatsApp\s+(?:Chat|Czat)\s*(?:-|–|with|z)\s*(.+)$/i);
  return clean(m ? m[1] : base === '_chat' ? '' : base).trim();
}

// A line that starts a message: optional [, a date, a time, optional ] and " - ", then "Name: text" or a system line.
const START =
  /^\[?(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]?\s*(?:-\s+)?(.*)$/;

type Raw = { a: number; b: number; c: number; h: number; m: number; ampm: string; rest: string };

function readLines(txt: string): Raw[] {
  const out: Raw[] = [];
  for (const line0 of txt.replace(/\r\n?/g, '\n').split('\n')) {
    const line = clean(line0);
    const m = line.match(START);
    if (m) {
      out.push({ a: +m[1], b: +m[2], c: +m[3], h: +m[4], m: +m[5], ampm: (m[7] ?? '').replace(/[.\s]/g, '').toLowerCase(), rest: m[8] ?? '' });
    } else if (out.length) {
      out[out.length - 1].rest += `\n${line}`;
    }
  }
  return out;
}

/* Which way round the dates are: day first (UK, Poland) unless a date can only be month first. */
function dateOrder(raws: Raw[]): 'ymd' | 'dmy' | 'mdy' {
  if (raws.some((r) => r.a > 31)) return 'ymd';
  if (raws.some((r) => r.a > 12)) return 'dmy';
  if (raws.some((r) => r.b > 12)) return 'mdy';
  return 'dmy';
}

const pad = (n: number) => String(n).padStart(2, '0');

const SYSTEM = /end-to-end|this message was deleted|you deleted this message|wiadomość została usunięta|usunięto tę wiadomość|missed (voice|video) call|nieodebrane połączenie|security code (with|changed)|kod zabezpieczeń|changed their phone number|zmienił numer|disappearing messages|znikające wiadomości|is a contact|created group|added you|you were added|joined using/i;
const OMITTED = /^<?\s*(media omitted|image omitted|video omitted|audio omitted|document omitted|sticker omitted|gif omitted|contact card omitted|pominięto multimedia|pominięto obraz|pominięto wideo|pominięto dokument|pominięto audio|obraz pominięty|wideo pominięte|dokument pominięty)\b.*$/i;
const OMITTED_KIND = (t: string): WaKind | undefined =>
  /image|obraz|gif/i.test(t) ? 'photo' : /video|wideo/i.test(t) ? 'video' : /audio/i.test(t) ? 'audio' : /document|dokument/i.test(t) ? 'other' : /sticker/i.test(t) ? 'sticker' : undefined;

/* A short stable id for a message, so bringing the same chat in again adds only what's new. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/* The messages, oldest first, and everyone who wrote (in order of their first message). `files` are the names in
   the zip, so an attachment is found whatever words surround it. */
export function parseChat(txt: string, files: string[] = []): { msgs: WaMsg[]; people: string[] } {
  const raws = readLines(txt);
  const order = dateOrder(raws);
  const fileSet = new Set(files.map((f) => f.replace(/^.*\//, '')));
  const msgs: WaMsg[] = [];
  const people: string[] = [];
  const seen = new Map<string, number>();
  for (const r of raws) {
    const [y0, mo, d] = order === 'ymd' ? [r.a, r.b, r.c] : order === 'dmy' ? [r.c, r.b, r.a] : [r.c, r.a, r.b];
    const y = y0 < 100 ? y0 + 2000 : y0;
    let h = r.h;
    if (r.ampm === 'pm' && h < 12) h += 12;
    if (r.ampm === 'am' && h === 12) h = 0;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const at = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(r.m)}`;
    // "Name: text"; a line with no name (Android's system lines) has none.
    const colon = r.rest.match(/^([^:\n]{1,80}?):\s?([\s\S]*)$/);
    let from = colon ? colon[1].trim() : '';
    let text = colon ? colon[2] : r.rest;
    if (!colon || /^https?$/i.test(from)) {
      from = '';
      text = r.rest;
    }
    text = text.trim();
    const msg: WaMsg = { id: '', at, from, text };
    // An attachment: a file in the zip named in the text, with whatever words are round it taken off.
    const named = [...text.matchAll(/[\w\-. ()]+\.[A-Za-z0-9]{2,5}/g)].map((x) => x[0].trim()).find((n) => fileSet.has(n) || fileSet.has(n.replace(/^.*?\s(?=\S+$)/, '')));
    const fileName = named ? (fileSet.has(named) ? named : named.replace(/^.*?\s(?=\S+$)/, '')) : undefined;
    if (fileName) {
      msg.file = fileName;
      msg.kind = kindOf(fileName);
      // The marker: "<attached: NAME>", "NAME (file attached)", "<załączono: NAME>"; a caption beside it stays, but an
      // iPhone's "Kitchen plan.pdf • 3 pages" before a document goes with it.
      const lines = text.split('\n');
      const i = lines.findIndex((l) => l.includes(fileName));
      const esc = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let rest = lines[i]
        .replace(new RegExp(`<[^<>]*${esc}[^<>]*>`), '')
        .replace(new RegExp(`${esc}\\s*\\([^)]*\\)`), '')
        .replace(fileName, '')
        .trim();
      if (msg.kind !== 'photo' && msg.kind !== 'video' && /\s•\s/.test(rest)) rest = '';
      lines.splice(i, 1, ...(rest ? [rest] : []));
      msg.text = lines.join('\n').trim();
    } else if (OMITTED.test(text)) {
      msg.omitted = true;
      msg.kind = OMITTED_KIND(text);
      msg.text = '';
    } else if (/^<?\s*attached:|\(file attached\)$/i.test(text)) {
      // named a file that isn't in the zip (exported without it)
      msg.omitted = true;
      msg.kind = kindOf(text.replace(/[<>]/g, '').replace(/\(file attached\)/i, '').trim());
      msg.text = '';
    }
    if (!from || SYSTEM.test(text)) msg.system = !msg.file;
    if (from && !msg.system && !people.includes(from)) people.push(from);
    const base = hash(`${at}|${from}|${text}`);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    msg.id = n > 1 ? `${base}-${n}` : base;
    msgs.push(msg);
  }
  return { msgs, people };
}

/* Who Raf is in the chat: not the person the chat is named after; else a name like his; else the one who isn't the
   first to write after the encryption notice is a guess the screen lets him change. */
const ME = /\b(raf|rafal|rafał|janczy|raf carpentry|rafal solutions)\b/i;
export function guessMe(people: string[], chatName: string): string | undefined {
  if (people.length < 2) return people.length === 1 && ME.test(people[0]) ? people[0] : undefined;
  const them = people.find((p) => sameName(p, chatName));
  const mine = people.find((p) => ME.test(p));
  if (mine) return mine;
  if (them) return people.find((p) => p !== them);
  return undefined;
}
const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9+]/g, '');
export const sameName = (a: string, b: string) => Boolean(a && b) && fold(a) === fold(b);

/* A name that is really a phone number ("+44 7700 900123"): an unsaved contact. */
export const isNumber = (s: string) => /^\+?[\d\s()-]{9,}$/.test(s.trim());

/* The last stretch of the chat: everything after the last gap of a week or more (a returning customer's new job). */
export function lastStretch(msgs: WaMsg[], gapDays = 7): number {
  for (let i = msgs.length - 1; i > 0; i--) {
    const a = Date.parse(`${msgs[i - 1].at}:00`);
    const b = Date.parse(`${msgs[i].at}:00`);
    if (Number.isFinite(a) && Number.isFinite(b) && b - a >= gapDays * 864e5) return i;
  }
  return 0;
}

/* Bringing the same chat in again: the old messages kept (with what was ticked), the new ones added in order. */
export function mergeMsgs(old: WaMsg[], fresh: WaMsg[]): { msgs: WaMsg[]; added: number } {
  const have = new Set(old.map((m) => m.id));
  const add = fresh.filter((m) => !have.has(m.id));
  const msgs = [...old, ...add].sort((a, b) => a.at.localeCompare(b.at));
  return { msgs, added: add.length };
}

/* A UK postcode in a message, for the job's address. */
export const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/* A message's opening without the hello and the "it's Sarah again": so a job made from it is named by what they
   want ("We'd like a fitted wardrobe ..."), not "Hi Raf". */
export function withoutGreeting(text: string) {
  const out = text
    .replace(/^\s*(hi|hiya|hello|hey|dear|morning|good (morning|afternoon|evening)|dzień dobry|cześć|witam)\b[^.!?\n,]*[,.!?]?\s*/i, '')
    .replace(/^(it'?s|it is|this is|i'?m|i am|my name is|tu)\s+[A-ZŁŚŻŹĆŃÓ][\w'-]*(\s+[A-ZŁŚŻŹĆŃÓ][\w'-]*)?(\s+again)?(\s+here)?\s*[.!,]?\s*/, '')
    .trim();
  return out.length >= 8 ? out.charAt(0).toUpperCase() + out.slice(1) : text.trim();
}
