'use client';
import { label } from './parts';
import { Counter, DOORS, DoorFront, HANDLES, Num, Pick, Problems, Sheet, edge, line } from './planner-parts';
import type { Size } from './store';
import { WardrobePlanner } from './wardrobe-planner';
import { newSpec, type WardrobeSpec } from '@/lib/wardrobe';
import { ALCOVE_RULES, newAlcove, planAlcove, type AlcoveSpec } from '@/lib/planners/alcove';
import { BOOKCASE_RULES, newBookcase, planBookcase, type BookcaseSpec } from '@/lib/planners/bookcase';
import { CHEST_RULES, newChest, planChest, type ChestSpec } from '@/lib/planners/chest';

/* The planners in a design request (Raf, 11 Oct 2026: 'could we have inside different planners like bookshelf
   planner, chimney breast or alcove one side or two side with base unit or just bookshelf, wardrobe planner,
   chest of drawer planner'). One per request: pick it, tap the choices, watch the drawing; the 3D design is
   built straight from it (scripts/planner-model.py). Each saves into the request's design brief. */

export type PlannerSpecs = { wardrobe?: WardrobeSpec; alcove?: AlcoveSpec; bookcase?: BookcaseSpec; chest?: ChestSpec };
type Kind = keyof PlannerSpecs;

const CHOICES: { kind: Kind; name: string; hint: string }[] = [
  { kind: 'wardrobe', name: 'Wardrobe', hint: 'MDF or IKEA PAX, doubles and singles, the inside of each' },
  { kind: 'alcove', name: 'Alcoves', hint: 'Beside a chimney breast, one side or both, base cupboard or shelves only' },
  { kind: 'bookcase', name: 'Bookcase', hint: 'A run of shelves in bays, with or without cupboards below' },
  { kind: 'chest', name: 'Chest of drawers', hint: 'Columns and drawers, plinth or legs' },
];

function Card({ title, children, onStop, onUpdate }: { title: string; children: React.ReactNode; onStop: () => void; onUpdate?: () => void }) {
  return (
    <section className="rounded-sm border border-line-strong bg-mount p-4">
      <h2 className="text-[19px] font-[650]">{title}</h2>
      <div className="mt-4 grid gap-5">
        {children}
        {onUpdate ? (
          <div className="rounded-sm border border-accent bg-accent-soft p-3">
            <p className="text-[14.5px] leading-relaxed">Changed something? Send it and the customer’s link shows the new design.</p>
            <button type="button" className="btn btn-primary btn-sm mt-2 w-full" onClick={onUpdate}>
              Update the 3D design
            </button>
          </div>
        ) : null}
        <button type="button" className="h-10 justify-self-start text-[14.5px] text-muted" onClick={onStop}>
          Use a different planner
        </button>
      </div>
    </section>
  );
}

function Drawing({ summary, children, problems, ok }: { summary: string; children: React.ReactNode; problems: string[]; ok: boolean }) {
  return (
    <div className="overflow-hidden rounded-sm border border-line-strong bg-mount">
      <p className="border-b border-line px-3 py-2 font-mono text-[13px] leading-snug">{summary}</p>
      <div className="px-2 pb-1 pt-2">{children}</div>
      <div className="border-t border-line px-3 py-2">
        <Problems list={problems} ok={ok} />
      </div>
    </div>
  );
}

const Field = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <div className="grid gap-2">
    <span className={label}>{name}</span>
    {children}
  </div>
);

/* ---------- alcoves ---------- */

function AlcovePlanner({ s, onChange }: { s: AlcoveSpec; onChange: (s: AlcoveSpec) => void }) {
  const p = planAlcove(s);
  const set = (patch: Partial<AlcoveSpec>) => onChange({ ...s, ...patch });
  const R = ALCOVE_RULES;
  return (
    <>
      <Field name="Which side">
        <Pick
          options={[
            ['both', 'Both alcoves'],
            ['left', 'Left only'],
            ['right', 'Right only'],
          ]}
          value={s.sides}
          onChange={(sides) => set({ sides })}
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
      <Field name="Bottom">
        <Pick
          options={[
            ['cupboard', 'Base cupboard'],
            ['none', 'Shelves only'],
          ]}
          value={s.base}
          onChange={(base) => set({ base })}
        />
        {s.base === 'cupboard' ? (
          <div className="grid grid-cols-3 gap-2">
            <Num text="Cupboard height" value={s.baseH} onChange={(baseH) => set({ baseH })} />
            <Num text="Cupboard depth" value={s.baseD} onChange={(baseD) => set({ baseD })} />
          </div>
        ) : null}
      </Field>
      <Field name="Shelves">
        <Counter value={s.shelves} min={0} max={10} onChange={(shelves) => set({ shelves })} one="shelf" many="shelves" />
        <div className="grid grid-cols-3 gap-2">
          <Num text="Shelf depth" value={s.shelfD} onChange={(shelfD) => set({ shelfD })} />
        </div>
      </Field>

      <Drawing summary={`${s.sides === 'both' ? 'Both alcoves' : `${s.sides === 'left' ? 'Left' : 'Right'} alcove`} · ${s.base === 'cupboard' ? `cupboard ${s.baseH} + ` : ''}${s.shelves} shelves`} problems={p.problems} ok={!!p.W}>
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

      {s.base === 'cupboard' ? (
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

export function Planners({ specs, sizes, onChange, onUpdate }: { specs: PlannerSpecs; sizes: Size[]; onChange: (next: PlannerSpecs) => void; onUpdate?: () => void }) {
  const active = (Object.keys(specs) as Kind[]).find((k) => specs[k]);
  const only = (k: Kind, v: PlannerSpecs[Kind] | undefined): PlannerSpecs => ({ wardrobe: undefined, alcove: undefined, bookcase: undefined, chest: undefined, [k]: v });
  const stop = () => onChange({ wardrobe: undefined, alcove: undefined, bookcase: undefined, chest: undefined });
  const space = sizes[0];
  const w = Number(space?.w) || 0;
  const h = Number(space?.h) || 0;
  const d = Number(space?.d) || 0;

  if (!active) {
    return (
      <section className="rounded-sm border border-line-strong bg-mount p-4">
        <h2 className="text-[19px] font-[650]">Plan it</h2>
        <p className="mt-1 text-[14.5px] leading-relaxed text-muted">Pick what it is, tap the choices and the 3D design is built straight from them.</p>
        <div className="mt-3 grid gap-2">
          {CHOICES.map((c) => (
            <button
              key={c.kind}
              type="button"
              onClick={() =>
                onChange(
                  only(
                    c.kind,
                    c.kind === 'wardrobe' ? newSpec(w, h, d) : c.kind === 'alcove' ? newAlcove(w ? Math.round(w / 2) : 0, h) : c.kind === 'bookcase' ? newBookcase(w, h) : newChest(w, h, d),
                  ),
                )
              }
              className="rounded-sm border border-line-strong bg-paper px-3 py-2.5 text-left transition-colors hover:border-ink"
            >
              <span className="block text-[16px] font-semibold">{c.name}</span>
              <span className="block text-[13.5px] text-muted">{c.hint}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (active === 'wardrobe') return <WardrobePlanner spec={specs.wardrobe} sizes={sizes} onChange={(v) => (v ? onChange(only('wardrobe', v)) : stop())} onUpdate={onUpdate} />;
  if (active === 'alcove')
    return (
      <Card title="Alcove planner" onStop={stop} onUpdate={onUpdate}>
        <AlcovePlanner s={specs.alcove!} onChange={(v) => onChange(only('alcove', v))} />
      </Card>
    );
  if (active === 'bookcase')
    return (
      <Card title="Bookcase planner" onStop={stop} onUpdate={onUpdate}>
        <BookcasePlanner s={specs.bookcase!} onChange={(v) => onChange(only('bookcase', v))} />
      </Card>
    );
  return (
    <Card title="Chest of drawers planner" onStop={stop} onUpdate={onUpdate}>
      <ChestPlanner s={specs.chest!} onChange={(v) => onChange(only('chest', v))} />
    </Card>
  );
}
