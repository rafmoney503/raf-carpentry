import { randomUUID } from 'crypto';
import { asciiJson, sm8Base, sm8Call, sm8List, sm8Str as str, sm8When as when, Sm8Error, statusError, tidy, type Sm8Row as Row } from './servicem8';
import { freshPart, htmlToText, looksHtml, signOff, withoutSignOff } from './mail-text';

/* A job's emails in the Job Kit (Current jobs, the job, Emails): Raf writes there, it goes out through ServiceM8's
   own email (the Messaging API, POST /platform_service_email, the same one the website's emails use, which works
   with the account's API key) and is filed in the job's diary. ServiceM8's two-way email puts the customer's reply
   in the same diary.
   Reading them back: ServiceM8 added GET /api_1.0/email.json in May 2026 ("merged inbound and outbound email
   history for jobs", $filter with eq on direction, related_object, related_object_uuid). It came out account by
   account and its fields aren't published, so:
   - the job's emails are asked for with the uuid in quotes, then without quotes, then (if both filters are turned
     down) all of them, picked here;
   - each email's text, subject, sender and date are read from whichever of the likely field names it has (and
     if the list has no text, from GET /email/<uuid>.json, the newest 15);
   - an email whose text still can't be found carries its field names (`keys`) so the reading can be fixed.
   If ServiceM8 won't let the account read emails at all ("email is not an authorised object type", 403, 404),
   each email sent from the Job Kit is also saved as a note on the job (ServiceM8's own suggestion), and the
   conversation shows those copies: Raf's side only; the replies are in ServiceM8.
   Customer details only travel phone <-> this server <-> ServiceM8. */

export type Mail = {
  id: string;
  dir: 'in' | 'out';
  at: string | null; // London time, "YYYY-MM-DDTHH:MM"
  from: string;
  to: string;
  subject: string;
  text: string; // the new part (no quoted earlier emails, no sign-off)
  full: string; // the whole email when `text` leaves something out, else ''
  copy?: boolean; // a copy kept as a note on the job (emails can't be read on this account)
  keys?: string[]; // only when no text could be found: the email's field names
};
export type Thread = { mails: Mail[]; readable: boolean; detail?: string };

export const NOTE_HEAD = 'Email sent from the Job Kit';

/* ---------- reading ServiceM8's email records ---------- */

const listOf = (d: unknown): Row[] => {
  if (Array.isArray(d)) return d as Row[];
  if (d && typeof d === 'object') {
    for (const k of ['data', 'items', 'emails', 'results', 'records']) if (Array.isArray((d as Row)[k])) return (d as Row)[k] as Row[];
    if ('uuid' in d) return [d as Row];
  }
  return [];
};

const TEXT_KEYS = ['text_body', 'textBody', 'body_text', 'plain_body', 'plain_text', 'text', 'body', 'message', 'message_text', 'email_body', 'content'];
const HTML_KEYS = ['html_body', 'htmlBody', 'body_html', 'message_html', 'html', 'html_content'];
const SUBJECT_KEYS = ['subject', 'email_subject', 'title'];
const FROM_KEYS = ['from', 'from_email', 'from_address', 'email_from', 'from_email_address', 'sender', 'sender_email'];
const TO_KEYS = ['to', 'to_email', 'to_address', 'email_to', 'to_email_address', 'recipient', 'recipient_email', 'recipients'];
const DATE_KEYS = ['timestamp', 'sent_timestamp', 'sent_date', 'date_sent', 'received_timestamp', 'received_date', 'date', 'message_date', 'create_date', 'created', 'created_at', 'edit_date'];
const DIR_KEYS = ['direction', 'message_direction', 'email_direction'];
const KNOWN = new Set([...TEXT_KEYS, ...HTML_KEYS, ...SUBJECT_KEYS, ...FROM_KEYS, ...TO_KEYS, ...DATE_KEYS, ...DIR_KEYS, 'uuid', 'related_object', 'related_object_uuid', 'active']);

const first = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
};

function addresses(v: unknown): string {
  if (typeof v === 'string') return [...v.matchAll(/[^\s<>"',;:()[\]]+@[^\s<>"',;:()[\]]+\.[a-z]{2,}/gi)].map((m) => m[0].toLowerCase()).join(', ');
  if (Array.isArray(v)) return v.map(addresses).filter(Boolean).join(', ');
  if (v && typeof v === 'object') {
    const o = v as Row;
    return addresses(o.email ?? o.address ?? o.email_address ?? '');
  }
  return '';
}
const addrOf = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const a = addresses(r[k]);
    if (a) return a;
  }
  return '';
};

/* London wall-clock time from whatever ServiceM8 sends: its usual "YYYY-MM-DD HH:MM:SS" (already London), an
   ISO time with a zone, or seconds / milliseconds since 1970. */
const london = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Europe/London' }).replace(' ', 'T').slice(0, 16);
function stampOf(v: unknown): string | null {
  if (typeof v === 'number' && v > 1e9) return london(new Date(v < 1e12 ? v * 1000 : v));
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? london(new Date(t)) : null;
  }
  return when(s)?.slice(0, 16) ?? null;
}
const dateOf = (r: Row) => {
  for (const k of DATE_KEYS) {
    const t = stampOf(r[k]);
    if (t) return t;
  }
  return null;
};

function rawText(r: Row) {
  let t = first(r, TEXT_KEYS);
  if (t && looksHtml(t)) return htmlToText(t);
  if (t) return t;
  t = first(r, HTML_KEYS);
  if (t) return htmlToText(t);
  // Not under any name we know: the longest piece of writing in the record.
  const guess = Object.entries(r)
    .filter(([k, v]) => !KNOWN.has(k) && typeof v === 'string' && v.trim().length >= 20 && !/^[\da-f-]{36}$/i.test(v.trim()) && !/^\d{4}-\d{2}-\d{2}/.test(v.trim()))
    .map(([, v]) => v as string)
    .sort((a, b) => b.length - a.length)[0];
  return guess ? (looksHtml(guess) ? htmlToText(guess) : guess) : '';
}

function dirOf(r: Row, customer: string): 'in' | 'out' {
  const d = first(r, DIR_KEYS).toLowerCase();
  if (/^(in|inbound|incoming|received|reply)/.test(d)) return 'in';
  if (/^(out|outbound|outgoing|sent)/.test(d)) return 'out';
  const from = addrOf(r, FROM_KEYS);
  if (customer && from && from.split(', ').includes(customer.toLowerCase())) return 'in';
  return 'out';
}

export function mailOf(r: Row, customer: string, dir?: 'in' | 'out'): Mail {
  const way = dir ?? dirOf(r, customer);
  const raw = rawText(r);
  const part = freshPart(raw);
  const text = way === 'out' ? withoutSignOff(part.text) : part.text;
  const mail: Mail = {
    id: str(r.uuid),
    dir: way,
    at: dateOf(r),
    from: addrOf(r, FROM_KEYS),
    to: addrOf(r, TO_KEYS),
    subject: tidy(first(r, SUBJECT_KEYS)).replace(/\s+/g, ' ').trim(),
    text,
    full: part.cut ? part.all : '',
  };
  if (!text) mail.keys = Object.keys(r).slice(0, 40);
  return mail;
}

const byTime = (a: Mail, b: Mail) => (a.at ?? '').localeCompare(b.at ?? '');

/* ServiceM8 turning email reading down for this account, as opposed to a filter it didn't like. */
const refused = (e: Sm8Error) => e.code === 'sm8-forbidden' || (e.code === 'sm8-error' && (/^404\b/.test(e.detail) || /authori[sz]ed|object type|scope|permission|not (?:enabled|available)/i.test(e.detail)));

type Got = { ok: true; rows: Row[] } | { ok: false; detail: string };
async function emailRows(conds: [string, string][], orAll: boolean): Promise<Got> {
  const filters = [conds.map(([k, v]) => `${k} eq '${v}'`).join(' and '), conds.map(([k, v]) => `${k} eq ${v}`).join(' and ')];
  let detail = '';
  const tryIt = async (query?: Record<string, string>): Promise<Got | null> => {
    try {
      return { ok: true, rows: listOf((await sm8Call('email.json', { query })).data) };
    } catch (e) {
      if (!(e instanceof Sm8Error) || ['sm8-busy', 'sm8-down', 'sm8-key'].includes(e.code)) throw e;
      detail = e.detail || e.code;
      return refused(e) ? { ok: false, detail } : null;
    }
  };
  for (const f of filters) {
    const got = await tryIt({ $filter: f });
    if (got) return got;
  }
  if (orAll) {
    const got = await tryIt();
    if (got?.ok) return { ok: true, rows: got.rows.filter((r) => conds.every(([k, v]) => str(r[k]) === v)) };
    if (got) return got;
  }
  return { ok: false, detail };
}

/* ---------- copies kept as job notes (when ServiceM8 won't let us read emails) ---------- */

function noteMail(n: Row): Mail | null {
  const note = str(n.note).replace(/\r\n?/g, '\n');
  if (!note.startsWith(NOTE_HEAD)) return null;
  const [head, ...body] = note.split('\n\n');
  const line = (k: string) => head.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1]?.trim() ?? '';
  return {
    id: `note-${str(n.uuid)}`,
    dir: 'out',
    at: stampOf(n.create_date) ?? stampOf(n.timestamp) ?? stampOf(n.edit_date),
    from: '',
    to: line('To'),
    subject: line('Subject'),
    text: withoutSignOff(body.join('\n\n')),
    full: '',
    copy: true,
  };
}

async function noteCopies(jobUuid: string): Promise<Mail[]> {
  let notes: Row[];
  try {
    notes = await sm8List('note.json', `active eq 1 and related_object_uuid eq '${jobUuid}'`);
  } catch (e) {
    if (!(e instanceof Sm8Error) || e.code !== 'sm8-error') return [];
    notes = (await sm8List('note.json', 'active eq 1').catch((): Row[] => [])).filter((n) => str(n.related_object_uuid) === jobUuid);
  }
  return notes.map(noteMail).filter((m): m is Mail => m !== null);
}

/* ---------- what the Job Kit asks for ---------- */

/* A job's conversation, oldest first (the newest 40). `customer` is the job's email address, to tell their
   emails from Raf's when ServiceM8 doesn't say which way one went. */
export async function jobMail(jobUuid: string, customer = ''): Promise<Thread> {
  const got = await emailRows([['related_object_uuid', jobUuid]], true);
  if (!got.ok) return { mails: (await noteCopies(jobUuid)).sort(byTime), readable: false, detail: got.detail };
  const rows = got.rows.map((r) => ({ r, m: mailOf(r, customer) })).sort((a, b) => byTime(a.m, b.m)).slice(-40);
  // A list without the text in it: each email on its own (the newest 15).
  const bare = rows.filter((x) => !x.m.text && x.m.id).slice(-15);
  await Promise.all(
    bare.map(async (x) => {
      const one = await sm8Call(`email/${x.m.id}.json`)
        .then((res) => listOf(res.data)[0])
        .catch(() => undefined);
      if (one) x.m = mailOf({ ...x.r, ...one }, customer);
    }),
  );
  return { mails: rows.map((x) => x.m), readable: true };
}

/* The customers who have emailed in the last 14 days: job uuid -> when their newest email came (London time).
   null when ServiceM8 won't let the account read emails. For Today and the job cards ("Email from ..."). */
export async function recentReplies(): Promise<Record<string, string> | null> {
  const got = await emailRows([['direction', 'inbound']], false);
  if (!got.ok) return null;
  const since = london(new Date(Date.now() - 14 * 864e5));
  const out: Record<string, string> = {};
  for (const r of got.rows) {
    const job = str(r.related_object_uuid);
    const at = dateOf(r);
    if (!job || !at || at < since) continue;
    if (!out[job] || at > out[job]) out[job] = at;
  }
  return out;
}

/* Raf's email to a customer, sent through ServiceM8 and filed on the job, signed off like his other emails.
   No replyTo, so the reply comes back to the job in ServiceM8 (two-way email). Then the conversation again; if
   ServiceM8 won't let the account read emails, a copy is saved as a note on the job so the Job Kit can show it. */
export async function sendJobEmail(e: { job: string; to: string; subject: string; text: string }): Promise<{ thread: Thread; sent: Mail }> {
  const subject = tidy(e.subject).replace(/\s+/g, ' ').trim();
  const text = tidy(e.text).trim();
  const body = `${text}\n\n${signOff()}`;
  const root = sm8Base().replace(/\/api_1\.0$/, '');
  let res: Response;
  try {
    res = await fetch(`${root}/platform_service_email`, {
      method: 'POST',
      headers: { 'X-API-Key': process.env.SERVICEM8_API_KEY ?? '', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: asciiJson({ to: e.to, subject, textBody: body, regardingJobUUID: e.job }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Sm8Error('sm8-down', 502);
  }
  if (!res.ok) throw statusError(res.status, (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 240));

  const sent: Mail = { id: `sent-${randomUUID()}`, dir: 'out', at: london(new Date()), from: '', to: e.to, subject, text, full: '' };
  // It has gone: nothing after this may fail the send.
  const thread: Thread = await jobMail(e.job, e.to).catch(() => ({ mails: [], readable: false, detail: 'read-failed' }));
  if (!thread.readable) {
    const uuid = randomUUID();
    const saved = await sm8Call('note.json', {
      method: 'POST',
      body: { uuid, related_object: 'job', related_object_uuid: e.job, note: `${NOTE_HEAD}\nTo: ${e.to}\nSubject: ${subject}\n\n${body}` },
    })
      .then(() => true)
      .catch(() => false);
    if (saved) {
      sent.id = `note-${uuid}`;
      sent.copy = true;
      if (!thread.mails.some((m) => m.id === sent.id)) thread.mails = [...thread.mails, sent].sort(byTime);
    }
  }
  return { thread, sent };
}
