'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import {
  addDays,
  daysBetween,
  endOf,
  isSunday,
  mondayOf,
  nearDay,
  planChanges,
  rangeOf,
  rowOf,
  rowWords,
  shortDay,
  spanWords,
  suggestedDates,
  timelineRows,
  todayKey,
  weekday,
  workDaysBetween,
  type Change,
  type Row,
} from '@/lib/job-timeline';
import { hm, problemText, whatOf, type Marks, type Sm8 } from './current';
import { clock } from './sm8-post';
import { Icon } from './icons';
import { TimelineTabs } from './client-board';
import { field, label } from './parts';

/* Job timeline (19 Oct 2026, Raf: 'add Gant chart to jobkit as a separate section where we decide on job start and
   finish time and progress in a smart compact way'). A Gantt chart of the jobs on Work Order: each job's bar runs from
   its first booked work day in ServiceM8 to its last (striped where a day in between isn't booked), filled as far as
   Raf says it's got. Tapping a job opens a sheet to set its start and finish (saved as ServiceM8 bookings, so they're
   in the Diary too), move the whole job, and set how far along it is (kept on the phone). The sums are in
   src/lib/job-timeline.ts. */

const ZOOM_KEY = 'raf_jobkit_timeline_zoom';
const DAY_W = { days: 30, weeks: 11 } as const;
type Zoom = keyof typeof DAY_W;
const STEPS = [0, 25, 50, 75, 100];
const DAY = 864e5;

function savedZoom(): Zoom {
  try {
    return localStorage.getItem(ZOOM_KEY) === 'weeks' ? 'weeks' : 'days';
  } catch {
    return 'days';
  }
}
const sigOf = (r: Row | null) => (r ? r.bookings.map((b) => `${b.uuid}${b.start}${b.end}`).join('|') : 'none');
const ago = (t: number) => {
  const d = Math.floor((Date.now() - t) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

/* "2 on now · 1 starts this week · 1 needs dates" */
export function timelineSummary(rows: Row[], undated: CurrentJob[], now = todayKey()) {
  const live = rows.filter((r) => r.state !== 'completed');
  const on = live.filter((r) => r.state === 'on').length;
  const soon = live.filter((r) => r.state === 'upcoming' && daysBetween(now, r.start) <= 7).length;
  const later = live.filter((r) => r.state === 'upcoming' && daysBetween(now, r.start) > 7).length;
  const late = live.filter((r) => r.state === 'late').length;
  const done = live.filter((r) => r.state === 'finished').length;
  const parts = [
    on ? `${on} on now` : '',
    late ? `${late} past ${late === 1 ? 'its' : 'their'} finish` : '',
    done ? `${done} to move to Completed` : '',
    soon ? `${soon} start${soon === 1 ? 's' : ''} within a week` : '',
    later ? `${later} later` : '',
    undated.length ? `${undated.length} need${undated.length === 1 ? 's' : ''} dates` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function JobTimeline({
  sm8,
  marks,
  loading,
  focus,
  onRefresh,
  onOpen,
  onBoard,
  onSave,
  onProgress,
  onComplete,
}: {
  sm8: Sm8;
  marks: Marks;
  loading: boolean;
  focus?: string; // a job uuid: open its sheet (from the job screen)
  onRefresh: () => void;
  onOpen: (uuid: string) => void;
  onBoard: () => void;
  onSave: (job: CurrentJob, changes: Change[]) => Promise<string>;
  onProgress: (uuid: string, progress: number) => void;
  onComplete: (uuid: string) => void;
}) {
  const now = todayKey();
  const { rows, undated } = timelineRows(sm8.jobs, sm8.bookings, marks, now);
  const [zoom, setZoomState] = useState<Zoom>(savedZoom);
  const setZoom = (z: Zoom) => {
    setZoomState(z);
    try {
      localStorage.setItem(ZOOM_KEY, z);
    } catch {
      /* no storage: back to days next time */
    }
  };
  const [open, setOpen] = useState<string | null>(focus ?? null);
  const [note, setNote] = useState<{ uuid: string; text: string } | null>(null);
  const job = open ? sm8.jobs.find((j) => j.uuid === open) : undefined;
  const row = job ? rowOf(job, sm8.bookings ?? [], marks, now) : null;
  const problem = problemText(sm8.error, sm8.detail, sm8.at);
  const summary = timelineSummary(rows, undated, now);
  const scrollToToday = useRef<() => void>(() => {});

  return (
    <div className="pt-7">
      <p className="kicker">Gantt chart · jobs on Work Order</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="gantt" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Job timeline
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[13px] text-faint">
        <span>ServiceM8’s bookings{sm8.at ? `, ${clock(sm8.at)}` : ''}</span>
        <button type="button" onClick={onRefresh} className="h-9 text-accent underline" disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </p>
      <TimelineTabs on="gantt" onGantt={() => {}} onBoard={onBoard} />
      {problem ? (
        <p role="alert" className="mt-3 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem}
        </p>
      ) : null}
      {sm8.at && sm8.bookings === null ? (
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          ServiceM8 didn’t send the bookings this time, so the dates may be missing. Refresh to try again.
        </p>
      ) : null}

      {rows.length ? (
        <>
          {summary ? <p className="mt-3 text-[15.5px] font-semibold leading-snug">{summary}</p> : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div role="group" aria-label="Zoom" className="flex rounded-sm border border-line-strong bg-mount p-0.5">
              {(['days', 'weeks'] as Zoom[]).map((z) => (
                <button
                  key={z}
                  type="button"
                  aria-pressed={zoom === z}
                  onClick={() => setZoom(z)}
                  className={`h-9 rounded-[1px] px-3.5 font-mono text-[13px] ${zoom === z ? 'bg-ink text-on-accent' : 'text-muted'}`}
                >
                  {z === 'days' ? 'Days' : 'Weeks'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollToToday.current()}
              className="h-10 rounded-sm border border-line-strong bg-mount px-3.5 font-mono text-[13px] text-accent"
            >
              Today
            </button>
          </div>
          <Chart rows={rows} now={now} zoom={zoom} onPick={setOpen} todayRef={scrollToToday} />
          <p className="mt-2.5 font-mono text-[12px] leading-relaxed text-faint">
            Each bar: the days booked in ServiceM8, striped where one isn’t; the dark part is how far along. Blue line: today. Tap a job to change it.
          </p>
        </>
      ) : sm8.at ? (
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          {undated.length
            ? 'Nothing booked yet for the jobs going ahead. Set their dates below and they show here as bars.'
            : 'No jobs on Work Order. When a quote goes ahead (They said yes: move to Work Order), it shows here to plan.'}
        </p>
      ) : (
        <p className="mt-4 text-[15px] text-muted">Getting the jobs from ServiceM8…</p>
      )}

      {undated.length ? (
        <section className="mt-7">
          <h2 className={label}>Going ahead, no dates ({undated.length})</h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">No work booked for these in ServiceM8 from two months back on.</p>
          <ul className="mt-3 grid grid-cols-1 gap-2.5">
            {undated.map((j) => (
              <li key={j.uuid} className="flex items-center gap-3 rounded-sm border border-line-strong bg-mount px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold leading-snug">{j.name}</span>
                  <span className="block truncate text-[14px] text-muted">
                    {[j.area, j.description ? whatOf(j.description) : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => setOpen(j.uuid)}>
                  Set dates
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {job ? (
        <PlanSheet
          key={`${job.uuid}-${sigOf(row)}`}
          job={job}
          row={row}
          now={now}
          note={note?.uuid === job.uuid ? note.text : ''}
          onClose={() => {
            setOpen(null);
            setNote(null);
          }}
          onSave={async (changes) => {
            setNote(null);
            const err = await onSave(job, changes);
            if (!err)
              setNote({
                uuid: job.uuid,
                text: `Saved in ServiceM8, so it’s in the Diary too.`,
              });
            return err;
          }}
          onProgress={(p) => onProgress(job.uuid, p)}
          onComplete={() => {
            onComplete(job.uuid);
            setNote({
              uuid: job.uuid,
              text: 'Moved to Completed in ServiceM8.',
            });
          }}
          onOpen={() => onOpen(job.uuid)}
        />
      ) : null}
    </div>
  );
}

/* ---------- the chart ---------- */

function Chart({
  rows,
  now,
  zoom,
  onPick,
  todayRef,
}: {
  rows: Row[];
  now: string;
  zoom: Zoom;
  onPick: (uuid: string) => void;
  todayRef: React.RefObject<() => void>;
}) {
  const range = rangeOf(rows, now);
  const dw = DAY_W[zoom];
  const idx = (k: string) => daysBetween(range.from, k);
  const scroller = useRef<HTMLDivElement>(null);
  const from = range.from;
  // The earliest start of a job still going (on now or past its finish), so its bar shows when the chart opens.
  const earliest = rows.filter((r) => r.state === 'on' || r.state === 'late' || r.state === 'finished').reduce((k, r) => (r.start < k ? r.start : k), now);
  // Opens a couple of days before today (a week before in Weeks), or earlier to show a job that's been going a while
  // as long as today stays on screen; Today scrolls back there.
  useLayoutEffect(() => {
    const go = (smooth: boolean) => {
      const el = scroller.current;
      if (!el) return;
      const t = daysBetween(from, now);
      const fit = Math.floor(el.clientWidth / dw) - 2; // days that fit, less a margin
      const target =
        zoom === 'days'
          ? Math.max(t - fit, Math.min(t - 2, daysBetween(from, earliest) - 1))
          : Math.max(t - fit, Math.min(daysBetween(from, mondayOf(now)) - 7, daysBetween(from, mondayOf(earliest))));
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({
        left: Math.max(0, target * dw),
        behavior: smooth && !reduce ? 'smooth' : 'instant',
      });
    };
    go(false);
    todayRef.current = () => go(true);
  }, [zoom, dw, from, now, earliest, todayRef]);

  const days: string[] = [];
  for (let k = range.from; k <= range.to; k = addDays(k, 1)) days.push(k);
  const months = days.filter((k, i) => i === 0 || k.endsWith('-01'));
  const tIdx = idx(now);

  return (
    <div className="jk-tl mt-3" style={{ '--dw': `${dw}px` } as React.CSSProperties}>
      <div className="jk-tl-scroll" ref={scroller}>
        <div className="jk-tl-inner" style={{ width: range.days * dw }}>
          <div className="jk-tl-head" aria-hidden>
            {months.map((k, i) => (
              <span key={k} className="jk-tl-month" style={{ left: idx(k) * dw }}>
                {new Date(`${k}T12:00`).toLocaleDateString('en-GB', {
                  month: zoom === 'days' || i === 0 || k.slice(5, 7) === '01' ? 'long' : 'short',
                  ...(k.slice(5, 7) === '01' || i === 0 ? { year: 'numeric' } : {}),
                })}
              </span>
            ))}
            {zoom === 'days'
              ? days.map((k) => (
                  <span key={k} className={`jk-tl-day${k === now ? ' is-today' : ''}${isSunday(k) ? ' is-sun' : ''}`} style={{ left: idx(k) * dw, width: dw }}>
                    <span>{'SMTWTFS'[weekday(k)]}</span>
                    <span>{Number(k.slice(8))}</span>
                  </span>
                ))
              : days
                  .filter((k) => weekday(k) === 1)
                  .map((k) => (
                    <span key={k} className={`jk-tl-week${k === mondayOf(now) ? ' is-today' : ''}`} style={{ left: idx(k) * dw, width: 7 * dw }}>
                      {Number(k.slice(8))}{' '}
                      {new Date(`${k}T12:00`).toLocaleDateString('en-GB', {
                        month: 'short',
                      })}
                    </span>
                  ))}
          </div>
          <div className="jk-tl-body">
            {days.map((k) =>
              isSunday(k) || (zoom === 'days' && weekday(k) === 6) ? (
                <span key={k} aria-hidden className={isSunday(k) ? 'jk-tl-sun' : 'jk-tl-sat'} style={{ left: idx(k) * dw, width: dw }} />
              ) : null
            )}
            <span aria-hidden className="jk-tl-today" style={{ left: tIdx * dw + dw / 2 - 1 }} />
            {rows.map((r) => {
              const left = idx(r.start) * dw;
              const width = (idx(r.end) - idx(r.start) + 1) * dw;
              const warn = r.state === 'late' || r.behind;
              return (
                <div key={r.job.uuid} className={`jk-tl-row is-${r.state}`}>
                  <button type="button" className="jk-tl-label" onClick={() => onPick(r.job.uuid)}>
                    <span className="jk-tl-name">{r.job.name}</span>
                    <span className={`jk-tl-words${warn ? ' is-warn' : ''}`}>{rowWords(r, now)}</span>
                  </button>
                  <div className={`jk-tl-bar${r.behind ? ' is-behind' : ''}`} style={{ left: left + 1, width: width - 2 }} onClick={() => onPick(r.job.uuid)}>
                    {r.progress ? <span className="jk-tl-fill" style={{ width: `${r.progress}%` }} /> : null}
                    {r.gaps.map((g) => (
                      <span
                        key={g}
                        className="jk-tl-gap"
                        style={{
                          left: (idx(g) - idx(r.start)) * dw - 1,
                          width: dw,
                        }}
                      />
                    ))}
                  </div>
                  {r.state === 'late' ? (
                    <span
                      aria-hidden
                      className="jk-tl-over"
                      style={{
                        left: left + width,
                        width: (tIdx - idx(r.end)) * dw,
                      }}
                    />
                  ) : null}
                  {r.progress !== undefined && r.state !== 'completed' ? (
                    <span
                      aria-hidden
                      className="jk-tl-after"
                      style={{
                        left: (r.state === 'late' ? (tIdx + 1) * dw : left + width) + 5,
                      }}
                    >
                      {r.progress}%
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- one job: dates and how far along ---------- */

function PlanSheet({
  job,
  row,
  now,
  note,
  onClose,
  onSave,
  onProgress,
  onComplete,
  onOpen,
}: {
  job: CurrentJob;
  row: Row | null;
  now: string;
  note: string;
  onClose: () => void;
  onSave: (changes: Change[]) => Promise<string>;
  onProgress: (p: number) => void;
  onComplete: () => void;
  onOpen: () => void;
}) {
  const base = row ? { start: row.start, end: row.end } : suggestedDates(now);
  const [start, setStart] = useState(base.start);
  const [end, setEnd] = useState(base.end);
  const [shift, setShift] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState('');
  const [sure, setSure] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
      if (disarm.current) clearTimeout(disarm.current);
    };
  }, [onClose]);

  const plan = planChanges(row, start, end, shift);
  const changed = row ? start !== row.start || end !== row.end || shift !== 0 : true;
  const many = (row?.bookings.length ?? 0) > 1;
  const progress = row?.progress;
  const live = job.status === 'Work Order';

  const setStartTo = (k: string) => {
    setFault('');
    setStart(k);
    if (k > end) setEnd(k);
  };
  const setEndTo = (k: string) => {
    setFault('');
    setEnd(k < start ? start : k);
  };
  const moveAll = (n: number) => {
    setFault('');
    setShift((s) => s + n);
    setStart(addDays(start, n));
    setEnd(addDays(end, n));
  };
  const putBack = () => {
    setFault('');
    setShift(0);
    setStart(base.start);
    setEnd(base.end);
  };
  const save = () => {
    if (plan.error || !plan.changes.length) return;
    setBusy(true);
    setFault('');
    void onSave(plan.changes).then((err) => {
      setBusy(false);
      if (err) setFault(err);
    });
  };
  const complete = () => {
    if (disarm.current) clearTimeout(disarm.current);
    if (!sure) {
      setSure(true);
      disarm.current = setTimeout(() => setSure(false), 5000);
      return;
    }
    setSure(false);
    onComplete();
  };

  const first = row?.bookings[0];
  const last = row ? row.bookings.reduce((x, b) => (endOf(b) > endOf(x) ? b : x)) : undefined;
  const bookedLine = !row
    ? 'Nothing booked yet. Saving books 8:00 to 16:00 each day in ServiceM8.'
    : many
    ? `${row.bookings.length} bookings, ${spanWords(row.start, row.end)} · ${row.booked.length} day${row.booked.length === 1 ? '' : 's'}`
    : `${shortDay(row.start)}, ${hm(first!.start)} to ${row.end === row.start ? '' : `${shortDay(row.end)}, `}${hm(endOf(last!))}`;
  const nearest = row && row.state === 'on' ? STEPS.reduce((x, s) => (Math.abs(s - row.expected) < Math.abs(x - row.expected) ? s : x)) : undefined;

  return (
    <div className="jk-key-back" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="jk-plan-title" className="jk-key jk-plan" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[12.5px] text-faint">
          {job.name}
          {job.area ? ` · ${job.area}` : ''}
          {job.number ? ` · #${job.number}` : ''}
        </p>
        <h2 id="jk-plan-title" ref={title} tabIndex={-1} className="mt-0.5 font-display text-[21px] font-[680] leading-tight tracking-[-0.02em]">
          {job.description ? whatOf(job.description) : 'Job'}
        </h2>
        {row ? (
          <p className={`mt-1 text-[14.5px] leading-snug ${row.behind || row.state === 'late' ? 'font-semibold text-ink' : 'text-muted'}`}>
            {rowWords(row, now)}
          </p>
        ) : null}

        <h3 className={`${label} mt-4`}>Start and finish</h3>
        <p className="mt-1 text-[14px] leading-snug text-muted">{row ? `Booked: ${bookedLine}` : bookedLine}</p>
        {live ? (
          <>
            <div className="mt-2.5 grid gap-2">
              <DayPicker name="Start" value={start} onChange={setStartTo} />
              <DayPicker name="Finish" value={end} min={start} onChange={setEndTo} />
            </div>
            <p className="mt-1.5 font-mono text-[12.5px] text-faint">
              {many
                ? 'The bookings in between stay as they are.'
                : `${workDaysBetween(start, end)} work day${workDaysBetween(start, end) === 1 ? '' : 's'}, Sundays not counted`}
            </p>
            <p className="mt-3 text-[14px] text-muted">Move the whole job</p>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {(
                [
                  [-7, '‹ week'],
                  [-1, '‹ day'],
                  [1, 'day ›'],
                  [7, 'week ›'],
                ] as const
              ).map(([n, t]) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => moveAll(n)}
                  className="h-10 rounded-sm border border-line-strong bg-mount px-1 font-mono text-[12.5px]"
                  aria-label={`Move the whole job ${Math.abs(n) === 7 ? 'a week' : 'a day'} ${n < 0 ? 'earlier' : 'later'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {plan.error && changed ? (
              <p role="alert" className="mt-2.5 text-[14px] font-semibold leading-snug text-ink">
                {plan.error}
              </p>
            ) : null}
            {fault ? (
              <p role="alert" className="mt-2.5 text-[14px] leading-snug text-ink">
                {fault}
              </p>
            ) : null}
            {note && !changed ? (
              <p role="status" className="mt-2.5 text-[14px] font-semibold leading-snug jk-sec-ink">
                {note}
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                className="btn btn-primary btn-sm flex-1 disabled:opacity-40"
                disabled={busy || !changed || !!plan.error || !plan.changes.length}
                onClick={save}
              >
                {busy ? 'Saving…' : row ? 'Save to ServiceM8' : 'Book it in ServiceM8'}
              </button>
              {row && changed ? (
                <button type="button" className="h-10 text-[14px] text-muted underline" onClick={putBack}>
                  Put back
                </button>
              ) : null}
            </div>
          </>
        ) : note ? (
          <p role="status" className="mt-2.5 text-[14px] font-semibold leading-snug jk-sec-ink">
            {note}
          </p>
        ) : null}

        {row ? (
          <>
            <h3 className={`${label} mt-5`}>How far along</h3>
            <div role="group" aria-label="How far along" className="mt-2 grid grid-cols-5 gap-1.5">
              {STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={progress === s}
                  disabled={!live}
                  onClick={() => onProgress(s)}
                  className={`jk-step min-h-11 rounded-sm border text-[14px] ${progress === s ? 'is-on' : ''} ${nearest === s ? 'is-expected' : ''}`}
                >
                  {s === 100 ? 'Done' : `${s}%`}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[12.5px] leading-snug text-faint">
              {!live
                ? 'Completed in ServiceM8.'
                : [
                    progress !== undefined && row.progressAt ? `Set ${ago(row.progressAt)}` : 'Not set yet',
                    nearest !== undefined ? `about ${row.expected}% by the days gone (dotted)` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
              {live ? '. Kept on this phone.' : ''}
            </p>
            {live && progress === 100 ? (
              <button type="button" className={`btn btn-sm mt-3 w-full ${sure ? 'btn-primary' : 'btn-ghost'}`} onClick={complete}>
                {sure ? 'Tap again: Completed' : 'Job finished: move to Completed'}
              </button>
            ) : null}
          </>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-3">
          <button type="button" className="h-10 text-[14.5px] text-accent underline" onClick={onOpen}>
            Open the job
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DayPicker({ name, value, min, onChange }: { name: string; value: string; min?: string; onChange: (k: string) => void }) {
  return (
    <div className="grid grid-cols-[48px_38px_minmax(0,1fr)_38px] items-center gap-1.5">
      <span className="text-[14.5px] font-semibold">{name}</span>
      <button
        type="button"
        className="h-11 rounded-sm border border-line-strong bg-mount font-mono text-[15px]"
        aria-label={`${name} a day earlier`}
        onClick={() => onChange(addDays(value, -1))}
      >
        ‹
      </button>
      <input
        type="date"
        aria-label={name}
        className={`${field} jk-month h-11 px-2.5`}
        value={value}
        min={min}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
      <button
        type="button"
        className="h-11 rounded-sm border border-line-strong bg-mount font-mono text-[15px]"
        aria-label={`${name} a day later`}
        onClick={() => onChange(addDays(value, 1))}
      >
        ›
      </button>
    </div>
  );
}

/* ---------- Today: two weeks at a glance ---------- */

export function TimelineMini({ sm8, marks, onOpen }: { sm8: Sm8; marks: Marks; onOpen: () => void }) {
  const now = todayKey();
  const { rows, undated } = timelineRows(sm8.jobs, sm8.bookings, marks, now);
  const from = mondayOf(now);
  const to = addDays(from, 13);
  const live = rows.filter((r) => r.state !== 'completed');
  const inView = live.filter((r) => r.end >= from && r.start <= to);
  const later = live.filter((r) => r.start > to);
  const late = live.filter((r) => r.end < from);
  const show = [...late, ...inView, ...later].slice(0, 4);
  const more = live.length - show.length;
  const summary = timelineSummary(rows, undated, now);
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));
  const col = (k: string) => Math.max(0, Math.min(13, daysBetween(from, k)));
  if (!live.length)
    return (
      <button type="button" onClick={onOpen} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Job timeline</span>
          <span className="mt-0.5 block text-[14.5px] text-muted">{undated.length ? summary : 'Start and finish dates for the jobs on Work Order'}</span>
        </span>
        <span aria-hidden className="jk-sec-ink">
          →
        </span>
      </button>
    );
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Job timeline: ${summary || `${live.length} jobs`}. Open it.`}
      className="block w-full px-4 pb-3 pt-2.5 text-left"
    >
      {/* Every name sits in column 1, so each job starts a new grid row; the bars take their days' columns. */}
      <span aria-hidden className="jk-mini">
        <span style={{ gridColumn: 1 }} />
        <span className="jk-mini-wk" style={{ gridColumn: '2 / span 7' }}>
          This week
        </span>
        <span className="jk-mini-wk" style={{ gridColumn: '9 / span 7' }}>
          Next week
        </span>
        <span style={{ gridColumn: 1 }} />
        {days.map((k) => (
          <span key={k} className={`jk-mini-d${k === now ? ' is-today' : ''}${isSunday(k) ? ' is-sun' : ''}`}>
            {'SMTWTFS'[weekday(k)]}
          </span>
        ))}
        {show.map((r) => {
          const warn = r.state === 'late' || r.behind;
          return [
            <span key={`${r.job.uuid}-n`} className={`jk-mini-name${warn ? ' is-warn' : ''}`} style={{ gridColumn: 1 }}>
              {r.job.name}
            </span>,
            r.start > to ? (
              <span key={`${r.job.uuid}-b`} className="jk-mini-later" style={{ gridColumn: '2 / span 14' }}>
                Starts {nearDay(r.start, now)} →
              </span>
            ) : r.end < from ? (
              <span key={`${r.job.uuid}-b`} className="jk-mini-later is-warn" style={{ gridColumn: '2 / span 14' }}>
                Finish was {nearDay(r.end, now)}
              </span>
            ) : (
              <span
                key={`${r.job.uuid}-b`}
                className={`jk-mini-bar${r.start < from ? ' cut-l' : ''}${r.end > to ? ' cut-r' : ''}`}
                style={
                  {
                    gridColumn: `${2 + col(r.start)} / ${3 + col(r.end)}`,
                    '--p': `${r.progress ?? 0}%`,
                  } as React.CSSProperties
                }
              />
            ),
          ];
        })}
      </span>
      <span className="mt-2 flex items-baseline justify-between gap-3 text-[14px]">
        <span className="min-w-0 text-muted">
          {summary}
          {more > 0 ? ` · ${more} more` : ''}
        </span>
        <span className="shrink-0 jk-sec-ink">Open →</span>
      </span>
    </button>
  );
}
