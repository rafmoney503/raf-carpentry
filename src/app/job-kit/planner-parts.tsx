'use client';
import Mark from './mark';
import { field } from './parts';

/* Pieces shared by the alcove, bookcase and chest planners (the wardrobe planner has its own copies):
   chips that always keep one choice, number boxes in mm, a counter, and the drawing sheet. */

export function Pick<T extends string | number | boolean>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`min-h-10 rounded-sm border px-3 py-1.5 text-[15px] transition-colors ${v === value ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount text-ink hover:border-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Num({ text, value, onChange }: { text: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[11.5px] text-faint">{text}</span>
      <input className={`${field} h-11 font-mono`} inputMode="numeric" value={value ? String(value) : ''} placeholder="mm" onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 5)) || 0)} />
    </label>
  );
}

export function Counter({ value, min, max, onChange, one, many }: { value: number; min: number; max: number; onChange: (n: number) => void; one: string; many: string }) {
  const btn = 'flex h-10 w-10 items-center justify-center rounded-sm border border-line-strong bg-mount text-[20px] leading-none disabled:opacity-35';
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`One ${one} fewer`}>
        −
      </button>
      <span className="min-w-[96px] text-center font-mono text-[15px]">
        {value} {value === 1 ? one : many}
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`One more ${one}`}>
        +
      </button>
    </div>
  );
}

export const edge = { vectorEffect: 'non-scaling-stroke' as const, stroke: 'currentColor' };
export const line = { ...edge, fill: 'none' };

/* A front view to scale on graph paper: floor line, blue width and height dimensions. Children draw in mm
   with Y(z) turning a height from the floor into the drawing's y. */
export function Sheet({ W, H, label: aria, children }: { W: number; H: number; label: string; children: (Y: (z: number) => number, fs: number) => React.ReactNode }) {
  if (!W || !H) return <p className="py-10 text-center font-mono text-[13px] text-faint">Type the sizes to see the drawing.</p>;
  const pad = Math.max(W, H) * 0.09;
  const fs = Math.max(W, H) / 30;
  const Y = (z: number) => H - z;
  const id = `g${Math.round(W)}x${Math.round(H)}`;
  return (
    <svg viewBox={`${-pad * 0.9} ${-pad} ${W + pad * 2} ${H + pad * 2.1}`} className="block w-full text-ink" role="img" aria-label={aria}>
      <defs>
        <pattern id={`${id}-grid`} width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M100 0H0V100" fill="none" stroke="currentColor" strokeOpacity="0.07" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id="sheet-hatch" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V40" stroke="currentColor" strokeOpacity="0.35" vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>
      <rect x={-pad * 0.9} y={-pad} width={W + pad * 2} height={H + pad * 2.1} fill={`url(#${id}-grid)`} />
      <rect x={0} y={0} width={W} height={H} {...line} strokeOpacity={0.25} strokeDasharray="12 10" />
      {children(Y, fs)}
      <line x1={-pad * 0.6} y1={H} x2={W + pad * 0.6} y2={H} {...line} strokeWidth={1.4} />
      <g className="text-accent">
        <line x1={0} y1={-pad * 0.45} x2={W} y2={-pad * 0.45} {...line} strokeWidth={1.2} />
        <line x1={0} y1={-pad * 0.65} x2={0} y2={-pad * 0.25} {...line} strokeWidth={1.2} />
        <line x1={W} y1={-pad * 0.65} x2={W} y2={-pad * 0.25} {...line} strokeWidth={1.2} />
        <text x={W / 2} y={-pad * 0.6} textAnchor="middle" fontSize={fs} className="fill-accent font-mono">
          {Math.round(W)}
        </text>
        <line x1={W + pad * 0.45} y1={0} x2={W + pad * 0.45} y2={H} {...line} strokeWidth={1.2} />
        <line x1={W + pad * 0.25} y1={0} x2={W + pad * 0.65} y2={0} {...line} strokeWidth={1.2} />
        <line x1={W + pad * 0.25} y1={H} x2={W + pad * 0.65} y2={H} {...line} strokeWidth={1.2} />
        <text x={W + pad * 0.62} y={H / 2} textAnchor="middle" fontSize={fs} className="fill-accent font-mono" transform={`rotate(90 ${W + pad * 0.62} ${H / 2})`}>
          {Math.round(H)}
        </text>
      </g>
    </svg>
  );
}

/* A door on the drawing: panel lines for shaker or panelled, the dashed opening line pointing to the hinge,
   and the handle. */
export function DoorFront({ x0, x1, z0, z1, Y, hingeLeft, style, handles }: { x0: number; x1: number; z0: number; z1: number; Y: (z: number) => number; hingeLeft: boolean; style: 'flat' | 'shaker' | 'panelled'; handles: 'knobs' | 'bars' | 'push' }) {
  const h = z1 - z0;
  const inset = Math.min(70, (x1 - x0) / 5, h / 5);
  const hx = hingeLeft ? x1 - 40 : x0 + 40;
  const hz = h > 1200 ? 1050 : z0 + h * 0.75 > z1 - 60 ? (z0 + z1) / 2 : z1 - Math.min(90, h / 4);
  return (
    <g>
      <rect x={x0} y={Y(z1)} width={x1 - x0} height={h} className="fill-mount" {...edge} strokeWidth={1.1} />
      {style !== 'flat' ? <rect x={x0 + inset} y={Y(z1 - inset)} width={x1 - x0 - 2 * inset} height={h - 2 * inset} {...line} strokeOpacity={0.45} /> : null}
      <path d={`M${hingeLeft ? x1 : x0} ${Y(z1)} L${hingeLeft ? x0 : x1} ${Y((z0 + z1) / 2)} L${hingeLeft ? x1 : x0} ${Y(z0)}`} {...line} strokeOpacity={0.18} strokeDasharray="10 8" />
      {handles === 'knobs' ? <circle cx={hx} cy={Y(hz)} r={16} fill="currentColor" /> : null}
      {handles === 'bars' ? <rect x={hx - 7} y={Y(hz + Math.min(150, h / 4))} width={14} height={Math.min(300, h / 2)} fill="currentColor" /> : null}
    </g>
  );
}

export function Problems({ list, ok }: { list: string[]; ok: boolean }) {
  return list.length ? (
    <ul className="grid gap-1">
      {list.map((t) => (
        <li key={t} className="flex items-start gap-1.5 text-[14px] font-semibold">
          <Mark state="lost" /> {t}
        </li>
      ))}
    </ul>
  ) : ok ? (
    <p className="flex items-center gap-1.5 text-[14px] text-muted">
      <Mark state="sent" /> It all fits.
    </p>
  ) : null;
}

export const DOORS: ['flat' | 'shaker' | 'panelled', string][] = [
  ['flat', 'Flat'],
  ['shaker', 'Shaker'],
  ['panelled', 'Panelled'],
];
export const HANDLES: ['knobs' | 'bars' | 'push', string][] = [
  ['knobs', 'Knobs'],
  ['bars', 'Bar handles'],
  ['push', 'Push to open'],
];
