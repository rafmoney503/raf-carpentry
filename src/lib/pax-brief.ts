/* The "Plan your PAX" window in Plan your project's brief (src/app/how-it-works/pax-planner.tsx).
   No imports, so the sums can be tested on their own. Same PAX rules as the Job Kit's wardrobe planner
   (src/lib/wardrobe.ts): frames sold as 100, 75 and 50 cm are really 998, 748 and 498 wide; 2010 high with an
   MDF top box above, or 2364 high; under 300 mm above the frames is an infill strip; what's left of the wall
   is filler, split between the two ends (at least 20 a side for scribing). IKEA sells no hinged doors for the
   75 frame (it's meant for sliding doors), so a 75 unit always gets MDF doors. The insides and their suggestion from
   "What is it for?" are shared with made to measure (./wardrobe-brief.ts). */
import { INSIDE_CHOICES, insideWords, suggestInsides, type InsideKey } from './wardrobe-brief';

export type Frame = 1000 | 750 | 500;
export type Inside = InsideKey;
export type PaxPlan = {
  height: 'short' | 'tall';
  units: Frame[];
  inside: Inside[];
  doors: 'ikea' | 'mdf';
  auto: boolean; // units follow the wall width until they're changed by hand
  picked?: boolean; // insides chosen by the customer (else they follow "What is it for?")
};

export const PAX = {
  real: { 1000: 998, 750: 748, 500: 498 } as Record<Frame, number>,
  short: 2010,
  tall: 2364,
  depth: 580,
  minFiller: 20, // each end, to scribe to the wall
  topBoxFrom: 300,
  tallNeeds: 2380, // a 2364 frame is only offered with a little room over it
  lowest: 2030, // lower than this, a PAX frame won't go in
  minWall: 540,
  maxWall: 9000,
  maxCeiling: 4000,
  maxUnits: 9,
};

export const INSIDES = INSIDE_CHOICES.filter((x) => x.pax);

export const frameName = (f: Frame) => `PAX ${f / 10}`;
/* Where each unit starts, in mm from the left wall. */
export const startsOf = (units: Frame[], from: number) => units.map((_, i) => from + units.slice(0, i).reduce((n, f) => n + PAX.real[f], 0));
export const doorsOf = (f: Frame) => (f === 500 ? 1 : 2);
export const mdfDoors = (plan: PaxPlan, f: Frame) => plan.doors === 'mdf' || f === 750;
export const num = (s: string) => {
  const n = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

/* The wall and ceiling are usable once both are typed and believable. */
export function spaceProblem(wall: number, ceiling: number): string {
  if (!wall || !ceiling) return 'Type the wall width and the ceiling height to see it drawn.';
  if (wall < PAX.minWall) return `A wall under ${PAX.minWall} mm is too narrow for a PAX frame.`;
  if (wall > PAX.maxWall) return `Over ${PAX.maxWall / 1000} metres? Check the width, or tell me about it in the message.`;
  if (ceiling > PAX.maxCeiling) return 'Check the ceiling height: it should be in millimetres, like 2400.';
  if (ceiling < PAX.lowest) return `At ${ceiling} the ceiling is lower than a PAX frame (2010). I’d make it to measure instead: pick Made to measure at the top.`;
  return '';
}

/* The frames that leave the least filler (at least 20 an end). Ties go to fewer 75s (IKEA has no hinged doors
   for them), then fewer units. 100s on the left, then the 75, then the 50s. A 2400 wall: 100 + 75 + 50, 78 a side. */
export function fillWall(wall: number): Frame[] {
  const avail = wall - 2 * PAX.minFiller;
  let best: { a: number; b: number; c: number; left: number } | null = null;
  for (let a = 0; a <= PAX.maxUnits; a++)
    for (let b = 0; b <= 2; b++)
      for (let c = 0; c <= 4; c++) {
        const n = a + b + c;
        if (!n || n > PAX.maxUnits) continue;
        const used = a * PAX.real[1000] + b * PAX.real[750] + c * PAX.real[500];
        if (used > avail) continue;
        const left = avail - used;
        const better =
          !best ||
          left < best.left ||
          (left === best.left && (b < best.b || (b === best.b && n < best.a + best.b + best.c)));
        if (better) best = { a, b, c, left };
      }
  if (!best) return [];
  return [...Array(best.a).fill(1000), ...Array(best.b).fill(750), ...Array(best.c).fill(500)] as Frame[];
}

export function newPlan(wall: number): PaxPlan {
  const units = fillWall(wall);
  return { height: 'short', units, inside: [], doors: 'ikea', auto: true, picked: false };
}

/* While the units are on auto they follow the wall: worked out here rather than stored, so changing the width
   anywhere (the window or the brief's Rough size) moves them. Insides stay with their place in the row. */
export function resolved(plan: PaxPlan, wall: number, uses: string[] = []): PaxPlan {
  const units = plan.auto ? fillWall(wall) : plan.units;
  const sug = suggestInsides(uses, units.map((f) => PAX.real[f]));
  return { ...plan, units, inside: units.map((_, i) => (plan.picked ? plan.inside[i] ?? sug[i] : sug[i])) };
}

export type PaxLayout = {
  frameH: number;
  above: number;
  top: 'box' | 'infill' | 'none';
  across: number; // the frames added up, real widths
  filler: number; // each end
  fillerL: number;
  fillerR: number;
  tallOk: boolean;
  problem: string; // empty when it all fits
  warn: string; // fits, but worth a word
};

export function layout(plan: PaxPlan, wall: number, ceiling: number): PaxLayout {
  const tallOk = ceiling >= PAX.tallNeeds;
  const frameH = plan.height === 'tall' && tallOk ? PAX.tall : PAX.short;
  const above = ceiling - frameH;
  const top = above >= PAX.topBoxFrom ? 'box' : above > 0 ? 'infill' : 'none';
  const across = plan.units.reduce((n, f) => n + PAX.real[f], 0);
  const left = wall - across;
  const fillerL = Math.floor(left / 2);
  const fillerR = left - fillerL;
  let problem = '';
  let warn = '';
  if (!plan.units.length) problem = 'Add a unit.';
  else if (left < 0) problem = `The units are ${-left} mm wider than the wall: take one off or make one smaller.`;
  else if (left < 2 * PAX.minFiller) problem = `Only ${left} mm left for fillers: I need about ${2 * PAX.minFiller} to scribe to the walls. Make one unit smaller.`;
  else if (left - 2 * PAX.minFiller >= PAX.real[500]) warn = `There’s room for another unit (${left} mm left): add one, or tap Fill my wall.`;
  else if (fillerL > 150) warn = `${fillerL} mm of filler at each end is a lot to fill. Try swapping a unit for a bigger one.`;
  return { frameH, above, top, across, filler: left / 2, fillerL, fillerR, tallOk, problem, warn };
}

/* What it adds to the message, as the customer would say it. */
export function paxLines(plan: PaxPlan, wall: number, ceiling: number): string[] {
  const g = layout(plan, wall, ceiling);
  if (!plan.units.length) return [];
  const names = plan.units.map((f) => f / 10).join(' + ');
  const widths = plan.units.map((f) => PAX.real[f]).join(' + ');
  const fill = g.problem ? '' : `, fillers about ${g.fillerL}${g.fillerR !== g.fillerL ? ` and ${g.fillerR}` : ''} at the ends`;
  const above = g.top === 'box' ? `, MDF top boxes ${g.above} high` : g.top === 'infill' ? `, infill strip ${g.above}` : '';
  const anyIkea = plan.units.some((f) => !mdfDoors(plan, f));
  const anyMdf = plan.units.some((f) => mdfDoors(plan, f));
  const box = g.top === 'box';
  const made = [anyIkea && anyMdf ? 'the 75 frame' : '', box ? 'the top boxes' : ''].filter(Boolean).join(' and ');
  const doors =
    (anyIkea ? `IKEA below (I’ll buy them)${made ? `, made to measure on ${made}` : ''}` : `made to measure below${box ? ' and on the top boxes' : ''}`) +
    (anyMdf || box ? '. MDF, ready for my decorator' : '');
  const inside = plan.units.map((_, i) => `${i + 1}: ${insideWords(plan.inside[i])}`).join('; ');
  return [
    'My IKEA PAX plan:',
    `Space: ${wall} wide, ${ceiling} to the ceiling`,
    `Units: PAX ${names} (${widths} = ${g.across} mm)${fill}`,
    `Height: frames ${g.frameH} high${above}`,
    `Doors: ${doors}`,
    `Inside: ${inside}`,
    ...(g.problem ? [`Check: ${g.problem}`] : []),
  ];
}

/* One line for the card under Material once a plan is made. */
export function paxSummary(plan: PaxPlan, wall: number, ceiling: number): string {
  const g = layout(plan, wall, ceiling);
  const top = g.top === 'box' ? ` + ${g.above} MDF top boxes` : g.top === 'infill' ? ` + ${g.above} infill` : '';
  const doors = plan.units.every((f) => mdfDoors(plan, f)) ? 'MDF doors' : 'IKEA doors';
  return `PAX ${plan.units.map((f) => f / 10).join(' + ')} · ${g.frameH}${top} · ${doors}`;
}
