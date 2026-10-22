/* The fitted wardrobe in Plan your project's brief (22 Oct 2026, Raf: one button, Fitted wardrobe, with the way it's
   built inside: made to measure or IKEA PAX built in). This file holds what both share (the insides, and the
   suggestion from "What is it for?") and the made-to-measure sums. The made-to-measure units are CabinetOS units laid
   out by src/lib/cabinetos-wardrobe.ts, the same rules as the 3D planner, so what the customer draws is what Raf cuts.
   Relative imports only, so the sums run in tests with tsx. The PAX sums are in ./pax-brief.ts. */
import { COS, PLAN, insideText, planPieces, presetInside, runFor, type Inside as CosInside, type Piece } from './cabinetos-wardrobe';

/* ---------- insides, both ways of building ---------- */

export type InsideKey = 'long' | 'double' | 'short' | 'drawers' | 'drawshelves' | 'baskets' | 'shelves' | 'shoes' | 'unsure';

export const INSIDE_CHOICES: { key: InsideKey; label: string; words: string; pax: boolean; mto: boolean }[] = [
  { key: 'long', label: 'Long hanging', words: 'long hanging', pax: true, mto: true },
  { key: 'double', label: 'Two rails', words: 'two hanging rails', pax: true, mto: true },
  { key: 'short', label: 'Short hanging + shelves', words: 'short hanging + shelves', pax: true, mto: true },
  { key: 'drawers', label: 'Drawers + short hanging', words: 'drawers + short hanging', pax: true, mto: true },
  { key: 'drawshelves', label: 'Drawers + shelves', words: 'drawers + shelves', pax: true, mto: true },
  { key: 'baskets', label: 'Baskets, drawer + hanging', words: 'baskets, a drawer + short hanging', pax: true, mto: false },
  { key: 'shelves', label: 'Shelves all the way', words: 'shelves all the way', pax: true, mto: true },
  { key: 'shoes', label: 'Shoe shelves', words: 'shoe shelves', pax: true, mto: true },
  { key: 'unsure', label: 'Not sure yet', words: 'not sure yet', pax: true, mto: true },
];
export const insideWords = (k: InsideKey) => INSIDE_CHOICES.find((x) => x.key === k)?.words ?? 'not sure yet';
export const hangs = (k: InsideKey) => k === 'long' || k === 'double' || k === 'short' || k === 'drawers' || k === 'baskets';

/* What they ticked in 03 "What is it for?", by the choice's words, so Raf can reword the chips in TinaCMS. */
export function wanted(uses: string[]) {
  const all = uses.join(' | ');
  return { hang: /hang/i.test(all), fold: /fold/i.test(all), shoes: /shoe/i.test(all) };
}
export const suggests = (uses: string[]) => {
  const w = wanted(uses);
  return w.hang || w.fold || w.shoes;
};

/* The starting insides, unit by unit, from what it's for. Hanging clothes: long hanging, then short hanging with
   shelves, then two rails; with folded clothes too, drawers under short hanging in the second unit; folded only:
   drawers with shelves, then shelves; shoes: one unit of shoe shelves (the narrowest) when there's more than one.
   A unit too narrow to hang clothes across gets shelves. Nothing ticked: long, short, drawers, as before. */
export function suggestInsides(uses: string[], widths: number[]): InsideKey[] {
  const w = wanted(uses);
  const cycle: InsideKey[] =
    w.hang && w.fold ? ['long', 'drawers', 'short'] : w.hang ? ['long', 'short', 'double'] : w.fold ? ['drawshelves', 'shelves'] : w.shoes ? ['shoes', 'shelves'] : ['long', 'short', 'drawers'];
  const out: InsideKey[] = widths.map((wd, i) => {
    const k = cycle[i % cycle.length];
    return wd < PLAN.minHangWidth + 50 && hangs(k) ? 'shelves' : k;
  });
  if (w.shoes && (w.hang || w.fold) && widths.length > 1) {
    let j = widths.length - 1;
    widths.forEach((wd, i) => {
      if (wd < widths[j]) j = i;
    });
    out[j] = 'shoes';
  }
  return out;
}

/* Which "What is it for?" choices an inside means, so picking one ticks them (by their words). */
export function usesFor(k: InsideKey): RegExp[] {
  const out: RegExp[] = [];
  if (hangs(k)) out.push(/hang/i);
  if (k === 'drawers' || k === 'drawshelves' || k === 'shelves' || k === 'baskets') out.push(/fold/i);
  if (k === 'shoes') out.push(/shoe/i);
  return out;
}

/* ---------- made to measure ---------- */

export type MtoPlan = {
  mode: 'standard' | 'custom' | 'equal';
  auto: boolean; // standard sizes picked by Fill my wall, following the wall
  widths: number[];
  count: number; // equal split
  plinth: number;
  infill: number;
  top: boolean; // top cupboards from 2000
  style: 'flat' | 'shaker';
  inside: InsideKey[];
  below: boolean[]; // drawers below the doors instead of behind them
  picked: boolean; // insides chosen by the customer (else they follow "What is it for?")
};

export const MTO = {
  widths: [300, 400, 450, 500, 600, 800, 900, 1000], // the 3D planner's standard carcass widths
  min: 150,
  max: 1200,
  scribeMin: 20, // filler at a wall, each end (the 3D planner's Auto side infill)
  scribeMax: 100,
  equalFiller: 50, // equal split: the units share what's left inside 50 at each wall
  plinths: [70, 100, 150],
  infills: [50, 100, 150],
  depth: 600,
  maxUnits: 12,
  lowest: 1500,
};

/* Fill my wall with standard sizes (the 3D planner's autoFill, walls both sides): the fewest, most even units that
   leave 20 to 100 mm at each wall, at most two sizes, close to 850 wide. Nothing fits that way: equal units. */
export function fillStandard(wall: number): { widths: number[]; standard: boolean } {
  const W = MTO.widths;
  let best: { sc: number; n: number; w1: number; w2: number; k: number } | null = null;
  for (let n = 1; n <= MTO.maxUnits; n++)
    for (const w1 of W)
      for (const w2 of W) {
        if (w2 > w1) continue;
        for (let k = 1; k <= n; k++) {
          if (w1 === w2 && k !== n) continue;
          const tot = k * w1 + (n - k) * w2;
          const f = (wall - tot) / 2;
          if (f < MTO.scribeMin || f > MTO.scribeMax) continue;
          const mixed = w1 !== w2 && k < n;
          const sc = f * 0.5 + (mixed ? 45 : 0) + Math.abs(tot / n - 850) * 0.06 + (w2 < 450 ? 70 : 0) + n * 6;
          if (!best || sc < best.sc) best = { sc, n, w1, w2, k };
        }
      }
  if (!best) {
    const n = Math.max(1, Math.round(wall / 900));
    return { widths: equalWidths(wall, n), standard: false };
  }
  const big = Array(best.k).fill(best.w1);
  const small = Array(best.n - best.k).fill(best.w2);
  if (!small.length) return { widths: big, standard: true };
  const h = Math.ceil(big.length / 2);
  return { widths: [...big.slice(0, h), ...small, ...big.slice(h)], standard: true };
}

/* Equal split: the units share the wall less 50 at each end, the odd mm one each to the first units. */
export function equalWidths(wall: number, n: number): number[] {
  const A = Math.max(0, wall - 2 * MTO.equalFiller);
  const base = Math.floor(A / n);
  const extra = A - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}
export function equalRange(wall: number) {
  const A = Math.max(0, wall - 2 * MTO.equalFiller);
  return { min: Math.max(1, Math.ceil(A / MTO.max)), max: Math.max(1, Math.min(MTO.maxUnits, Math.floor(A / MTO.min))) };
}

export function newMto(wall: number): MtoPlan {
  const f = fillStandard(wall);
  return { mode: f.standard ? 'standard' : 'equal', auto: true, widths: f.widths, count: f.widths.length, plinth: 100, infill: 50, top: false, style: 'flat', inside: [], below: [], picked: false };
}

/* The plan as it stands for this wall and what it's for: widths worked out (auto, equal), insides suggested
   until they pick their own. */
export function mtoResolved(plan: MtoPlan, wall: number, uses: string[]): MtoPlan {
  let widths = plan.widths;
  if (plan.mode === 'equal') {
    const r = equalRange(wall);
    widths = equalWidths(wall, Math.min(r.max, Math.max(r.min, plan.count)));
  } else if (plan.mode === 'standard' && plan.auto) widths = fillStandard(wall).widths;
  const sug = suggestInsides(uses, widths);
  const inside = widths.map((_, i) => (plan.picked ? plan.inside[i] ?? sug[i] : sug[i]));
  const below = widths.map((_, i) => plan.below[i] ?? false);
  return { ...plan, widths, count: widths.length, inside, below };
}

export function cosInside(k: InsideKey, below: boolean): CosInside {
  switch (k) {
    case 'long':
      return presetInside('long');
    case 'double':
      return presetInside('double');
    case 'short':
      return presetInside('short');
    case 'drawers':
      return { ...presetInside('drawhang'), below };
    case 'drawshelves':
      return { ...presetInside('drawers'), below };
    case 'shelves':
      return presetInside('shelves');
    case 'shoes':
      return { rail: 'none', shelves: 7, drawers: 0, below: false };
    default:
      return { rail: 'none', shelves: 0, drawers: 0, below: false };
  }
}
export const hasDrawers = (k: InsideKey) => k === 'drawers' || k === 'drawshelves';

export type MtoLayout = {
  across: number;
  fillerL: number;
  fillerR: number;
  boxH: number; // the carcass from the plinth up (the base box with top cupboards)
  topH: number; // the top cupboards, 0 without
  topOk: boolean; // top cupboards fit under this ceiling
  zone: number; // where the units end, from the floor (under the infill)
  pieces: Piece[];
  doors: number;
  problem: string;
  warn: string;
};

export function mtoLayout(plan: MtoPlan, wall: number, ceiling: number): MtoLayout {
  const run = runFor({ ceiling, plinth: plan.plinth, infill: plan.infill, free: false, freeH: 0, topCupboards: plan.top, topSplit: PLAN.hatShelf, depth: MTO.depth, sliding: false });
  const topOk = ceiling - plan.infill - PLAN.hatShelf >= 250;
  const pieces = planPieces(
    plan.widths.map((w, i) => ({ w, inside: cosInside(plan.inside[i] ?? 'unsure', plan.below[i] ?? false) })),
    run,
  );
  const across = plan.widths.reduce((n, w) => n + w, 0);
  const left = wall - across;
  const fillerL = Math.floor(left / 2);
  const fillerR = left - fillerL;
  let problem = '';
  let warn = '';
  if (!plan.widths.length) problem = 'Add a unit.';
  else if (left < 0) problem = `The units are ${-left} mm wider than the wall: take one off or make one narrower.`;
  else if (plan.mode !== 'equal' && fillerL < MTO.scribeMin) problem = `Only ${left} mm left for fillers: I need about ${2 * MTO.scribeMin} to scribe to the walls. Make a unit narrower.`;
  else if (plan.mode !== 'equal' && fillerL > MTO.scribeMax) warn = `${fillerL} mm of filler at each end is a lot. Fill my wall or Equal split fits it.`;
  if (!problem) {
    const bad = pieces.find((p) => p.layout.problems.length && plan.inside[p.section] !== 'unsure');
    if (bad) problem = `Unit ${bad.section + 1}: ${bad.layout.problems[0]}`;
  }
  const doors = pieces.reduce((n, p) => n + p.layout.doors.length, 0);
  return { across, fillerL, fillerR, boxH: run.boxH, topH: run.topH ?? 0, topOk, zone: run.top, pieces, doors, problem, warn };
}

export function mtoSpaceProblem(wall: number, ceiling: number): string {
  if (!wall || !ceiling) return 'Type the wall width and the ceiling height to see it drawn.';
  if (wall < 300) return 'A wall under 300 mm is too narrow for a wardrobe.';
  if (wall > 9000) return 'Over 9 metres? Check the width, or tell me about it in the message.';
  if (ceiling > 4000) return 'Check the ceiling height: it should be in millimetres, like 2400.';
  if (ceiling < MTO.lowest) return `At ${ceiling} the ceiling is very low for a wardrobe. Tell me about it in the message.`;
  return '';
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function mtoLines(plan: MtoPlan, wall: number, ceiling: number): string[] {
  const g = mtoLayout(plan, wall, ceiling);
  if (!plan.widths.length) return [];
  const how = plan.mode === 'standard' ? 'standard sizes' : plan.mode === 'equal' ? 'equal split' : 'custom sizes';
  const fill = g.problem && g.fillerL < 0 ? '' : `, fillers about ${g.fillerL}${g.fillerR !== g.fillerL ? ` and ${g.fillerR}` : ''} at the ends`;
  const door = g.pieces[0]?.layout.sizes.door;
  const height = g.topH
    ? `plinth ${plan.plinth}, doors to ${PLAN.hatShelf}, top cupboards ${g.topH} high, top infill ${plan.infill}`
    : `plinth ${plan.plinth}, doors ${door ? Math.round(door.h) : g.boxH} high, top infill ${plan.infill}`;
  const below = g.pieces.filter((p) => p.layout.drawersBelow).map((p) => p.section + 1);
  const doors = `${g.doors} ${plan.style === 'shaker' ? 'shaker' : 'flat'} doors, made to measure (one up to 600 wide, a pair above)${below.length ? `, drawers below the doors on unit ${below.join(' and ')}` : ''}. MDF, ready for my decorator`;
  const inside = g.pieces
    .map((p) => {
      const k = plan.inside[p.section];
      return `${p.section + 1}: ${k === 'unsure' || k === 'shoes' ? insideWords(k) : lower(insideText(p.inside, p.layout))}`;
    })
    .join('; ');
  return [
    'My wardrobe plan (made to measure):',
    `Space: ${wall} wide, ${ceiling} to the ceiling`,
    `Units: ${plan.widths.join(' + ')} = ${g.across} mm (${how})${fill}`,
    `Height: ${height}`,
    `Doors: ${doors}`,
    `Inside: ${inside}`,
    ...(g.problem ? [`Check: ${g.problem}`] : []),
  ];
}

export function mtoSummary(plan: MtoPlan, wall: number, ceiling: number): string {
  const g = mtoLayout(plan, wall, ceiling);
  return `${plan.widths.length} ${plan.widths.length === 1 ? 'unit' : 'units'}: ${plan.widths.join(' + ')} · ${g.topH ? 'top cupboards' : 'tall doors'} · ${plan.style === 'shaker' ? 'shaker' : 'flat'} doors`;
}

export { COS, PLAN };
