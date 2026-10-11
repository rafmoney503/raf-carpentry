'use client';
import { useState } from 'react';
import Mark from './mark';
import { field, label } from './parts';
import { PlannerHeader } from './planner-parts';
import type { Size } from './store';
import {
  LAYOUTS,
  PIECES,
  PRESETS,
  RULES,
  addPiece,
  layoutLabel,
  newSpec,
  normalise,
  plan,
  takeOff,
  withLayout,
  type End,
  type Piece,
  type PieceKind,
  type Plan,
  type Unit,
  type UnitType,
  unitName,
  type WardrobeSpec,
} from '@/lib/wardrobe';

/* The wardrobe planner in a design request: Raf taps the build, the layout (double = 1, single = 0.5), the ends
   and what goes inside each unit, bottom to top; the sums and a drawing to scale update as he goes
   (src/lib/wardrobe.ts). It goes with the request as design.wardrobe, and the 3D model is built from it by
   scripts/wardrobe-model.py. */

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

function Num({ text, value, onChange }: { text: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[11.5px] text-faint">{text}</span>
      <input className={`${field} h-11 font-mono`} inputMode="numeric" value={value ? String(value) : ''} placeholder="mm" onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 5)) || 0)} />
    </label>
  );
}

/* ---------- the drawing: a front elevation to scale, on graph paper ---------- */

function Elevation({ s, p, inside }: { s: WardrobeSpec; p: Plan; inside: boolean }) {
  const W = s.width;
  const H = s.ceiling;
  if (!W || !H || !s.units.length) return <p className="py-10 text-center font-mono text-[13px] text-faint">Type the wall to wall width to see the drawing.</p>;
  const ikea = s.build === 'ikea';
  const pad = Math.max(W, H) * 0.09;
  const fs = Math.max(W, H) / 30; // label size, mm
  const Y = (z: number) => H - z; // floor is at the bottom
  const edge = { vectorEffect: 'non-scaling-stroke' as const, stroke: 'currentColor' };
  const line = { ...edge, fill: 'none' };
  const doorTop = ikea ? s.pax - 3 : H - 3;
  const doorBottom = ikea ? doorTop - (s.pax === 2010 ? 1951 : 2290) : RULES.plinth + 2;
  const L = takeOff(s.left);
  const Rt = takeOff(s.right);
  return (
    <svg viewBox={`${-pad * 0.9} ${-pad} ${W + pad * 2} ${H + pad * 2.1}`} className="block w-full text-ink" role="img" aria-label={`Front view, ${layoutLabel(s.units, s.build)}, ${inside ? 'inside' : 'doors'}`}>
      <defs>
        <pattern id="wp-grid" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M100 0H0V100" fill="none" stroke="currentColor" strokeOpacity="0.07" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id="wp-hatch" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V40" stroke="currentColor" strokeOpacity="0.35" vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>
      <rect x={-pad * 0.9} y={-pad} width={W + pad * 2} height={H + pad * 2.1} fill="url(#wp-grid)" />
      {/* the room: walls each side, ceiling and floor */}
      <rect x={0} y={0} width={W} height={H} {...line} strokeOpacity={0.25} strokeDasharray="12 10" />
      <line x1={-pad * 0.6} y1={H} x2={W + pad * 0.6} y2={H} {...line} strokeWidth={1.4} />

      {/* ends */}
      {s.left === 'panel' ? <rect x={0} y={0} width={L} height={H} {...edge} fill="url(#wp-hatch)" /> : null}
      {s.right === 'panel' ? <rect x={W - Rt} y={0} width={Rt} height={H} {...edge} fill="url(#wp-hatch)" /> : null}
      {s.left === 'wall' ? <rect x={0} y={0} width={L} height={H} {...line} strokeOpacity={0.6} /> : null}
      {s.right === 'wall' ? <rect x={W - Rt} y={0} width={Rt} height={H} {...line} strokeOpacity={0.6} /> : null}
      {ikea && p.filler > 0.5 ? (
        <>
          <rect x={L} y={Y(s.pax)} width={p.filler / 2} height={s.pax} {...line} strokeOpacity={0.6} />
          <rect x={W - Rt - p.filler / 2} y={Y(s.pax)} width={p.filler / 2} height={s.pax} {...line} strokeOpacity={0.6} />
        </>
      ) : null}
      {ikea && p.top === 'infill' ? <rect x={L} y={0} width={W - L - Rt} height={H - s.pax} {...line} strokeOpacity={0.6} /> : null}

      {p.units.map((u, i) => {
        const x0 = u.x;
        const x1 = u.x + u.w;
        const dw = u.w / u.doors;
        const xi0 = x0 + RULES.board;
        const xi1 = x1 - RULES.board;
        return (
          <g key={i}>
            {/* carcass */}
            <rect x={x0} y={Y(ikea ? s.pax : H)} width={u.w} height={ikea ? s.pax : H - RULES.plinth} className="fill-mount" {...edge} strokeWidth={1.2} />
            <rect x={x0 + 40} y={Y(ikea ? RULES.paxBase : RULES.plinth)} width={u.w - 80} height={ikea ? RULES.paxBase : RULES.plinth} {...line} strokeOpacity={0.5} />
            {ikea && p.top === 'box' ? <rect x={x0} y={0} width={u.w} height={H - s.pax} className="fill-mount" {...edge} strokeWidth={1.2} /> : null}

            {inside ? (
              <g>
                {u.sections.map((sec, j) => {
                  const k = sec.kind;
                  if (k === 'shelf') return <rect key={j} x={xi0} y={Y(sec.z0 + RULES.board)} width={xi1 - xi0} height={RULES.board} fill="currentColor" />;
                  if (k === 'baskets' || k === 'drawers') {
                    const each = k === 'baskets' ? RULES.basket : RULES.drawer;
                    return (
                      <g key={j}>
                        {Array.from({ length: sec.count }, (_, n) => {
                          const a = sec.z0 + n * each + 6;
                          const b = a + each - 12;
                          return (
                            <g key={n}>
                              <rect x={xi0 + 15} y={Y(b)} width={xi1 - xi0 - 30} height={b - a} {...line} strokeDasharray={k === 'baskets' ? '6 5' : undefined} />
                              {k === 'drawers' ? <line x1={(xi0 + xi1) / 2 - 60} y1={Y(b - 30)} x2={(xi0 + xi1) / 2 + 60} y2={Y(b - 30)} {...line} strokeWidth={1.6} /> : null}
                            </g>
                          );
                        })}
                      </g>
                    );
                  }
                  if (k === 'shoes') return <line key={j} x1={xi0} y1={Y(sec.z0 + 60)} x2={xi1} y2={Y(sec.z0 + 150)} {...line} strokeWidth={1.6} />;
                  if (k === 'long' || k === 'short') {
                    const rz = sec.z1 - 60;
                    const drop = Math.min(k === 'long' ? 1300 : 900, sec.z1 - sec.z0 - 120);
                    const hangers = Math.max(2, Math.floor((xi1 - xi0) / 140));
                    return (
                      <g key={j}>
                        <line x1={xi0} y1={Y(rz)} x2={xi1} y2={Y(rz)} {...line} strokeWidth={2} />
                        {Array.from({ length: hangers }, (_, n) => {
                          const cx = xi0 + ((n + 0.5) * (xi1 - xi0)) / hangers;
                          return <path key={n} d={`M${cx} ${Y(rz)} L${cx - 55} ${Y(rz - 70)} L${cx - 45} ${Y(rz - drop)} L${cx + 45} ${Y(rz - drop)} L${cx + 55} ${Y(rz - 70)} Z`} {...line} strokeOpacity={0.35} />;
                        })}
                      </g>
                    );
                  }
                  if (k === 'shelves') {
                    const step = (sec.z1 - sec.z0) / (sec.count + 1);
                    return (
                      <g key={j}>
                        {Array.from({ length: sec.count }, (_, n) => (
                          <rect key={n} x={xi0} y={Y(sec.z0 + step * (n + 1) + RULES.board / 2)} width={xi1 - xi0} height={RULES.board} fill="currentColor" />
                        ))}
                      </g>
                    );
                  }
                  return null;
                })}
                {!u.ok ? <rect x={x0} y={Y(ikea ? s.pax : H)} width={u.w} height={ikea ? s.pax : H - RULES.plinth} fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray="10 8" vectorEffect="non-scaling-stroke" /> : null}
              </g>
            ) : (
              <g>
                {Array.from({ length: u.doors }, (_, d) => {
                  const a = x0 + d * dw + 2;
                  const b = x0 + (d + 1) * dw - 2;
                  const hingeLeft = u.doors === 2 ? d === 0 : i < (p.units.length - 1) / 2 || p.units.length === 1;
                  const hx = hingeLeft ? b - 45 : a + 45;
                  return (
                    <g key={d}>
                      <rect x={a} y={Y(doorTop)} width={b - a} height={doorTop - doorBottom} className="fill-mount" {...edge} strokeWidth={1.1} />
                      {s.doors !== 'flat' ? <rect x={a + 70} y={Y(doorTop - 70)} width={b - a - 140} height={doorTop - doorBottom - 140} {...line} strokeOpacity={0.45} /> : null}
                      {/* opening line: the triangle points to the hinge side, as on a drawing */}
                      <path d={`M${hingeLeft ? b : a} ${Y(doorTop)} L${hingeLeft ? a : b} ${Y((doorTop + doorBottom) / 2)} L${hingeLeft ? b : a} ${Y(doorBottom)}`} {...line} strokeOpacity={0.18} strokeDasharray="10 8" />
                      {s.handles === 'knobs' ? <circle cx={hx} cy={Y(Math.min(1050, (doorTop + doorBottom) / 2))} r={16} fill="currentColor" /> : null}
                      {s.handles === 'bars' ? <rect x={hx - 7} y={Y(1200)} width={14} height={300} fill="currentColor" /> : null}
                      {ikea && p.top === 'box' ? <rect x={a} y={3} width={b - a} height={H - s.pax - 6} className="fill-mount" {...edge} strokeWidth={1.1} /> : null}
                    </g>
                  );
                })}
              </g>
            )}
            {/* unit number and width under the floor line */}
            <text x={(x0 + x1) / 2} y={H + fs * 1.5} textAnchor="middle" fontSize={fs} className="fill-faint font-mono">
              {ikea ? { double: '1000', mid: '750', single: '500' }[s.units[i].type] : s.units[i].type === 'double' ? '1' : '0.5'}
            </text>
            {!ikea || u.w ? (
              <text x={(x0 + x1) / 2} y={H + fs * 2.7} textAnchor="middle" fontSize={fs * 0.85} className="fill-faint font-mono">
                {Math.round(u.w)}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* dimension lines, blue like the drawings */}
      <g className="text-accent">
        <line x1={0} y1={-pad * 0.45} x2={W} y2={-pad * 0.45} {...line} strokeWidth={1.2} />
        <line x1={0} y1={-pad * 0.65} x2={0} y2={-pad * 0.25} {...line} strokeWidth={1.2} />
        <line x1={W} y1={-pad * 0.65} x2={W} y2={-pad * 0.25} {...line} strokeWidth={1.2} />
        <text x={W / 2} y={-pad * 0.6} textAnchor="middle" fontSize={fs} className="fill-accent font-mono">
          {W}
        </text>
        <line x1={W + pad * 0.45} y1={0} x2={W + pad * 0.45} y2={H} {...line} strokeWidth={1.2} />
        <line x1={W + pad * 0.25} y1={0} x2={W + pad * 0.65} y2={0} {...line} strokeWidth={1.2} />
        <line x1={W + pad * 0.25} y1={H} x2={W + pad * 0.65} y2={H} {...line} strokeWidth={1.2} />
        <text x={W + pad * 0.62} y={H / 2} textAnchor="middle" fontSize={fs} className="fill-accent font-mono" transform={`rotate(90 ${W + pad * 0.62} ${H / 2})`}>
          {H}
        </text>
      </g>
    </svg>
  );
}

/* ---------- the inside of one unit: a stack you can add to, reorder and count ---------- */

const ADDABLE: PieceKind[] = ['baskets', 'drawers', 'shelf', 'shelves', 'short', 'long', 'shoes'];

function UnitInside({ unit, index, plan: up, ikea, onChange }: { unit: Unit; index: number; plan: Plan['units'][number] | undefined; ikea: boolean; onChange: (u: Unit) => void }) {
  const pcs = unit.pieces;
  const set = (pieces: Piece[]) => onChange({ ...unit, pieces });
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= pcs.length) return;
    const next = [...pcs];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const small = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-mount text-[16px] leading-none disabled:opacity-30';
  return (
    <div className="rounded-sm border border-line bg-paper p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">
          Unit {index + 1}: {unitName(unit.type, ikea ? 'ikea' : 'mdf')}
          <span className="font-mono text-[13px] font-normal text-faint"> · {Math.round(up?.w ?? 0)} mm</span>
        </p>
        <p className={`flex items-center gap-1 font-mono text-[12.5px] ${up?.ok === false ? 'font-semibold text-ink' : 'text-faint'}`}>
          {up?.ok === false ? <Mark state="lost" /> : null}
          {up?.note}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {PRESETS.filter((x) => !x.for || x.for === (ikea ? 'ikea' : 'mdf')).map((x) => (
          <button key={x.label} type="button" onClick={() => set(x.pieces.map((q) => ({ ...q })))} className="min-h-9 rounded-sm border border-line-strong bg-mount px-2.5 py-1 text-[13.5px] hover:border-ink">
            {x.label}
          </button>
        ))}
      </div>

      <p className="mt-3 font-mono text-[11.5px] text-faint">Top</p>
      <ol className="mt-1 grid gap-1.5">
        {pcs
          .map((pc, i) => ({ pc, i }))
          .reverse()
          .map(({ pc, i }) => {
            const info = PIECES[pc.kind];
            return (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-sm border border-line-strong bg-mount px-2 py-1.5">
                <span className="min-w-[7rem] flex-1 text-[15px]">
                  {info.name}
                  {pc.kind === 'shelf' && i === pcs.length - 1 ? <span className="text-faint"> (top)</span> : null}
                </span>
                {info.counted ? (
                  <span className="flex items-center gap-1.5">
                    <button type="button" className={small} disabled={pc.count <= 1} onClick={() => set(pcs.map((q, j) => (j === i ? { ...q, count: q.count - 1 } : q)))} aria-label={`One ${info.counted[0]} fewer`}>
                      −
                    </button>
                    <span className="w-5 text-center font-mono text-[15px]">{pc.count}</span>
                    <button type="button" className={small} disabled={pc.count >= (info.max ?? 8)} onClick={() => set(pcs.map((q, j) => (j === i ? { ...q, count: q.count + 1 } : q)))} aria-label={`One more ${info.counted[0]}`}>
                      +
                    </button>
                  </span>
                ) : null}
                <span className="ml-auto flex gap-1">
                  <button type="button" className={small} disabled={i === pcs.length - 1} onClick={() => move(i, 1)} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" className={small} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move down">
                    ↓
                  </button>
                  <button type="button" className={small} onClick={() => set(pcs.filter((_, j) => j !== i))} aria-label={`Remove ${info.name}`}>
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        {!pcs.length ? <li className="rounded-sm border border-dashed border-line-strong px-2.5 py-3 text-center text-[14px] text-faint">Empty: add pieces below</li> : null}
      </ol>
      <p className="mt-1 font-mono text-[11.5px] text-faint">Bottom</p>

      <p className="mt-3 font-mono text-[11.5px] text-faint">Add</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {ADDABLE.filter((k) => ikea || k !== 'baskets').map((k) => (
          <button key={k} type="button" onClick={() => set(addPiece(pcs, k))} className="min-h-9 rounded-sm border border-line-strong bg-mount px-2.5 py-1 text-[13.5px] hover:border-ink">
            + {PIECES[k].name}
          </button>
        ))}
      </div>
    </div>
  );
}

const ENDS: [End, string][] = [
  ['panel', 'End panel'],
  ['wall', 'Wall'],
  ['none', 'Nothing'],
];

export function WardrobePlanner({ spec: raw, sizes, onChange, onUpdate }: { spec?: WardrobeSpec; sizes: Size[]; onChange: (s: WardrobeSpec | undefined) => void; onUpdate?: () => void }) {
  const [view, setView] = useState<'doors' | 'inside'>('doors');
  const [open, setOpen] = useState(true);
  if (!raw) {
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
  const s = normalise(raw);
  const p = plan(s);
  const set = (patch: Partial<WardrobeSpec>) => onChange({ ...s, ...patch });
  const setUnit = (i: number, u: Unit) => set({ units: s.units.map((x, j) => (j === i ? u : x)) });
  const current = layoutLabel(s.units, s.build);
  const ikea = s.build === 'ikea';
  const add = (t: UnitType) => set({ units: withLayout(s.units, [...s.units.map((u) => u.type), t], s.build) });
  const layouts = LAYOUTS.filter((l) => ikea || !l.ikea).map((l) => ({ ...l, label: layoutLabel(l.units.map((t) => ({ type: t, pieces: [] })), s.build) }));

  return (
    <section className="rounded-sm border border-line-strong bg-mount p-4">
      <PlannerHeader title="Wardrobe planner" open={open} onToggle={() => setOpen(!open)} summary={`${ikea ? `IKEA PAX ${s.pax}` : 'MDF'} · ${current}${s.width ? ` · ${s.width} wide` : ''}`} />

      {open ? (
      <div className="mt-4 grid gap-5">
        <div className="grid gap-2">
          <span className={label}>Build</span>
          <Pick<'mdf' | 'ikea'> options={[['mdf', 'MDF'], ['ikea', 'IKEA PAX']]} value={s.build} onChange={(build) => set(normalise({ ...s, build }))} />
          <p className="font-mono text-[12px] text-faint">{ikea ? 'PAX frames 1000, 750 and 500 (really 998, 748 and 498), fillers take up the rest.' : 'MDF from floor to ceiling on a plinth, every door the same width.'}</p>
          {ikea ? (
            <Pick<2010 | 2364>
              options={[
                [2010, 'PAX 2010 + small top box'],
                [2364, 'Tall PAX 2364 (taller ceilings)'],
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
          <span className={label}>{ikea ? 'Layout (PAX frames, left to right)' : 'Layout (double = 1, single = 0.5)'}</span>
          <Pick
            options={[...layouts.map((l) => [l.label, l.label] as [string, string]), ...(layouts.some((l) => l.label === current) ? [] : [[current, current] as [string, string]])]}
            value={current}
            onChange={(v) => {
              const l = layouts.find((x) => x.label === v);
              if (l) set({ units: withLayout(s.units, l.units, s.build) });
            }}
          />
          <div className="flex flex-wrap gap-2">
            {(ikea
              ? ([
                  ['double', '+ 1000'],
                  ['mid', '+ 750'],
                  ['single', '+ 500'],
                ] as [UnitType, string][])
              : ([
                  ['double', '+ Double'],
                  ['single', '+ Single'],
                ] as [UnitType, string][])
            ).map(([t, text]) => (
              <button key={t} type="button" className="btn btn-ghost btn-sm" onClick={() => add(t)} disabled={s.units.length >= 6}>
                {text}
              </button>
            ))}
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

        <div className="overflow-hidden rounded-sm border border-line-strong bg-mount">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="font-mono text-[13px] leading-snug">
              {p.doors} door{p.doors === 1 ? '' : 's'}
              {ikea ? ' (PAX)' : p.doorW > 0 ? ` of ${Math.round(p.doorW)}` : ''}
              {ikea && s.width ? ` · filler ${Math.round(p.filler)}` : ''}
              {ikea ? ` · ${p.top === 'box' ? `top box ${p.above}` : p.top === 'infill' ? `infill ${p.above}` : 'nothing above'}` : ''}
            </p>
            <div className="flex shrink-0 overflow-hidden rounded-sm border border-line-strong" role="group" aria-label="Drawing">
              {(['doors', 'inside'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-8 px-3 text-[13.5px] ${view === v ? 'bg-ink text-mount' : 'bg-mount text-ink'}`}>
                  {v === 'doors' ? 'Doors' : 'Inside'}
                </button>
              ))}
            </div>
          </div>
          <div className="px-2 pb-1 pt-2">
            <Elevation s={s} p={p} inside={view === 'inside'} />
          </div>
          <div className="border-t border-line px-3 py-2">
            {p.problems.length ? (
              <ul className="grid gap-1">
                {p.problems.map((t) => (
                  <li key={t} className="flex items-start gap-1.5 text-[14px] font-semibold">
                    <Mark state="lost" /> {t}
                  </li>
                ))}
              </ul>
            ) : s.width ? (
              <p className="flex items-center gap-1.5 text-[14px] text-muted">
                <Mark state="sent" /> It all fits.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <span className={label}>Inside each unit, bottom to top</span>
          {s.units.map((u, i) => (
            <UnitInside key={i} unit={u} index={i} plan={p.units[i]} ikea={ikea} onChange={(nu) => setUnit(i, nu)} />
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

        {onUpdate ? (
          <div className="rounded-sm border border-accent bg-accent-soft p-3">
            <p className="text-[14.5px] leading-relaxed">Changed the layout? Send it and the customer’s link shows the new design.</p>
            <button type="button" className="btn btn-primary btn-sm mt-2 w-full" onClick={onUpdate}>
              Update the 3D design
            </button>
          </div>
        ) : null}

        <button type="button" className="h-10 justify-self-start text-[14.5px] text-muted" onClick={() => onChange(undefined)}>
          Use a different planner
        </button>
      </div>
      ) : null}
    </section>
  );
}
