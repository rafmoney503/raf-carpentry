'use client';
import Mark from './mark';
import { field, label } from './parts';
import type { Size } from './store';
import { LAYOUTS, RULES, layoutLabel, newSpec, plan, withLayout, type Above, type Bottom, type End, type Plan, type Unit, type WardrobeSpec } from '@/lib/wardrobe';

/* The wardrobe planner in a design request: Raf taps the build, the layout (double = 1, single = 0.5), the ends
   and what goes inside each unit; the sums show as he types (src/lib/wardrobe.ts). It goes with the request as
   design.wardrobe, and the 3D model is built from it by scripts/wardrobe-model.py. */

function Pick<T extends string | number>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
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

function Stepper({ value, min, max, onChange, word, words }: { value: number; min: number; max: number; onChange: (n: number) => void; word: string; words?: string }) {
  const btn = 'flex h-10 w-10 items-center justify-center rounded-sm border border-line-strong bg-mount text-[20px] leading-none disabled:opacity-35';
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`One ${word} fewer`}>
        −
      </button>
      <span className="min-w-[88px] text-center font-mono text-[15px]">
        {value} {value === 1 ? word : (words ?? `${word}s`)}
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`One more ${word}`}>
        +
      </button>
    </div>
  );
}

function Num({ text, value, onChange }: { text: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[11.5px] text-faint">{text}</span>
      <input className={`${field} h-11 font-mono`} inputMode="numeric" value={value ? String(value) : ''} placeholder="mm" onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 5)) || 0)} />
    </label>
  );
}

/* A front view drawn to scale: end panels, fillers, each unit's doors, the top box. */
function Front({ s, p }: { s: WardrobeSpec; p: Plan }) {
  if (!s.width || !s.ceiling || !s.units.length) return null;
  const W = s.width;
  const H = s.ceiling;
  const k = 300 / Math.max(W, H * 0.9);
  const sw = W * k;
  const sh = H * k;
  const ikea = s.build === 'ikea';
  const y = (z: number) => sh - z * k; // mm from the floor to svg y
  const doorTop = ikea ? s.pax : H;
  const doorBottom = ikea ? 0 : RULES.plinth;
  const stroke = 'currentColor';
  return (
    <svg viewBox={`-6 -6 ${sw + 12} ${sh + 12}`} className="mx-auto mt-3 block w-full max-w-[340px] text-ink" role="img" aria-label={`Front view: ${layoutLabel(s.units)}`}>
      <rect x={0} y={0} width={sw} height={sh} fill="none" stroke={stroke} strokeOpacity={0.25} strokeDasharray="3 3" />
      {s.left === 'panel' ? <rect x={0} y={0} width={RULES.panel * k} height={sh} className="fill-raised" stroke={stroke} strokeWidth={0.8} /> : null}
      {s.right === 'panel' ? <rect x={sw - RULES.panel * k} y={0} width={RULES.panel * k} height={sh} className="fill-raised" stroke={stroke} strokeWidth={0.8} /> : null}
      {p.units.map((u, i) => {
        const x0 = u.x * k;
        const dw = u.w / u.doors;
        return (
          <g key={i}>
            {Array.from({ length: u.doors }, (_, d) => (
              <rect key={d} x={x0 + d * dw * k + 0.8} y={y(doorTop) + 0.8} width={dw * k - 1.6} height={(doorTop - doorBottom) * k - 1.6} className="fill-mount" stroke={stroke} strokeWidth={0.9} />
            ))}
            {ikea && p.top === 'box'
              ? Array.from({ length: u.doors }, (_, d) => <rect key={`t${d}`} x={x0 + d * dw * k + 0.8} y={0.8} width={dw * k - 1.6} height={(H - s.pax) * k - 1.6} className="fill-mount" stroke={stroke} strokeWidth={0.9} />)
              : null}
            <text x={x0 + (u.w * k) / 2} y={y((doorTop + doorBottom) / 2)} textAnchor="middle" dominantBaseline="middle" className="fill-faint font-mono" fontSize={11}>
              {s.units[i].type === 'double' ? '1' : '0.5'}
            </text>
          </g>
        );
      })}
      {ikea && p.top === 'infill' ? <rect x={0} y={0} width={sw} height={(H - s.pax) * k} className="fill-raised" stroke={stroke} strokeWidth={0.6} /> : null}
      {!ikea ? <rect x={RULES.panel * k} y={y(RULES.plinth)} width={sw - 2 * RULES.panel * k} height={RULES.plinth * k} className="fill-raised" stroke={stroke} strokeWidth={0.6} /> : null}
    </svg>
  );
}

const BOTTOMS: [Bottom, string][] = [
  ['none', 'Nothing'],
  ['baskets', 'IKEA baskets'],
  ['drawers', 'Drawers'],
  ['shoes', 'Shoe shelf'],
];
const ABOVES: [Above, string][] = [
  ['long', 'Long hanging'],
  ['short', 'Short hanging'],
  ['two', 'Two short rails'],
  ['shelves', 'Shelves'],
];
const ENDS: [End, string][] = [
  ['panel', 'End panel'],
  ['wall', 'Wall'],
  ['none', 'Nothing'],
];

export function WardrobePlanner({ spec, sizes, onChange }: { spec?: WardrobeSpec; sizes: Size[]; onChange: (s: WardrobeSpec | undefined) => void }) {
  if (!spec) {
    const space = sizes[0];
    return (
      <section className="rounded-sm border border-line-strong bg-mount p-4">
        <h2 className="text-[19px] font-[650]">Wardrobe planner</h2>
        <p className="mt-1 text-[14.5px] leading-relaxed text-muted">For a fitted wardrobe: tap the layout and what goes inside, and the 3D design is built straight from it.</p>
        <button type="button" className="btn btn-primary btn-sm mt-3 w-full" onClick={() => onChange(newSpec(Number(space?.w) || 0, Number(space?.h) || 0, Number(space?.d) || 0))}>
          Plan a wardrobe
        </button>
      </section>
    );
  }
  const s = spec;
  const p = plan(s);
  const set = (patch: Partial<WardrobeSpec>) => onChange({ ...s, ...patch });
  const setUnit = (i: number, patch: Partial<Unit>) => set({ units: s.units.map((u, j) => (j === i ? { ...u, ...patch } : u)) });
  const current = layoutLabel(s.units);
  const ikea = s.build === 'ikea';

  return (
    <section className="rounded-sm border border-line-strong bg-mount p-4">
      <h2 className="text-[19px] font-[650]">Wardrobe planner</h2>

      <div className="mt-4 grid gap-5">
        <div className="grid gap-2">
          <span className={label}>Build</span>
          <Pick<'mdf' | 'ikea'> options={[['mdf', 'MDF, floor to ceiling'], ['ikea', 'IKEA PAX']]} value={s.build} onChange={(build) => set({ build })} />
          {ikea ? (
            <Pick<2010 | 2364>
              options={[
                [2010, '2010 frame, small top box'],
                [2364, '2364 frame, taller ceilings'],
              ]}
              value={s.pax}
              onChange={(pax) => set({ pax })}
            />
          ) : null}
        </div>

        <div className="grid gap-2">
          <span className={label}>The space</span>
          <div className="grid grid-cols-3 gap-2">
            <Num text="Wall to wall" value={s.width} onChange={(width) => set({ width })} />
            <Num text="Ceiling" value={s.ceiling} onChange={(ceiling) => set({ ceiling })} />
            <Num text="Depth" value={s.depth} onChange={(depth) => set({ depth })} />
          </div>
        </div>

        <div className="grid gap-2">
          <span className={label}>Layout (double = 1, single = 0.5)</span>
          <Pick options={[...LAYOUTS.map((l) => [l.label, l.label] as [string, string]), ...(LAYOUTS.some((l) => l.label === current) ? [] : [[current, current] as [string, string]])]} value={current} onChange={(v) => {
            const l = LAYOUTS.find((x) => x.label === v);
            if (l) set({ units: withLayout(s.units, l.units) });
          }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ units: withLayout(s.units, [...s.units.map((u) => u.type), 'double']) })} disabled={s.units.length >= 6}>
              + Double
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ units: withLayout(s.units, [...s.units.map((u) => u.type), 'single']) })} disabled={s.units.length >= 6}>
              + Single
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ units: s.units.slice(0, -1) })} disabled={s.units.length <= 1}>
              Remove last
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <span className={label}>Left end</span>
            <Pick options={ENDS} value={s.left} onChange={(left) => set({ left })} />
          </div>
          <div className="grid gap-2">
            <span className={label}>Right end</span>
            <Pick options={ENDS} value={s.right} onChange={(right) => set({ right })} />
          </div>
        </div>

        <div className="rounded-sm border border-line bg-paper p-3">
          <p className="font-mono text-[14px] leading-relaxed">
            {p.doors} door{p.doors === 1 ? '' : 's'}
            {ikea ? ' (PAX)' : p.doorW > 0 ? ` of ${Math.round(p.doorW)} mm` : ''}
            {ikea && s.width ? ` · filler ${Math.round(p.filler)} mm` : ''}
            {ikea ? ` · ${p.top === 'box' ? `top box ${p.above} mm` : p.top === 'infill' ? `infill strip ${p.above} mm` : 'nothing above'}` : ''}
          </p>
          {p.problems.length ? (
            <ul className="mt-2 grid gap-1">
              {p.problems.map((t) => (
                <li key={t} className="flex items-start gap-1.5 text-[14.5px] font-semibold">
                  <Mark state="lost" /> {t}
                </li>
              ))}
            </ul>
          ) : s.width ? (
            <p className="mt-1 flex items-center gap-1.5 text-[14.5px] text-muted">
              <Mark state="sent" /> It all fits.
            </p>
          ) : null}
          <Front s={s} p={p} />
        </div>

        <div className="grid gap-3">
          <span className={label}>Inside, left to right</span>
          {s.units.map((u, i) => (
            <div key={i} className="rounded-sm border border-line bg-paper p-3">
              <p className="font-semibold">
                Unit {i + 1}: {u.type === 'double' ? 'double' : 'single'}
                <span className="font-mono text-[13px] font-normal text-faint"> · {Math.round(p.units[i]?.w ?? 0)} mm</span>
              </p>
              <div className="mt-2.5 grid gap-2.5">
                <div className="grid gap-1.5">
                  <span className="font-mono text-[11.5px] text-faint">At the bottom</span>
                  <Pick options={BOTTOMS} value={u.bottom} onChange={(bottom) => setUnit(i, { bottom, count: bottom === 'baskets' || bottom === 'drawers' ? u.count || 3 : 0 })} />
                  {u.bottom === 'baskets' || u.bottom === 'drawers' ? <Stepper value={u.count} min={1} max={8} onChange={(count) => setUnit(i, { count })} word={u.bottom === 'baskets' ? 'basket' : 'drawer'} /> : null}
                </div>
                <div className="grid gap-1.5">
                  <span className="font-mono text-[11.5px] text-faint">Above it</span>
                  <Pick options={ABOVES} value={u.above} onChange={(above) => setUnit(i, { above, shelves: above === 'shelves' ? u.shelves || 3 : 0 })} />
                  {u.above === 'shelves' ? <Stepper value={u.shelves} min={1} max={10} onChange={(shelves) => setUnit(i, { shelves })} word="shelf" words="shelves" /> : null}
                </div>
                <button
                  type="button"
                  aria-pressed={u.topShelf}
                  onClick={() => setUnit(i, { topShelf: !u.topShelf })}
                  className={`min-h-10 justify-self-start rounded-sm border px-3 py-1.5 text-[15px] ${u.topShelf ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount'}`}
                >
                  {u.topShelf ? 'Top shelf: yes' : 'Top shelf: no'}
                </button>
                <p className={`font-mono text-[12.5px] ${p.units[i]?.ok === false ? 'font-semibold text-ink' : 'text-faint'}`}>{p.units[i]?.note}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          <span className={label}>Doors</span>
          <Pick
            options={[
              ['flat', 'Flat'],
              ['shaker', 'Shaker'],
              ['panelled', 'Panelled'],
            ]}
            value={s.doors}
            onChange={(doors) => set({ doors })}
          />
        </div>
        <div className="grid gap-2">
          <span className={label}>Handles</span>
          <Pick
            options={[
              ['knobs', 'Knobs'],
              ['bars', 'Bar handles'],
              ['push', 'Push to open'],
            ]}
            value={s.handles}
            onChange={(handles) => set({ handles })}
          />
        </div>

        <button type="button" className="h-10 justify-self-start text-[14.5px] text-muted" onClick={() => onChange(undefined)}>
          Not a wardrobe: stop using the planner
        </button>
      </div>
    </section>
  );
}
