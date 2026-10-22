'use client';
/* IKEA PAX in the brief's wardrobe planner (wardrobe-window.tsx): the drawing with every size, the small drawing
   for the card, the size cards and the steps. Raf, 22 Oct 2026: people choosing IKEA PAX don't know what they want,
   so they see the units in their space, which doors go below and on the top boxes, and what goes inside.
   Sums in src/lib/pax-brief.ts. Nothing here is saved anywhere. */
import {
  INSIDES,
  PAX,
  doorsOf,
  frameName,
  layout,
  mdfDoors,
  startsOf,
  type Frame,
  type Inside,
  type PaxLayout,
  type PaxPlan,
} from '@/lib/pax-brief';
import { HDim, Hatch, MB, ML, MR, MT, Pick, Step, Strip, SuggestNote, VDim, useBoxWidth } from './plan-parts';

/* ---------- the drawing ---------- */

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
  else if (k === 'drawshelves') { [0, 1, 2].forEach((j) => box(60 + j * 190, 60 + (j + 1) * 190, `d${j}`)); shelf(650, 'dust'); [1000, 1350, 1700].forEach((m) => shelf(m, `s${m}`)); }
  else if (k === 'baskets') { shelf(top, 's'); rail(top - 60, 'r'); box(60, 220, 'b1', true); box(220, 380, 'b2', true); box(380, 560, 'd'); shelf(580, 'dust'); }
  else if (k === 'shelves') { const n = 6; for (let i = 1; i <= n; i++) shelf(Math.round((f * i) / (n + 1)), `s${i}`); }
  else if (k === 'shoes') { const n = 8; for (let i = 1; i <= n; i++) shelf(Math.round((f * i) / (n + 1)), `s${i}`); }
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
  const { box, w } = useBoxWidth();
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
        <Hatch />
        <rect x={X(0)} y={MT} width={dw} height={dh} className="fill-none stroke-line-strong" strokeDasharray="3 3" />
        {fits ? <Strip x={X(0)} y={MT} w={g.fillerL * sc} h={dh} /> : null}
        {fits ? <Strip x={X(wall - g.fillerR)} y={MT} w={g.fillerR * sc} h={dh} /> : null}
        {g.top === 'infill' ? <Strip x={X(startX)} y={MT} w={g.across * sc} h={g.above * sc} /> : null}
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

/* A small front view for the card under 01. */
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

export function paxCards(now: PaxPlan, g: PaxLayout, wall: number, ceiling: number, pick: number): [string, string][] {
  const unitW = PAX.real[now.units[pick]];
  return [
    ['Your wall', `${wall} × ${ceiling}`],
    ['Units across', `${now.units.map((f) => PAX.real[f]).join(' + ')} = ${g.across}`],
    ['Fillers', g.problem ? 'Doesn’t fit yet' : g.fillerL === g.fillerR ? `${g.fillerL} each end` : `${g.fillerL} and ${g.fillerR}`],
    ['PAX frames', `${g.frameH} high · ${PAX.depth} deep`],
    g.top === 'box' ? ['Top boxes', `${g.above} high, MDF`] : g.top === 'infill' ? ['Infill strip', `${g.above} to the ceiling`] : ['Above', 'Nothing'],
    [`Unit ${pick + 1}`, `${unitW} wide · ${g.top === 'box' ? `${g.frameH} + ${g.above}` : g.frameH} high`],
  ];
}

/* ---------- the steps ---------- */

export function PaxSteps({
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
  now: PaxPlan;
  g: PaxLayout;
  wall: number;
  ceiling: number;
  pick: number;
  setSel: (i: number) => void;
  change: (fn: (p: PaxPlan) => PaxPlan) => void;
  showInside: () => void;
  uses: string[];
  onInsidePicked: (k: Inside) => void;
}) {
  const roomFor = (f: Frame) => now.units.length < PAX.maxUnits && g.across + PAX.real[f] + 2 * PAX.minFiller <= wall;
  const a1 = ceiling - PAX.short;
  const a2 = ceiling - PAX.tall;
  const topWords = (a: number) => (a >= PAX.topBoxFrom ? `+ MDF top boxes ${a} high, made to measure` : a > 0 ? `+ an infill strip ${a} to the ceiling` : 'right up to the ceiling');
  const has75 = now.units.includes(750);
  return (
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
              <button key={f} type="button" data-pax={`add-${f}`} onClick={() => { change((p) => ({ ...p, auto: false, units: [...p.units, f] })); setSel(now.units.length); }} className="btn btn-ghost btn-sm">
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
          {([1000, 750, 500] as Frame[])
            .filter((f) => f !== now.units[pick])
            .map((f, j) => (
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
        <SuggestNote uses={uses} picked={!!now.picked} />
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Inside unit ${pick + 1}`}>
          {INSIDES.map((o) => (
            <Pick
              key={o.key}
              on={now.inside[pick] === o.key}
              onClick={() => {
                change((p) => ({ ...p, picked: true, inside: p.inside.map((v, j) => (j === pick ? o.key : v)) }));
                onInsidePicked(o.key);
                showInside();
              }}
              title={o.label}
              testId={`in-${o.key}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[13px] leading-snug text-faint">
          Tap a unit in the drawing to pick its inside.{' '}
          {now.units.length > 1 ? (
            <button type="button" data-pax="same-inside" onClick={() => change((p) => ({ ...p, picked: true, inside: p.units.map(() => p.inside[pick]) }))} className="font-medium text-accent underline-offset-2 hover:underline">
              Same in every unit
            </button>
          ) : null}
        </p>
      </Step>
    </div>
  );
}
