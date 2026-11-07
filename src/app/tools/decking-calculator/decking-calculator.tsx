'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import {
  BOARDS,
  CENTRES,
  DECK_MAX,
  DECK_MIN,
  DECK_START,
  deck,
  deckBriefHref,
  deckPlan,
  deckText,
  readMetres,
  type DeckBoard,
  type DeckHeight,
  type DeckRun,
} from '@/lib/decking-calc';
import './decking.css';

/* The decking calculator (7 Nov 2026, Raf picked mockup A, "Drawing first", on the 'Decking calculator mockups'
   canvas): the deck drawn from above to scale (Boards, or Frame for the joists, noggins and pads), the five
   questions, then what to buy, the checks and Get a quote. The sums are in src/lib/decking-calc.ts. */

const m1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const n0 = (x: number) => Math.round(x).toLocaleString('en-GB');
const clamp = (x: number) => Math.min(DECK_MAX, Math.max(DECK_MIN, Math.round(x * 10) / 10));

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 font-mono text-[12px] uppercase tracking-[0.06em] text-muted">
        {n} · {title}
      </p>
      {children}
    </div>
  );
}

function Choice<T extends string | number>({
  options,
  value,
  onPick,
  cols = 2,
  mono = false,
}: {
  options: { v: T; label: string; sub?: string }[];
  value: T;
  onPick: (v: T) => void;
  cols?: 2 | 3;
  mono?: boolean;
}) {
  return (
    <div className={`grid gap-2.5 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o.v)}
            className={`flex min-h-12 flex-col justify-center gap-0.5 rounded-sm border-[1.5px] px-3 py-2.5 text-left transition-colors ${
              on ? 'border-ink bg-ink text-on-accent' : 'border-line-strong bg-mount text-ink hover:border-accent'
            } ${mono ? 'items-center font-mono text-[15px]' : ''}`}
          >
            <span className={mono ? '' : 'text-[15px] font-semibold leading-tight'}>{o.label}</span>
            {o.sub ? <span className={`font-mono text-[11.5px] leading-snug ${on ? 'text-on-accent/80' : 'text-faint'}`}>{o.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function SizeField({ id, label, text, onText, onStep }: { id: string; label: string; text: string; onText: (t: string) => void; onStep: (by: number) => void }) {
  const bad = readMetres(text) === null;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium">
        {label}
      </label>
      <div
        className={`flex h-12 overflow-hidden rounded-sm border bg-mount focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${
          bad ? 'border-accent ring-2 ring-accent/20' : 'border-line-strong'
        }`}
      >
        <button type="button" aria-label={`${label}: 10 cm less`} onClick={() => onStep(-0.1)} className="w-11 flex-none text-[20px] text-muted transition-colors hover:text-ink">
          −
        </button>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => onText(e.target.value.slice(0, 6))}
          aria-invalid={bad || undefined}
          className="min-w-0 flex-1 bg-transparent text-center font-mono text-[18px] text-ink outline-none"
        />
        <button type="button" aria-label={`${label}: 10 cm more`} onClick={() => onStep(0.1)} className="w-11 flex-none text-[20px] text-muted transition-colors hover:text-ink">
          +
        </button>
      </div>
    </div>
  );
}

export default function DeckingCalculator() {
  const [lenT, setLenT] = useState(m1(DECK_START.len));
  const [depT, setDepT] = useState(m1(DECK_START.dep));
  const [len, setLen] = useState(DECK_START.len);
  const [dep, setDep] = useState(DECK_START.dep);
  const [board, setBoard] = useState<DeckBoard>(DECK_START.board);
  const [run, setRun] = useState<DeckRun>(DECK_START.run);
  const [height, setHeight] = useState<DeckHeight>(DECK_START.height);
  const [centres, setCentres] = useState<number>(DECK_START.centres);
  const [view, setView] = useState<'boards' | 'frame'>('boards');
  const [copied, setCopied] = useState(false);

  const d = deck({ len, dep, board, run, height, centres });
  const plan = deckPlan(d, view);
  const b = BOARDS[board];

  const typed = (setT: (t: string) => void, set: (v: number) => void) => (t: string) => {
    setT(t);
    const v = readMetres(t);
    if (v !== null) set(v);
  };
  const stepped = (cur: number, setT: (t: string) => void, set: (v: number) => void) => (by: number) => {
    const v = clamp(cur + by);
    set(v);
    setT(m1(v));
  };
  const badSize = readMetres(lenT) === null || readMetres(depT) === null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deckText(d));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the browser said no: Send this list to WhatsApp still works */
    }
  };

  return (
    <div className="dk grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12" data-board={board}>
      {/* the deck from above, to scale */}
      <div className="lg:sticky lg:top-[88px] lg:self-start">
        <div className="dk-card rounded-sm border border-line bg-mount p-3.5 shadow-[0_1px_3px_rgb(22_25_28/0.08)] md:p-5" data-deck-plan>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div role="group" aria-label="What the drawing shows" className="flex overflow-hidden rounded-sm border border-line-strong">
              {(
                [
                  ['boards', 'Boards'],
                  ['frame', 'Frame'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`h-10 px-4 text-[14px] font-medium transition-colors ${view === v ? 'bg-ink text-on-accent' : 'bg-mount text-ink hover:text-accent'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="font-mono text-[11px] uppercase text-faint">From above · to scale</span>
          </div>

          <div className="dk-plan" style={{ '--dk-ratio': String(len / dep) } as CSSProperties}>
            <div className="dk-house">
              <span>House wall</span>
            </div>
            <svg
              className="dk-svg"
              viewBox={`0 0 ${plan.w} ${plan.h}`}
              role="img"
              aria-label={`The deck from above, ${n0(plan.w)} along the house by ${n0(plan.h)} out, ${
                view === 'boards' ? `${d.rows} rows of boards` : `${d.joists} joists ${height === 'raised' ? `on ${d.posts} posts` : `on ${d.pads} pads`}`
              }`}
            >
              <rect width={plan.w} height={plan.h} className="dk-membrane" />
              {plan.rects.map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} className={`dk-${r.kind}`} />
              ))}
            </svg>
            <div className="dk-dimw" aria-hidden="true">
              <span className="dk-tick" />
              <span className="dk-line" />
              <span className="dk-num">{n0(plan.w)}</span>
              <span className="dk-line" />
              <span className="dk-tick" />
            </div>
            <div className="dk-dimd" aria-hidden="true">
              <span className="dk-tick" />
              <span className="dk-line" />
              <span className="dk-num">{n0(plan.h)}</span>
              <span className="dk-line" />
              <span className="dk-tick" />
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-3 font-mono text-[12px] text-muted">
            <span aria-live="polite">
              {m1(len)} × {m1(dep)} m · {d.area} m² · {d.boards} boards
            </span>
            <span>↓ falls {d.fall} mm to the front</span>
          </div>
          <p className="mt-2 text-[13.5px] leading-snug text-faint">
            {view === 'boards'
              ? `${d.rows} rows of ${board} boards, ${b.gap} mm apart. Tap Frame to see what holds them up.`
              : `${d.joists} joists at ${centres} mm, a rim at each end, noggins between, on ${height === 'raised' ? `${d.posts} posts` : `${d.pads} pads`}.`}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        {/* the five questions */}
        <div className="flex flex-col gap-6">
          <Step n="01" title="Size in metres">
            <div className="grid grid-cols-2 gap-3">
              <SizeField id="deck-len" label="Along the house" text={lenT} onText={typed(setLenT, setLen)} onStep={stepped(len, setLenT, setLen)} />
              <SizeField id="deck-dep" label="Out from the house" text={depT} onText={typed(setDepT, setDep)} onStep={stepped(dep, setDepT, setDep)} />
            </div>
            {badSize ? <p className="mt-2 font-mono text-[12.5px] text-accent">Between 1 and 20 metres, like 3.5</p> : null}
          </Step>
          <Step n="02" title="Boards">
            <Choice
              options={[
                { v: 'composite' as DeckBoard, label: 'Composite', sub: `${BOARDS.composite.w} × ${BOARDS.composite.t} · 3.6 m` },
                { v: 'softwood' as DeckBoard, label: 'Softwood', sub: `${BOARDS.softwood.w} × ${BOARDS.softwood.t} · 2.4 to 4.8 m` },
              ]}
              value={board}
              onPick={setBoard}
            />
          </Step>
          <Step n="03" title="Boards run">
            <Choice
              options={[
                { v: 'along' as DeckRun, label: 'Along the house' },
                { v: 'out' as DeckRun, label: 'Out from it' },
              ]}
              value={run}
              onPick={setRun}
            />
          </Step>
          <Step n="04" title="Height">
            <Choice
              options={[
                { v: 'ground' as DeckHeight, label: 'On the ground', sub: 'pads, about 150 high' },
                { v: 'raised' as DeckHeight, label: 'Raised', sub: 'on posts, over 30 cm' },
              ]}
              value={height}
              onPick={setHeight}
            />
          </Step>
          <Step n="05" title="Joists every">
            <Choice options={CENTRES.map((c) => ({ v: c as number, label: String(c) }))} value={centres} onPick={setCentres} cols={3} mono />
            <p className="mt-2 text-[13.5px] leading-snug text-faint">400 suits most boards. Some hollow composite boards ask for 300: check the pack.</p>
          </Step>
        </div>

        {/* what to buy */}
        <section className="mt-9" aria-labelledby="deck-list">
          <h2 id="deck-list" className="font-display text-[26px] font-[680] tracking-[-0.015em]">
            What you need
          </h2>
          <div className="mt-3 rounded-sm border border-line bg-mount px-3.5 pb-2.5 pt-1 shadow-[0_1px_3px_rgb(22_25_28/0.08)] md:px-5" data-deck-list>
            {d.items.map((it, i) => {
              const first = i === 0 || d.items[i - 1].group !== it.group;
              return (
                <div key={it.what}>
                  {first ? <p className="mb-1 mt-3.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent">{it.group}</p> : null}
                  <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 border-t border-line py-2">
                    <span className="font-display text-[20px] font-[680] leading-tight">{it.qty}</span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-medium leading-snug">{it.what}</span>
                      <span className="text-[13px] leading-snug text-faint">{it.note}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* the checks */}
        <ul className="mt-6 flex flex-col gap-2.5" data-deck-checks>
          {d.checks.map((c) => (
            <li key={c.text} className="flex items-start gap-2.5 text-[14.5px] leading-snug">
              {c.warn ? (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-px flex-none stroke-ink" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 3l8 14H2z" />
                  <path d="M10 8v4M10 14.5v.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-px flex-none stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 10.5l4 4 8-9" />
                </svg>
              )}
              <span className={c.warn ? 'font-semibold' : ''}>{c.text}</span>
            </li>
          ))}
        </ul>

        {/* Rather I build it? */}
        <div className="mt-8 rounded-sm bg-ink p-5 text-on-accent md:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-on-accent/70">Rather I build it?</p>
          <p className="mt-1.5 font-display text-[22px] font-[650] leading-tight tracking-[-0.01em]">I build decks across London. Send me the size and I&apos;ll quote, free.</p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Link href={deckBriefHref(d)} className="btn btn-primary w-full">
              Get a quote
            </Link>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(deckText(d))}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-12 items-center justify-center rounded-sm border-[1.5px] border-on-accent/30 px-4 text-[15px] font-medium text-on-accent transition-colors hover:border-on-accent"
            >
              Send this list to WhatsApp
            </a>
          </div>
          <button type="button" onClick={copy} className="mt-3 font-mono text-[12.5px] text-on-accent/75 underline underline-offset-4 hover:text-on-accent">
            {copied ? 'Copied the list' : 'Copy the list'}
          </button>
        </div>
        <p className="mt-3.5 text-[13.5px] leading-relaxed text-faint">
          Rough sizes are fine for a list. Check the board maker&apos;s fitting sheet before you buy: it has the last word on gaps, joists and fixings.
        </p>
      </div>
    </div>
  );
}
