'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Mark from './mark';
import { Icon } from './icons';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { needsYou, runLine, SOURCE_WORDS, stepLines, type AssistantList, type AssistantSettings, type EnquiryItem, type ItemRow, type MailItem, type RunInfo } from '@/lib/assistant-types';

/* The assistant in the Job Kit (Raf, 12 Nov 2026: "give summary in jobkit"): every 30 minutes the website checks
   info@ and ServiceM8 by itself (src/lib/assistant.ts): it makes jobs from new enquiry emails, works out each new
   enquiry's rough quote, draws fitted furniture with Claude, looks up the house, and keeps what it did. Today shows
   what came in since Raf last looked, with a tap to each quote, drawing, job or email; the Assistant screen has the
   last two weeks, each check, Check now and his switches. Nothing here sends anything to a customer.
   On this phone: the last answer (raf_jobkit_assistant), so Today shows it with no signal. */

const KEY = 'raf_jobkit_assistant';
const EVENT = 'jk-assistant';
const API = '/api/job-kit/assistant';
const FRESH = 2 * 60_000;
const EVERY = 30 * 60_000;

export type Assistant = AssistantList & { fetchedAt: number; error?: string };
export type Go = { quote: (job: string) => void; concept: (code: string) => void; job: (job: string) => void; mail: (id: string) => void };

/* ---------- kept on the phone ---------- */

let cache: { raw: string | null; val: Assistant | null } = { raw: null, val: null };
function snapshot(): Assistant | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* no storage */
  }
  if (raw !== cache.raw) {
    let val: Assistant | null = null;
    try {
      val = raw ? whole(JSON.parse(raw) as Partial<Assistant>) : null;
    } catch {
      val = null;
    }
    cache = { raw, val };
  }
  return cache.val;
}
function keep(s: Assistant) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* full or blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};
export const useAssistant = () => useSyncExternalStore(subscribe, snapshot, () => null);

const EMPTY: Assistant = { items: [], settings: { paused: false, jobsFromEmail: true, drawings: true }, seen: 0, run: {}, runs: [], now: 0, fetchedAt: 0 };
// what's kept or answered with a part missing (an answer cut off, an older copy) is filled in, so Today never breaks on it
function whole(v: Partial<Assistant> | null | undefined): Assistant {
  const o = v && typeof v === 'object' ? v : {};
  return { ...EMPTY, ...o, items: Array.isArray(o.items) ? o.items : [], runs: Array.isArray(o.runs) ? o.runs : [], run: o.run && typeof o.run === 'object' ? o.run : {}, settings: { ...EMPTY.settings, ...(o.settings ?? {}) } };
}

/* Asks the store, at most every 2 minutes unless forced; an error keeps what was there. */
export async function fetchAssistant(force = false): Promise<void> {
  const cur = snapshot();
  if (!force && cur && Date.now() - cur.fetchedAt < FRESH && !cur.error) return;
  const r = await post<AssistantList>(readPin(), { action: 'list', days: 14 }, API);
  if (!r.ok) {
    keep({ ...(cur ?? EMPTY), error: r.error });
    return;
  }
  keep(whole({ ...r.data, fetchedAt: Date.now() }));
}

/* Raf has looked: what's there now isn't new any more (here at once, then in the store). */
export async function markSeen(at = Date.now()) {
  const cur = snapshot();
  if (cur) keep({ ...cur, seen: Math.max(cur.seen, at) });
  await post(readPin(), { action: 'seen', at }, API);
}

async function setSettings(s: Partial<AssistantSettings>) {
  const cur = snapshot();
  if (cur) keep({ ...cur, settings: { ...cur.settings, ...s } });
  const r = await post<{ settings: AssistantSettings }>(readPin(), { action: 'settings', settings: s }, API);
  if (r.ok && cur) keep({ ...(snapshot() ?? cur), settings: r.data.settings });
  return r;
}

async function checkNow(): Promise<{ ok: boolean; text: string }> {
  const r = await post<{ state: string }>(readPin(), { action: 'run' }, API);
  if (!r.ok) return { ok: false, text: problemText(r.error, r.detail) || 'It didn’t start. Try again in a minute.' };
  const cur = snapshot();
  if (cur) keep({ ...cur, run: { ...cur.run, running: true, startedAt: Date.now(), updated: Date.now() } });
  return { ok: true, text: r.data.state === 'busy' ? 'It’s checking already.' : 'Checking now. It takes a minute or two.' };
}

/* Keeps it fresh while the app is open: on open, when it comes back, every 2 minutes, and every 8 s while a run is
   going (so a Check now shows its result). */
export function useAssistantPoll(pin: string) {
  const a = useAssistant();
  const running = Boolean(a?.run.running && Date.now() - (a.run.updated ?? 0) < 6 * 60_000);
  useEffect(() => {
    if (!pin) return;
    void fetchAssistant();
    const back = () => {
      if (document.visibilityState === 'visible') void fetchAssistant();
    };
    document.addEventListener('visibilitychange', back);
    const t = window.setInterval(() => void fetchAssistant(), FRESH + 1000);
    return () => {
      document.removeEventListener('visibilitychange', back);
      window.clearInterval(t);
    };
  }, [pin]);
  useEffect(() => {
    if (!pin || !running) return;
    const t = window.setInterval(() => void fetchAssistant(true), 8000);
    return () => window.clearInterval(t);
  }, [pin, running]);
  return a;
}

/* ---------- words ---------- */

const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const dayKey = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/London' });
function dayWord(ms: number) {
  const k = dayKey(ms);
  if (k === dayKey(Date.now())) return 'Today';
  if (k === dayKey(Date.now() - 864e5)) return 'Yesterday';
  return new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
}
const isRunning = (a: Assistant | null) => Boolean(a?.run.running && Date.now() - (a.run.updated ?? 0) < 6 * 60_000);

/* "Checked at 14:30 · next by 15:00" */
export function checkedLine(a: Assistant | null): string {
  if (!a?.fetchedAt && !a?.run.last) return 'Checks info@ and ServiceM8 every 30 minutes';
  if (isRunning(a)) return 'Checking now…';
  const last = a?.run.last;
  if (!last) return 'Not run yet: the first check comes within 30 minutes';
  if (a.settings.paused) return `Paused · last checked ${time(last.at)}`;
  return `Checked ${time(last.at)} · next by ${time(last.at + EVERY)}`;
}

const newOf = (a: Assistant | null) => (a ? a.items.filter((r) => r.at > a.seen) : []);

/* The Today line for the Today box (used by Home): "2 new from the assistant" */
export function assistantHomeRight(a: Assistant | null) {
  const n = newOf(a).length;
  if (n) return `${n} new`;
  if (a?.settings.paused) return 'Paused';
  return a?.run.last ? 'All clear' : undefined;
}

function weekLine(a: Assistant): string {
  const since = Date.now() - 7 * 864e5;
  const runs = a.runs.filter((r) => r.at >= since);
  const sum = (k: keyof Pick<RunInfo, 'enquiries' | 'made' | 'quotes' | 'drawings'>) => runs.reduce((n, r) => n + (r[k] || 0), 0);
  const e = a.items.filter((r) => r.data.kind === 'enquiry' && r.at >= since).length;
  const bits = [e ? `${e} enquir${e === 1 ? 'y' : 'ies'}` : '', sum('made') ? `${sum('made')} job${sum('made') === 1 ? '' : 's'} made from emails` : '', sum('quotes') ? `${sum('quotes')} rough quote${sum('quotes') === 1 ? '' : 's'}` : '', sum('drawings') ? `${sum('drawings')} drawing${sum('drawings') === 1 ? '' : 's'}` : ''].filter(Boolean);
  return bits.length ? `Last 7 days: ${bits.join(', ')}.` : 'Nothing new in the last 7 days.';
}

/* ---------- one item ---------- */

function EnquiryCard({ e, isNew, go }: { e: EnquiryItem; isNew: boolean; go: Go }) {
  const lines = stepLines(e);
  const drawings = e.drawings && 'code' in e.drawings ? e.drawings : null;
  const working = lines.some((l) => l.state === 'working');
  return (
    <article data-assistant-item={e.job} className={`rounded-sm border bg-mount ${isNew ? 'border-accent' : 'border-line'}`}>
      <div className="px-3.5 pt-3">
        <p className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint">
          {isNew ? <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10.5px] font-semibold text-on-accent">New</span> : null}
          <span className="truncate">
            Enquiry {SOURCE_WORDS[e.source]}
            {e.number ? ` · #${e.number}` : ''}
          </span>
        </p>
        <h3 className="mt-1 text-[17px] font-semibold leading-snug">
          {e.name}
          {e.area ? <span className="font-normal text-muted">, {e.area}</span> : null}
        </h3>
        {e.what ? <p className="mt-0.5 text-[15px] leading-snug text-muted">{e.what}</p> : null}
        {lines.length ? (
          <ul className="mt-2 space-y-1">
            {lines.map((l) => (
              <li key={l.text} className={`flex items-start gap-2 text-[14.5px] leading-snug ${l.state === 'note' ? 'text-muted' : ''}`}>
                <span className="mt-[3px]">{l.state === 'done' ? <Mark state="sent" /> : l.state === 'working' ? <Mark state="sending" /> : l.state === 'failed' ? <Mark state="lost" /> : <Icon name="house" className="h-4 w-4 text-faint" />}</span>
                <span className="min-w-0 flex-1">{l.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {!working ? <p className="mt-2 text-[14.5px] font-semibold">Needs you: {needsYou(e).toLowerCase()}.</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line px-3.5 py-2.5">
        {e.quote?.state === 'ready' || e.quote?.state === 'failed' ? (
          <button type="button" data-assistant-go="quote" onClick={() => go.quote(e.job)} className="btn btn-primary btn-sm">
            Open the quote
          </button>
        ) : null}
        {drawings && drawings.state !== 'failed' ? (
          <button type="button" data-assistant-go="drawings" onClick={() => go.concept(drawings.code)} className="btn btn-ghost btn-sm">
            Drawings
          </button>
        ) : null}
        <button type="button" data-assistant-go="job" onClick={() => go.job(e.job)} className="btn btn-ghost btn-sm">
          The job
        </button>
        {e.made ? (
          <button type="button" data-assistant-go="mail" onClick={() => go.mail(e.made!.mail)} className="btn btn-ghost btn-sm">
            Their email
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MailCard({ m, isNew, go }: { m: MailItem; isNew: boolean; go: Go }) {
  return (
    <article data-assistant-mail className={`rounded-sm border bg-mount ${isNew ? 'border-accent' : 'border-line'}`}>
      <button type="button" onClick={() => go.mail(m.mail)} className="block w-full px-3.5 py-3 text-left">
        <p className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint">
          {isNew ? <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10.5px] font-semibold text-on-accent">New</span> : null}
          {m.read === 'platform' ? 'A lead from a website' : m.read === 'enquiry' ? 'A new enquiry' : 'Might be an enquiry'}
        </p>
        <h3 className="mt-1 text-[16px] font-semibold leading-snug">{m.from}</h3>
        <p className="mt-0.5 text-[14.5px] leading-snug text-muted">{m.what || m.subject}</p>
        <p className="mt-2 text-[14.5px] font-semibold">
          Needs you: {m.read === 'platform' ? 'reply on the website it came from' : m.read === 'enquiry' ? 'making jobs from emails is off, so open it and add it to ServiceM8' : 'not sure it’s a new enquiry, so no job was made. Open it to decide'}{' '}
          <span aria-hidden>→</span>
        </p>
      </button>
    </article>
  );
}

function ItemCard({ r, seen, go }: { r: ItemRow; seen: number; go: Go }) {
  const isNew = r.at > seen;
  return r.data.kind === 'enquiry' ? <EnquiryCard e={r.data} isNew={isNew} go={go} /> : <MailCard m={r.data} isNew={isNew} go={go} />;
}

/* ---------- Today ---------- */

/* The box at the top of Today: what's new since Raf last looked, or that nothing is. */
export function AssistantToday({ a, go, onOpen }: { a: Assistant | null; go: Go; onOpen: () => void }) {
  const fresh = newOf(a);
  const problems = a?.run.last?.problems ?? [];
  const shownNew = fresh.slice(0, 3);
  return (
    <div data-assistant-today className="px-3.5 py-3">
      <p className="flex items-center gap-2 text-[13.5px] text-muted">
        {isRunning(a) ? <Mark state="sending" /> : null}
        <span>{checkedLine(a)}</span>
      </p>
      {a?.error && !a.fetchedAt ? <p className="mt-2 text-[14.5px] text-muted">{a.error === 'assistant-not-set-up' ? 'The assistant isn’t switched on here.' : problemText(a.error)}</p> : null}
      {problems.length ? (
        <p data-assistant-problem className="mt-2 rounded-sm border border-ink bg-paper px-3 py-2 text-[14px] leading-snug">
          {problems[0]}
          {problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}
        </p>
      ) : null}
      {shownNew.length ? (
        <>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5">
            {shownNew.map((r) => (
              <ItemCard key={r.id} r={r} seen={a?.seen ?? 0} go={go} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" data-assistant-seen onClick={() => void markSeen()} className="btn btn-ghost btn-sm">
              Got it
            </button>
            <button type="button" onClick={onOpen} className="btn btn-ghost btn-sm">
              {fresh.length > shownNew.length ? `${fresh.length - shownNew.length} more` : 'Everything it did'} <span aria-hidden>→</span>
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={onOpen} className="mt-1 flex min-h-11 w-full items-center gap-2 text-left text-[15.5px]">
          <Mark state="sent" />
          <span className="flex-1">
            Nothing new since you looked.{' '}
            <span className="text-muted">{a ? weekLine(a) : ''}</span>
          </span>
          <span aria-hidden className="text-accent">
            →
          </span>
        </button>
      )}
    </div>
  );
}

/* ---------- the screen ---------- */

function Switch({ on, title, line, onChange, data }: { on: boolean; title: string; line: string; onChange: (on: boolean) => void; data: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} data-assistant-switch={data} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-left">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{line}</span>
      </span>
      <span aria-hidden className={`jk-switch${on ? ' on' : ''}`}>
        <span />
      </span>
    </button>
  );
}

export function AssistantView({ go, pin }: { go: Go; pin: string }) {
  const a = useAssistantPoll(pin);
  const [note, setNote] = useState('');
  const [seenAtOpen] = useState(() => a?.seen ?? 0);
  useEffect(() => {
    if (pin) void markSeen();
  }, [pin]);
  const s = a?.settings ?? EMPTY.settings;
  const byDay = new Map<string, ItemRow[]>();
  for (const r of a?.items ?? []) byDay.set(dayKey(r.at), [...(byDay.get(dayKey(r.at)) ?? []), r]);
  const change = async (p: Partial<AssistantSettings>) => {
    const r = await setSettings(p);
    setNote(r.ok ? 'Saved.' : problemText(r.error, r.detail));
  };
  return (
    <div className="pt-6">
      <p className="kicker">Every 30 minutes, by itself</p>
      <h1 className="mt-1 flex items-center gap-2.5 font-display text-[30px] font-[680] leading-tight tracking-[-0.02em]">
        <Icon name="assistant" className="h-7 w-7 jk-sec-ink" /> Assistant
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        It reads new emails to info@ and makes a ServiceM8 job for each new enquiry, with their photos. For every new enquiry it works out the rough quote from your prices, draws fitted furniture with Claude and looks up the house. It never sends anything to a customer and never puts a drawing online: that’s yours to check and send.
      </p>

      <section className="mt-5 rounded-sm border border-line-strong bg-mount p-3.5">
        <p className="flex items-center gap-2 text-[15px]">
          {isRunning(a) ? <Mark state="sending" /> : <Icon name="assistant" className="h-5 w-5 text-faint" />}
          <span className="flex-1">{checkedLine(a)}</span>
        </p>
        {a?.run.last ? <p className="mt-1 text-[14px] text-muted">{runLine(a.run.last)}.</p> : null}
        {(a?.run.last?.problems ?? []).map((p) => (
          <p key={p} className="mt-2 rounded-sm border border-ink bg-paper px-3 py-2 text-[14px] leading-snug">
            {p}
          </p>
        ))}
        <button
          type="button"
          data-assistant-now
          disabled={isRunning(a)}
          onClick={() => void checkNow().then((r) => setNote(r.text))}
          className="btn btn-primary btn-sm mt-3"
        >
          {isRunning(a) ? 'Checking…' : 'Check now'}
        </button>
        {note ? <p className="mt-2 text-[14px] text-muted" role="status">{note}</p> : null}
      </section>

      <section className="mt-5 space-y-2">
        <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">What it does</h2>
        <Switch data="jobs" on={s.jobsFromEmail} onChange={(v) => void change({ jobsFromEmail: v })} title="Make jobs from enquiry emails" line={s.jobsFromEmail ? 'A plain new enquiry to info@ becomes a ServiceM8 customer and Quote job.' : 'Off: it still reads them and lists the enquiries for you.'} />
        <Switch data="drawings" on={s.drawings} onChange={(v) => void change({ drawings: v })} title="Quick drawings for fitted furniture" line={s.drawings ? 'Wardrobes, alcoves, cupboards and the like, about 3p each. Private until you put them online.' : 'Off: no drawings by itself.'} />
        <Switch data="paused" on={!s.paused} onChange={(v) => void change({ paused: !v })} title="Assistant on" line={s.paused ? 'Paused: it checks nothing until you switch it back on.' : 'Checks every 30 minutes. Your phone buzzes for new enquiries through HQ.'} />
      </section>

      <section className="mt-6">
        <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">The last 2 weeks</h2>
        {a?.items.length ? (
          [...byDay.entries()].map(([k, rows]) => (
            <div key={k} className="mt-3">
              <h3 className="text-[14px] font-semibold text-muted">{dayWord(rows[0].at)}</h3>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2.5">
                {rows.map((r) => (
                  <ItemCard key={r.id} r={r} seen={seenAtOpen} go={go} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="mt-2 text-[15px] text-muted">Nothing yet. New enquiries show here as they come in.</p>
        )}
      </section>

      {a?.runs.length ? (
        <section className="mt-6">
          <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">Recent checks</h2>
          <ul className="mt-2 divide-y divide-line rounded-sm border border-line bg-mount">
            {a.runs.slice(0, 12).map((r) => (
              <li key={r.at} className="px-3.5 py-2 text-[14px] leading-snug">
                <span className="font-mono text-[12.5px] text-faint">{dayWord(r.at)} </span>
                {runLine(r).replace(/^Checked at /, '')}
                {r.why === 'now' ? <span className="text-faint"> · you asked</span> : null}
                {r.problems.length ? <span className="block text-muted">{r.problems.join(' · ')}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
