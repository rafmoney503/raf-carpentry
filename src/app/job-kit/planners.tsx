'use client';
import { label } from './parts';
import { useState } from 'react';
import { Counter, DOORS, DoorFront, Drawing, HANDLES, Num, Pick, PlannerHeader, RemoveButton, Sheet, edge, line } from './planner-parts';
import { MAX_PLANS, PLAN_NAMES, type PlanItem, type PlanKind, type Size } from './store';
import { WardrobePlanner } from './wardrobe-planner';
import { newSpec } from '@/lib/wardrobe';
import { ALCOVE_RULES, fitOf, newAlcove, normaliseAlcove, planAlcove, type AlcoveFit, type AlcoveSpec } from '@/lib/planners/alcove';
import { BOOKCASE_RULES, newBookcase, planBookcase, type BookcaseSpec } from '@/lib/planners/bookcase';
import { CHEST_RULES, newChest, planChest, type ChestSpec } from '@/lib/planners/chest';

/* The planners in a design request (Raf, 11 Oct 2026: 'could we have inside different planners like bookshelf
   planner, chimney breast or alcove one side or two side with base unit or just bookshelf, wardrobe planner,
   chest of drawer planner'). One per request: pick it, tap the choices, watch the drawing; the 3D design is
   built straight from it (scripts/planner-model.py). Each saves into the request's design brief. */


const CHOICES: { kind: PlanKind; name: string; hint: string }[] = [
  { kind: 'wardrobe', name: 'Wardrobe', hint: 'MDF or IKEA PAX, doubles and singles, the inside of each' },
  { kind: 'alcove', name: 'Alcoves', hint: 'Beside a chimney breast, one side or both, base cupboard or shelves only' },
  { kind: 'bookcase', name: 'Bookcase', hint: 'A run of shelves in bays, with or without cupboards below' },
  { kind: 'chest', name: 'Chest of drawers', hint: 'Columns and drawers, plinth or legs' },
];

function Card({ title, summary, children, onCopy, onRemove }: { title: string; summary: string; children: React.ReactNode; onCopy?: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-sm border border-line-strong bg-mount p-4">
      <PlannerHeader title={title} open={open} onToggle={() => setOpen(!open)} summary={summary} onCopy={onCopy} />
      {open ? (
        <div className="mt-4 grid gap-5">
          {children}
          <RemoveButton onRemove={onRemove} />
        </div>
      ) : null}
    </section>
  );
}

const Field = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <div className="grid gap-2">
    <span className={label}>{name}</span>
    {children}
  </div>
);

/* ---------- alcoves ---------- */

function FitEditor({ title, f, onChange }: { title?: string; f: AlcoveFit; onChange: (f: AlcoveFit) => void }) {
  const set = (patch: Partial<AlcoveFit>) => onChange({ ...f, ...patch });
  return (
    <div className={title ? 'grid gap-4 rounded-sm border border-line bg-paper p-3' : 'grid gap-4'}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <Field name="Bottom">
        <Pick
          options={[
            ['cupboard', 'Base cupboard'],
            ['none', 'Shelves only'],
          ]}
          value={f.base}
          onChange={(base) => set({ base })}
        />
        {f.base === 'cupboard' ? (
          <div className="grid grid-cols-3 gap-2">
            <Num text="Cupboard height" value={f.baseH} onChange={(baseH) => set({ baseH })} />
            <Num text="Cupboard depth" value={f.baseD} onChange={(baseD) => set({ baseD })} />
          </div>
        ) : null}
      </Field>
      <Field name="Shelves">
        <Counter value={f.shelves} min={0} max={10} onChange={(shelves) => set({ shelves })} one="shelf" many="shelves" />
        <div className="grid grid-cols-3 gap-2">
          <Num text="Shelf depth" value={f.shelfD} onChange={(shelfD) => set({ shelfD })} />
        </div>
      </Field>
    </div>
  );
}

type AlcoveMode = 'same' | 'different' | 'left' | 'right';

function AlcovePlanner({ s: raw, onChange }: { s: AlcoveSpec; onChange: (s: AlcoveSpec) => void }) {
  const s = normaliseAlcove(raw);
  const p = planAlcove(s);
  const set = (patch: Partial<AlcoveSpec>) => onChange({ ...s, ...patch });
  const R = ALCOVE_RULES;
  const mode: AlcoveMode = s.sides === 'both' ? (s.same ? 'same' : 'different') : s.sides;
  const anyBase = p.sides.some((a) => a.base);
  return (
    <>
      <Field name="Which alcoves">
        <Pick<AlcoveMode>
          options={[
            ['same', 'Both, the same'],
            ['different', 'Both, different'],
            ['left', 'Left only'],
            ['right', 'Right only'],
          ]}
          value={mode}
          onChange={(m) =>
            set(
              m === 'same'
                ? { sides: 'both', same: true }
                : m === 'different'
                  ? { sides: 'both', same: false, right: s.same ? { ...s.left } : s.right }
                  : { sides: m, same: false, ...(m === 'right' && s.same ? { right: { ...s.left } } : {}) },
            )
          }
        />
      </Field>
      <Field name="The space">
        <div className="grid grid-cols-3 gap-2">
          <Num text="Left alcove" value={s.leftW} onChange={(leftW) => set({ leftW })} />
          <Num text="Chimney breast" value={s.breastW} onChange={(breastW) => set({ breastW })} />
          <Num text="Right alcove" value={s.rightW} onChange={(rightW) => set({ rightW })} />
          <Num text="Breast comes out" value={s.breastD} onChange={(breastD) => set({ breastD })} />
          <Num text="Ceiling" value={s.ceiling} onChange={(ceiling) => set({ ceiling })} />
        </div>
      </Field>

      {mode === 'same' ? <FitEditor f={s.left} onChange={(left) => set({ left, right: { ...left } })} /> : null}
      {mode === 'different' ? (
        <div className="grid gap-3">
          <FitEditor title="Left alcove" f={s.left} onChange={(left) => set({ left })} />
          <FitEditor title="Right alcove" f={s.right} onChange={(right) => set({ right })} />
        </div>
      ) : null}
      {mode === 'left' ? <FitEditor f={s.left} onChange={(left) => set({ left })} /> : null}
      {mode === 'right' ? <FitEditor f={s.right} onChange={(right) => set({ right })} /> : null}

      <Drawing summary={alcoveTag(s)} problems={p.problems} ok={!!p.W}>
        <Sheet W={p.W} H={s.ceiling} label="Front view of the alcoves">
          {(Y, fs) => (
            <g>
              {/* chimney breast with a fireplace opening */}
              <rect x={p.breastX} y={0} width={s.breastW} height={s.ceiling} {...edge} fill="url(#sheet-hatch)" />
              <rect x={p.breastX + s.breastW * 0.25} y={Y(Math.min(900, s.ceiling * 0.38))} width={s.breastW * 0.5} height={Math.min(900, s.ceiling * 0.38)} className="fill-mount" {...edge} />
              <text x={p.breastX + s.breastW / 2} y={Y(s.ceiling * 0.62)} textAnchor="middle" fontSize={fs * 0.8} className="fill-faint font-mono">
                {s.breastW}
              </text>
              {p.sides.map((a) => (
                <g key={a.side}>
                  {a.base ? (
                    <g>
                      <rect x={a.x} y={Y(a.base.h)} width={a.w} height={R.top} fill="currentColor" />
                      <rect x={a.x + 20} y={Y(R.plinth)} width={a.w - 40} height={R.plinth} {...line} strokeOpacity={0.5} />
                      {a.base.doors.map((d, i) => (
                        <DoorFront key={i} x0={d.x0} x1={d.x1} z0={R.plinth + 2} z1={a.base!.h - R.top - 2} Y={Y} hingeLeft={d.hingeLeft} style={s.doors} handles={s.handles} />
                      ))}
                    </g>
                  ) : null}
                  {a.shelves.map((z, i) => (
                    <rect key={i} x={a.x} y={Y(z + R.shelfT)} width={a.w} height={R.shelfT} fill="currentColor" />
                  ))}
                  <text x={a.x + a.w / 2} y={s.ceiling + fs * 1.6} textAnchor="middle" fontSize={fs * 0.85} className="fill-faint font-mono">
                    {a.w}
                  </text>
                </g>
              ))}
            </g>
          )}
        </Sheet>
      </Drawing>

      {anyBase ? (
        <>
          <Field name="Doors">
            <Pick options={DOORS} value={s.doors} onChange={(doors) => set({ doors })} />
          </Field>
          <Field name="Handles">
            <Pick options={HANDLES} value={s.handles} onChange={(handles) => set({ handles })} />
          </Field>
        </>
      ) : null}
    </>
  );
}

const fitTag = (f: AlcoveFit) => `${f.base === 'cupboard' ? `cupboard ${f.baseH} + ` : ''}${f.shelves} shelves`;
function alcoveTag(raw: AlcoveSpec) {
  const s = normaliseAlcove(raw);
  if (s.sides === 'both') return s.same ? `Both the same · ${fitTag(s.left)}` : `Left ${fitTag(s.left)} · right ${fitTag(s.right)}`;
  return `${s.sides === 'left' ? 'Left' : 'Right'} only · ${fitTag(fitOf(s, s.sides))}`;
}

/* ---------- bookcase ---------- */

const ENDS: ['panel' | 'wall' | 'none', string][] = [
  ['panel', 'End panel'],
  ['wall', 'Wall'],
  ['none', 'Nothing'],
];

function BookcasePlanner({ s, onChange }: { s: BookcaseSpec; onChange: (s: BookcaseSpec) => void }) {
  const p = planBookcase(s);
  const set = (patch: Partial<BookcaseSpec>) => onChange({ ...s, ...patch });
  const R = BOOKCASE_RULES;
  return (
    <>
      <Field name="The space">
        <div className="grid grid-cols-3 gap-2">
          <Num text="Width" value={s.width} onChange={(width) => set({ width })} />
          <Num text="Height" value={s.height} onChange={(height) => set({ height })} />
          <Num text="Shelf depth" value={s.depth} onChange={(depth) => set({ depth })} />
        </div>
      </Field>
      <Field name="Bays">
        <Counter value={s.bays} min={1} max={8} onChange={(bays) => set({ bays })} one="bay" many="bays" />
      </Field>
      <Field name="Shelves in each bay">
        <Counter value={s.shelves} min={0} max={10} onChange={(shelves) => set({ shelves })} one="shelf" many="shelves" />
      </Field>
      <Field name="Bottom">
        <Pick
          options={[
            ['cupboards', 'Cupboards below'],
            ['none', 'Shelves only'],
          ]}
          value={s.base}
          onChange={(base) => set({ base })}
        />
        {s.base === 'cupboards' ? (
          <div className="grid grid-cols-3 gap-2">
            <Num text="Cupboard height" value={s.baseH} onChange={(baseH) => set({ baseH })} />
            <Num text="Cupboard depth" value={s.baseD} onChange={(baseD) => set({ baseD })} />
          </div>
        ) : null}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="Left end">
          <Pick options={ENDS} value={s.left} onChange={(left) => set({ left })} />
        </Field>
        <Field name="Right end">
          <Pick options={ENDS} value={s.right} onChange={(right) => set({ right })} />
        </Field>
      </div>

      <Drawing summary={`${s.bays} bays of ${Math.round(p.bayW) || 0} · ${s.shelves} shelves each${s.base === 'cupboards' ? ` · cupboards ${s.baseH}` : ''}`} problems={p.problems} ok={!!s.width}>
        <Sheet W={s.width} H={s.height} label="Front view of the bookcase">
          {(Y, fs) => (
            <g>
              {s.left === 'panel' ? <rect x={0} y={0} width={R.panel} height={s.height} {...edge} fill="url(#sheet-hatch)" /> : null}
              {s.right === 'panel' ? <rect x={s.width - R.panel} y={0} width={R.panel} height={s.height} {...edge} fill="url(#sheet-hatch)" /> : null}
              <rect x={p.x0} y={Y(s.height)} width={p.x1 - p.x0} height={s.height} className="fill-mount" {...edge} strokeWidth={1.2} />
              {p.dividers.map((x, i) => (
                <rect key={i} x={x} y={Y(s.height)} width={R.board} height={s.height - (s.base === 'cupboards' ? 0 : 0)} fill="currentColor" fillOpacity={0.85} />
              ))}
              <rect x={p.x0} y={Y(s.height)} width={p.x1 - p.x0} height={R.board} fill="currentColor" />
              {s.base === 'cupboards' ? (
                <g>
                  <rect x={p.x0} y={Y(s.baseH)} width={p.x1 - p.x0} height={R.top} fill="currentColor" />
                  {p.bays.map((b, i) =>
                    b.doors.map((d, k) => <DoorFront key={`${i}-${k}`} x0={d.x0} x1={d.x1} z0={R.plinth + 2} z1={s.baseH - R.top - 2} Y={Y} hingeLeft={d.hingeLeft} style={s.doors} handles={s.handles} />),
                  )}
                </g>
              ) : null}
              <rect x={p.x0 + 20} y={Y(R.plinth)} width={p.x1 - p.x0 - 40} height={R.plinth} className="fill-mount" {...edge} strokeOpacity={0.6} />
              {p.bays.map((b, i) => (
                <g key={i}>
                  {b.shelves.map((z, k) => (
                    <rect key={k} x={b.x0} y={Y(z + R.board)} width={b.x1 - b.x0} height={R.board} fill="currentColor" />
                  ))}
                  <text x={(b.x0 + b.x1) / 2} y={s.height + fs * 1.6} textAnchor="middle" fontSize={fs * 0.85} className="fill-faint font-mono">
                    {Math.round(b.x1 - b.x0)}
                  </text>
                </g>
              ))}
            </g>
          )}
        </Sheet>
      </Drawing>

      {s.base === 'cupboards' ? (
        <>
          <Field name="Doors">
            <Pick options={DOORS} value={s.doors} onChange={(doors) => set({ doors })} />
          </Field>
          <Field name="Handles">
            <Pick options={HANDLES} value={s.handles} onChange={(handles) => set({ handles })} />
          </Field>
        </>
      ) : null}
    </>
  );
}

/* ---------- chest of drawers ---------- */

function ChestPlanner({ s, onChange }: { s: ChestSpec; onChange: (s: ChestSpec) => void }) {
  const p = planChest(s);
  const set = (patch: Partial<ChestSpec>) => onChange({ ...s, ...patch });
  const R = CHEST_RULES;
  return (
    <>
      <Field name="Size">
        <div className="grid grid-cols-3 gap-2">
          <Num text="Width" value={s.width} onChange={(width) => set({ width })} />
          <Num text="Height" value={s.height} onChange={(height) => set({ height })} />
          <Num text="Depth" value={s.depth} onChange={(depth) => set({ depth })} />
        </div>
      </Field>
      <Field name="Columns">
        <Pick<1 | 2 | 3>
          options={[
            [1, 'One'],
            [2, 'Two'],
            [3, 'Three'],
          ]}
          value={s.columns}
          onChange={(columns) => set({ columns })}
        />
      </Field>
      <Field name="Drawers down each column">
        <Counter value={s.rows} min={1} max={8} onChange={(rows) => set({ rows })} one="drawer" many="drawers" />
      </Field>
      <Field name="Drawer heights">
        <Pick
          options={[
            [true, 'Deeper towards the bottom'],
            [false, 'All the same'],
          ]}
          value={s.graduated}
          onChange={(graduated) => set({ graduated })}
        />
        {s.columns === 1 ? (
          <Pick
            options={[
              [false, 'Full-width top drawer'],
              [true, 'Two small drawers at the top'],
            ]}
            value={s.topSplit}
            onChange={(topSplit) => set({ topSplit })}
          />
        ) : null}
      </Field>
      <Field name="Base">
        <Pick
          options={[
            ['plinth', 'Plinth'],
            ['legs', 'Legs'],
            ['none', 'Straight to the floor'],
          ]}
          value={s.base}
          onChange={(base) => set({ base })}
        />
      </Field>

      <Drawing summary={`${p.fronts.length} drawers · ${s.width} x ${s.height} x ${s.depth}`} problems={p.problems} ok={!!s.width}>
        <Sheet W={s.width} H={s.height} label="Front view of the chest of drawers">
          {(Y) => (
            <g>
              <rect x={-15} y={Y(s.height)} width={s.width + 30} height={R.top} fill="currentColor" />
              {s.base === 'plinth' ? <rect x={30} y={Y(p.baseH)} width={s.width - 60} height={p.baseH} className="fill-mount" {...edge} strokeOpacity={0.6} /> : null}
              {s.base === 'legs'
                ? [40, s.width - 80].map((x) => <rect key={x} x={x} y={Y(p.baseH)} width={40} height={p.baseH} fill="currentColor" />)
                : null}
              {p.fronts.map((f, i) => {
                const cx = (f.x0 + f.x1) / 2;
                const cz = (f.z0 + f.z1) / 2;
                return (
                  <g key={i}>
                    <rect x={f.x0} y={Y(f.z1)} width={f.x1 - f.x0} height={f.z1 - f.z0} className="fill-mount" {...edge} strokeWidth={1.1} />
                    {s.handles === 'knobs' ? (
                      (f.x1 - f.x0) > 500 ? (
                        [f.x0 + (f.x1 - f.x0) / 4, f.x1 - (f.x1 - f.x0) / 4].map((x) => <circle key={x} cx={x} cy={Y(cz)} r={14} fill="currentColor" />)
                      ) : (
                        <circle cx={cx} cy={Y(cz)} r={14} fill="currentColor" />
                      )
                    ) : null}
                    {s.handles === 'bars' ? <rect x={cx - Math.min(150, (f.x1 - f.x0) / 4)} y={Y(cz) - 6} width={Math.min(300, (f.x1 - f.x0) / 2)} height={12} fill="currentColor" /> : null}
                  </g>
                );
              })}
              <rect x={0} y={Y(s.height - R.top)} width={s.width} height={s.height - R.top - p.baseH} {...line} strokeWidth={1.2} />
            </g>
          )}
        </Sheet>
      </Drawing>

      <Field name="Handles">
        <Pick options={HANDLES} value={s.handles} onChange={(handles) => set({ handles })} />
      </Field>
    </>
  );
}

/* ---------- picking one ---------- */

const LETTERS = 'ABCD';
function freshId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function Planners({ items, sizes, onChange, onUpdate }: { items: PlanItem[]; sizes: Size[]; onChange: (next: PlanItem[]) => void; onUpdate?: () => void }) {
  const [choosing, setChoosing] = useState(false);
  const space = sizes[0];
  const w = Number(space?.w) || 0;
  const h = Number(space?.h) || 0;
  const d = Number(space?.d) || 0;
  const set = (i: number, it: PlanItem) => onChange(items.map((x, j) => (j === i ? it : x)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const full = items.length >= MAX_PLANS;
  // the tab name on the customer's page: a copy is the next option of the same piece
  const copy = (i: number) => {
    if (full) return;
    const it = items[i];
    const base = it.name.replace(/, option [A-D]$/, '');
    const same = items.filter((x) => x.name === base || x.name.startsWith(`${base}, option `)).length;
    const name = `${base}, option ${LETTERS[same] ?? same + 1}`;
    const next = [...items];
    next.splice(i + 1, 0, { ...it, id: freshId(), name, spec: JSON.parse(JSON.stringify(it.spec)) } as PlanItem);
    onChange(next);
  };
  const add = (kind: PlanKind) => {
    const base = PLAN_NAMES[kind];
    const taken = items.filter((x) => x.name === base || x.name.startsWith(`${base} `)).length;
    const name = taken ? `${base} ${taken + 1}` : base;
    const id = freshId();
    const it: PlanItem =
      kind === 'wardrobe'
        ? { id, name, kind, spec: newSpec(w, h, d) }
        : kind === 'alcove'
          ? { id, name, kind, spec: newAlcove(w ? Math.round(w / 2) : 0, h) }
          : kind === 'bookcase'
            ? { id, name, kind, spec: newBookcase(w, h) }
            : { id, name, kind, spec: newChest(w, h, d) };
    onChange([...items, it]);
    setChoosing(false);
  };

  const chooser = (
    <section className="rounded-sm border border-line-strong bg-mount p-4">
      <h2 className="text-[19px] font-[650]">{items.length ? 'Add a planner' : 'Plan it'}</h2>
      <p className="mt-1 text-[14.5px] leading-relaxed text-muted">
        {items.length ? 'Another piece for the same customer. Each planner is its own tab on their page.' : 'Pick what it is, tap the choices and the 3D design is built straight from them. Add more pieces, or copy one as a second option.'}
      </p>
      <div className="mt-3 grid gap-2">
        {CHOICES.map((c) => (
          <button key={c.kind} type="button" onClick={() => add(c.kind)} className="rounded-sm border border-line-strong bg-paper px-3 py-2.5 text-left transition-colors hover:border-ink">
            <span className="block text-[16px] font-semibold">{c.name}</span>
            <span className="block text-[13.5px] text-muted">{c.hint}</span>
          </button>
        ))}
      </div>
      {items.length ? (
        <button type="button" className="mt-2 h-10 text-[14.5px] text-muted" onClick={() => setChoosing(false)}>
          Cancel
        </button>
      ) : null}
    </section>
  );

  return (
    <div className="grid gap-4">
      {items.map((it, i) => {
        const onCopy = full ? undefined : () => copy(i);
        const onRemove = () => remove(i);
        if (it.kind === 'wardrobe')
          return <WardrobePlanner key={it.id} title={it.name} spec={it.spec} sizes={sizes} onChange={(v) => (v ? set(i, { ...it, spec: v }) : onRemove())} onCopy={onCopy} onRemove={onRemove} />;
        if (it.kind === 'alcove')
          return (
            <Card key={it.id} title={it.name} summary={alcoveTag(it.spec)} onCopy={onCopy} onRemove={onRemove}>
              <AlcovePlanner s={it.spec} onChange={(v) => set(i, { ...it, spec: v })} />
            </Card>
          );
        if (it.kind === 'bookcase')
          return (
            <Card key={it.id} title={it.name} summary={`${it.spec.bays} bays · ${it.spec.shelves} shelves each · ${it.spec.width || 0} x ${it.spec.height}`} onCopy={onCopy} onRemove={onRemove}>
              <BookcasePlanner s={it.spec} onChange={(v) => set(i, { ...it, spec: v })} />
            </Card>
          );
        return (
          <Card key={it.id} title={it.name} summary={`${planChest(it.spec).fronts.length} drawers · ${it.spec.width} x ${it.spec.height} x ${it.spec.depth}`} onCopy={onCopy} onRemove={onRemove}>
            <ChestPlanner s={it.spec} onChange={(v) => set(i, { ...it, spec: v })} />
          </Card>
        );
      })}

      {!items.length || choosing ? (
        chooser
      ) : full ? (
        <p className="font-mono text-[13px] text-faint">{MAX_PLANS} planners is the most for one request: the customer gets {MAX_PLANS} tabs to compare.</p>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => setChoosing(true)}>
          + Add a planner
        </button>
      )}

      {items.length > 1 ? <p className="font-mono text-[12.5px] text-faint">The customer’s page shows these as {items.length} tabs, in this order: {items.map((x) => x.name).join(' / ')}.</p> : null}

      {onUpdate && items.length ? (
        <div className="rounded-sm border border-accent bg-accent-soft p-3">
          <p className="text-[14.5px] leading-relaxed">Changed something? Send it and the customer’s link shows the new design, every tab.</p>
          <button type="button" className="btn btn-primary btn-sm mt-2 w-full" onClick={onUpdate}>
            Update the 3D design
          </button>
        </div>
      ) : null}
    </div>
  );
}
