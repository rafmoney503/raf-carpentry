/* Bookcase planner (Job Kit design request): a fitted run of shelves, split into bays, with or without
   cupboards along the bottom. Raf asked for it 11 Oct 2026. Self-contained (no runtime imports) so
   scripts/planner-plan.mjs can run it with node. 'suggested' numbers are Claude's starting points
   (from the East Finchley bookcase and Palmers Green alcove jobs) until Raf gives his own. All mm. */

export type BookcaseSpec = {
  kind: 'bookcase';
  width: number; // wall to wall, or the width wanted
  height: number; // to the ceiling, or the height wanted
  depth: number; // the shelves
  bays: number;
  shelves: number; // in each bay, above the base
  base: 'none' | 'cupboards';
  baseH: number;
  baseD: number;
  left: 'panel' | 'wall' | 'none';
  right: 'panel' | 'wall' | 'none';
  doors: 'flat' | 'shaker' | 'panelled';
  handles: 'knobs' | 'bars' | 'push';
};

export const BOOKCASE_RULES = {
  board: 18,
  panel: 18,
  scribe: 20, // suggested
  plinth: 80, // suggested
  top: 25, // base top
  doorGap: 3,
  twoDoorsFrom: 600, // suggested: a bay wider than this gets a pair of doors
  bayMax: 900, // suggested: wider bays and the shelves may bow under books
  minGap: 220, // suggested
};

export function newBookcase(w?: number, h?: number): BookcaseSpec {
  return {
    kind: 'bookcase',
    width: w && w > 0 ? w : 0,
    height: h && h > 0 ? h : 2400,
    depth: 300, // suggested
    bays: w && w > 0 ? Math.max(1, Math.round(w / 800)) : 3,
    shelves: 4,
    base: 'cupboards',
    baseH: 800, // suggested
    baseD: 400, // suggested
    left: 'panel',
    right: 'panel',
    doors: 'flat',
    handles: 'knobs',
  };
}

const takeOff = (e: BookcaseSpec['left']) => (e === 'panel' ? BOOKCASE_RULES.panel : e === 'wall' ? BOOKCASE_RULES.scribe : 0);

export type Bay = { x0: number; x1: number; shelves: number[]; doors: { x0: number; x1: number; hingeLeft: boolean }[] };
export type BookcasePlan = { x0: number; x1: number; dividers: number[]; bays: Bay[]; zShelves: number; bayW: number; problems: string[] };

export function planBookcase(s: BookcaseSpec): BookcasePlan {
  const R = BOOKCASE_RULES;
  const problems: string[] = [];
  const x0 = takeOff(s.left);
  const x1 = s.width - takeOff(s.right);
  const n = Math.max(1, s.bays);
  // outer sides are part of the bookcase; dividers between bays
  const inner = x1 - x0 - (n + 1) * R.board;
  const bayW = inner / n;
  const dividers: number[] = [];
  const bays: Bay[] = [];
  const zShelves = s.base === 'cupboards' ? s.baseH : R.plinth + R.board;
  const top = s.height - R.board;
  const step = (top - zShelves) / (s.shelves + 1);
  for (let i = 0; i <= n; i++) dividers.push(x0 + i * (bayW + R.board));
  for (let i = 0; i < n; i++) {
    const a = dividers[i] + R.board;
    const b = a + bayW;
    const nd = s.base === 'cupboards' ? (bayW > R.twoDoorsFrom ? 2 : 1) : 0;
    const full = (b - a + 2 * R.board) / Math.max(nd, 1);
    const fa = a - R.board / 2;
    bays.push({
      x0: a,
      x1: b,
      shelves: Array.from({ length: s.shelves }, (_, k) => zShelves + step * (k + 1) - R.board / 2),
      doors: Array.from({ length: nd }, (_, k) => ({ x0: fa + k * full + R.doorGap / 2, x1: fa + (k + 1) * full - R.doorGap / 2, hingeLeft: nd === 2 ? k === 0 : i < n / 2 })),
    });
  }
  if (!s.width) problems.push('Type the width.');
  else if (bayW > R.bayMax) problems.push(`Bays are ${Math.round(bayW)} mm wide: add a bay so the shelves don't bow.`);
  if (s.shelves && step - R.board < R.minGap) problems.push(`Shelves only ${Math.round(step - R.board)} mm apart.`);
  return { x0, x1, dividers, bays, zShelves, bayW, problems };
}

export function bookcaseLines(s: BookcaseSpec): string[] {
  const p = planBookcase(s);
  const endWord = (e: BookcaseSpec['left']) => (e === 'panel' ? 'end panel' : e === 'wall' ? 'against a wall' : 'nothing');
  return [
    `Bookcase ${s.width} wide, ${s.height} high, shelves ${s.depth} deep`,
    `${s.bays} bays of ${Math.round(p.bayW)} mm, ${s.shelves} shelves in each`,
    s.base === 'cupboards' ? `Cupboards along the bottom, ${s.baseH} high, ${s.baseD} deep` : 'No cupboards: shelves from the plinth up',
    `Left end: ${endWord(s.left)}. Right end: ${endWord(s.right)}.`,
    `Doors: ${s.doors}. Handles: ${s.handles === 'push' ? 'push to open' : s.handles}.`,
    ...(p.problems.length ? [`Planner warnings: ${p.problems.join(' ')}`] : []),
  ];
}

export function bookcaseSummary(s: BookcaseSpec) {
  const p = planBookcase(s);
  const handle = { knobs: 'wooden knobs', bars: 'bar handles', push: 'push to open' }[s.handles];
  const text =
    s.base === 'cupboards'
      ? `A bookcase in ${s.bays} bays with ${s.shelves} shelves in each, over cupboards with ${s.doors} doors and ${handle}.`
      : `A bookcase in ${s.bays} bays with ${s.shelves} shelves in each, on a plinth.`;
  const sizes = [
    { label: 'Width', value: `${s.width} mm` },
    { label: 'Height', value: `${s.height} mm` },
    { label: 'Shelves', value: `${s.depth} mm deep, bays ${Math.round(p.bayW)} mm wide` },
    ...(s.base === 'cupboards' ? [{ label: 'Cupboards', value: `${s.baseH} mm high, ${s.baseD} mm deep` }] : []),
  ];
  return { text, sizes, problems: p.problems, title: s.base === 'cupboards' ? 'Bookcase with cupboards' : 'Bookcase' };
}
