'use client';
import { useMemo, useRef, useState } from 'react';
import type { Booking, CurrentJob, Staff, Status } from '@/lib/servicem8';
import Mark from './mark';
import { parseBrief, stripInvisible } from './brief-paste';
import { Icon, type IconName } from './icons';
import { field, label, Missing, TalkBox } from './parts';
import type { DesignsReady } from './designs';
import { askWebsite, designState } from './designs';
import type { Job } from './store';
import { clock, post, problemText } from './sm8-post';
import { EmailBox } from './mail';
import { PropertyBox } from './property-box';
import { CustomerSearch, indexClients, personName, SameCustomer, type Client, type Clients } from './customers';
import { rowOf, rowWords, spanWords, timelineRows } from '@/lib/job-timeline';

export { problemText };

/* Current jobs: Raf's customers and jobs from ServiceM8 (where he quotes and invoices), read and moved on from
   the Job Kit through /api/job-kit/sm8 behind the PIN. The last list is kept on the phone (this phone only) so
   the morning screen opens at once and with no signal. Things ServiceM8 has no place for stay on the phone
   too: when a quote went out by WhatsApp, and finished jobs hidden from the list. */

export type { Booking, CurrentJob, Staff };
/* bookings: ServiceM8's schedule from two months back on (yesterday on until 19 Oct 2026, when the Job timeline needed
   the days a job has already had; the Diary and Today still start at today) (null: ServiceM8 didn't send it this
   time; missing in a list kept from before the diary existed). */
/* replies: job uuid -> the customer's newest email in the last 14 days (null: ServiceM8 won't let the account read
   emails; missing in a list kept from before). */
export type Sm8 = { jobs: CurrentJob[]; at: number; bookings?: Booking[] | null; staff?: Staff[]; replies?: Record<string, string> | null; error?: string; detail?: string };
/* mailSeen: the newest of their messages Raf has seen in the job's Emails and texts (London time);
   reviewAskedAt: when the review request went from the Job Kit; progress: how far along a job going ahead is, 0 to 100
   (Job timeline), and progressAt when that was set. */
export type Marks = Record<
  string,
  { quoteSentAt?: number; hidden?: boolean; mailSeen?: string; reviewAskedAt?: number; progress?: number; progressAt?: number; visitsDone?: string[] }
>;

/* Bookings marked Done in the Job Kit (19 Oct 2026, Raf: 'when visit is set add also done button that clears the
   booking'; visits first, then any booking): kept in the job's marks, by booking (and in step with the computer),
   so they leave the Diary, Today and the job's In the diary. ServiceM8 keeps the booking as it is, as the record
   that it happened; Cancel is still the way to take one out of ServiceM8's schedule. */
export const isVisitDone = (b: Booking, marks: Marks) => Boolean(marks[b.jobUuid]?.visitsDone?.includes(b.uuid));
export const withoutDone = (sm8: Sm8, marks: Marks): Sm8 => (sm8.bookings ? { ...sm8, bookings: sm8.bookings.filter((b) => !isVisitDone(b, marks)) } : sm8);
/* Done shows on any booking from the day it ends (a meeting can finish early, or be ticked off later): a visit on a
   Quote job, and since 19 Oct 2026 work and meetings on a Work Order or Completed job too (Raf: 'I have been to a
   meeting with Oscar and there is no button done which I could press and clear from diary'). A booking over several
   days gets it on its last day. */
const canDone = (b: Booking, today: string) => (b.end ?? b.start).slice(0, 10) <= today;
const doneWord = (j?: CurrentJob) => (kindOf(j) === 'Visit' ? 'Visit done' : 'Done');

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

/* The list, kept on the phone when it arrives. On failure the last list stays, with the reason. */
export async function fetchSm8(pin: string, before: Sm8): Promise<Sm8> {
  const r = await post<{ jobs: CurrentJob[]; at: number; bookings: Booking[] | null; staff: Staff[]; replies?: Record<string, string> | null }>(pin, { action: 'list' });
  if (!r.ok) return { ...before, error: r.error, detail: r.detail };
  const next: Sm8 = { jobs: r.data.jobs, at: r.data.at, bookings: r.data.bookings ?? null, staff: r.data.staff ?? [], replies: r.data.replies ?? null };
  write(LIST_KEY, next);
  return next;
}
export const keepSm8 = (s: Sm8) => write(LIST_KEY, { jobs: s.jobs, at: s.at, bookings: s.bookings, staff: s.staff, replies: s.replies });

/* An email or text from the customer that Raf hasn't opened the job's Emails and texts to see yet. */
export const newMail = (uuid: string, replies: Sm8['replies'], m: Marks) => {
  const at = replies?.[uuid];
  return Boolean(at && at > (m[uuid]?.mailSeen ?? ''));
};

/* client: put it on a customer already in ServiceM8 ("Yes, it's them"; clientName is only for showing it);
   newClient: "No, a different person", a uuid made here so a second try finds the same new client. */
export type Enquiry = { name: string; mobile: string; email: string; address: string; description: string; client?: string; clientName?: string; newClient?: string };
export const sendEnquiry = (pin: string, e: Enquiry) =>
  post<{ job: CurrentJob }>(pin, { action: 'enquiry', name: e.name, mobile: e.mobile, email: e.email, address: e.address, description: e.description, client: e.client, newClient: e.newClient });
export const sendStatus = (pin: string, uuid: string, status: Status) => post<{ ok: true }>(pin, { action: 'status', uuid, status });
export const sendBooking = (pin: string, b: { job: string; start: string; end: string; staff?: string }) => post<{ booking: Booking }>(pin, { action: 'book', ...b });
export const sendMove = (pin: string, uuid: string, start: string, end: string) => post<{ ok: true }>(pin, { action: 'move', uuid, start, end });
export const sendCancel = (pin: string, uuid: string) => post<{ ok: true }>(pin, { action: 'cancel', uuid });

/* ---------- reading a job ---------- */

const parse = (s: string | null) => (s ? Date.parse(s) : NaN);
const DAY = 864e5;
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
export function moneyLine(j: CurrentJob) {
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
export const wa = (mobile: string, text: string) => `https://wa.me/${intl(mobile)}?text=${encodeURIComponent(text)}`;

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
/* The WhatsApp line that tells the customer a booking is off (Diary, after Cancel). */
export function cancelText(j: CurrentJob, b: Booking) {
  const when = `${longDay(b.start.slice(0, 10))} at ${hm(b.start)}`;
  return kindOf(j) === 'Visit'
    ? `Hi ${j.first}, sorry, I need to cancel my visit ${when}. When else would suit you?\nRaf`
    : `Hi ${j.first}, sorry, I can't make it ${when}. I'll be in touch to rearrange.\nRaf`;
}
const maps = (address: string) => `https://maps.apple.com/?daddr=${encodeURIComponent(address.replace(/\s*\n\s*/g, ', '))}`;
/* Waze (20 Oct 2026, Raf: 'if there is a visit booked and there is an address present add ... button ... waze to open
   directly in waze to navigate'). On a phone waze:// opens the Waze app straight away, already driving there (Waze's
   https link would go through an in-app browser from the home-screen app first); on a computer Waze's web link shows
   the route on its live map in a new tab. Waze searches the address and drives to the first result, so the postcode
   in the job's address matters. */
const onPhone = () =>
  typeof navigator !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const waze = (address: string, phone = onPhone()) => {
  const q = encodeURIComponent(address.replace(/\s*\n\s*/g, ', ').trim());
  return phone ? `waze://?q=${q}&navigate=yes` : `https://www.waze.com/ul?q=${q}&navigate=yes`;
};
export function WazeLink({ address }: { address: string }) {
  const phone = onPhone();
  return (
    <a href={waze(address, phone)} className="flex h-10 items-center gap-1.5 font-semibold text-accent underline" {...(phone ? {} : { target: '_blank', rel: 'noopener' })}>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" className="shrink-0">
        <path d="M20.5 3.5 3.5 10.6l7.1 2.8 2.8 7.1z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      </svg>
      Waze
    </a>
  );
}
/* A booking's end for putting it back (ServiceM8 can send one with no end: an hour). */
const endOf = (b: Booking) => {
  if (b.end && b.end > b.start) return b.end;
  const t = new Date(Date.parse(`${b.start}:00`) + 60 * 60000);
  return `${localDay(t)}T${t.toTimeString().slice(0, 5)}`;
};

/* Cancel in the Diary (18 Oct 2026, Raf: 'add to jobkit in diary in a visit option to cancel so I don't have to go
   to service m8 and do it'): Cancel on every booking, tapped twice (the second tap within 5 seconds), takes it out of
   ServiceM8's schedule. A note stays where it was, with Tell <first> on WhatsApp and Undo (books the same times
   again). */
export function Diary({
  sm8,
  loading,
  onRefresh,
  onOpen,
  onCancel,
  onRebook,
  onDone,
}: {
  sm8: Sm8; // without the visits already marked done
  loading: boolean;
  onRefresh: () => void;
  onOpen: (uuid: string) => void;
  onCancel: (uuid: string) => Promise<string>;
  onRebook: (jobUuid: string, start: string, end: string, staff?: string) => Promise<string>;
  onDone: (b: Booking, done: boolean) => void; // mark a visit done (true) or put it back (false)
}) {
  const today = localDay();
  const now = `${today}T${new Date().toTimeString().slice(0, 5)}`;
  const [sure, setSure] = useState('');
  const [busy, setBusy] = useState('');
  const [fault, setFault] = useState<{ uuid: string; text: string } | null>(null);
  const [gone, setGone] = useState<Booking[]>([]);
  const [ticked, setTicked] = useState<Booking[]>([]); // visits marked done while the Diary is open
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const list = (sm8.bookings ?? []).filter((b) => (b.end ?? b.start).slice(0, 10) >= today);
  // a cancelled one's note sits on the first day it showed on
  const noteDay = (b: Booking) => (b.start.slice(0, 10) > today ? b.start.slice(0, 10) : today);
  const done = (b: Booking) => {
    onDone(b, true);
    setTicked((t) => [...t.filter((x) => x.uuid !== b.uuid), b]);
  };
  const last = [...list, ...gone].reduce((k, b) => ((b.end ?? b.start).slice(0, 10) > k ? (b.end ?? b.start).slice(0, 10) : k), addDays(today, 1));
  const days: string[] = [];
  for (let k = today; k <= last && days.length < 120; k = addDays(k, 1))
    if (k === today || k === addDays(today, 1) || bookingsOn(list, k).length || [...gone, ...ticked].some((b) => noteDay(b) === k)) days.push(k);
  const byUuid = new Map(sm8.jobs.map((j) => [j.uuid, j]));
  const staffName = new Map((sm8.staff ?? []).map((s) => [s.uuid, s.name]));
  const manyStaff = (sm8.staff ?? []).length > 1;
  const problem = problemText(sm8.error, sm8.detail, sm8.at);
  const daysLong = (b: Booking) => (b.end ? Math.round((Date.parse(`${b.end.slice(0, 10)}T12:00`) - Date.parse(`${b.start.slice(0, 10)}T12:00`)) / DAY) + 1 : 1);
  const cancel = (b: Booking) => {
    if (disarm.current) clearTimeout(disarm.current);
    setFault(null);
    if (sure !== b.uuid) {
      setSure(b.uuid);
      disarm.current = setTimeout(() => setSure(''), 5000);
      return;
    }
    setSure('');
    setBusy(b.uuid);
    void onCancel(b.uuid).then((err) => {
      setBusy('');
      if (err) setFault({ uuid: b.uuid, text: err });
      else setGone((g) => [...g.filter((x) => x.uuid !== b.uuid), b]);
    });
  };
  const undo = (b: Booking) => {
    setFault(null);
    setBusy(b.uuid);
    void onRebook(b.jobUuid, b.start, endOf(b), manyStaff ? b.staffUuid : undefined).then((err) => {
      setBusy('');
      if (err) setFault({ uuid: b.uuid, text: err });
      else setGone((g) => g.filter((x) => x.uuid !== b.uuid));
    });
  };
  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="diary" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
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
        const notes = gone.filter((b) => noteDay(b) === k);
        const doneHere = ticked.filter((b) => noteDay(b) === k);
        const isToday = k === today;
        return (
          <section key={k} className="mt-7">
            <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">
              {dayLabel(k)}
              {isToday || dayLabel(k) === 'Tomorrow' ? `, ${new Date(`${k}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}
            </h2>
            {notes.length ? (
              <ul className="mt-2.5 grid grid-cols-1 gap-3">
                {notes.map((b) => {
                  const j = byUuid.get(b.jobUuid);
                  return (
                    <li key={`gone-${b.uuid}`} role="status" className="rounded-sm border border-dashed border-line-strong px-3.5 py-3">
                      <p className="text-[15px] leading-snug">
                        <span className="font-semibold">Cancelled in ServiceM8:</span> {kindOf(j)}, {spanText(b, b.start.slice(0, 10))}
                        {b.start.slice(0, 10) !== k ? ` ${dayLabel(b.start.slice(0, 10))}` : ''}, {j?.name ?? 'a job'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-[14.5px]">
                        {j?.mobile ? (
                          <a href={wa(j.mobile, cancelText(j, b))} className="flex h-10 items-center text-accent underline" target="_blank" rel="noopener">
                            Tell {j.first || 'them'} on WhatsApp
                          </a>
                        ) : null}
                        <button type="button" className="h-10 text-accent underline" disabled={!!busy} onClick={() => undo(b)}>
                          {busy === b.uuid ? 'Putting it back…' : 'Undo'}
                        </button>
                        <button type="button" className="h-10 text-muted underline" onClick={() => setGone((g) => g.filter((x) => x.uuid !== b.uuid))}>
                          Hide
                        </button>
                      </div>
                      {fault?.uuid === b.uuid ? (
                        <p role="alert" className="mt-1 text-[14px] leading-relaxed text-ink">
                          {fault.text}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {doneHere.length ? (
              <ul className="mt-2.5 grid grid-cols-1 gap-3">
                {doneHere.map((b) => {
                  const j = byUuid.get(b.jobUuid);
                  return (
                    <li key={`done-${b.uuid}`} role="status" className="rounded-sm border border-dashed border-line-strong px-3.5 py-3">
                      <p className="flex items-start gap-2 text-[15px] leading-snug">
                        <Mark state="sent" />
                        <span>
                          <span className="font-semibold">{doneWord(j)}:</span> {spanText(b, b.start.slice(0, 10))}, {j?.name ?? 'a job'}
                        </span>
                      </p>
                      <p className="mt-0.5 pl-6 text-[13.5px] leading-snug text-faint">Off your Diary. ServiceM8 keeps the booking as it is.</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 pl-6 text-[14.5px]">
                        <button type="button" className="h-10 text-accent underline" onClick={() => onOpen(b.jobUuid)}>
                          {j?.status === 'Quote' ? 'Open the job for the quote' : 'Open the job'}
                        </button>
                        <button
                          type="button"
                          className="h-10 text-accent underline"
                          onClick={() => {
                            onDone(b, false);
                            setTicked((t) => t.filter((x) => x.uuid !== b.uuid));
                          }}
                        >
                          Undo
                        </button>
                        <button type="button" className="h-10 text-muted underline" onClick={() => setTicked((t) => t.filter((x) => x.uuid !== b.uuid))}>
                          Hide
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {on.length ? (
              <ul className="mt-2.5 grid grid-cols-1 gap-3">
                {on.map((b) => {
                  const j = byUuid.get(b.jobUuid);
                  const kind = kindOf(j);
                  const contact = j?.mobile || j?.phone;
                  return (
                    <li key={`${b.uuid}-${k}`} data-jk-id={b.jobUuid} className="rounded-sm border border-line-strong bg-mount">
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
                      {canDone(b, today) ? (
                        <div className="border-t border-line px-3.5 py-2.5">
                          <button type="button" className="btn btn-ghost btn-sm w-full gap-2 bg-paper" disabled={!!busy} onClick={() => done(b)}>
                            <Mark state="sent" /> {doneWord(j)}
                          </button>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-x-4 border-t border-line px-3.5 py-0.5 text-[14.5px]">
                        {j?.address && endOf(b) > now ? <WazeLink address={j.address} /> : null}
                        {isToday && j?.address ? (
                          <a href={maps(j.address)} className="flex h-10 items-center text-accent underline" target="_blank" rel="noopener">
                            Maps
                          </a>
                        ) : null}
                        {isToday && j?.mobile ? (
                          <a href={wa(j.mobile, `Hi ${j.first}, I'm on my way.\nRaf`)} className="flex h-10 items-center text-accent underline" target="_blank" rel="noopener">
                            On my way
                          </a>
                        ) : null}
                        {isToday && contact ? (
                          <a href={`tel:${contact.replace(/\s+/g, '')}`} className="flex h-10 items-center text-accent underline">
                            Call
                          </a>
                        ) : null}
                        {endOf(b) > now ? (
                        <button
                          type="button"
                          className={`ml-auto h-10 underline ${sure === b.uuid ? 'font-semibold text-ink' : 'text-muted'}`}
                          disabled={!!busy}
                          onClick={() => cancel(b)}
                        >
                          {busy === b.uuid
                            ? 'Cancelling…'
                            : sure === b.uuid
                              ? daysLong(b) > 1
                                ? `Tap again to cancel all ${daysLong(b)} days`
                                : 'Tap again to cancel it'
                              : 'Cancel'}
                        </button>
                        ) : null}
                      </div>
                      {fault?.uuid === b.uuid ? (
                        <p role="alert" className="border-t border-line px-3.5 py-2 text-[14px] leading-relaxed">
                          {fault.text}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : doneHere.length ? null : (
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
  onDone,
}: {
  job: CurrentJob;
  bookings: Booking[]; // without the visits already marked done
  staff: Staff[];
  loaded: boolean;
  onBook: (start: string, end: string, staff?: string) => Promise<string>;
  onMove: (uuid: string, start: string, end: string) => Promise<string>;
  onCancel: (uuid: string) => Promise<string>;
  onDone?: (b: Booking, done: boolean) => void;
}) {
  const kind = kindOf(job);
  const [ticked, setTicked] = useState<Booking | null>(null); // the visit just marked done, for Undo
  const today = localDay();
  const now = `${today}T${new Date().toTimeString().slice(0, 5)}`;
  // still to come, and today's bookings until they're marked done
  const upcoming = bookings.filter((b) => (b.end ?? b.start) >= now || (onDone && canDone(b, today) && (b.end ?? b.start).slice(0, 10) === today));
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
      {ticked ? (
        <p role="status" className="mt-2 flex flex-wrap items-center gap-x-3 text-[14.5px] leading-relaxed text-muted">
          <span className="flex items-center gap-1.5">
            <Mark state="sent" /> {doneWord(job)} ({spanText(ticked, ticked.start.slice(0, 10))}), off your Diary.
          </span>
          <button
            type="button"
            className="h-10 text-accent underline"
            onClick={() => {
              onDone?.(ticked, false);
              setTicked(null);
            }}
          >
            Undo
          </button>
        </p>
      ) : null}
      {loaded && !upcoming.length && !form && !ticked ? <p className="mt-2 text-[14.5px] text-muted">Nothing booked for this job in ServiceM8.</p> : null}
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
                {job.address && endOf(b) > now ? <WazeLink address={job.address} /> : null}
                {job.mobile ? (
                  <a href={wa(job.mobile, confirmText(job, b))} className="flex h-10 items-center text-accent underline" target="_blank" rel="noopener">
                    Confirm on WhatsApp
                  </a>
                ) : null}
                {onDone && canDone(b, today) ? (
                  <button
                    type="button"
                    className="flex h-10 items-center gap-1.5 font-semibold text-accent underline"
                    disabled={busy}
                    onClick={() => {
                      onDone(b, true);
                      setTicked(b);
                    }}
                  >
                    <Mark state="sent" /> Done
                  </button>
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

function Card({
  j,
  marks,
  kit,
  designs,
  done,
  replies,
  onOpen,
}: {
  j: CurrentJob;
  marks: Marks;
  kit: Job[];
  designs: DesignsReady;
  done: Record<string, { slug: string }>;
  replies: Sm8['replies'];
  onOpen: (uuid: string) => void;
}) {
  const [text, mark] = stageText(j, marks);
  const { chips } = linked(j, kit, designs, done);
  const fresh = newMail(j.uuid, replies, marks);
  const money = moneyLine(j);
  const owed = j.status === 'Completed' && (moneyOf(j).left ?? 0) > 0;
  return (
    <li>
      <button type="button" data-jk-id={j.uuid} onClick={() => onOpen(j.uuid)} className="block w-full rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-left transition-colors hover:border-ink">
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
        {chips.length || fresh ? (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {fresh ? <span className="rounded-sm border border-accent bg-accent px-1.5 py-0.5 font-mono text-[11.5px] text-on-accent">New message</span> : null}
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
  clients,
  clientsLoading,
  onFindNeed,
  onFindRefresh,
  onCustomer,
  onNewNamed,
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
  clients: Clients;
  clientsLoading: boolean;
  onFindNeed: () => void;
  onFindRefresh: () => void;
  onCustomer: (uuid: string) => void;
  onNewNamed: (name: string) => void;
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
        <Icon name="jobs" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
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
      <CustomerSearch place="current" clients={clients} jobs={sm8.jobs} loading={clientsLoading} onNeed={onFindNeed} onRefresh={onFindRefresh} onOpen={onCustomer} onNewNamed={onNewNamed} />
      <button type="button" onClick={onNew} className="btn btn-primary mt-4 w-full">
        New enquiry
      </button>

      {!sm8.at && !problem ? <p className="mt-7 font-mono text-[13.5px] text-faint">{loading ? 'Getting your jobs from ServiceM8…' : 'Nothing yet.'}</p> : null}
      {groups.map(([title, js]) =>
        js.length ? (
          <section key={title} className="mt-7">
            <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">
              {title} ({js.length})
            </h2>
            <ul className="mt-2.5 grid grid-cols-1 gap-3">
              {js.map((j) => (
                <Card key={j.uuid} j={j} marks={marks} kit={kit} designs={designs} done={done} replies={sm8.replies} onOpen={onOpen} />
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
                  <Card key={j.uuid} j={j} marks={marks} kit={kit} designs={designs} done={done} replies={sm8.replies} onOpen={onOpen} />
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
  onLibrary,
  onKit,
  onTimeline,
  extra,
  onOpenKit,
  bookings,
  staff,
  bookingsLoaded,
  onBook,
  onMove,
  onCancel,
  replyAt,
  onCustomer,
  info,
}: {
  job: CurrentJob;
  marks: Marks;
  kit: Job[];
  designs: DesignsReady;
  done: Record<string, { slug: string }>;
  onStatus: (s: Status) => Promise<void>;
  onMark: (patch: Marks[string]) => void;
  onDesign: () => void;
  onLibrary: () => void;
  onKit: () => void;
  onTimeline?: () => void; // the Job timeline, this job's sheet open
  extra?: React.ReactNode; // after Where it's up to: the WhatsApp chat it came from (whatsapp.tsx WaJobBox)
  onOpenKit: (k: Job) => void;
  bookings: Booking[];
  staff: Staff[];
  bookingsLoaded: boolean;
  onBook: (start: string, end: string, staff?: string) => Promise<string>;
  onMove: (uuid: string, start: string, end: string) => Promise<string>;
  onCancel: (uuid: string) => Promise<string>;
  replyAt?: string; // their newest email, from the list
  onCustomer?: () => void; // everything for this customer in ServiceM8
  info?: { line: string; subject: string; open: () => void }; // their latest email in the info@ Inbox
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
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            // Down to the job's emails (a button, not a #link: the app keeps its screens in the history).
            document.getElementById('emails')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          Email or text{newMail(job.uuid, replyAt ? { [job.uuid]: replyAt } : null, marks) ? ' (new)' : ''}
        </button>
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
        {job.status === 'Work Order' && onTimeline ? (
          (() => {
            // On the Job timeline: its dates and how far along, or a nudge to set them.
            const row = rowOf(job, bookings, marks);
            return (
              <button type="button" onClick={onTimeline} className="jk-sec-timeline mt-2.5 flex w-full items-center gap-2.5 rounded-sm border border-line-strong bg-paper px-3 py-2.5 text-left">
                <Icon name="gantt" className="h-5 w-5 shrink-0 jk-sec-ink" />
                <span className="min-w-0 flex-1 text-[14.5px] leading-snug">
                  <span className="block font-semibold">{row ? `${spanWords(row.start, row.end)}` : 'Set its start and finish'}</span>
                  <span className="block text-muted">{row ? rowWords(row) : 'On the Job timeline, saved in ServiceM8'}</span>
                </span>
                <span aria-hidden className="jk-sec-ink">
                  →
                </span>
              </button>
            );
          })()
        ) : null}

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
            <>
              <button
                type="button"
                className={`btn btn-sm w-full ${marks[job.uuid]?.reviewAskedAt ? 'btn-ghost' : 'btn-primary'}`}
                onClick={() => document.getElementById('emails')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {marks[job.uuid]?.reviewAskedAt ? 'Review asked: see it in Emails and texts' : 'Ask for a Google review'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => onMark({ hidden: true })}>
                Done with it: hide from the list
              </button>
            </>
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

      {extra}

      <PropertyBox job={job} />

      <BookingsBox
        job={job}
        bookings={bookings}
        staff={staff}
        loaded={bookingsLoaded}
        onBook={onBook}
        onMove={onMove}
        onCancel={onCancel}
        onDone={(b, d) => {
          const was = (marks[job.uuid]?.visitsDone ?? []).filter((x) => x !== b.uuid);
          onMark({ visitsDone: d ? [...was, b.uuid] : was });
        }}
      />

      <EmailBox
        job={job}
        what={job.description ? whatOf(job.description) : ''}
        replyAt={replyAt}
        onSeen={(at) => {
          if (at > (marks[job.uuid]?.mailSeen ?? '')) onMark({ mailSeen: at });
        }}
        review={job.status === 'Completed' ? { askedAt: marks[job.uuid]?.reviewAskedAt, onAsked: () => onMark({ reviewAskedAt: Date.now() }) } : undefined}
        info={info}
      />

      <MoneyBox job={job} />

      {/* Long labels wrap instead of pushing a 320 px screen sideways. */}
      <section className="mt-6 grid gap-3 [&_.btn]:h-auto [&_.btn]:min-h-[52px] [&_.btn]:whitespace-normal [&_.btn]:py-3 [&_.btn]:text-center [&_.btn]:leading-snug">
        <h2 className="text-[19px] font-[650]">From here</h2>
        {onCustomer ? (
          <button type="button" className="btn btn-ghost w-full" onClick={onCustomer}>
            All jobs for {job.name}
          </button>
        ) : null}
        {design ? (
          <button type="button" className="btn btn-ghost w-full" onClick={() => onOpenKit(design)}>
            Open the design ({linked(job, kit, designs, done).chips.find((c) => c.startsWith('Design'))?.toLowerCase().replace('design ', '')})
          </button>
        ) : (
          <button type="button" className="btn btn-ghost w-full" onClick={onDesign}>
            Make a 3D design for them
          </button>
        )}
        <button type="button" className="btn btn-ghost w-full" onClick={onLibrary}>
          Send them a design from the library
        </button>
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

const BLANK: Enquiry = { name: '', mobile: '', email: '', address: '', description: '' };
const newUuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === 'x' ? 0 : 8)).toString(16).slice(-1));
/* A new enquiry filled in from a customer already in ServiceM8 (New enquiry for ... on their page). */
function fromClient(c: Client): Enquiry {
  const p = c.people.find((x) => x.mobile) ?? c.people[0];
  const email = p?.email || c.people.find((x) => x.email)?.email || '';
  return { ...BLANK, name: (p && personName(p)) || c.name, mobile: p?.mobile || p?.phone || '', email, address: c.address, client: c.uuid, clientName: c.name };
}

export function NewEnquiry({
  onCancel,
  onCreate,
  clients = [],
  forClient,
  named,
  seed,
  seedFrom = 'email',
  onCustomer,
}: {
  onCancel: () => void;
  onCreate: (e: Enquiry) => Promise<string>;
  clients?: Client[]; // ServiceM8's customers (with the current jobs'), for "Already a customer?"
  forClient?: Client; // started from a customer's page
  named?: string; // started from a search that found nobody
  seed?: Enquiry; // started from an email in the Inbox (inbox.tsx enquiryFromMail) or a WhatsApp chat (whatsapp.tsx enquiryFromChat)
  seedFrom?: 'email' | 'whatsapp';
  onCustomer?: (uuid: string) => void;
}) {
  // What's typed is kept on the phone until it reaches ServiceM8, so no signal never loses an enquiry.
  const [e, setE] = useState<Enquiry>(() => {
    const d = read<Enquiry>(DRAFT_KEY, BLANK);
    const empty = !d.name.trim() && !d.description.trim() && !d.mobile.trim();
    if (forClient && empty) return fromClient(forClient);
    if (named && empty) return { ...BLANK, name: named };
    if (seed && empty) return seed;
    return d;
  });
  // An unsent enquiry for someone else is never thrown away without asking.
  const clash = forClient && e.client !== forClient.uuid && (e.name.trim() || e.description.trim()) ? forClient : undefined;
  const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const clashSeed = !clash && seed && (e.name.trim() || e.description.trim()) && !sameEmail(e.email, seed.email) && e.description !== seed.description ? seed : undefined;
  const index = useMemo(() => indexClients(clients), [clients]);
  const picked: Client | undefined = e.client ? (clients.find((c) => c.uuid === e.client) ?? (forClient?.uuid === e.client ? forClient : { uuid: e.client, name: e.clientName || e.name, address: '', people: [], edited: null })) : undefined;
  const pick = (c: Client | undefined) => {
    if (!c) return update({ ...e, client: undefined, clientName: undefined });
    // Their details fill whatever is still empty; nothing typed is changed.
    const f = fromClient(c);
    update({ ...e, client: c.uuid, clientName: c.name, newClient: undefined, mobile: e.mobile || f.mobile, email: e.email || f.email, address: e.address || f.address });
  };
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const update = (next: Enquiry) => {
    setE(next);
    write(DRAFT_KEY, next);
  };
  const set = (k: 'name' | 'mobile' | 'email' | 'address' | 'description', v: string) => update({ ...e, [k]: stripInvisible(v) });
  // A brief from the website (or any WhatsApp message) pasted in fills the boxes; Raf checks them and sends.
  const [pasted, setPasted] = useState('');
  const [filled, setFilled] = useState<string[] | null>(null);
  const [pasteHint, setPasteHint] = useState(false);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const lastBrief = useRef('');
  const fillFrom = (raw: string) => {
    const b = parseBrief(raw);
    if (!raw.trim()) return;
    const mine = e.description.trim();
    const description = !mine || mine === lastBrief.current ? b.description : `${mine}\n\n${b.description}`;
    lastBrief.current = b.description;
    update({ ...e, name: b.name || e.name, mobile: b.mobile || e.mobile, email: b.email || e.email, address: b.address || e.address, description });
    setFilled(b.found);
  };
  const pasteNow = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) {
        setPasted(t);
        fillFrom(t);
        return;
      }
    } catch {
      /* not allowed here: paste into the box instead */
    }
    setPasteHint(true);
    pasteRef.current?.focus();
  };
  const and = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] ?? '');
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
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">
        {picked ? `It goes into ServiceM8 as a new Quote job for ${picked.name}, ready for the quote and the invoice later.` : 'It goes straight into ServiceM8 as a new client and a Quote job, ready for the quote and the invoice later.'}
      </p>
      {clash ? (
        <div role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3.5 py-3">
          <p className="text-[15px] leading-relaxed">You have an enquiry that hasn’t gone to ServiceM8 yet{e.name.trim() ? ` for ${e.name.trim()}` : ''}. Send it first, or clear it.</p>
          <button type="button" className="btn btn-ghost btn-sm mt-2.5" onClick={() => update(fromClient(clash))}>
            Clear it and start one for {clash.name}
          </button>
        </div>
      ) : null}
      {clashSeed ? (
        <div role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3.5 py-3">
          <p className="text-[15px] leading-relaxed">You have an enquiry that hasn’t gone to ServiceM8 yet{e.name.trim() ? ` for ${e.name.trim()}` : ''}. Send it first, or clear it.</p>
          <button type="button" className="btn btn-ghost btn-sm mt-2.5" onClick={() => update(clashSeed)}>
            Clear it and fill in from the {seedFrom === 'whatsapp' ? 'WhatsApp chat' : 'email'}
          </button>
        </div>
      ) : null}
      {seed && !clashSeed && sameEmail(e.email, seed.email) ? (
        <p className="mt-4 rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-[14.5px] leading-relaxed text-muted">
          {seedFrom === 'whatsapp'
            ? 'Filled in from the WhatsApp chat: check the name and the words, add their mobile if it’s missing, then Add to ServiceM8. The ticked photos and PDFs go into the job’s diary straight after.'
            : 'Filled in from the email: check the name, add their mobile if you have it, then Add to ServiceM8.'}
        </p>
      ) : null}

      <div className="mt-5 rounded-sm border border-accent bg-accent-soft px-4 py-3.5">
        <p className="font-semibold">Got their brief or message on WhatsApp?</p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-muted">In WhatsApp, press and hold the message and tap Copy. Then come back here.</p>
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => void pasteNow()}>
          Paste and fill in
        </button>
        <label className="mt-3 grid gap-1.5">
          <span className={label}>{pasteHint ? 'Press and hold in the box, then tap Paste' : 'Or paste it here'}</span>
          <textarea
            ref={pasteRef}
            className={`${field} min-h-[64px] py-2.5 text-[14.5px] leading-snug`}
            rows={2}
            value={pasted}
            placeholder="Hi Raf, this is…"
            onChange={(x) => setPasted(x.target.value)}
            onPaste={(ev) => {
              const t = ev.clipboardData.getData('text');
              if (!t) return;
              ev.preventDefault();
              setPasted(t);
              fillFrom(t);
            }}
          />
        </label>
        {pasted.trim() && !filled ? (
          <button type="button" className="mt-2 h-10 text-[14.5px] text-accent underline" onClick={() => fillFrom(pasted)}>
            Fill in from this
          </button>
        ) : null}
        {filled ? (
          <p role="status" className="mt-2 text-[14.5px] leading-relaxed">
            Filled in {and(filled)}.{' '}
            {!e.mobile.trim() ? 'Add their mobile: in WhatsApp tap their name at the top, then press and hold the number to copy it. ' : ''}
            Check the boxes below, then Add to ServiceM8.
          </p>
        ) : null}
      </div>

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
        <SameCustomer
          index={index}
          e={e}
          picked={picked}
          fresh={Boolean(e.newClient)}
          onPick={(c) => pick(c)}
          onUnpick={() => pick(undefined)}
          onFresh={(v) => update({ ...e, newClient: v ? newUuid() : undefined })}
          onOpen={onCustomer}
        />
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
          {problem} What you typed is kept on this phone, so you can try again.
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

export type TodayLine = { text: string; go: 'current' | 'designs' | 'posts' | 'jobs' | 'diary' | 'sm8' | 'inbox' | 'timeline' | 'whatsapp'; urgent?: boolean; id?: string; time?: string; icon?: IconName };

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
  // Emails and texts from customers not seen yet in the job's Emails and texts.
  const mailFrom = sm8.jobs.filter((j) => newMail(j.uuid, sm8.replies, marks) && !marks[j.uuid]?.hidden).sort((a, b) => (sm8.replies![b.uuid] ?? '').localeCompare(sm8.replies![a.uuid] ?? ''));
  for (const j of mailFrom.slice(0, 3)) lines.push({ text: `Message from ${j.name}`, go: 'sm8', id: j.uuid, urgent: true, icon: 'mail' });
  if (mailFrom.length > 3) lines.push({ text: `${n(mailFrom.length - 3, 'more message', 'more messages')} from customers`, go: 'current', urgent: true, icon: 'mail' });
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
  // Sent to the customer a day or more ago and the website question not answered yet (design-places.tsx).
  const askWeb = designJobs.filter((d) => askWebsite(d, designs[d.id]) && Date.now() - (d.sharedAt ?? 0) > DAY);
  if (askWeb.length === 1) lines.push({ text: `${askWeb[0].what}: show it on the website?`, go: 'designs', id: askWeb[0].id });
  else if (askWeb.length) lines.push({ text: `${askWeb.length} designs: show them on the website?`, go: 'designs' });
  // Completed in ServiceM8 but not fully paid (the last 30 days ServiceM8 sends).
  const owing = list.filter((j) => j.status === 'Completed' && (moneyOf(j).left ?? 0) > 0 && moneyOf(j).payments !== null);
  if (owing.length) {
    const sum = owing.reduce((s, j) => s + (moneyOf(j).left ?? 0), 0);
    lines.push({ text: `${gbp(sum)} left to collect on ${n(owing.length, 'completed job', 'completed jobs')}`, go: 'current', urgent: true, icon: 'money' });
  }
  // Finished in the last 14 days and not asked for a review from the Job Kit yet.
  const toAsk = list.filter((j) => j.status === 'Completed' && !marks[j.uuid]?.reviewAskedAt && Date.now() - (parse(j.completed) || 0) < DONE_DAYS * DAY);
  if (toAsk.length === 1) lines.push({ text: `Ask ${toAsk[0].name} for a review`, go: 'sm8', id: toAsk[0].uuid, icon: 'review' });
  else if (toAsk.length) lines.push({ text: `Ask ${toAsk.length} finished jobs for a review`, go: 'current', icon: 'review' });
  // The Job timeline: past the finish date, done (move to Completed), behind, going ahead with no dates. Only when
  // ServiceM8 sent the bookings, or every job would look undated.
  if (Array.isArray(sm8.bookings)) {
    const plan = timelineRows(sm8.jobs, sm8.bookings, marks, today);
    const live = plan.rows.filter((r) => r.state !== 'completed');
    const late = live.filter((r) => r.state === 'late');
    if (late.length === 1) lines.push({ text: `${late[0].job.name}: past the finish date`, go: 'timeline', urgent: true });
    else if (late.length) lines.push({ text: `${late.length} jobs past their finish date`, go: 'timeline', urgent: true });
    const finished = live.filter((r) => r.progress === 100);
    if (finished.length === 1) lines.push({ text: `${finished[0].job.name}: done, move it to Completed`, go: 'sm8', id: finished[0].job.uuid, icon: 'gantt' });
    else if (finished.length) lines.push({ text: `${finished.length} jobs done: move them to Completed`, go: 'timeline' });
    const behind = live.filter((r) => r.behind);
    if (behind.length === 1) lines.push({ text: `${behind[0].job.name} is behind: ${behind[0].progress}% done, about ${behind[0].expected}% by now`, go: 'timeline' });
    else if (behind.length) lines.push({ text: `${behind.length} jobs behind`, go: 'timeline' });
    if (plan.undated.length) lines.push({ text: `${n(plan.undated.length, 'job going ahead needs', 'jobs going ahead need')} dates`, go: 'timeline', urgent: true });
  }
  if (going) lines.push({ text: `${n(going, 'job', 'jobs')} on Work Order`, go: 'timeline' });
  const photoJobs = kit.filter((k) => k.kind !== 'design');
  const waitingPage = photoJobs.filter((k) => k.readyAt && !done[k.id]).length;
  const open = photoJobs.filter((k) => !k.readyAt).length;
  if (open) lines.push({ text: `${n(open, 'Job Kit job', 'Job Kit jobs')} still open`, go: 'jobs' });
  if (waitingPage) lines.push({ text: `${n(waitingPage, 'job', 'jobs')} waiting for the website page`, go: 'jobs' });
  if (postsLeft) lines.push({ text: `${n(postsLeft, 'post', 'posts')} to post`, go: 'posts' });
  return lines;
}
