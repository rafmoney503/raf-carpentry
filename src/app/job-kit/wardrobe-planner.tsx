'use client';
import { useState } from 'react';
import Mark from './mark';
import { field, label } from './parts';
import { DoorFront, Drawing, PlannerHeader, RemoveButton, Sheet, edge, line } from './planner-parts';
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
  const doorTop = ikea ? s.pax - 3 : H - 3;
  const doorBottom = ikea ? doorTop - (s.pax === 2010 ? 1951 : 2290) : RULES.plinth + 2;
  const L = takeOff(s.left);
  const Rt = takeOff(s.right);
  return (
    <Sheet W={W} H={H} label={`Front view, ${layoutLabel(s.units, s.build)}, ${inside ? 'inside' : 'doors'}`}>
      {(Y, fs) => (
        <g>
          {/* ends */}
          {s.left === 'panel' ? <rect x={0} y={0} width={L} height={H} {...edge} fill="url(#sheet-hatch)" /> : null}
          {s.right === 'panel' ? <rect x={W - Rt} y={0} width={Rt} height={H} {...edge} fill="url(#sheet-hatch)" /> : null}
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
            const hingeOf = (d: number) => (u.doors === 2 ? d === 0 : i < (p.units.length - 1) / 2 || p.units.length === 1);
            return (
              <g key={i}>
                {/* carcass, plinth and (IKEA) the top box */}
                <rect x={x0} y={Y(ikea ? s.pax : H)} width={u.w} height={ikea ? s.pax : H - RULES.plinth} {...line} strokeWidth={1.4} />
                <rect x={x0 + 40} y={Y(ikea ? RULES.paxBase : RULES.plinth)} width={u.w - 80} height={ikea ? RULES.paxBase : RULES.plinth} {...line} strokeOpacity={0.5} />
                {ikea && p.top === 'box' ? <rect x={x0} y={0} width={u.w} height={H - s.pax} {...line} strokeWidth={1.4} /> : null}

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
                    {/* top box doors stay on, as the alcove cupboards do */}
                    {ikea && p.top === 'box'
                      ? Array.from({ length: u.doors }, (_, d) => <DoorFront key={d} x0={x0 + d * dw + 2} x1={x0 + (d + 1) * dw - 2} z0={s.pax + 3} z1={H - 3} Y={Y} hingeLeft={hingeOf(d)} style={s.doors} handles="push" />)
                      : null}
                    {!u.ok ? <rect x={x0} y={Y(ikea ? s.pax : H)} width={u.w} height={ikea ? s.pax : H - RULES.plinth} fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray="10 8" vectorEffect="non-scaling-stroke" /> : null}
                  </g>
                ) : (
                  <g>
                    {Array.from({ length: u.doors }, (_, d) => (
                      <g key={d}>
                        <DoorFront x0={x0 + d * dw + 2} x1={x0 + (d + 1) * dw - 2} z0={doorBottom} z1={doorTop} Y={Y} hingeLeft={hingeOf(d)} style={s.doors} handles={s.handles} />
                        {ikea && p.top === 'box' ? <DoorFront x0={x0 + d * dw + 2} x1={x0 + (d + 1) * dw - 2} z0={s.pax + 3} z1={H - 3} Y={Y} hingeLeft={hingeOf(d)} style={s.doors} handles="push" /> : null}
                      </g>
                    ))}
                  </g>
                )}
                {/* the unit's width under the floor line, as on the alcove drawing */}
                <text x={(x0 + x1) / 2} y={H + fs * 1.5} textAnchor="middle" fontSize={fs * 0.85} className="fill-faint font-mono">
                  {Math.round(u.w)}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </Sheet>
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

export function WardrobePlanner({ spec: raw, sizes, onChange, title = 'Wardrobe planner', onCopy, onRemove }: { spec?: WardrobeSpec; sizes: Size[]; onChange: (s: WardrobeSpec | undefined) => void; title?: string; onCopy?: () => void; onRemove?: () => void }) {
  const [view, setView] = useState<'doors' | 'inside'>('inside');
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
      <PlannerHeader title={title} open={open} onToggle={() => setOpen(!open)} onCopy={onCopy} summary={`${ikea ? `IKEA PAX ${s.pax}` : 'MDF'} · ${current}${s.width ? ` · ${s.width} wide` : ''} · ${s.doors} doors`} />

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

        <Drawing
          summary={`${p.doors} door${p.doors === 1 ? '' : 's'}${ikea ? ' (PAX)' : p.doorW > 0 ? ` of ${Math.round(p.doorW)}` : ''}${ikea && s.width ? ` · filler ${Math.round(p.filler)}` : ''}${ikea ? ` · ${p.top === 'box' ? `top box ${p.above}` : p.top === 'infill' ? `infill ${p.above}` : 'nothing above'}` : ''}`}
          problems={p.problems}
          ok={!!s.width}
          extra={
            s.width ? (
              <button type="button" className="h-9 text-[14px] text-muted underline underline-offset-2 hover:text-ink" onClick={() => setView(view === 'inside' ? 'doors' : 'inside')}>
                {view === 'inside' ? 'Show with the doors on' : 'Show the inside'}
              </button>
            ) : null
          }
        >
          <Elevation s={s} p={p} inside={view === 'inside'} />
        </Drawing>

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

        <RemoveButton onRemove={onRemove ?? (() => onChange(undefined))} />
      </div>
      ) : null}
    </section>
  );
}
