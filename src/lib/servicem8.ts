import { randomUUID } from 'crypto';

/* ServiceM8 for the Job Kit's "Current jobs". Raf's customers, enquiries, job statuses and invoices live in
   ServiceM8; the Job Kit reads them and writes back through /api/job-kit/sm8 (behind the PIN) with the
   account's API key (Vercel env SERVICEM8_API_KEY, full access; needs the Starter plan or above).
   Customer details only travel phone <-> this server <-> ServiceM8: never to the inbox, the website pages or
   the repo. The diary is ServiceM8's own schedule: each booking (a "job activity" with a start and an end) belongs
   to a job; the Job Kit reads them from yesterday on, and can add, move and cancel one. Cancelling is the only
   removal anywhere here, and ServiceM8 only archives the booking (active 0, restorable); jobs, clients and
   payments are never deleted. API: https://api.servicem8.com/api_1.0, X-API-Key
   header, OData-style $filter ("active eq 1 and status eq 'Quote'"), new records return their uuid in the
   x-record-uuid header (or take the uuid we send). SERVICEM8_API overrides the address for local tests. */

const base = () => (process.env.SERVICEM8_API || 'https://api.servicem8.com/api_1.0').replace(/\/+$/, '');
export const sm8SetUp = () => Boolean(process.env.SERVICEM8_API_KEY);

export const STATUSES = ['Quote', 'Work Order', 'Completed', 'Unsuccessful'] as const;
export type Status = (typeof STATUSES)[number];

/* What the phone gets for each job. Dates are ServiceM8's local time, "YYYY-MM-DDTHH:MM:SS" or null. */
export type CurrentJob = {
  uuid: string;
  number: string; // ServiceM8's job number
  status: Status;
  name: string; // the client
  first: string; // first name, for messages
  mobile: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  description: string;
  created: string | null;
  quoteSent: string | null;
  workOrder: string | null;
  completed: string | null;
  lost: string | null; // when it was marked Unsuccessful
  scheduledUntil: string | null;
  invoiceSent: boolean;
  paid: boolean; // ServiceM8 says paid in full
  total: number | null; // the job's total in ServiceM8 (the quote, then the invoice), as ServiceM8 shows it
  payments: Payment[] | null; // null: ServiceM8 wouldn't give them this time
};
export type Payment = { amount: number; date: string | null; method: string; deposit: boolean };
/* A booking in ServiceM8's schedule: a site visit on a Quote job, work on a Work Order job. Times are
   ServiceM8's local time, "YYYY-MM-DDTHH:MM". */
export type Booking = { uuid: string; jobUuid: string; start: string; end: string | null; staffUuid: string };
export type Staff = { uuid: string; name: string };
export type Current = { jobs: CurrentJob[]; bookings: Booking[] | null; staff: Staff[] };

export class Sm8Error extends Error {
  constructor(
    public code: 'sm8-down' | 'sm8-key' | 'sm8-forbidden' | 'sm8-busy' | 'sm8-error' | 'sm8-bad',
    public status: number,
    public detail = '',
  ) {
    super(code);
  }
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const on = (v: unknown) => v === 1 || v === '1' || v === true;
const odata = (s: string) => s.replace(/'/g, "''");

/* ServiceM8 writes "0000-00-00 00:00:00" for "not yet". */
function when(v: unknown): string | null {
  const s = str(v);
  if (!s || s.startsWith('0000')) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  return m ? `${m[1]}T${m[2] ?? '00:00'}` : null;
}

/* ---------- text ServiceM8 will take ----------
   ServiceM8 turned the first real enquiry down (12 Oct 2026) with 400 "Character Set Not Supported". Text copied
   from WhatsApp carries invisible marks (the direction marks round a copied phone number, the joiners inside
   emoji) and emoji, which ServiceM8 can't store. So every text sent is tidied first: invisible marks and emoji out;
   curly quotes, long dashes, "..." and odd spaces made plain; accented letters and the pound sign stay. The body goes
   as plain ASCII bytes (any other letter written as a JSON \u escape, which ServiceM8 reads back as the same letter). If
   ServiceM8 still says "character set", the same request goes again with plain English letters only (an accented e
   becomes e, the pound sign GBP): first as a form, as ServiceM8's own examples send, then as JSON marked UTF-8. */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufe00-\ufe0f\ufeff\ufff9-\ufffc]/g;
const PLAIN_LETTERS: Record<string, string> = { '\u00df': 'ss', '\u00e6': 'ae', '\u00c6': 'AE', '\u0153': 'oe', '\u0152': 'OE', '\u00f8': 'o', '\u00d8': 'O', '\u0142': 'l', '\u0141': 'L', '\u0111': 'd', '\u0110': 'D' };

export function tidy(s: string, plain = false) {
  let t = s
    .normalize('NFC')
    .replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n')
    .replace(INVISIBLE, '')
    .replace(/[\t\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/[\u2300-\u23ff\u2600-\u27bf\u2b00-\u2bff]/g, '') // the older emoji: hearts, ticks, stars, clocks
    .replace(/[\uD800-\uDFFF]/g, '');
  if (plain)
    t = t
      .replace(/\u00a3\s?/g, 'GBP ')
      .replace(/\u20ac\s?/g, 'EUR ')
      .replace(/[\u00d7\u2715]/g, 'x')
      .replace(/[\u2022\u00b7]/g, '-')
      .replace(/[\u00ab\u00bb]/g, '"')
      .replace(/[\u00df\u00e6\u00c6\u0153\u0152\u00f8\u00d8\u0142\u0141\u0111\u0110]/g, (c) => PLAIN_LETTERS[c] ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\n\x20-\x7E]/g, '');
  return t.replace(/ {2,}/g, ' ').replace(/ +\n/g, '\n');
}

/* A phone number as ServiceM8 should keep it: digits, a leading +, single spaces. */
const phoneOf = (s: string) =>
  tidy(s, true)
    .replace(/\(0\)/g, '')
    .replace(/[^\d+]+/g, ' ')
    .replace(/(?!^)\+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/* Same text once tidied to plain letters, any case and spacing: for "is this the one we sent before?". */
const sameText = (a: string, b: string) => {
  const k = (s: string) => tidy(s, true).replace(/\s+/g, ' ').trim().toLowerCase();
  return k(a) === k(b);
};

type Send = 'json' | 'form' | 'json-utf8';
const asciiJson = (o: unknown) => JSON.stringify(o).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const tidyBody = (b: Row, plain: boolean) =>
  Object.fromEntries(
    Object.entries(b)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, typeof v === 'string' ? tidy(v, plain) : String(v)]),
  ) as Record<string, string>;
const CONTENT_TYPE: Record<Send, string> = { json: 'application/json', form: 'application/x-www-form-urlencoded', 'json-utf8': 'application/json; charset=UTF-8' };

async function call(path: string, opts: { method?: 'GET' | 'POST' | 'DELETE'; query?: Record<string, string>; body?: Row; send?: Send } = {}): Promise<{ data: unknown; uuid: string }> {
  const url = new URL(`${base()}/${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const send = opts.send ?? 'json';
  const body = opts.body ? tidyBody(opts.body, send !== 'json') : undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'X-API-Key': process.env.SERVICEM8_API_KEY ?? '',
        Accept: 'application/json',
        ...(body ? { 'Content-Type': CONTENT_TYPE[send] } : {}),
      },
      body: body ? (send === 'form' ? new URLSearchParams(body).toString() : asciiJson(body)) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Sm8Error('sm8-down', 502);
  }
  const text = await res.text().catch(() => '');
  const short = text.replace(/\s+/g, ' ').slice(0, 240);
  if (res.status === 401) throw new Sm8Error('sm8-key', 502, short);
  if (res.status === 403) throw new Sm8Error('sm8-forbidden', 502, short);
  if (res.status === 429) throw new Sm8Error('sm8-busy', 429, short);
  if (!res.ok && body && res.status === 400 && /character set/i.test(text)) {
    const next: Send | null = send === 'json' ? 'form' : send === 'form' ? 'json-utf8' : null;
    if (next) return call(path, { ...opts, send: next });
  }
  if (!res.ok) throw new Sm8Error('sm8-error', 502, `${res.status} ${short}`);
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { data, uuid: res.headers.get('x-record-uuid') ?? '' };
}

const rows = (d: unknown): Row[] => (Array.isArray(d) ? (d as Row[]) : d && typeof d === 'object' && 'uuid' in d ? [d as Row] : []);
const list = async (path: string, filter: string) => rows((await call(path, { query: { $filter: filter } })).data);

/* The area for a design page: the town from ServiceM8's map lookup, or the start of the postcode. */
function areaOf(j: Row) {
  const city = str(j.geo_city);
  if (city && !/^london$/i.test(city)) return city;
  const pc = str(j.geo_postcode) || (str(j.job_address).match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/i)?.[1] ?? '');
  return pc ? pc.split(/\s+/)[0].toUpperCase() : city;
}

const money = (v: unknown) => {
  const n = Number.parseFloat(str(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function shape(j: Row, client?: Row, contact?: Row, pays?: Row[] | null): CurrentJob {
  const status = (STATUSES as readonly string[]).includes(str(j.status)) ? (str(j.status) as Status) : 'Quote';
  const person = [str(contact?.first), str(contact?.last)].filter(Boolean).join(' ');
  const name = str(client?.name) || person || 'No name';
  return {
    uuid: str(j.uuid),
    number: str(j.generated_job_id),
    status,
    name,
    first: str(contact?.first) || name.split(/\s+/)[0],
    mobile: str(contact?.mobile),
    phone: str(contact?.phone),
    email: str(contact?.email),
    address: str(j.job_address),
    area: areaOf(j),
    description: str(j.job_description),
    created: when(j.date) ?? when(j.quote_date) ?? when(j.edit_date),
    quoteSent: on(j.quote_sent) ? (when(j.quote_sent_stamp) ?? when(j.edit_date)) : null,
    workOrder: when(j.work_order_date),
    completed: when(j.completion_date),
    lost: when(j.unsuccessful_date),
    scheduledUntil: when(j.job_is_scheduled_until_stamp),
    invoiceSent: on(j.invoice_sent),
    paid: on(j.payment_received),
    total: money(j.total_invoice_amount) > 0 ? money(j.total_invoice_amount) : null,
    payments:
      pays === null
        ? null
        : (pays ?? [])
            .map((p) => ({ amount: money(p.amount), date: when(p.timestamp), method: str(p.method), deposit: on(p.is_deposit) }))
            .filter((p) => p.amount !== 0)
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
  };
}

/* Today's date in London, moved by `days`, as "YYYY-MM-DD". */
function londonDay(days = 0) {
  return new Date(Date.now() + days * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/London' });
}

/* Bookings from `since` on. ServiceM8's filter should take a date ("start_date gt '...'"); if it turns that down,
   ask for all active ones and pick here. Only scheduled ones count (not time recorded after the work). */
async function scheduled(since: string): Promise<Row[]> {
  let acts: Row[];
  try {
    acts = await list('jobactivity.json', `active eq 1 and start_date gt '${since} 00:00:00'`);
  } catch (e) {
    if (!(e instanceof Sm8Error) || e.code !== 'sm8-error') throw e;
    acts = await list('jobactivity.json', 'active eq 1');
  }
  return acts.filter((a) => str(a.active) !== '0' && on(a.activity_was_scheduled) && (when(a.start_date) ?? '') >= since);
}

function booking(a: Row): Booking | null {
  const start = when(a.start_date)?.slice(0, 16);
  if (!start || !str(a.uuid) || !str(a.job_uuid)) return null;
  const end = when(a.end_date)?.slice(0, 16);
  return { uuid: str(a.uuid), jobUuid: str(a.job_uuid), start, end: end && end > start ? end : null, staffUuid: str(a.staff_uuid) };
}

/* Open quotes, work orders, and the jobs finished or marked unsuccessful in the last 30 days, newest first,
   with the client, the best contact (the job's own contact, else the client's) and the payments taken; plus the
   bookings from yesterday on and the jobs they belong to, and the staff (for who a booking is for). Two rounds of
   requests; if ServiceM8 won't give the payments or the bookings, the jobs still come, without them. */
export async function currentJobs(): Promise<Current> {
  const [[quotes, orders, done, lost], acts, staffRows] = await Promise.all([
    Promise.all(['Quote', 'Work Order', 'Completed', 'Unsuccessful'].map((s) => list('job.json', `active eq 1 and status eq '${s}'`))),
    scheduled(londonDay(-1)).catch((): Row[] | null => null),
    list('staff.json', 'active eq 1').catch((): Row[] => []),
  ]);
  const cutoff = Date.now() - 30 * 864e5;
  const since = (field: string) => (j: Row) => {
    const t = Date.parse(when(j[field]) ?? when(j.edit_date) ?? '');
    return Number.isFinite(t) && t >= cutoff;
  };
  const jobs = [...quotes, ...orders, ...done.filter(since('completion_date')), ...lost.filter(since('unsuccessful_date'))].filter((j) => str(j.uuid) && str(j.active) !== '0');
  const bookings = acts === null ? null : acts.map(booking).filter((b): b is Booking => b !== null);
  // A booking on a job that isn't in the list above (finished or lost a while ago): fetch that job too.
  const have = new Set(jobs.map((j) => str(j.uuid)));
  const missing = [...new Set((bookings ?? []).map((b) => b.jobUuid).filter((u) => !have.has(u)))].slice(0, 20);
  const staff: Staff[] = staffRows
    .filter((r) => str(r.uuid) && str(r.active) !== '0')
    .map((r) => ({ uuid: str(r.uuid), name: [str(r.first), str(r.last)].filter(Boolean).join(' ') || 'Staff' }));
  if (!jobs.length && !missing.length) return { jobs: [], bookings: bookings ?? null, staff };
  const [clients, jobContacts, clientContacts, payments, extra] = await Promise.all([
    list('company.json', 'active eq 1'),
    list('jobcontact.json', 'active eq 1'),
    list('companycontact.json', 'active eq 1'),
    list('jobpayment.json', 'active eq 1').catch(() => null),
    Promise.all(missing.map((u) => call(`job/${u}.json`).then((r) => rows(r.data)[0]).catch(() => undefined))),
  ]);
  for (const j of extra) if (j && str(j.uuid) && str(j.active) !== '0') jobs.push(j);
  const paysBy = new Map<string, Row[]>();
  for (const p of payments ?? []) paysBy.set(str(p.job_uuid), [...(paysBy.get(str(p.job_uuid)) ?? []), p]);
  const clientBy = new Map(clients.map((c) => [str(c.uuid), c]));
  const useful = (c: Row) => str(c.mobile) || str(c.phone) || str(c.email) || str(c.first);
  const rank = (c: Row) => (/^(job|job contact)$/i.test(str(c.type)) ? 0 : /billing/i.test(str(c.type)) ? 1 : 2) - (on(c.is_primary_contact) ? 0.5 : 0);
  const best = (cs: Row[]) => cs.filter(useful).sort((a, b) => rank(a) - rank(b))[0];
  const byJob = new Map<string, Row[]>();
  for (const c of jobContacts) byJob.set(str(c.job_uuid), [...(byJob.get(str(c.job_uuid)) ?? []), c]);
  const byClient = new Map<string, Row[]>();
  for (const c of clientContacts) byClient.set(str(c.company_uuid), [...(byClient.get(str(c.company_uuid)) ?? []), c]);
  const out = jobs.map((j) =>
    shape(j, clientBy.get(str(j.company_uuid)), best(byJob.get(str(j.uuid)) ?? []) ?? best(byClient.get(str(j.company_uuid)) ?? []), payments === null ? null : (paysBy.get(str(j.uuid)) ?? [])),
  );
  const known = new Set(out.map((j) => j.uuid));
  return {
    jobs: out.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '')),
    bookings: bookings === null ? null : bookings.filter((b) => known.has(b.jobUuid)).sort((a, b) => a.start.localeCompare(b.start)),
    staff,
  };
}

/* A client already in ServiceM8 with this name, in any case and spacing; a name with an accent also finds the
   same name saved with plain letters by an earlier try. Asked by name first; if that finds nothing (or ServiceM8
   won't take the name in a filter), all active clients are read and matched here. */
async function clientNamed(name: string): Promise<Row | undefined> {
  const pick = (cs: Row[]) => cs.find((c) => sameText(str(c.name), name));
  const byName = await list('company.json', `active eq 1 and name eq '${odata(name)}'`).catch((e) => {
    if (!(e instanceof Sm8Error) || e.code !== 'sm8-error') throw e;
    return [] as Row[];
  });
  return pick(byName) ?? pick(await list('company.json', 'active eq 1'));
}

/* A new enquiry typed into the Job Kit: the client (reused when the name matches one already in ServiceM8),
   its billing contact, a Quote job with the address and what they want, and the job's own contact.
   Safe to send again after a try that stopped half way (no signal, or ServiceM8 turning one part down): a client
   with no contact gets its billing contact, and a Quote job of that client with the same description is used
   instead of making a second one (it gets its job contact if it has none). */
export async function createEnquiry(e: { name: string; mobile: string; email: string; address: string; description: string }): Promise<CurrentJob> {
  const name = tidy(e.name).replace(/\s+/g, ' ').trim();
  const address = tidy(e.address).trim();
  const description = tidy(e.description).trim();
  const [first, ...rest] = name.split(' ');
  const person = { first, last: rest.join(' '), mobile: phoneOf(e.mobile) || undefined, email: tidy(e.email).replace(/\s+/g, '') || undefined };
  const none = (rs: Row[] | null) => rs !== null && rs.length === 0; // known to have none (not just "couldn't check")

  let clientUuid = str((await clientNamed(name))?.uuid);
  const newClient = !clientUuid;
  if (newClient) {
    const uuid = randomUUID();
    const made = await call('company.json', { method: 'POST', body: { uuid, name, address: address || undefined } });
    clientUuid = made.uuid || uuid;
  }
  if (newClient || none(await list('companycontact.json', `active eq 1 and company_uuid eq '${clientUuid}'`).catch(() => null))) {
    await call('companycontact.json', { method: 'POST', body: { uuid: randomUUID(), company_uuid: clientUuid, ...person, type: 'BILLING', is_primary_contact: '1' } });
  }

  let uuid = '';
  if (!newClient) {
    const quotes = await list('job.json', `active eq 1 and company_uuid eq '${clientUuid}' and status eq 'Quote'`).catch((): Row[] => []);
    uuid = str(quotes.find((j) => sameText(str(j.job_description), description))?.uuid);
  }
  const again = Boolean(uuid);
  if (!again) {
    const jobUuid = randomUUID();
    const made = await call('job.json', {
      method: 'POST',
      body: { uuid: jobUuid, company_uuid: clientUuid, status: 'Quote', job_address: address || undefined, job_description: description },
    });
    uuid = made.uuid || jobUuid;
  }
  if (!again || none(await list('jobcontact.json', `active eq 1 and job_uuid eq '${uuid}'`).catch(() => null))) {
    await call('jobcontact.json', { method: 'POST', body: { uuid: randomUUID(), job_uuid: uuid, ...person, type: 'JOB' } });
  }

  // Read it back for the job number ServiceM8 gives it; if that fails, what we sent is enough.
  const back = rows((await call(`job/${uuid}.json`).catch(() => ({ data: null }))).data)[0];
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/London' }).replace(' ', 'T').slice(0, 16);
  return shape(back ?? { uuid, status: 'Quote', job_address: address, job_description: description, date: now }, { name }, { ...person, type: 'JOB' });
}

export async function setStatus(uuid: string, status: Status) {
  await call(`job/${uuid}.json`, { method: 'POST', body: { status } });
}

/* ---------- the diary: bookings in ServiceM8's schedule ---------- */

const sm8Time = (t: string) => `${t.slice(0, 10)} ${t.slice(11, 16)}:00`;

/* A new booking on a job. Without a staff member given, it goes to the first active one (a one-person account
   has only Raf). */
export async function addBooking(b: { jobUuid: string; start: string; end: string; staffUuid?: string }): Promise<Booking> {
  let staffUuid = b.staffUuid || '';
  if (!staffUuid) staffUuid = str((await list('staff.json', 'active eq 1'))[0]?.uuid);
  const uuid = randomUUID();
  const made = await call('jobactivity.json', {
    method: 'POST',
    body: { uuid, job_uuid: b.jobUuid, staff_uuid: staffUuid || undefined, start_date: sm8Time(b.start), end_date: sm8Time(b.end), activity_was_scheduled: '1' },
  });
  return { uuid: made.uuid || uuid, jobUuid: b.jobUuid, start: b.start, end: b.end, staffUuid };
}

export async function moveBooking(uuid: string, start: string, end: string) {
  await call(`jobactivity/${uuid}.json`, { method: 'POST', body: { start_date: sm8Time(start), end_date: sm8Time(end) } });
}

/* ServiceM8 archives it (active 0): gone from the schedule, restorable there. */
export async function cancelBooking(uuid: string) {
  await call(`jobactivity/${uuid}.json`, { method: 'DELETE' });
}

/* ---------- briefs sent straight from the website (Plan your project, "Send to Raf") ---------- */

const statusError = (status: number, short: string) =>
  status === 401 ? new Sm8Error('sm8-key', 502, short) : status === 403 ? new Sm8Error('sm8-forbidden', 502, short) : status === 429 ? new Sm8Error('sm8-busy', 429, short) : new Sm8Error('sm8-error', 502, `${status} ${short}`);

/* A customer's photo, attached to their job in one multipart request (ServiceM8's recommended way: the file in a
   field called `file`, a name with an extension, related_object job). We send our own uuid, so a retry is safe:
   ServiceM8 answers 409 when it already has that attachment. */
export async function attachPhoto(jobUuid: string, photo: Blob, fileName: string, uuid: string): Promise<string> {
  const fd = new FormData();
  fd.set('file', photo, fileName);
  fd.set('related_object', 'job');
  fd.set('related_object_uuid', jobUuid);
  fd.set('attachment_name', fileName);
  fd.set('uuid', uuid);
  let res: Response;
  try {
    res = await fetch(`${base()}/attachment.json`, {
      method: 'POST',
      headers: { 'X-API-Key': process.env.SERVICEM8_API_KEY ?? '', Accept: 'application/json' },
      body: fd,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Sm8Error('sm8-down', 502);
  }
  if (res.status === 409) return uuid; // already there from an earlier try
  const text = await res.text().catch(() => '');
  if (!res.ok) throw statusError(res.status, text.replace(/\s+/g, ' ').slice(0, 240));
  return res.headers.get('x-record-uuid') || uuid;
}

/* ServiceM8 has been seen not to show attachments added through the API in the job's diary until the job itself
   changes; its support suggested saving the job's status again. Best effort: nothing fails if this does. */
export async function touchJob(uuid: string) {
  try {
    const job = rows((await call(`job/${uuid}.json`)).data)[0];
    const status = str(job?.status);
    if (status) await call(`job/${uuid}.json`, { method: 'POST', body: { status } });
  } catch {
    /* the photos are on the job either way */
  }
}

/* An email to Raf through ServiceM8's own email (Messaging API), filed in the job's diary. Best effort: if the
   account's key may not send email, the brief is still in ServiceM8 as a Quote job and on the Job Kit's Today. */
export async function emailRaf(to: string, subject: string, text: string, jobUuid: string): Promise<boolean> {
  const root = base().replace(/\/api_1\.0$/, '');
  try {
    const res = await fetch(`${root}/platform_service_email`, {
      method: 'POST',
      headers: { 'X-API-Key': process.env.SERVICEM8_API_KEY ?? '', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: asciiJson({ to, subject: tidy(subject), textBody: tidy(text), regardingJobUUID: jobUuid }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
