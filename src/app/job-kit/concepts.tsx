'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConceptDrawing } from '@/components/ConceptDrawing';
import {
  COLOURS,
  conceptMessage,
  DEFAULT_COLOUR,
  MAX_H,
  MAX_W,
  money,
  MUST_IDEAS,
  newBrief,
  newCode,
  photoCount,
  priceOption,
  rangeText,
  sizedPlan,
  type Brief,
  type ConceptEdits,
  type ConceptRow,
  type Plan,
} from '@/lib/concept-plan';
import { VAT, type Prices } from '@/lib/quote-sums';
import { SITE_URL } from '@/lib/seo';
import { dayOf, fillFromJob, MAX_PHOTOS, mergeFill, missingOf, type JobFacts, type PhotoPick } from '@/lib/concept-from-job';
import type { CurrentJob } from '@/lib/servicem8';
import type { JobDiary } from '@/lib/servicem8-diary';
import type { FullMail, InboxMail } from '@/lib/outlook';
import { field, label } from './parts';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { whatOf } from './current';
import { openedMail, savedInbox } from './inbox';
import { fileBlob } from './job-notes';
import type { Job } from './store';

/* Design with Claude (Raf, 3 Nov 2026: 'in jobkit i paste what client wants, then there is a small window where
   claude is ... creating design, and once design is created i can send email from jobkit from info@ and just attach
   created link'; mockups on the 'Job Kit, Design with Claude' design canvas, then 'build it').
   The brief (often filled in from a customer's email in the Inbox, with its photos) goes to Claude, which plans up to
   three options as a layout; they're drawn here to scale, front and inside, and priced from Raf's own price list.
   Raf can change the size, the colour, his price, or ask Claude for a change. Put online, the customer's page is
   rafcarpentry.com/ideas/<code>: no login, private to whoever has the link. Server: /api/job-kit/concept.
   On this phone: every design seen (raf_jobkit_concepts), so they open with no signal; a brief not yet drawn
   lives only here. */

const KEY = 'raf_jobkit_concepts';
const API = '/api/job-kit/concept';
export type Concepts = { rows: ConceptRow[]; at: number; error?: string };

const read = (): Concepts => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || 'null') as Concepts) ?? { rows: [], at: 0 };
  } catch {
    return { rows: [], at: 0 };
  }
};
const write = (c: Concepts) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...c, rows: c.rows.slice(0, 40) }));
  } catch {
    /* full or blocked: the next fetch brings them back */
  }
};
export const savedConcepts = read;
const localRow = (id: string) => read().rows.find((r) => r.id === id);
function keepRow(row: ConceptRow) {
  const c = read();
  write({ ...c, rows: [row, ...c.rows.filter((r) => r.id !== row.id)] });
}
function dropLocal(id: string) {
  const c = read();
  write({ ...c, rows: c.rows.filter((r) => r.id !== id) });
}

/* The store's list, with briefs not drawn yet (only on this phone) kept on top. */
export async function fetchConcepts(): Promise<Concepts> {
  const prev = read();
  const r = await post<{ concepts: ConceptRow[]; now: number }>(readPin(), { action: 'list' }, API);
  if (!r.ok) return { ...prev, error: r.error };
  const local = prev.rows.filter((x) => x.state === 'brief' && !r.data.concepts.some((y) => y.id === x.id));
  const next = { rows: [...local, ...r.data.concepts], at: Date.now() };
  write(next);
  return next;
}

/* A new design: a brief kept on this phone until it's drawn. Answers its code. */
export function startConcept(brief: Partial<Brief> = {}): string {
  const id = newCode((n) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  });
  keepRow({ id, state: 'brief', data: { brief: newBrief(brief) }, edits: null, editsAt: 0, updated: Date.now() });
  return id;
}

/* The customer's page: the live site's address, or this preview's while trying it out. */
const pageUrl = (id: string) => {
  const host = typeof location === 'undefined' ? '' : location.host;
  return `${/rafcarpentry\.com$/.test(host) || !host ? SITE_URL : location.origin}/ideas/${id}`;
};

const titleOf = (r: ConceptRow) => r.data?.plan?.title ?? (r.data?.brief.want.split(/[.\n]/)[0].slice(0, 40) || 'New design');
const whenOf = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const stateText = (r: ConceptRow) =>
  r.state === 'brief' ? 'Brief, not drawn yet' : r.state === 'working' ? 'Claude is drawing…' : r.state === 'failed' ? 'Couldn’t draw it' : r.edits?.live ? 'Online · link sent or ready' : 'Drawn · not online yet';

const Spark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5 L9.4 6.6 L14.5 8 L9.4 9.4 L8 14.5 L6.6 9.4 L1.5 8 L6.6 6.6 Z" />
  </svg>
);

/* ---------- on the Designs screen ---------- */

export function ConceptsBox({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const [c, setC] = useState<Concepts>(() => read());
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    void fetchConcepts().then((n) => {
      setC(n);
      setBusy(false);
    });
  }, []);
  return (
    <section className="jk-sec-designs mt-6 rounded-sm border border-line-strong bg-mount" aria-labelledby="concepts-h">
      <div className="jk-band-head flex items-center gap-2.5 px-3.5 py-2.5">
        <Spark className="h-5 w-5 jk-sec-ink" />
        <h2 id="concepts-h" className="font-mono text-[12.5px] uppercase tracking-[0.06em] jk-sec-ink">
          Design with Claude
        </h2>
        <span className="ml-auto font-mono text-[12px] text-faint">{busy ? 'Checking…' : `${c.rows.length} made`}</span>
      </div>
      <div className="p-3.5">
        <p className="text-[14.5px] leading-relaxed text-muted">Quick drawings in about a minute: paste what they want, Claude draws up to three options, priced from your list, with a private link to send.</p>
        <button type="button" onClick={onNew} className="btn mt-3 w-full bg-[var(--sec)] text-white hover:opacity-90">
          <Spark className="h-4 w-4" /> New design with Claude
        </button>
        {c.error ? <p className="mt-2 text-[13.5px] text-muted">{problemText(c.error)}</p> : null}
        {c.rows.length ? (
          <ul className="mt-3 divide-y divide-line">
            {c.rows.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {titleOf(r)}
                      {r.data?.brief.first ? <span className="font-normal text-muted"> · {r.data.brief.first}</span> : null}
                    </span>
                    <span className={`block text-[13.5px] ${r.state === 'failed' ? 'text-ink' : 'text-muted'}`}>{stateText(r)}</span>
                  </span>
                  <span className="font-mono text-[12px] text-faint">{whenOf(r.updated)}</span>
                  <span aria-hidden className="text-[18px] jk-sec-ink">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- one design ---------- */

export function ConceptView({ id, prices, src, onEmail, onClose }: { id: string; prices: Prices; src?: JobSource; onEmail: (mail: string, text: string) => void; onClose: () => void }) {
  const [row, setRow] = useState<ConceptRow | null>(() => localRow(id) ?? null);
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(!localRow(id));
  const [editingBrief, setEditingBrief] = useState(false);
  const rowRef = useRef(row);
  useEffect(() => {
    rowRef.current = row;
  }, [row]);

  const refresh = useCallback(async () => {
    const r = await post<{ concept: ConceptRow | null }>(readPin(), { action: 'get', id }, API);
    setLoading(false);
    if (!r.ok) return setProblem(problemText(r.error));
    setProblem('');
    if (!r.data.concept) return; // only on this phone so far (a brief)
    const cur = rowRef.current;
    // Raf's latest changes on this phone win until the store has them
    const edits = cur && cur.editsAt > r.data.concept.editsAt ? cur.edits : r.data.concept.edits;
    const editsAt = Math.max(cur?.editsAt ?? 0, r.data.concept.editsAt);
    const next = { ...r.data.concept, edits, editsAt };
    setRow(next);
    keepRow(next);
  }, [id]);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);
  // while Claude draws: ask every 4 seconds, and when the app comes back on screen
  const working = row?.state === 'working';
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void refresh(), 4000);
    const vis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [working, refresh]);

  const draw = async (brief: Brief, note = '') => {
    setProblem('');
    const prev = rowRef.current;
    const next: ConceptRow = { id, state: 'working', data: { ...(prev?.data ?? {}), brief }, edits: prev?.edits ?? null, editsAt: prev?.editsAt ?? 0, claimed: Date.now(), updated: Date.now() };
    setRow(next);
    keepRow(next);
    setEditingBrief(false);
    const { found: _found, ...send } = brief; // what was found on the job stays on the phone
    void _found;
    const r = await post<{ state: string }>(readPin(), { action: 'draw', id, brief: send, note }, API);
    if (!r.ok) {
      const back = prev ?? { ...next, state: 'brief' as const };
      setRow(back);
      keepRow(back);
      setProblem(r.error === 'concepts-not-set-up' ? 'Design with Claude isn’t switched on here: it needs ANTHROPIC_API_KEY and JOBKIT_SYNC_SECRET in Vercel.' : r.error === 'no-text' ? 'Write what they want, or give a size, first.' : problemText(r.error, r.detail));
      return;
    }
    window.setTimeout(() => void refresh(), 2500);
  };

  // Raf's changes: on the screen at once, kept on the phone, then in the store (the later change wins)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const change = (patch: Partial<ConceptEdits>) => {
    const cur = rowRef.current;
    if (!cur) return;
    const at = Date.now();
    const next = { ...cur, edits: { ...(cur.edits ?? {}), ...patch }, editsAt: at, updated: at };
    setRow(next);
    keepRow(next);
    if (cur.state === 'brief') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const r = rowRef.current;
      if (!r?.edits) return;
      void post(readPin(), { action: 'edit', id, edits: r.edits, at: r.editsAt }, API).then((res) => {
        if (!res.ok) setProblem(`Not saved yet: ${problemText(res.error)}`);
        else setProblem('');
      });
    }, 'live' in patch ? 0 : 700);
  };

  if (!row) {
    return (
      <div className="pt-7">
        <p className="text-[15px] text-muted">{loading ? 'Opening the design…' : problem || 'This design isn’t on this phone or in the store.'}</p>
      </div>
    );
  }
  const brief = row.data?.brief ?? newBrief();
  const plan = row.data?.plan;
  const showBrief = !plan || editingBrief || row.state === 'brief';
  return (
    <div className="pt-7">
      <p className="kicker jk-sec-ink">Design with Claude{row.data?.at ? ` · drawn ${whenOf(row.data.at)}` : ''}</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-[32px] font-[680] leading-[1.04] tracking-[-0.025em]">
        <Spark className="h-[28px] w-[28px] shrink-0 jk-sec-ink" />
        <span className="min-w-0">
          {plan?.title ?? 'New design'}
          {brief.first ? <span className="text-muted"> for {brief.first}</span> : null}
        </span>
      </h1>
      {problem ? (
        <p role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem}
        </p>
      ) : null}
      {row.state === 'working' ? <Working redraw={Boolean(plan)} since={row.claimed ?? row.updated} /> : null}
      {row.state === 'failed' && !plan ? (
        <p role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problemText(row.data?.error === 'no-text' ? 'ai-error' : row.data?.error, row.data?.error === 'no-text' ? 'nothing to go on' : row.data?.detail)}
        </p>
      ) : null}
      {plan && row.data?.error && row.state === 'ready' ? (
        <p className="mt-4 rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[14px] leading-relaxed text-muted">The last change didn’t go through ({problemText(row.data.error, row.data.detail)}), so this is the drawing before it.</p>
      ) : null}
      {plan && !editingBrief && row.state !== 'brief' ? (
        <Result row={row} plan={plan} prices={prices} working={row.state === 'working'} onChange={change} onRedraw={(note) => void draw(brief, note)} onBrief={() => setEditingBrief(true)} onEmail={onEmail} />
      ) : null}
      {showBrief && row.state !== 'working' ? (
        <BriefForm
          key={id}
          brief={brief}
          drawn={Boolean(plan)}
          src={src}
          onDraw={(b) => void draw(b)}
          onKeep={(b) => {
            const next = { ...row, data: { ...(row.data ?? {}), brief: b }, updated: Date.now() };
            setRow(next);
            keepRow(next);
          }}
          onCancel={plan ? () => setEditingBrief(false) : undefined}
          onDrop={
            row.state === 'brief'
              ? () => {
                  dropLocal(id);
                  onClose();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function Working({ redraw, since }: { redraw: boolean; since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return (
    <div role="status" className="jk-sec-designs mt-5 flex items-center gap-3 rounded-sm border border-line-strong bg-mount px-4 py-4">
      <svg viewBox="0 0 24 24" className="jk-spin h-6 w-6 shrink-0 jk-sec-ink" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <path d="M12 3 a9 9 0 1 1 -9 9" />
      </svg>
      <span className="text-[15px] leading-snug">
        <b className="font-semibold">{redraw ? 'Claude is making the change…' : 'Claude is drawing it…'}</b>
        <span className="block text-[13.5px] text-muted">
          {s < 100 ? `About a minute · ${s} s so far.` : 'Taking longer than usual.'} You can leave this screen: it carries on and shows here when it’s done.
        </span>
      </span>
    </div>
  );
}

/* ---------- the brief ---------- */

function Chips({ items, on, onToggle, onAdd, addLabel }: { items: string[]; on: string[]; onToggle: (s: string) => void; onAdd: (s: string) => void; addLabel: string }) {
  const [adding, setAdding] = useState('');
  const all = [...on.filter((x) => !items.includes(x)), ...items];
  const add = () => {
    const v = adding.trim();
    if (v) onAdd(v.slice(0, 60));
    setAdding('');
  };
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((x) => {
        const pressed = on.includes(x);
        return (
          <button
            key={x}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(x)}
            className={`min-h-9 rounded-full border px-3 text-[14px] font-medium ${pressed ? 'border-[var(--sec)] bg-[var(--sec-soft)] jk-sec-ink' : 'border-line-strong bg-mount text-muted'}`}
          >
            {pressed ? '✓ ' : ''}
            {x}
          </button>
        );
      })}
      {/* not a form: this sits inside the brief's form, and Enter here mustn't send the brief */}
      <span className="flex items-center gap-1">
        <input
          aria-label={addLabel}
          value={adding}
          maxLength={60}
          placeholder={addLabel}
          enterKeyHint="done"
          onChange={(e) => setAdding(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            add();
          }}
          className={`${field} h-9 w-[150px] rounded-full text-[14px]`}
        />
      </span>
    </div>
  );
}

/* ---------- Find their job: everything on it fills the brief ---------- */

/* What the app hands Design with Claude about Raf's jobs (job-kit-app.tsx): the Current jobs list, the Job Kit's
   own jobs, the Quotes readings and a way to the job's screen. */
export type JobSource = {
  list: CurrentJob[];
  at: number;
  loading: boolean;
  refresh: () => void;
  find: (uuid: string) => CurrentJob | undefined;
  kit: Job[];
  quote: (uuid: string) => JobFacts['quote'];
  open: (uuid: string) => void;
};

const INBOX_API = '/api/job-kit/inbox';
const DIARY_KEY = 'raf_jobkit_diary'; // job-notes.tsx keeps each job's last diary here; used with no signal
const STATUS_ORDER: Record<string, number> = { Quote: 0, 'Work Order': 1, Completed: 2, Unsuccessful: 3 };
const STATUS_WORD: Record<string, string> = { Quote: 'Quote', 'Work Order': 'Work Order', Completed: 'Completed', Unsuccessful: 'Lost' };
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Current jobs matching what's typed (every word somewhere in the name, area, address, description or job
   number); nothing typed: the newest enquiries and quotes. */
export function findJobs(list: CurrentJob[], q: string): CurrentJob[] {
  const words = fold(q).split(/\s+/).filter(Boolean);
  const newest = (a: CurrentJob, b: CurrentJob) => (b.created ?? '').localeCompare(a.created ?? '');
  if (!words.length) return list.filter((j) => j.status === 'Quote').sort(newest).slice(0, 6);
  return list
    .filter((j) => {
      const hay = fold(`${j.name} ${j.area} ${j.address} ${j.description} ${j.number} #${j.number}`);
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => {
      const named = (j: CurrentJob) => (words.some((w) => fold(j.name).split(/\s+/).some((n) => n.startsWith(w))) ? 0 : 1);
      return named(a) - named(b) || (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || newest(a, b);
    })
    .slice(0, 12);
}

type Step = 'working' | 'done' | 'failed' | 'skip';
type Steps = { diary: Step; mail: Step };
const MISSING_WORD: Record<string, string> = { notes: 'notes', files: 'photos', messages: 'emails and texts', bookings: 'bookings' };

function savedDiary(job: string): { diary: JobDiary; at: number } | undefined {
  try {
    return (JSON.parse(localStorage.getItem(DIARY_KEY) || '{}') as Record<string, { diary: JobDiary; at: number }>)[job];
  } catch {
    return undefined;
  }
}
const theirEmail = (m: InboxMail) => (m.replyTo?.email || m.from.email).toLowerCase();

/* Everything on one job: its diary from ServiceM8 (notes, their messages, photos), their newest email to info@
   with its photos, the Job Kit's visit and design request for it and the Quotes reading, all on this phone or
   through the Job Kit's own server. A part that can't be had is said, not fatal. */
async function gatherJob(job: CurrentJob, src: JobSource, onStep: (s: Partial<Steps>) => void): Promise<{ facts: JobFacts; problems: string[] }> {
  const pin = readPin();
  const problems: string[] = [];
  const diaryP = (async () => {
    const r = await post<{ diary: JobDiary; at: number }>(pin, { action: 'diary', job: job.uuid, email: job.email, mobile: job.mobile });
    if (r.ok) {
      const miss = r.data.diary.missing.filter((m) => m !== 'bookings');
      if (miss.length) problems.push(`ServiceM8 wouldn’t give the job’s ${miss.map((m) => MISSING_WORD[m] ?? m).join(' or ')} this time.`);
      onStep({ diary: 'done' });
      return r.data.diary.entries;
    }
    const kept = savedDiary(job.uuid);
    problems.push(`ServiceM8: ${problemText(r.error, r.detail)}${kept ? ` Used the job’s diary kept on this phone (${dayOf(new Date(kept.at).toISOString())}).` : ''}`);
    onStep({ diary: 'failed' });
    return kept?.diary.entries ?? null;
  })();
  const mailP = (async (): Promise<JobFacts['mail']> => {
    const email = job.email.trim().toLowerCase();
    if (!email) {
      onStep({ mail: 'skip' });
      return null;
    }
    const r = await post<{ mails: InboxMail[] }>(pin, { action: 'from', email }, INBOX_API);
    // with no answer, the Inbox list kept on this phone
    const newest = r.ok ? r.data.mails[0] : savedInbox().mails.find((m) => !m.mine && theirEmail(m) === email);
    if (!r.ok) problems.push(r.error === 'outlook-not-set-up' ? 'The Inbox isn’t connected here, so only emails already on this phone were looked at.' : `The Inbox: ${problemText(r.error, r.detail)}`);
    if (!newest) {
      onStep({ mail: r.ok ? 'done' : 'failed' });
      return null;
    }
    let full = openedMail(newest.id);
    if (!full) {
      const o = await post<{ mail: FullMail }>(pin, { action: 'open', id: newest.id, markRead: false }, INBOX_API);
      if (o.ok) full = o.data.mail;
      else problems.push(`Their email to info@ couldn’t be opened: ${problemText(o.error, o.detail)}`);
    }
    onStep({ mail: full ? 'done' : 'failed' });
    if (!full) return null;
    return { id: full.id, subject: full.subject, text: full.text, at: full.at, photos: full.files.filter((f) => /^image\//i.test(f.type) && !f.inline).map((f) => ({ id: f.id, name: f.name })) };
  })();
  const [diary, mail] = await Promise.all([diaryP, mailP]);
  const kit = src.kit.filter((k) => k.sm8 === job.uuid).map((k) => ({ kind: k.kind, what: k.what, notes: k.notes, design: k.design }));
  return { facts: { job: { uuid: job.uuid, number: job.number, name: job.name, first: job.first, description: job.description }, diary, kit, quote: src.quote(job.uuid), mail }, problems };
}

function JobFinder({ src, onPick }: { src: JobSource; onPick: (j: CurrentJob) => void }) {
  const [q, setQ] = useState('');
  const { refresh } = src;
  useEffect(() => refresh(), [refresh]); // the app asks ServiceM8 at most once a minute
  const list = useMemo(() => findJobs(src.list, q), [src.list, q]);
  return (
    <section className="rounded-sm border-2 border-[var(--sec)] bg-mount" aria-labelledby="cj-find-h">
      <div className="jk-band-head flex items-center gap-2 px-3.5 py-2.5">
        <h2 id="cj-find-h" className="font-mono text-[12.5px] uppercase tracking-[0.06em] jk-sec-ink">
          1 · Find their job
        </h2>
        <span className="ml-auto font-mono text-[12px] text-faint">{src.loading ? 'Checking ServiceM8…' : `${src.list.length} current`}</span>
      </div>
      <div className="grid gap-2.5 p-3.5">
        <p className="text-[14.5px] leading-relaxed text-muted">Pick the job and everything on it fills the brief: their enquiry, your notes, their messages and email, the photos and the quote’s sizes. Then you fill in what’s missing.</p>
        <input
          type="search"
          aria-label="Find their job"
          className={`${field} h-11`}
          value={q}
          enterKeyHint="search"
          placeholder="Name, area, what or job number"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (list.length === 1) onPick(list[0]);
          }}
        />
        {!q.trim() && list.length ? <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint">Newest enquiries and quotes</p> : null}
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map((j) => (
              <li key={j.uuid}>
                <button type="button" onClick={() => onPick(j)} className="flex w-full items-center gap-3 py-2.5 text-left" data-job={j.uuid}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {j.name}
                      {j.area ? <span className="font-normal text-muted"> · {j.area}</span> : null}
                    </span>
                    <span className="block truncate text-[13.5px] text-muted">{j.description ? whatOf(j.description) : 'No description yet'}</span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[11.5px] leading-tight text-faint">
                    {STATUS_WORD[j.status] ?? j.status}
                    <br />
                    {dayOf(j.created)}
                  </span>
                  <span aria-hidden className="text-[18px] jk-sec-ink">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">
            {q.trim() ? `No current job matches “${q.trim()}”.` : src.list.length ? 'No enquiries waiting on Quote.' : src.loading ? 'Getting your jobs from ServiceM8…' : 'No current jobs on this phone yet.'}{' '}
            {!src.loading ? (
              <button type="button" className="underline" onClick={() => src.refresh()}>
                Check again
              </button>
            ) : null}
          </p>
        )}
        <p className="text-[13.5px] text-muted">Not from a job? Skip this and fill in the brief below.</p>
      </div>
    </section>
  );
}

const STEP_MARK: Record<Step, string> = { working: '…', done: '✓', failed: '!', skip: '–' };
function Gathering({ name, steps }: { name: string; steps: Steps }) {
  const rows: [string, Step][] = [
    ['ServiceM8: the job, its notes, their messages, photos', steps.diary],
    ['Their emails to info@', steps.mail],
    ['Your Job Kit visit and the quote, on this phone', 'done'],
  ];
  return (
    <section role="status" className="rounded-sm border border-line-strong bg-mount p-3.5">
      <p className="flex items-center gap-2.5 text-[15px] font-semibold">
        <svg viewBox="0 0 24 24" className="jk-spin h-5 w-5 shrink-0 jk-sec-ink" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <path d="M12 3 a9 9 0 1 1 -9 9" />
        </svg>
        Looking through {name}’s job…
      </p>
      <ul className="mt-2 grid gap-1 text-[14px] text-muted">
        {rows.map(([t, s]) => (
          <li key={t} className="flex gap-2">
            <span aria-hidden className={`w-4 shrink-0 text-center font-mono ${s === 'done' ? 'jk-sec-ink' : ''}`}>
              {STEP_MARK[s]}
            </span>
            {t}
            {s === 'skip' ? ' (no email on the job)' : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FoundBox({ name, status, found, onChange, onOpen }: { name: string; status?: string; found: NonNullable<Brief['found']>; onChange: () => void; onOpen?: () => void }) {
  return (
    <section className="rounded-sm border border-line-strong bg-mount" aria-labelledby="cj-found-h" data-found>
      <div className="jk-band-head flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
        <h2 id="cj-found-h" className="min-w-0 font-mono text-[12.5px] uppercase tracking-[0.06em] jk-sec-ink">
          1 · From {name}’s job{status ? ` · ${STATUS_WORD[status] ?? status}` : ''}
        </h2>
        <button type="button" onClick={onChange} className="ml-auto h-8 text-[14px] text-muted underline">
          Another job
        </button>
      </div>
      <ul className="grid gap-1.5 px-3.5 pb-3 pt-2.5 text-[14.5px] leading-snug">
        {found.lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span aria-hidden className="w-4 shrink-0 text-center jk-sec-ink">
              ✓
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{l}</span>
          </li>
        ))}
        {found.none.map((l) => (
          <li key={l} className="flex gap-2 text-muted">
            <span aria-hidden className="w-4 shrink-0 text-center">
              –
            </span>
            {l}
          </li>
        ))}
        {found.problems.map((l) => (
          <li key={l} className="flex gap-2 text-muted">
            <span aria-hidden className="w-4 shrink-0 text-center font-semibold text-ink">
              !
            </span>
            {l}
          </li>
        ))}
        {!found.lines.length && !found.none.length ? <li className="text-muted">Nothing on the job yet: fill the brief in below.</li> : null}
      </ul>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="mx-3.5 mb-3 h-9 text-[14px] underline jk-sec-ink">
          Open the job
        </button>
      ) : null}
    </section>
  );
}

/* A photo on the job (ServiceM8) or in their email (Inbox), small, with a tick when it goes to Claude. */
const tileUrls = new Map<string, string>();
async function inboxThumb(mail: string, att: string): Promise<Blob | null> {
  try {
    const res = await fetch(INBOX_API, { method: 'POST', headers: { 'x-job-kit-pin': readPin(), 'content-type': 'application/json' }, body: JSON.stringify({ action: 'file', id: mail, att }), cache: 'no-store' });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}
function PhotoTile({ p, mail, on, onToggle }: { p: PhotoPick; mail?: string; on: boolean; onToggle: () => void }) {
  const key = `${p.src}:${p.id}`;
  const [url, setUrl] = useState(() => tileUrls.get(key) ?? '');
  const [none, setNone] = useState(false);
  useEffect(() => {
    if (url) return;
    let gone = false;
    void (async () => {
      let blob: Blob | null = null;
      if (p.src === 'job') {
        const r = await fileBlob(p.id, 'thumb');
        blob = 'blob' in r ? r.blob : null;
      } else if (mail) blob = await inboxThumb(mail, p.id);
      if (gone) return;
      if (!blob) return setNone(true);
      const u = URL.createObjectURL(blob);
      tileUrls.set(key, u);
      setUrl(u);
    })();
    return () => {
      gone = true;
    };
  }, [key, url, p.src, p.id, mail]);
  return (
    <button type="button" aria-pressed={on} onClick={onToggle} data-photo={p.id} className={`relative aspect-square overflow-hidden rounded-sm border bg-raised ${on ? 'border-[var(--sec)]' : 'border-line'}`} aria-label={`Photo ${p.name}${p.src === 'mail' ? ' from their email' : ''}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a blob URL fetched behind the PIN
        <img src={url} alt="" className={`h-full w-full object-cover ${on ? '' : 'opacity-45'}`} />
      ) : (
        <span className="absolute inset-0 grid place-items-center p-1 text-center font-mono text-[10.5px] leading-tight text-faint">{none ? p.name : ''}</span>
      )}
      <span aria-hidden className={`absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[13px] font-bold shadow-sm ${on ? 'bg-[var(--sec)] text-white' : 'bg-white/80 text-transparent'}`}>
        ✓
      </span>
      {p.src === 'mail' ? <span className="absolute bottom-0 left-0 bg-ink/70 px-1 font-mono text-[10px] text-white">email</span> : null}
    </button>
  );
}

function PhotoPicker({ b, onChange }: { b: Brief; onChange: (patch: Partial<Brief>) => void }) {
  const [full, setFull] = useState(false);
  const all = (b.found?.photos ?? []).filter((p) => p.src === 'job' || b.mail);
  const mailOn = b.mail ? (b.photos ?? []) : [];
  const jobOn = b.jobPhotos ?? [];
  const n = mailOn.length + jobOn.length;
  if (!all.length) return null;
  const toggle = (p: PhotoPick) => {
    const on = p.src === 'job' ? jobOn.includes(p.id) : mailOn.includes(p.id);
    if (!on && n >= MAX_PHOTOS) {
      setFull(true);
      setTimeout(() => setFull(false), 2500);
      return;
    }
    setFull(false);
    if (p.src === 'job') onChange({ jobPhotos: on ? jobOn.filter((x) => x !== p.id) : [...jobOn, p.id] });
    else onChange({ photos: on ? mailOn.filter((x) => x !== p.id) : [...mailOn, p.id] });
  };
  return (
    <div className="grid gap-2" data-photos>
      <span className={`${label} flex flex-wrap items-baseline gap-x-2`}>
        Photos for Claude
        <span className="font-sans text-[13px] normal-case tracking-normal text-muted">
          {n} of {MAX_PHOTOS} picked{all.length > MAX_PHOTOS ? `, from ${all.length}` : ''}
        </span>
      </span>
      <div className="grid grid-cols-4 gap-2">
        {all.slice(0, 12).map((p) => (
          <PhotoTile key={`${p.src}:${p.id}`} p={p} mail={b.mail} on={p.src === 'job' ? jobOn.includes(p.id) : mailOn.includes(p.id)} onToggle={() => toggle(p)} />
        ))}
      </div>
      <p className="text-[13px] text-muted" aria-live="polite">
        {full ? `${MAX_PHOTOS} at most: untick one first.` : 'Tap a photo to add it or take it out. The ones of the space help most.'}
      </p>
    </div>
  );
}

const NEEDS_LABEL: Record<string, string> = { want: 'What they want', first: 'First name', width: 'Width', height: 'Height', depth: 'Depth' };

function BriefForm({
  brief,
  drawn,
  src,
  onDraw,
  onKeep,
  onCancel,
  onDrop,
}: {
  brief: Brief;
  drawn: boolean;
  src?: JobSource;
  onDraw: (b: Brief) => void;
  onKeep: (b: Brief) => void;
  onCancel?: () => void;
  onDrop?: () => void;
}) {
  const [b, setB] = useState<Brief>(brief);
  const bRef = useRef(b);
  const keepRef = useRef(onKeep); // the latest, for a job looked through while the screen moved on
  keepRef.current = onKeep;
  const put = (next: Brief) => {
    bRef.current = next;
    setB(next);
    keepRef.current(next);
  };
  const set = (patch: Partial<Brief>) => put({ ...bRef.current, ...patch });
  // a box Raf changes is his now: its "from ..." note goes
  const setField = (k: 'want' | 'first' | 'width' | 'height' | 'depth' | 'other', patch: Partial<Brief>) => {
    const f = bRef.current.found;
    if (!f?.from[k]) return set(patch);
    const from = { ...f.from };
    delete from[k];
    set({ ...patch, found: { ...f, from } });
  };
  const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const styleIdeas = ['Open dresser', 'Larder wall', 'Shaker with niche', 'Flat doors floor to ceiling', 'Doors below, open above'];
  const can = Boolean(b.want.trim() || b.width || photoCount(b));

  // ---- the job it starts from ----
  const job = b.sm8 ? src?.find(b.sm8) : undefined;
  const jobName = job?.name || b.first || 'their';
  const [steps, setSteps] = useState<Steps | null>(null);
  const started = useRef(false);
  const pick = useCallback(
    async (j: CurrentJob) => {
      if (!src) return;
      started.current = true; // picked here: the look-through-on-open below mustn't run it a second time
      setSteps({ diary: 'working', mail: j.email ? 'working' : 'skip' });
      set({ sm8: j.uuid, found: undefined });
      try {
        const { facts, problems } = await gatherJob(j, src, (s) => setSteps((cur) => (cur ? { ...cur, ...s } : cur)));
        const fill = fillFromJob(facts);
        fill.found.problems = problems;
        // the brief may have moved on while it looked: only fill the one still showing
        if (bRef.current.sm8 === j.uuid) put(mergeFill(bRef.current, fill, Date.now()));
      } catch (e) {
        console.error('find their job', e);
        if (bRef.current.sm8 === j.uuid) set({ found: { at: Date.now(), from: {}, guess: {}, lines: [], none: [], problems: ['Something went wrong looking through the job. Fill the brief in below, or pick the job again.'], photos: [] } });
      } finally {
        setSteps(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- put and set only read refs
    [src],
  );
  // started from the job's own screen: look through it straight away
  useEffect(() => {
    if (started.current || drawn || !src || !b.sm8 || b.found) return;
    const j = src.find(b.sm8);
    if (!j) return;
    started.current = true;
    void pick(j);
  }, [src, b.sm8, b.found, drawn, pick]);
  const again = () => {
    setSteps(null);
    put(newBrief({ count: bRef.current.count, styles: bRef.current.styles }));
  };

  const found = b.found;
  const missing = found ? missingOf(b) : [];
  const miss = (k: string) => found && missing.includes(k as never);
  const from = (k: 'want' | 'first' | 'width' | 'height' | 'depth' | 'other' | 'must') => found?.from[k];
  const missStyle = (k: string) => (miss(k) ? { borderColor: 'var(--sec)', borderStyle: 'dashed', borderWidth: 2 } : undefined);
  const Tag = ({ k }: { k: 'want' | 'first' | 'other' | 'must' }) =>
    from(k) ? (
      <span className="font-sans text-[12.5px] normal-case tracking-normal text-muted">from {from(k)}</span>
    ) : miss(k) ? (
      <span className="rounded-full bg-[var(--sec-soft)] px-2 py-0.5 font-sans text-[12px] font-semibold normal-case tracking-normal jk-sec-ink">Missing</span>
    ) : null;
  const goTo = (k: string) => {
    const el = document.getElementById(`cb-${k}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (el as HTMLInputElement).focus({ preventScroll: true });
  };
  // the sizes' sources in one line (three boxes side by side leave no room for a note each)
  const sizeFrom = (['width', 'height', 'depth'] as const).filter((k) => from(k));
  const bySource = new Map<string, string[]>();
  for (const k of sizeFrom) bySource.set(from(k)!, [...(bySource.get(from(k)!) ?? []), k]);
  const sizeNote = [...bySource].map(([s, ks]) => `${ks.join(' and ')} from ${s}`).join(', ');
  const guess = found?.guess ?? {};
  const guessed = (['width', 'height', 'depth'] as const).filter((k) => guess[k] && (k === 'depth' ? !b.depth.trim() : !b[k]));
  const showFinder = Boolean(src) && !drawn && !b.mail && !b.sm8;

  return (
    // not a form, so the keyboard's Go in a box doesn't send it to Claude half written
    <div className="mt-5 grid gap-4">
      {showFinder && src ? <JobFinder src={src} onPick={(j) => void pick(j)} /> : null}
      {steps ? <Gathering name={job?.name ?? 'their'} steps={steps} /> : null}
      {found && !steps ? (
        <>
          <FoundBox name={jobName} status={job?.status} found={found} onChange={again} onOpen={src && b.sm8 && job ? () => src.open(b.sm8!) : undefined} />
          <div className="rounded-sm border border-[var(--sec)] bg-[var(--sec-soft)] px-3.5 py-3" data-missing>
            <p className="font-mono text-[12.5px] uppercase tracking-[0.06em] jk-sec-ink">2 · Fill in what’s missing</p>
            {missing.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[14.5px]">Still needed:</span>
                {missing.map((k) => (
                  <button key={k} type="button" onClick={() => goTo(k)} className="min-h-9 rounded-full border border-[var(--sec)] bg-mount px-3 text-[14px] font-semibold jk-sec-ink">
                    {NEEDS_LABEL[k]}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-[14.5px]">Nothing missing. Check it over, then draw.</p>
            )}
            {guessed.length ? <p className="mt-2 text-[13.5px] text-muted">Quotes guessed some sizes from the photos: use them below if they look right.</p> : null}
          </div>
        </>
      ) : null}
      {!found && !steps ? <p className="text-[15px] leading-relaxed text-muted">{b.mail ? 'Filled in from their email. Change anything, then draw.' : showFinder ? 'Or paste what they want, add the sizes you know, then draw.' : 'Paste what they want, add the sizes you know, then draw.'}</p> : null}
      {steps ? null : (
        <>
          <label className="grid gap-1.5">
            <span className={`${label} flex flex-wrap items-baseline gap-x-2 gap-y-1`}>
              What they want <Tag k="want" />
            </span>
            <textarea
              id="cb-want"
              className={`${field} ${found && b.want.length > 400 ? 'min-h-[260px]' : 'min-h-[150px]'} py-2.5 text-[15.5px] leading-relaxed`}
              style={missStyle('want')}
              value={b.want}
              maxLength={3000}
              placeholder="Paste their message, or say it in your words"
              onChange={(e) => setField('want', { want: e.target.value })}
            />
          </label>
          {b.mail && !found ? (
            <p className="text-[14px] text-muted">
              {(b.photos ?? []).length ? `${(b.photos ?? []).length} photo${(b.photos ?? []).length === 1 ? '' : 's'} from their email go with it.` : 'Their email has no photos.'}
            </p>
          ) : null}
          {found ? <PhotoPicker b={b} onChange={set} /> : null}
          <label className="grid gap-1.5">
            <span className={`${label} flex flex-wrap items-baseline gap-x-2 gap-y-1`}>
              Their first name <Tag k="first" />
            </span>
            <input id="cb-first" className={`${field} h-11`} style={missStyle('first')} value={b.first} maxLength={40} placeholder={miss('first') ? 'Missing' : undefined} onChange={(e) => setField('first', { first: e.target.value })} />
          </label>
          <fieldset className="grid gap-2">
            <legend className={label}>Sizes in mm</legend>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  ['width', 'Width'],
                  ['height', 'Height'],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="grid gap-1 text-[13px] text-muted">
                  {l}
                  <input
                    id={`cb-${k}`}
                    inputMode="numeric"
                    className={`${field} h-11 font-mono`}
                    style={missStyle(k)}
                    value={b[k] || ''}
                    placeholder={miss(k) ? (guess[k] ? `≈${guess[k]}` : 'missing') : undefined}
                    onChange={(e) => setField(k, { [k]: Math.min(12000, Number(e.target.value.replace(/\D/g, '')) || 0) } as Partial<Brief>)}
                  />
                </label>
              ))}
              <label className="grid gap-1 text-[13px] text-muted">
                Depth
                <input id="cb-depth" className={`${field} h-11 font-mono`} style={missStyle('depth')} value={b.depth} maxLength={30} placeholder={miss('depth') ? (guess.depth ? `≈${guess.depth}` : 'missing') : 'varies'} onChange={(e) => setField('depth', { depth: e.target.value })} />
              </label>
            </div>
            {sizeNote ? <p className="text-[13px] text-muted">{sizeNote.charAt(0).toUpperCase() + sizeNote.slice(1)}.</p> : null}
            {guessed.length ? (
              <button
                type="button"
                className="justify-self-start rounded-sm border border-line-strong bg-mount px-3 py-2 text-left text-[14px]"
                onClick={() => {
                  const f = bRef.current.found!;
                  const patch: Partial<Brief> = {};
                  for (const k of guessed) {
                    if (k === 'depth') patch.depth = String(guess.depth);
                    else patch[k] = guess[k];
                  }
                  set({ ...patch, found: { ...f, from: { ...f.from, ...Object.fromEntries(guessed.map((k) => [k, 'a guess in Quotes'])) } } });
                }}
              >
                Use the guesses: <span className="font-mono">{guessed.map((k) => `${guess[k]} ${k === 'width' ? 'wide' : k === 'height' ? 'high' : 'deep'}`).join(', ')}</span>
              </button>
            ) : null}
            <label className="grid gap-1 text-[13px] text-muted">
              <span className="flex flex-wrap items-baseline gap-x-2">
                Other sizes and things to know {from('other') ? <span className="text-[12.5px]">· from {from('other')}</span> : null}
              </span>
              <input className={`${field} h-11 text-[15px]`} value={b.other} maxLength={600} placeholder="e.g. left end 1250 high under a boxing" onChange={(e) => setField('other', { other: e.target.value })} />
            </label>
          </fieldset>
          <div className="grid gap-2">
            <span className={`${label} flex flex-wrap items-baseline gap-x-2 gap-y-1`}>
              Must have {from('must') ? <span className="font-sans text-[12.5px] normal-case tracking-normal text-muted">ticked from {from('must')}: check them</span> : null}
            </span>
            <Chips items={MUST_IDEAS} on={b.must} onToggle={(x) => set({ must: toggle(b.must, x) })} onAdd={(x) => set({ must: [...b.must.filter((y) => y !== x), x] })} addLabel="+ Add your own" />
          </div>
          <div className="grid gap-2">
            <span className={label}>Options</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="How many options">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" aria-pressed={b.count === n} onClick={() => set({ count: n, styles: b.styles.slice(0, n) })} className={`h-11 rounded-sm border font-mono text-[16px] ${b.count === n ? 'border-[var(--sec)] bg-[var(--sec)] text-white' : 'border-line-strong bg-mount'}`}>
                  {n}
                </button>
              ))}
            </div>
            <Chips items={styleIdeas} on={b.styles} onToggle={(x) => set({ styles: toggle(b.styles, x).slice(0, b.count) })} onAdd={(x) => set({ styles: [...b.styles.filter((y) => y !== x), x].slice(-b.count) })} addLabel="+ A style" />
            <p className="text-[13.5px] text-muted">{b.styles.length ? `One option each for ${b.styles.join(', ')}${b.styles.length < b.count ? '; Claude picks the rest' : ''}.` : 'No styles picked: Claude picks them.'}</p>
          </div>
          <button type="button" disabled={!can} onClick={() => can && onDraw(bRef.current)} className="btn w-full bg-[var(--sec)] text-white hover:opacity-90 disabled:opacity-50">
            <Spark className="h-4 w-4" /> {drawn ? 'Draw it again from this brief' : `Draw ${b.count === 1 ? 'it' : `${b.count} options`}`}
          </button>
          {found && missing.length && can ? <p className="-mt-2 text-center text-[13.5px] text-muted">You can draw it now: Claude guesses what’s missing and says so.</p> : null}
          <p className="text-center text-[13px] leading-relaxed text-muted">
            About a minute, pence on your Claude credit. The prices come from your price list, never from Claude.
            <br />
            Their first name, these words and the photos go to Claude; phone numbers, emails and addresses are taken out.
          </p>
        </>
      )}
      <div className="flex flex-wrap justify-center gap-4">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-10 text-[14.5px] text-muted underline">
            Back to the drawing
          </button>
        ) : null}
        {onDrop ? (
          <button type="button" onClick={onDrop} className="h-10 text-[14.5px] text-muted underline">
            Throw this brief away
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- the drawing, prices and the link ---------- */

function Result({
  row,
  plan: raw,
  prices,
  working,
  onChange,
  onRedraw,
  onBrief,
  onEmail,
}: {
  row: ConceptRow;
  plan: Plan;
  prices: Prices;
  working: boolean;
  onChange: (e: Partial<ConceptEdits>) => void;
  onRedraw: (note: string) => void;
  onBrief: () => void;
  onEmail: (mail: string, text: string) => void;
}) {
  const edits = useMemo(() => row.edits ?? {}, [row.edits]);
  const plan = useMemo(() => sizedPlan(raw, edits), [raw, edits]);
  const [opt, setOpt] = useState(() => Math.max(0, plan.options.findIndex((o) => o.pick)));
  const [view, setView] = useState<'front' | 'inside'>('front');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState('');
  const o = plan.options[Math.min(opt, plan.options.length - 1)];
  const i = plan.options.indexOf(o);
  const own = edits.own?.[String(i)];
  const pr = priceOption(o, prices, plan.stripOut, own);
  const colour = edits.colour ?? DEFAULT_COLOUR;
  const link = pageUrl(row.id);
  const first = row.data?.brief.first ?? '';
  const message = conceptMessage(plan, edits, prices, link, first);
  const mail = row.data?.brief.mail;
  const hide = edits.hide ?? [];
  const labels = o.bays.flatMap((b, bi) => b.sections.filter((s) => s.label).map((s) => ({ bay: bi + 1, text: s.label as string })));
  const copy = (what: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(what);
        setTimeout(() => setCopied(''), 2000);
      },
      () => setCopied(''),
    );
  };
  return (
    <div className={`mt-5 grid gap-4 ${working ? 'opacity-60' : ''}`}>
      {plan.seen ? <p className="rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[14px] leading-relaxed text-muted">{plan.seen}</p> : null}
      {plan.options.length > 1 ? (
        <div className={`grid gap-1.5 ${plan.options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} role="group" aria-label="Options">
          {plan.options.map((x, k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === i}
              onClick={() => setOpt(k)}
              className={`flex min-h-14 flex-col items-start justify-center rounded-sm border px-2.5 py-1.5 text-left ${k === i ? 'border-[var(--sec)] bg-[var(--sec)] text-white' : 'border-line-strong bg-mount'}`}
            >
              <span className="font-mono text-[11px] opacity-85">
                Option {k + 1}
                {x.pick ? ' · pick' : ''}
              </span>
              <span className="text-[14px] font-semibold leading-tight">{x.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-sm border border-line-strong" role="group" aria-label="View">
          {(['front', 'inside'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-10 px-4 text-[14px] font-medium ${view === v ? 'bg-[var(--sec)] text-white' : 'bg-mount'} ${v === 'inside' ? 'border-l border-line-strong' : ''}`}>
              {v === 'front' ? 'Front' : 'Inside'}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-muted">{view === 'front' ? 'Doors closed' : 'Doors off'}</span>
      </div>
      <div className="rounded-sm border border-line bg-white p-2.5">
        <ConceptDrawing option={o} width={plan.width} height={plan.height} view={view} colour={colour} uid={`jk${i}${view[0]}`} />
      </div>
      <p className="text-[15px] leading-relaxed">
        <b className="font-semibold">{o.name}</b> · {o.summary}
        {o.pick && o.why ? <span className="block font-medium jk-sec-ink">Claude’s pick: {o.why}</span> : null}
      </p>
      {labels.length ? (
        <ul className="grid gap-1 text-[14px] leading-snug text-muted">
          {labels.map((l, k) => (
            <li key={k}>
              <span className="font-mono text-[12px] text-faint">Bay {l.bay} · </span>
              {l.text}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="rounded-sm border border-line-strong bg-mount p-3.5" aria-labelledby="cp-price">
        <h2 id="cp-price" className={label}>
          Price · from your price list
        </h2>
        <p className="mt-1.5 font-mono text-[22px] leading-tight">
          {rangeText(pr)} <span className="text-[14px] text-muted">+ VAT</span>
        </p>
        <p className="text-[13px] text-muted">
          {money(pr.low * (1 + VAT))} – {money(pr.high * (1 + VAT))} with VAT · {pr.own ? `your price ${money(pr.total)}` : `worked out at ${money(pr.worked)}`}
        </p>
        <ul className="mt-2.5 grid gap-1 text-[13.5px] text-muted">
          {pr.lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-3">
              <span>{l.label}</span>
              <span className="font-mono">{money(l.amount)}</span>
            </li>
          ))}
        </ul>
        <label className="mt-3 grid gap-1 text-[13px] text-muted">
          Your price for this option (optional, before VAT)
          <input
            inputMode="numeric"
            className={`${field} h-11 font-mono`}
            value={own ? String(own) : ''}
            placeholder={String(pr.worked)}
            onChange={(e) => {
              const v = Number(e.target.value.replace(/\D/g, '')) || 0;
              const next = { ...(edits.own ?? {}) };
              if (v) next[String(i)] = Math.min(v, 999999);
              else delete next[String(i)];
              onChange({ own: next });
            }}
          />
        </label>
      </section>

      <section className="rounded-sm border border-line-strong bg-mount p-3.5" aria-labelledby="cp-size">
        <h2 id="cp-size" className={label}>
          Size and colour
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          <label className="grid gap-1 text-[13px] text-muted">
            Width
            <SizeBox key={plan.width} value={plan.width} max={MAX_W} onSet={(v) => onChange({ width: v })} />
          </label>
          <label className="grid gap-1 text-[13px] text-muted">
            Height
            <SizeBox key={plan.height} value={plan.height} max={MAX_H} onSet={(v) => onChange({ height: v })} />
          </label>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">A new size stretches the drawing and the prices straight away; no Claude needed.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Door colour">
          {COLOURS.map((c) => (
            <button key={c.hex} type="button" aria-pressed={colour === c.hex} onClick={() => onChange({ colour: c.hex })} className={`flex h-10 items-center gap-2 rounded-full border px-3 text-[13.5px] ${colour === c.hex ? 'border-ink' : 'border-line-strong'} bg-mount`}>
              <span aria-hidden className="h-5 w-5 rounded-full border border-line-strong" style={{ background: c.hex }} />
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-line-strong bg-mount p-3.5" aria-labelledby="cp-change">
        <h2 id="cp-change" className={label}>
          Change something
        </h2>
        <form
          className="mt-2 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) {
              onRedraw(note.trim());
              setNote('');
            }
          }}
        >
          <label className="grid gap-1 text-[13px] text-muted">
            Tell Claude what to change
            <input className={`${field} h-11 text-[15px]`} value={note} maxLength={800} placeholder="e.g. make the broom cupboard narrower" onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!note.trim() || working} className="btn btn-ghost btn-sm">
              <Spark className="h-4 w-4" /> Redraw
            </button>
            <button type="button" onClick={onBrief} className="h-10 text-[14px] text-muted underline">
              Change the brief
            </button>
          </div>
        </form>
      </section>

      <section className="jk-sec-designs rounded-sm border-2 border-[var(--sec)] bg-mount p-3.5" aria-labelledby="cp-page">
        <h2 id="cp-page" className="font-mono text-[12.5px] uppercase tracking-[0.06em] jk-sec-ink">
          Their page
        </h2>
        {edits.live ? (
          <>
            <p className="mt-2 flex items-center gap-2 rounded-sm border border-line-strong bg-white px-3 py-2.5 font-mono text-[14px] [overflow-wrap:anywhere]">{link.replace(/^https?:\/\//, '')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy('link', link)} className="btn btn-ghost btn-sm">
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </button>
              <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                Open their page
              </a>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">Private: only people with this link can open it. No login, no Claude account.</p>
          </>
        ) : (
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">Put it online to get a private link: no login, no Claude account. Nobody sees it until you do.</p>
        )}
        <fieldset className="mt-3 grid gap-0.5">
          <legend className="sr-only">What their page shows</legend>
          {plan.options.map((x, k) => (
            <label key={k} className="flex min-h-10 items-center gap-2.5 text-[14.5px]">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--sec)]"
                checked={!hide.includes(k)}
                disabled={!hide.includes(k) && plan.options.length - hide.length <= 1}
                onChange={(e) => onChange({ hide: e.target.checked ? hide.filter((h) => h !== k) : [...hide, k] })}
              />
              Option {k + 1} · {x.name}
              {x.pick ? ' (pick)' : ''}
            </label>
          ))}
          <label className="flex min-h-10 items-center gap-2.5 border-t border-line pt-1 text-[14.5px]">
            <input type="checkbox" className="h-5 w-5 accent-[var(--sec)]" checked={edits.prices !== false} onChange={(e) => onChange({ prices: e.target.checked })} />
            Show the prices
          </label>
          <label className="flex min-h-10 items-center gap-2.5 text-[14.5px]">
            <input type="checkbox" className="h-5 w-5 accent-[var(--sec)]" checked={edits.inside !== false} onChange={(e) => onChange({ inside: e.target.checked })} />
            Show the inside view
          </label>
        </fieldset>
        {edits.live ? (
          <div className="mt-3 grid gap-2">
            {mail ? (
              <button type="button" onClick={() => onEmail(mail, message)} className="btn btn-primary w-full">
                Email it from info@
              </button>
            ) : (
              <button type="button" onClick={() => copy('message', message)} className="btn btn-primary w-full">
                {copied === 'message' ? 'Copied: paste it in your email' : 'Copy the email'}
              </button>
            )}
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn w-full bg-[#25d366] text-[#0b2e18] hover:bg-[#1ebe5d]">
              Send on WhatsApp
            </a>
            <button type="button" onClick={() => onChange({ live: false })} className="h-10 text-[14px] text-muted underline">
              Take their page down
            </button>
          </div>
        ) : (
          <button type="button" disabled={working} onClick={() => onChange({ live: true, liveAt: Date.now() })} className="btn mt-3 w-full bg-[var(--sec)] text-white hover:opacity-90">
            Put it online and get the link
          </button>
        )}
        <details className="mt-3">
          <summary className="min-h-10 cursor-pointer py-2 text-[14px] font-semibold">The email it writes</summary>
          <p className="whitespace-pre-line rounded-sm border border-line bg-white px-3 py-2.5 text-[14px] leading-relaxed">{message}</p>
          <p className="mt-1.5 text-[12.5px] text-muted">{mail ? 'Email it puts this in the reply to their email; change anything before you press Send.' : 'Copy it into your email or ServiceM8.'}</p>
        </details>
      </section>
    </div>
  );
}

function SizeBox({ value, max, onSet }: { value: number; max: number; onSet: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  const done = () => {
    const n = Number(v.replace(/\D/g, ''));
    if (n >= 300 && n <= max && n !== value) onSet(n);
    else setV(String(value));
  };
  return <input inputMode="numeric" className={`${field} h-11 font-mono`} value={v} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />;
}
