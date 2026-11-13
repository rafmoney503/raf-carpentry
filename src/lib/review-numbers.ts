import type { CurrentJob, Booking } from './servicem8';
import type { KeyNumber, ReviewApp } from './review-types';

/* The daily review's numbers (src/lib/review-writer.ts): the business's day from ServiceM8, and the few numbers per
   app shown above each part of the review. Worked out here, never by Claude. Type imports only, so the checks run it. */

/* ---------- what each source gives ---------- */

/* public.jobkit_review 'data' (scripts/review/review.sql). Loose on purpose: anything missing reads as 0. */
export type SqlDay = {
  day: string;
  rafsite: Record<string, unknown> & {
    day?: Record<string, number>;
    before?: Record<string, number>;
    goals?: Record<string, number>;
    goalsBefore?: Record<string, number>;
    sources?: { kind: string; host: string | null; visits: number }[];
    sourcesBefore?: Record<string, number>;
    blog?: { reads?: { reads: number }[]; quickOpens?: number; readsBefore?: number };
  };
  cabinetos: Record<string, unknown> & { before?: Record<string, number>; paying?: Record<string, number>; support?: unknown[] };
  b3d: Record<string, unknown> & { messages?: unknown[]; messagesBefore?: number };
  jobkit: Record<string, unknown> & { quoteMarks?: Record<string, number> };
};

/* HQ's /api/review/data: each site's day from Vercel Web Analytics, what went live, and whether it's up. */
export type HqSite = {
  key: string;
  name: string;
  status: string;
  visitors: number;
  views: number;
  before: { visitors: number; views: number; days: number } | null;
  lastWeek: number | null; // the same weekday a week before
  sources: { name: string; visitors: number }[];
  pages: { path: string; visitors: number; views: number }[];
  countries: { name: string; visitors: number }[];
  devices: { name: string; visitors: number }[];
  extras: { key: string; label: string; visitors: number; before: number | null }[];
  deploys: { at: number; message: string; state: string }[];
  up: { ok: boolean; status: number; ms: number } | null;
};
export type HqDay = { day: string; vercel: boolean; sites: HqSite[] };

/* ---------- the business's day ---------- */

export type BizSource = 'website' | 'email' | 'whatsapp' | 'servicem8';
export type BizDay = {
  enquiries: { what: string; area: string; source: BizSource }[];
  enquiriesBefore: number;
  quotesSent: number;
  quotesSentBefore: number;
  won: { what: string; area: string; total: number | null }[];
  wonBefore: number;
  completed: number;
  completedBefore: number;
  lost: number;
  lostBefore: number;
  paid: number; // £ paid that day
  payments: number;
  paidBefore: number;
  visits: number; // site visits booked that day (on Quote jobs)
  workDays: number; // jobs worked on that day (bookings on Work Order jobs)
  open: { toQuote: number; waiting: number; waitingLong: number; workOrders: number; toCollect: number };
};

const dayOf = (s: string | null | undefined) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '');
const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
/* A ms time's London day. */
const londonOf = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/London' });

export function sourceOfJob(d: string): BizSource {
  if (/made by the job kit assistant|from an email to info@/i.test(d)) return 'email';
  if (/from a whatsapp chat/i.test(d)) return 'whatsapp';
  if (/sent with send to raf|from the website brief|from the cost calculator|from the wardrobe planner|here is my brief from your website/i.test(d)) return 'website';
  return 'servicem8';
}

/* The job's first useful line ("Fitted wardrobe in a bedroom alcove"), at most 60 characters. */
export function whatOfJob(d: string): string {
  const lines = d.split('\n').map((l) => l.trim()).filter((l) => l && !/^(hi|hello|dear)\b/i.test(l));
  const what = lines.find((l) => /^what\s*:/i.test(l))?.replace(/^what\s*:\s*/i, '');
  const line = (what ?? lines[0] ?? '').split(/\.\s/)[0].replace(/\.$/, '');
  const short = (line.length > 60 ? line.slice(0, 60).replace(/\s+\S*$/, '') : line).replace(/[\s,;:]+$/, '');
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/* Yesterday in ServiceM8 (`day`), and the 7 days before it. `marks` are the Job Kit's own "I've sent the quote" times
   (job uuid -> ms), for quotes sent on WhatsApp that ServiceM8 doesn't know about. */
export function businessDay(jobs: CurrentJob[], bookings: Booking[] | null, marks: Record<string, number>, day: string): BizDay {
  const from = addDays(day, -7);
  const inDay = (d: string) => d === day;
  const inBefore = (d: string) => d >= from && d < day;
  const sentDay = (j: CurrentJob) => dayOf(j.quoteSent) || (Number.isFinite(marks[j.uuid]) ? londonOf(marks[j.uuid]) : '');
  const created = (j: CurrentJob) => dayOf(j.created);
  const count = (pick: (j: CurrentJob) => string, when: (d: string) => boolean) => jobs.filter((j) => when(pick(j))).length;

  let paid = 0;
  let payments = 0;
  let paidBefore = 0;
  for (const j of jobs) {
    for (const p of j.payments ?? []) {
      const d = dayOf(p.date);
      if (inDay(d)) {
        paid += p.amount || 0;
        payments++;
      } else if (inBefore(d)) paidBefore += p.amount || 0;
    }
  }

  const status = new Map(jobs.map((j) => [j.uuid, j.status]));
  let visits = 0;
  let workDays = 0;
  for (const b of bookings ?? []) {
    const s = dayOf(b.start);
    const e = dayOf(b.end) || s;
    if (!s || s > day || e < day) continue;
    if (status.get(b.jobUuid) === 'Quote') visits++;
    else if (status.get(b.jobUuid) === 'Work Order' || status.get(b.jobUuid) === 'Completed') workDays++;
  }

  const left = (j: CurrentJob) => {
    if (j.paid || j.total === null) return 0;
    const got = (j.payments ?? []).reduce((a, p) => a + (p.amount || 0), 0);
    return Math.max(0, j.total - got);
  };
  const now = Date.parse(`${addDays(day, 1)}T00:00:00Z`);
  const quotes = jobs.filter((j) => j.status === 'Quote');
  const waitingList = quotes.filter((j) => sentDay(j));
  return {
    enquiries: jobs.filter((j) => inDay(created(j))).map((j) => ({ what: whatOfJob(j.description), area: j.area, source: sourceOfJob(j.description) })),
    enquiriesBefore: count(created, inBefore),
    quotesSent: count(sentDay, inDay),
    quotesSentBefore: count(sentDay, inBefore),
    won: jobs.filter((j) => inDay(dayOf(j.workOrder))).map((j) => ({ what: whatOfJob(j.description), area: j.area, total: j.total })),
    wonBefore: count((j) => dayOf(j.workOrder), inBefore),
    completed: count((j) => dayOf(j.completed), inDay),
    completedBefore: count((j) => dayOf(j.completed), inBefore),
    lost: count((j) => dayOf(j.lost), inDay),
    lostBefore: count((j) => dayOf(j.lost), inBefore),
    paid: Math.round(paid * 100) / 100,
    payments,
    paidBefore: Math.round(paidBefore * 100) / 100,
    visits,
    workDays,
    open: {
      toQuote: quotes.filter((j) => !sentDay(j) && created(j) && created(j) < day).length,
      waiting: waitingList.length,
      waitingLong: waitingList.filter((j) => now - Date.parse(`${sentDay(j)}T00:00:00Z`) > 5 * 864e5).length,
      workOrders: jobs.filter((j) => j.status === 'Work Order').length,
      toCollect: Math.round(jobs.filter((j) => j.status === 'Work Order' || j.status === 'Completed').reduce((a, j) => a + left(j), 0)),
    },
  };
}

/* ---------- the numbers above each part ---------- */

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const avg = (total: unknown, days: unknown) => (n(days) > 0 ? n(total) / n(days) : null);
const sumOf = (o: Record<string, number> | undefined, keys?: string[]) => Object.entries(o ?? {}).filter(([k]) => !keys || keys.includes(k)).reduce((a, [, v]) => a + n(v), 0);
const TOUCH = ['quote', 'send', 'whatsapp', 'call', 'email'];

export function keyNumbers(sql: SqlDay | null, hq: HqDay | null, biz: BizDay | null): Partial<Record<ReviewApp, KeyNumber[]>> {
  const out: Partial<Record<ReviewApp, KeyNumber[]>> = {};
  const site = (k: string) => hq?.sites.find((s) => s.key === k && s.status === 'ok');

  if (sql?.rafsite?.day) {
    const r = sql.rafsite;
    const d = r.day ?? {};
    const b = r.before ?? {};
    const days = n(b.days) || 7;
    const visits = n(d.visits);
    const chat = (r.sources ?? []).filter((s) => s.kind === 'chatgpt').reduce((a, s) => a + n(s.visits), 0);
    const blog = (r.blog?.reads ?? []).reduce((a, x) => a + n(x.reads), 0);
    out.rafcarpentry = [
      { label: 'Visitors', value: n(d.visitors), before: avg(b.visitors, days) },
      { label: 'Taps to get in touch', value: sumOf(r.goals, TOUCH), before: sumOf(r.goalsBefore, TOUCH) / days },
      { label: 'Briefs sent', value: n(r.goals?.send), before: n(r.goalsBefore?.send) / days },
      { label: 'Left after one page', value: visits ? Math.round((n(d.onePage) / visits) * 100) : 0, before: n(b.visits) ? Math.round((n(b.onePage) / n(b.visits)) * 100) : null, unit: '%' },
      { label: 'From ChatGPT', value: chat, before: n(r.sourcesBefore?.chatgpt) / days },
      { label: 'Blog reads', value: blog, before: n(r.blog?.readsBefore) / days },
    ];
  }

  if (biz) {
    out.business = [
      { label: 'New enquiries', value: biz.enquiries.length, before: biz.enquiriesBefore / 7 },
      { label: 'Quotes sent', value: biz.quotesSent, before: biz.quotesSentBefore / 7 },
      { label: 'Jobs won', value: biz.won.length, before: biz.wonBefore / 7 },
      { label: 'Money in', value: Math.round(biz.paid), before: Math.round(biz.paidBefore / 7), unit: '£' },
      { label: 'Quotes waiting', value: biz.open.waiting, before: null },
      { label: 'To collect', value: biz.open.toCollect, before: null, unit: '£' },
    ];
  }

  if (sql?.cabinetos) {
    const c = sql.cabinetos;
    const b = c.before ?? {};
    const days = n(b.days) || 7;
    out.cabinetos = [
      { label: 'Visitors', value: n(c.visitors), before: avg(b.visitors, days) },
      { label: 'Sign-ups', value: n(c.signups), before: n(b.signups) / 7 },
      { label: 'Using the app', value: n(c.signedIn), before: avg(b.signedIn, days) },
      { label: 'New projects', value: n(c.projectsNew), before: n(b.projectsNew) / 7 },
      { label: 'Paying accounts', value: sumOf(c.paying), before: null },
      { label: 'Support messages', value: Array.isArray(c.support) ? c.support.length : 0, before: null },
    ];
  }

  const b3 = site('builditin3d');
  if (b3 || sql?.b3d) {
    const ex = (k: string) => b3?.extras.find((x) => x.key === k);
    const lesson = ex('lesson');
    const games = ex('games');
    out.builditin3d = [
      ...(b3 ? [{ label: 'Visitors', value: b3.visitors, before: b3.before ? avg(b3.before.visitors, b3.before.days) : null }] : []),
      ...(lesson ? [{ label: 'Opened a lesson', value: lesson.visitors, before: lesson.before }] : []),
      ...(games ? [{ label: 'Played a game', value: games.visitors, before: games.before }] : []),
      { label: 'Tell us messages', value: Array.isArray(sql?.b3d?.messages) ? sql!.b3d.messages!.length : 0, before: n(sql?.b3d?.messagesBefore) / 7 },
    ];
  }

  for (const k of ['rafalsolutions', 'builtforyou'] as const) {
    const s = site(k);
    if (s) {
      out[k] = [
        { label: 'Visitors', value: s.visitors, before: s.before ? avg(s.before.visitors, s.before.days) : null },
        { label: 'Page views', value: s.views, before: s.before ? avg(s.before.views, s.before.days) : null },
      ];
    }
  }
  return out;
}

/* What went live on each app that day (HQ's deploy list), newest last. The Job Kit is part of rafcarpentry.com. */
export function liveOf(hq: HqDay | null): Partial<Record<ReviewApp, string[]>> {
  const out: Partial<Record<ReviewApp, string[]>> = {};
  for (const s of hq?.sites ?? []) {
    const k = s.key as ReviewApp;
    const list = s.deploys.filter((d) => d.state === 'READY' && d.message).map((d) => d.message.split('\n')[0].slice(0, 140));
    if (list.length) out[k] = [...new Set(list)].slice(0, 10);
  }
  return out;
}
