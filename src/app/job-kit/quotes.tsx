'use client';
/* eslint-disable @next/next/no-img-element -- photos from the job's diary, fetched behind the PIN */
import { useEffect, useMemo, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import type { QuoteData, QuoteRow } from '@/lib/quote-maker';
import { BOARDS, BOARDS_CHECKED, FAMILY_NAME, FAMILY_ORDER, INSIDE_DEFAULT, PRICE_BASE } from '@/lib/cworkshop-boards';
import { fillWall } from '@/lib/pax-brief';
import {
  boardWork,
  fromPrice,
  money,
  money2,
  NOTE_MAX,
  optionsFor,
  ownPrices,
  picked,
  PRICE_ROWS,
  pricesWith,
  quoteMessage,
  sizesOf,
  withVat,
  type Board,
  type From,
  type Option,
  type PriceKey,
  type Prices,
  type QuoteEdits,
  type QuoteRead,
  type Split,
} from '@/lib/quote-sums';
import { Icon } from './icons';
import { field, fieldSized, label } from './parts';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { SecIcon } from './job-menu';
import { fileBlob, Thumb } from './job-notes';
import { shown, stage, wa, type Marks, type Sm8 } from './current';
import Mark from './mark';

/* Quotes in the Job Kit (2 Nov 2026, Raf: 'if new job come through from email to service m8 with pictures I'd like
   you to be in jobkit analyse it and create answer with proposed quote price ... various options to copy and paste
   ... plain design, ikea pax with mdf outside, custom mdf shaker and match colour from Cworkshop with their prices.
   I will approve or change prices once your quotes are ready').
   Claude reads each new Quote job in ServiceM8, its description and the photos in its diary (src/lib/quote-maker.ts),
   and says what it sees: sizes, insides, colours, what to check and ask. The prices are Raf's, worked out here from
   his price list (src/lib/quote-sums.ts), and he can change any of them before sending. Nothing goes to the
   customer until he sends it (copy, WhatsApp, or the job's email box).
   Kept in Supabase (jobkit.quotes, /api/job-kit/quote), so the phone and the computer show the same quote and his
   changes; the last list stays on the device (raf_jobkit_quotes) so it opens with no signal, and changes made with
   no signal wait (raf_jobkit_quote_pend) and go when it's back.
   Raf's own instructions for Claude (2 Nov 2026, Raf: 'in quotes in jobkit I'd like a section where I can add my
   instructions for to redo the quotes'): written on the Quotes screen, kept as row '_rules' beside his prices, sent
   to Claude with every reading after that (src/lib/quote-maker.ts). Quotes read before he changed them can be
   redone with them, one at a time (raf_jobkit_quote_redo, run by job-kit-app.tsx). */

/* ---------- the list, kept on the device ---------- */

type Setting = { data: Record<string, unknown> | null; at: number } | null;
export type Quotes = { rows: QuoteRow[]; prices: Setting; rules?: Setting; at: number; error?: string; detail?: string };
const KEY = 'raf_jobkit_quotes';
const PEND = 'raf_jobkit_quote_pend'; // id -> { edits, at }: Raf's changes not in the store yet ('_prices' = his price list, '_rules' his instructions)
const REDO = 'raf_jobkit_quote_redo'; // quotes to read again with his instructions, one at a time
export const RULES_MAX = 3000;
export const QUOTES_FRESH = 60_000;
const STUCK_MS = 4 * 60_000; // a reading 'working' for longer stopped part way (the function ran out of time)

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

export const savedQuotes = (): Quotes => read<Quotes>(KEY, { rows: [], prices: null, at: 0 });
/* The kept list with changes still waiting laid over it (opening the app with no signal). */
export const checkedQuotes = (q: Quotes) => withPending(q);

/* Put the message in the job's email box (mail.tsx reads it when the job opens), to send through ServiceM8. */
export function putInEmailBox(uuid: string, draft: { mode: 'email'; to: string; subject: string; text: string }) {
  const all = read<Record<string, unknown>>('raf_jobkit_mail_drafts', {});
  delete all[uuid];
  write('raf_jobkit_mail_drafts', Object.fromEntries(Object.entries({ [uuid]: draft, ...all }).slice(0, 25)));
}
export const keepQuotes = (q: Quotes) => write(KEY, { ...q, rows: q.rows.slice(0, 60) });

type Pending = Record<string, { edits: Record<string, unknown>; at: number }>;

/* Changes waiting are laid over what the store sent, until the store has them. */
function withPending(q: Quotes): Quotes {
  const pend = read<Pending>(PEND, {});
  let rows = q.rows;
  let prices = q.prices;
  let rules = q.rules ?? null;
  for (const [id, p] of Object.entries(pend)) {
    if (id === '_prices') {
      if (!prices || prices.at < p.at) prices = { data: p.edits, at: p.at };
      continue;
    }
    if (id === '_rules') {
      if (!rules || rules.at < p.at) rules = { data: p.edits, at: p.at };
      continue;
    }
    const r = rows.find((x) => x.id === id);
    if (r && r.editsAt >= p.at) continue;
    rows = r ? rows.map((x) => (x.id === id ? { ...x, edits: p.edits, editsAt: p.at } : x)) : [{ id, state: 'none', data: null, edits: p.edits, editsAt: p.at, claimed: null, updated: p.at }, ...rows];
  }
  return { ...q, rows, prices, rules };
}

export async function fetchQuotes(pin: string, prev: Quotes): Promise<Quotes> {
  const r = await post<{ quotes: QuoteRow[]; prices: Setting; rules?: Setting; now: number }>(pin, { action: 'list' }, '/api/job-kit/quote');
  if (!r.ok) return { ...prev, error: r.error, detail: r.detail };
  // what the store has now is no longer waiting
  const pend = read<Pending>(PEND, {});
  for (const [id, p] of Object.entries(pend)) {
    const have = id === '_prices' ? r.data.prices?.at ?? 0 : id === '_rules' ? r.data.rules?.at ?? 0 : r.data.quotes.find((x) => x.id === id)?.editsAt ?? 0;
    if (have >= p.at) delete pend[id];
  }
  write(PEND, pend);
  const next = withPending({ rows: r.data.quotes, prices: r.data.prices, rules: r.data.rules ?? null, at: Date.now() });
  keepQuotes(next);
  if (Object.keys(pend).length) void flushQuoteEdits();
  return next;
}

/* Raf's change to one quote (or his prices, id '_prices', or his instructions, '_rules'): on the device at once, in
   the store a moment later. */
export function changeHere(q: Quotes, id: string, edits: Record<string, unknown>): Quotes {
  const at = Date.now();
  const pend = read<Pending>(PEND, {});
  pend[id] = { edits, at };
  write(PEND, pend);
  const next =
    id === '_prices'
      ? { ...q, prices: { data: edits, at } }
      : id === '_rules'
        ? { ...q, rules: { data: edits, at } }
        : { ...q, rows: q.rows.some((r) => r.id === id) ? q.rows.map((r) => (r.id === id ? { ...r, edits, editsAt: at } : r)) : [{ id, state: 'none' as const, data: null, edits, editsAt: at, claimed: null, updated: at }, ...q.rows] };
  keepQuotes(next);
  queueFlush();
  return next;
}

let flushTimer: ReturnType<typeof setTimeout> | undefined;
const queueFlush = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushQuoteEdits(), 900);
};
/* Sends the changes waiting. A second call while one is going waits for it, then sends what came in meanwhile, so a
   redo started straight after saving his instructions always finds them in the store. */
let flushing: Promise<void> | null = null;
export async function flushQuoteEdits(): Promise<void> {
  if (flushing) {
    await flushing;
    if (!Object.keys(read<Pending>(PEND, {})).length) return;
    if (flushing) return flushing;
  }
  flushing = flushOnce().finally(() => (flushing = null));
  return flushing;
}
async function flushOnce() {
  const pin = readPin();
  if (!pin) return;
  for (const [id, p] of Object.entries(read<Pending>(PEND, {}))) {
    const body = id === '_prices' ? { action: 'prices', prices: p.edits, at: p.at } : id === '_rules' ? { action: 'rules', rules: p.edits, at: p.at } : { action: 'edit', id, edits: p.edits, at: p.at };
    const r = await post<{ ok: boolean; editsAt: number }>(pin, body, '/api/job-kit/quote');
    if (!r.ok) {
      if (r.error === 'offline' || r.error === 'sync-down') break; // tried again when the list is next fetched
      continue;
    }
    const now = read<Pending>(PEND, {});
    if (now[id] && now[id].at <= p.at) delete now[id];
    write(PEND, now);
  }
}

/* Claude reads the job (after the server has answered, so this is quick): 'working', or the state already there. */
export const askQuote = (pin: string, job: string, force = false, note = '') => post<{ state: string }>(pin, { action: 'make', job, force, note }, '/api/job-kit/quote');

/* A reading said to be under way: shown as working on the device until the store says otherwise. */
export function workingHere(q: Quotes, id: string): Quotes {
  const now = Date.now();
  const r = q.rows.find((x) => x.id === id);
  const row: QuoteRow = r ? { ...r, state: 'working', claimed: now, updated: now } : { id, state: 'working', data: null, edits: null, editsAt: 0, claimed: now, updated: now };
  return { ...q, rows: [row, ...q.rows.filter((x) => x.id !== id)] };
}

/* His price list over where it starts: his own prices, Cworkshop's service prices from content/cworkshop.json. */
export const pricesOf = (q: Quotes): Prices => pricesWith(q.prices?.data, PRICE_BASE);
/* His instructions for Claude: the words, and when he last changed them (0 = never). */
export const rulesOf = (q: Quotes) => ({ text: typeof q.rules?.data?.text === 'string' ? q.rules.data.text : '', at: q.rules?.at ?? 0 });
/* Instructions saved here and not in the store yet: a redo waits for them, so Claude reads the new ones. */
export const rulesWaiting = () => Boolean(read<Pending>(PEND, {})._rules);
/* A ready reading made before his latest instructions (or before he wrote any, once he has). */
export const readBefore = (q: Quotes, r: QuoteRow | undefined) => {
  const at = rulesOf(q).at;
  return Boolean(at && readOf(r) && ((r?.data as QuoteData | null)?.rulesAt ?? 0) < at);
};
/* Ready quotes, not sent, read before his latest instructions: the ones to offer to redo. */
export const readBeforeRules = (q: Quotes, sm8: Sm8, marks: Marks) =>
  quoteEntries(q, sm8, marks)
    .filter((e) => e.group === 'ready' && readBefore(q, e.row))
    .map((e) => e.id);
/* The redo queue, kept on this device so it carries on after a reload. */
export const savedRedo = () => read<string[]>(REDO, []).filter((x) => typeof x === 'string').slice(0, 40);
export const keepRedo = (ids: string[]) => write(REDO, ids.slice(0, 40));
export const rowOf = (q: Quotes, id: string) => q.rows.find((r) => r.id === id);
export const stuck = (r: QuoteRow) => r.state === 'working' && Date.now() - (r.claimed ?? r.updated) > STUCK_MS;
export const isWorking = (r: QuoteRow | undefined) => Boolean(r && r.state === 'working' && !stuck(r));
const editsOf = (r: QuoteRow | undefined) => (r?.edits ?? {}) as QuoteEdits;
/* His instructions for one quote: the ones saved on it, else the ones its last reading used (before 2 Nov 2026 the
   only place they were kept). Sent with every reading of it, his own redo or Redo all. */
export const ownNote = (r: QuoteRow | undefined) => {
  const e = editsOf(r);
  return typeof e.note === 'string' ? e.note : ((r?.data as QuoteData | null)?.note ?? '');
};
const readOf = (r: QuoteRow | undefined) => (r?.data as QuoteData | null)?.read;

/* ---------- which quote is where ---------- */

type Entry = { id: string; job?: CurrentJob; row?: QuoteRow; group: 'ready' | 'working' | 'failed' | 'none' | 'sent' };
const NEW_DAYS = 14;
const DAY = 86_400_000;
const madeAt = (s: string | null | undefined) => (s ? Date.parse(s.replace(' ', 'T').slice(0, 16)) : NaN); // ServiceM8's London time, read as the device's (London) time
const isSent = (job: CurrentJob | undefined, row: QuoteRow | undefined, marks: Marks) => Boolean(editsOf(row).sentAt) || (job ? job.status !== 'Quote' || ['sent', 'follow'].includes(stage(job, marks)) : false);

export function quoteEntries(q: Quotes, sm8: Sm8, marks: Marks): Entry[] {
  const jobs = shown(sm8, marks);
  const byId = new Map(sm8.jobs.map((j) => [j.uuid, j]));
  const out: Entry[] = [];
  const seen = new Set<string>();
  for (const row of q.rows) {
    const job = byId.get(row.id);
    if (job && (marks[job.uuid]?.hidden || job.status === 'Unsuccessful')) continue;
    let group: Entry['group'];
    if (isWorking(row)) group = 'working';
    else if (readOf(row)) group = isSent(job, row, marks) ? 'sent' : 'ready';
    else if (row.state === 'failed' || stuck(row)) group = 'failed';
    else continue; // only Raf's changes, no reading yet: it shows as not worked out below
    seen.add(row.id);
    out.push({ id: row.id, job, row, group });
  }
  for (const j of jobs) {
    if (seen.has(j.uuid) || j.status !== 'Quote' || stage(j, marks) !== 'new') continue;
    out.push({ id: j.uuid, job: j, group: 'none' });
  }
  return out;
}

/* New Quote jobs the Job Kit reads by itself: in ServiceM8 for the last 14 days, quote not sent, nothing read yet.
   Not in the first 15 minutes (photos from WhatsApp follow the job), and never one that failed (Raf asks again). */
export function toRead(q: Quotes, sm8: Sm8, marks: Marks): string[] {
  if (!q.at || q.error) return [];
  const now = Date.now();
  return shown(sm8, marks)
    .filter((j) => {
      if (j.status !== 'Quote' || stage(j, marks) !== 'new' || q.rows.some((r) => r.id === j.uuid && (r.data || r.state !== 'none'))) return false;
      const t = madeAt(j.created);
      return Number.isFinite(t) && now - t < NEW_DAYS * DAY && now - t > 15 * 60_000;
    })
    .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
    .map((j) => j.uuid);
}

/* For Today: the quotes ready to check. */
export function quoteTodayLines(q: Quotes, sm8: Sm8, marks: Marks): { text: string; id?: string }[] {
  const ready = quoteEntries(q, sm8, marks).filter((e) => e.group === 'ready');
  if (!ready.length) return [];
  if (ready.length <= 2) return ready.map((e) => ({ text: `Rough quote ready to check: ${e.job?.name ?? (e.row?.data as QuoteData | null)?.job?.first ?? 'an enquiry'}`, id: e.id }));
  return [{ text: `${ready.length} rough quotes ready to check` }];
}

export function quotesLine(q: Quotes, sm8: Sm8, marks: Marks) {
  if (q.error === 'quotes-not-set-up') return 'Not switched on yet';
  const e = quoteEntries(q, sm8, marks);
  const n = (g: Entry['group']) => e.filter((x) => x.group === g).length;
  const bits = [n('ready') ? `${n('ready')} ready to check` : '', n('working') ? `${n('working')} being worked out` : '', n('none') ? `${n('none')} not worked out` : ''].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Rough prices for new enquiries, from your price list';
}
export const readyCount = (q: Quotes, sm8: Sm8, marks: Marks) => quoteEntries(q, sm8, marks).filter((e) => e.group === 'ready').length;

/* What went wrong, in plain words. */
export function quoteProblem(code?: string, detail?: string) {
  switch (code) {
    case 'quotes-not-set-up':
      return 'Quotes aren’t switched on yet: they need ANTHROPIC_API_KEY and the Job Kit’s sync settings in Vercel.';
    case 'no-text':
      return 'There’s nothing to read yet: no description, notes or photos on the job in ServiceM8. Add some, then work it out again.';
    case 'sm8-gone':
      return 'ServiceM8 doesn’t have this job any more.';
    case 'ai-error':
      return `Claude couldn’t read it${detail ? ` (${detail})` : ''}. Try again, or write the quote yourself.`;
    case 'ai-busy':
      return 'Claude is busy or didn’t answer. Try again in a minute.';
    case 'sync-down':
      return 'The quotes store isn’t answering. Try again in a minute.';
    case 'sync-key':
      return 'The quotes store turned the key down: JOBKIT_SYNC_SECRET in Vercel needs a look.';
    case 'stuck':
      return 'It stopped part way through. Try again.';
    default:
      return problemText(code, detail);
  }
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};

/* ---------- the list ---------- */

const GROUPS: { id: Entry['group']; title: string }[] = [
  { id: 'ready', title: 'Ready to check' },
  { id: 'working', title: 'Being worked out' },
  { id: 'failed', title: 'Couldn’t work it out' },
  { id: 'none', title: 'Not worked out yet' },
  { id: 'sent', title: 'Sent' },
];

export function QuotesList({
  quotes,
  sm8,
  marks,
  loading,
  redoLeft,
  onRefresh,
  onOpen,
  onMake,
  onPrices,
  onCworkshop,
  onSaveRules,
  onRedo,
}: {
  quotes: Quotes;
  sm8: Sm8;
  marks: Marks;
  loading: boolean;
  redoLeft: number;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onMake: (id: string) => void;
  onPrices: () => void;
  onCworkshop: () => void;
  onSaveRules: (text: string) => void;
  onRedo: (ids: string[]) => void;
}) {
  const entries = useMemo(() => quoteEntries(quotes, sm8, marks), [quotes, sm8, marks]);
  const before = useMemo(() => readBeforeRules(quotes, sm8, marks), [quotes, sm8, marks]);
  const prices = pricesOf(quotes);
  const [allSent, setAllSent] = useState(false);
  return (
    <div className="pt-7">
      <p className="kicker">Read by Claude · priced from your list</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="quote" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Quotes
      </h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
        Each new enquiry in ServiceM8 is read with its photos: the sizes, what they want, colours that suit the room. The prices come from your price list, and nothing goes to the customer until you send it.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onPrices} className="btn btn-ghost btn-sm">
          Your prices
        </button>
        <button type="button" onClick={onCworkshop} className="btn btn-ghost btn-sm gap-2" data-open-cworkshop>
          <Icon name="swatch" className="h-[18px] w-[18px] shrink-0" />
          Cworkshop
        </button>
        <button type="button" onClick={onRefresh} disabled={loading} className="font-mono text-[13px] text-accent underline disabled:opacity-60">
          {loading ? 'Checking…' : 'Refresh'}
        </button>
        <span className="font-mono text-[12.5px] text-faint">{quotes.at ? `Checked ${ago(quotes.at)}` : ''}</span>
      </div>
      {quotes.error ? <p className="mt-4 rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-[15px] leading-relaxed">{quoteProblem(quotes.error, quotes.detail)}</p> : null}

      <Instructions rules={rulesOf(quotes)} before={before} redoLeft={redoLeft} onSave={onSaveRules} onRedo={() => onRedo(before)} />

      {!entries.length ? (
        <p className="mt-8 font-mono text-[14px] text-faint">{sm8.at ? 'No new enquiries to quote.' : 'Getting your jobs from ServiceM8…'}</p>
      ) : null}

      {GROUPS.map((g) => {
        let list = entries.filter((e) => e.group === g.id);
        if (!list.length) return null;
        const more = g.id === 'sent' && !allSent && list.length > 5 ? list.length - 5 : 0;
        if (more) list = list.slice(0, 5);
        return (
          <section key={g.id} className="mt-7">
            <h2 className={label}>
              {g.title} ({entries.filter((e) => e.group === g.id).length})
            </h2>
            <ul className="mt-2 grid grid-cols-1 gap-2.5">
              {list.map((e) => (
                <li key={e.id}>
                  <QuoteCard entry={e} prices={prices} old={before.includes(e.id)} onOpen={() => onOpen(e.id)} onMake={() => onMake(e.id)} />
                </li>
              ))}
            </ul>
            {more ? (
              <button type="button" onClick={() => setAllSent(true)} className="mt-2 font-mono text-[13px] text-accent underline">
                Show {more} more
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/* ---------- his instructions for Claude ---------- */

const EXAMPLES = [
  'Assume a 2,400 mm ceiling unless the photos show otherwise.',
  'Don’t offer IKEA PAX unless they ask for it.',
  'Recommend shaker doors for period houses.',
  'Always ask for a photo of the whole wall.',
  'Keep the opening to one short sentence.',
  'In every message, say they can send more photos on WhatsApp.',
];

const when = (t: number) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '');

function Instructions({ rules, before, redoLeft, onSave, onRedo }: { rules: { text: string; at: number }; before: string[]; redoLeft: number; onSave: (text: string) => void; onRedo: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [all, setAll] = useState(false);
  const [saved, setSaved] = useState(false);
  const lines = rules.text.split('\n');
  const long = lines.length > 4 || rules.text.length > 320;
  const open = () => {
    setDraft(rules.text);
    setEditing(true);
    setSaved(false);
  };
  const add = (line: string) => setDraft((d) => (d.includes(line) ? d : `${d.trim() ? `${d.trimEnd()}\n` : ''}${line}`).slice(0, RULES_MAX));
  return (
    <section className="mt-5 rounded-sm border border-line-strong bg-mount p-4" aria-label="Your instructions for Claude" data-rules>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Your instructions for Claude</h2>
        {!editing && rules.text ? (
          <button type="button" onClick={open} className="shrink-0 font-mono text-[13px] text-accent underline">
            Change them
          </button>
        ) : null}
      </div>
      {editing ? (
        <>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            In your own words. Claude follows them on every quote: what to assume, which options to offer or leave out, what to recommend and ask, and how the message reads. The prices come from Your prices.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, RULES_MAX))}
            rows={8}
            maxLength={RULES_MAX}
            autoFocus
            placeholder="e.g. Assume a 2,400 mm ceiling unless the photos show otherwise. Don’t offer IKEA PAX unless they ask for it."
            aria-label="Your instructions for Claude"
            className={`${field} mt-3 py-2.5 text-[15.5px] leading-relaxed`}
          />
          <p className="mt-1 text-right font-mono text-[11.5px] text-faint">
            {draft.length.toLocaleString('en-GB')} / {RULES_MAX.toLocaleString('en-GB')}
          </p>
          <p className={`${label} mt-2`}>Add an example</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EXAMPLES.map((x) => (
              <button key={x} type="button" onClick={() => add(x)} disabled={draft.includes(x)} className="rounded-sm border border-line-strong bg-paper px-2.5 py-1.5 text-left text-[13.5px] leading-snug hover:border-ink disabled:opacity-40">
                + {x}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={draft.trim() === rules.text.trim()}
              onClick={() => {
                onSave(draft.trim());
                setEditing(false);
                setSaved(true);
              }}
              className="btn btn-primary btn-sm disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </>
      ) : rules.text ? (
        <>
          <p className={`mt-2 whitespace-pre-line text-[15px] leading-relaxed ${long && !all ? 'line-clamp-4' : ''}`}>{rules.text}</p>
          {long ? (
            <button type="button" onClick={() => setAll(!all)} className="mt-1 font-mono text-[13px] text-accent underline">
              {all ? 'Show less' : 'Show all'}
            </button>
          ) : null}
          <p className="mt-2 font-mono text-[12px] text-faint">
            {saved ? 'Saved. ' : ''}Used on every quote read after {when(rules.at)}.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            {rules.at ? 'None at the moment. ' : ''}Tell Claude how you want your quotes worked out, in your own words: what to assume, what to offer, what to ask. It follows them on every quote.
          </p>
          <button type="button" onClick={open} className="btn btn-ghost btn-sm mt-3">
            Write your instructions
          </button>
        </>
      )}
      {redoLeft ? (
        <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[15px]">
          <Mark state="sending" /> Redoing with your instructions: {redoLeft} to go.
        </p>
      ) : before.length && !editing ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[15px] leading-relaxed">
            {before.length === 1 ? '1 ready quote was' : `${before.length} ready quotes were`} worked out before {rules.text ? 'these instructions' : 'you cleared your instructions'}.
          </p>
          <button type="button" onClick={onRedo} className="btn btn-primary btn-sm mt-2.5">
            {before.length === 1 ? 'Redo it' : `Redo all ${before.length}`}
            {rules.text ? ' with them' : ''}
          </button>
          <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-faint">One at a time, a few pence each. Your prices stay; the message and its questions are written out again.</p>
        </div>
      ) : null}
    </section>
  );
}

function QuoteCard({ entry, prices, old, onOpen, onMake }: { entry: Entry; prices: Prices; old: boolean; onOpen: () => void; onMake: () => void }) {
  const { job, row } = entry;
  const data = row?.data as QuoteData | null | undefined;
  const r = data?.read;
  const name = job?.name ?? data?.job?.first ?? 'Enquiry';
  const area = job?.area ?? data?.job?.area ?? '';
  const num = job?.number ?? data?.job?.number ?? '';
  const edits = editsOf(row);
  const from = r ? fromPrice(optionsFor(r, prices, BOARDS, edits, fillWall), edits) : 0;
  const line =
    entry.group === 'working'
      ? 'Claude is reading the brief and photos…'
      : entry.group === 'failed'
        ? quoteProblem(stuck(row!) ? 'stuck' : data?.error, '').split('. ')[0]
        : entry.group === 'none'
          ? (job?.description ?? '').split('\n')[0].slice(0, 90) || 'Not read yet'
          : r
            ? `${r.title}${from ? ` · from ${money(from)} + VAT` : ''}`
            : '';
  if (entry.group === 'none')
    return (
      <div data-jk-id={entry.id} className="flex items-center gap-3 rounded-sm border border-line-strong bg-mount px-3.5 py-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className="block truncate text-[14px] text-muted">{line}</span>
        </span>
        <button type="button" onClick={onMake} className="btn btn-primary btn-sm shrink-0">
          Work it out
        </button>
      </div>
    );
  return (
    <button type="button" data-jk-id={entry.id} onClick={onOpen} className="flex w-full items-center gap-3 rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-left transition-colors hover:border-ink">
      <Mark state={entry.group === 'ready' ? 'waiting' : entry.group === 'working' ? 'sending' : entry.group === 'sent' ? 'sent' : 'lost'} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-semibold">{name}</span>
          <span className="shrink-0 font-mono text-[12px] text-faint">
            {num ? `#${num}` : ''}
            {area ? ` · ${area}` : ''}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[14px] text-muted">{line}</span>
        {old ? <span className="mt-0.5 block font-mono text-[11.5px] text-faint">Read before your latest instructions</span> : null}
      </span>
      <span aria-hidden className="text-[20px] jk-sec-ink">
        →
      </span>
    </button>
  );
}

/* ---------- on a ServiceM8 job's screen ---------- */

export function QuoteJobBox({ job, row, prices, onOpen, onMake }: { job: CurrentJob; row?: QuoteRow; prices: Prices; onOpen: () => void; onMake: () => void }) {
  if (job.status !== 'Quote' && !readOf(row)) return null;
  const data = row?.data as QuoteData | null | undefined;
  const r = data?.read;
  const edits = editsOf(row);
  const options = r ? optionsFor(r, prices, BOARDS, edits, fillWall) : [];
  const n = options.filter((o) => picked(o, edits)).length;
  const working = isWorking(row);
  return (
    <section
      id="quote"
      data-jsec="quote"
      data-jsec-note={working ? '…' : r ? (edits.sentAt ? 'sent' : 'ready') : ''}
      data-jsec-alert={r && !edits.sentAt ? '1' : undefined}
      className="mt-6 rounded-sm border border-line-strong bg-mount p-4"
      aria-label="Rough quote"
    >
      <p className="flex items-center gap-2.5 text-[19px] font-[650]">
        <SecIcon k="quote" />
        Rough quote
      </p>
      {working ? (
        <p className="mt-2 flex items-center gap-2 text-[15px] text-muted">
          <Mark state="sending" /> Claude is reading the brief and photos. Usually under a minute.
        </p>
      ) : r ? (
        <>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
            {r.title}: {n} option{n === 1 ? '' : 's'}, from {money(fromPrice(options, edits))} + VAT. {edits.sentAt ? 'Sent.' : 'Ready for you to check.'}
          </p>
          <button type="button" onClick={onOpen} className="btn btn-primary btn-sm mt-3">
            Open the quote
          </button>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{row && row.state !== 'none' ? quoteProblem(stuck(row) ? 'stuck' : data?.error, data?.error === 'ai-error' ? '' : undefined) : 'Claude reads the brief and photos and prices it from your list, for you to check.'}</p>
          <button type="button" onClick={onMake} className="btn btn-ghost btn-sm mt-3">
            {row && row.state !== 'none' ? 'Try again' : 'Work it out'}
          </button>
        </>
      )}
    </section>
  );
}

/* ---------- his instructions for one quote ---------- */

const OWN_EXAMPLES = ['The ceiling is 2,600 mm.', 'Leave out IKEA PAX.', 'They want sliding doors.', 'Price the two alcoves separately.', 'Ask if they want lights inside.', 'Make the message shorter.'];

function QuoteOwn({
  saved,
  used,
  hasRead,
  failed,
  working,
  first,
  everyQuote,
  onSave,
  onRedo,
  onRules,
}: {
  saved: string;
  used: string | null; // what the reading on screen was made with (null: nothing read yet)
  hasRead: boolean;
  failed: boolean;
  working: boolean;
  first: string;
  everyQuote: boolean;
  onSave: (text: string) => void;
  onRedo: (text: string) => void;
  onRules: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [all, setAll] = useState(false);
  const [just, setJust] = useState('');
  const text = saved.trim();
  const fresh = !hasRead || (used ?? '').trim() === text; // nothing to redo for
  const long = text.split('\n').length > 4 || text.length > 320;
  const go = hasRead ? 'Redo it' : failed ? 'Try again' : 'Work it out';
  const open = () => {
    setDraft(saved);
    setEditing(true);
    setJust('');
  };
  const add = (line: string) => setDraft((d) => (d.includes(line) ? d : `${d.trim() ? `${d.trimEnd()}\n` : ''}${line}`).slice(0, NOTE_MAX));
  const keep = (redo: boolean) => {
    const t = draft.replace(/\r\n?/g, '\n').trim();
    onSave(t);
    setEditing(false);
    if (redo) {
      onRedo(t);
      setJust('');
    } else setJust(t ? 'Saved.' : 'Cleared.');
  };
  return (
    <section className="mt-5 rounded-sm border border-line-strong bg-mount p-4" aria-label="Instructions for this quote" data-own>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Instructions for this quote</h2>
        {!editing && text ? (
          <button type="button" onClick={open} className="shrink-0 font-mono text-[13px] text-accent underline">
            Change them
          </button>
        ) : null}
      </div>
      {editing ? (
        <>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            Just for {first || 'this one'}: a size you know, what to leave out, what to ask, how the message reads. {everyQuote ? 'Where they differ from your instructions for every quote, these win.' : ''} The prices still come from Your prices.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX))}
            rows={4}
            maxLength={NOTE_MAX}
            autoFocus
            placeholder="e.g. The ceiling is 2,600 mm. Leave out IKEA PAX."
            aria-label="Instructions for this quote"
            className={`${field} mt-3 py-2.5 text-[15.5px] leading-relaxed`}
          />
          <p className="mt-1 text-right font-mono text-[11.5px] text-faint">
            {draft.length.toLocaleString('en-GB')} / {NOTE_MAX.toLocaleString('en-GB')}
          </p>
          <p className={`${label} mt-1`}>Add an example</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {OWN_EXAMPLES.map((x) => (
              <button key={x} type="button" onClick={() => add(x)} disabled={draft.includes(x)} className="rounded-sm border border-line-strong bg-paper px-2.5 py-1.5 text-left text-[13.5px] leading-snug hover:border-ink disabled:opacity-40">
                + {x}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={working} onClick={() => keep(true)} className="btn btn-primary btn-sm disabled:opacity-50">
              Save and {go.charAt(0).toLowerCase()}
              {go.slice(1)}
            </button>
            <button type="button" disabled={draft.trim() === text} onClick={() => keep(false)} className="btn btn-ghost btn-sm disabled:opacity-50">
              Save only
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
          {working ? <p className="mt-2 font-mono text-[12px] text-faint">Claude is reading it now: save only, or wait a moment to redo it.</p> : null}
        </>
      ) : (
        <>
          {text ? (
            <>
              <p className={`mt-2 whitespace-pre-line text-[15px] leading-relaxed ${long && !all ? 'line-clamp-4' : ''}`}>{text}</p>
              {long ? (
                <button type="button" onClick={() => setAll(!all)} className="mt-1 font-mono text-[13px] text-accent underline">
                  {all ? 'Show less' : 'Show all'}
                </button>
              ) : null}
            </>
          ) : (
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
              {hasRead && (used ?? '').trim() ? 'None now. ' : ''}Want something different on this one? Tell Claude here: a size you know, what to leave out, what to ask.
            </p>
          )}
          {working ? (
            <p className="mt-2 font-mono text-[12px] text-faint">{text ? 'Claude is reading it with these now.' : 'Claude is reading it now.'}</p>
          ) : !fresh ? (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[15px] leading-relaxed">{text ? 'Saved, not used yet: the quote below was worked out before these.' : 'The quote below still used the ones you cleared.'}</p>
              <button type="button" onClick={() => onRedo(text)} className="btn btn-primary btn-sm mt-2.5">
                Redo it {text ? 'with them' : 'without them'}
              </button>
            </div>
          ) : (
            <p className="mt-2 font-mono text-[12px] text-faint">
              {just ? `${just} ` : ''}
              {text ? (hasRead ? 'Used on the quote below.' : 'Used when Claude works it out.') : ''}
            </p>
          )}
          {!text ? (
            <button type="button" onClick={open} className="btn btn-ghost btn-sm mt-3">
              Write instructions for this quote
            </button>
          ) : null}
        </>
      )}
      <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">
        {everyQuote ? 'Used with ' : 'For every quote, '}
        <button type="button" onClick={onRules} className="text-accent underline">
          {everyQuote ? 'your instructions for every quote' : 'write your instructions'}
        </button>
        {everyQuote ? '.' : ' on Quotes.'}
      </p>
    </section>
  );
}

/* ---------- one quote ---------- */

const FROM_WORD: Record<From, string> = { given: 'from the brief', photo: 'from a photo', guess: 'a guess' };

export function QuoteView({
  job,
  row,
  prices,
  rules,
  sent,
  onEdit,
  onMake,
  onSent,
  onEmailBox,
  onOpenJob,
  onRules,
  onCworkshop,
}: {
  job?: CurrentJob;
  row?: QuoteRow;
  prices: Prices;
  rules: { text: string; at: number };
  sent: boolean;
  onEdit: (edits: QuoteEdits) => void;
  onMake: (force: boolean, note: string) => void;
  onSent: (sent: boolean, how?: QuoteEdits['sentHow']) => void;
  onEmailBox: (subject: string, text: string) => void;
  onOpenJob?: () => void;
  onRules: () => void;
  onCworkshop?: () => void;
}) {
  const data = row?.data as QuoteData | null | undefined;
  const r = data?.read;
  const edits = editsOf(row);
  const working = isWorking(row);
  const [photo, setPhoto] = useState<{ name: string; url: string; error: string } | null>(null);
  const [copied, setCopied] = useState('');
  const set = (patch: Partial<QuoteEdits>) => onEdit({ ...edits, ...patch });
  const first = job?.first || data?.job?.first || '';
  const name = job?.name || first || 'Enquiry';
  const old = Boolean(rules.at && r && (data?.rulesAt ?? 0) < rules.at);
  const withRules = Boolean(r && rules.text && data?.rulesAt && !old);
  const own = ownNote(row);
  const ownFresh = (data?.note ?? '').trim() === own.trim(); // the reading used this quote's instructions as saved
  const ownBox = (
    <QuoteOwn
      saved={own}
      used={r ? (data?.note ?? '') : null}
      hasRead={Boolean(r)}
      failed={Boolean(row && row.state !== 'none')}
      working={working}
      first={first}
      everyQuote={Boolean(rules.text)}
      onSave={(note) => set({ note })}
      onRedo={(note) => onMake(true, note)}
      onRules={onRules}
    />
  );

  const options = r ? optionsFor(r, prices, BOARDS, edits, fillWall) : [];
  const message = r ? edits.text ?? quoteMessage(r, options, edits, first, true) : '';
  const subject = r ? `Rough prices for your ${r.title.charAt(0).toLowerCase()}${r.title.slice(1)}` : '';

  const openPhoto = async (uuid: string, pname: string) => {
    setPhoto({ name: pname, url: '', error: '' });
    const b = await fileBlob(uuid, 'full');
    setPhoto('error' in b ? { name: pname, url: '', error: problemText(b.error, b.detail) } : { name: pname, url: URL.createObjectURL(b.blob), error: '' });
  };
  useEffect(() => {
    if (!photo) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPhoto(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [photo]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const t = document.createElement('textarea');
      t.value = message;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied('Copied. Paste it in WhatsApp, a text or an email.');
  };

  const header = (
    <>
      <p className="kicker">
        Rough quote{job?.number || data?.job?.number ? ` · #${job?.number || data?.job?.number}` : ''}
        {job?.area || data?.job?.area ? ` · ${job?.area || data?.job?.area}` : ''}
      </p>
      <h1 className="mt-1 font-display text-[32px] font-[680] leading-[1.05] tracking-[-0.025em]">{name}</h1>
      {onOpenJob ? (
        <button type="button" onClick={onOpenJob} className="mt-1.5 font-mono text-[13px] text-accent underline">
          Open the job
        </button>
      ) : null}
    </>
  );

  if (!r)
    return (
      <div className="pt-7">
        {header}
        <div className="mt-6 rounded-sm border border-line-strong bg-mount p-4 text-[15.5px] leading-relaxed">
          {working ? (
            <p className="flex items-center gap-2">
              <Mark state="sending" /> Claude is reading the brief and photos. Usually under a minute: this page fills in by itself.
            </p>
          ) : (
            <>
              <p>{row && row.state !== 'none' ? quoteProblem(stuck(row) ? 'stuck' : data?.error, data?.error === 'ai-error' ? data?.detail : undefined) : 'Not worked out yet.'}</p>
              <button type="button" onClick={() => onMake(true, own)} className="btn btn-primary mt-3">
                {row && row.state !== 'none' ? 'Try again' : 'Work it out'}
              </button>
            </>
          )}
        </div>
        {ownBox}
      </div>
    );

  const sizes = sizesOf(r, edits);
  const wr = r.wardrobe;
  const drawers = Math.max(0, Math.round(edits.drawers ?? wr?.drawers ?? 0));
  const top = edits.top ?? wr?.top ?? false;
  const changedWords = typeof edits.text === 'string';
  // the message box as tall as the message, so it reads in one go
  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  return (
    <div className="pt-7">
      {header}
      <p className="mt-3 text-[16px] font-semibold">{r.title}</p>
      {r.summary ? <p className="mt-1 text-[15.5px] leading-relaxed text-muted">{r.summary}</p> : null}
      <p className="mt-2 font-mono text-[12px] text-faint">
        Read {data?.at ? ago(data.at) : ''}
        {data?.photos?.length ? ` from ${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}` : ', no photos'}
        {data?.skipped ? ` (${data.skipped} more on the job not read)` : ''}
        {withRules ? ' · with your instructions' : ''}
        {data?.note ? ' · with this quote’s instructions' : ''}
      </p>
      {old && !working ? (
        <div className="mt-3 rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          Worked out before your latest instructions for every quote.{' '}
          {ownFresh ? (
            <button type="button" onClick={() => onMake(true, own)} className="font-mono text-[13px] text-accent underline">
              Redo it with them
            </button>
          ) : (
            'Redo it below: it uses both.'
          )}
        </div>
      ) : null}
      {working ? (
        <p className="mt-3 flex items-center gap-2 rounded-sm border border-accent bg-accent-soft px-3 py-2.5 text-[15px]">
          <Mark state="sending" /> Reading it again… this updates by itself.
        </p>
      ) : data?.error ? (
        <p className="mt-3 rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[14.5px]">Reading it again didn’t work: {quoteProblem(data.error).toLowerCase()} This is the earlier reading.</p>
      ) : null}

      {data?.photos?.length ? (
        <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {data.photos.map((p) => (
            <Thumb key={p.uuid} file={{ uuid: p.uuid, name: p.name, photo: true }} onOpen={() => void openPhoto(p.uuid, p.name)} />
          ))}
        </div>
      ) : null}

      {ownBox}

      {/* What Claude saw */}
      {r.seen.length || r.check.length || r.budget ? (
        <section className="mt-6 rounded-sm border border-line-strong bg-mount p-4">
          {r.seen.length ? (
            <>
              <h2 className={label}>What Claude saw</h2>
              <ul className="mt-2 grid grid-cols-1 gap-1 text-[15px] leading-relaxed">
                {r.seen.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span aria-hidden className="text-faint">·</span>
                    {s}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {r.budget ? (
            <p className={`${r.seen.length ? 'mt-3' : ''} text-[15px]`}>
              <span className="font-semibold">Their budget:</span> {r.budget}
            </p>
          ) : null}
          {r.check.length ? (
            <>
              <h2 className={`${label} mt-4`}>Check on the visit</h2>
              <ul className="mt-2 grid grid-cols-1 gap-1 text-[15px] leading-relaxed">
                {r.check.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span aria-hidden className="text-faint">□</span>
                    {s}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {/* Sizes */}
      {r.kind === 'wardrobe' ? (
        <section className="mt-6">
          <h2 className={label}>Sizes in mm</h2>
          <p className="mt-1 text-[14px] text-muted">Change any of them: every price follows.</p>
          <div className="mt-2 grid grid-cols-1 gap-2.5">
            {sizes.map((s, i) => (
              <div key={i} className="rounded-sm border border-line-strong bg-mount px-3 py-2.5">
                {sizes.length > 1 || s.label ? <p className="mb-1.5 text-[14.5px] font-semibold">{s.label || `Space ${i + 1}`}</p> : null}
                <div className="grid grid-cols-3 gap-2">
                  {(['w', 'h', 'd'] as const).map((k) => (
                    <label key={k} className="grid grid-cols-1 gap-1">
                      <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint">{k === 'w' ? 'Wide' : k === 'h' ? 'High' : 'Deep'}</span>
                      <NumBox
                        value={s[k]}
                        min={k === 'd' ? 150 : 200}
                        max={k === 'w' ? 12000 : k === 'h' ? 4000 : 1200}
                        onChange={(v) => {
                          const runs = sizes.map((_, j) => ({ ...(edits.runs?.[j] ?? {}) }));
                          runs[i] = { ...runs[i], [k]: v };
                          set({ runs });
                        }}
                        aria={`${s.label || 'Space'} ${k === 'w' ? 'width' : k === 'h' ? 'height' : 'depth'}`}
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 font-mono text-[11.5px] text-faint">
                  Width {FROM_WORD[s.wFrom]}, height {FROM_WORD[s.hFrom]}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Step label="Drawers" value={drawers} min={0} max={24} onChange={(v) => set({ drawers: v })} />
            <label className="flex min-h-11 items-center gap-2 text-[15px]">
              <input type="checkbox" checked={top} onChange={(e) => set({ top: e.target.checked })} className="h-5 w-5 accent-[var(--color-accent)]" />
              Top cupboards over the doors
            </label>
          </div>
          {wr?.inside ? <p className="mt-2 text-[14.5px] text-muted">Inside: {wr.inside}</p> : null}
        </section>
      ) : null}

      {/* The options */}
      <section className="mt-7">
        <h2 className={label}>Prices before VAT</h2>
        <p className="mt-1 text-[14px] text-muted">From your price list. Type your own price on any of them; untick one to leave it out of the message.</p>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {options.map((o) => (
            <OptionCard
              key={o.id}
              option={o}
              on={picked(o, edits)}
              pick={r.recommend === o.id ? r.recommendWhy || 'Claude’s pick' : ''}
              onPick={(v) => set({ pick: { ...edits.pick, [o.id]: v } })}
              onPrice={(v) => {
                const price = { ...edits.price };
                if (v && v !== o.worked) price[o.id] = v;
                else delete price[o.id];
                set({ price });
              }}
              board={o.id === 'board' ? <BoardBits read={r} prices={prices} edits={edits} set={set} onCworkshop={onCworkshop} /> : null}
            />
          ))}
        </div>
      </section>

      {/* Questions */}
      {r.questions.length ? (
        <section className="mt-7">
          <h2 className={label}>Questions in the message</h2>
          <ul className="mt-2 grid grid-cols-1 gap-1">
            {r.questions.map((q, i) => (
              <li key={q}>
                <label className="flex min-h-11 items-start gap-2.5 py-1.5 text-[15px] leading-snug">
                  <input type="checkbox" checked={edits.ask?.[String(i)] ?? true} onChange={(e) => set({ ask: { ...edits.ask, [String(i)]: e.target.checked } })} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]" />
                  {q}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The message */}
      <section className="mt-7 rounded-sm border border-line-strong bg-mount p-4">
        <h2 className={label}>The message</h2>
        <p className="mt-1 text-[14px] text-muted">{changedWords ? 'You’ve changed the words, so changes to prices above don’t reach them.' : 'Written from the options you’ve ticked. Change anything.'}</p>
        <textarea
          ref={grow}
          value={message}
          onChange={(e) => {
            set({ text: e.target.value });
            grow(e.target);
          }}
          rows={10}
          className={`${field} mt-3 py-2.5 text-[15.5px] leading-relaxed`}
          aria-label="The message to the customer"
        />
        {changedWords ? (
          <button type="button" onClick={() => set({ text: undefined })} className="mt-2 font-mono text-[13px] text-accent underline">
            Use the written-out words again
          </button>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => void copy()} className="btn btn-ghost">
            Copy
          </button>
          {job?.mobile ? (
            <a href={wa(job.mobile, message)} target="_blank" rel="noreferrer" className="btn btn-whatsapp" onClick={() => setCopied('Opened WhatsApp with the message typed in.')}>
              WhatsApp {first || 'them'}
            </a>
          ) : (
            <span className="btn btn-ghost pointer-events-none opacity-50">No mobile</span>
          )}
          {job ? (
            <button type="button" onClick={() => onEmailBox(subject, message.replace(/\n+Raf\s*$/, ''))} className="btn btn-ghost">
              Email it
            </button>
          ) : null}
        </div>
        {copied ? <p className="mt-2 font-mono text-[13px] text-muted">{copied}</p> : null}
        <p className="mt-2 font-mono text-[12px] leading-relaxed text-faint">Email it puts it in the job’s email box with the subject, to send through ServiceM8.</p>
        <button
          type="button"
          onClick={() => onSent(!sent, copied.startsWith('Opened') ? 'whatsapp' : copied ? 'copy' : undefined)}
          className={`btn mt-4 w-full ${sent ? 'btn-ghost' : 'btn-primary'}`}
        >
          {sent ? 'Sent ✓ (tap if it wasn’t)' : 'I’ve sent it'}
        </button>
        <p className="mt-1.5 text-center font-mono text-[12px] text-faint">{sent ? 'It shows as Quote sent, with a follow up after 5 days.' : 'Moves the job to Quote sent in the Job Kit.'}</p>
      </section>

      {/* Redo it */}
      <section id="quote-redo" className="mt-7 border-t border-line pt-5">
        <button type="button" onClick={() => onMake(true, own)} disabled={working} className="btn btn-ghost btn-sm disabled:opacity-50">
          Redo this quote
        </button>
        <p className="mt-2 font-mono text-[12px] leading-relaxed text-faint">
          {own.trim() ? 'With the instructions for this quote above. ' : ''}Your prices stay; the message and its questions are written out again. New photos on the job are read too.
        </p>
        <p className="mt-4 font-mono text-[11.5px] leading-relaxed text-faint">
          Rough prices from your list, before the visit. Board prices from Cworkshop, checked {new Date(`${BOARDS_CHECKED}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.{data?.model ? ` Read by ${data.model}.` : ''}
        </p>
      </section>

      {photo ? (
        <div role="dialog" aria-label={photo.name} className="fixed inset-0 z-50 grid place-items-center bg-ink/90 p-3" onClick={() => setPhoto(null)}>
          {photo.url ? <img src={photo.url} alt={photo.name} className="max-h-full max-w-full object-contain" /> : <p className="font-mono text-[14px] text-mount">{photo.error || 'Opening the photo…'}</p>}
          <button type="button" className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] h-11 rounded-sm bg-mount px-4 font-semibold text-ink" onClick={() => setPhoto(null)}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OptionCard({ option: o, on, pick, onPick, onPrice, board }: { option: Option; on: boolean; pick: string; onPick: (v: boolean) => void; onPrice: (v: number) => void; board: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const total = o.lines.reduce((n, l) => n + l.amount, 0);
  return (
    <div data-option={o.id} className={`rounded-sm border bg-mount p-4 ${on ? 'border-ink' : 'border-line-strong'} ${o.offered ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        {o.offered ? <input type="checkbox" checked={on} onChange={(e) => onPick(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]" aria-label={`${o.title} in the message`} /> : null}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[16.5px] font-semibold">{o.title}</span>
            {pick ? <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-[11.5px] text-accent">Claude’s pick</span> : null}
          </p>
          {o.offered ? (
            <p className="mt-1">
              <span className="font-display text-[26px] font-[680] tracking-[-0.02em]">{money(o.price)}</span> <span className="text-[14px] text-muted">+ VAT · {money(withVat(o.price))} with VAT</span>
            </p>
          ) : (
            <p className="mt-1 text-[14.5px] text-muted">Not in the message: {o.why}</p>
          )}
        </div>
      </div>
      {pick && pick !== 'Claude’s pick' ? <p className="mt-2 text-[14px] italic text-muted">{pick}</p> : null}
      {o.offered ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Your price £</span>
            <NumBox value={o.price} min={1} max={500000} onChange={onPrice} aria={`Your price for ${o.title}`} wide />
          </label>
          {o.changed ? (
            <button type="button" onClick={() => onPrice(o.worked)} className="font-mono text-[12.5px] text-accent underline">
              Back to {money(o.worked)}
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-[14.5px] leading-relaxed">{o.says}</p>
      {board}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-3 font-mono text-[12.5px] text-accent underline">
        {open ? 'Hide how it’s worked out' : 'How it’s worked out'}
      </button>
      {open ? (
        <div className="mt-2 rounded-sm border border-line bg-paper px-3 py-2.5">
          <ul className="grid grid-cols-1 gap-1 font-mono text-[12.5px] leading-snug">
            {o.lines.map((l) => (
              <li key={l.label} className="flex justify-between gap-3">
                <span className="text-muted">{l.label}</span>
                <span className="shrink-0">{money2(l.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-line pt-2 font-mono text-[12.5px]">
            Comes to {money2(total)}, rounded up to {money(o.worked)}.
          </p>
          {o.extra ? <p className="mt-1.5 text-[13.5px] text-muted">{o.extra}</p> : null}
        </div>
      ) : null}
    </div>
  );
}


const SPLIT_WORDS: Record<Split, { first: string; second: string; sheets: [string, string] }> = {
  one: { first: 'Colour', second: '', sheets: ['Sheets', ''] },
  outside: { first: 'Colour, outside', second: 'Inside', sheets: ['Sheets outside', 'Sheets inside'] },
  doors: { first: 'Doors', second: 'Frame and inside', sheets: ['Sheets for doors', 'Sheets for the rest'] },
};
const GUESSED: PriceKey[] = ['edgeThinM', 'edgeThickM', 'hingeHole', 'fastFlow', 'delivery'];

function BoardChoice({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`min-h-11 rounded-sm border px-2.5 py-1.5 text-left ${on ? 'border-ink bg-mount ring-1 ring-ink' : 'border-line-strong'}`}>
      <span className="block text-[14px] font-semibold leading-tight">{title}</span>
      <span className="block text-[12px] leading-snug text-muted">{sub}</span>
    </button>
  );
}

function BoardSwatch({ b, why, on, price, onPick }: { b: Board; why?: string; on: boolean; price: number; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={`flex min-h-11 items-center gap-2.5 rounded-sm border px-2.5 py-1.5 text-left ${on ? 'border-ink bg-paper ring-1 ring-ink' : 'border-line-strong'}`}
    >
      <span aria-hidden className="h-8 w-8 shrink-0 rounded-sm border border-line-strong" style={{ background: b.hex }} />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-tight">{b.name}</span>
        <span className="block text-[12.5px] leading-snug text-muted">{why || `${money2(price)} a sheet`}</span>
      </span>
    </button>
  );
}

function ExtraTick({ on, onChange, title, sub, data }: { on: boolean; onChange: (v: boolean) => void; title: string; sub: string; data: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1" data-extra={data}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]" />
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold leading-snug">{title}</span>
        <span className="block text-[12.5px] leading-snug text-muted">{sub}</span>
      </span>
    </label>
  );
}

/* The finished-board option's choices: one board or two (and which parts get which), the decors, sheets and days,
   and Cworkshop's extras. */
function BoardBits({ read: r, prices, edits, set, onCworkshop }: { read: QuoteRead; prices: Prices; edits: QuoteEdits; set: (p: Partial<QuoteEdits>) => void; onCworkshop?: () => void }) {
  const [all, setAll] = useState(false);
  const picks = r.colours.map((c) => ({ board: BOARDS.find((b) => b.code === c.code)!, why: c.why })).filter((c) => c.board);
  const colour = edits.colour ?? picks[0]?.board.code ?? BOARDS[0].code;
  const second = edits.inside ?? (r.inside || INSIDE_DEFAULT);
  const work = boardWork(r, prices, edits);
  const { parts, split } = work;
  const words = SPLIT_WORDS[split];
  const chosen = BOARDS.find((b) => b.code === colour);
  const price = (b: Board) => prices.boards[b.code] ?? b.exVat;
  const pickSplit = (v: Split) => {
    if (v === split) return;
    set({ split: v, sheets: undefined, ...(v !== 'one' && second === colour ? { inside: INSIDE_DEFAULT === colour ? 'W1100 ST9' : INSIDE_DEFAULT } : {}) });
  };
  const twoWay: Split = split !== 'one' ? split : r.split === 'doors' ? 'doors' : 'outside';
  const guessing = GUESSED.some((k) => prices[k] === PRICE_BASE[k]);
  return (
    <div className="mt-3 rounded-sm border border-line bg-paper p-3" data-board-bits>
      <p className={label}>Boards</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label="How many boards" data-board-count>
        <BoardChoice on={split === 'one'} onClick={() => pickSplit('one')} title="One board" sub="one decor throughout" />
        <BoardChoice on={split !== 'one'} onClick={() => pickSplit(twoWay)} title="Two boards" sub="two decors" />
      </div>
      {split !== 'one' ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5" role="group" aria-label="Which parts get which board" data-board-split>
          <BoardChoice on={split === 'outside'} onClick={() => pickSplit('outside')} title="Outside, inside" sub="doors and frame in one, the inside in the other" />
          <BoardChoice on={split === 'doors'} onClick={() => pickSplit('doors')} title="Doors, the rest" sub="the doors in one, frame and inside in the other" />
        </div>
      ) : null}
      <p className={`${label} mt-3`}>{words.first}</p>
      {picks.length ? (
        <div className="mt-2 grid grid-cols-1 gap-2">
          {picks.map((c) => (
            <BoardSwatch key={c.board.code} b={c.board} why={c.why} on={colour === c.board.code} price={price(c.board)} onPick={() => set({ colour: c.board.code })} />
          ))}
        </div>
      ) : null}
      <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-2 font-mono text-[12.5px] text-accent underline">
        {all ? 'Fewer colours' : `All ${BOARDS.length} colours`}
      </button>
      {all ? (
        <div className="mt-2 grid grid-cols-1 gap-3">
          {FAMILY_ORDER.map((f) => {
            const list = BOARDS.filter((b) => b.family === f);
            return list.length ? (
              <div key={f}>
                <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint">{FAMILY_NAME[f]}</p>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {list.map((b) => (
                    <BoardSwatch key={b.code} b={b} on={colour === b.code} price={price(b)} onPick={() => set({ colour: b.code })} />
                  ))}
                </div>
              </div>
            ) : null;
          })}
        </div>
      ) : null}
      {chosen ? (
        <p className="mt-2 text-[13px] text-muted">
          {chosen.brand ?? 'Egger'} {chosen.code} · {chosen.describe} · {money2(price(chosen))} a sheet
          {chosen.offerEnds ? ` (offer to ${new Date(`${chosen.offerEnds}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})` : ''} ·{' '}
          <a href={chosen.url} target="_blank" rel="noreferrer" className="text-accent underline">
            Cworkshop
          </a>
        </p>
      ) : null}
      {split !== 'one' ? (
        <label className="mt-3 grid grid-cols-1 gap-1">
          <span className={label}>{words.second}</span>
          <select value={second} onChange={(e) => set({ inside: e.target.value })} className={`${field} h-11`} data-second-board>
            {FAMILY_ORDER.map((f) => {
              const list = BOARDS.filter((b) => b.family === f);
              return list.length ? (
                <optgroup key={f} label={FAMILY_NAME[f]}>
                  {list.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name} ({money2(price(b))})
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <Step label={words.sheets[0]} value={work.out} min={0} max={60} onChange={(v) => set({ sheets: { ...edits.sheets, out: v } })} />
        {split !== 'one' ? <Step label={words.sheets[1]} value={work.in} min={0} max={60} onChange={(v) => set({ sheets: { ...edits.sheets, in: v } })} /> : null}
        {prices.labourX > 0 ? null : <Step label="Days" value={work.days} min={0.5} max={60} step={0.5} onChange={(v) => set({ days: v })} />}
      </div>
      {edits.sheets || edits.days ? (
        <button type="button" onClick={() => set({ sheets: undefined, days: undefined })} className="mt-1 font-mono text-[12.5px] text-accent underline">
          Back to worked out: {split === 'one' ? work.calc.out : `${work.calc.out} + ${work.calc.in}`} sheets, {work.workedDays} days
        </button>
      ) : null}
      {prices.labourX > 0 ? <p className="mt-1 text-[12.5px] text-muted">Labour is {prices.labourX} × the materials (Your prices).</p> : null}
      <p className="mt-3 text-[13px] leading-snug text-muted" data-board-parts>
        Edging {parts.thickM} m of 2 mm at {money2(prices.edgeThickM)} and {parts.thinM} m of 1 mm at {money2(prices.edgeThinM)} · cutting {money2(prices.cutEdgeSheet)} a sheet · {parts.hinges} hinges on {parts.doors} doors
      </p>
      <p className={`${label} mt-3`}>Cworkshop extras</p>
      <div className="mt-1 grid grid-cols-1">
        <ExtraTick data="holes" on={Boolean(edits.holes)} onChange={(v) => set({ holes: v || undefined })} title="They drill the hinge holes" sub={`${parts.hinges} at ${money2(prices.hingeHole)}, ${money(parts.hinges * prices.hingeHole)}. Leave it off when you drill them yourself.`} />
        <ExtraTick data="fast" on={Boolean(edits.fast)} onChange={(v) => set({ fast: v || undefined })} title="Fast Flow, next day" sub={`${money(prices.fastFlow)} on top`} />
        <ExtraTick data="delivery" on={edits.delivery !== false} onChange={(v) => set({ delivery: v ? undefined : false })} title="Delivery" sub={`${money(prices.delivery)}. Untick when you collect.`} />
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted">
        Cutting is Cworkshop’s own price{guessing ? '; edging, drilling and delivery are my guesses until you type yours' : ''}.{' '}
        {onCworkshop ? (
          <button type="button" onClick={onCworkshop} className="text-accent underline" data-open-cworkshop>
            Cworkshop prices and decors
          </button>
        ) : null}
      </p>
    </div>
  );
}

/* A number box that keeps what's typed while it's typed, and says each good number. */
function NumBox({ value, min, max, onChange, aria, wide }: { value: number; min: number; max: number; onChange: (v: number) => void; aria: string; wide?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null); // what's typed, while the box has the cursor
  return (
    <input
      inputMode="numeric"
      value={draft ?? String(value)}
      aria-label={aria}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = Number.parseInt(e.target.value.replace(/[^\d]/g, ''), 10);
        if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
      }}
      className={`${field} h-11 ${wide ? 'max-w-[140px]' : ''} font-mono text-[15px]`}
    />
  );
}

function Step({ label: l, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[14.5px]">{l}</span>
      <button type="button" aria-label={`Fewer: ${l}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="grid h-10 w-10 place-items-center rounded-sm border border-line-strong text-[18px] disabled:opacity-40">
        −
      </button>
      <span className="w-9 text-center font-mono text-[15px]">{value}</span>
      <button type="button" aria-label={`More: ${l}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="grid h-10 w-10 place-items-center rounded-sm border border-line-strong text-[18px] disabled:opacity-40">
        +
      </button>
    </div>
  );
}

/* ---------- Raf's price list ---------- */

export function QuotePrices({ prices, savedAt, onSave, onCworkshop }: { prices: Prices; savedAt: number; onSave: (p: Record<string, unknown>) => void; onCworkshop: () => void }) {
  // Cworkshop's prices and the decors are on their own screen (cworkshop.tsx)
  const rows = PRICE_ROWS.filter((r) => r.group !== 'Cworkshop');
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.key, String(prices[r.key])])));
  const [saved, setSaved] = useState('');
  const groups = [...new Set(rows.map((r) => r.group))];
  const value = (k: PriceKey) => {
    const v = Number.parseFloat(form[k]);
    return Number.isFinite(v) && v >= 0 ? v : PRICE_BASE[k];
  };
  const changed = rows.some((r) => value(r.key) !== prices[r.key]);
  const save = () => {
    const full: Prices = { ...prices, boards: { ...prices.boards } };
    for (const r of rows) full[r.key] = value(r.key);
    onSave(ownPrices(full, PRICE_BASE)); // only what differs from where it starts
    setSaved('Saved. Every quote uses these now, on your phone and computer.');
  };
  return (
    <div className="pt-7">
      <p className="kicker">Quotes</p>
      <h1 className="mt-1 font-display text-[32px] font-[680] leading-[1.05] tracking-[-0.025em]">Your prices</h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
        Before VAT. Every rough quote is worked out from these. The ones marked <b className="font-semibold text-ink">my guess</b> are mine, not yours yet: check them.
      </p>
      {savedAt ? <p className="mt-2 font-mono text-[12px] text-faint">Last changed {ago(savedAt)}</p> : null}
      <button type="button" onClick={onCworkshop} className="mt-4 flex w-full items-center gap-3 rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-left" data-open-cworkshop>
        <Icon name="swatch" className="h-[26px] w-[26px] shrink-0 jk-sec-ink" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Cworkshop</span>
          <span className="block text-[13px] leading-snug text-muted">
            Cutting {money2(prices.cutEdgeSheet)} a sheet, edging {money2(prices.edgeThickM)} and {money2(prices.edgeThinM)} a metre, drilling, delivery and {BOARDS.length} decors
          </span>
        </span>
        <span aria-hidden className="text-[18px] text-faint">›</span>
      </button>
      {groups.map((g) => (
        <section key={g} className="mt-7">
          <h2 className={label}>{g}</h2>
          <ul className="mt-2 divide-y divide-line rounded-sm border border-line-strong bg-mount">
            {rows.filter((r) => r.group === g).map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug">{r.label}</span>
                  <span className="block text-[12.5px] leading-snug text-muted">
                    {r.guess ? <b className="font-semibold text-ink">My guess. </b> : null}
                    {r.guess ? r.from.replace(/^My guess[:.]?\s*/, '').replace(/^./, (c) => c.toUpperCase()) : r.from}
                    {Number(form[r.key]) !== PRICE_BASE[r.key] ? ` · started at ${fmt(r.key, PRICE_BASE[r.key])}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {r.unit !== 'days' && r.unit !== '%' && !r.unit.startsWith('×') ? <span className="font-mono text-[13px] text-faint">£</span> : null}
                  <input
                    inputMode="decimal"
                    value={form[r.key]}
                    onChange={(e) => setForm({ ...form, [r.key]: e.target.value })}
                    aria-label={r.label}
                    className={`${fieldSized} h-11 w-[96px] text-right font-mono text-[15px]`}
                  />
                  <span className="w-[58px] font-mono text-[11.5px] leading-tight text-faint">{r.unit}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-paper px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={save} disabled={!changed} className="btn btn-primary w-full disabled:opacity-50">
          Save my prices
        </button>
        {saved && !changed ? <p className="mt-1.5 text-center font-mono text-[12.5px] text-muted">{saved}</p> : null}
      </div>
    </div>
  );
}

const fmt = (k: PriceKey, v: number) => (k === 'boardSetupDays' || k === 'boardDaysPerM' ? `${v} days` : k === 'boardMarkup' ? `${v}%` : k === 'labourX' ? `${v} ×` : money(v));
