'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  addDays,
  dateWords,
  dayOf,
  DAY_SHORT,
  describe,
  dueNow,
  fitRepeat,
  groups,
  lateWords,
  parseChore,
  STARTERS,
  tick,
  untick,
  weekday,
  type Chore,
  type Group,
  type Repeat,
  type Unit,
} from '@/lib/chores';
import { Icon } from './icons';
import { field, label } from './parts';
import { dropChore, newChoreId, putBack, putChore, useChores, useChoreSync, useToday } from './chores-store';

/* The personal to do (26 Oct 2026, Raf: 'create separate todo personal like daily chores unrelated to website and
   programming in a smart way'): its own section, apart from the work To do. Type a chore as you'd say it ('bins out
   every Tuesday 7pm'); a repeating one comes back by itself when it's ticked; Today shows what's due, with the tick
   right there. Sums in src/lib/chores.ts, the list and its phone / computer sync in chores-store.ts. */

const startOf = (today: string) => new Date(`${today}T00:00`).getTime();
const useDay = () => useToday() || dayOf(new Date());

function comesBack(due: string | null, today: string) {
  if (!due) return '';
  const w = dateWords(due, today);
  return w === 'Today' ? 'back today' : w === 'Tomorrow' ? 'back tomorrow' : `back on ${w}`;
}

/* ---------- Undo, shared by the screen and Today's box ---------- */

type Undo = { text: string; before: Chore; n: number } | null;
let undo: Undo = null;
let undoTimer: ReturnType<typeof setTimeout> | undefined;
const undoSubs = new Set<() => void>();
function setUndo(u: Undo) {
  undo = u;
  if (undoTimer) clearTimeout(undoTimer);
  if (u) undoTimer = setTimeout(() => setUndo(null), 8000);
  undoSubs.forEach((f) => f());
}
const useUndo = () =>
  useSyncExternalStore(
    (f) => {
      undoSubs.add(f);
      return () => void undoSubs.delete(f);
    },
    () => undo,
    () => null,
  );

function UndoBar() {
  const u = useUndo();
  if (!u) return null;
  return (
    <div role="status" className="jk-fixbar fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(16px,env(safe-area-inset-bottom))]" data-chore-undo>
      <div className="mx-auto flex max-w-[588px] items-center gap-3 rounded-sm bg-ink px-4 py-2.5 text-[14.5px] leading-snug text-mount shadow-[0_14px_30px_-12px_rgb(22_25_28/0.6)]">
        <span className="min-w-0 flex-1">{u.text}</span>
        <button
          type="button"
          className="h-10 shrink-0 font-semibold underline"
          onClick={() => {
            putBack(u.before);
            setUndo(null);
          }}
        >
          Undo
        </button>
        <button type="button" onClick={() => setUndo(null)} aria-label="Close" className="h-10 w-8 shrink-0 text-[20px] leading-none opacity-70">
          ×
        </button>
      </div>
    </div>
  );
}

function doTick(c: Chore, today: string) {
  const t = tick(c, Date.now(), today);
  putChore(t);
  setUndo({ before: c, n: Date.now(), text: c.rep ? `Done: ${c.text}, ${comesBack(t.due, today)}.` : `Done: ${c.text}.` });
}

/* ---------- one line ---------- */

function CheckBox({ on }: { on?: boolean }) {
  return (
    <span aria-hidden className={`jk-check${on ? ' on' : ''}`}>
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path d="M3.2 8.4l3.1 3.1 6.5-6.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function metaOf(c: Chore, today: string, group: Group['key'] | 'box') {
  const late = !!c.due && c.due < today && !c.done;
  const when = !c.due
    ? ''
    : late
    ? lateWords(c.due, today)
    : group === 'week' || group === 'later' || (group === 'box' && c.due !== today)
    ? dateWords(c.due, today)
    : '';
  return { late, bits: [c.time ?? '', when, c.rep ? `↻ ${describe(c.rep, c.due)}` : ''].filter(Boolean) };
}

function ChoreRow({ c, today, group, onOpen }: { c: Chore; today: string; group: Group['key'] | 'box'; onOpen: (c: Chore) => void }) {
  const [ticking, setTicking] = useState(false);
  const { late, bits } = metaOf(c, today, group);
  const press = () => {
    if (ticking) return;
    const calm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) return doTick(c, today);
    setTicking(true);
    setTimeout(() => doTick(c, today), 260);
  };
  return (
    <li className={`flex items-stretch${ticking ? ' jk-chore-going' : ''}`} data-chore={c.id}>
      <button type="button" aria-label={`Done: ${c.text}`} onClick={press} className="grid w-12 shrink-0 place-items-center self-stretch">
        <CheckBox on={ticking} />
      </button>
      <button type="button" onClick={() => onOpen(c)} className="min-h-[52px] min-w-0 flex-1 py-2.5 pr-3 text-left">
        <span className="block break-words text-[16px] leading-snug">{c.text}</span>
        {bits.length ? (
          <span className={`mt-0.5 block font-mono text-[12.5px] leading-snug ${late ? 'font-semibold text-ink' : 'text-muted'}`}>{bits.join(' · ')}</span>
        ) : null}
        {c.note && group !== 'box' ? <span className="mt-0.5 block truncate text-[14px] text-faint">{c.note}</span> : null}
      </button>
    </li>
  );
}

function DoneRow({ c, today }: { c: Chore; today: string }) {
  return (
    <li className="flex items-stretch" data-chore-done={c.id}>
      <button
        type="button"
        aria-label={`Not done: ${c.text}`}
        onClick={() => putChore(untick(c, Date.now()))}
        className="grid w-12 shrink-0 place-items-center self-stretch"
      >
        <CheckBox on />
      </button>
      <span className="min-h-[48px] min-w-0 flex-1 py-2.5 pr-3">
        <span className="block break-words text-[15.5px] leading-snug text-muted line-through decoration-faint">{c.text}</span>
        {c.rep ? <span className="mt-0.5 block font-mono text-[12.5px] text-faint">{comesBack(c.due, today)}</span> : null}
      </span>
    </li>
  );
}

/* ---------- adding ---------- */

function AddBox({ text, setText, today, inputRef }: { text: string; setText: (s: string) => void; today: string; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [added, setAdded] = useState<Chore | null>(null);
  const parsed = useMemo(() => (text.trim() ? parseChore(text, today) : null), [text, today]);
  const open = /\b(?:every(?:\s+other)?|on|each)\s*$/i.test(text);
  const add = () => {
    if (!parsed || open) return;
    const now = Date.now();
    const c: Chore = { id: newChoreId(), text: parsed.text.slice(0, 200), due: parsed.due, time: parsed.time, rep: parsed.rep, created: now, at: now };
    putChore(c);
    setAdded(c);
    setText('');
    inputRef.current?.focus();
  };
  const whenOf = (c: { due: string | null; time?: string | null; rep?: Repeat | null }) =>
    [c.due ? dateWords(c.due, today) : 'Any time', c.time ?? '', c.rep ? `↻ ${describe(c.rep, c.due)}` : ''].filter(Boolean).join(' · ');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAdded(null);
          }}
          maxLength={200}
          enterKeyHint="done"
          autoComplete="off"
          aria-label="Add a chore"
          placeholder="Bins out every Tuesday 7pm"
          className={`${field} h-12`}
          data-chore-input
        />
        <button type="submit" className="btn btn-primary btn-sm h-12 shrink-0 px-4 disabled:opacity-40" disabled={!parsed || open}>
          Add
        </button>
      </div>
      <p className="mt-1.5 min-h-[20px] text-[14px] leading-snug" aria-live="polite" data-chore-preview>
        {open ? (
          <span className="text-muted">Now the day: Tuesday, the 1st, 14 March…</span>
        ) : parsed ? (
          <>
            <b className="font-semibold">{parsed.text}</b>
            <span className="font-mono text-[12.5px] text-muted"> · {whenOf(parsed)}</span>
          </>
        ) : added ? (
          <span className="jk-sec-ink">
            Added {added.text}: {whenOf(added)}
          </span>
        ) : (
          <span className="text-muted">Type it as you’d say it: “call mum Sunday”, “MOT 14 March every year”.</span>
        )}
      </p>
    </form>
  );
}

/* ---------- changing one ---------- */

const chip = (on: boolean) =>
  `h-10 rounded-sm border px-3 text-[14.5px] ${on ? 'border-[var(--sec)] bg-[var(--sec)] font-semibold text-on-accent' : 'border-line-strong bg-mount text-ink'}`;
const UNITS: Unit[] = ['day', 'week', 'month', 'year'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function ChoreSheet({ c, today, onClose }: { c: Chore; today: string; onClose: () => void }) {
  const [text, setText] = useState(c.text);
  const [due, setDue] = useState<string | null>(c.due);
  const [time, setTime] = useState(c.time ?? '');
  const [rep, setRep] = useState<Repeat | null>(c.rep ?? null);
  const [note, setNote] = useState(c.note ?? '');
  const [sure, setSure] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const day = due ?? today;
  const wd = weekday(day);
  const dom = Number(day.slice(8));
  const presets: { name: string; rep: Repeat | null }[] = [
    { name: 'Never', rep: null },
    { name: 'Every day', rep: { every: 1, unit: 'day' } },
    { name: 'Weekdays', rep: { every: 1, unit: 'week', days: [1, 2, 3, 4, 5] } },
    { name: `Every ${DAY_SHORT[wd]}`, rep: { every: 1, unit: 'week', days: [wd] } },
    { name: `Every other ${DAY_SHORT[wd]}`, rep: { every: 2, unit: 'week', days: [wd] } },
    { name: 'Every month', rep: { every: 1, unit: 'month', dom } },
    { name: 'Every year', rep: { every: 1, unit: 'year', dom } },
  ];
  const words = (x: Repeat | null) => {
    const f = fitRepeat(x, due, today);
    return f.rep ? describe(f.rep, f.due) : '';
  };
  const sameRep = (a: Repeat | null, b: Repeat | null) => words(a) === words(b);
  const known = presets.some((p) => sameRep(p.rep, rep));
  const [custom, setCustom] = useState(!known);
  const wdT = weekday(today);
  const weekend = wdT === 6 || wdT === 0 ? today : addDays(today, 6 - wdT);
  const nextWeek = addDays(today, 7 - ((wdT + 6) % 7));
  const whens: { name: string; key: string | null }[] = [
    { name: 'Today', key: today },
    { name: 'Tomorrow', key: addDays(today, 1) },
    { name: 'Weekend', key: weekend },
    { name: 'Next week', key: nextWeek },
    { name: 'No date', key: null },
  ];

  useEffect(() => {
    title.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 5000);
    return () => clearTimeout(t);
  }, [sure]);

  const save = () => {
    const fit = fitRepeat(rep, due, today);
    putChore({ ...c, text: text.trim().slice(0, 200) || c.text, due: fit.due, time: time || null, rep: fit.rep, note: note.trim().slice(0, 1000) || undefined, at: Date.now() });
    onClose();
  };
  const remove = () => {
    if (!sure) return setSure(true);
    dropChore(c.id);
    setUndo({ before: c, n: Date.now(), text: `Deleted: ${c.text}.` });
    onClose();
  };
  const r = rep ?? { every: 1, unit: 'week' as Unit, days: [wd] };

  return (
    <div className="jk-key-back" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="jk-chore-title" className="jk-key jk-plan" onClick={(e) => e.stopPropagation()} data-chore-sheet>
        <h2 id="jk-chore-title" ref={title} tabIndex={-1} className="font-display text-[21px] font-[680] leading-tight tracking-[-0.02em]">
          {c.done ? 'Done' : c.rep ? 'Repeating chore' : 'Chore'}
        </h2>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} aria-label="What" className={`${field} mt-3 h-12`} />

        <h3 className={`${label} mt-4`}>When</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {whens.map((w) => (
            <button key={w.name} type="button" className={chip(due === w.key)} aria-pressed={due === w.key} onClick={() => setDue(w.key)}>
              {w.name}
            </button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 min-[400px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <input
            type="date"
            aria-label="Date"
            className={`${field} jk-month h-11 px-2.5`}
            value={due ?? ''}
            onChange={(e) => setDue(e.target.value || null)}
          />
          <div className="flex gap-1.5">
            <input type="time" aria-label="Time" className={`${field} jk-month h-11 min-w-0 flex-1 px-2.5`} value={time} onChange={(e) => setTime(e.target.value)} />
            {time ? (
              <button type="button" aria-label="No time" className="h-11 w-9 shrink-0 rounded-sm border border-line-strong bg-mount text-[18px] leading-none text-muted" onClick={() => setTime('')}>
                ×
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-1 font-mono text-[12.5px] text-faint">{due ? `${dateWords(due, today)}${time ? ` at ${time}` : ''}` : 'Any time: it waits under Any time.'}</p>

        <h3 className={`${label} mt-4`}>Repeat</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const on = !custom && sameRep(p.rep, rep);
            return (
              <button
                key={p.name}
                type="button"
                className={chip(on)}
                aria-pressed={on}
                onClick={() => {
                  setCustom(false);
                  setRep(p.rep);
                }}
              >
                {p.name}
              </button>
            );
          })}
          <button
            type="button"
            className={chip(custom)}
            aria-pressed={custom}
            onClick={() => {
              setCustom(true);
              if (!rep) setRep(r);
            }}
          >
            Other…
          </button>
        </div>
        {custom ? (
          <div className="mt-2.5 rounded-sm border border-line-strong bg-mount p-3" data-chore-custom>
            <div className="flex items-center gap-2 text-[15px]">
              <span>Every</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                aria-label="How many"
                className={`${field} h-11 px-2 text-center`}
                style={{ width: 68, flex: 'none' }}
                value={r.every}
                onChange={(e) => setRep({ ...r, every: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
              />
              <select
                aria-label="Days, weeks, months or years"
                className={`${field} h-11 flex-1 px-2`}
                value={r.unit}
                onChange={(e) => {
                  const unit = e.target.value as Unit;
                  setRep(unit === 'week' ? { every: r.every, unit, days: r.days?.length ? r.days : [wd] } : unit === 'day' ? { every: r.every, unit } : { every: r.every, unit, dom });
                }}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {r.every === 1 ? u : `${u}s`}
                  </option>
                ))}
              </select>
            </div>
            {r.unit === 'week' ? (
              <div className="mt-2.5 grid grid-cols-7 gap-1" role="group" aria-label="On these days">
                {ORDER.map((d) => {
                  const on = !!r.days?.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_SHORT[d]}
                      className={`${chip(on)} px-0 font-mono text-[13px]`}
                      onClick={() => {
                        const days = on ? (r.days ?? []).filter((x) => x !== d) : [...(r.days ?? []), d];
                        setRep({ ...r, days });
                      }}
                    >
                      {DAY_SHORT[d].slice(0, 2)}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <p className="mt-2 font-mono text-[12.5px] text-muted">{words(r)}</p>
          </div>
        ) : null}
        <p className="mt-1.5 text-[14px] leading-snug text-muted">
          {rep
            ? `Tick it and it comes back ${['day', 'week'].includes(rep.unit) && !rep.days?.length ? 'counted from the day you did it' : 'on its next date'}.`
            : 'Once only.'}
        </p>

        <h3 className={`${label} mt-4`}>Note</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={2}
          aria-label="Note"
          placeholder="Anything to remember with it"
          className={`${field} mt-1.5 py-2.5`}
        />

        <div className="mt-4 flex items-center gap-3">
          <button type="button" className="btn btn-primary btn-sm h-11 flex-1" onClick={save}>
            Save
          </button>
          <button type="button" className="h-11 px-1 text-[14.5px] text-muted underline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`h-11 px-1 text-[14.5px] underline ${sure ? 'font-semibold text-ink' : 'text-muted'}`} onClick={remove}>
            {sure ? 'Tap again to delete' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- the screen ---------- */

function SyncLine() {
  const s = useChoreSync();
  const words =
    s.state === 'no-pin'
      ? 'Saved on this phone. Add your PIN in Settings to have it on your computer too.'
      : s.state === 'offline'
      ? 'Saved here. It goes to your other device when there’s signal.'
      : s.state === 'error'
      ? 'Saved here. The other device’s copy didn’t answer; it tries again.'
      : s.waiting
      ? 'Saved here, on its way to your other device…'
      : s.at
      ? 'On this phone and your computer.'
      : 'Saved here.';
  return <p className="mt-6 font-mono text-[12.5px] text-faint" data-chore-sync>{words}</p>;
}

export function PersonalView() {
  const list = useChores();
  const today = useDay();
  const [text, setText] = useState('');
  const [edit, setEdit] = useState<Chore | null>(null);
  const [showDone, setShowDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const all = groups(list, today, startOf(today));
  const open = all.filter((g) => g.key !== 'done');
  const done = all.find((g) => g.key === 'done');
  const counts = {
    now: open.filter((g) => g.key === 'late' || g.key === 'today').reduce((n, g) => n + g.items.length, 0),
    soon: open.filter((g) => g.key === 'tomorrow' || g.key === 'week').reduce((n, g) => n + g.items.length, 0),
  };
  const line = !list.length
    ? 'Home, family, the car: kept apart from work.'
    : [counts.now ? `${counts.now} to do today` : 'Nothing left today', counts.soon ? `${counts.soon} more this week` : ''].filter(Boolean).join(' · ');

  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="home" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Personal
      </h1>
      <p className="mt-1.5 text-[15px] text-muted" data-chore-line>
        {line}
      </p>

      <div className="mt-5">
        <AddBox text={text} setText={setText} today={today} inputRef={input} />
      </div>

      {!list.length ? (
        <section className="mt-5" data-chore-starters>
          <h2 className={label}>Ideas to start with</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                className="min-h-10 rounded-sm border border-line-strong bg-mount px-3 py-1.5 text-left text-[14.5px]"
                onClick={() => {
                  setText(s);
                  requestAnimationFrame(() => {
                    const el = input.current;
                    if (!el) return;
                    el.focus();
                    el.setSelectionRange(s.length, s.length);
                  });
                }}
              >
                {s.trim().replace(/\s+(?:every|other|on)$/i, (m) => `${m}…`)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[14px] leading-snug text-muted">Tap one, add its day, then Add. Ticked, a repeating one comes back on its next date.</p>
        </section>
      ) : null}

      {open.map((g) => (
        <section key={g.key} className="mt-6" data-chore-group={g.key}>
          <h2 className={`flex items-center gap-2 ${label} ${g.key === 'late' ? 'font-semibold !text-ink' : ''}`}>
            {g.title}
            <span className="font-normal text-faint">{g.items.length}</span>
          </h2>
          <ul className="jk-chores mt-1.5 divide-y divide-line rounded-sm border border-line-strong bg-mount">
            {g.items.map((c) => (
              <ChoreRow key={c.id} c={c} today={today} group={g.key} onOpen={setEdit} />
            ))}
          </ul>
        </section>
      ))}

      {done ? (
        <section className="mt-6" data-chore-group="done">
          <button type="button" className="flex h-10 items-center gap-2 text-[14.5px] jk-sec-ink" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            <CheckBox on />
            <span className="font-semibold">
              {done.items.length} done today
            </span>
            <span aria-hidden>{showDone ? '▴' : '▾'}</span>
          </button>
          {showDone ? (
            <ul className="jk-chores mt-1 divide-y divide-line rounded-sm border border-line bg-mount">
              {done.items.map((c) => (
                <DoneRow key={c.id} c={c} today={today} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {list.length && !open.length ? <p className="mt-6 text-[15px] text-muted">All done. Nothing waiting.</p> : null}
      <SyncLine />
      {edit ? <ChoreSheet key={edit.id} c={list.find((x) => x.id === edit.id) ?? edit} today={today} onClose={() => setEdit(null)} /> : null}
      <UndoBar />
    </div>
  );
}

/* ---------- Today's box ---------- */

export function usePersonalToday() {
  const list = useChores();
  const today = useDay();
  return { due: dueNow(list, today), list, today };
}

export function PersonalToday({ onOpen }: { onOpen: () => void }) {
  const { due, list, today } = usePersonalToday();
  const shown = due.slice(0, 4);
  const next = list
    .filter((c) => !c.done && c.due && c.due > today)
    .sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : (a.time ?? '99').localeCompare(b.time ?? '99')))[0];
  const any = list.filter((c) => !c.done && !c.due).length;
  const more = due.length - shown.length;
  const rowLine = !list.length
    ? 'Bins, the shop, the MOT: your own list, apart from work'
    : [more > 0 ? `${more} more today` : '', next ? `Next: ${next.text}, ${dateWords(next.due!, today).replace(/^Tomorrow$/, 'tomorrow')}` : '', any ? `${any} any time` : '']
        .filter(Boolean)
        .join(' · ') || 'Nothing else coming up';
  return (
    <div className="px-4" data-personal-box>
      {shown.length ? (
        <ul className="jk-chores -mx-1 divide-y divide-line pt-1">
          {shown.map((c) => (
            <ChoreRow key={c.id} c={c} today={today} group="box" onOpen={onOpen} />
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={onOpen} className={`flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left ${shown.length ? 'border-t border-line' : ''}`}>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Personal to do</span>
          <span className="mt-0.5 block truncate text-[14.5px] text-muted">{rowLine}</span>
        </span>
        <span aria-hidden className="text-[20px] jk-sec-ink">
          →
        </span>
      </button>
      <UndoBar />
    </div>
  );
}
