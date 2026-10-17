import { randomUUID } from 'crypto';

/* Enquiries from rafalsolutions.co.uk go straight into Rafal's ServiceM8, the same way the Raf Carpentry website's
   "Send to Raf" does (ported from raf-carpentry src/lib/servicem8.ts, which runs on his real account): a client
   (reused when the name matches), its billing contact, a Quote job with what they wrote, the job's own contact, then
   two emails through ServiceM8's Messaging API filed on the job: a note to Rafal and a thank-you to the visitor.
   Needs SERVICEM8_API_KEY in Vercel (the account's API key, Starter plan or above). SERVICEM8_API overrides the
   address for local tests. Customer details only travel browser -> this server -> ServiceM8. */

const base = () => (process.env.SERVICEM8_API || 'https://api.servicem8.com/api_1.0').replace(/\/+$/, '');
export const sm8SetUp = () => Boolean(process.env.SERVICEM8_API_KEY);

export class Sm8Error extends Error {
  constructor(
    public code: 'sm8-down' | 'sm8-key' | 'sm8-forbidden' | 'sm8-busy' | 'sm8-error',
    public status: number,
    public detail = '',
  ) {
    super(code);
  }
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const odata = (s: string) => s.replace(/'/g, "''");

/* ServiceM8 turns down text with invisible marks and emoji ("Character Set Not Supported"), so every text is tidied
   first; if it still refuses, the request goes again with plain letters only, first as a form, then as UTF-8 JSON. */
/* The character classes are built from code points so the source stays plain ASCII. */
const ch = (n: number) => String.fromCharCode(n);
const cls = (...parts: (number | [number, number])[]) => new RegExp(`[${parts.map((p) => (Array.isArray(p) ? `${ch(p[0])}-${ch(p[1])}` : ch(p))).join('')}]`, 'g');

const INVISIBLE = cls([0x00, 0x08], 0x0b, 0x0c, [0x0e, 0x1f], [0x7f, 0x9f], 0xad, 0x180e, [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x206f], [0xfe00, 0xfe0f], 0xfeff, [0xfff9, 0xfffc]);
const LINE_BREAKS = new RegExp(`${ch(13)}${ch(10)}?|[${ch(13)}${ch(0x85)}${ch(0x2028)}${ch(0x2029)}]`, 'g');
const SPACES = cls(9, 0xa0, 0x1680, [0x2000, 0x200a], 0x202f, 0x205f, 0x3000);
const SINGLE_QUOTES = cls(0x2018, 0x2019, 0x201a, 0x201b, 0x2032, 0x2035);
const DOUBLE_QUOTES = cls(0x201c, 0x201d, 0x201e, 0x201f, 0x2033, 0x2036);
const DASHES = cls([0x2010, 0x2015], 0x2212);
const ELLIPSIS = cls(0x2026);
const SYMBOLS = cls([0x2300, 0x23ff], [0x2600, 0x27bf], [0x2b00, 0x2bff]);
const SURROGATES = cls([0xd800, 0xdfff]); // emoji and other characters outside the basic plane
const POUND = new RegExp(`${ch(0xa3)} ?`, 'g');
const TIMES = cls(0xd7, 0x2715);
const BULLETS = cls(0x2022, 0xb7);
const ACCENTS = cls([0x300, 0x36f]);
/* Letters that don't split into a plain letter plus an accent (the Polish l with a stroke, German sharp s...). */
const PLAIN_LETTERS: Record<string, string> = { [ch(0x141)]: 'L', [ch(0x142)]: 'l', [ch(0xdf)]: 'ss', [ch(0xe6)]: 'ae', [ch(0xc6)]: 'AE', [ch(0xf8)]: 'o', [ch(0xd8)]: 'O', [ch(0x111)]: 'd', [ch(0x110)]: 'D', [ch(0x153)]: 'oe', [ch(0x152)]: 'OE' };
const SPECIAL_LETTERS = cls(...Object.keys(PLAIN_LETTERS).map((c) => c.charCodeAt(0)));

export function tidy(s: string, plain = false) {
  let t = s
    .normalize('NFC')
    .replace(LINE_BREAKS, '\n')
    .replace(INVISIBLE, '')
    .replace(SPACES, ' ')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, '-')
    .replace(ELLIPSIS, '...')
    .replace(SYMBOLS, '')
    .replace(SURROGATES, '');
  if (plain)
    t = t
      .replace(POUND, 'GBP ')
      .replace(TIMES, 'x')
      .replace(BULLETS, '-')
      .replace(SPECIAL_LETTERS, (c) => PLAIN_LETTERS[c] ?? '')
      .normalize('NFKD')
      .replace(ACCENTS, '')
      .replace(/[^\n\x20-\x7E]/g, '');
  return t.replace(/ {2,}/g, ' ').replace(/ +\n/g, '\n');
}

const phoneOf = (s: string) =>
  tidy(s, true)
    .replace(/\(0\)/g, '')
    .replace(/[^\d+]+/g, ' ')
    .replace(/(?!^)\+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const sameText = (a: string, b: string) => {
  const k = (s: string) => tidy(s, true).replace(/\s+/g, ' ').trim().toLowerCase();
  return k(a) === k(b);
};

type Send = 'json' | 'form' | 'json-utf8';
const NON_ASCII = cls([0x7f, 0xffff]);
const asciiJson = (o: unknown) => JSON.stringify(o).replace(NON_ASCII, (c) => `${ch(92)}u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const tidyBody = (b: Row, plain: boolean) =>
  Object.fromEntries(
    Object.entries(b)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, typeof v === 'string' ? tidy(v, plain) : String(v)]),
  ) as Record<string, string>;
const CONTENT_TYPE: Record<Send, string> = { json: 'application/json', form: 'application/x-www-form-urlencoded', 'json-utf8': 'application/json; charset=UTF-8' };

async function call(path: string, opts: { method?: 'GET' | 'POST'; query?: Record<string, string>; body?: Row; send?: Send } = {}): Promise<{ data: unknown; uuid: string }> {
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
      signal: AbortSignal.timeout(15_000),
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

async function clientNamed(name: string): Promise<Row | undefined> {
  const pick = (cs: Row[]) => cs.find((c) => sameText(str(c.name), name));
  const byName = await list('company.json', `active eq 1 and name eq '${odata(name)}'`).catch((e) => {
    if (!(e instanceof Sm8Error) || e.code !== 'sm8-error') throw e;
    return [] as Row[];
  });
  return pick(byName);
}

/* A new enquiry: returns the job's uuid and ServiceM8's job number (empty if it couldn't be read back). Safe to send
   again after a try that stopped half way: a Quote job of the same client with the same description is reused. */
export async function createEnquiry(e: { name: string; mobile: string; email: string; company: string; description: string }): Promise<{ uuid: string; number: string }> {
  const name = tidy(e.name).replace(/\s+/g, ' ').trim();
  const company = tidy(e.company).replace(/\s+/g, ' ').trim();
  const description = tidy(e.description).trim();
  const [first, ...rest] = name.split(' ');
  const person = { first, last: rest.join(' '), mobile: phoneOf(e.mobile) || undefined, email: tidy(e.email).replace(/\s+/g, '') || undefined };
  const clientName = company || name;

  let clientUuid = str((await clientNamed(clientName))?.uuid);
  const newClient = !clientUuid;
  if (newClient) {
    const uuid = randomUUID();
    const made = await call('company.json', { method: 'POST', body: { uuid, name: clientName } });
    clientUuid = made.uuid || uuid;
    await call('companycontact.json', { method: 'POST', body: { uuid: randomUUID(), company_uuid: clientUuid, ...person, type: 'BILLING', is_primary_contact: '1' } });
  }

  let uuid = '';
  if (!newClient) {
    const quotes = await list('job.json', `active eq 1 and company_uuid eq '${clientUuid}' and status eq 'Quote'`).catch((): Row[] => []);
    uuid = str(quotes.find((j) => sameText(str(j.job_description), description))?.uuid);
  }
  if (!uuid) {
    const jobUuid = randomUUID();
    const made = await call('job.json', { method: 'POST', body: { uuid: jobUuid, company_uuid: clientUuid, status: 'Quote', job_description: description } });
    uuid = made.uuid || jobUuid;
    await call('jobcontact.json', { method: 'POST', body: { uuid: randomUUID(), job_uuid: uuid, ...person, type: 'JOB' } });
  }

  const back = rows((await call(`job/${uuid}.json`).catch(() => ({ data: null }))).data)[0];
  return { uuid, number: str(back?.generated_job_id) };
}

/* An email through ServiceM8's Messaging API, filed in the job's diary. Best effort: the enquiry is in ServiceM8
   either way. A reply to it comes back to the job in ServiceM8 (two-way email), unless replyTo says otherwise. */
export async function sendEmail(e: { to: string; subject: string; text: string; jobUuid: string; replyTo?: string }): Promise<boolean> {
  const root = base().replace(/\/api_1\.0$/, '');
  const go = (withReply: boolean) =>
    fetch(`${root}/platform_service_email`, {
      method: 'POST',
      headers: { 'X-API-Key': process.env.SERVICEM8_API_KEY ?? '', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: asciiJson({ to: e.to, subject: tidy(e.subject), textBody: tidy(e.text), regardingJobUUID: e.jobUuid, ...(withReply && e.replyTo ? { replyTo: e.replyTo } : {}) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  try {
    let res = await go(true);
    if (res.status === 400 && e.replyTo) res = await go(false);
    return res.ok;
  } catch {
    return false;
  }
}
