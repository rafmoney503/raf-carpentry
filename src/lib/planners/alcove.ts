/* Alcove units planner (Job Kit design request): shelves in the alcoves beside a chimney breast, one side or
   both, with or without a base cupboard. Raf asked for it 11 Oct 2026 ('chimney breast or alcove one side or
   two side with base unit or just bookshelf'). Self-contained (no runtime imports) so scripts/planner-plan.mjs
   can run it with node to build the 3D model from the same sums. Numbers marked 'suggested' are Claude's
   starting points (from the Palmers Green and Newington Green alcove jobs) until Raf gives his own. All mm. */

export type AlcoveSpec = {
  kind: 'alcove';
  sides: 'left' | 'right' | 'both';
  leftW: number; // left alcove, wall to chimney breast
  rightW: number;
  breastW: number; // chimney breast width
  breastD: number; // how far the chimney breast comes out from the back wall (the alcove depth)
  ceiling: number;
  base: 'cupboard' | 'none';
  baseH: number; // top of the base cupboard
  baseD: number;
  shelves: number; // above the base (or from the floor with no base)
  shelfD: number;
  doors: 'flat' | 'shaker' | 'panelled';
  handles: 'knobs' | 'bars' | 'push';
};

export const ALCOVE_RULES = {
  board: 18,
  top: 25, // base cupboard top
  plinth: 80, // suggested
  shelfT: 25, // suggested: shelves in alcoves, a little thicker than carcass board
  doorGap: 3,
  twoDoorsFrom: 650, // suggested: a base wider than this gets a pair of doors
  minGap: 220, // suggested: smallest gap between shelves before a warning
};

export function newAlcove(w?: number, h?: number): AlcoveSpec {
  return {
    kind: 'alcove',
    sides: 'both',
    leftW: w && w > 0 ? w : 900,
    rightW: w && w > 0 ? w : 900,
    breastW: 1400,
    breastD: 380,
    ceiling: h && h > 0 ? h : 2400,
    base: 'cupboard',
    baseH: 850, // suggested
    baseD: 380,
    shelves: 4,
    shelfD: 300, // suggested
    doors: 'flat',
    handles: 'knobs',
  };
}

export type AlcoveSide = {
  side: 'left' | 'right';
  x: number;
  w: number;
  base: null | { h: number; d: number; doors: { x0: number; x1: number; hingeLeft: boolean }[] };
  shelves: number[]; // z of each shelf's underside
  shelfD: number;
};
export type AlcovePlan = { W: number; breastX: number; sides: AlcoveSide[]; problems: string[] };

export function planAlcove(s: AlcoveSpec): AlcovePlan {
  const R = ALCOVE_RULES;
  const problems: string[] = [];
  const W = s.leftW + s.breastW + s.rightW;
  const sides: AlcoveSide[] = [];
  const shelfD = Math.min(s.shelfD, s.breastD);
  if (s.shelfD > s.breastD) problems.push(`Shelves are deeper than the alcove: made ${s.breastD} deep.`);
  const baseD = Math.min(s.baseD, s.breastD + 150);
  for (const side of ['left', 'right'] as const) {
    if (s.sides !== 'both' && s.sides !== side) continue;
    const w = side === 'left' ? s.leftW : s.rightW;
    if (!w) {
      problems.push(`Type the ${side} alcove width.`);
      continue;
    }
    const x = side === 'left' ? 0 : s.leftW + s.breastW;
    let base: AlcoveSide['base'] = null;
    if (s.base === 'cupboard') {
      const n = w > R.twoDoorsFrom ? 2 : 1;
      const dw = w / n;
      base = {
        h: s.baseH,
        d: baseD,
        doors: Array.from({ length: n }, (_, i) => ({ x0: x + i * dw + R.doorGap / 2, x1: x + (i + 1) * dw - R.doorGap / 2, hingeLeft: n === 2 ? i === 0 : side === 'left' })),
      };
    }
    const z0 = base ? s.baseH : 0;
    const step = (s.ceiling - z0) / (s.shelves + 1);
    const shelves = Array.from({ length: s.shelves }, (_, i) => z0 + step * (i + 1) - R.shelfT / 2);
    if (s.shelves && step - R.shelfT < R.minGap) problems.push(`${side === 'left' ? 'Left' : 'Right'} alcove: shelves only ${Math.round(step - R.shelfT)} mm apart.`);
    sides.push({ side, x, w, base, shelves, shelfD });
  }
  if (s.base === 'cupboard' && s.baseH > s.ceiling - 300) problems.push('The base cupboard is nearly as tall as the room.');
  return { W, breastX: s.leftW, sides, problems };
}

const sideWords = (s: AlcoveSpec) => (s.sides === 'both' ? 'both alcoves' : `the ${s.sides} alcove`);

export function alcoveLines(s: AlcoveSpec): string[] {
  const p = planAlcove(s);
  return [
    `Alcove units in ${sideWords(s)}`,
    `Left alcove ${s.leftW} mm, chimney breast ${s.breastW} wide and ${s.breastD} out, right alcove ${s.rightW} mm, ceiling ${s.ceiling} mm`,
    s.base === 'cupboard' ? `Base cupboard ${s.baseH} high, ${s.baseD} deep, then ${s.shelves} shelves ${s.shelfD} deep` : `No base: ${s.shelves} shelves ${s.shelfD} deep from the floor up`,
    `Doors: ${s.doors}. Handles: ${s.handles === 'push' ? 'push to open' : s.handles}.`,
    ...(p.problems.length ? [`Planner warnings: ${p.problems.join(' ')}`] : []),
  ];
}

export function alcoveSummary(s: AlcoveSpec) {
  const p = planAlcove(s);
  const handle = { knobs: 'wooden knobs', bars: 'bar handles', push: 'push to open' }[s.handles];
  const text =
    s.base === 'cupboard'
      ? `In ${sideWords(s)} beside the chimney breast: a base cupboard ${s.baseH} high with ${s.doors} doors and ${handle}, and ${s.shelves} shelves above it up to the ceiling.`
      : `In ${sideWords(s)} beside the chimney breast: ${s.shelves} shelves from the floor up to the ceiling.`;
  const sizes = [
    ...(s.sides !== 'right' ? [{ label: 'Left alcove', value: `${s.leftW} mm` }] : []),
    ...(s.sides !== 'left' ? [{ label: 'Right alcove', value: `${s.rightW} mm` }] : []),
    { label: 'Chimney breast', value: `${s.breastW} mm wide, ${s.breastD} mm out` },
    { label: 'Ceiling', value: `${s.ceiling} mm` },
    ...(s.base === 'cupboard' ? [{ label: 'Base cupboard', value: `${s.baseH} mm high, ${s.baseD} mm deep` }] : []),
    { label: 'Shelves', value: `${s.shelves}, ${Math.min(s.shelfD, s.breastD)} mm deep` },
  ];
  return { text, sizes, problems: p.problems, title: s.base === 'cupboard' ? 'Alcove cupboards and shelves' : 'Alcove shelves' };
}
