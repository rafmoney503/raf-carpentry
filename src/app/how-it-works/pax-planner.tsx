'use client';
/* "Plan your PAX" in the brief (Raf, 22 Oct 2026: people choosing IKEA PAX don't know what they want, so a
   window pops up from Material with the units drawn in their space, every size marked, which doors go below and
   on the top boxes, and what goes inside). Sums in src/lib/pax-brief.ts; the brief keeps the plan and writes it
   into the message. Nothing here is saved anywhere. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  INSIDES,
  PAX,
  doorsOf,
  frameName,
  layout,
  mdfDoors,
  newPlan,
  paxSummary,
  resolved,
  spaceProblem,
  startInside,
  startsOf,
  type Frame,
  type Inside,
  type PaxPlan,
} from '@/lib/pax-brief';

type Size = { w: string; h: string; d: string };

/* ---------- the drawing ---------- */

const ML = 46; // room for the ceiling dimension on the left
const MR = 82; // and the frame / top box ones on the right
const MT = 50; // two rows of widths over the top
const MB = 26; // PAX names under the floor

function slash(x: number, y: number) {
  return <line x1={x - 3.5} y1={y + 3.5} x2={x + 3.5} y2={y - 3.5} className="stroke-accent" strokeWidth={1.2} />;
}

function HDim({ x1, x2, y, label, side }: { x1: number; x2: number; y: number; label: string; side?: 'l' | 'r' }) {
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

function VDim({ x, y1, y2, label, flip }: { x: number; y1: number; y2: number; label: string; flip?: boolean }) {
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

function insideLines(k: Inside, x1: number, x2: number, Y: (mm: number) => number, f: number) {
  const out: React.ReactNode[] = [];
  const shelf = (mm: number, key: string) => out.push(<line key={key} x1={x1} y1={Y(mm)} x2={x2} y2={Y(mm)} className="stroke-ink/55" strokeWidth={1} />);
  const rail = (mm: number, key: string) => out.push(<line key={key} x1={x1 + 3} y1={Y(mm)} x2={x2 - 3} y2={Y(mm)} className="stroke-ink" strokeWidth={2} strokeLinecap="round" />);
  const box = (a: number, b: number, key: string, dash?: boolean) =>
    out.push(<rect key={key} x={x1 + 1} y={Y(b) + 1.5} width={Math.max(0, x2 - x1 - 2)} height={Math.max(0, Y(a) - Y(b) - 3)} className="fill-none stroke-ink/60" strokeWidth={0.9} strokeDasharray={dash ? '3 2' : undefined} />);
  const top = f - 260;
  if (k === 'long') { shelf(top, 's'); rail(top - 60, 'r'); }
  else if (k === 'double') { shelf(top, 's'); rail(top - 60, 'r1'); rail(Math.round(f / 2) - 60, 'r2'); }
  else if (k === 'short') { shelf(top, 's'); rail(top - 60, 'r'); [300, 600, 900].forEach((m) => shelf(m, `s${m}`)); }
  else if (k === 'drawers') { shelf(top, 's'); rail(top - 60, 'r'); [0, 1, 2].forEach((j) => box(60 + j * 190, 60 + (j + 1) * 190, `d${j}`)); shelf(650, 'dust'); }
  else if (k === 'baskets') { shelf(top, 's'); rail(top - 60, 'r'); box(60, 220, 'b1', true); box(220, 380, 'b2', true); box(380, 560, 'd'); shelf(580, 'dust'); }
  else if (k === 'shelves') { const n = 6; for (let i = 1; i <= n; i++) shelf(Math.round((f * i) / (n + 1)), `s${i}`); }
  else out.push(<text key="q" x={(x1 + x2) / 2} y={Y(f / 2)} textAnchor="middle" className="fill-faint font-mono" fontSize={13}>?</text>);
  return out;
}

export function PaxDrawing({
  plan,
  wall,
  ceiling,
  sel,
  onPick,
  showInside,
  maxH,
}: {
  plan: PaxPlan;
  wall: number;
  ceiling: number;
  sel: number;
  onPick?: (i: number) => void;
  showInside: boolean;
  maxH: number;
}) {
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

  const g = layout(plan, wall, ceiling);
  const aw = w - ML - MR;
  const sc = Math.min(aw / wall, maxH / ceiling);
  const dw = wall * sc;
  const dh = ceiling * sc;
  const ox = ML + (aw - dw) / 2;
  const fy = MT + dh;
  const X = (mm: number) => ox + mm * sc;
  const Y = (mm: number) => fy - mm * sc;
  const H = Math.ceil(MT + dh + MB);
  const fits = !g.problem;
  const startX = fits ? g.fillerL : Math.max(0, (wall - g.across) / 2);

  const starts = startsOf(plan.units, startX);
  // Under narrow units 'PAX 75' won't fit: then they all read 100 / 75 / 50.
  const shortNames = plan.units.some((f) => PAX.real[f] * sc < frameName(f).length * 6.8 + 6);
  const units = plan.units.map((f, i) => {
    const uw = PAX.real[f];
    const n = doorsOf(f);
    const dwm = uw / n;
    const mdf = mdfDoors(plan, f);
    const x0 = starts[i];
    const tall = g.top === 'box' ? ceiling : g.frameH;
    return (
      <g key={i} data-unit={i}>
        {showInside ? (
          <>
            <rect x={X(x0) + 0.5} y={Y(g.frameH) + 0.5} width={uw * sc - 1} height={g.frameH * sc - 1} className="fill-mount stroke-ink/70" strokeWidth={0.9} />
            {insideLines(plan.inside[i], X(x0) + 3, X(x0 + uw) - 3, Y, g.frameH)}
          </>
        ) : (
          Array.from({ length: n }).map((_, d) => {
            const dx = x0 + d * dwm;
            const hx = n === 2 ? (d === 0 ? X(dx + dwm) - 5 : X(dx) + 5) : f === 500 && i % 2 ? X(dx) + 5 : X(dx + dwm) - 5;
            return (
              <g key={d}>
                <rect x={X(dx) + 0.8} y={Y(g.frameH) + 0.8} width={Math.max(0, dwm * sc - 1.6)} height={g.frameH * sc - 1.6} className={mdf ? 'fill-accent/10 stroke-accent/70' : 'fill-mount stroke-ink/70'} strokeWidth={0.9} />
                <line x1={hx} y1={Y(1100)} x2={hx} y2={Y(920)} className="stroke-ink/70" strokeWidth={1.6} strokeLinecap="round" />
              </g>
            );
          })
        )}
        {g.top === 'box'
          ? Array.from({ length: n }).map((_, d) => (
              <rect key={`t${d}`} x={X(x0 + d * dwm) + 0.8} y={Y(ceiling) + 0.8} width={Math.max(0, dwm * sc - 1.6)} height={Math.max(0, g.above * sc - 1.6)} className="fill-accent/10 stroke-accent/70" strokeWidth={0.9} />
            ))
          : null}
        {i === sel && onPick ? <rect x={X(x0)} y={Y(tall)} width={uw * sc} height={tall * sc} className="fill-none stroke-accent" strokeWidth={2} /> : null}
        {onPick ? <rect x={X(x0)} y={Y(ceiling)} width={uw * sc} height={dh} fill="transparent" className="cursor-pointer" onClick={() => onPick(i)} /> : null}
        <text x={X(x0 + uw / 2)} y={fy + 17} textAnchor="middle" className="fill-faint font-mono" fontSize={11}>
          {shortNames ? String(f / 10) : frameName(f)}
        </text>
      </g>
    );
  });

  const chain: React.ReactNode[] = [];
  const cy = MT - 12;
  if (fits && g.fillerL > 0) chain.push(<HDim key="fl" x1={X(0)} x2={X(g.fillerL)} y={cy} label={String(g.fillerL)} side={g.fillerL * sc < 30 ? 'l' : undefined} />);
  plan.units.forEach((f, i) => {
    chain.push(<HDim key={`u${i}`} x1={X(starts[i])} x2={X(starts[i] + PAX.real[f])} y={cy} label={String(PAX.real[f])} />);
  });
  if (fits && g.fillerR > 0) chain.push(<HDim key="fr" x1={X(wall - g.fillerR)} x2={X(wall)} y={cy} label={String(g.fillerR)} side={g.fillerR * sc < 30 ? 'r' : undefined} />);

  const label = `Front of a ${wall} wide wall, ${ceiling} to the ceiling: ${plan.units.map(frameName).join(', ')}, frames ${g.frameH} high${g.top === 'box' ? `, MDF top boxes ${g.above} high` : g.top === 'infill' ? `, infill strip ${g.above}` : ''}.`;

  return (
    <div ref={box} className="w-full">
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={label} className="block max-w-full" data-pax-drawing>
        <defs>
          <pattern id="pax-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" className="stroke-ink/25" strokeWidth={1} />
          </pattern>
        </defs>
        <rect x={X(0)} y={MT} width={dw} height={dh} className="fill-none stroke-line-strong" strokeDasharray="3 3" />
        {fits && g.fillerL > 0 ? <rect x={X(0)} y={MT} width={g.fillerL * sc} height={dh} className="fill-raised" /> : null}
        {fits && g.fillerR > 0 ? <rect x={X(wall - g.fillerR)} y={MT} width={g.fillerR * sc} height={dh} className="fill-raised" /> : null}
        {fits && g.fillerL > 0 ? <rect x={X(0)} y={MT} width={g.fillerL * sc} height={dh} fill="url(#pax-hatch)" /> : null}
        {fits && g.fillerR > 0 ? <rect x={X(wall - g.fillerR)} y={MT} width={g.fillerR * sc} height={dh} fill="url(#pax-hatch)" /> : null}
        {g.top === 'infill' ? (
          <>
            <rect x={X(startX)} y={MT} width={g.across * sc} height={g.above * sc} className="fill-raised" />
            <rect x={X(startX)} y={MT} width={g.across * sc} height={g.above * sc} fill="url(#pax-hatch)" />
          </>
        ) : null}
        {units}
        <line x1={X(0) - 14} y1={fy} x2={X(wall) + 14} y2={fy} className="stroke-ink" strokeWidth={1.2} />
        <HDim x1={X(0)} x2={X(wall)} y={MT - 34} label={`Wall ${wall}`} />
        {chain}
        <VDim x={X(0) - 18} y1={fy} y2={MT} label={`Ceiling ${ceiling}`} flip />
        <VDim x={X(wall) + 16} y1={fy} y2={Y(g.frameH)} label={`Frames ${g.frameH}`} />
        {g.above > 0 ? <VDim x={X(wall) + 16} y1={Y(g.frameH)} y2={MT} label={`${g.top === 'box' ? 'Top' : 'Infill'} ${g.above}`} /> : null}
      </svg>
    </div>
  );
}

/* A small front view for the card under Material. */
export function PaxMini({ plan, wall, ceiling }: { plan: PaxPlan; wall: number; ceiling: number }) {
  const g = layout(plan, wall, ceiling);
  const W = 84;
  const Hh = 56;
  const sc = Math.min((W - 4) / wall, (Hh - 4) / ceiling);
  const ox = (W - wall * sc) / 2;
  const fy = Hh - 2;
  const starts = startsOf(plan.units, g.problem ? Math.max(0, (wall - g.across) / 2) : g.fillerL);
  return (
    <svg width={W} height={Hh} viewBox={`0 0 ${W} ${Hh}`} aria-hidden="true" className="flex-none">
      <rect x={ox} y={fy - ceiling * sc} width={wall * sc} height={ceiling * sc} className="fill-raised stroke-line-strong" strokeWidth={0.6} />
      {plan.units.map((f, i) => {
        const uw = PAX.real[f];
        const n = doorsOf(f);
        const x0 = starts[i];
        return (
          <g key={i}>
            {Array.from({ length: n }).map((_, d) => (
              <rect key={d} x={ox + (x0 + (d * uw) / n) * sc + 0.4} y={fy - g.frameH * sc + 0.4} width={(uw / n) * sc - 0.8} height={g.frameH * sc - 0.8} className={mdfDoors(plan, f) ? 'fill-accent/15 stroke-accent' : 'fill-mount stroke-ink/70'} strokeWidth={0.6} />
            ))}
            {g.top === 'box'
              ? Array.from({ length: n }).map((_, d) => (
                  <rect key={`t${d}`} x={ox + (x0 + (d * uw) / n) * sc + 0.4} y={fy - ceiling * sc + 0.4} width={(uw / n) * sc - 0.8} height={g.above * sc - 0.8} className="fill-accent/15 stroke-accent" strokeWidth={0.6} />
                ))
              : null}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- the window ---------- */

function Pick({ on, onClick, title, sub, testId }: { on: boolean; onClick: () => void; title: string; sub?: string; testId?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      data-pax={testId}
      className="min-h-10 rounded-sm border border-line-strong bg-mount px-3 py-2 text-left text-[14.5px] font-medium leading-snug text-ink transition-colors hover:border-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
    >
      {title}
      {sub ? <span className="mt-0.5 block text-[12.5px] font-normal leading-snug opacity-80">{sub}</span> : null}
    </button>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
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

const numBox =
  'h-12 w-full rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

export function PaxWindow({
  open,
  onClose,
  plan,
  setPlan,
  size,
  setSize,
}: {
  open: boolean;
  onClose: () => void;
  plan: PaxPlan | null;
  setPlan: (p: PaxPlan | null) => void;
  size: Size;
  setSize: (fn: (s: Size) => Size) => void;
}) {
  const [sel, setSel] = useState(0);
  const [showInside, setShowInside] = useState(false);
  const [phone, setPhone] = useState(0); // the screen's height on a phone, 0 on bigger screens
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const wall = parseInt(size.w || '0', 10) || 0;
  const ceiling = parseInt(size.h || '0', 10) || 0;
  const bad = spaceProblem(wall, ceiling);
  const now = plan && !bad ? resolved(plan, wall) : null;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const read = () => setPhone(mq.matches ? window.innerHeight : 0);
    read();
    mq.addEventListener('change', read);
    window.addEventListener('resize', read);
    return () => {
      mq.removeEventListener('change', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  // Open: keep the page still behind it, focus the first empty size, Escape closes, Tab stays inside.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const empty = panel.current?.querySelector<HTMLInputElement>('input[data-pax-size]:placeholder-shown');
      (empty ?? panel.current?.querySelector<HTMLElement>('[data-pax-close]'))?.focus({ preventScroll: true });
    }, 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === 'Tab' && panel.current) {
        const f = Array.from(panel.current.querySelectorAll<HTMLElement>('button, input, [href]')).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (!f.length) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', key);
      html.style.overflow = before;
      (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  // A plan starts the first time the sizes make sense.
  const setSpace = (k: 'w' | 'h', v: string) => {
    const clean = v.replace(/[^0-9]/g, '').slice(0, 5);
    setSize((s) => ({ ...s, [k]: clean }));
    const nw = k === 'w' ? parseInt(clean || '0', 10) : wall;
    const nc = k === 'h' ? parseInt(clean || '0', 10) : ceiling;
    if (!plan && !spaceProblem(nw, nc)) setPlan(newPlan(nw));
  };
  const change = (fn: (p: PaxPlan) => PaxPlan) => {
    if (now) setPlan(fn(now));
  };
  const g = now ? layout(now, wall, ceiling) : null;
  const pick = Math.min(sel, Math.max(0, (now?.units.length ?? 1) - 1));
  const roomFor = (f: Frame) => (now ? now.units.length < PAX.maxUnits && g!.across + PAX.real[f] + 2 * PAX.minFiller <= wall : false);
  const unitW = now ? PAX.real[now.units[pick]] : 0;

  const cards: [string, string][] = now && g
    ? [
        ['Your wall', `${wall} × ${ceiling}`],
        ['Units across', `${now.units.map((f) => PAX.real[f]).join(' + ')} = ${g.across}`],
        ['Fillers', g.problem ? 'Doesn’t fit yet' : g.fillerL === g.fillerR ? `${g.fillerL} each end` : `${g.fillerL} and ${g.fillerR}`],
        ['PAX frames', `${g.frameH} high · ${PAX.depth} deep`],
        g.top === 'box' ? ['Top boxes', `${g.above} high, MDF`] : g.top === 'infill' ? ['Infill strip', `${g.above} to the ceiling`] : ['Above', 'Nothing'],
        [`Unit ${pick + 1}`, `${unitW} wide · ${g.top === 'box' ? `${g.frameH} + ${g.above}` : g.frameH} high`],
      ]
    : [];

  const a1 = ceiling - PAX.short;
  const a2 = ceiling - PAX.tall;
  const topWords = (a: number) => (a >= PAX.topBoxFrom ? `+ MDF top boxes ${a} high, made to measure` : a > 0 ? `+ an infill strip ${a} to the ceiling` : 'right up to the ceiling');
  const has75 = now?.units.includes(750);
  const status = g ? (g.problem ? g.problem : g.warn ? g.warn : 'It all fits. Rough sizes are fine: I measure properly on the free visit.') : bad;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-ink/45 md:items-center md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pax-title"
        data-pax-window
        className="flex h-[100dvh] w-full flex-col bg-paper md:h-auto md:max-h-[min(94dvh,960px)] md:max-w-[1080px] md:rounded-sm md:border md:border-line-strong md:shadow-xl"
      >
        <header className="flex flex-none items-center gap-3 border-b border-line px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[12px] text-accent">IKEA PAX built in</p>
            <h2 id="pax-title" className="font-display text-[21px] font-[650] leading-tight text-ink">Plan your PAX</h2>
          </div>
          <button type="button" onClick={onClose} data-pax-close aria-label="Close and go back to the brief" className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" /></svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-pax-scroll>
          <div className="flex flex-col gap-5 px-4 pb-6 pt-4 md:grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] md:items-start md:gap-8 md:px-6 md:pt-5">
            {/* On a phone these become part of one column, so the drawing can stay at the top while the steps scroll under it. */}
            <div className="max-md:contents md:sticky md:top-0 md:self-start md:pt-0">
              <div>
                <p className="text-[14.5px] leading-snug text-muted">Your wall and ceiling first. It’s drawn to scale with every size as you pick.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="font-mono text-[12px] text-faint">Wall width, mm</span>
                    <input data-pax-size="w" className={`${numBox} mt-1`} inputMode="numeric" placeholder="2400" value={size.w} onChange={(e) => setSpace('w', e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[12px] text-faint">Ceiling height, mm</span>
                    <input data-pax-size="h" className={`${numBox} mt-1`} inputMode="numeric" placeholder="2400" value={size.h} onChange={(e) => setSpace('h', e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="z-10 -mx-4 border-b border-line bg-paper px-4 pb-2 pt-1 max-md:sticky max-md:top-0 md:mx-0 md:border-b-0 md:px-0">
                {now ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[12px] text-faint">Your space, to scale<span className="max-sm:hidden">, in mm</span></p>
                      <button type="button" onClick={() => setShowInside((v) => !v)} aria-pressed={showInside} data-pax="inside-toggle" className="flex-none rounded-sm border border-line-strong bg-mount px-2.5 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-ink">
                        {showInside ? 'Show the doors' : 'Show the inside'}
                      </button>
                    </div>
                    <div className="mt-1">
                      <PaxDrawing plan={now} wall={wall} ceiling={ceiling} sel={pick} onPick={setSel} showInside={showInside} maxH={phone ? Math.round(Math.max(104, Math.min(172, phone * 0.22))) : 400} />
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[140px] items-center justify-center rounded-sm border border-dashed border-line-strong bg-mount px-4 text-center text-[14.5px] leading-snug text-muted" role="status">
                    {bad}
                  </div>
                )}
              </div>

              {now ? (
                <div>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] leading-snug text-muted">
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 border border-ink/60 bg-mount" aria-hidden="true" />IKEA, you buy</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 border border-accent/70 bg-accent/10" aria-hidden="true" />MDF made to measure, ready for your decorator</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 border border-line-strong bg-raised" aria-hidden="true" />Filler, scribed to the wall</span>
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-pax="sizes">
                    {cards.map(([k, v]) => (
                      <div key={k} className="rounded-sm border border-line bg-mount px-3 py-2">
                        <dt className="font-mono text-[11.5px] text-faint">{k}</dt>
                        <dd className="mt-0.5 text-[14.5px] font-medium leading-snug text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>

            {now && g ? (
              <div>
                <Step n={1} title="Height" hint={`ceiling ${ceiling}`}>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Pick on={g.frameH === PAX.short} onClick={() => change((p) => ({ ...p, height: 'short' }))} title="PAX 2010, standard" sub={topWords(a1)} testId="h-short" />
                    {g.tallOk ? <Pick on={g.frameH === PAX.tall} onClick={() => change((p) => ({ ...p, height: 'tall' }))} title="PAX 2364, tall" sub={topWords(a2)} testId="h-tall" /> : null}
                  </div>
                  {!g.tallOk ? <p className="mt-2 text-[13px] leading-snug text-faint">The taller 2364 frames need a ceiling of about {PAX.tallNeeds} or more.</p> : null}
                </Step>

                <Step n={2} title="Units, left to right" hint="tap one to change it">
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Your units">
                    {now.units.map((f, i) => (
                      <Pick key={i} on={i === pick} onClick={() => setSel(i)} title={`${i + 1} · ${frameName(f)}`} testId={`unit-${i}`} />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {([1000, 750, 500] as Frame[]).map((f) =>
                      roomFor(f) ? (
                        <button key={f} type="button" data-pax={`add-${f}`} onClick={() => { change((p) => ({ ...p, auto: false, units: [...p.units, f], inside: [...p.inside, startInside(p.units.length)] })); setSel(now.units.length); }} className="btn btn-ghost btn-sm">
                          + {frameName(f)}
                        </button>
                      ) : null,
                    )}
                    {now.units.length > 1 ? (
                      <button type="button" data-pax="remove" onClick={() => { change((p) => ({ ...p, auto: false, units: p.units.filter((_, j) => j !== pick), inside: p.inside.filter((_, j) => j !== pick) })); setSel(Math.max(0, pick - 1)); }} className="btn btn-ghost btn-sm">
                        Remove unit {pick + 1}
                      </button>
                    ) : null}
                    {!now.auto ? (
                      <button type="button" data-pax="fill" onClick={() => { change((p) => ({ ...p, auto: true })); setSel(0); }} className="btn btn-ghost btn-sm">
                        Fill my wall
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[13px] leading-snug text-faint">
                    PAX frames are 998, 748 and 498 wide. Unit {pick + 1} is a {frameName(now.units[pick])}: swap it for
                    {(([1000, 750, 500] as Frame[]).filter((f) => f !== now.units[pick])).map((f, j) => (
                      <button
                        key={f}
                        type="button"
                        data-pax={`swap-${f}`}
                        disabled={g.across - PAX.real[now.units[pick]] + PAX.real[f] + 2 * PAX.minFiller > wall}
                        onClick={() => change((p) => ({ ...p, auto: false, units: p.units.map((u, k) => (k === pick ? f : u)) }))}
                        className="ml-1 font-medium text-accent underline-offset-2 hover:underline disabled:text-faint disabled:no-underline"
                      >
                        {j ? `or ${f / 10}` : f / 10}
                      </button>
                    ))}
                    .
                  </p>
                </Step>

                <Step n={3} title="Doors">
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Pick on={now.doors === 'ikea'} onClick={() => change((p) => ({ ...p, doors: 'ikea' }))} title="IKEA doors below" sub="You choose them and buy them" testId="d-ikea" />
                    <Pick on={now.doors === 'mdf'} onClick={() => change((p) => ({ ...p, doors: 'mdf' }))} title="Made-to-measure doors below" sub="MDF, ready for your decorator" testId="d-mdf" />
                  </div>
                  <p className="mt-2 text-[13px] leading-snug text-faint" data-pax="door-note">
                    {g.top === 'box' ? 'The top boxes always get made-to-measure MDF doors. ' : ''}
                    {now.doors === 'ikea' && has75 ? 'IKEA makes no hinged doors for the 75 frame, so that one gets MDF doors too.' : ''}
                  </p>
                </Step>

                <Step n={4} title={`Inside unit ${pick + 1}`} hint="you buy these from IKEA">
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Inside unit ${pick + 1}`}>
                    {INSIDES.map((o) => (
                      <Pick key={o.key} on={now.inside[pick] === o.key} onClick={() => { change((p) => ({ ...p, inside: p.inside.map((v, j) => (j === pick ? o.key : v)) })); setShowInside(true); }} title={o.label} testId={`in-${o.key}`} />
                    ))}
                  </div>
                  <p className="mt-2 text-[13px] leading-snug text-faint">
                    Tap a unit in the drawing to pick its inside.{' '}
                    {now.units.length > 1 ? (
                      <button type="button" data-pax="same-inside" onClick={() => change((p) => ({ ...p, inside: p.units.map(() => p.inside[pick]) }))} className="font-medium text-accent underline-offset-2 hover:underline">
                        Same in every unit
                      </button>
                    ) : null}
                  </p>
                </Step>
                <p className="border-t border-line pt-4 text-[13.5px] leading-snug text-muted">
                  Rather leave it to the visit?{' '}
                  <button type="button" data-pax="remove-plan" onClick={() => { setPlan(null); onClose(); }} className="font-medium text-accent underline-offset-2 hover:underline">
                    Remove my plan
                  </button>{' '}
                  and it stays out of your message.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-none flex-col gap-2 border-t border-line bg-paper px-4 py-3 sm:flex-row sm:items-center md:px-6">
          <p className={`min-w-0 flex-1 text-[13.5px] leading-snug ${g?.problem ? 'font-medium text-accent' : 'text-muted'}`} role="status" data-pax="status">
            {status}
          </p>
          <button type="button" data-pax="done" onClick={onClose} className="btn btn-primary w-full flex-none sm:w-auto">
            {now ? 'Done, back to my brief' : 'Back to my brief'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/* Under Material once IKEA PAX is ticked: start the plan, or what it says and Change it. */
export function PaxCard({ plan, size, onOpen }: { plan: PaxPlan | null; size: Size; onOpen: () => void }) {
  const wall = parseInt(size.w || '0', 10) || 0;
  const ceiling = parseInt(size.h || '0', 10) || 0;
  const ok = plan && !spaceProblem(wall, ceiling);
  const now = ok ? resolved(plan, wall) : null;
  return (
    <div className="mt-4 flex items-center gap-3 rounded-sm border border-accent/40 bg-mount p-3" data-pax-card>
      {now ? (
        <PaxMini plan={now} wall={wall} ceiling={ceiling} />
      ) : (
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[2px] bg-raised text-accent" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="9" width="11" height="18" /><rect x="16" y="9" width="11" height="18" /><path d="M3 3h24v6H3z" strokeDasharray="2 1.5" /><path d="M12 17v3M18 17v3" /></svg>
        </span>
      )}
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block font-mono text-[12px] text-accent">{now ? 'Your PAX plan' : 'Plan your PAX'}</span>
        <span className="block text-[14.5px] font-medium text-ink">
          {now ? paxSummary(now, wall, ceiling) : 'Units drawn in your space with every size, the doors and what goes inside. Optional.'}
        </span>
      </span>
      <button type="button" onClick={onOpen} data-pax="open" className="btn btn-ghost btn-sm flex-none">
        {now ? 'Change it' : 'Plan it'}
      </button>
    </div>
  );
}
