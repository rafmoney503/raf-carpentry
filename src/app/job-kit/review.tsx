'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Mark from './mark';
import { Icon } from './icons';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { HQ_URL } from './desktop';
import {
  APP_NAMES,
  APP_SUBS,
  EFFORT_WORDS,
  KIND_WORDS,
  REVIEW_APPS,
  TREND_WORDS,
  VERDICT_WORDS,
  beforeText,
  claudePrompt,
  numberText,
  openIdeas,
  statusOf,
  type AppReview,
  type Idea,
  type KeyNumber,
  type MarkStatus,
  type ReviewApp,
  type ReviewDay,
  type ReviewList,
} from '@/lib/review-types';

/* The daily review in the Job Kit (Raf, 12 Nov 2026: "check websites and apps daily ... make a summary, rethink what
   happened on that day and suggest what should we change, improve, add"). Written each morning at about 6 by the
   website (src/lib/review-writer.ts) for yesterday, across every app; the Job Kit shows your business and
   rafcarpentry.com first. Today has the headline; the Daily review screen has the whole review, the ideas (I'll do
   it, Done, Not for me, Copy for Claude) and the ideas still open. HQ shows the same. On this phone: the last answer
   (raf_jobkit_review), so it opens with no signal. */

const KEY = 'raf_jobkit_review';
const EVENT = 'jk-review';
const API = '/api/job-kit/review';
const FRESH = 10 * 60_000;
const FIRST: ReviewApp[] = ['business', 'rafcarpentry'];

export type Review = ReviewList & { yesterday?: string; fetchedAt: number; error?: string; running?: number };

/* ---------- kept on the phone ---------- */

let cache: { raw: string | null; val: Review | null } = { raw: null, val: null };
function snapshot(): Review | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* no storage */
  }
  if (raw !== cache.raw) {
    let val: Review | null = null;
    try {
      val = raw ? (JSON.parse(raw) as Review) : null;
    } catch {
      val = null;
    }
    cache = { raw, val };
  }
  return cache.val;
}
function keep(s: Review) {
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
export const useReview = () => useSyncExternalStore(subscribe, snapshot, () => null);

export async function fetchReview(force = false): Promise<void> {
  const cur = snapshot();
  if (!force && cur && Date.now() - cur.fetchedAt < FRESH && !cur.error && !isWriting(cur)) return;
  const r = await post<ReviewList & { yesterday: string }>(readPin(), { action: 'list', days: 21 }, API);
  if (!r.ok) {
    keep({ ...(cur ?? { days: [], marks: {} }), fetchedAt: cur?.fetchedAt ?? 0, error: r.error });
    return;
  }
  const running = cur?.running && Date.now() - cur.running < 6 * 60_000 && !r.data.days.some((d) => d.day === r.data.yesterday && d.state !== 'working' && Date.parse(d.at) > (cur.running ?? 0)) ? cur.running : undefined;
  keep({ ...r.data, fetchedAt: Date.now(), running });
}

const isWriting = (r: Review | null) => Boolean(r?.running && Date.now() - r.running < 6 * 60_000) || Boolean(r?.days.some((d) => d.state === 'working' && Date.now() - Date.parse(d.at) < 6 * 60_000));

async function markIdea(id: string, status: MarkStatus): Promise<boolean> {
  const cur = snapshot();
  const next = statusOf(cur?.marks, id) === status ? 'new' : status;
  if (cur) keep({ ...cur, marks: { ...cur.marks, [id]: { status: next, at: Date.now(), by: 'jobkit', note: '' } } });
  const r = await post(readPin(), { action: 'mark', id, status: next }, API);
  if (!r.ok && cur) keep({ ...(snapshot() ?? cur), marks: cur.marks });
  return r.ok;
}

async function writeNow(force: boolean): Promise<{ ok: boolean; text: string }> {
  const r = await post<{ state: string }>(readPin(), { action: 'run', force }, API);
  if (!r.ok) return { ok: false, text: problemText(r.error, r.detail) || 'It didn’t start. Try again in a minute.' };
  const cur = snapshot();
  if (cur) keep({ ...cur, running: Date.now() });
  return { ok: true, text: r.data.state === 'busy' ? 'It’s writing it already.' : 'Writing it now. It takes a minute or two.' };
}

/* Fresh on open, when the app comes back, every 10 minutes, and every 10 s while one is being written. */
export function useReviewPoll(pin: string) {
  const r = useReview();
  const writing = isWriting(r);
  useEffect(() => {
    if (!pin) return;
    void fetchReview();
    const back = () => {
      if (document.visibilityState === 'visible') void fetchReview();
    };
    document.addEventListener('visibilitychange', back);
    const t = window.setInterval(() => void fetchReview(), FRESH + 1000);
    return () => {
      document.removeEventListener('visibilitychange', back);
      window.clearInterval(t);
    };
  }, [pin]);
  useEffect(() => {
    if (!pin || !writing) return;
    const t = window.setInterval(() => void fetchReview(true), 10_000);
    return () => window.clearInterval(t);
  }, [pin, writing]);
  return r;
}

/* ---------- words ---------- */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return { m, d, w: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};
export const shortDay = (day: string) => {
  const p = parts(day);
  return `${DAYS[p.w]} ${p.d} ${MONTHS[p.m - 1]}`;
};
const longDay = (day: string) => {
  const p = parts(day);
  return `${DAYS_LONG[p.w]} ${p.d} ${MONTHS_LONG[p.m - 1]}`;
};
const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ready = (d: ReviewDay | undefined) => Boolean(d?.data?.review?.headline);
const trendTone = (t: AppReview['trend']) => (t === 'better' ? 'text-[#17603a]' : t === 'worse' ? 'text-[#9a3412]' : 'text-muted');

/* What the Today box's corner says. */
export function reviewHomeRight(r: Review | null): string {
  const d = r?.days.find(ready);
  return d ? shortDay(d.day) : '';
}

/* ---------- Today ---------- */

export function ReviewToday({ r, onOpen }: { r: Review | null; onOpen: () => void }) {
  const [busy, setBusy] = useState('');
  const d = r?.days.find(ready);
  const y = r?.yesterday;
  const failed = r?.days.find((x) => x.day === y && x.state === 'failed');
  const writing = isWriting(r);
  const behind = Boolean(y && d && d.day < y && new Date().getHours() >= 7);
  const start = async (force: boolean) => {
    const res = await writeNow(force);
    setBusy(res.text);
  };

  if (!r) return <p className="px-4 py-3 text-[14.5px] text-muted">Getting the review…</p>;
  if (r.error && !r.fetchedAt) return <p className="px-4 py-3 text-[14.5px] text-muted">{r.error === 'review-not-set-up' ? 'The daily review isn’t switched on here.' : problemText(r.error)}</p>;

  if (!d) {
    return (
      <div data-review-today className="px-4 py-3">
        <p className="text-[15.5px] font-semibold">{writing ? 'Writing yesterday’s review…' : 'The first daily review comes tomorrow at about 6.'}</p>
        <p className="mt-1 text-[14px] leading-snug text-muted">Every morning it looks at yesterday across your business, rafcarpentry.com, CabinetOS and your other apps, says what happened and why, and suggests what to change.</p>
        {!writing ? (
          <button type="button" data-review-write onClick={() => void start(false)} className="btn btn-ghost btn-sm mt-3">
            Write yesterday’s now
          </button>
        ) : null}
        {busy ? <p className="mt-2 text-[13.5px] text-muted">{busy}</p> : null}
      </div>
    );
  }

  const rv = d.data.review!;
  const mine = rv.apps.filter((a) => FIRST.includes(a.app)).sort((a, b) => FIRST.indexOf(a.app) - FIRST.indexOf(b.app));
  const rest = rv.apps.filter((a) => !FIRST.includes(a.app));
  const ideas = rv.apps.reduce((a, x) => a + x.ideas.length, 0);
  const open = openIdeas(r).length;
  return (
    <div data-review-today className="px-4 py-3">
      <p className="text-[13px] text-muted">
        {longDay(d.day)}
        {d.data.at ? ` · written ${time(d.data.at)}` : ''}
      </p>
      <p className="mt-1 text-[16.5px] font-semibold leading-snug">{rv.headline}</p>
      <ul className="mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {mine.map((a) => (
          <li key={a.app} className="flex items-center gap-2 text-[14.5px]">
            <span className="min-w-0 flex-1 truncate">{APP_NAMES[a.app]}</span>
            <span className={`font-mono text-[12.5px] ${trendTone(a.trend)}`}>{TREND_WORDS[a.trend]}</span>
            <span className="w-[64px] text-right text-[13px] text-muted">{a.ideas.length ? plural(a.ideas.length, 'idea') : 'no ideas'}</span>
          </li>
        ))}
        {rest.length ? (
          <li className="flex items-center gap-2 text-[14.5px] text-muted">
            <span className="min-w-0 flex-1 truncate">{plural(rest.length, 'other app')}</span>
            <span className="w-[64px] text-right text-[13px]">{plural(rest.reduce((a, x) => a + x.ideas.length, 0), 'idea')}</span>
          </li>
        ) : null}
      </ul>
      {failed ? <p className="mt-2 text-[13.5px] text-muted">Yesterday’s wasn’t written: {failed.data.error || 'it stopped'}.</p> : behind && !writing ? <p className="mt-2 text-[13.5px] text-muted">Yesterday’s isn’t written yet.</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" data-review-open onClick={onOpen} className="btn btn-primary btn-sm">
          {ideas ? `Read it: ${plural(ideas, 'idea')}` : 'Read the review'} <span aria-hidden>→</span>
        </button>
        {open > ideas ? <span className="text-[13px] text-muted">{open} open in all</span> : null}
        {(failed || behind) && !writing ? (
          <button type="button" onClick={() => void start(false)} className="btn btn-ghost btn-sm">
            Write it now
          </button>
        ) : null}
        {writing ? (
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            <Mark state="sending" /> Writing…
          </span>
        ) : null}
      </div>
      {busy ? <p className="mt-2 text-[13.5px] text-muted">{busy}</p> : null}
    </div>
  );
}

/* ---------- the screen ---------- */

export function ReviewView({ pin, day: asked }: { pin: string; day?: string }) {
  const r = useReviewPoll(pin);
  const [day, setDay] = useState(asked);
  const [view, setView] = useState<'day' | 'open'>('day');
  const [note, setNote] = useState('');
  const days = (r?.days ?? []).filter(ready);
  const d = days.find((x) => x.day === day) ?? days[0];
  const open = r ? openIdeas(r) : [];
  const writing = isWriting(r);

  const mark = async (id: string, s: MarkStatus) => {
    setNote('');
    if (!(await markIdea(id, s))) setNote('That didn’t save. Try again in a moment.');
  };
  const again = async () => {
    const res = await writeNow(true);
    setNote(res.text);
  };

  return (
    <div data-review-view className="pb-10">
      <p className="font-mono text-[12.5px] uppercase tracking-[0.08em] text-muted">Daily review{d ? ` · ${longDay(d.day)}` : ''}</p>
      <h1 className="mt-1 text-[24px] font-semibold leading-tight">{d ? d.data.review!.headline : 'No review yet'}</h1>
      {d ? (
        <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{d.data.review!.overall}</p>
      ) : (
        <p className="mt-2 text-[15.5px] leading-relaxed text-muted">Every morning at about 6 it looks at yesterday across your business, rafcarpentry.com, CabinetOS and your other apps, says what happened and why, and suggests what to change, improve or add. It only advises: nothing is changed or sent.</p>
      )}
      {r?.error && !r.fetchedAt ? <p className="mt-3 text-[14.5px] text-muted">{r.error === 'review-not-set-up' ? 'The daily review isn’t switched on here.' : problemText(r.error)}</p> : null}
      {note ? <p className="mt-3 rounded-sm border border-line bg-mount px-3 py-2 text-[14px]">{note}</p> : null}

      {days.length ? (
        <div className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Reviews">
          {days.slice(0, 7).map((x) => (
            <button
              key={x.day}
              type="button"
              aria-pressed={view === 'day' && x.day === d?.day}
              onClick={() => {
                setDay(x.day);
                setView('day');
              }}
              className="h-10 shrink-0 rounded-full border border-line-strong px-3.5 text-[14px] font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
            >
              {shortDay(x.day)}
            </button>
          ))}
          <button type="button" data-review-open-ideas aria-pressed={view === 'open'} onClick={() => setView(view === 'open' ? 'day' : 'open')} className="h-10 shrink-0 rounded-full border border-line-strong px-3.5 text-[14px] font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper">
            Open ideas{open.length ? ` · ${open.length}` : ''}
          </button>
        </div>
      ) : null}

      {view === 'open' ? (
        <OpenList items={open} marks={r?.marks ?? {}} onMark={mark} />
      ) : d ? (
        <DayParts d={d} marks={r?.marks ?? {}} onMark={mark} />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {writing ? (
          <span className="flex items-center gap-1.5 text-[14px] text-muted">
            <Mark state="sending" /> Writing it…
          </span>
        ) : (
          <button type="button" data-review-again onClick={() => void again()} className="btn btn-ghost btn-sm">
            {d && d.day === r?.yesterday ? 'Write yesterday’s again' : 'Write yesterday’s now'}
          </button>
        )}
        <a href={`${HQ_URL}/review`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
          All apps in HQ <span aria-hidden>↗</span>
        </a>
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted">Written by Claude from yesterday’s numbers (midnight to midnight UK time) in ServiceM8, the website’s own counter, CabinetOS, Build It in 3D and Vercel. It only advises: nothing is changed or sent. About 8p a day of Claude credit.</p>
    </div>
  );
}

function DayParts({ d, marks, onMark }: { d: ReviewDay; marks: Review['marks']; onMark: (id: string, s: MarkStatus) => void }) {
  const rv = d.data.review!;
  const sorted = [...rv.apps].sort((a, b) => order(a.app) - order(b.app));
  const mine = sorted.filter((a) => FIRST.includes(a.app));
  const rest = sorted.filter((a) => !FIRST.includes(a.app));
  return (
    <>
      {rv.followups.length || rv.watch.length ? (
        <section className="mt-4 rounded-sm border border-line-strong bg-mount px-4 py-3">
          {rv.followups.length ? (
            <>
              <h2 className="font-mono text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted">Ideas you did</h2>
              <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2.5">
                {rv.followups.map((f) => (
                  <li key={f.id} data-followup={f.verdict}>
                    <p className="text-[14.5px] font-semibold">
                      {f.title} <span className={`ml-1 font-mono text-[12px] ${f.verdict === 'worked' ? 'text-[#17603a]' : f.verdict === 'worse' ? 'text-[#9a3412]' : 'text-muted'}`}>{VERDICT_WORDS[f.verdict]}</span>
                    </p>
                    <p className="text-[14px] leading-snug text-muted">{f.text}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {rv.watch.length ? (
            <>
              <h2 className={`font-mono text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted ${rv.followups.length ? 'mt-3' : ''}`}>Keep an eye on today</h2>
              <ul className="mt-1.5 grid grid-cols-[minmax(0,1fr)] gap-1.5">
                {rv.watch.map((w) => (
                  <li key={w} className="text-[14.5px] leading-snug">
                    <span aria-hidden className="mr-1.5 text-muted">
                      →
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
      {mine.map((a) => (
        <AppPart key={a.app} a={a} day={d.day} numbers={d.data.numbers?.[a.app] ?? []} live={d.data.live?.[a.app] ?? []} marks={marks} onMark={onMark} />
      ))}
      {rest.length ? <h2 className="mt-6 font-mono text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted">Your other apps</h2> : null}
      {rest.map((a) => (
        <AppPart key={a.app} a={a} day={d.day} numbers={d.data.numbers?.[a.app] ?? []} live={d.data.live?.[a.app] ?? []} marks={marks} onMark={onMark} />
      ))}
      {d.data.missing?.length ? <p className="mt-3 text-[13px] text-muted">Not in this review: {d.data.missing.join('; ')}.</p> : null}
    </>
  );
}

const order = (a: ReviewApp) => (FIRST.includes(a) ? FIRST.indexOf(a) : 2 + REVIEW_APPS.indexOf(a));

function AppPart({ a, day, numbers, live, marks, onMark }: { a: AppReview; day: string; numbers: KeyNumber[]; live: string[]; marks: Review['marks']; onMark: (id: string, s: MarkStatus) => void }) {
  return (
    <section data-review-app={a.app} className="mt-4 rounded-sm border border-line-strong bg-mount">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[16.5px] font-semibold">{APP_NAMES[a.app]}</span>
          <span className="block font-mono text-[12px] text-muted">{APP_SUBS[a.app]}</span>
        </span>
        <span className={`font-mono text-[13px] font-semibold ${trendTone(a.trend)}`}>{TREND_WORDS[a.trend]}</span>
      </div>
      <div className="px-4 py-3">
        {numbers.length ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {numbers.map((n) => {
              const b = beforeText(n);
              return (
                <div key={n.label} className="min-w-0 rounded-sm bg-paper px-2.5 py-2">
                  <dt className="truncate text-[12.5px] text-muted">{n.label}</dt>
                  <dd className="flex flex-wrap items-baseline gap-x-1.5">
                    <b className="font-display text-[21px] font-semibold">{numberText(n)}</b>
                    {b ? <em className={`font-mono text-[11.5px] not-italic ${b.dir === 'up' ? 'text-[#17603a]' : b.dir === 'down' ? 'text-[#9a3412]' : 'text-muted'}`}>{b.text}</em> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
        <p className={`${numbers.length ? 'mt-3' : ''} text-[15.5px] leading-relaxed`}>{a.summary}</p>
        {a.stoodOut.length ? (
          <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {a.stoodOut.map((s) => (
              <li key={s.text} className="flex gap-2 text-[14.5px] leading-snug">
                <span aria-hidden className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${s.tone === 'good' ? 'bg-[#2f9e5e]' : s.tone === 'bad' ? 'bg-[#d4572f]' : 'bg-line-strong'}`} />
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {a.why ? (
          <p className="mt-2.5 text-[14.5px] leading-snug text-muted">
            <span className="mr-1 font-mono text-[12px] font-semibold uppercase tracking-[0.08em]">Why</span>
            {a.why}
          </p>
        ) : null}
        {live.length ? (
          <details className="mt-2 text-[13.5px] text-muted">
            <summary className="flex min-h-9 cursor-pointer items-center">{plural(live.length, 'update')} went live that day</summary>
            <ul className="ml-4 list-disc">
              {live.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {a.ideas.length ? (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5">
            {a.ideas.map((i) => (
              <IdeaCard key={i.id} idea={i} app={a.app} day={day} status={statusOf(marks, i.id)} onMark={onMark} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OpenList({ items, marks, onMark }: { items: ReturnType<typeof openIdeas>; marks: Review['marks']; onMark: (id: string, s: MarkStatus) => void }) {
  if (!items.length) return <p className="mt-4 text-[15px] text-muted">No open ideas. Everything suggested is done or set aside.</p>;
  const groups = [...new Set(items.map((x) => x.app))].sort((a, b) => order(a) - order(b));
  return (
    <>
      {groups.map((app) => (
        <section key={app} className="mt-4 rounded-sm border border-line-strong bg-mount">
          <div className="border-b border-line px-4 py-2.5">
            <span className="block text-[16.5px] font-semibold">{APP_NAMES[app]}</span>
            <span className="block font-mono text-[12px] text-muted">{plural(items.filter((x) => x.app === app).length, 'open idea')}</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 px-4 py-3">
            {items
              .filter((x) => x.app === app)
              .map((x) => (
                <IdeaCard key={x.idea.id} idea={x.idea} app={app} day={x.day} status={statusOf(marks, x.idea.id)} onMark={onMark} from={x.day} />
              ))}
          </div>
        </section>
      ))}
    </>
  );
}

const BUTTONS: [MarkStatus, string][] = [
  ['doing', 'I’ll do it'],
  ['done', 'Done'],
  ['no', 'Not for me'],
];

function IdeaCard({ idea, app, day, status, onMark, from }: { idea: Idea; app: ReviewApp; day: string; status: MarkStatus; onMark: (id: string, s: MarkStatus) => void; from?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = claudePrompt(idea, app, day);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };
  const faded = status === 'done' || status === 'no';
  return (
    <article data-idea={idea.id} data-status={status} className={`rounded-sm border bg-paper px-3 py-2.5 ${status === 'doing' ? 'border-accent' : 'border-line'} ${faded ? 'opacity-60' : ''}`}>
      <p className="flex flex-wrap gap-1.5 font-mono text-[11.5px]">
        <span className="rounded-full bg-ink px-2 py-0.5 text-paper">{KIND_WORDS[idea.kind]}</span>
        <span className="rounded-full bg-mount px-2 py-0.5 text-muted">{EFFORT_WORDS[idea.effort]}</span>
        {from ? <span className="rounded-full bg-mount px-2 py-0.5 text-muted">{shortDay(from)}</span> : null}
      </p>
      <h3 className="mt-1.5 text-[15.5px] font-semibold leading-snug">{idea.title}</h3>
      <p className="mt-1 text-[14.5px] leading-snug">{idea.what}</p>
      <p className="mt-1 text-[13.5px] leading-snug text-muted">
        <b className="font-semibold">Why:</b> {idea.why}
      </p>
      {idea.where ? (
        <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
          <b className="font-semibold">Where:</b> {idea.where}
        </p>
      ) : null}
      {idea.watch ? (
        <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
          <b className="font-semibold">Watch:</b> {idea.watch}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {BUTTONS.map(([s, label]) => (
          <button key={s} type="button" data-mark={s} aria-pressed={status === s} onClick={() => onMark(idea.id, s)} className="h-10 rounded-sm border border-line-strong px-3 text-[13.5px] font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper">
            {label}
          </button>
        ))}
        <button type="button" data-copy onClick={() => void copy()} className="ml-auto flex h-10 items-center gap-1.5 px-2 text-[13.5px] font-semibold text-accent">
          <Icon name="note" className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy for Claude'}
        </button>
      </div>
    </article>
  );
}
