'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  BRIEF_MAX,
  JOB_MAX,
  NOTE_MAX,
  agoWords,
  jobState,
  openNeeds,
  pickupWords,
  repeatWords,
  runWords,
  safeOpen,
  waitingJobs,
  type Agent,
  type AgentList,
  type Job,
  type Need,
  type Repeat,
} from '@/lib/agents-types';
import { plural } from '@/lib/format';
import { Mark } from './ui';

/* HQ's agents: the Agents tab (one card each, Give a job), one agent's page (its report, what needs Rafal, a job to
   give it, its jobs, what it remembers, what it may do) and a card on Today. */

/* ---------- icons ---------- */

const PATHS: Record<string, React.ReactNode> = {
  money: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 8.5a2.5 2.5 0 0 0-4.5 1.5c0 1.5.5 2.5.5 4 0 1-.5 2-1.5 2.5h6M9 13h4" />
    </>
  ),
  report: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  growth: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  sales: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8.5 10l2.5 2.5 4.5-4.5" />
    </>
  ),
  other: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5" />
    </>
  ),
};

export function AgentIcon({ id, big = false }: { id: string; big?: boolean }) {
  return (
    <span className={big ? 'ag-icon big' : 'ag-icon'} aria-hidden="true">
      <svg width={big ? 28 : 22} height={big ? 28 : 22} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[id] ?? PATHS.other}
      </svg>
    </span>
  );
}

/* ---------- talking to HQ ---------- */

type Body = Record<string, unknown> & { action: string };

async function post(body: Body): Promise<Agent> {
  const res = await fetch('/api/agents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => null)) as { agent?: Agent; error?: string } | null;
  if (!res.ok || !j?.agent) throw new Error(j?.error ?? String(res.status));
  return j.agent;
}

function useAgents(list: AgentList) {
  const [agents, setAgents] = useState(list.agents);
  const [error, setError] = useState('');
  async function act(body: Body): Promise<boolean> {
    setError('');
    try {
      const a = await post(body);
      setAgents((xs) => xs.map((x) => (x.id === a.id ? a : x)));
      return true;
    } catch {
      setError('That didn’t save. Check your signal and try again.');
      return false;
    }
  }
  return { agents, act, error };
}

/* ---------- the Agents tab ---------- */

export function AgentsScreen({ list }: { list: AgentList | null }) {
  if (!list) {
    return (
      <>
        <Top />
        <section className="card">
          <h2>Agents</h2>
          <p>HQ couldn’t read the agents just now. Pull down or come back in a minute.</p>
        </section>
      </>
    );
  }
  return <AgentsLoaded list={list} />;
}

function AgentsLoaded({ list }: { list: AgentList }) {
  const { agents, act, error } = useAgents(list);
  const [give, setGive] = useState(false);
  const needs = agents.reduce((s, a) => s + openNeeds(a).length, 0);
  const now = list.now;
  return (
    <>
      <Top />
      <div className="hello-row">
        <div className="hello">
          <h1>Agents</h1>
          <p className="lead">
            {plural(agents.length, 'agent')}
            {needs ? ` · ${needs} ${needs === 1 ? 'thing needs' : 'things need'} you` : ' · nothing needs you'}
          </p>
        </div>
        <button type="button" className="btn ag-give" onClick={() => setGive(true)} data-ag-give>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Give a job
        </button>
      </div>
      {error ? <p className="ag-error" role="alert">{error}</p> : null}
      <div className="ag-grid">
        {agents.map((a) => (
          <AgentCard key={a.id} a={a} now={now} review={a.id === 'report' ? list.review : null} />
        ))}
      </div>
      <p className="ag-foot">
        {list.run ? `Last check ${agoWords(list.run.at, now)}. ` : 'No check yet. '}
        The agents check their jobs every hour from 7:00 to 21:00. They never pay anything, move money or message a customer on their own.
      </p>
      {give ? <GiveJob agents={agents} now={now} onClose={() => setGive(false)} act={act} /> : null}
    </>
  );
}

function Top() {
  return (
    <div className="top">
      <Link href="/" className="brand">
        <Mark />
        <span>
          <b>HQ</b>
          <small>Rafal Solutions</small>
        </span>
      </Link>
    </div>
  );
}

function AgentCard({ a, now, review }: { a: Agent; now: number; review: AgentList['review'] }) {
  const needs = openNeeds(a).length;
  const waiting = waitingJobs(a).length;
  const working = a.jobs.some((j) => j.status === 'working');
  return (
    <Link href={`/agents/${a.id}`} className="card ag-card" data-ag-card={a.id}>
      <div className="ag-row">
        <AgentIcon id={a.id} />
        <span className="ag-name">
          <b>{a.name}</b>
          <small>{runWords(a, now)}</small>
        </span>
        {needs ? <span className="pill y">{needs} {needs === 1 ? 'needs' : 'need'} you</span> : null}
      </div>
      <p className="ag-head">{a.report ? a.report.headline : review ? review.headline : a.role}</p>
      <p className="note">
        {working ? 'Working on a job now' : waiting ? `${plural(waiting, 'job')} waiting · ${pickupWords(now).toLowerCase()}` : 'No jobs waiting'}
      </p>
    </Link>
  );
}

/* ---------- giving a job ---------- */

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/* "Say it" where the browser can listen; on an iPhone the keyboard's own microphone works too. */
function SayIt({ onText }: { onText: (t: string) => void }) {
  const [ctor, setCtor] = useState<SpeechCtor | null>(null);
  const [on, setOn] = useState(false);
  const rec = useRef<InstanceType<SpeechCtor> | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    setCtor(() => w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
  }, []);
  if (!ctor) return <p className="note">Or tap the microphone on your keyboard and say it.</p>;
  function toggle() {
    if (on) {
      rec.current?.stop();
      return;
    }
    const r = new ctor!();
    r.lang = 'en-GB';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const t = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' ').trim();
      if (t) onText(t);
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    setOn(true);
    r.start();
  }
  return (
    <button type="button" className="btn ag-say" onClick={toggle} aria-pressed={on}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
      {on ? 'Listening… tap to stop' : 'Say it instead'}
    </button>
  );
}

function todayIso(now: number) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

function JobForm({
  agents,
  fixed,
  now,
  act,
  onDone,
}: {
  agents: Agent[];
  fixed?: string;
  now: number;
  act: (b: Body) => Promise<boolean>;
  onDone?: (agentName: string) => void;
}) {
  const [agent, setAgent] = useState(fixed ?? '');
  const [text, setText] = useState('');
  const [repeat, setRepeat] = useState<Repeat>('once');
  const [weekday, setWeekday] = useState(1);
  const [onDay, setOnDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const [miss, setMiss] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const who = agents.find((a) => a.id === agent);
  const today = todayIso(now);

  async function send() {
    setMiss('');
    if (!agent) return setMiss('Pick who it’s for.');
    if (!text.trim()) {
      box.current?.focus();
      return setMiss('Write what to do.');
    }
    if (repeat === 'date' && !onDay) return setMiss('Pick the day.');
    setBusy(true);
    const ok = await act({ action: 'job_add', agent, text, repeat, ...(repeat === 'weekly' ? { weekday } : {}), ...(repeat === 'date' ? { onDay } : {}) });
    setBusy(false);
    if (ok) {
      const name = who?.name ?? 'it';
      setSent(
        repeat === 'once'
          ? `Sent to ${name}. ${pickupWords(Date.now())}.`
          : `Sent to ${name}: ${repeatWords({ repeat, weekday, onDay }).toLowerCase()}.`,
      );
      setText('');
      setRepeat('once');
      onDone?.(name);
    }
  }

  const whens: [Repeat, string][] = [
    ['once', repeat === 'once' ? 'Once, next check' : 'Once'],
    ['daily', 'Every day'],
    ['weekly', 'Every week'],
    ['date', 'On a date'],
  ];

  return (
    <div className="ag-form" data-ag-form>
      {fixed ? null : (
        <div className="ag-field">
          <span className="ag-lbl" id="ag-who">Who for</span>
          <div className="ag-whos" role="group" aria-labelledby="ag-who">
            {agents.map((a) => (
              <button key={a.id} type="button" aria-pressed={agent === a.id} onClick={() => setAgent(a.id)} data-ag-who={a.id}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ag-field">
        <label className="ag-lbl" htmlFor={`ag-text-${fixed ?? 'any'}`}>
          What to do
        </label>
        <textarea
          id={`ag-text-${fixed ?? 'any'}`}
          ref={box}
          rows={4}
          maxLength={JOB_MAX}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSent('');
          }}
          placeholder={who?.id === 'money' ? 'e.g. How much can I pay myself this month?' : who?.id === 'sales' ? 'e.g. Follow up everyone who had a quote in October' : 'Say what you want done, in your own words'}
        />
        <SayIt onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
      </div>
      <div className="ag-field">
        <span className="ag-lbl" id={`ag-when-${fixed ?? 'any'}`}>When</span>
        <div className="ag-chips" role="group" aria-labelledby={`ag-when-${fixed ?? 'any'}`}>
          {whens.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={repeat === k} onClick={() => setRepeat(k)} data-ag-when={k}>
              {l}
            </button>
          ))}
        </div>
        {repeat === 'weekly' ? (
          <label className="ag-inline">
            On
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} data-ag-weekday>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {repeat === 'date' ? (
          <label className="ag-inline">
            Day
            <input type="date" min={today} value={onDay} onChange={(e) => setOnDay(e.target.value)} data-ag-day />
          </label>
        ) : null}
      </div>
      {miss ? (
        <p className="ag-error" role="alert">
          {miss}
        </p>
      ) : null}
      <button type="button" className="btn solid ag-send" onClick={send} disabled={busy} data-ag-send>
        {busy ? 'Sending…' : who ? `Send to ${who.name}` : 'Send'}
      </button>
      {sent ? (
        <p className="ag-sent" role="status" data-ag-sent>
          {sent}
        </p>
      ) : (
        <p className="note">Its answer shows on its page in HQ.</p>
      )}
    </div>
  );
}

function GiveJob({ agents, now, onClose, act }: { agents: Agent[]; now: number; onClose: () => void; act: (b: Body) => Promise<boolean> }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="ag-sheet"
      aria-labelledby="ag-sheet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      data-ag-sheet
    >
      <div className="ag-sheet-in">
        <div className="ag-sheet-top">
          <h2 id="ag-sheet-title">Give a job</h2>
          <button type="button" className="round" aria-label="Close" onClick={() => ref.current?.close()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <JobForm agents={agents} now={now} act={act} />
      </div>
    </dialog>
  );
}

/* ---------- one agent ---------- */

export function AgentScreen({ list, id }: { list: AgentList | null; id: string }) {
  const a = list?.agents.find((x) => x.id === id);
  if (!list || !a) {
    return (
      <>
        <Back />
        <section className="card">
          <h2>{list ? 'No such agent' : 'Agents'}</h2>
          <p>{list ? 'That agent isn’t in HQ.' : 'HQ couldn’t read the agents just now. Come back in a minute.'}</p>
        </section>
      </>
    );
  }
  return <AgentLoaded list={list} id={id} />;
}

function Back() {
  return (
    <Link href="/agents" className="ag-back" data-ag-back>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Agents
    </Link>
  );
}

function AgentLoaded({ list, id }: { list: AgentList; id: string }) {
  const { agents, act, error } = useAgents(list);
  const a = agents.find((x) => x.id === id)!;
  const now = list.now;
  return (
    <div className="ag-page" data-ag-page={a.id}>
      <Back />
      <div className="ag-title">
        <AgentIcon id={a.id} big />
        <div>
          <h1>{a.name}</h1>
          <p>
            {a.role}. {a.schedule}
            {a.paused ? ' · paused' : ''}.
          </p>
        </div>
      </div>
      {error ? <p className="ag-error" role="alert">{error}</p> : null}
      <div className="ag-cols">
        <div className="stack">
          <ReportCard a={a} list={list} now={now} />
          <NeedsCard a={a} act={act} now={now} />
          <section className="card" aria-labelledby="ag-give-h">
            <h2 id="ag-give-h">Give {a.name} a job</h2>
            <JobForm agents={agents} fixed={a.id} now={now} act={act} />
          </section>
        </div>
        <div className="stack">
          <JobsCard a={a} act={act} now={now} />
          <NotesCard a={a} act={act} />
          <SettingsCard a={a} act={act} />
        </div>
      </div>
    </div>
  );
}

function ReportCard({ a, list, now }: { a: Agent; list: AgentList; now: number }) {
  const r = a.report;
  const review = a.id === 'report' ? list.review : null;
  if (!r) {
    return (
      <section className="pulse grid-bg" data-ag-report="none">
        <span className="lbl">Report</span>
        <h2 className="ag-headline">{review ? review.headline : `No report yet. The first one comes ${a.schedule.toLowerCase().replace(/^every day at/, 'at')}.`}</h2>
        {review ? (
          <p className="foot">
            From the daily review. <Link href="/review">Read the whole review</Link>
          </p>
        ) : null}
      </section>
    );
  }
  return (
    <section className="pulse grid-bg" data-ag-report={r.id}>
      <span className="lbl">Report · {agoWords(r.at, now)}</span>
      <h2 className="ag-headline">{r.headline}</h2>
      {r.numbers.length ? (
        <div className="ag-nums">
          {r.numbers.slice(0, 6).map((n, i) => (
            <div key={i}>
              <span>{n.label}</span>
              <b className={n.hi ? 'hi' : undefined}>{n.value}</b>
              {n.note ? <small>{n.note}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      {r.body ? <p className="ag-body">{r.body}</p> : null}
      <p className="foot">
        {r.foot || `From ${a.sources.join(', ')}.`}
        {a.id === 'report' ? (
          <>
            {' '}
            <Link href="/review">Read the whole review</Link>
          </>
        ) : null}
      </p>
    </section>
  );
}

function NeedsCard({ a, act, now }: { a: Agent; act: (b: Body) => Promise<boolean>; now: number }) {
  const open = a.needs.filter((n) => n.status === 'open');
  const doing = a.needs.filter((n) => n.status === 'doing');
  const recent = a.needs.filter((n) => n.status === 'done' || n.status === 'no');
  return (
    <section className="card" aria-labelledby={`ag-needs-${a.id}`} data-ag-needs>
      <div className="head">
        <h2 id={`ag-needs-${a.id}`}>
          Needs you{open.length ? <span className="pill y ag-count">{open.length}</span> : null}
        </h2>
      </div>
      {!open.length && !doing.length ? <p>Nothing right now.</p> : null}
      {open.map((n) => (
        <NeedRow key={n.id} n={n} act={act} />
      ))}
      {doing.map((n) => (
        <div key={n.id} className="ag-need" data-ag-need={n.id} data-state="doing">
          <p>{n.text}</p>
          <p className="note">{a.name} does it on its next check. {pickupWords(now)}.</p>
          <button type="button" className="ag-link" onClick={() => act({ action: 'need_mark', id: n.id, status: 'open' })}>
            Undo
          </button>
        </div>
      ))}
      {recent.length ? (
        <details className="ag-recent">
          <summary>Dealt with lately ({recent.length})</summary>
          {recent.map((n) => (
            <div key={n.id} className="ag-need done" data-ag-need={n.id} data-state={n.status}>
              <p>{n.text}</p>
              <p className="note">
                {n.status === 'no' ? 'Not now' : n.result || 'Done'}
                {n.marked ? ` · ${agoWords(n.marked, now)}` : ''}
              </p>
              <button type="button" className="ag-link" onClick={() => act({ action: 'need_mark', id: n.id, status: 'open' })}>
                Bring it back
              </button>
            </div>
          ))}
        </details>
      ) : null}
    </section>
  );
}

function NeedRow({ n, act }: { n: Need; act: (b: Body) => Promise<boolean> }) {
  const open = safeOpen(n.action.open);
  const label = n.button === 'done' ? 'Done' : n.action.label || 'Do it';
  return (
    <div className="ag-need" data-ag-need={n.id} data-state="open">
      <p>{n.text}</p>
      {n.how ? <p className="note">{n.how}</p> : null}
      <div className="ag-btns">
        {open ? (
          <a
            className="btn solid"
            href={open}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (n.action.copy) navigator.clipboard?.writeText(n.action.copy).catch(() => null);
              act({ action: 'need_mark', id: n.id, status: 'done' });
            }}
            data-ag-do
          >
            {label}
          </a>
        ) : (
          <button type="button" className={n.button === 'done' ? 'btn ink' : 'btn solid'} onClick={() => act({ action: 'need_mark', id: n.id, status: n.button === 'done' ? 'done' : 'doing' })} data-ag-do>
            {label}
          </button>
        )}
        <button type="button" className="btn" onClick={() => act({ action: 'need_mark', id: n.id, status: 'no' })} data-ag-no>
          Not now
        </button>
      </div>
    </div>
  );
}

function JobsCard({ a, act, now }: { a: Agent; act: (b: Body) => Promise<boolean>; now: number }) {
  const live = a.jobs.filter((j) => j.status === 'waiting' || j.status === 'working');
  const past = a.jobs.filter((j) => j.status === 'done' || j.status === 'failed');
  return (
    <section className="card" aria-labelledby={`ag-jobs-${a.id}`} data-ag-jobs>
      <h2 id={`ag-jobs-${a.id}`}>Its jobs</h2>
      {!live.length && !past.length ? <p>No jobs yet. Give it one on the left.</p> : null}
      {live.map((j) => (
        <JobRow key={j.id} j={j} act={act} now={now} />
      ))}
      {past.slice(0, 8).map((j) => (
        <JobRow key={j.id} j={j} act={act} now={now} />
      ))}
    </section>
  );
}

function JobRow({ j, act, now }: { j: Job; act: (b: Body) => Promise<boolean>; now: number }) {
  const s = jobState(j, now);
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(false), 5000);
    return () => clearTimeout(t);
  }, [arm]);
  const long = j.answer.length > 220;
  return (
    <div className="ag-job" data-ag-job={j.id} data-state={j.status}>
      <span className={`ag-tag ${s.tone}`}>{s.tag}</span>
      <p className="ag-jt">{j.text}</p>
      {j.answer ? (
        long ? (
          <details className="ag-ans">
            <summary>{j.answer.slice(0, 200).replace(/\s+\S*$/, '')}… Read it all</summary>
            <p>{j.answer}</p>
          </details>
        ) : (
          <p className="ag-ans">{j.answer}</p>
        )
      ) : null}
      {j.status === 'waiting' || j.status === 'failed' ? (
        <button
          type="button"
          className="ag-link"
          onClick={() => {
            if (!arm) return setArm(true);
            act({ action: 'job_cancel', id: j.id });
          }}
          data-ag-cancel
        >
          {arm ? 'Tap again to cancel it' : j.repeat === 'once' ? 'Cancel' : 'Stop it'}
        </button>
      ) : null}
    </div>
  );
}

function NotesCard({ a, act }: { a: Agent; act: (b: Body) => Promise<boolean> }) {
  const [edit, setEdit] = useState<number | 'new' | null>(null);
  const [text, setText] = useState('');
  async function save() {
    const t = text.trim();
    if (!t) return;
    const ok = await act(edit === 'new' ? { action: 'note_add', agent: a.id, text: t } : { action: 'note_edit', id: edit as number, text: t });
    if (ok) {
      setEdit(null);
      setText('');
    }
  }
  return (
    <section className="card" aria-labelledby={`ag-notes-${a.id}`} data-ag-notes>
      <h2 id={`ag-notes-${a.id}`}>What it remembers</h2>
      <p className="note">Its notes, kept from day to day and read on every check. Change any of them.</p>
      <ul className="ag-notes">
        {a.notes.map((n) =>
          edit === n.id ? (
            <li key={n.id}>
              <NoteEditor text={text} setText={setText} save={save} cancel={() => setEdit(null)} />
            </li>
          ) : (
            <li key={n.id} data-ag-note={n.id}>
              <span>{n.text}</span>
              <span className="ag-note-btns">
                <button
                  type="button"
                  className="ag-link"
                  onClick={() => {
                    setEdit(n.id);
                    setText(n.text);
                  }}
                >
                  Change
                </button>
                <button type="button" className="ag-link" onClick={() => act({ action: 'note_gone', id: n.id })} aria-label={`Forget: ${n.text}`}>
                  Forget
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      {edit === 'new' ? (
        <NoteEditor text={text} setText={setText} save={save} cancel={() => setEdit(null)} />
      ) : (
        <button
          type="button"
          className="btn"
          onClick={() => {
            setEdit('new');
            setText('');
          }}
          data-ag-note-add
        >
          Add something to remember
        </button>
      )}
    </section>
  );
}

function NoteEditor({ text, setText, save, cancel }: { text: string; setText: (t: string) => void; save: () => void; cancel: () => void }) {
  return (
    <div className="ag-note-edit">
      <label className="sr" htmlFor="ag-note-box">
        Note
      </label>
      <textarea id="ag-note-box" rows={2} maxLength={NOTE_MAX} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <div className="ag-btns">
        <button type="button" className="btn solid" onClick={save} data-ag-note-save>
          Save
        </button>
        <button type="button" className="btn" onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SettingsCard({ a, act }: { a: Agent; act: (b: Body) => Promise<boolean> }) {
  const [brief, setBrief] = useState(a.brief);
  const [saved, setSaved] = useState(false);
  return (
    <section className="card" aria-labelledby={`ag-set-${a.id}`} data-ag-settings>
      <h2 id={`ag-set-${a.id}`}>What it can use</h2>
      <div className="chips">
        {a.sources.map((s) => (
          <span key={s} className="chip">
            {s}
          </span>
        ))}
      </div>
      <h3 className="ag-h3">What it may do</h3>
      <div className="ag-radios" role="radiogroup" aria-label="What it may do">
        <label>
          <input type="radio" name={`may-${a.id}`} checked={a.may === 'tell'} onChange={() => act({ action: 'settings', agent: a.id, may: 'tell' })} /> Only tell me
        </label>
        <label>
          <input type="radio" name={`may-${a.id}`} checked={a.may === 'act'} onChange={() => act({ action: 'settings', agent: a.id, may: 'act' })} /> Do things after I press Do it
        </label>
      </div>
      <p className="note">Never on its own: pay anything, move money or message a customer.</p>
      <h3 className="ag-h3">
        <label htmlFor={`ag-brief-${a.id}`}>Your standing instructions</label>
      </h3>
      <textarea
        id={`ag-brief-${a.id}`}
        className="ag-brief"
        rows={3}
        maxLength={BRIEF_MAX}
        value={brief}
        placeholder="Anything it should always do or never do"
        onChange={(e) => {
          setBrief(e.target.value);
          setSaved(false);
        }}
      />
      <div className="ag-btns">
        <button
          type="button"
          className="btn"
          disabled={brief === a.brief}
          onClick={async () => {
            if (await act({ action: 'settings', agent: a.id, brief })) setSaved(true);
          }}
          data-ag-brief-save
        >
          Save instructions
        </button>
        {saved ? <span className="note" role="status">Saved</span> : null}
      </div>
      <label className="ag-pause">
        <input type="checkbox" checked={a.paused} onChange={(e) => act({ action: 'settings', agent: a.id, paused: e.target.checked })} data-ag-pause />
        Pause {a.name} (no reports or jobs until you turn it back on)
      </label>
    </section>
  );
}

/* ---------- on Today ---------- */

export function AgentsToday({ list }: { list: AgentList }) {
  const items = list.agents.flatMap((a) => openNeeds(a).map((n) => ({ a, n })));
  if (!items.length) return null;
  return (
    <Link href="/agents" className="card ag-today" data-ag-today>
      <div className="head">
        <h2>Your agents</h2>
        <span className="pill y">{items.length} {items.length === 1 ? 'needs' : 'need'} you</span>
      </div>
      <ul className="ag-today-list">
        {items.slice(0, 3).map(({ a, n }) => (
          <li key={n.id}>
            <b>{a.name}:</b> {n.text}
          </li>
        ))}
      </ul>
      {items.length > 3 ? <p className="note">and {items.length - 3} more</p> : null}
    </Link>
  );
}
