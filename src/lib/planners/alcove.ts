/* Alcove units planner (Job Kit design request): shelves in the alcoves beside a chimney breast, with or
   without a base cupboard. Raf, 11 Oct 2026: 'chimney breast or alcove one side or two side with base unit or
   just bookshelf', then 'sometimes customers want the same things on both sides, sometimes different on each
   side, sometimes just left or right'. Self-contained (no runtime imports) so scripts/planner-plan.mjs can run
   it with node to build the 3D model from the same sums. Numbers marked 'suggested' are Claude's starting
   points (from the Palmers Green and Newington Green alcove jobs) until Raf gives his own. All mm. */

/* What goes in one alcove. */
export type AlcoveFit = {
  base: 'cupboard' | 'none';
  baseH: number; // top of the base cupboard
  baseD: number;
  shelves: number; // above the base (or from the floor with no base)
  shelfD: number;
};

export type AlcoveSpec = {
  kind: 'alcove';
  sides: 'both' | 'left' | 'right';
  same: boolean; // both alcoves the same (the left one's choices are used for both)
  leftW: number; // left alcove, wall to chimney breast
  rightW: number;
  breastW: number; // chimney breast width
  breastD: number; // how far the chimney breast comes out from the back wall (the alcove depth)
  ceiling: number;
  left: AlcoveFit;
  right: AlcoveFit;
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

export const newFit = (): AlcoveFit => ({ base: 'cupboard', baseH: 850, baseD: 380, shelves: 4, shelfD: 300 }); // suggested

export function newAlcove(w?: number, h?: number): AlcoveSpec {
  return {
    kind: 'alcove',
    sides: 'both',
    same: true,
    leftW: w && w > 0 ? w : 900,
    rightW: w && w > 0 ? w : 900,
    breastW: 1400,
    breastD: 380,
    ceiling: h && h > 0 ? h : 2400,
    left: newFit(),
    right: newFit(),
    doors: 'flat',
    handles: 'knobs',
  };
}

/* Requests saved before each side had its own choices (one base / shelves for both). */
type OldAlcove = Partial<AlcoveFit> & Partial<AlcoveSpec>;
export function normaliseAlcove(raw: AlcoveSpec): AlcoveSpec {
  const o = raw as OldAlcove & AlcoveSpec;
  if (o.left && o.right) return { ...o, same: o.same ?? true };
  const fit: AlcoveFit = { ...newFit(), ...(o.base ? { base: o.base } : {}), ...(o.baseH ? { baseH: o.baseH } : {}), ...(o.baseD ? { baseD: o.baseD } : {}), ...(o.shelves !== undefined ? { shelves: o.shelves } : {}), ...(o.shelfD ? { shelfD: o.shelfD } : {}) };
  return { ...newAlcove(), ...o, same: true, left: fit, right: { ...fit } };
}

export const fitOf = (s: AlcoveSpec, side: 'left' | 'right') => (s.same ? s.left : s[side]);

export type AlcoveSide = {
  side: 'left' | 'right';
  x: number;
  w: number;
  base: null | { h: number; d: number; doors: { x0: number; x1: number; hingeLeft: boolean }[] };
  shelves: number[]; // z of each shelf's underside
  shelfD: number;
};
export type AlcovePlan = { W: number; breastX: number; sides: AlcoveSide[]; problems: string[] };

export function planAlcove(raw: AlcoveSpec): AlcovePlan {
  const s = normaliseAlcove(raw);
  const R = ALCOVE_RULES;
  const problems: string[] = [];
  const W = s.leftW + s.breastW + s.rightW;
  const sides: AlcoveSide[] = [];
  for (const side of ['left', 'right'] as const) {
    if (s.sides !== 'both' && s.sides !== side) continue;
    const f = fitOf(s, side);
    const name = side === 'left' ? 'Left alcove' : 'Right alcove';
    const w = side === 'left' ? s.leftW : s.rightW;
    if (!w) {
      problems.push(`Type the ${side} alcove width.`);
      continue;
    }
    const shelfD = Math.min(f.shelfD, s.breastD);
    if (f.shelfD > s.breastD) problems.push(`${name}: shelves deeper than the alcove, made ${s.breastD} deep.`);
    const x = side === 'left' ? 0 : s.leftW + s.breastW;
    let base: AlcoveSide['base'] = null;
    if (f.base === 'cupboard') {
      const n = w > R.twoDoorsFrom ? 2 : 1;
      const dw = w / n;
      base = {
        h: f.baseH,
        d: Math.min(f.baseD, s.breastD + 150),
        doors: Array.from({ length: n }, (_, i) => ({ x0: x + i * dw + R.doorGap / 2, x1: x + (i + 1) * dw - R.doorGap / 2, hingeLeft: n === 2 ? i === 0 : side === 'left' })),
      };
      if (f.baseH > s.ceiling - 300) problems.push(`${name}: the base cupboard is nearly as tall as the room.`);
    }
    const z0 = base ? f.baseH : 0;
    const step = (s.ceiling - z0) / (f.shelves + 1);
    const shelves = Array.from({ length: f.shelves }, (_, i) => z0 + step * (i + 1) - R.shelfT / 2);
    if (f.shelves && step - R.shelfT < R.minGap) problems.push(`${name}: shelves only ${Math.round(step - R.shelfT)} mm apart.`);
    sides.push({ side, x, w, base, shelves, shelfD });
  }
  return { W, breastX: s.leftW, sides, problems };
}

const sideWords = (s: AlcoveSpec) => (s.sides === 'both' ? 'both alcoves' : `the ${s.sides} alcove`);
const fitWords = (f: AlcoveFit) => (f.base === 'cupboard' ? `a base cupboard ${f.baseH} high with ${f.shelves} shelves above` : `${f.shelves} shelves from the floor up`);

export function alcoveLines(raw: AlcoveSpec): string[] {
  const s = normaliseAlcove(raw);
  const p = planAlcove(s);
  const fits =
    s.sides !== 'both'
      ? [`${s.sides === 'left' ? 'Left' : 'Right'} alcove only: ${fitWords(fitOf(s, s.sides))}, shelves ${fitOf(s, s.sides).shelfD} deep`]
      : s.same
        ? [`Both alcoves the same: ${fitWords(s.left)}, shelves ${s.left.shelfD} deep${s.left.base === 'cupboard' ? `, cupboard ${s.left.baseD} deep` : ''}`]
        : (['left', 'right'] as const).map((k) => `${k === 'left' ? 'Left' : 'Right'} alcove: ${fitWords(s[k])}, shelves ${s[k].shelfD} deep${s[k].base === 'cupboard' ? `, cupboard ${s[k].baseD} deep` : ''}`);
  return [
    `Alcove units in ${sideWords(s)}`,
    `Left alcove ${s.leftW} mm, chimney breast ${s.breastW} wide and ${s.breastD} out, right alcove ${s.rightW} mm, ceiling ${s.ceiling} mm`,
    ...fits,
    `Doors: ${s.doors}. Handles: ${s.handles === 'push' ? 'push to open' : s.handles}.`,
    ...(p.problems.length ? [`Planner warnings: ${p.problems.join(' ')}`] : []),
  ];
}

export function alcoveSummary(raw: AlcoveSpec) {
  const s = normaliseAlcove(raw);
  const p = planAlcove(s);
  const handle = { knobs: 'wooden knobs', bars: 'bar handles', push: 'push to open' }[s.handles];
  const anyBase = p.sides.some((a) => a.base);
  const doorsText = anyBase ? ` Cupboard doors are ${s.doors}, with ${handle}.` : '';
  let text: string;
  if (s.sides === 'both' && !s.same) {
    text = `Beside the chimney breast: in the left alcove ${fitWords(s.left)}; in the right alcove ${fitWords(s.right)}.${doorsText}`;
  } else {
    const f = fitOf(s, s.sides === 'right' ? 'right' : 'left');
    text = `In ${sideWords(s)} beside the chimney breast: ${fitWords(f)}${f.base === 'cupboard' ? ' it' : ''}, up to the ceiling.${doorsText}`;
  }
  const sizes = [
    ...(s.sides !== 'right' ? [{ label: 'Left alcove', value: `${s.leftW} mm` }] : []),
    ...(s.sides !== 'left' ? [{ label: 'Right alcove', value: `${s.rightW} mm` }] : []),
    { label: 'Chimney breast', value: `${s.breastW} mm wide, ${s.breastD} mm out` },
    { label: 'Ceiling', value: `${s.ceiling} mm` },
  ];
  for (const a of p.sides) {
    const f = fitOf(s, a.side);
    const who = s.sides === 'both' && !s.same ? (a.side === 'left' ? 'Left: ' : 'Right: ') : '';
    if (s.sides === 'both' && s.same && a.side === 'right') continue;
    if (f.base === 'cupboard') sizes.push({ label: `${who}Base cupboard`, value: `${f.baseH} mm high, ${f.baseD} mm deep` });
    sizes.push({ label: `${who}Shelves`, value: `${f.shelves}, ${a.shelfD} mm deep` });
  }
  return { text, sizes, problems: p.problems, title: anyBase ? 'Alcove cupboards and shelves' : 'Alcove shelves' };
}
