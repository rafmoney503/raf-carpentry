import type { Booking, CurrentJob } from './servicem8';
import { daysBetween, nearDay, rowOf, rowWords, shortDay, todayKey } from './job-timeline';

/* The Clients board in the Job Kit's Job timeline section (22 Oct 2026, Raf: 'in section timeline i'd like to have a
   separate summary for current clients showing name, job required, status - new enquiry, quote, quote send, in
   progress (accepted quote no payment yet) work order, deposit paid, remaining amount, completed (where we can close
   the client off the board)'). Every client with a job in ServiceM8, in the step it has reached, worked out from
   ServiceM8 (status, bookings, total, payments) and the Job Kit's own marks (a quote sent by WhatsApp, a visit done,
   a finished job closed off). Nothing here changes ServiceM8: closing a client is the same mark as Current jobs'
   'Done with it: hide from the list'. Types only from servicem8, so this runs anywhere (tests with node). */

export type BoardStage = 'enquiry' | 'quote' | 'sent' | 'accepted' | 'deposit' | 'completed';

export const BOARD_STAGES: { id: BoardStage; name: string; short: string; what: string }[] = [
  { id: 'enquiry', name: 'New enquiry', short: 'new', what: 'Nothing booked or sent yet' },
  { id: 'quote', name: 'Quote', short: 'quoting', what: 'Visit booked or done, quote to send' },
  { id: 'sent', name: 'Quote sent', short: 'sent', what: 'Waiting for their yes' },
  { id: 'accepted', name: 'Accepted', short: 'accepted', what: 'Work Order, nothing paid yet' },
  { id: 'deposit', name: 'Deposit paid', short: 'deposit paid', what: 'Work Order, the rest still to come' },
  { id: 'completed', name: 'Completed', short: 'completed', what: 'Finished: close them off when done' },
];
export const stageIndex = (s: BoardStage) => BOARD_STAGES.findIndex((x) => x.id === s);

type MarkLike = { quoteSentAt?: number; hidden?: boolean; visitsDone?: string[]; progress?: number; progressAt?: number };
export type BoardMarks = Record<string, MarkLike>;

export const FOLLOW_UP_DAYS = 5; // the same as Current jobs: a quote out this long wants a nudge

const parse = (s: string | null | undefined) => (s ? Date.parse(s) : NaN);
// Calendar days, as Raf counts them: an enquiry on Monday evening is '1 day ago' on Tuesday morning.
const days = (t: number, now: number) => Math.max(0, daysBetween(dayOf(t), dayOf(now)));
const agoWords = (t: number, now: number) => {
  const d = days(t, now);
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const dayOf = (t: number) => new Date(t).toLocaleDateString('sv-SE');
export const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/* The job's money from ServiceM8: its total, what's been paid, what's left (null when ServiceM8 has no total). */
export function money(j: CurrentJob) {
  const known = Array.isArray(j.payments);
  const paid = Math.round((j.payments ?? []).reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const total = typeof j.total === 'number' ? j.total : null;
  const left = total === null ? null : j.paid ? 0 : Math.max(0, Math.round((total - paid) * 100) / 100);
  return { total, paid, left, known };
}

export const quoteSentOf = (j: CurrentJob, m: BoardMarks) => {
  const t = parse(j.quoteSent);
  return Number.isFinite(t) ? t : m[j.uuid]?.quoteSentAt;
};

/* Which step a job has reached; null for Unsuccessful (they're in Current jobs, folded away). */
export function boardStage(j: CurrentJob, m: BoardMarks, bookings: Booking[]): BoardStage | null {
  if (j.status === 'Unsuccessful') return null;
  if (j.status === 'Completed') return 'completed';
  if (j.status === 'Work Order') {
    const { paid } = money(j);
    return paid > 0 || j.paid ? 'deposit' : 'accepted';
  }
  if (quoteSentOf(j, m)) return 'sent';
  const booked = bookings.some((b) => b.jobUuid === j.uuid) || Boolean(m[j.uuid]?.visitsDone?.length);
  return booked || (j.total ?? 0) > 0 ? 'quote' : 'enquiry';
}

export type BoardCard = {
  job: CurrentJob;
  stage: BoardStage;
  total: number | null;
  paid: number;
  left: number | null;
  words: string; // where it's up to, in a line
  money: string; // the money, in a line ('' when ServiceM8 has none)
  flag?: string; // something waiting on Raf
  closed?: boolean;
};

/* A London date-and-time "2026-10-28T10:00" to "Tue 28 Oct, 10:00" (or "tomorrow, 10:00"). */
const visitWords = (start: string, now: string) => `${nearDay(start.slice(0, 10), now)}, ${start.slice(11, 16).replace(/^0(\d)/, '$1')}`;

export function cardOf(j: CurrentJob, stage: BoardStage, m: BoardMarks, bookings: Booking[], now = Date.now()): BoardCard {
  const { total, paid, left, known } = money(j);
  const today = dayOf(now);
  const base = { job: j, stage, total, paid, left };
  if (stage === 'enquiry') {
    const t = parse(j.created);
    const d = Number.isFinite(t) ? days(t, now) : 0;
    return { ...base, words: Number.isFinite(t) ? `Enquiry ${agoWords(t, now)}` : 'New enquiry', money: '', flag: d >= 1 ? `Waiting ${d} day${d === 1 ? '' : 's'}` : undefined };
  }
  if (stage === 'quote') {
    const mine = bookings.filter((b) => b.jobUuid === j.uuid).sort((a, b) => a.start.localeCompare(b.start));
    const done = new Set(m[j.uuid]?.visitsDone ?? []);
    const next = mine.find((b) => (b.end ?? b.start).slice(0, 10) >= today && !done.has(b.uuid));
    const last = [...mine].reverse().find((b) => (b.end ?? b.start).slice(0, 10) < today || done.has(b.uuid));
    const priced = total ? `Quote ${gbp(total)} written, not sent` : '';
    if (next) return { ...base, words: `Visit ${visitWords(next.start, today)}`, money: priced };
    if (last) {
      const d = Math.max(0, daysBetween(last.start.slice(0, 10), today));
      return { ...base, words: `Visited ${shortDay(last.start.slice(0, 10))}, quote to send`, money: priced, flag: d >= 3 ? `Quote to send, visited ${d} days ago` : undefined };
    }
    return { ...base, words: 'Quote to send', money: priced };
  }
  if (stage === 'sent') {
    const t = quoteSentOf(j, m)!;
    const d = days(t, now);
    return { ...base, words: `Quote sent ${agoWords(t, now)}`, money: total ? `Quote ${gbp(total)}` : '', flag: d >= FOLLOW_UP_DAYS ? 'Follow up' : undefined };
  }
  if (stage === 'accepted' || stage === 'deposit') {
    const row = rowOf(j, bookings, m, today);
    // The chart asks 'how far along?' to be tapped; on a card it's just noise.
    const when = row ? rowWords(row, today).replace(/ · how far along\?$/, '') : 'No dates booked yet';
    const flag = row?.state === 'late' ? 'Past its finish date' : row?.behind ? 'Behind' : undefined;
    const t = parse(j.workOrder);
    const since = Number.isFinite(t) ? `Accepted ${shortDay(dayOf(t))}` : 'Accepted';
    let line = '';
    if (total === null) line = paid ? `Paid ${gbp(paid)}` : 'No price in ServiceM8 yet';
    else if (!known && !j.paid) line = `${gbp(total)} · payments not read this time`;
    else if (left === 0) line = `${gbp(total)}, paid in full`;
    else if (paid) line = `Paid ${gbp(paid)} · ${gbp(left!)} left`;
    else line = `${gbp(total)} · nothing paid yet`;
    return { ...base, words: `${since} · ${when}`, money: line, flag };
  }
  // completed
  const t = parse(j.completed);
  const owed = (left ?? 0) > 0;
  return {
    ...base,
    words: Number.isFinite(t) ? `Completed ${shortDay(dayOf(t))}` : 'Completed',
    money: total === null ? (paid ? `Paid ${gbp(paid)}` : '') : owed ? `${gbp(left!)} to collect of ${gbp(total)}` : `${gbp(total)}, paid in full`,
    flag: owed ? `${gbp(left!)} to collect` : undefined,
    closed: Boolean(m[j.uuid]?.hidden),
  };
}

export type Board = {
  columns: { stage: BoardStage; cards: BoardCard[] }[];
  closed: BoardCard[]; // completed ones closed off the board, still in ServiceM8's list
  count: number;
  quotesOut: number; // the quotes sent, added up
  toCome: number; // left to pay on jobs going ahead (a job with nothing paid counts its whole total)
  toCollect: number; // left to pay on finished jobs
};

/* Each step's cards, in the order Raf would deal with them. */
export function buildBoard(jobs: CurrentJob[], bookings: Booking[] | null | undefined, m: BoardMarks, now = Date.now()): Board {
  const list = bookings ?? [];
  const cards: BoardCard[] = [];
  const closed: BoardCard[] = [];
  for (const j of jobs) {
    const st = boardStage(j, m, list);
    if (!st) continue;
    const c = cardOf(j, st, m, list, now);
    // Closing only takes finished ones off; a job closed and then reopened in ServiceM8 comes back by itself.
    if (st === 'completed' && c.closed) closed.push(c);
    else cards.push(c);
  }
  const t = (s: string | null) => (Number.isFinite(parse(s)) ? parse(s) : Infinity);
  const by: Record<BoardStage, (a: BoardCard, b: BoardCard) => number> = {
    enquiry: (a, b) => t(a.job.created) - t(b.job.created), // waiting longest first
    quote: (a, b) => Number(Boolean(b.flag)) - Number(Boolean(a.flag)) || t(a.job.created) - t(b.job.created),
    sent: (a, b) => (quoteSentOf(a.job, m) ?? 0) - (quoteSentOf(b.job, m) ?? 0), // oldest quote (follow up) first
    accepted: (a, b) => t(a.job.workOrder) - t(b.job.workOrder),
    deposit: (a, b) => (b.left ?? 0) - (a.left ?? 0),
    completed: (a, b) => Number(Boolean(b.flag)) - Number(Boolean(a.flag)) || -(t(a.job.completed) - t(b.job.completed)),
  };
  const columns = BOARD_STAGES.map(({ id }) => ({ stage: id, cards: cards.filter((c) => c.stage === id).sort(by[id]) }));
  const sum = (cs: BoardCard[], f: (c: BoardCard) => number) => Math.round(cs.reduce((s, c) => s + f(c), 0) * 100) / 100;
  const of = (s: BoardStage) => columns.find((c) => c.stage === s)!.cards;
  return {
    columns,
    closed: closed.sort((a, b) => -(t(a.job.completed) - t(b.job.completed))),
    count: cards.length,
    quotesOut: sum(of('sent'), (c) => c.total ?? 0),
    toCome: sum([...of('accepted'), ...of('deposit')], (c) => c.left ?? 0),
    toCollect: sum(of('completed'), (c) => c.left ?? 0),
  };
}

/* The line under 'Clients board' on Today: "2 new · 1 quoting · 3 sent · 2 accepted · 1 completed · £1,350 to collect". */
export function boardLine(b: Board) {
  if (!b.count) return 'Every client from ServiceM8, step by step';
  const parts = b.columns.filter((c) => c.cards.length).map((c) => `${c.cards.length} ${BOARD_STAGES[stageIndex(c.stage)].short}`);
  if (b.toCollect) parts.push(`${gbp(b.toCollect)} to collect`);
  return parts.join(' · ');
}

export { todayKey };
