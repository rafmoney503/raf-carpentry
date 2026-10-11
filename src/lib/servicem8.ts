import { randomUUID } from 'crypto';

/* ServiceM8 for the Job Kit's "Current jobs". Raf's customers, enquiries, job statuses and invoices live in
   ServiceM8; the Job Kit reads them and writes back through /api/job-kit/sm8 (behind the PIN) with the
   account's API key (Vercel env SERVICEM8_API_KEY, full access; needs the Starter plan or above).
   Customer details only travel phone <-> this server <-> ServiceM8: never to the inbox, the website pages or
   the repo. Nothing here deletes anything in ServiceM8. API: https://api.servicem8.com/api_1.0, X-API-Key
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
  paid: boolean;
};

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

async function call(path: string, opts: { method?: 'GET' | 'POST'; query?: Record<string, string>; body?: Row } = {}) {
  const url = new URL(`${base()}/${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'X-API-Key': process.env.SERVICEM8_API_KEY ?? '',
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
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

function shape(j: Row, client?: Row, contact?: Row): CurrentJob {
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
  };
}

/* Open quotes, work orders, and the jobs finished or marked unsuccessful in the last 30 days, newest first,
   with the client and the best contact (the job's own contact, else the client's). Seven requests in two rounds. */
export async function currentJobs(): Promise<CurrentJob[]> {
  const [quotes, orders, done, lost] = await Promise.all(['Quote', 'Work Order', 'Completed', 'Unsuccessful'].map((s) => list('job.json', `active eq 1 and status eq '${s}'`)));
  const cutoff = Date.now() - 30 * 864e5;
  const since = (field: string) => (j: Row) => {
    const t = Date.parse(when(j[field]) ?? when(j.edit_date) ?? '');
    return Number.isFinite(t) && t >= cutoff;
  };
  const jobs = [...quotes, ...orders, ...done.filter(since('completion_date')), ...lost.filter(since('unsuccessful_date'))].filter((j) => str(j.uuid) && str(j.active) !== '0');
  if (!jobs.length) return [];
  const [clients, jobContacts, clientContacts] = await Promise.all([
    list('company.json', 'active eq 1'),
    list('jobcontact.json', 'active eq 1'),
    list('companycontact.json', 'active eq 1'),
  ]);
  const clientBy = new Map(clients.map((c) => [str(c.uuid), c]));
  const useful = (c: Row) => str(c.mobile) || str(c.phone) || str(c.email) || str(c.first);
  const rank = (c: Row) => (/^(job|job contact)$/i.test(str(c.type)) ? 0 : /billing/i.test(str(c.type)) ? 1 : 2) - (on(c.is_primary_contact) ? 0.5 : 0);
  const best = (cs: Row[]) => cs.filter(useful).sort((a, b) => rank(a) - rank(b))[0];
  const byJob = new Map<string, Row[]>();
  for (const c of jobContacts) byJob.set(str(c.job_uuid), [...(byJob.get(str(c.job_uuid)) ?? []), c]);
  const byClient = new Map<string, Row[]>();
  for (const c of clientContacts) byClient.set(str(c.company_uuid), [...(byClient.get(str(c.company_uuid)) ?? []), c]);
  const out = jobs.map((j) => shape(j, clientBy.get(str(j.company_uuid)), best(byJob.get(str(j.uuid)) ?? []) ?? best(byClient.get(str(j.company_uuid)) ?? [])));
  return out.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''));
}

/* A new enquiry typed into the Job Kit: the client (reused when the name matches one already in ServiceM8),
   its billing contact, a Quote job with the address and what they want, and the job's own contact. */
export async function createEnquiry(e: { name: string; mobile: string; email: string; address: string; description: string }): Promise<CurrentJob> {
  const name = e.name.trim();
  const [first, ...rest] = name.split(/\s+/);
  const last = rest.join(' ');
  const person = { first, last, mobile: e.mobile.trim() || undefined, email: e.email.trim() || undefined };

  const same = (await list('company.json', `active eq 1 and name eq '${odata(name)}'`)).find((c) => str(c.name).toLowerCase() === name.toLowerCase());
  let clientUuid = str(same?.uuid);
  if (!clientUuid) {
    const uuid = randomUUID();
    const made = await call('company.json', { method: 'POST', body: { uuid, name, address: e.address.trim() || undefined } });
    clientUuid = made.uuid || uuid;
    await call('companycontact.json', { method: 'POST', body: { uuid: randomUUID(), company_uuid: clientUuid, ...person, type: 'BILLING', is_primary_contact: '1' } });
  }

  const jobUuid = randomUUID();
  const made = await call('job.json', {
    method: 'POST',
    body: { uuid: jobUuid, company_uuid: clientUuid, status: 'Quote', job_address: e.address.trim() || undefined, job_description: e.description.trim() },
  });
  const uuid = made.uuid || jobUuid;
  await call('jobcontact.json', { method: 'POST', body: { uuid: randomUUID(), job_uuid: uuid, ...person, type: 'JOB' } });

  // Read it back for the job number ServiceM8 gives it; if that fails, what we sent is enough.
  const back = rows((await call(`job/${uuid}.json`).catch(() => ({ data: null }))).data)[0];
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/London' }).replace(' ', 'T').slice(0, 16);
  return shape(back ?? { uuid, status: 'Quote', job_address: e.address, job_description: e.description, date: now }, { name }, { ...person, type: 'JOB' });
}

export async function setStatus(uuid: string, status: Status) {
  await call(`job/${uuid}.json`, { method: 'POST', body: { status } });
}
