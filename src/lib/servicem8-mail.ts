import { randomUUID } from 'crypto';
import { asciiJson, sm8Base, sm8Call, sm8List, sm8Str as str, sm8When as when, Sm8Error, statusError, tidy, type Sm8Row as Row } from './servicem8';
import { e164, freshPart, htmlToText, looksHtml, signOff, SMS_SIGN_OFF, textOnly, withoutSignOff } from './mail-text';

/* A job's emails and texts in the Job Kit (Current jobs, the job, Emails and texts): Raf writes there, it goes out through ServiceM8's
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
   Texts (SMS) work the same way: POST /platform_service_sms {to (E.164), message, regardingJobUUID}, which uses
   the account's text credits (one per 153 characters) and, with ServiceM8's two-way texts (part of every plan),
   ends with a "Reply here" link whose replies land in the job's diary; read back from GET /api_1.0/sms.json (same
   preview as email.json, same fallbacks, copies as notes headed "Text sent from the Job Kit").
   Customer details only travel phone <-> this server <-> ServiceM8. */

export type Mail = {
  id: string;
  via?: 'email' | 'sms'; // missing on emails kept on the phone from before texts
  dir: 'in' | 'out';
  at: string | null; // London time, "YYYY-MM-DDTHH:MM"
  from: string; // an email address, or a number for a text
  to: string;
  subject: string; // '' for a text
  text: string; // the new part (no quoted earlier emails, no sign-off)
  full: string; // the whole email when `text` leaves something out, else ''
  copy?: boolean; // a copy kept as a note on the job (emails can't be read on this account)
  keys?: string[]; // only when no text could be found: the email's field names
};
/* readable: ServiceM8 lets the account read its emails; texts: the same for texts (missing before texts). */
export type Thread = { mails: Mail[]; readable: boolean; texts?: boolean; detail?: string };

export const NOTE_HEAD = 'Email sent from the Job Kit';
export const TEXT_NOTE_HEAD = 'Text sent from the Job Kit';

/* ---------- reading ServiceM8's email records ---------- */

const listOf = (d: unknown): Row[] => {
  if (Array.isArray(d)) return d as Row[];
  if (d && typeof d === 'object') {
    for (const k of ['data', 'items', 'emails', 'sms', 'messages', 'results', 'records']) if (Array.isArray((d as Row)[k])) return (d as Row)[k] as Row[];
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
const DIR_KEYS = ['direction', 'message_direction', 'email_direction', 'sms_direction'];
// Texts: the numbers (the text itself is under one of TEXT_KEYS, most likely `message`)
const FROM_NUMBER_KEYS = ['from', 'from_number', 'from_mobile', 'from_phone', 'sender', 'sender_number', 'originator'];
const TO_NUMBER_KEYS = ['to', 'to_number', 'to_mobile', 'to_phone', 'mobile', 'phone', 'recipient', 'recipient_number', 'destination'];
const KNOWN = new Set([...TEXT_KEYS, ...HTML_KEYS, ...SUBJECT_KEYS, ...FROM_KEYS, ...TO_KEYS, ...DATE_KEYS, ...DIR_KEYS, ...FROM_NUMBER_KEYS, ...TO_NUMBER_KEYS, 'uuid', 'related_object', 'related_object_uuid', 'active']);

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
/* A phone number in a record, as +44..., or ''. */
const numberOf = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if ((typeof v === 'string' || typeof v === 'number') && /\d{6,}/.test(String(v).replace(/\s+/g, ''))) {
      const n = e164(String(v));
      if (n) return n;
    }
  }
  return '';
};
const sameNumber = (a: string, b: string) => Boolean(a && b) && a.replace(/\D/g, '').slice(-9) === b.replace(/\D/g, '').slice(-9);
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
    via: 'email',
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

/* A text from ServiceM8's sms.json. `mobile` is the job's, to tell their texts from Raf's when ServiceM8 doesn't say. */
export function textOf(r: Row, mobile: string, dir?: 'in' | 'out'): Mail {
  const from = numberOf(r, FROM_NUMBER_KEYS);
  const to = numberOf(r, TO_NUMBER_KEYS);
  const d = first(r, DIR_KEYS).toLowerCase();
  const way: 'in' | 'out' =
    dir ?? (/^(in|inbound|incoming|received|reply)/.test(d) ? 'in' : /^(out|outbound|outgoing|sent)/.test(d) ? 'out' : sameNumber(from, mobile) ? 'in' : 'out');
  const raw = tidy(rawText(r)).replace(/\r\n?/g, '\n').trim();
  const text = way === 'out' ? textOnly(raw) : raw;
  const mail: Mail = { id: str(r.uuid), via: 'sms', dir: way, at: dateOf(r), from, to, subject: '', text, full: '' };
  if (!text) mail.keys = Object.keys(r).slice(0, 40);
  return mail;
}

const byTime = (a: Mail, b: Mail) => (a.at ?? '').localeCompare(b.at ?? '');

/* ServiceM8 turning email (or text) reading down for this account, as opposed to a filter it didn't like. */
const refused = (e: Sm8Error) => e.code === 'sm8-forbidden' || (e.code === 'sm8-error' && (/^404\b/.test(e.detail) || /authori[sz]ed|object type|scope|permission|not (?:enabled|available)/i.test(e.detail)));

type Got = { ok: true; rows: Row[] } | { ok: false; detail: string };
async function historyRows(kind: 'email' | 'sms', conds: [string, string][], orAll: boolean): Promise<Got> {
  const filters = [conds.map(([k, v]) => `${k} eq '${v}'`).join(' and '), conds.map(([k, v]) => `${k} eq ${v}`).join(' and ')];
  let detail = '';
  const tryIt = async (query?: Record<string, string>): Promise<Got | null> => {
    try {
      return { ok: true, rows: listOf((await sm8Call(`${kind}.json`, { query })).data) };
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
  const sms = note.startsWith(TEXT_NOTE_HEAD);
  if (!sms && !note.startsWith(NOTE_HEAD)) return null;
  const [head, ...body] = note.split('\n\n');
  const line = (k: string) => head.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1]?.trim() ?? '';
  return {
    id: `note-${str(n.uuid)}`,
    via: sms ? 'sms' : 'email',
    dir: 'out',
    at: stampOf(n.create_date) ?? stampOf(n.timestamp) ?? stampOf(n.edit_date),
    from: '',
    to: line('To'),
    subject: sms ? '' : line('Subject'),
    text: sms ? textOnly(body.join('\n\n')) : withoutSignOff(body.join('\n\n')),
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

/* One kind (emails or texts) of a job's conversation, oldest first (the newest 40), or null if ServiceM8 won't let
   the account read that kind. */
async function jobHistory(kind: 'email' | 'sms', jobUuid: string, read: (r: Row) => Mail): Promise<{ mails: Mail[] | null; detail?: string }> {
  const got = await historyRows(kind, [['related_object_uuid', jobUuid]], true);
  if (!got.ok) return { mails: null, detail: got.detail };
  const rows = got.rows.map((r) => ({ r, m: read(r) })).sort((a, b) => byTime(a.m, b.m)).slice(-40);
  // A list without the text in it: each one on its own (the newest 15).
  const bare = rows.filter((x) => !x.m.text && x.m.id).slice(-15);
  await Promise.all(
    bare.map(async (x) => {
      const one = await sm8Call(`${kind}/${x.m.id}.json`)
        .then((res) => listOf(res.data)[0])
        .catch(() => undefined);
      if (one) x.m = read({ ...x.r, ...one });
    }),
  );
  return { mails: rows.map((x) => x.m) };
}

/* A job's conversation, emails and texts together, oldest first (the newest 40). `customer` and `mobile` are the
   job's, to tell their messages from Raf's when ServiceM8 doesn't say which way one went. What can't be read
   comes from the copies kept as notes. */
export async function jobMail(jobUuid: string, customer = '', mobile = ''): Promise<Thread> {
  const [emails, texts] = await Promise.all([
    jobHistory('email', jobUuid, (r) => mailOf(r, customer)),
    jobHistory('sms', jobUuid, (r) => textOf(r, mobile)).catch((e) => {
      // texts are extra: if reading them fails for any other reason, the emails still come
      if (e instanceof Sm8Error && e.code === 'sm8-key') throw e;
      return { mails: null, detail: e instanceof Sm8Error ? e.detail : '' };
    }),
  ]);
  const copies = emails.mails && texts.mails ? [] : await noteCopies(jobUuid);
  const mails = [
    ...(emails.mails ?? copies.filter((m) => m.via !== 'sms')),
    ...(texts.mails ?? copies.filter((m) => m.via === 'sms')),
  ]
    .sort(byTime)
    .slice(-40);
  return { mails, readable: emails.mails !== null, texts: texts.mails !== null, detail: emails.detail ?? texts.detail };
}

/* The customers who have emailed or texted in the last 14 days: job uuid -> when their newest message came (London
   time). null when ServiceM8 won't let the account read either. For Today and the job cards ("Message from ..."). */
export async function recentReplies(): Promise<Record<string, string> | null> {
  const [emails, texts] = await Promise.all(
    (['email', 'sms'] as const).map((k) => historyRows(k, [['direction', 'inbound']], false).catch((): Got => ({ ok: false, detail: '' }))),
  );
  if (!emails.ok && !texts.ok) return null;
  const since = london(new Date(Date.now() - 14 * 864e5));
  const out: Record<string, string> = {};
  for (const r of [...(emails.ok ? emails.rows : []), ...(texts.ok ? texts.rows : [])]) {
    const job = str(r.related_object_uuid);
    const at = dateOf(r);
    if (!job || !at || at < since) continue;
    if (!out[job] || at > out[job]) out[job] = at;
  }
  return out;
}

/* An address typed in the Job Kit for a job that had no email in ServiceM8: saved on the job's contact (the job
   contact without an email, else the client's contact without one), so it's there next time. Never overwrites an
   email already saved; best effort. */
async function saveEmail(jobUuid: string, email: string): Promise<boolean> {
  try {
    const blank = (c: Row) => !str(c.email);
    const jobContacts = await sm8List('jobcontact.json', `active eq 1 and job_uuid eq '${jobUuid}'`);
    if (jobContacts.some((c) => str(c.email))) return false;
    let contact = jobContacts.find(blank);
    let path = 'jobcontact';
    if (!contact) {
      const job = listOf((await sm8Call(`job/${jobUuid}.json`)).data)[0];
      const company = str(job?.company_uuid);
      if (!company) return false;
      const clientContacts = await sm8List('companycontact.json', `active eq 1 and company_uuid eq '${company}'`);
      if (clientContacts.some((c) => str(c.email))) return false;
      contact = clientContacts.find(blank);
      path = 'companycontact';
    }
    if (!contact || !str(contact.uuid)) return false;
    await sm8Call(`${path}/${str(contact.uuid)}.json`, { method: 'POST', body: { email } });
    return true;
  } catch {
    return false;
  }
}

/* Raf's email to a customer, sent through ServiceM8 and filed on the job, signed off like his other emails.
   No replyTo, so the reply comes back to the job in ServiceM8 (two-way email). Then the conversation again; if
   ServiceM8 won't let the account read emails, a copy is saved as a note on the job so the Job Kit can show it. */
export async function sendJobEmail(e: { job: string; to: string; subject: string; text: string; save?: boolean; mobile?: string }): Promise<{ thread: Thread; sent: Mail; saved: boolean }> {
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

  const sent: Mail = { id: `sent-${randomUUID()}`, via: 'email', dir: 'out', at: london(new Date()), from: '', to: e.to, subject, text, full: '' };
  // It has gone: nothing after this may fail the send.
  const [thread, saved]: [Thread, boolean] = await Promise.all([
    jobMail(e.job, e.to, e.mobile).catch((): Thread => ({ mails: [], readable: false, texts: false, detail: 'read-failed' })),
    e.save ? saveEmail(e.job, e.to) : Promise.resolve(false),
  ]);
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
  return { thread, sent, saved };
}

/* Raf's text to a customer, sent through ServiceM8 (it uses the account's text credits) and filed on the job,
   signed "Raf, Raf Carpentry". ServiceM8's two-way texts add a "Reply here" link; the reply lands on the job.
   ServiceM8 says special characters aren't supported in texts: the text is tidied (emoji and invisible marks out,
   curly quotes plain), and if ServiceM8 still turns it down for its characters, it goes again in plain letters
   only (accents off, the pound sign as GBP). Then the conversation again; if ServiceM8 won't let the account read
   texts, a copy is saved as a note on the job. */
export async function sendJobText(e: { job: string; to: string; text: string; email?: string }): Promise<{ thread: Thread; sent: Mail }> {
  const to = e164(e.to);
  if (!to) throw new Sm8Error('sm8-bad', 400, 'not a mobile number');
  const root = sm8Base().replace(/\/api_1\.0$/, '');
  const go = (plain: boolean) =>
    fetch(`${root}/platform_service_sms`, {
      method: 'POST',
      headers: { 'X-API-Key': process.env.SERVICEM8_API_KEY ?? '', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: asciiJson({ to, message: `${tidy(e.text, plain).trim()}\n${SMS_SIGN_OFF}`, regardingJobUUID: e.job }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  let res: Response;
  try {
    res = await go(false);
    if (res.status === 400) {
      const why = await res.clone().text().catch(() => '');
      if (/charact|special|encod|unicode/i.test(why)) res = await go(true);
    }
  } catch {
    throw new Sm8Error('sm8-down', 502);
  }
  if (!res.ok) throw statusError(res.status, (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 240));

  const text = tidy(e.text).trim();
  const sent: Mail = { id: `sent-${randomUUID()}`, via: 'sms', dir: 'out', at: london(new Date()), from: '', to, subject: '', text, full: '' };
  // It has gone: nothing after this may fail the send.
  const thread: Thread = await jobMail(e.job, e.email ?? '', to).catch((): Thread => ({ mails: [], readable: false, texts: false, detail: 'read-failed' }));
  if (!thread.texts) {
    const uuid = randomUUID();
    const saved = await sm8Call('note.json', {
      method: 'POST',
      body: { uuid, related_object: 'job', related_object_uuid: e.job, note: `${TEXT_NOTE_HEAD}\nTo: ${to}\n\n${text}\n${SMS_SIGN_OFF}` },
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
