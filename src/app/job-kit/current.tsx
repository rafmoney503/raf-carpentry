'use client';
import { useRef, useState } from 'react';
import type { Booking, CurrentJob, Staff, Status } from '@/lib/servicem8';
import Mark from './mark';
import { Icon, type IconName } from './icons';
import { field, label, Missing, TalkBox } from './parts';
import type { DesignsReady } from './designs';
import { designState } from './designs';
import type { Job } from './store';

/* Current jobs: Raf's customers and jobs from ServiceM8 (where he quotes and invoices), read and moved on from
   the Job Kit through /api/job-kit/sm8 behind the PIN. The last list is kept on the phone (this phone only) so
   the morning screen opens at once and with no signal. Things ServiceM8 has no place for stay on the phone
   too: when a quote went out by WhatsApp, and finished jobs hidden from the list. */

export type { Booking, CurrentJob, Staff };
/* bookings: ServiceM8's schedule from yesterday on (null: ServiceM8 didn't send it this time; missing in a list
   kept from before the diary existed). */
export type Sm8 = { jobs: CurrentJob[]; at: number; bookings?: Booking[] | null; staff?: Staff[]; error?: string; detail?: string };
export type Marks = Record<string, { quoteSentAt?: number; hidden?: boolean }>;

const LIST_KEY = 'raf_jobkit_sm8';
const MARKS_KEY = 'raf_jobkit_sm8_marks';
const DRAFT_KEY = 'raf_jobkit_enquiry';
export const FOLLOW_UP_DAYS = 5;
const DONE_DAYS = 14;
export const LOST_DAYS = 30; // unsuccessful ones stay (folded away) this long, then drop off; ServiceM8 keeps them

const read = <T,>(key: string, empty: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) || 'null') as T) ?? empty;
  } catch {
    return empty;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* no storage */
  }
};

export const savedSm8 = (): Sm8 => read<Sm8>(LIST_KEY, { jobs: [], at: 0 });
export const readMarks = (): Marks => read<Marks>(MARKS_KEY, {});
export const saveMarks = (m: Marks) => write(MARKS_KEY, m);

async function post<T>(pin: string, body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string; detail?: string }> {
  if (!pin) return { ok: false, error: 'no-pin' };
  try {
    const res = await fetch('/api/job-kit/sm8', { method: 'POST', headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
    if (!res.ok) return { ok: false, error: data.error || 'sm8-error', detail: data.detail };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

/* The list, kept on the phone when it arrives. On failure the last list stays, with the reason. */
export async function fetchSm8(pin: string, before: Sm8): Promise<Sm8> {
  const r = await post<{ jobs: CurrentJob[]; at: number; bookings: Booking[] | null; staff: Staff[] }>(pin, { action: 'list' });
  if (!r.ok) return { ...before, error: r.error, detail: r.detail };
  const next: Sm8 = { jobs: r.data.jobs, at: r.data.at, bookings: r.data.bookings ?? null, staff: r.data.staff ?? [] };
  write(LIST_KEY, next);
  return next;
}
export const keepSm8 = (s: Sm8) => write(LIST_KEY, { jobs: s.jobs, at: s.at, bookings: s.bookings, staff: s.staff });

export type Enquiry = { name: string; mobile: string; email: string; address: string; description: string };
export const sendEnquiry = (pin: string, e: Enquiry) => post<{ job: CurrentJob }>(pin, { action: 'enquiry', ...e });
export const sendStatus = (pin: string, uuid: string, status: Status) => post<{ ok: true }>(pin, { action: 'status', uuid, status });
export const sendBooking = (pin: string, b: { job: string; start: string; end: string; staff?: string }) => post<{ booking: Booking }>(pin, { action: 'book', ...b });
export const sendMove = (pin: string, uuid: string, start: string, end: string) => post<{ ok: true }>(pin, { action: 'move', uuid, start, end });
export const sendCancel = (pin: string, uuid: string) => post<{ ok: true }>(pin, { action: 'cancel', uuid });

export function problemText(error?: string, detail?: string, at?: number) {
  switch (error) {
    case undefined:
      return '';
    case 'sm8-not-set-up':
      return 'ServiceM8 isn’t connected yet: SERVICEM8_API_KEY is missing in Vercel.';
    case 'sm8-key':
      return 'ServiceM8 turned the key down. Make a new key in ServiceM8 (Settings, API Keys, Full access) and replace SERVICEM8_API_KEY in Vercel.';
    case 'sm8-forbidden':
      return 'ServiceM8 says this key isn’t allowed to do that. Check the key has Full access and the plan is Starter or above.';
    case 'sm8-busy':
      return 'ServiceM8 is busy. Try again in a minute.';
    case 'no-pin':
      return 'Add your PIN in Settings first.';
    case 'wrong-pin':
      return 'Wrong PIN: check it in Settings.';
    case 'missing':
      return 'Type the name and what they want.';
    case 'bad-time':
      return 'The end has to be after the start.';
    case 'offline':
    case 'sm8-down':
      return `No signal, or ServiceM8 isn’t answering.${at ? ` Showing the list from ${clock(at)}.` : ''}`;
    default:
      return `ServiceM8 sent back an error${detail ? `: ${detail}` : '.'}`;
  }
}

/* ---------- reading a job ---------- */

const parse = (s: string | null) => (s ? Date.parse(s) : NaN);
const DAY = 864e5;
const clock = (t: number) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const ago = (t: number) => {
  const d = Math.floor((Date.now() - t) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

/* Money, from ServiceM8: the job's total there and the payments recorded against it. */
export const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export function moneyOf(j: CurrentJob) {
  const payments = j.payments ?? null; // older lists kept on the phone have neither
  const total = j.total ?? null;
  const paid = Math.round((payments ?? []).reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const left = total === null ? null : j.paid ? 0 : Math.max(0, Math.round((total - paid) * 100) / 100);
  return { total, paid, left, payments };
}
function moneyLine(j: CurrentJob) {
  const { total, paid, left, payments } = moneyOf(j);
  if (j.status === 'Quote' || j.status === 'Unsuccessful') return total ? `Quote ${gbp(total)}` : '';
  if (total === null) return paid ? `Paid ${gbp(paid)}` : '';
  if (left === 0) return `${gbp(total)}, paid in full`;
  if (payments === null) return gbp(total);
  return paid ? `${gbp(total)} · paid ${gbp(paid)} · ${gbp(left!)} left` : `${gbp(total)} · nothing paid yet`;
}

export type Stage = 'new' | 'sent' | 'follow' | 'going' | 'done' | 'lost';
export const quoteSentAt = (j: CurrentJob, m: Marks) => (Number.isFinite(parse(j.quoteSent)) ? parse(j.quoteSent) : m[j.uuid]?.quoteSentAt);
export function stage(j: CurrentJob, m: Marks): Stage {
  if (j.status === 'Work Order') return 'going';
  if (j.status === 'Completed') return 'done';
  if (j.status === 'Unsuccessful') return 'lost';
  const sent = quoteSentAt(j, m);
  if (!sent) return 'new';
  return Date.now() - sent >= FOLLOW_UP_DAYS * DAY ? 'follow' : 'sent';
}
/* Unsuccessful in the last 30 days, kept apart (folded away) so one can be brought back. */
const lostAt = (j: CurrentJob) => parse(j.lost);
export function lostList(s: Sm8) {
  return s.jobs.filter((j) => j.status === 'Unsuccessful' && (!Number.isFinite(lostAt(j)) || Date.now() - lostAt(j) < LOST_DAYS * DAY));
}

/* What shows: everything open; completed ones for 14 days, or while money is still owed (ServiceM8 sends
   the last 30 days), unless hidden; unsuccessful ones are listed apart. */
export function shown(s: Sm8, m: Marks) {
  return s.jobs.filter((j) => {
    if (m[j.uuid]?.hidden || j.status === 'Unsuccessful') return false;
    if (j.status === 'Completed') return Date.now() - (parse(j.completed) || 0) < DONE_DAYS * DAY || (moneyOf(j).left ?? 0) > 0;
    return true;
  });
}

function stageText(j: CurrentJob, m: Marks): [string, 'waiting' | 'sending' | 'sent' | 'lost'] {
  const st = stage(j, m);
  const created = parse(j.created);
  if (st === 'new') return [`New enquiry${Number.isFinite(created) ? `, ${ago(created)}` : ''}: quote to send`, 'waiting'];
  if (st === 'sent') return [`Quote sent ${ago(quoteSentAt(j, m)!)}`, 'sending'];
  if (st === 'follow') return [`Quote sent ${ago(quoteSentAt(j, m)!)}: follow up?`, 'lost'];
  if (st === 'going') return [`Work Order${Number.isFinite(parse(j.workOrder)) ? ` since ${day(parse(j.workOrder))}` : ''}`, 'sending'];
  if (st === 'done') return [`Completed${Number.isFinite(parse(j.completed)) ? ` ${day(parse(j.completed))}` : ''}${j.invoiceSent && !j.paid ? ', invoice sent' : ''}`, 'sent'];
  const t = lostAt(j);
  return [Number.isFinite(t) ? `Unsuccessful ${day(t)}, drops off ${day(t + LOST_DAYS * DAY)}` : 'Unsuccessful', 'waiting'];
}

/* A short "what" for a design or Job Kit job, from ServiceM8's description. */
export function whatOf(d: string) {
  const line = d.split(/\n|\.\s/)[0].trim().replace(/\.$/, '');
  const short = (line.length > 60 ? line.slice(0, 60).replace(/\s+\S*$/, '') : line).replace(/[\s,;:]+$/, '');
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/* UK mobile to WhatsApp's digits. */
function intl(raw: string) {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '44' + d.slice(1);
  return d.replace(/\D/g, '');
}
const wa = (mobile: string, text: string) => `https://wa.me/${intl(mobile)}?text=${encodeURIComponent(text)}`;

/* What the Job Kit holds for this job: a design request and a photo job, linked by the ServiceM8 job. */
function linked(j: CurrentJob, kit: Job[], designs: DesignsReady, done: Record<string, { slug: string }>) {
  const design = kit.find((k) => k.kind === 'design' && k.sm8 === j.uuid);
  const job = kit.find((k) => k.kind !== 'design' && k.sm8 === j.uuid);
  const chips: string[] = [];
  if (design) {
    const st = designState(design, designs[design.id]);
    chips.push(st === 'ready' ? (design.sharedAt ? 'Design sent' : 'Design ready') : st === 'draft' ? 'Design not sent' : 'Design on its way');
  }
  if (job) chips.push(done[job.id] ? 'On your website' : job.readyAt ? 'Photos sent' : 'Job Kit open');
  return { design, job, chips };
}

/* ---------- the diary: ServiceM8's schedule ---------- */

/* Dates as "YYYY-MM-DD" on this phone (London), times as ServiceM8 sends them, "YYYY-MM-DDTHH:MM". */
export const localDay = (d = new Date()) => d.toLocaleDateString('sv-SE');
const addDays = (key: string, n: number) => localDay(new Date(Date.parse(`${key}T12:00`) + n * DAY));
export function dayLabel(key: string) {
  const today = localDay();
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return new Date(`${key}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
export const hm = (t: string) => t.slice(11, 16).replace(/^0(\d)/, '$1');
/* A visit on a Quote job (or a lost one); work once it's going ahead. */
export const kindOf = (j?: CurrentJob) => (!j || j.status === 'Quote' || j.status === 'Unsuccessful' ? 'Visit' : 'Work');

/* Bookings on a day: starting that day, or running through it. */
export function bookingsOn(list: Booking[], key: string) {
  return list.filter((b) => b.start.slice(0, 10) <= key && (b.end ? b.end.slice(0, 10) : b.start.slice(0, 10)) >= key);
}
/* "9:00 to 10:00" on its own day; a booking over several days says where it starts or ends. */
const rel = (key: string) => {
  const l = dayLabel(key);
  return ['Today', 'Tomorrow', 'Yesterday'].includes(l) ? l.toLowerCase() : l;
};
export function spanText(b: Booking, key: string) {
  const from = b.start.slice(0, 10) === key ? hm(b.start) : `From ${rel(b.start.slice(0, 10))}`;
  if (!b.end) return from;
  return b.end.slice(0, 10) === key ? `${from} to ${hm(b.end)}` : `${from}, until ${rel(b.end.slice(0, 10))} ${hm(b.end)}`;
}
const longDay = (key: string) => {
  const l = dayLabel(key);
  return l === 'Today' || l === 'Tomorrow' ? l.toLowerCase() : `on ${new Date(`${key}T12:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`;
};
/* The WhatsApp line that confirms a booking with the customer. */
export function confirmText(j: CurrentJob, b: Booking) {
  const when = `${longDay(b.start.slice(0, 10))} at ${hm(b.start)}`;
  return kindOf(j) === 'Visit'
    ? `Hi ${j.first}, just to confirm I'll come round ${when} to have a look and measure up. Any problem with that time, just let me know.\nRaf`
    : `Hi ${j.first}, just to confirm I'll be with you ${when}. Any problem with that, just let me know.\nRaf`;
}
const maps = (address: string) => `https://maps.apple.com/?daddr=${encodeURIComponent(address.replace(/\s*\n\s*/g, ', '))}`;

export function Diary({ sm8, loading, onRefresh, onOpen }: { sm8: Sm8; loading: boolean; onRefresh: () => void; onOpen: (uuid: string) => void }) {
  const today = localDay();
  const list = (sm8.bookings ?? []).filter((b) => (b.end ?? b.start).slice(0, 10) >= today);
  const last = list.reduce((k, b) => ((b.end ?? b.start).slice(0, 10) > k ? (b.end ?? b.start).slice(0, 10) : k), addDays(today, 1));
  const days: string[] = [];
  for (let k = today; k <= last && days.length < 120; k = addDays(k, 1)) if (k === today || k === addDays(today, 1) || bookingsOn(list, k).length) days.push(k);
  const byUuid = new Map(sm8.jobs.map((j) => [j.uuid, j]));
  const staffName = new Map((sm8.staff ?? []).map((s) => [s.uuid, s.name]));
  const manyStaff = (sm8.staff ?? []).length > 1;
  const problem = problemText(sm8.error, sm8.detail, sm8.at);
  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="diary" className="h-[32px] w-[32px] shrink-0 text-accent" />
        Diary
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[13px] text-faint">
        <span>ServiceM8’s schedule{sm8.at ? `, ${clock(sm8.at)}` : ''}</span>
        <button type="button" onClick={onRefresh} className="h-9 text-accent underline" disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </p>
      {problem ? (
        <p role="alert" className="mt-3 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem}
        </p>
      ) : null}
      {sm8.at && sm8.bookings === null ? <p className="mt-3 text-[14.5px] leading-relaxed text-muted">ServiceM8 didn’t send the schedule this time. Refresh to try again.</p> : null}
      {sm8.at && sm8.bookings === undefined ? <p className="mt-3 text-[14.5px] leading-relaxed text-muted">Refresh to get the schedule from ServiceM8.</p> : null}
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">Book a visit or work from a job (Current jobs, then the job), or in ServiceM8: both end up here.</p>

      {days.map((k) => {
        const on = bookingsOn(list, k);
        const isToday = k === today;
        return (
          <section key={k} className="mt-7">
            <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">
              {dayLabel(k)}
              {isToday || dayLabel(k) === 'Tomorrow' ? `, ${new Date(`${k}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}
            </h2>
            {on.length ? (
              <ul className="mt-2.5 grid gap-3">
                {on.map((b) => {
                  const j = byUuid.get(b.jobUuid);
                  const kind = kindOf(j);
                  const contact = j?.mobile || j?.phone;
                  return (
                    <li key={`${b.uuid}-${k}`} className="rounded-sm border border-line-strong bg-mount">
                      <button type="button" onClick={() => onOpen(b.jobUuid)} className="block w-full px-3.5 py-3 text-left">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-mono text-[15px] font-semibold text-ink">{spanText(b, k)}</span>
                          <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[11.5px] ${kind === 'Visit' ? 'border-accent text-accent' : 'border-line-strong text-muted'}`}>{kind}</span>
                        </span>
                        <span className="mt-1 block truncate text-[16.5px] font-semibold leading-snug">{j?.name ?? 'A job in ServiceM8'}</span>
                        {j ? (
                          <span className="block truncate text-[14.5px] text-muted">
                            {[j.area, j.description ? whatOf(j.description) : ''].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                        {manyStaff && staffName.get(b.staffUuid) ? <span className="mt-1 block font-mono text-[12.5px] text-faint">{staffName.get(b.staffUuid)}</span> : null}
                      </button>
                      {isToday && j && (j.address || contact) ? (
                        <div className="flex flex-wrap gap-x-4 border-t border-line px-3.5 py-1.5 text-[14.5px]">
                          {j.address ? (
                            <a href={maps(j.address)} className="flex h-10 items-center text-accent underline" target="_blank" rel="noopener">
                              Directions
                            </a>
                          ) : null}
                          {j.mobile ? (
                            <a href={wa(j.mobile, `Hi ${j.first}, I'm on my way.\nRaf`)} className="flex h-10 items-center text-accent underline" target="_blank" rel="noopener">
                              On my way
                            </a>
                          ) : null}
                          {contact ? (
                            <a href={`tel:${contact.replace(/\s+/g, '')}`} className="flex h-10 items-center text-accent underline">
                              Call
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 font-mono text-[13.5px] text-faint">Nothing booked.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* A job's bookings: book a visit or work, move one, cancel one, confirm it on WhatsApp. */
function BookingsBox({
  job,
  bookings,
  staff,
  loaded,
  onBook,
  onMove,
  onCancel,
}: {
  job: CurrentJob;
  bookings: Booking[];
  staff: Staff[];
  loaded: boolean;
  onBook: (start: string, end: string, staff?: string) => Promise<string>;
  onMove: (uuid: string, start: string, end: string) => Promise<string>;
  onCancel: (uuid: string) => Promise<string>;
}) {
  const kind = kindOf(job);
  const today = localDay();
  const now = `${today}T${new Date().toTimeString().slice(0, 5)}`;
  const upcoming = bookings.filter((b) => (b.end ?? b.start) >= now);
  // lastDay is only set for a booking over several days (moving it keeps its length).
  const [form, setForm] = useState<null | { uuid?: string; day: string; lastDay?: string; from: string; to: string; staff: string }>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [sure, setSure] = useState('');
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const presets: [string, string, string][] =
    kind === 'Visit'
      ? [
          ['1 hour', '', '+60'],
          ['30 min', '', '+30'],
          ['2 hours', '', '+120'],
        ]
      : [
          ['All day', '08:00', '16:00'],
          ['Morning', '08:00', '12:00'],
          ['Afternoon', '12:00', '16:00'],
        ];
  const plus = (t: string, mins: number) => {
    const [h, m] = t.split(':').map(Number);
    const total = Math.min(23 * 60 + 59, h * 60 + m + mins);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const open = (b?: Booking) => {
    setProblem('');
    if (b) {
      const last = (b.end ?? b.start).slice(0, 10);
      setForm({ uuid: b.uuid, day: b.start.slice(0, 10), lastDay: last > b.start.slice(0, 10) ? last : undefined, from: b.start.slice(11, 16), to: (b.end ?? b.start).slice(11, 16), staff: b.staffUuid });
    }
    else setForm({ day: addDays(today, 1), from: kind === 'Visit' ? '09:00' : '08:00', to: kind === 'Visit' ? '10:00' : '16:00', staff: staff[0]?.uuid ?? '' });
  };
  const save = () => {
    if (!form) return;
    if (!form.day || !form.from || !form.to || form.lastDay === '') return setProblem('Pick the day and both times.');
    const start = `${form.day}T${form.from}`;
    const end = `${form.lastDay ?? form.day}T${form.to}`;
    if (end <= start) return setProblem('The end has to be after the start.');
    setBusy(true);
    setProblem('');
    void (form.uuid ? onMove(form.uuid, start, end) : onBook(start, end, staff.length > 1 ? form.staff : undefined)).then((err) => {
      setBusy(false);
      if (err) setProblem(err);
      else setForm(null);
    });
  };
  const cancel = (uuid: string) => {
    if (disarm.current) clearTimeout(disarm.current);
    if (sure !== uuid) {
      setSure(uuid);
      disarm.current = setTimeout(() => setSure(''), 5000);
      return;
    }
    setSure('');
    setBusy(true);
    void onCancel(uuid).then((err) => {
      setBusy(false);
      if (err) setProblem(err);
    });
  };
  return (
    <section className="mt-6 rounded-sm border border-line-strong bg-mount p-4">
      <h2 className="text-[19px] font-[650]">In the diary</h2>
      {!loaded ? <p className="mt-2 text-[14.5px] text-muted">ServiceM8 didn’t send the schedule this time; Refresh on Current jobs to try again.</p> : null}
      {loaded && !upcoming.length && !form ? <p className="mt-2 text-[14.5px] text-muted">Nothing booked for this job in ServiceM8.</p> : null}
      {upcoming.length ? (
        <ul className="mt-3 grid gap-2.5">
          {upcoming.map((b) => (
            <li key={b.uuid} className="rounded-sm border border-line px-3 py-2.5">
              <p className="text-[15.5px] font-semibold">
                {dayLabel(b.start.slice(0, 10))}
                {['Today', 'Tomorrow'].includes(dayLabel(b.start.slice(0, 10))) ? `, ${new Date(`${b.start.slice(0, 10)}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
              </p>
              <p className="font-mono text-[13.5px] text-muted">
                {spanText(b, b.start.slice(0, 10))} · {kind}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-[14.5px]">
                {job.mobile ? (
                  <a href={wa(job.mobile, confirmText(job, b))} className="flex h-10 items-center text-accent underline" target="_blank" rel="noopener">
                    Confirm on WhatsApp
                  </a>
                ) : null}
                <button type="button" className="h-10 text-accent underline" disabled={busy} onClick={() => open(b)}>
                  Move
                </button>
                <button type="button" className={`h-10 underline ${sure === b.uuid ? 'font-semibold text-ink' : 'text-muted'}`} disabled={busy} onClick={() => cancel(b.uuid)}>
                  {sure === b.uuid ? 'Tap again to cancel it' : 'Cancel'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {form ? (
        <div className="mt-4 grid gap-4 border-t border-line pt-4">
          <p className="font-semibold">{form.uuid ? 'Move the booking' : kind === 'Visit' ? 'Book a visit' : 'Book work'}</p>
          <label className="grid gap-1.5">
            <span className={label}>Day</span>
            <input
              type="date"
              className={`${field} h-12`}
              value={form.day}
              min={today}
              onChange={(e) => {
                const day = e.target.value;
                // A booking over several days moves as a whole.
                const shift = form.lastDay && day && form.day ? Math.round((Date.parse(`${day}T12:00`) - Date.parse(`${form.day}T12:00`)) / DAY) : 0;
                setForm({ ...form, day, ...(form.lastDay ? { lastDay: addDays(form.lastDay, shift) } : {}) });
              }}
            />
          </label>
          {form.lastDay !== undefined ? (
            <label className="grid gap-1.5">
              <span className={label}>Last day</span>
              <input type="date" className={`${field} h-12`} value={form.lastDay} min={form.day} onChange={(e) => setForm({ ...form, lastDay: e.target.value })} />
            </label>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className={label}>{form.lastDay ? 'Starts at' : 'From'}</span>
              <input type="time" step={900} className={`${field} h-12`} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className={label}>{form.lastDay ? 'Ends at' : 'To'}</span>
              <input type="time" step={900} className={`${field} h-12`} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map(([name, a, b]) => (
              <button
                key={name}
                type="button"
                className="h-10 rounded-sm border border-line-strong px-3 text-[14px]"
                onClick={() => setForm({ ...form, ...(b.startsWith('+') ? { to: plus(form.from, Number(b.slice(1))) } : { from: a, to: b }) })}
              >
                {name}
              </button>
            ))}
          </div>
          {!form.uuid && staff.length > 1 ? (
            <div className="grid gap-1.5">
              <span className={label}>Who</span>
              <div className="flex flex-wrap gap-2">
                {staff.map((s) => (
                  <button
                    key={s.uuid}
                    type="button"
                    onClick={() => setForm({ ...form, staff: s.uuid })}
                    className={`h-10 rounded-sm border px-3 text-[14px] ${form.staff === s.uuid ? 'border-accent bg-accent text-on-accent' : 'border-line-strong'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {problem ? (
            <p role="alert" className="rounded-sm border border-ink px-3 py-2.5 text-[14.5px] leading-relaxed">
              {problem}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button type="button" className="btn btn-primary btn-sm flex-1" disabled={busy} onClick={save}>
              {busy ? 'Saving in ServiceM8…' : form.uuid ? 'Move it in ServiceM8' : 'Add to ServiceM8'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {problem ? (
            <p role="alert" className="mt-3 rounded-sm border border-ink px-3 py-2.5 text-[14.5px] leading-relaxed">
              {problem}
            </p>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm mt-3 w-full" onClick={() => open()}>
            {kind === 'Visit' ? 'Book a visit' : 'Book work'}
          </button>
        </>
      )}
      <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">Booked here or in ServiceM8, it shows in both. Cancelling archives it in ServiceM8, where it can be brought back.</p>
    </section>
  );
}

/* ---------- the list ---------- */

function Card({ j, marks, kit, designs, done, onOpen }: { j: CurrentJob; marks: Marks; kit: Job[]; designs: DesignsReady; done: Record<string, { slug: string }>; onOpen: (uuid: string) => void }) {
  const [text, mark] = stageText(j, marks);
  const { chips } = linked(j, kit, designs, done);
  const money = moneyLine(j);
  const owed = j.status === 'Completed' && (moneyOf(j).left ?? 0) > 0;
  return (
    <li>
      <button type="button" onClick={() => onOpen(j.uuid)} className="block w-full rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-left transition-colors hover:border-ink">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[16.5px] font-semibold leading-snug">{j.name}</span>
          {j.number ? <span className="shrink-0 font-mono text-[12px] text-faint">#{j.number}</span> : null}
        </span>
        {j.area ? <span className="block truncate text-[14.5px] text-muted">{j.area}</span> : null}
        {j.description ? <span className="mt-1 line-clamp-2 block text-[14.5px] leading-snug">{j.description}</span> : null}
        <span className="mt-2 flex items-center gap-1.5 font-mono text-[12.5px] text-faint">
          <Mark state={mark} />
          {text}
        </span>
        {money ? <span className={`mt-1 block font-mono text-[12.5px] ${owed ? 'font-semibold text-ink' : 'text-faint'}`}>{money}</span> : null}
        {chips.length ? (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[11.5px] text-muted">
                {c}
              </span>
            ))}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function CurrentList({
  sm8,
  marks,
  kit,
  designs,
  done,
  loading,
  onRefresh,
  onNew,
  onOpen,
}: {
  sm8: Sm8;
  marks: Marks;
  kit: Job[];
  designs: DesignsReady;
  done: Record<string, { slug: string }>;
  loading: boolean;
  onRefresh: () => void;
  onNew: () => void;
  onOpen: (uuid: string) => void;
}) {
  const list = shown(sm8, marks);
  const groups: [string, CurrentJob[]][] = [
    ['Quote: enquiries and quotes', list.filter((j) => j.status === 'Quote')],
    ['Work Order: going ahead', list.filter((j) => j.status === 'Work Order')],
    [`Completed (last ${DONE_DAYS} days, or still owing)`, list.filter((j) => j.status === 'Completed')],
  ];
  const lost = lostList(sm8);
  const [showLost, setShowLost] = useState(false);
  const problem = problemText(sm8.error, sm8.detail, sm8.at);
  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="jobs" className="h-[32px] w-[32px] shrink-0 text-accent" />
        Current jobs
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[13px] text-faint">
        <span>From ServiceM8{sm8.at ? `, ${clock(sm8.at)}` : ''}</span>
        <button type="button" onClick={onRefresh} className="h-9 text-accent underline" disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </p>
      {problem ? (
        <p role="alert" className="mt-3 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem}
        </p>
      ) : null}
      <button type="button" onClick={onNew} className="btn btn-primary mt-5 w-full">
        New enquiry
      </button>

      {!sm8.at && !problem ? <p className="mt-7 font-mono text-[13.5px] text-faint">{loading ? 'Getting your jobs from ServiceM8…' : 'Nothing yet.'}</p> : null}
      {groups.map(([title, js]) =>
        js.length ? (
          <section key={title} className="mt-7">
            <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">
              {title} ({js.length})
            </h2>
            <ul className="mt-2.5 grid gap-3">
              {js.map((j) => (
                <Card key={j.uuid} j={j} marks={marks} kit={kit} designs={designs} done={done} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {sm8.at && !list.length ? <p className="mt-7 font-mono text-[13.5px] text-faint">No open jobs in ServiceM8.</p> : null}

      {lost.length ? (
        <div className="mt-7 border-t border-line pt-4">
          <button type="button" onClick={() => setShowLost((v) => !v)} className="flex h-11 w-full items-center justify-between text-left text-[15.5px] font-semibold" aria-expanded={showLost}>
            <span>Unsuccessful, last {LOST_DAYS} days ({lost.length})</span>
            <span aria-hidden className="font-mono text-[13px] text-faint">
              {showLost ? 'Hide' : 'Show'}
            </span>
          </button>
          {showLost ? (
            <>
              <p className="text-[14px] leading-relaxed text-muted">Kept here in case they come back, then they drop off the Job Kit by themselves. ServiceM8 keeps them under Unsuccessful.</p>
              <ul className="mt-3 grid gap-3 opacity-80">
                {lost.map((j) => (
                  <Card key={j.uuid} j={j} marks={marks} kit={kit} designs={designs} done={done} onOpen={onOpen} />
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- one job ---------- */

const STEPS: { status: Status; name: string }[] = [
  { status: 'Quote', name: 'Quote' },
  { status: 'Work Order', name: 'Work Order' },
  { status: 'Completed', name: 'Completed' },
];

export function CurrentView({
  job,
  marks,
  kit,
  designs,
  done,
  onStatus,
  onMark,
  onDesign,
  onKit,
  onOpenKit,
  bookings,
  staff,
  bookingsLoaded,
  onBook,
  onMove,
  onCancel,
}: {
  job: CurrentJob;
  marks: Marks;
  kit: Job[];
  designs: DesignsReady;
  done: Record<string, { slug: string }>;
  onStatus: (s: Status) => Promise<void>;
  onMark: (patch: Marks[string]) => void;
  onDesign: () => void;
  onKit: () => void;
  onOpenKit: (k: Job) => void;
  bookings: Booking[];
  staff: Staff[];
  bookingsLoaded: boolean;
  onBook: (start: string, end: string, staff?: string) => Promise<string>;
  onMove: (uuid: string, start: string, end: string) => Promise<string>;
  onCancel: (uuid: string) => Promise<string>;
}) {
  const st = stage(job, marks);
  const [text] = stageText(job, marks);
  const { design, job: kitJob } = linked(job, kit, designs, done);
  const [sure, setSure] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const move = (s: Status, confirm = true) => {
    if (disarm.current) clearTimeout(disarm.current);
    if (confirm && sure !== s) {
      setSure(s);
      disarm.current = setTimeout(() => setSure(null), 5000);
      return;
    }
    setSure(null);
    setBusy(true);
    void onStatus(s).finally(() => setBusy(false));
  };
  const sentAt = quoteSentAt(job, marks);
  const contact = job.mobile || job.phone;
  const hello = `Hi ${job.first}, `;
  const followUp = `Hi ${job.first}, just checking you got my quote. Happy to answer any questions or change anything.\nRaf`;
  const at = STEPS.findIndex((s) => s.status === job.status);

  return (
    <div className="pt-5">
      <p className="kicker">
        Current job{job.number ? ` #${job.number}` : ''}
      </p>
      <h1 className="mt-1 font-display text-[28px] font-[680] leading-[1.05] tracking-[-0.025em]">{job.name}</h1>
      {job.address ? <p className="mt-1 whitespace-pre-line text-[15.5px] text-muted">{job.address}</p> : null}
      {job.description ? <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed">{job.description}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {job.mobile ? (
          <a href={wa(job.mobile, hello)} className="btn btn-whatsapp btn-sm" target="_blank" rel="noopener">
            WhatsApp
          </a>
        ) : null}
        {contact ? (
          <a href={`tel:${contact.replace(/\s+/g, '')}`} className="btn btn-ghost btn-sm">
            Call
          </a>
        ) : null}
        {job.email ? (
          <a href={`mailto:${job.email}`} className="btn btn-ghost btn-sm">
            Email
          </a>
        ) : null}
      </div>
      {!contact && !job.email ? <p className="mt-2 text-[14px] text-faint">No phone or email on this job in ServiceM8.</p> : null}

      <section className="mt-7 rounded-sm border border-line-strong bg-mount p-4">
        <h2 className="text-[19px] font-[650]">Where it’s up to</h2>
        {/* Tap a step to move the job there (tap again to confirm); Unsuccessful branches off after Quote. */}
        <ol className="mt-3 grid grid-cols-3 gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s.status}>
              <button
                type="button"
                disabled={busy || i === at}
                onClick={() => move(s.status)}
                className={`min-h-11 w-full rounded-sm border px-1.5 py-2 text-center text-[13.5px] leading-tight ${
                  sure === s.status ? 'border-ink bg-ink text-on-accent' : i === at ? 'border-accent bg-accent text-on-accent' : i < at ? 'border-accent/40 text-accent' : 'border-line text-faint'
                }`}
              >
                {sure === s.status ? 'Tap again' : s.name}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          disabled={busy || job.status === 'Unsuccessful'}
          onClick={() => move('Unsuccessful')}
          className={`mt-1.5 min-h-11 w-full rounded-sm border px-2 py-2 text-center text-[13.5px] ${
            sure === 'Unsuccessful' ? 'border-ink bg-ink text-on-accent' : job.status === 'Unsuccessful' ? 'border-ink bg-ink text-on-accent' : 'border-dashed border-line-strong text-faint'
          }`}
        >
          {sure === 'Unsuccessful' ? 'Tap again: unsuccessful' : job.status === 'Unsuccessful' ? 'Unsuccessful' : 'Unsuccessful (didn’t go ahead)'}
        </button>
        <p className="mt-3 flex items-center gap-1.5 font-mono text-[13px] text-muted">{text}</p>

        <div className="mt-4 grid gap-2">
          {st === 'new' ? (
            <button type="button" className="btn btn-primary btn-sm w-full" onClick={() => onMark({ quoteSentAt: Date.now() })}>
              I’ve sent the quote
            </button>
          ) : null}
          {(st === 'sent' || st === 'follow') && job.mobile ? (
            <a href={wa(job.mobile, followUp)} className={`btn btn-sm w-full ${st === 'follow' ? 'btn-whatsapp' : 'btn-ghost'}`} target="_blank" rel="noopener">
              Follow up on WhatsApp
            </a>
          ) : null}
          {(st === 'sent' || st === 'follow') && !job.quoteSent ? (
            <button type="button" className="h-9 text-[14px] text-muted underline" onClick={() => onMark({ quoteSentAt: undefined })}>
              Not sent yet after all{sentAt ? ` (marked ${day(sentAt)})` : ''}
            </button>
          ) : null}
          {job.status === 'Quote' ? (
            <>
              <button type="button" disabled={busy} className={`btn btn-sm w-full ${sure === 'Work Order' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => move('Work Order')}>
                {sure === 'Work Order' ? 'Tap again: Work Order' : 'They said yes: move to Work Order'}
              </button>
            </>
          ) : null}
          {job.status === 'Work Order' ? (
            <button type="button" disabled={busy} className={`btn btn-sm w-full ${sure === 'Completed' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => move('Completed')}>
              {sure === 'Completed' ? 'Tap again: Completed' : 'Job finished: move to Completed'}
            </button>
          ) : null}
          {job.status === 'Completed' ? (
            <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => onMark({ hidden: true })}>
              Done with it: hide from the list
            </button>
          ) : null}
          {job.status === 'Unsuccessful' ? (
            <>
              <p className="text-[14.5px] leading-relaxed text-muted">Folded away under Current jobs for {LOST_DAYS} days in case they come back, then it drops off the Job Kit. ServiceM8 keeps it under Unsuccessful.</p>
              <button type="button" disabled={busy} className="btn btn-ghost btn-sm w-full" onClick={() => move('Quote', false)}>
                They came back: back to Quote
              </button>
            </>
          ) : null}
        </div>
        <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">Moving a job here moves it in ServiceM8 too. Nothing is ever deleted there.</p>
      </section>

      <BookingsBox job={job} bookings={bookings} staff={staff} loaded={bookingsLoaded} onBook={onBook} onMove={onMove} onCancel={onCancel} />

      <MoneyBox job={job} />

      <section className="mt-6 grid gap-3">
        <h2 className="text-[19px] font-[650]">From here</h2>
        {design ? (
          <button type="button" className="btn btn-ghost w-full" onClick={() => onOpenKit(design)}>
            Open the design ({linked(job, kit, designs, done).chips.find((c) => c.startsWith('Design'))?.toLowerCase().replace('design ', '')})
          </button>
        ) : (
          <button type="button" className="btn btn-ghost w-full" onClick={onDesign}>
            Make a 3D design for them
          </button>
        )}
        {kitJob ? (
          <button type="button" className="btn btn-ghost w-full" onClick={() => onOpenKit(kitJob)}>
            Open the Job Kit job
          </button>
        ) : (
          <button type="button" className="btn btn-ghost w-full" onClick={onKit}>
            Start the Job Kit (photos for the website)
          </button>
        )}
      </section>
    </div>
  );
}

/* What the job is worth and what has come in, as ServiceM8 has it. */
function MoneyBox({ job }: { job: CurrentJob }) {
  const { total, paid, left, payments } = moneyOf(job);
  const quote = job.status === 'Quote' || job.status === 'Unsuccessful';
  if (total === null && !payments?.length) return null;
  return (
    <section className="mt-6 rounded-sm border border-line-strong bg-mount p-4">
      <h2 className="text-[19px] font-[650]">Money</h2>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className={label}>{quote ? 'Quote' : 'Total'}</dt>
          <dd className="mt-0.5 font-mono text-[17px]">{total === null ? '?' : gbp(total)}</dd>
        </div>
        {!quote ? (
          <>
            <div>
              <dt className={label}>Paid</dt>
              <dd className="mt-0.5 font-mono text-[17px]">{payments === null && !job.paid ? '?' : gbp(job.paid && total !== null ? Math.max(paid, total) : paid)}</dd>
            </div>
            <div>
              <dt className={label}>Left</dt>
              <dd className={`mt-0.5 font-mono text-[17px] ${left ? 'font-semibold' : ''}`}>{left === null || (payments === null && !job.paid) ? '?' : gbp(left)}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {payments?.length ? (
        <ul className="mt-3 grid gap-1 border-t border-line pt-3 font-mono text-[13px] text-muted">
          {payments.map((p, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {p.date ? day(parse(p.date)) : 'Payment'}
                {p.method ? ` · ${p.method}` : ''}
                {p.deposit ? ' · deposit' : ''}
              </span>
              <span className="text-ink">{gbp(p.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">
        {payments === null && !job.paid
          ? 'ServiceM8 didn’t send the payments this time; Refresh to try again.'
          : job.paid
            ? 'ServiceM8 has it as paid in full.'
            : quote
              ? 'The quote total as ServiceM8 has it.'
              : `As ServiceM8 has it${job.invoiceSent ? ', invoice sent' : ''}. Payments are added in ServiceM8.`}
      </p>
    </section>
  );
}

/* ---------- a new enquiry ---------- */

export function NewEnquiry({ onCancel, onCreate }: { onCancel: () => void; onCreate: (e: Enquiry) => Promise<string> }) {
  // What's typed is kept on the phone until it reaches ServiceM8, so no signal never loses an enquiry.
  const [e, setE] = useState<Enquiry>(() => read<Enquiry>(DRAFT_KEY, { name: '', mobile: '', email: '', address: '', description: '' }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Enquiry, v: string) => {
    const next = { ...e, [k]: v };
    setE(next);
    write(DRAFT_KEY, next);
  };
  return (
    <form
      className="pt-7"
      onSubmit={(ev) => {
        ev.preventDefault();
        setTried(true);
        if (!e.name.trim() || !e.description.trim()) {
          if (!e.name.trim()) nameRef.current?.focus();
          return;
        }
        setBusy(true);
        setProblem('');
        void onCreate(e).then((err) => {
          setBusy(false);
          if (err) setProblem(err);
          else
            try {
              localStorage.removeItem(DRAFT_KEY);
            } catch {
              /* no storage */
            }
        });
      }}
    >
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">New enquiry</h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">It goes straight into ServiceM8 as a new client and a Quote job, ready for the quote and the invoice later.</p>
      <div className="mt-6 grid gap-5">
        <label className="grid gap-1.5">
          <span className={label}>Name</span>
          <input ref={nameRef} className={`${field} h-12 ${tried && !e.name.trim() ? 'border-ink' : ''}`} value={e.name} onChange={(x) => set('name', x.target.value)} placeholder="e.g. Sarah Jones" autoCapitalize="words" autoComplete="off" />
          {tried && !e.name.trim() ? <Missing>Type their name.</Missing> : null}
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Mobile</span>
          <input className={`${field} h-12 font-mono`} type="tel" inputMode="tel" autoComplete="off" value={e.mobile} onChange={(x) => set('mobile', x.target.value)} placeholder="07…" />
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Email (optional)</span>
          <input className={`${field} h-12`} type="email" inputMode="email" autoComplete="off" autoCapitalize="off" value={e.email} onChange={(x) => set('email', x.target.value)} placeholder="name@…" />
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Address</span>
          <textarea className={`${field} min-h-[76px] py-2.5 leading-snug`} rows={2} value={e.address} onChange={(x) => set('address', x.target.value)} placeholder="House, street, town, postcode" autoComplete="off" />
        </label>
        <div className="grid gap-1.5">
          <TalkBox value={e.description} onChange={(v) => set('description', v)} hint="What they want, in your words: the room, sizes if you have them, when, budget if they said. This becomes the job description in ServiceM8." />
          {tried && !e.description.trim() ? <Missing>Say or type what they want.</Missing> : null}
        </div>
      </div>
      {problem ? (
        <p role="alert" className="mt-5 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem} What you typed is kept on this phone; try again when there’s signal.
        </p>
      ) : null}
      <div className="mt-8 flex gap-3">
        <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
          {busy ? 'Adding to ServiceM8…' : 'Add to ServiceM8'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- the morning summary ---------- */

export type TodayLine = { text: string; go: 'current' | 'designs' | 'posts' | 'jobs' | 'diary' | 'sm8'; urgent?: boolean; id?: string; time?: string; icon?: IconName };

export function todayLines({
  sm8,
  marks,
  kit,
  designs,
  done,
  postsLeft,
}: {
  sm8: Sm8;
  marks: Marks;
  kit: Job[];
  designs: DesignsReady;
  done: Record<string, { slug: string }>;
  postsLeft: number;
}): TodayLine[] {
  const lines: TodayLine[] = [];
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  // The day's bookings first, each with its time; then tomorrow in one line.
  const today = localDay();
  const all = sm8.bookings ?? [];
  const byUuid = new Map(sm8.jobs.map((j) => [j.uuid, j]));
  const who = (b: Booking) => {
    const j = byUuid.get(b.jobUuid);
    return `${kindOf(j)}: ${j?.name ?? 'a job'}${j?.area ? `, ${j.area}` : ''}`;
  };
  const now = all.filter((b) => bookingsOn([b], today).length && (b.end ?? b.start) >= `${today}T${new Date().toTimeString().slice(0, 5)}`);
  for (const b of now.slice(0, 4)) lines.push({ text: who(b), go: 'sm8', id: b.jobUuid, time: b.start.slice(0, 10) === today ? hm(b.start) : 'Today' });
  if (now.length > 4) lines.push({ text: `${now.length - 4} more today`, go: 'diary' });
  const tomorrow = bookingsOn(all, addDays(today, 1));
  if (tomorrow.length === 1) lines.push({ text: `Tomorrow ${hm(tomorrow[0].start)}, ${who(tomorrow[0])}`, go: 'sm8', id: tomorrow[0].jobUuid });
  else if (tomorrow.length) lines.push({ text: `Tomorrow: ${tomorrow.length} bookings, first at ${hm(tomorrow[0].start)}`, go: 'diary' });
  const list = shown(sm8, marks);
  const stages = list.map((j) => stage(j, marks));
  const fresh = stages.filter((s) => s === 'new').length;
  const follow = stages.filter((s) => s === 'follow').length;
  const going = stages.filter((s) => s === 'going').length;
  if (fresh) lines.push({ text: `${n(fresh, 'new enquiry', 'new enquiries')} to quote`, go: 'current', urgent: true });
  if (follow) lines.push({ text: `${n(follow, 'quote', 'quotes')} to follow up`, go: 'current', urgent: true });
  const designJobs = kit.filter((k) => k.kind === 'design');
  const toSend = designJobs.filter((d) => designState(d, designs[d.id]) === 'ready' && !(d.sharedAt && d.sharedAt >= Date.parse(designs[d.id]?.updatedFor ?? '')));
  const making = designJobs.filter((d) => ['waiting', 'sending', 'updating'].includes(designState(d, designs[d.id])));
  if (toSend.length) lines.push({ text: `${n(toSend.length, 'design', 'designs')} ready to send`, go: 'designs', urgent: true });
  if (making.length) lines.push({ text: `${n(making.length, 'design', 'designs')} being made`, go: 'designs' });
  // Completed in ServiceM8 but not fully paid (the last 30 days ServiceM8 sends).
  const owing = list.filter((j) => j.status === 'Completed' && (moneyOf(j).left ?? 0) > 0 && moneyOf(j).payments !== null);
  if (owing.length) {
    const sum = owing.reduce((s, j) => s + (moneyOf(j).left ?? 0), 0);
    lines.push({ text: `${gbp(sum)} left to collect on ${n(owing.length, 'completed job', 'completed jobs')}`, go: 'current', urgent: true, icon: 'money' });
  }
  if (going) lines.push({ text: `${n(going, 'job', 'jobs')} on Work Order`, go: 'current' });
  const photoJobs = kit.filter((k) => k.kind !== 'design');
  const waitingPage = photoJobs.filter((k) => k.readyAt && !done[k.id]).length;
  const open = photoJobs.filter((k) => !k.readyAt).length;
  if (open) lines.push({ text: `${n(open, 'Job Kit job', 'Job Kit jobs')} still open`, go: 'jobs' });
  if (waitingPage) lines.push({ text: `${n(waitingPage, 'job', 'jobs')} waiting for the website page`, go: 'jobs' });
  if (postsLeft) lines.push({ text: `${n(postsLeft, 'post', 'posts')} to post`, go: 'posts' });
  return lines;
}
