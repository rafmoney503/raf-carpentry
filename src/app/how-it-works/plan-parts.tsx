'use client';
/* Pieces shared by the brief's wardrobe planner (wardrobe-window.tsx): the dimension lines, the chips, the step
   headings and the size cards, so made to measure and IKEA PAX look the same. */
import { useLayoutEffect, useRef, useState } from 'react';

export const ML = 46; // room for the ceiling dimension on the left
export const MR = 88; // and the height ones on the right
export const MT = 50; // two rows of widths over the top
export const MB = 26; // unit names under the floor

function slash(x: number, y: number) {
  return <line x1={x - 3.5} y1={y + 3.5} x2={x + 3.5} y2={y - 3.5} className="stroke-accent" strokeWidth={1.2} />;
}

export function HDim({ x1, x2, y, label, side }: { x1: number; x2: number; y: number; label: string; side?: 'l' | 'r' }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} className="stroke-accent" strokeWidth={0.8} />
      <line x1={x1} y1={y + 6} x2={x1} y2={y - 6} className="stroke-accent/50" strokeWidth={0.6} />
      <line x1={x2} y1={y + 6} x2={x2} y2={y - 6} className="stroke-accent/50" strokeWidth={0.6} />
      {slash(x1, y)}
      {slash(x2, y)}
      <text
        x={side === 'l' ? x1 - 6 : side === 'r' ? x2 + 6 : (x1 + x2) / 2}
        y={side ? y + 4 : y - 5}
        textAnchor={side === 'l' ? 'end' : side === 'r' ? 'start' : 'middle'}
        className="fill-accent font-mono"
        fontSize={11}
      >
        {label}
      </text>
    </g>
  );
}

/* A height. The words turn with the line when they fit along it; else they sit beside it, level. */
export function VDim({ x, y1, y2, label, flip }: { x: number; y1: number; y2: number; label: string; flip?: boolean }) {
  const span = Math.abs(y2 - y1);
  const fits = span >= label.length * 6.8 + 10;
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} className="stroke-accent" strokeWidth={0.8} />
      {slash(x, y1)}
      {slash(x, y2)}
      {fits ? (
        <text x={flip ? x - 5 : x + 5} y={mid} transform={`rotate(-90 ${flip ? x - 5 : x + 5} ${mid})`} textAnchor="middle" dy={flip ? -1 : 9} className="fill-accent font-mono" fontSize={11}>
          {label}
        </text>
      ) : (
        <text x={x + 7} y={mid + 4} className="fill-accent font-mono" fontSize={11}>
          {label}
        </text>
      )}
    </g>
  );
}

/* The drawing box's own width in px, so the drawing is drawn at real size and 11 px labels stay 11 px. */
export function useBoxWidth() {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setW(Math.max(240, Math.round(el.clientWidth)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box, w };
}

export function Hatch() {
  return (
    <defs>
      <pattern id="plan-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" className="stroke-ink/25" strokeWidth={1} />
      </pattern>
    </defs>
  );
}

/* Filler or infill: grey, hatched. */
export function Strip({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  if (w <= 0 || h <= 0) return null;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} className="fill-raised" />
      <rect x={x} y={y} width={w} height={h} fill="url(#plan-hatch)" />
    </>
  );
}

export function Pick({ on, onClick, title, sub, testId, disabled }: { on: boolean; onClick: () => void; title: string; sub?: string; testId?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      data-pax={testId}
      className="min-h-10 rounded-sm border border-line-strong bg-mount px-3 py-2 text-left text-[14.5px] font-medium leading-snug text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
    >
      {title}
      {sub ? <span className="mt-0.5 block text-[12.5px] font-normal leading-snug opacity-80">{sub}</span> : null}
    </button>
  );
}

export function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-5 first:border-t-0 first:pt-0" aria-label={title}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-mono text-[13px] text-accent">{n}</span>
        <span className="text-[16.5px] font-[620] text-ink">{title}</span>
        {hint ? <span className="font-mono text-[12px] text-faint">{hint}</span> : null}
      </p>
      {children}
    </section>
  );
}

export const numBox =
  'h-12 w-full rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

export function SizeCards({ cards }: { cards: [string, string][] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-pax="sizes">
      {cards.map(([k, v]) => (
        <div key={k} className="rounded-sm border border-line bg-mount px-3 py-2">
          <dt className="font-mono text-[11.5px] text-faint">{k}</dt>
          <dd className="mt-0.5 text-[14.5px] font-medium leading-snug text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Legend({ ikea }: { ikea: boolean }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] leading-snug text-muted">
      {ikea ? <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 border border-ink/60 bg-mount" aria-hidden="true" />IKEA, you buy</span> : null}
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 border border-accent/70 bg-accent/10" aria-hidden="true" />{ikea ? 'MDF made to measure, ready for your decorator' : 'Made to measure in MDF, ready for your decorator'}</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 border border-line-strong bg-raised" aria-hidden="true" />Filler, scribed to the wall</span>
    </p>
  );
}

/* "Suggested from what it's for" under the insides, while they follow 03. */
export function SuggestNote({ uses, picked }: { uses: string[]; picked: boolean }) {
  const shown = uses.filter((u) => /hang|fold|shoe/i.test(u));
  if (picked || !shown.length) return null;
  return (
    <p className="mt-2 rounded-sm border border-accent/30 bg-accent/5 px-3 py-2 text-[13px] leading-snug text-muted" data-pax="suggested">
      Suggested from what it’s for: <span className="font-medium text-ink">{shown.join(', ')}</span>. Pick any unit to change it.
    </p>
  );
}
