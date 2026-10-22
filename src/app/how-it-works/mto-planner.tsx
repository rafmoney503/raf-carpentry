'use client';
/* Made to measure in the brief's wardrobe planner (wardrobe-window.tsx): Raf's MDF units to the customer's sizes,
   standard or custom widths or an equal split, plinth and top infill, tall doors or top cupboards, flat or shaker
   doors, and what goes inside. Every unit is laid out by CabinetOS's own rules (src/lib/cabinetos-wardrobe.ts via
   src/lib/wardrobe-brief.ts), as in the 3D planner. Nothing here is saved anywhere. */
import {
  INSIDE_CHOICES,
  MTO,
  PLAN,
  equalRange,
  hasDrawers,
  mtoLayout,
  type InsideKey,
  type MtoLayout,
  type MtoPlan,
} from '@/lib/wardrobe-brief';
import { HDim, Hatch, MB, ML, MR, MT, Pick, Step, Strip, SuggestNote, VDim, numBox, useBoxWidth } from './plan-parts';

const INS = INSIDE_CHOICES.filter((x) => x.mto);

/* Heights on the right: a line per part, the words along it when they fit, else level beside it, pushed apart. */
function RightDims({ x, parts }: { x: number; parts: { y1: number; y2: number; label: string }[] }) {
  const level: { y: number; label: string }[] = [];
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    const span = Math.abs(p.y2 - p.y1);
    if (span >= p.label.length * 6.8 + 10) out.push(<VDim key={i} x={x} y1={p.y1} y2={p.y2} label={p.label} />);
    else {
      out.push(<VDim key={i} x={x} y1={p.y1} y2={p.y2} label="" />);
      level.push({ y: (p.y1 + p.y2) / 2 + 4, label: p.label });
    }
  });
  level.sort((a, b) => a.y - b.y);
  for (let i = 1; i < level.length; i++) if (level[i].y - level[i - 1].y < 13) level[i].y = level[i - 1].y + 13;
  level.forEach((l, i) =>
    out.push(
      <text key={`l${i}`} x={x + 7} y={l.y} className="fill-accent font-mono" fontSize={11}>
        {l.label}
      </text>,
    ),
  );
  return <>{out}</>;
}

export function MtoDrawing({
  plan,
  wall,
  ceiling,
  sel,
  onPick,
  showInside,
  maxH,
}: {
  plan: MtoPlan;
  wall: number;
  ceiling: number;
  sel: number;
  onPick?: (i: number) => void;
  showInside: boolean;
  maxH: number;
}) {
  const { box, w } = useBoxWidth();
  const g = mtoLayout(plan, wall, ceiling);
  const aw = w - ML - MR;
  const sc = Math.min(aw / wall, maxH / ceiling);
  const dw = wall * sc;
  const dh = ceiling * sc;
  const ox = ML + (aw - dw) / 2;
  const fy = MT + dh;
  const X = (mm: number) => ox + mm * sc;
  const Y = (mm: number) => fy - mm * sc;
  const H = Math.ceil(MT + dh + MB);
  const over = g.across > wall;
  const startX = over ? Math.max(0, (wall - g.across) / 2) : g.fillerL;
  const P = plan.plinth;
  const unitTop = P + g.boxH + g.topH;
  const shortNames = plan.widths.some((wd) => wd * sc < 48);

  const units = plan.widths.map((wd, i) => {
    const p = g.pieces[i];
    const L = p.layout;
    const x0 = startX + p.x;
    const cx = (mm: number) => X(x0 + mm);
    const cy = (mm: number) => Y(P + mm);
    const doorsHere = L.doors;
    const kids: React.ReactNode[] = [];
    // the carcass outline (base box and, with top cupboards, the top box)
    kids.push(<rect key="c" x={cx(0) + 0.4} y={cy(g.boxH) + 0.4} width={wd * sc - 0.8} height={g.boxH * sc - 0.8} className="fill-mount stroke-ink/70" strokeWidth={0.9} />);
    if (g.topH) kids.push(<rect key="ct" x={cx(0) + 0.4} y={cy(g.boxH + g.topH) + 0.4} width={wd * sc - 0.8} height={g.topH * sc - 0.8} className="fill-mount stroke-ink/70" strokeWidth={0.9} />);
    if (showInside) {
      if (plan.inside[i] === 'unsure') kids.push(<text key="q" x={cx(wd / 2)} y={cy(g.boxH / 2)} textAnchor="middle" className="fill-faint font-mono" fontSize={13}>?</text>);
      L.shelves.forEach((s, j) => kids.push(<line key={`s${j}`} x1={cx(18)} y1={cy(s)} x2={cx(wd - 18)} y2={cy(s)} className="stroke-ink/55" strokeWidth={1} />));
      if (L.dust != null) kids.push(<line key="dust" x1={cx(18)} y1={cy(L.dust)} x2={cx(wd - 18)} y2={cy(L.dust)} className="stroke-ink/55" strokeWidth={1} />);
      L.rails.forEach((r, j) => kids.push(<line key={`r${j}`} x1={cx(30)} y1={cy(r)} x2={cx(wd - 30)} y2={cy(r)} className="stroke-ink" strokeWidth={2} strokeLinecap="round" />));
      L.drawers.forEach((d, j) =>
        kids.push(<rect key={`d${j}`} x={cx(d.x0) + 0.5} y={cy(d.y1) + 1} width={Math.max(0, (d.x1 - d.x0) * sc - 1)} height={Math.max(0, (d.y1 - d.y0) * sc - 2)} className={L.drawersBelow ? 'fill-accent/10 stroke-accent/70' : 'fill-none stroke-ink/60'} strokeWidth={0.9} />),
      );
    } else {
      doorsHere.forEach((d, j) => {
        const dw2 = (d.x1 - d.x0) * sc;
        const dh2 = (d.y1 - d.y0) * sc;
        kids.push(<rect key={`d${j}`} x={cx(d.x0)} y={cy(d.y1)} width={Math.max(0, dw2)} height={Math.max(0, dh2)} className="fill-accent/10 stroke-accent/70" strokeWidth={0.9} />);
        const frame = 70 * sc;
        if (plan.style === 'shaker' && dw2 > 2 * frame + 4 && dh2 > 2 * frame + 4)
          kids.push(<rect key={`p${j}`} x={cx(d.x0) + frame} y={cy(d.y1) + frame} width={dw2 - 2 * frame} height={dh2 - 2 * frame} className="fill-none stroke-accent/50" strokeWidth={0.8} />);
        // the handle on the opening edge: a pair's meeting edges, a single door's side away from its hinge
        const hx = d.hingeLeft ? cx(d.x1) - 5 : cx(d.x0) + 5;
        const top = d.y0 >= g.boxH - 1;
        const c = top ? d.y0 + Math.min(120, (d.y1 - d.y0) / 2) : Math.min(Math.max(1050 - P, d.y0 + 100), d.y1 - 100);
        const half = top ? Math.min(60, (d.y1 - d.y0) / 3) : 90;
        kids.push(<line key={`h${j}`} x1={hx} y1={cy(c - half)} x2={hx} y2={cy(c + half)} className="stroke-ink/70" strokeWidth={1.6} strokeLinecap="round" />);
      });
      if (L.drawersBelow)
        L.drawers.forEach((d, j) => {
          kids.push(<rect key={`f${j}`} x={cx(d.x0) + 0.8} y={cy(d.y1)} width={Math.max(0, (d.x1 - d.x0) * sc - 1.6)} height={Math.max(0, (d.y1 - d.y0) * sc)} className="fill-accent/10 stroke-accent/70" strokeWidth={0.9} />);
          kids.push(<line key={`fh${j}`} x1={cx(wd / 2 - 60)} y1={cy(d.y1) + 3} x2={cx(wd / 2 + 60)} y2={cy(d.y1) + 3} className="stroke-ink/70" strokeWidth={1.4} strokeLinecap="round" />);
        });
    }
    return (
      <g key={i} data-unit={i}>
        {kids}
        {i === sel && onPick ? <rect x={X(x0)} y={Y(unitTop)} width={wd * sc} height={(unitTop - P) * sc} className="fill-none stroke-accent" strokeWidth={2} /> : null}
        {onPick ? <rect x={X(x0)} y={Y(ceiling)} width={wd * sc} height={dh} fill="transparent" className="cursor-pointer" onClick={() => onPick(i)} /> : null}
        <text x={X(x0 + wd / 2)} y={fy + 17} textAnchor="middle" className="fill-faint font-mono" fontSize={11}>
          {shortNames ? String(i + 1) : `Unit ${i + 1}`}
        </text>
      </g>
    );
  });

  const chain: React.ReactNode[] = [];
  const cyy = MT - 12;
  if (!over && g.fillerL > 0) chain.push(<HDim key="fl" x1={X(0)} x2={X(g.fillerL)} y={cyy} label={String(g.fillerL)} side={g.fillerL * sc < 30 ? 'l' : undefined} />);
  g.pieces.forEach((p, i) => chain.push(<HDim key={`u${i}`} x1={X(startX + p.x)} x2={X(startX + p.x + p.w)} y={cyy} label={String(p.w)} />));
  if (!over && g.fillerR > 0) chain.push(<HDim key="fr" x1={X(wall - g.fillerR)} x2={X(wall)} y={cyy} label={String(g.fillerR)} side={g.fillerR * sc < 30 ? 'r' : undefined} />);

  const right = [
    { y1: fy, y2: Y(P), label: `Plinth ${P}` },
    { y1: Y(P), y2: Y(P + g.boxH), label: g.topH ? `To ${P + g.boxH}` : `Units ${g.boxH}` },
    ...(g.topH ? [{ y1: Y(P + g.boxH), y2: Y(unitTop), label: `Top ${g.topH}` }] : []),
    ...(ceiling > unitTop ? [{ y1: Y(unitTop), y2: MT, label: `Infill ${ceiling - unitTop}` }] : []),
  ];
  const label = `Front of a ${wall} wide wall, ${ceiling} to the ceiling: ${plan.widths.length} made-to-measure units, ${plan.widths.join(', ')} wide, on a ${P} plinth${g.topH ? `, top cupboards ${g.topH} high` : ''}.`;

  return (
    <div ref={box} className="w-full">
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={label} className="block max-w-full" data-pax-drawing data-mto-drawing>
        <Hatch />
        <rect x={X(0)} y={MT} width={dw} height={dh} className="fill-none stroke-line-strong" strokeDasharray="3 3" />
        {!over ? <Strip x={X(0)} y={MT} w={g.fillerL * sc} h={dh} /> : null}
        {!over ? <Strip x={X(wall - g.fillerR)} y={MT} w={g.fillerR * sc} h={dh} /> : null}
        <Strip x={X(startX)} y={MT} w={g.across * sc} h={(ceiling - unitTop) * sc} />
        <rect x={X(startX) + 2} y={Y(P)} width={Math.max(0, g.across * sc - 4)} height={P * sc} className="fill-raised stroke-line-strong" strokeWidth={0.6} />
        {units}
        <line x1={X(0) - 14} y1={fy} x2={X(wall) + 14} y2={fy} className="stroke-ink" strokeWidth={1.2} />
        <HDim x1={X(0)} x2={X(wall)} y={MT - 34} label={`Wall ${wall}`} />
        {chain}
        <VDim x={X(0) - 18} y1={fy} y2={MT} label={`Ceiling ${ceiling}`} flip />
        <RightDims x={X(wall) + 16} parts={right} />
      </svg>
    </div>
  );
}

export function MtoMini({ plan, wall, ceiling }: { plan: MtoPlan; wall: number; ceiling: number }) {
  const g = mtoLayout(plan, wall, ceiling);
  const W = 84;
  const Hh = 56;
  const sc = Math.min((W - 4) / wall, (Hh - 4) / ceiling);
  const ox = (W - wall * sc) / 2;
  const fy = Hh - 2;
  const startX = g.across > wall ? 0 : g.fillerL;
  return (
    <svg width={W} height={Hh} viewBox={`0 0 ${W} ${Hh}`} aria-hidden="true" className="flex-none">
      <rect x={ox} y={fy - ceiling * sc} width={wall * sc} height={ceiling * sc} className="fill-raised stroke-line-strong" strokeWidth={0.6} />
      {g.pieces.map((p, i) =>
        [...p.layout.doors, ...(p.layout.drawersBelow ? p.layout.drawers : [])].map((d, j) => (
          <rect
            key={`${i}-${j}`}
            x={ox + (startX + p.x + d.x0) * sc}
            y={fy - (plan.plinth + d.y1) * sc}
            width={Math.max(0.5, (d.x1 - d.x0) * sc)}
            height={Math.max(0.5, (d.y1 - d.y0) * sc)}
            className="fill-accent/15 stroke-accent"
            strokeWidth={0.6}
          />
        )),
      )}
    </svg>
  );
}

export function mtoCards(plan: MtoPlan, g: MtoLayout, wall: number, ceiling: number, pick: number): [string, string][] {
  const p = g.pieces[pick];
  const door = p?.layout.sizes.door;
  return [
    ['Your wall', `${wall} × ${ceiling}`],
    ['Units across', `${plan.widths.join(' + ')} = ${g.across}`],
    ['Fillers', g.across > wall ? 'Doesn’t fit yet' : g.fillerL === g.fillerR ? `${g.fillerL} each end` : `${g.fillerL} and ${g.fillerR}`],
    ['Plinth and units', `${plan.plinth} + ${g.boxH} high · ${MTO.depth} deep`],
    g.topH ? ['Top cupboards', `${g.topH} high, from ${PLAN.hatShelf}`] : ['Top infill', `${ceiling - plan.plinth - g.boxH} to the ceiling`],
    [`Unit ${pick + 1}`, door && door.n ? `${p.w} wide · ${door.n} ${door.n === 1 ? 'door' : 'doors'} ${Math.round(door.w)} × ${Math.round(door.h)}` : `${p?.w ?? 0} wide`],
  ];
}

/* ---------- the steps ---------- */

export function MtoSteps({
  now,
  g,
  wall,
  ceiling,
  pick,
  setSel,
  change,
  showInside,
  uses,
  onInsidePicked,
}: {
  now: MtoPlan;
  g: MtoLayout;
  wall: number;
  ceiling: number;
  pick: number;
  setSel: (i: number) => void;
  change: (fn: (p: MtoPlan) => MtoPlan) => void;
  showInside: () => void;
  uses: string[];
  onInsidePicked: (k: InsideKey) => void;
}) {
  const roomLeft = wall - g.across; // what's left for the fillers
  const range = equalRange(wall);
  const door = g.pieces[0]?.layout.sizes.door;
  const pickedW = now.widths[pick] ?? 0;
  const fitsWidth = (w: number) => g.across - pickedW + w + 2 * MTO.scribeMin <= wall;
  const addable = MTO.widths.filter((w) => g.across + w + 2 * MTO.scribeMin <= wall);
  const addW = addable.length ? addable.filter((w) => w <= 900).pop() ?? addable[0] : 0;
  const insideKey = now.inside[pick];
  return (
    <div>
      <Step n={1} title="Height" hint={`ceiling ${ceiling}`}>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Pick on={!g.topH} onClick={() => change((p) => ({ ...p, top: false }))} title="Tall doors" sub={`One row of doors${door && !g.topH ? `, ${Math.round(door.h)} high` : ''}, up to the top infill`} testId="m-tall" />
          <Pick on={!!g.topH} disabled={!g.topOk} onClick={() => change((p) => ({ ...p, top: true }))} title="Top cupboards too" sub={g.topOk ? `Doors to ${PLAN.hatShelf}, cupboards above, ${ceiling - now.infill - PLAN.hatShelf} high` : `Needs about ${PLAN.hatShelf + 250 + now.infill} to the ceiling`} testId="m-top" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[12px] text-faint">Plinth</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {MTO.plinths.map((v) => (
                <Pick key={v} on={now.plinth === v} onClick={() => change((p) => ({ ...p, plinth: v }))} title={String(v)} testId={`m-plinth-${v}`} />
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[12px] text-faint">Top infill, scribed to the ceiling</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {MTO.infills.map((v) => (
                <Pick key={v} on={now.infill === v} onClick={() => change((p) => ({ ...p, infill: v }))} title={String(v)} testId={`m-infill-${v}`} />
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-faint">The plinth is the kick board along the floor, set back under the doors.</p>
      </Step>

      <Step n={2} title="Units, left to right" hint="tap one to change it">
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Unit sizes">
          <Pick on={now.mode === 'standard'} onClick={() => change((p) => ({ ...p, mode: 'standard', auto: true }))} title="Standard sizes" testId="m-mode-standard" />
          <Pick on={now.mode === 'custom'} onClick={() => change((p) => ({ ...p, mode: 'custom', auto: false }))} title="Custom" testId="m-mode-custom" />
          <Pick on={now.mode === 'equal'} onClick={() => change((p) => ({ ...p, mode: 'equal', count: Math.min(range.max, Math.max(range.min, p.widths.length)) }))} title="Equal split" testId="m-mode-equal" />
        </div>
        {now.mode === 'equal' ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[12px] text-faint">Number of units</span>
            <button type="button" data-pax="m-less" disabled={now.widths.length <= range.min} onClick={() => change((p) => ({ ...p, count: p.widths.length - 1 }))} className="btn btn-ghost btn-sm w-11 disabled:opacity-40" aria-label="One unit fewer">−</button>
            <span className="min-w-6 text-center text-[17px] font-medium text-ink" data-pax="m-count">{now.widths.length}</span>
            <button type="button" data-pax="m-more" disabled={now.widths.length >= range.max} onClick={() => change((p) => ({ ...p, count: p.widths.length + 1 }))} className="btn btn-ghost btn-sm w-11 disabled:opacity-40" aria-label="One unit more">+</button>
            <span className="text-[13px] text-muted">each about {Math.round(now.widths[0] ?? 0)} wide, {MTO.equalFiller} at each wall</span>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Your units">
          {now.widths.map((w, i) => (
            <Pick key={i} on={i === pick} onClick={() => setSel(i)} title={`${i + 1} · ${w}`} testId={`m-unit-${i}`} />
          ))}
        </div>
        {now.mode === 'standard' ? (
          <>
            <p className="mt-3 font-mono text-[12px] text-faint">Unit {pick + 1} width</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {MTO.widths.map((w) => (
                <Pick key={w} on={pickedW === w} disabled={pickedW !== w && !fitsWidth(w)} onClick={() => change((p) => ({ ...p, auto: false, widths: p.widths.map((x, k) => (k === pick ? w : x)) }))} title={String(w)} testId={`m-w-${w}`} />
              ))}
            </div>
          </>
        ) : null}
        {now.mode === 'custom' ? (
          <label className="mt-3 block max-w-[220px]">
            <span className="font-mono text-[12px] text-faint">Unit {pick + 1} width, mm ({MTO.min} to {MTO.max})</span>
            <input
              key={`w${pick}`}
              data-pax="m-width"
              className={`${numBox} mt-1`}
              inputMode="numeric"
              defaultValue={pickedW}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10);
                if (v >= MTO.min && v <= MTO.max) change((p) => ({ ...p, widths: p.widths.map((x, k) => (k === pick ? v : x)) }));
              }}
            />
          </label>
        ) : null}
        {now.mode !== 'equal' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {addW ? (
              <button type="button" data-pax="m-add" onClick={() => { change((p) => ({ ...p, auto: false, widths: [...p.widths, addW] })); setSel(now.widths.length); }} className="btn btn-ghost btn-sm">
                + Add a unit
              </button>
            ) : null}
            {now.widths.length > 1 ? (
              <button type="button" data-pax="m-remove" onClick={() => { change((p) => ({ ...p, auto: false, widths: p.widths.filter((_, j) => j !== pick), inside: p.inside.filter((_, j) => j !== pick), below: p.below.filter((_, j) => j !== pick) })); setSel(Math.max(0, pick - 1)); }} className="btn btn-ghost btn-sm">
                Remove unit {pick + 1}
              </button>
            ) : null}
            {now.mode === 'standard' && !now.auto ? (
              <button type="button" data-pax="m-fill" onClick={() => { change((p) => ({ ...p, auto: true })); setSel(0); }} className="btn btn-ghost btn-sm">
                Fill my wall
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="mt-2 text-[13px] leading-snug text-faint">
          {roomLeft >= 0 ? `${roomLeft} mm left for the fillers at the walls (${MTO.scribeMin} to ${MTO.scribeMax} each is usual).` : `${-roomLeft} mm too wide for the wall.`}
        </p>
      </Step>

      <Step n={3} title="Doors" hint="made to measure">
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Pick on={now.style === 'flat'} onClick={() => change((p) => ({ ...p, style: 'flat' }))} title="Flat" sub="Plain, smooth fronts" testId="m-flat" />
          <Pick on={now.style === 'shaker'} onClick={() => change((p) => ({ ...p, style: 'shaker' }))} title="Shaker" sub="A 70 mm frame round one panel" testId="m-shaker" />
        </div>
        <p className="mt-2 text-[13px] leading-snug text-faint">
          {g.doors} doors in MDF, ready for your decorator: one door up to 600 wide, a pair above. Sliding doors?{' '}
          <a href="/wardrobe-planner" target="_blank" rel="noopener" className="font-medium text-accent underline-offset-2 hover:underline">Plan them in the 3D planner</a>.
        </p>
      </Step>

      <Step n={4} title={`Inside unit ${pick + 1}`} hint={`${pickedW} wide`}>
        <SuggestNote uses={uses} picked={now.picked} />
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Inside unit ${pick + 1}`}>
          {INS.map((o) => (
            <Pick
              key={o.key}
              on={insideKey === o.key}
              onClick={() => {
                change((p) => ({ ...p, picked: true, inside: p.inside.map((v, j) => (j === pick ? o.key : v)) }));
                onInsidePicked(o.key);
                showInside();
              }}
              title={o.label}
              testId={`m-in-${o.key}`}
            />
          ))}
        </div>
        {hasDrawers(insideKey) ? (
          <div className="mt-3">
            <p className="font-mono text-[12px] text-faint">Drawers go</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Pick on={!now.below[pick]} onClick={() => change((p) => ({ ...p, below: p.below.map((v, j) => (j === pick ? false : v)) }))} title="Behind the doors" testId="m-behind" />
              <Pick on={!!now.below[pick]} onClick={() => change((p) => ({ ...p, below: p.below.map((v, j) => (j === pick ? true : v)) }))} title="Below the doors" sub="Their own fronts" testId="m-below" />
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-[13px] leading-snug text-faint">
          {g.pieces[pick]?.layout.problems[0] && insideKey !== 'unsure' ? <span className="font-medium text-accent">{g.pieces[pick].layout.problems[0]} </span> : null}
          Tap a unit in the drawing to pick its inside.{' '}
          {now.widths.length > 1 ? (
            <button type="button" data-pax="m-same-inside" onClick={() => change((p) => ({ ...p, picked: true, inside: p.widths.map(() => p.inside[pick]), below: p.widths.map(() => p.below[pick]) }))} className="font-medium text-accent underline-offset-2 hover:underline">
              Same in every unit
            </button>
          ) : null}
        </p>
      </Step>
    </div>
  );
}
