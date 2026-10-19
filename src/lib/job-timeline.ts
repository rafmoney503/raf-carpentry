/* The Job Kit's Job timeline (a Gantt chart of the jobs going ahead), the sums only: no imports but types, so the
   Today list, the job screen and the chart all read the same rows (19 Oct 2026, Raf: 'add Gant chart to jobkit as a
   separate section where we decide on job start and finish time and progress in a smart compact way').

   A job's start and finish are its work bookings in ServiceM8 (the same bookings as the Diary): the first booked day to
   the last. Bookings scheduled before the job went to Work Order are the quote visit and don't count. How far along a
   job is (0 to 100) is kept on the phone with the other marks; ServiceM8 has no place for it.
   Days are "YYYY-MM-DD" on the phone (London), times as ServiceM8 sends them, "YYYY-MM-DDTHH:MM". Work days are Monday
   to Saturday: Sundays are shaded on the chart and never counted. */

import type { Booking, CurrentJob } from './servicem8';

export type Progress = { progress?: number; progressAt?: number };
type MarksLike = Record<string, Progress & { hidden?: boolean }>;

const DAY = 864e5;
export const todayKey = () => new Date().toLocaleDateString('sv-SE');
export const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T12:00`) + n * DAY).toLocaleDateString('sv-SE');
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00`) - Date.parse(`${a}T12:00`)) / DAY);
export const weekday = (key: string) => new Date(`${key}T12:00`).getDay(); // 0 = Sunday
export const mondayOf = (key: string) => addDays(key, -((weekday(key) + 6) % 7));
export const isSunday = (key: string) => weekday(key) === 0;

/* "Mon 20 Oct" (some browsers put a comma after the day name: taken out) */
export const shortDay = (key: string) =>
  new Date(`${key}T12:00`)
    .toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .replace(/^(\w+),/, '$1');
/* "Mon 20 Oct", or Today / Tomorrow / Yesterday */
export function nearDay(key: string, now = todayKey()) {
  if (key === now) return 'today';
  if (key === addDays(now, 1)) return 'tomorrow';
  if (key === addDays(now, -1)) return 'yesterday';
  return shortDay(key);
}
/* "Mon 20 to Fri 24 Oct", "Mon 27 Oct to Tue 4 Nov", "Wed 22 Oct" */
export function spanWords(a: string, b: string) {
  if (a === b) return shortDay(a);
  const da = new Date(`${a}T12:00`);
  const db = new Date(`${b}T12:00`);
  const sameMonth = da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
  const left = sameMonth ? da.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }).replace(/^(\w+),/, '$1') : shortDay(a);
  return `${left} to ${shortDay(b)}`;
}

/* A booking's last day: an end at midnight belongs to the day before. */
export function lastDayOf(b: Booking) {
  const first = b.start.slice(0, 10);
  if (!b.end || b.end <= b.start) return first;
  const d = b.end.slice(0, 10);
  return b.end.slice(11, 16) === '00:00' && d > first ? addDays(d, -1) : d;
}
/* A booking's end (ServiceM8 can send one with no end: an hour). */
export function endOf(b: Booking) {
  if (b.end && b.end > b.start) return b.end;
  const t = new Date(Date.parse(`${b.start}:00`) + 60 * 60000);
  return `${t.toLocaleDateString('sv-SE')}T${t.toTimeString().slice(0, 5)}`;
}
const moveTime = (t: string, n: number) => (n ? `${addDays(t.slice(0, 10), n)}${t.slice(10)}` : t);

/* Mon to Sat between two days, both counted. */
export function workDaysBetween(a: string, b: string) {
  let n = 0;
  for (let k = a; k <= b && n < 400; k = addDays(k, 1)) if (!isSunday(k)) n += 1;
  return n;
}
/* The day `n` work days after `key` (Sundays skipped), and the next work day from `key` on. */
export function addWorkDays(key: string, n: number) {
  let k = key;
  for (let i = 0; i < n; ) {
    k = addDays(k, 1);
    if (!isSunday(k)) i += 1;
  }
  return k;
}
export const nextWorkDay = (key: string) => (isSunday(key) ? addDays(key, 1) : key);

export type RowState = 'upcoming' | 'on' | 'late' | 'finished' | 'completed';
export type Row = {
  job: CurrentJob;
  bookings: Booking[]; // its work bookings, by start
  start: string; // first booked day
  end: string; // last booked day
  booked: string[]; // the booked work days (Mon to Sat), in order
  gaps: string[]; // days between start and end that aren't booked (Sundays included)
  state: RowState;
  progress?: number; // 0 to 100, set on the phone
  progressAt?: number;
  expected: number; // how far along it should be by the days gone, 0 to 100
  dayNo?: number; // today is work day N of booked.length (when today is booked)
  daysDone: number; // booked days before today
  behind: boolean;
  ahead: boolean;
};

/* The bookings that are work on this job: from the day it went to Work Order (the quote visit before that doesn't
   count), and for a completed job up to the day it was completed. */
export function workBookings(job: CurrentJob, bookings: Booking[]) {
  const from = job.workOrder?.slice(0, 10);
  const to = job.status === 'Completed' ? job.completed?.slice(0, 10) : undefined;
  return bookings
    .filter((b) => b.jobUuid === job.uuid && (!from || b.start.slice(0, 10) >= from) && (!to || b.start.slice(0, 10) <= to))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/* One job's row, or null when nothing is booked. */
export function rowOf(job: CurrentJob, bookings: Booking[], marks: MarksLike, now = todayKey()): Row | null {
  const list = workBookings(job, bookings);
  if (!list.length) return null;
  const days = new Set<string>();
  for (const b of list) for (let k = b.start.slice(0, 10), last = lastDayOf(b); k <= last && days.size < 400; k = addDays(k, 1)) days.add(k);
  const all = [...days].sort();
  const start = all[0];
  const end = all[all.length - 1];
  const work = all.filter((k) => !isSunday(k));
  const booked = work.length ? work : all; // only ever booked on a Sunday: count those
  const gaps: string[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) if (!booked.includes(k)) gaps.push(k);
  const m = marks[job.uuid] ?? {};
  const progress = typeof m.progress === 'number' ? Math.max(0, Math.min(100, m.progress)) : undefined;
  const daysDone = booked.filter((k) => k < now).length;
  const todayIn = booked.includes(now);
  const expected = end < now ? 100 : start > now ? 0 : Math.round(((daysDone + (todayIn ? 0.5 : 0)) / booked.length) * 100);
  const state: RowState = job.status === 'Completed' ? 'completed' : start > now ? 'upcoming' : end >= now ? 'on' : progress === 100 ? 'finished' : 'late';
  // Behind or ahead only once a booked day has gone by: on the first day, 0% is where it should be.
  const on = state === 'on' && progress !== undefined && daysDone >= 1;
  return {
    job,
    bookings: list,
    start,
    end,
    booked,
    gaps,
    state,
    progress: state === 'completed' ? 100 : progress,
    progressAt: m.progressAt,
    expected,
    dayNo: todayIn ? booked.indexOf(now) + 1 : undefined,
    daysDone,
    behind: on && progress! < expected - 15,
    ahead: on && progress! >= expected + 25,
  };
}

/* The chart's rows (jobs on Work Order with work booked, and jobs completed in the last two weeks or so), by start;
   and the jobs on Work Order with nothing booked. */
export function timelineRows(jobs: CurrentJob[], bookings: Booking[] | null | undefined, marks: MarksLike, now = todayKey()) {
  const list = bookings ?? [];
  const rows: Row[] = [];
  const undated: CurrentJob[] = [];
  const since = mondayOf(addDays(now, -14));
  for (const j of jobs) {
    if (j.status !== 'Work Order' && j.status !== 'Completed') continue;
    const r = rowOf(j, list, marks, now);
    if (r && (j.status === 'Work Order' || r.end >= since)) rows.push(r);
    else if (!r && j.status === 'Work Order') undated.push(j);
  }
  rows.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  return { rows, undated };
}

/* The days the chart shows: from the Monday of last week (or the earliest job) to 8 weeks ahead (or the last job, plus
   a week), whole weeks. */
export function rangeOf(rows: Row[], now = todayKey()) {
  let from = mondayOf(addDays(now, -7));
  let to = addDays(mondayOf(addDays(now, 56)), 6);
  for (const r of rows) {
    if (r.start < from) from = mondayOf(r.start);
    if (r.end > addDays(to, -7)) to = addDays(mondayOf(r.end), 13);
  }
  const earliest = mondayOf(addDays(now, -70));
  const latest = addDays(mondayOf(addDays(now, 196)), 6);
  if (from < earliest) from = earliest;
  if (to > latest) to = latest;
  return { from, to, days: daysBetween(from, to) + 1 };
}

/* What the row says, short: "Day 3 of 5 · 50%, on track", "Starts Mon 27 Oct · 5 days", "Finish was Fri 17 Oct". */
export function rowWords(r: Row, now = todayKey()) {
  const n = r.booked.length;
  const days = `${n} day${n === 1 ? '' : 's'}`;
  const pct = r.progress === undefined ? '' : r.progress === 100 ? 'done' : `${r.progress}%`;
  if (r.state === 'completed') return 'Completed';
  if (r.state === 'upcoming') return `Starts ${nearDay(r.start, now)} · ${days}`;
  if (r.state === 'finished') return `Done, finish was ${nearDay(r.end, now)}`;
  if (r.state === 'late') return `Finish was ${nearDay(r.end, now)}${pct ? ` · ${pct}` : ''}`;
  const where = r.dayNo ? `Day ${r.dayNo} of ${n}` : `${r.daysDone} of ${n} days done`;
  if (!pct) return `${where} · how far along?`;
  return `${where} · ${pct}${r.behind ? ', behind' : r.ahead ? ', ahead' : r.progress === 100 ? '' : ', on track'}`;
}

/* ---------- changing the dates: what to send to ServiceM8 ---------- */

/* uuid: move that booking; none: book a new one. */
export type Change = { uuid?: string; start: string; end: string };

/* The bookings to add or move so the job runs from `start` to `end`, after moving every booking `shift` days.
   Nothing booked: one booking, 8:00 on the first day to 16:00 on the last. One booking: moved, its times of day
   kept. Several: the first one starts on the new start day, the last one ends on the new finish day, the ones between
   stay; a start past the first booked day (or a finish before the last) is turned down rather than cancelling days. */
export function planChanges(row: Pick<Row, 'bookings' | 'start' | 'end'> | null, start: string, end: string, shift = 0): { changes: Change[]; error?: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return { changes: [], error: 'Pick a start and a finish day.' };
  if (end < start) return { changes: [], error: 'The finish is before the start.' };
  if (daysBetween(start, end) > 120) return { changes: [], error: 'That’s over four months: check the dates.' };
  if (!row || !row.bookings.length) return { changes: [{ start: `${start}T08:00`, end: `${end}T16:00` }] };
  const was = row.bookings.map((b) => ({
    uuid: b.uuid,
    start: b.start,
    end: endOf(b),
  }));
  const now = was.map((b) => ({
    ...b,
    start: moveTime(b.start, shift),
    end: moveTime(b.end, shift),
  }));
  if (now.length === 1) {
    const b = now[0];
    const s = `${start}T${b.start.slice(11, 16)}`;
    let e = `${end}T${b.end.slice(11, 16)}`;
    if (e <= s) e = start === end ? endOf({ ...row.bookings[0], start: s, end: null }) : `${end}T16:00`;
    now[0] = { ...b, start: s, end: e };
  } else {
    const first = now.reduce((x, b) => (b.start < x.start ? b : x));
    const last = now.reduce((x, b) => (b.end > x.end ? b : x));
    const s0 = addDays(row.start, shift);
    const e0 = addDays(row.end, shift);
    const lastDay = (b: { start: string; end: string }) =>
      lastDayOf({
        uuid: '',
        jobUuid: '',
        staffUuid: '',
        start: b.start,
        end: b.end,
      });
    if (start !== s0) {
      if (start > lastDay(first))
        return {
          changes: [],
          error: `The start can’t go past the first booked day (${shortDay(
            lastDay(first)
          )}). Use Move the whole job, or change single days in the job’s diary.`,
        };
      first.start = `${start}T${first.start.slice(11, 16)}`;
    }
    if (end !== e0) {
      if (end < last.start.slice(0, 10))
        return {
          changes: [],
          error: `The finish can’t come before the last booked day (${shortDay(
            last.start.slice(0, 10)
          )}). Use Move the whole job, or change single days in the job’s diary.`,
        };
      last.end = `${end}T${last.end.slice(11, 16)}`;
    }
  }
  const changes = now.filter((b, i) => b.start !== was[i].start || b.end !== was[i].end);
  return { changes };
}

/* Starting dates for a job with nothing booked: the next work day, five work days long. */
export function suggestedDates(now = todayKey()) {
  const start = nextWorkDay(addDays(now, 1));
  return { start, end: addWorkDays(start, 4) };
}
