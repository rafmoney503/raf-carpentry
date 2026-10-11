'use client';
import { useRef, useState } from 'react';
import type { CurrentJob, Status } from '@/lib/servicem8';
import Mark from './mark';
import { field, label, Missing, TalkBox } from './parts';
import type { DesignsReady } from './designs';
import { designState } from './designs';
import type { Job } from './store';

/* Current jobs: Raf's customers and jobs from ServiceM8 (where he quotes and invoices), read and moved on from
   the Job Kit through /api/job-kit/sm8 behind the PIN. The last list is kept on the phone (this phone only) so
   the morning screen opens at once and with no signal. Things ServiceM8 has no place for stay on the phone
   too: when a quote went out by WhatsApp, and finished jobs hidden from the list. */

export type { CurrentJob };
export type Sm8 = { jobs: CurrentJob[]; at: number; error?: string; detail?: string };
export type Marks = Record<string, { quoteSentAt?: number; hidden?: boolean }>;

const LIST_KEY = 'raf_jobkit_sm8';
const MARKS_KEY = 'raf_jobkit_sm8_marks';
const DRAFT_KEY = 'raf_jobkit_enquiry';
export const FOLLOW_UP_DAYS = 5;
const DONE_DAYS = 14;

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
  const r = await post<{ jobs: CurrentJob[]; at: number }>(pin, { action: 'list' });
  if (!r.ok) return { ...before, error: r.error, detail: r.detail };
  const next = { jobs: r.data.jobs, at: r.data.at };
  write(LIST_KEY, next);
  return next;
}
export const keepSm8 = (s: Sm8) => write(LIST_KEY, { jobs: s.jobs, at: s.at });

export type Enquiry = { name: string; mobile: string; email: string; address: string; description: string };
export const sendEnquiry = (pin: string, e: Enquiry) => post<{ job: CurrentJob }>(pin, { action: 'enquiry', ...e });
export const sendStatus = (pin: string, uuid: string, status: Status) => post<{ ok: true }>(pin, { action: 'status', uuid, status });

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
/* What shows: everything open, finished ones for 14 days unless hidden, never the ones not going ahead. */
export function shown(s: Sm8, m: Marks) {
  return s.jobs.filter((j) => {
    if (m[j.uuid]?.hidden || j.status === 'Unsuccessful') return false;
    if (j.status === 'Completed') return Date.now() - (parse(j.completed) || 0) < DONE_DAYS * DAY;
    return true;
  });
}

function stageText(j: CurrentJob, m: Marks): [string, 'waiting' | 'sending' | 'sent' | 'lost'] {
  const st = stage(j, m);
  const created = parse(j.created);
  if (st === 'new') return [`New enquiry${Number.isFinite(created) ? `, ${ago(created)}` : ''}: quote to send`, 'waiting'];
  if (st === 'sent') return [`Quote sent ${ago(quoteSentAt(j, m)!)}`, 'sending'];
  if (st === 'follow') return [`Quote sent ${ago(quoteSentAt(j, m)!)}: follow up?`, 'lost'];
  if (st === 'going') return [`Going ahead${Number.isFinite(parse(j.workOrder)) ? ` since ${day(parse(j.workOrder))}` : ''}`, 'sending'];
  if (st === 'done') return [`Finished${Number.isFinite(parse(j.completed)) ? ` ${day(parse(j.completed))}` : ''}${j.paid ? ', paid' : j.invoiceSent ? ', invoice sent' : ''}`, 'sent'];
  return ['Not going ahead', 'waiting'];
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

/* ---------- the list ---------- */

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
    ['Enquiries and quotes', list.filter((j) => j.status === 'Quote')],
    ['Going ahead', list.filter((j) => j.status === 'Work Order')],
    [`Finished, last ${DONE_DAYS} days`, list.filter((j) => j.status === 'Completed')],
  ];
  const problem = problemText(sm8.error, sm8.detail, sm8.at);
  return (
    <div className="pt-7">
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">Current jobs</h1>
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
              {js.map((j) => {
                const [text, mark] = stageText(j, marks);
                const { chips } = linked(j, kit, designs, done);
                return (
                  <li key={j.uuid}>
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
              })}
            </ul>
          </section>
        ) : null,
      )}
      {sm8.at && !list.length ? <p className="mt-7 font-mono text-[13.5px] text-faint">No open jobs in ServiceM8.</p> : null}
    </div>
  );
}

/* ---------- one job ---------- */

const STEPS: { status: Status; name: string }[] = [
  { status: 'Quote', name: 'Quote' },
  { status: 'Work Order', name: 'Going ahead' },
  { status: 'Completed', name: 'Finished' },
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
        <ol className="mt-3 grid grid-cols-3 gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s.status} className={`rounded-sm border px-2 py-2 text-center text-[13.5px] ${i === at ? 'border-accent bg-accent text-on-accent' : i < at ? 'border-accent/40 text-accent' : 'border-line text-faint'}`}>
              {s.name}
            </li>
          ))}
        </ol>
        <p className="mt-3 flex items-center gap-1.5 font-mono text-[13px] text-muted">{job.status === 'Unsuccessful' ? 'Not going ahead' : text}</p>

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
                {sure === 'Work Order' ? 'Tap again: going ahead' : 'They said yes: going ahead'}
              </button>
              <button type="button" disabled={busy} className={`h-10 text-[14.5px] ${sure === 'Unsuccessful' ? 'font-semibold text-ink underline' : 'text-muted'}`} onClick={() => move('Unsuccessful')}>
                {sure === 'Unsuccessful' ? 'Tap again: not going ahead' : 'Not going ahead'}
              </button>
            </>
          ) : null}
          {job.status === 'Work Order' ? (
            <button type="button" disabled={busy} className={`btn btn-sm w-full ${sure === 'Completed' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => move('Completed')}>
              {sure === 'Completed' ? 'Tap again: finished' : 'Finished: mark it completed'}
            </button>
          ) : null}
          {job.status === 'Completed' ? (
            <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => onMark({ hidden: true })}>
              Done with it: hide from the list
            </button>
          ) : null}
          {job.status === 'Unsuccessful' ? (
            <button type="button" disabled={busy} className="btn btn-ghost btn-sm w-full" onClick={() => move('Quote', false)}>
              Back to Quote
            </button>
          ) : null}
        </div>
        <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">Moving a job here moves it in ServiceM8 too. Nothing is ever deleted there.</p>
      </section>

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

export type TodayLine = { text: string; go: 'current' | 'designs' | 'posts' | 'jobs'; urgent?: boolean };

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
  if (going) lines.push({ text: `${n(going, 'job', 'jobs')} going ahead`, go: 'current' });
  const photoJobs = kit.filter((k) => k.kind !== 'design');
  const waitingPage = photoJobs.filter((k) => k.readyAt && !done[k.id]).length;
  const open = photoJobs.filter((k) => !k.readyAt).length;
  if (open) lines.push({ text: `${n(open, 'Job Kit job', 'Job Kit jobs')} still open`, go: 'jobs' });
  if (waitingPage) lines.push({ text: `${n(waitingPage, 'job', 'jobs')} waiting for the website page`, go: 'jobs' });
  if (postsLeft) lines.push({ text: `${n(postsLeft, 'post', 'posts')} to post`, go: 'posts' });
  return lines;
}
