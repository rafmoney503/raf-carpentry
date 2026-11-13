'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SITES } from '@/lib/sites';
import { clock, longDay, shortDay } from '@/lib/time';
import { plural } from '@/lib/format';
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
  type Mark,
  type MarkStatus,
  type ReviewApp,
  type ReviewDay,
  type ReviewList,
} from '@/lib/review-types';
import { Mark as Logo } from './ui';

/* The daily review in HQ: a card at the top of Today, and the Review page (every app, its numbers, what stood out, why,
   and the ideas, each marked I'll do it, Done or Not for me, or copied for Claude). */

const COLORS: Record<ReviewApp, { color: string; light: string; ink: string }> = {
  ...(Object.fromEntries(SITES.map((s) => [s.key, { color: s.color, light: s.light, ink: s.ink }])) as Record<string, { color: string; light: string; ink: string }>),
  business: { color: '#17736e', light: '#5ccfc6', ink: '#ffffff' },
} as Record<ReviewApp, { color: string; light: string; ink: string }>;

const appStyle = (a: ReviewApp) => {
  const c = COLORS[a] ?? { color: '#121417', light: '#f7f6f2', ink: '#ffffff' };
  return { ['--a1' as string]: c.color, ['--a2' as string]: c.light, ['--a1i' as string]: c.ink } as React.CSSProperties;
};

const ready = (d: ReviewDay | undefined) => Boolean(d?.data?.review?.headline);
export const latestReview = (list: ReviewList | null) => list?.days.find(ready);

/* ---------- marks ---------- */

function useMarks(initial: Record<string, Mark>) {
  const [marks, setMarks] = useState(initial);
  const [error, setError] = useState('');
  async function mark(id: string, status: MarkStatus) {
    const before = marks[id];
    const next = statusOf(marks, id) === status ? 'new' : status;
    setMarks((m) => ({ ...m, [id]: { status: next, at: Date.now(), by: 'hq', note: '' } }));
    setError('');
    try {
      const res = await fetch('/api/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status: next }) });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setMarks((m) => {
        const out = { ...m };
        if (before) out[id] = before;
        else delete out[id];
        return out;
      });
      setError('That didn’t save. Try again in a moment.');
    }
  }
  return { marks, mark, error };
}

/* ---------- Today's card ---------- */

export function ReviewCard({ list }: { list: ReviewList }) {
  const d = latestReview(list);
  if (!d) {
    return (
      <article className="card rv-card" data-hq-review>
        <div className="ins-top">
          <span className="mark info" aria-hidden="true">
            ★
          </span>
          <span className="where">Daily review</span>
        </div>
        <h3>The first daily review comes tomorrow morning</h3>
        <p className="note">Every morning at about 6 it looks at yesterday across all your apps, says what happened and why, and suggests what to change.</p>
      </article>
    );
  }
  const r = d.data.review!;
  const ideas = r.apps.reduce((a, x) => a + x.ideas.length, 0);
  const open = openIdeas(list).length;
  return (
    <article className="card rv-card" data-hq-review>
      <div className="ins-top">
        <span className="mark info" aria-hidden="true">
          ★
        </span>
        <span className="where">
          Daily review · {shortDay(d.day)}
          {d.data.at ? ` · written ${clock(d.data.at)}` : ''}
        </span>
      </div>
      <h3>{r.headline}</h3>
      <ul className="rv-mini">
        {r.apps.map((a) => (
          <li key={a.app} className="appc" style={appStyle(a.app)}>
            <span className="sq" aria-hidden="true" />
            <span className="nm">{APP_NAMES[a.app]}</span>
            <Trend t={a.trend} />
            <span className="n">{a.ideas.length ? plural(a.ideas.length, 'idea') : 'no ideas'}</span>
          </li>
        ))}
      </ul>
      <Link className="act dark" href="/review">
        {ideas ? `Read it: ${plural(ideas, 'idea')}${open > ideas ? `, ${open} open in all` : ''}` : 'Read the review'}
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

function Trend({ t }: { t: AppReview['trend'] }) {
  const tone = t === 'better' ? 'up' : t === 'worse' ? 'down' : 'flat';
  return <span className={`pill ${tone}`}>{TREND_WORDS[t]}</span>;
}

/* ---------- the Review page ---------- */

export function ReviewScreen({ list, day }: { list: ReviewList | null; day?: string }) {
  const { marks, mark, error } = useMarks(list?.marks ?? {});
  const [view, setView] = useState<'day' | 'open'>('day');
  if (!list) return <p className="problem">The review couldn’t be read from Supabase just now. Try again in a minute.</p>;
  const days = list.days.filter(ready);
  const d = days.find((x) => x.day === day) ?? days[0];
  const failed = list.days.find((x) => x.state === 'failed' && (!d || x.day > d.day));
  const live = { ...list, marks };
  const open = openIdeas(live);

  return (
    <>
      <div className="top">
        <Link href="/" className="brand">
          <Logo />
          <span>
            <b>HQ</b>
            <small>Rafal Solutions</small>
          </span>
        </Link>
        {d?.data.at ? <span className="stamp">Written {clock(d.data.at)}</span> : null}
      </div>
      <div className="hello">
        <p>Daily review{d ? ` · ${longDay(d.day)}` : ''}</p>
        <h1>{d ? d.data.review!.headline : 'No review yet'}</h1>
        {d ? <p className="lead">{d.data.review!.overall}</p> : <p className="lead">Every morning at about 6 it looks at yesterday across all your apps, says what happened and why, and suggests what to change, improve or add. The first one comes tomorrow.</p>}
      </div>

      {failed ? <p className="problem">The review of {shortDay(failed.day)} wasn’t written: {failed.data.error || 'it stopped'}. It tries again at 6:35, or ask for it in the Job Kit.</p> : null}
      {error ? <p className="problem">{error}</p> : null}

      {days.length ? (
        <nav className="rv-days" aria-label="Reviews">
          {days.slice(0, 7).map((x) => (
            <Link key={x.day} href={`/review?day=${x.day}`} aria-current={view === 'day' && x.day === d?.day ? 'page' : undefined} onClick={() => setView('day')}>
              {shortDay(x.day)}
            </Link>
          ))}
          <button type="button" aria-pressed={view === 'open'} onClick={() => setView(view === 'open' ? 'day' : 'open')}>
            Open ideas{open.length ? ` · ${open.length}` : ''}
          </button>
        </nav>
      ) : null}

      {view === 'open' ? (
        <OpenIdeas items={open} marks={marks} onMark={mark} />
      ) : d ? (
        <DayView d={d} marks={marks} onMark={mark} />
      ) : null}
    </>
  );
}

function DayView({ d, marks, onMark }: { d: ReviewDay; marks: Record<string, Mark>; onMark: (id: string, s: MarkStatus) => void }) {
  const r = d.data.review!;
  const order = [...r.apps].sort((a, b) => REVIEW_APPS.indexOf(a.app) - REVIEW_APPS.indexOf(b.app));
  return (
    <>
      {r.followups.length || r.watch.length ? (
        <section className="card rv-after" aria-label="Following up">
          {r.followups.length ? (
            <>
              <h2>Ideas you did</h2>
              <ul className="rv-follow">
                {r.followups.map((f) => (
                  <li key={f.id} data-verdict={f.verdict}>
                    <b>{f.title}</b>
                    <span className="v">{VERDICT_WORDS[f.verdict]}</span>
                    <p>{f.text}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {r.watch.length ? (
            <>
              <h2>Keep an eye on today</h2>
              <ul className="rv-watch">
                {r.watch.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="rv-grid">
        {order.map((a) => (
          <AppPart key={a.app} a={a} day={d.day} numbers={d.data.numbers?.[a.app] ?? []} live={d.data.live?.[a.app] ?? []} marks={marks} onMark={onMark} />
        ))}
      </div>
      {d.data.missing?.length ? <p className="stamp">Not in this review: {d.data.missing.join('; ')}.</p> : null}
      <p className="stamp" style={{ textAlign: 'center' }}>
        Written by Claude from the numbers of {longDay(d.day)}, midnight to midnight UK time. It only advises: nothing is changed or sent.
      </p>
    </>
  );
}

function AppPart({ a, day, numbers, live, marks, onMark }: { a: AppReview; day: string; numbers: KeyNumber[]; live: string[]; marks: Record<string, Mark>; onMark: (id: string, s: MarkStatus) => void }) {
  return (
    <section className="card appc rv-app" style={appStyle(a.app)} data-review-app={a.app}>
      <div className="rv-head">
        <span className="sq" aria-hidden="true" />
        <span className="nm">
          <b>{APP_NAMES[a.app]}</b>
          <small>{APP_SUBS[a.app]}</small>
        </span>
        <Trend t={a.trend} />
      </div>
      {numbers.length ? (
        <dl className="rv-nums">
          {numbers.map((n) => {
            const b = beforeText(n);
            return (
              <div key={n.label}>
                <dt>{n.label}</dt>
                <dd>
                  <b>{numberText(n)}</b>
                  {b ? <em className={`tone-${b.dir === 'up' ? 'up' : b.dir === 'down' ? 'down' : 'flat'}`}>{b.text}</em> : null}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      <p className="rv-sum">{a.summary}</p>
      {a.stoodOut.length ? (
        <ul className="rv-out">
          {a.stoodOut.map((s) => (
            <li key={s.text} data-tone={s.tone}>
              {s.text}
            </li>
          ))}
        </ul>
      ) : null}
      {a.why ? (
        <p className="rv-why">
          <span>Why</span>
          {a.why}
        </p>
      ) : null}
      {live.length ? (
        <details className="rv-live">
          <summary>{plural(live.length, 'update', 'updates')} went live that day</summary>
          <ul>
            {live.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {a.ideas.length ? (
        <div className="rv-ideas">
          {a.ideas.map((i) => (
            <IdeaCard key={i.id} idea={i} app={a.app} day={day} status={statusOf(marks, i.id)} onMark={onMark} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function OpenIdeas({ items, marks, onMark }: { items: ReturnType<typeof openIdeas>; marks: Record<string, Mark>; onMark: (id: string, s: MarkStatus) => void }) {
  if (!items.length) return <p className="empty">No open ideas. Everything suggested is done or set aside.</p>;
  const byApp = REVIEW_APPS.map((app) => ({ app, list: items.filter((x) => x.app === app) })).filter((g) => g.list.length);
  return (
    <div className="rv-grid">
      {byApp.map((g) => (
        <section key={g.app} className="card appc rv-app" style={appStyle(g.app)}>
          <div className="rv-head">
            <span className="sq" aria-hidden="true" />
            <span className="nm">
              <b>{APP_NAMES[g.app]}</b>
              <small>{plural(g.list.length, 'open idea')}</small>
            </span>
          </div>
          <div className="rv-ideas">
            {g.list.map((x) => (
              <IdeaCard key={x.idea.id} idea={x.idea} app={x.app} day={x.day} status={statusOf(marks, x.idea.id)} onMark={onMark} from={x.day} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const BUTTONS: [MarkStatus, string][] = [
  ['doing', 'I’ll do it'],
  ['done', 'Done'],
  ['no', 'Not for me'],
];

function IdeaCard({ idea, app, day, status, onMark, from }: { idea: Idea; app: ReviewApp; day: string; status: MarkStatus; onMark: (id: string, s: MarkStatus) => void; from?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
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
    setTimeout(() => setCopied(false), 2200);
  }
  return (
    <article className="rv-idea" data-status={status} data-idea={idea.id}>
      <p className="rv-tags">
        <span className="k">{KIND_WORDS[idea.kind]}</span>
        <span>{EFFORT_WORDS[idea.effort]}</span>
        {from ? <span>{shortDay(from)}</span> : null}
        {status === 'done' ? <span className="st">Done</span> : status === 'doing' ? <span className="st">You’ll do it</span> : status === 'no' ? <span className="st">Not for me</span> : null}
      </p>
      <h3>{idea.title}</h3>
      <p>{idea.what}</p>
      <p className="note">
        <b>Why:</b> {idea.why}
      </p>
      {idea.where ? (
        <p className="note">
          <b>Where:</b> {idea.where}
        </p>
      ) : null}
      {idea.watch ? (
        <p className="note">
          <b>Watch:</b> {idea.watch}
        </p>
      ) : null}
      <div className="rv-btns">
        {BUTTONS.map(([s, label]) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => onMark(idea.id, s)}>
            {label}
          </button>
        ))}
        <button type="button" className="cp" onClick={copy}>
          {copied ? 'Copied' : 'Copy for Claude'}
        </button>
      </div>
    </article>
  );
}
