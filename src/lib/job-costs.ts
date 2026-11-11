import type { Booking, CurrentJob } from './servicem8';

/* What each job made (Raf, 11 Nov 2026: 'Yes' to the mockup on the 'Job Kit, what each job made' design canvas, then
   'Go'). The price comes from ServiceM8 (the job's total, which includes VAT), the costs from the receipts and costs
   Raf puts on the job in the Job Kit, the days from the work bookings in his Diary; what's left over a day on site
   is the figure to compare with his day rate. Types and sums only (type imports), so the phone, the computer and
   the tests read the same.

   Kept in step between the phone and the computer (src/app/job-kit/costs-store.ts, Supabase jobkit.costs), one doc
   per id:
     k<...>       a cost: a receipt (photo, PDF or a supplier's email read by Claude) or one typed (parking, helper)
     j-<job uuid> Raf's own words on one job: days on site if the Diary has them wrong, 'that's all the costs'
     s-<job uuid> a finished job as ServiceM8 last sent it, so it stays counted after ServiceM8's 30 days
     m-<hash>     an email in info@ that looked like a receipt and isn't one (or was put on a job by hand) */

export const VAT_RATE = 0.2;
export const HALF_DAY_HOURS = 5; // a day booked for less than this counts as half a day

export type CostKind = 'materials' | 'hardware' | 'parking' | 'helper' | 'tools' | 'other';
export const COST_KINDS: { id: CostKind; label: string }[] = [
  { id: 'materials', label: 'Materials' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'parking', label: 'Parking' },
  { id: 'helper', label: 'Helper' },
  { id: 'tools', label: 'Tools' },
  { id: 'other', label: 'Other' },
];
export const kindLabel = (k: CostKind) => COST_KINDS.find((x) => x.id === k)?.label ?? 'Other';

/* job: on one or more jobs (each share before VAT); van: screws and glue used on every job; company: tools and
   anything else that lasts (kept for the accountant, never on a job). */
export type CostWhere = 'job' | 'van' | 'company';
export type CostLine = { text: string; amount: number }; // as printed (with VAT on most receipts)
export type Share = { job: string; amount: number }; // before VAT
export type Cost = {
  kind: 'cost';
  date: string; // YYYY-MM-DD on the receipt (or the day it was typed)
  shop: string; // 'Screwfix, East Finchley', 'Parking', 'Kamil'
  what: CostKind;
  gross: number; // paid
  vat: number; // VAT on it (0 when none is shown)
  net: number; // gross - vat
  lines?: CostLine[];
  note?: string; // 'MDF, 11 sheets cut to size'
  where: CostWhere;
  jobs: Share[]; // where 'job': one or more; they add up to net
  from: 'photo' | 'pdf' | 'email' | 'typed';
  mail?: string; // the Outlook email it came from
  mailAtt?: string; // the email's PDF or photo that is the receipt, to go on the job
  client?: string; // the first job's customer in ServiceM8, to find an old job again
  photo?: { job: string; uuid: string }; // the photo or PDF on that ServiceM8 job
  photoWaiting?: boolean; // still on the device that took it, to go on the job when there's signal
  read?: { model: string; sure: boolean };
  made: number; // when it was put in
};
export type JobSet = { kind: 'set'; job: string; days?: number | null; allCosts?: boolean; checkedAt?: number };
export type Snap = {
  kind: 'snap';
  job: string;
  number: string;
  client?: string; // the customer's uuid in ServiceM8
  name: string;
  first: string;
  what: string;
  area: string;
  description: string; // the first 300 characters, to tell the kind of work
  completed: string; // YYYY-MM-DD
  gross: number | null; // ServiceM8's total, with VAT
  paid: number;
  days: number; // from the bookings, as last seen
  firstDay: string | null;
  lastDay: string | null;
  at: number;
};
export type Skip = { kind: 'skip'; mail: string };
export type CostData = Cost | JobSet | Snap | Skip;

/* ---------- money ---------- */

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const pounds = (n: number, pence = false) => {
  const neg = n < 0;
  const a = Math.abs(n);
  const s = pence ? a.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(a).toLocaleString('en-GB');
  return `${neg ? '−' : ''}£${s}`;
};
/* A typed amount: '£1,350', '58.2', '36' (pounds). NaN when it isn't one. */
export function readAmount(s: string): number {
  const t = s.replace(/[£,\s]/g, '').replace(/^gbp/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return round2(Number(t));
}

/* The job's price before VAT: ServiceM8's total (the invoice, or the quote before it), else what's been paid. */
export function priceOf(j: Pick<CurrentJob, 'total' | 'payments' | 'paid'>): { gross: number; net: number; from: 'total' | 'paid' } | null {
  if (j.total && j.total > 0) return { gross: j.total, net: round2(j.total / (1 + VAT_RATE)), from: 'total' };
  const paid = (j.payments ?? []).reduce((a, p) => a + (p.amount || 0), 0);
  if (paid > 0) return { gross: paid, net: round2(paid / (1 + VAT_RATE)), from: 'paid' };
  return null;
}

/* ---------- days on site, from the work bookings ---------- */

const DAY = 864e5;
const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const isSunday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay() === 0;
const mins = (t: string) => Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
const endOf = (b: Booking) => (b.end && b.end > b.start ? b.end : `${b.start.slice(0, 11)}${String(Math.min(23, Number(b.start.slice(11, 13)) + 1)).padStart(2, '0')}${b.start.slice(13, 16)}`);

/* The bookings that are the work: from the day it went to Work Order (earlier ones are the quote visit), up to the
   day it was completed. */
export function workBookingsOf(j: Pick<CurrentJob, 'uuid' | 'workOrder' | 'completed' | 'status'>, bookings: Booking[]) {
  const from = j.workOrder?.slice(0, 10);
  const to = j.status === 'Completed' ? j.completed?.slice(0, 10) : undefined;
  return bookings.filter((b) => b.jobUuid === j.uuid && (!from || b.start.slice(0, 10) >= from) && (!to || b.start.slice(0, 10) <= to)).sort((a, b) => a.start.localeCompare(b.start));
}

export type SiteDay = { day: string; hours: number; value: 0.5 | 1 };
/* Each day booked with its hours: a booking within one day by its times; one over several days counts 8 to 4 on
   the days between, and from its start or to its end on the first and last. 5 hours or more is a day, less is half
   a day. Sundays don't count unless that's all there is. */
export function siteDays(list: Booking[]): SiteDay[] {
  const hours = new Map<string, number>();
  const add = (k: string, h: number) => hours.set(k, (hours.get(k) ?? 0) + Math.max(0, h));
  for (const b of list) {
    const end = endOf(b);
    const first = b.start.slice(0, 10);
    let last = end.slice(0, 10);
    if (end.slice(11, 16) === '00:00' && last > first) last = addDays(last, -1);
    if (first === last) {
      add(first, ((end.slice(0, 10) > first ? 24 * 60 : mins(end)) - mins(b.start)) / 60);
      continue;
    }
    let n = 0;
    for (let k = first; k <= last && n < 120; k = addDays(k, 1), n++) {
      if (k === first) add(k, Math.max(1, (16 * 60 - mins(b.start)) / 60));
      else if (k === last) add(k, end.slice(11, 16) === '00:00' ? 8 : Math.max(1, (mins(end) - 8 * 60) / 60));
      else add(k, 8);
    }
  }
  const all = [...hours.entries()].filter(([, h]) => h > 0).sort(([a], [b]) => a.localeCompare(b));
  const work = all.filter(([k]) => !isSunday(k));
  return (work.length ? work : all).map(([day, h]) => ({ day, hours: Math.round(h * 10) / 10, value: h >= HALF_DAY_HOURS ? 1 : 0.5 }));
}
export const daysTotal = (d: SiteDay[]) => d.reduce((a, x) => a + x.value, 0);

/* ---------- the kind of work, from what the job is ---------- */

export type WorkKind = { id: string; label: string; short: string; one: string }; // one: 'wardrobe job', for a sentence
const KINDS: { id: string; label: string; short: string; one: string; words: RegExp }[] = [
  { id: 'pax', label: 'IKEA PAX built in', short: 'IKEA PAX', one: 'IKEA PAX job', words: /\bpax\b|ikea/i },
  { id: 'wardrobe', label: 'Fitted wardrobes', short: 'Wardrobes', one: 'wardrobe job', words: /wardrobe/i },
  { id: 'kitchen', label: 'Kitchen fitting', short: 'Kitchens', one: 'kitchen job', words: /kitchen|worktop/i },
  { id: 'alcove', label: 'Alcove units and bookcases', short: 'Alcoves', one: 'alcove job', words: /alcove|bookcase|book ?shel|chimney/i },
  { id: 'panelling', label: 'Wall panelling', short: 'Panelling', one: 'panelling job', words: /panell?ing|wainscot|batten grid|picture frame/i },
  { id: 'doors', label: 'Door fitting', short: 'Doors', one: 'door fitting', words: /\bdoors?\b|architrave/i },
  { id: 'flooring', label: 'Flooring', short: 'Flooring', one: 'flooring job', words: /floor|laminate|skirting/i },
  { id: 'seat', label: 'Window seats and benches', short: 'Seats', one: 'seat job', words: /seat|bench/i },
  { id: 'desk', label: 'Desks and home offices', short: 'Desks', one: 'desk job', words: /desk|office/i },
  { id: 'storage', label: 'Cupboards and storage', short: 'Cupboards', one: 'cupboard job', words: /cupboard|storage|shelv|shelf|pantry|loft|under ?stairs|vanity|tv unit|media wall/i },
  { id: 'outdoor', label: 'Decking and fences', short: 'Outdoor', one: 'outdoor job', words: /deck|fence|gate|pergola|shed/i },
  { id: 'walls', label: 'Stud walls', short: 'Stud walls', one: 'stud wall job', words: /stud wall|partition/i },
];
export const OTHER_KIND: WorkKind = { id: 'other', label: 'Other jobs', short: 'Other', one: 'job' };
export function kindOfWork(text: string): WorkKind {
  const t = text.slice(0, 400);
  const k = KINDS.find((x) => x.words.test(t));
  return k ? { id: k.id, label: k.label, short: k.short, one: k.one } : OTHER_KIND;
}

/* ---------- costs on a job ---------- */

export type CostEntry = { id: string; at: number; data: Cost };
export const isCost = (d: unknown): d is Cost => Boolean(d) && (d as Cost).kind === 'cost';

/* This job's share of each cost, before VAT, with its VAT in proportion. */
export function costsOn(job: string, costs: CostEntry[]) {
  const out: { entry: CostEntry; net: number; vat: number }[] = [];
  for (const e of costs) {
    const c = e.data;
    if (c.where !== 'job') continue;
    const s = c.jobs.find((x) => x.job === job);
    if (!s) continue;
    const part = c.net > 0 ? s.amount / c.net : c.jobs.length ? 1 / c.jobs.length : 0;
    out.push({ entry: e, net: round2(s.amount), vat: round2(c.vat * part) });
  }
  return out.sort((a, b) => a.entry.data.date.localeCompare(b.entry.data.date) || a.entry.data.made - b.entry.data.made);
}

/* Split a cost's amount between jobs: even shares, the odd pence on the first. */
export function evenShares(net: number, jobs: string[]): Share[] {
  if (!jobs.length) return [];
  const p = Math.round(net * 100);
  const each = Math.floor(p / jobs.length);
  return jobs.map((job, i) => ({ job, amount: (each + (i === 0 ? p - each * jobs.length : 0)) / 100 }));
}

/* The money of one job: price, costs, days, and what that comes to a day. */
export type Made = {
  price: number | null; // before VAT
  costs: number; // before VAT
  vat: number; // VAT on its receipts, to claim back
  days: number;
  daysFrom: 'diary' | 'raf' | 'none';
  perDay: number | null;
  vsRate: number | null; // perDay - rate
  noCosts: boolean; // nothing on it yet, and Raf hasn't said that's all
  count: number;
};
export function madeOf(price: number | null, costs: { net: number; vat: number }[], diaryDays: number, set: JobSet | undefined, rate: number): Made {
  const total = round2(costs.reduce((a, c) => a + c.net, 0));
  const vat = round2(costs.reduce((a, c) => a + c.vat, 0));
  const raf = typeof set?.days === 'number' && set.days > 0 ? set.days : null;
  const days = raf ?? diaryDays;
  const perDay = price !== null && days > 0 ? (price - total) / days : null;
  return {
    price,
    costs: total,
    vat,
    days,
    daysFrom: raf ? 'raf' : diaryDays > 0 ? 'diary' : 'none',
    perDay,
    vsRate: perDay === null ? null : perDay - rate,
    noCosts: !costs.length && !set?.allCosts,
    count: costs.length,
  };
}
/* '£46 a day over your £650 rate', 'Right on your £650 rate', '£29 a day under ...'. */
export function vsWords(vs: number | null, rate: number) {
  if (vs === null) return '';
  const r = Math.round(vs);
  if (Math.abs(r) < 5) return `Right on your ${pounds(rate)} rate`;
  return `${pounds(Math.abs(r))} a day ${r > 0 ? 'over' : 'under'} your ${pounds(rate)} rate`;
}

/* ---------- finished jobs, kept and counted ---------- */

export function snapOf(j: CurrentJob, days: SiteDay[], what: string): Snap {
  const paid = (j.payments ?? []).reduce((a, p) => a + (p.amount || 0), 0);
  return {
    kind: 'snap',
    job: j.uuid,
    client: j.client,
    number: j.number,
    name: j.name,
    first: j.first,
    what,
    area: j.area,
    description: j.description.slice(0, 300),
    completed: (j.completed ?? '').slice(0, 10),
    gross: j.total,
    paid: round2(paid),
    days: daysTotal(days),
    firstDay: days[0]?.day ?? null,
    lastDay: days[days.length - 1]?.day ?? null,
    at: 0,
  };
}
/* The same snapshot again (nothing to send) unless something in it changed. */
export const sameSnap = (a: Snap | undefined, b: Snap) =>
  Boolean(a) && a!.number === b.number && a!.name === b.name && a!.what === b.what && a!.area === b.area && a!.completed === b.completed && a!.gross === b.gross && a!.paid === b.paid && a!.days === b.days && a!.firstDay === b.firstDay && a!.lastDay === b.lastDay;

export type JobRow = { snap: Snap; kind: WorkKind; made: Made; costs: { entry: CostEntry; net: number; vat: number }[] };
export function jobRow(snap: Snap, costs: CostEntry[], set: JobSet | undefined, rate: number): JobRow {
  const price = snap.gross && snap.gross > 0 ? round2(snap.gross / (1 + VAT_RATE)) : snap.paid > 0 ? round2(snap.paid / (1 + VAT_RATE)) : null;
  const on = costsOn(snap.job, costs);
  return { snap, kind: kindOfWork(`${snap.what} ${snap.description}`), made: madeOf(price, on, snap.days, set, rate), costs: on };
}

export type Period = '30' | '90' | 'year';
export const PERIODS: { id: Period; label: string; words: string }[] = [
  { id: '30', label: '30 days', words: 'last 30 days' },
  { id: '90', label: '90 days', words: 'last 90 days' },
  { id: 'year', label: 'This year', words: 'this year' },
];
export function sinceOf(p: Period, today: string) {
  return p === 'year' ? `${today.slice(0, 4)}-01-01` : addDays(today, -(p === '30' ? 30 : 90));
}
export const inPeriod = (rows: JobRow[], p: Period, today: string) => {
  const since = sinceOf(p, today);
  return rows.filter((r) => r.snap.completed >= since).sort((a, b) => b.snap.completed.localeCompare(a.snap.completed) || b.snap.number.localeCompare(a.snap.number));
};

/* The jobs that count in a total: a price and days on site. */
export const counted = (rows: JobRow[]) => rows.filter((r) => r.made.price !== null && r.made.days > 0);
export type Totals = { jobs: number; price: number; costs: number; days: number; perDay: number | null; noCosts: number; left: number };
export function totalsOf(rows: JobRow[]): Totals {
  const c = counted(rows);
  const price = c.reduce((a, r) => a + (r.made.price ?? 0), 0);
  const costs = c.reduce((a, r) => a + r.made.costs, 0);
  const days = c.reduce((a, r) => a + r.made.days, 0);
  return { jobs: c.length, price: round2(price), costs: round2(costs), days, perDay: days > 0 ? (price - costs) / days : null, noCosts: c.filter((r) => r.made.noCosts).length, left: rows.length - c.length };
}

export type KindRow = { kind: WorkKind; jobs: number; days: number; perDay: number };
export function byKind(rows: JobRow[]): KindRow[] {
  const m = new Map<string, { kind: WorkKind; jobs: number; days: number; left: number }>();
  for (const r of counted(rows)) {
    const k = m.get(r.kind.id) ?? { kind: r.kind, jobs: 0, days: 0, left: 0 };
    k.jobs += 1;
    k.days += r.made.days;
    k.left += (r.made.price ?? 0) - r.made.costs;
    m.set(r.kind.id, k);
  }
  return [...m.values()].map((k) => ({ kind: k.kind, jobs: k.jobs, days: k.days, perDay: k.left / k.days })).sort((a, b) => b.perDay - a.perDay);
}

const daysWord = (d: number) => `${d % 1 ? d.toFixed(1) : d} day${d === 1 ? '' : 's'}`;
export const daysText = daysWord;
const possessive = (name: string) => `${name}’s`;

/* A few plain lines on what the numbers say, most useful first. */
export function insights(rows: JobRow[], rate: number, away: { van: number; company: number }): string[] {
  const out: string[] = [];
  const c = counted(rows);
  const kinds = byKind(rows);
  if (kinds.length >= 2) {
    const best = kinds[0];
    out.push(`${best.kind.short} pay best: ${pounds(best.perDay)} a day across ${best.jobs} job${best.jobs === 1 ? '' : 's'}.`);
  }
  const low = c.filter((r) => r.made.perDay !== null && r.made.perDay < rate * 0.8).sort((a, b) => (a.made.perDay ?? 0) - (b.made.perDay ?? 0))[0];
  if (low) {
    const priced = low.made.price ?? 0;
    const atRate = low.made.days * rate + low.made.costs;
    out.push(`${possessive(low.snap.name)} ${low.kind.one} made ${pounds(low.made.perDay ?? 0)} a day. At your rate, ${daysWord(low.made.days)} and its costs come to ${pounds(atRate)}; it was priced ${pounds(priced)} before VAT.`);
  }
  const helpers = c.flatMap((r) => r.costs.filter((x) => x.entry.data.what === 'helper'));
  if (helpers.length) {
    const jobs = new Set(helpers.map((h) => h.entry.data.jobs.map((j) => j.job)).flat()).size;
    out.push(`Helpers cost ${pounds(helpers.reduce((a, h) => a + h.net, 0))} on ${jobs} job${jobs === 1 ? '' : 's'}.`);
  }
  const empty = c.filter((r) => r.made.noCosts).length;
  if (empty) out.push(`${empty === 1 ? '1 job has' : `${empty} jobs have`} no costs on ${empty === 1 ? 'it' : 'them'} yet, so ${empty === 1 ? 'it looks' : 'they look'} better than ${empty === 1 ? 'it was' : 'they were'}.`);
  if (away.van > 0 || away.company > 0) {
    const bits = [away.van > 0 ? `van stock ${pounds(away.van)}` : '', away.company > 0 ? `tools and company costs ${pounds(away.company)}` : ''].filter(Boolean);
    out.push(`On no job in these days: ${bits.join(' and ')}.`);
  }
  return out.slice(0, 4);
}

/* Van stock and company costs in a period, before VAT. */
export function awayFromJobs(costs: CostEntry[], since: string) {
  let van = 0;
  let company = 0;
  for (const e of costs) {
    if (e.data.date < since) continue;
    if (e.data.where === 'van') van += e.data.net;
    else if (e.data.where === 'company') company += e.data.net;
  }
  return { van: round2(van), company: round2(company) };
}

/* ---------- emails that look like receipts ---------- */

const SUPPLIERS = /screwfix|toolstation|wickes|diy\.com|b-and-q|\bb ?& ?q\b|travis ?perkins|jewson|selco|cworkshop|ikea|amazon|howdens|\bmkm\b|buildbase|topps ?tiles|ironmongery ?direct|hafele|häfele|blum|tradepoint|homebase|toppstiles|wood ?finishes|plumbase|city ?plumbing|timber|builders? ?merchant|edging|cutting list|sheet materials/i;
const WORDS = /receipt|invoice|order (confirm|confirmation|number|no\.?)|your order|order #|order:|purchase|payment received|e-?receipt|dispatch|collect(ion)? ready|ready (to|for) collect/i;
const NOT = /newsletter|offer|% off|sale ends|unsubscribe now|weekly deals|review your|rate your|survey/i;
export function receiptLike(m: { from: { name?: string; email?: string }; subject: string; preview?: string; mine?: boolean }) {
  if (m.mine) return false;
  const who = `${m.from.name ?? ''} ${m.from.email ?? ''}`;
  const text = `${m.subject} ${m.preview ?? ''}`;
  if (NOT.test(m.subject)) return false;
  return (SUPPLIERS.test(who) || SUPPLIERS.test(m.subject)) && WORDS.test(text);
}
/* A short id for an email (Outlook's ids are long and full of + / =). */
export function mailKey(id: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `m-${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}
