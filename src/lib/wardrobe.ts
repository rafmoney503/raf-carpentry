/* The wardrobe planner: Raf's rules for a fitted wardrobe, shared by the Job Kit's design request (the picker
   and its live sums) and, in the same words, by scripts/wardrobe/plan.py, which builds the 3D model from it.
   Agreed with Raf 11 Oct 2026 (the 'Wardrobe builder' spreadsheet): a double unit counts as 1 (two doors), a
   single as 0.5 (one door); end panels at both ends unless he says otherwise; ceiling usually 2400. MDF goes
   floor to ceiling on a plinth, every door the same width. IKEA PAX uses 100 and 50 cm frames, 2010 high with
   a small top box above, or 2364 high for taller ceilings, with a taller top box; what is left of the width
   goes into fillers. Inside each unit is a stack, bottom to top, of pieces Raf picks (his usual IKEA unit:
   baskets at the bottom, drawers above, a shelf, short hanging, a shelf). Numbers marked 'suggested' were
   Claude's defaults that Raf hasn't changed yet.
   Keep this file and scripts/wardrobe/plan.py saying the same thing. */

export type Build = 'mdf' | 'ikea';
export type End = 'panel' | 'wall' | 'none';
export type PieceKind = 'baskets' | 'drawers' | 'shoes' | 'shelf' | 'short' | 'long' | 'shelves';
export type Piece = { kind: PieceKind; count: number };
/* double = 1 (two doors), single = 0.5 (one door); mid = a 750 PAX frame (0.75, two doors), IKEA only. */
export type UnitType = 'double' | 'mid' | 'single';
export type Unit = { type: UnitType; pieces: Piece[] }; // pieces bottom to top
export type WardrobeSpec = {
  build: Build;
  pax: 2010 | 2364;
  width: number; // wall to wall, mm
  ceiling: number;
  depth: number;
  units: Unit[]; // left to right
  left: End;
  right: End;
  doors: 'flat' | 'shaker' | 'panelled';
  handles: 'knobs' | 'bars' | 'push';
};

export const RULES = {
  plinth: 80, // suggested
  scribe: 20, // suggested
  panel: 18,
  gap: 3, // suggested
  topBoxFrom: 300, // suggested
  doorMin: 300, // suggested
  doorMax: 600, // suggested
  // PAX frames are sold as 100, 75 and 50 cm but are really 998, 748 and 498 wide (Raf, 11 Oct 2026)
  paxDouble: 998,
  paxMid: 748,
  paxSingle: 498,
  paxDoor: 497,
  paxBase: 60, // the PAX frame's own plinth, under its bottom shelf
  fillerMax: 250, // suggested
  drawer: 200, // suggested, each
  basket: 160, // suggested, each
  shoes: 250, // suggested
  topShelfSpace: 300, // suggested: room above a shelf that is the last piece
  longNeeds: 1400, // suggested
  shortNeeds: 1000, // suggested
  shelfGap: 250, // suggested: smallest gap between shelves
  board: 18,
};

export const PIECES: Record<PieceKind, { name: string; counted?: [string, string]; max?: number }> = {
  baskets: { name: 'IKEA baskets', counted: ['basket', 'baskets'], max: 8 },
  drawers: { name: 'Drawers', counted: ['drawer', 'drawers'], max: 8 },
  shoes: { name: 'Shoe shelf' },
  shelf: { name: 'Shelf' },
  short: { name: 'Short hanging' },
  long: { name: 'Long hanging' },
  shelves: { name: 'Shelves', counted: ['shelf', 'shelves'], max: 10 },
};
export const pieceText = (p: Piece) => (PIECES[p.kind].counted ? `${p.count} ${p.count === 1 ? PIECES[p.kind].counted![0] : PIECES[p.kind].counted![1]}` : PIECES[p.kind].name);

/* Ready-made insides, one tap each; Raf can change any of them piece by piece. */
export const PRESETS: { label: string; pieces: Piece[]; for?: Build }[] = [
  { label: 'Hanging + top shelf', pieces: [{ kind: 'long', count: 0 }, { kind: 'shelf', count: 0 }] },
  { label: 'Drawers + hanging', pieces: [{ kind: 'drawers', count: 3 }, { kind: 'shelf', count: 0 }, { kind: 'short', count: 0 }, { kind: 'shelf', count: 0 }] },
  {
    label: 'Baskets + drawers + hanging',
    for: 'ikea',
    pieces: [{ kind: 'baskets', count: 2 }, { kind: 'drawers', count: 1 }, { kind: 'shelf', count: 0 }, { kind: 'short', count: 0 }, { kind: 'shelf', count: 0 }],
  },
  { label: 'Two rails', pieces: [{ kind: 'short', count: 0 }, { kind: 'short', count: 0 }, { kind: 'shelf', count: 0 }] },
  { label: 'Shelves', pieces: [{ kind: 'shelves', count: 5 }] },
];

/* Where a newly added piece goes: baskets at the very bottom, drawers above any baskets, anything else under a
   top shelf if there is one, otherwise on top. Raf can move it with the arrows. */
export function addPiece(pieces: Piece[], kind: PieceKind): Piece[] {
  const p: Piece = { kind, count: PIECES[kind].counted ? (kind === 'shelves' ? 4 : 2) : 0 };
  const lastBasket = pieces.map((x) => x.kind).lastIndexOf('baskets');
  const lastDrawer = pieces.map((x) => x.kind).lastIndexOf('drawers');
  let at = pieces.length;
  if (kind === 'baskets') at = Math.max(lastBasket + 1, 0);
  else if (kind === 'drawers') at = Math.max(lastDrawer, lastBasket) + 1;
  else if (kind !== 'shelf' && pieces.length && pieces[pieces.length - 1].kind === 'shelf') at = pieces.length - 1;
  return [...pieces.slice(0, at), p, ...pieces.slice(at)];
}

export const unitDoors = (t: UnitType) => (t === 'single' ? 1 : 2);
export const unitSize = (t: UnitType) => (t === 'double' ? 1 : t === 'mid' ? 0.75 : 0.5);
export const paxWidth = (t: UnitType) => (t === 'double' ? RULES.paxDouble : t === 'mid' ? RULES.paxMid : RULES.paxSingle);
const NOMINAL: Record<UnitType, string> = { double: '1000', mid: '750', single: '500' };
/* MDF layouts read '1 + 0.5'; IKEA layouts read in PAX sizes, '1000 + 500'. */
export const layoutLabel = (units: Unit[], build: Build = 'mdf') =>
  units.map((u) => (build === 'ikea' ? NOMINAL[u.type] : u.type === 'double' ? '1' : u.type === 'mid' ? '0.75' : '0.5')).join(' + ');

export const defaultUnit = (type: UnitType, build: Build = 'mdf'): Unit => ({
  type,
  pieces:
    type === 'single'
      ? [{ kind: 'shelves', count: 5 }]
      : build === 'ikea'
        ? PRESETS[2].pieces.map((p) => ({ ...p }))
        : PRESETS[0].pieces.map((p) => ({ ...p })),
});

export const LAYOUTS: { label: string; units: UnitType[]; ikea?: boolean }[] = [
  { label: '1', units: ['double'] },
  { label: '1 + 0.5', units: ['double', 'single'] },
  { label: '0.5 + 1', units: ['single', 'double'] },
  { label: '1 + 1', units: ['double', 'double'] },
  { label: '1 + 1 + 0.5', units: ['double', 'double', 'single'] },
  { label: '0.5 + 1 + 0.5', units: ['single', 'double', 'single'] },
  { label: '1 + 1 + 1', units: ['double', 'double', 'double'] },
  { label: '1 + 0.75', units: ['double', 'mid'], ikea: true },
  { label: '0.75 + 1', units: ['mid', 'double'], ikea: true },
  { label: '1 + 1 + 0.75', units: ['double', 'double', 'mid'], ikea: true },
];

/* Change the layout but keep what was picked inside each unit, where the type at that place is the same. */
export function withLayout(units: Unit[], types: UnitType[], build: Build = 'mdf'): Unit[] {
  return types.map((t, i) => (units[i]?.type === t ? units[i] : defaultUnit(t, build)));
}

/* Requests saved before the inside became a stack (bottom + above + top shelf) still open. */
type OldUnit = { type: UnitType; bottom?: string; count?: number; above?: string; shelves?: number; topShelf?: boolean; pieces?: Piece[] };
export function normalise(s: WardrobeSpec): WardrobeSpec {
  const units = (s.units as OldUnit[]).map((u): Unit => {
    if (u.pieces) return { type: u.type, pieces: u.pieces };
    const pieces: Piece[] = [];
    if (u.bottom === 'baskets' || u.bottom === 'drawers') pieces.push({ kind: u.bottom, count: u.count || 1 }, { kind: 'shelf', count: 0 });
    if (u.bottom === 'shoes') pieces.push({ kind: 'shoes', count: 0 });
    if (u.above === 'long' || u.above === 'short') pieces.push({ kind: u.above, count: 0 });
    if (u.above === 'two') pieces.push({ kind: 'short', count: 0 }, { kind: 'short', count: 0 });
    if (u.above === 'shelves') pieces.push({ kind: 'shelves', count: u.shelves || 3 });
    if (u.topShelf) pieces.push({ kind: 'shelf', count: 0 });
    return { type: u.type, pieces };
  });
  // a 750 unit only exists in PAX: in MDF it becomes a double
  return { ...s, units: s.build === 'ikea' ? units : units.map((u) => (u.type === 'mid' ? { ...u, type: 'double' as const } : u)) };
}

export function newSpec(width?: number, ceiling?: number, depth?: number): WardrobeSpec {
  return {
    build: 'mdf',
    pax: 2010,
    width: width && width > 0 ? width : 0,
    ceiling: ceiling && ceiling > 0 ? ceiling : 2400,
    depth: depth && depth > 0 ? depth : 600,
    units: withLayout([], ['double', 'double']),
    left: 'panel',
    right: 'panel',
    doors: 'flat',
    handles: 'knobs',
  };
}

export const takeOff = (e: End) => (e === 'panel' ? RULES.panel : e === 'wall' ? RULES.scribe : 0);

/* One piece placed in its unit: z0 to z1 from the floor, mm. */
export type Section = Piece & { z0: number; z1: number };
export type UnitPlan = { x: number; w: number; doors: number; z0: number; z1: number; sections: Section[]; ok: boolean; note: string };
export type Plan = {
  doors: number;
  size: number; // in units: double 1, single 0.5
  avail: number; // width left for the units
  doorW: number;
  filler: number; // IKEA: width left after the frames, split between the two ends
  carcassH: number; // MDF: carcass on the plinth, to the ceiling; IKEA: the PAX frame
  above: number; // IKEA: ceiling minus frame
  top: 'none' | 'box' | 'infill';
  units: UnitPlan[];
  problems: string[];
};

const fixedH = (p: Piece, last: boolean) =>
  p.kind === 'baskets' ? p.count * RULES.basket : p.kind === 'drawers' ? p.count * RULES.drawer : p.kind === 'shoes' ? RULES.shoes : p.kind === 'shelf' ? RULES.board + (last ? RULES.topShelfSpace : 0) : 0;
const flexMin = (p: Piece) => (p.kind === 'long' ? RULES.longNeeds : p.kind === 'short' ? RULES.shortNeeds : p.kind === 'shelves' ? (p.count + 1) * RULES.shelfGap : 0);

/* Stack the pieces from z0 up: baskets, drawers, shoe shelf and shelves take their own height; hanging and
   groups of shelves share what is left, in proportion to the least each needs. */
function stack(pieces: Piece[], z0: number, z1: number): { sections: Section[]; short: number } {
  const n = pieces.length;
  const fixed = pieces.reduce((t, p, i) => t + fixedH(p, i === n - 1), 0);
  const need = pieces.reduce((t, p) => t + flexMin(p), 0);
  const free = z1 - z0 - fixed;
  const k = need > 0 ? Math.max(free, 0) / need : 0;
  let z = z0;
  const sections = pieces.map((p, i) => {
    const h = fixedH(p, i === n - 1) || flexMin(p) * k;
    const s = { ...p, z0: z, z1: z + h };
    z += h;
    return s;
  });
  return { sections, short: need > 0 ? need - free : fixed - (z1 - z0) };
}

export function plan(spec: WardrobeSpec): Plan {
  const s = normalise(spec);
  const R = RULES;
  const doors = s.units.reduce((n, u) => n + unitDoors(u.type), 0);
  const size = s.units.reduce((n, u) => n + unitSize(u.type), 0);
  const avail = s.width - takeOff(s.left) - takeOff(s.right);
  const ikea = s.build === 'ikea';
  const share = doors ? avail / doors : 0;
  const frames = s.units.reduce((n, u) => n + paxWidth(u.type), 0);
  const filler = ikea ? avail - frames : 0;
  const carcassH = ikea ? s.pax : s.ceiling - R.plinth;
  const above = ikea ? s.ceiling - s.pax : 0;
  const top: Plan['top'] = !ikea || above <= 0 ? 'none' : above >= R.topBoxFrom ? 'box' : 'infill';
  const doorW = ikea ? R.paxDoor : share - R.gap;
  const problems: string[] = [];
  if (!s.width) problems.push('Type the wall to wall width.');
  else if (!doors) problems.push('Pick a layout.');
  else if (ikea) {
    if (filler < 0) problems.push(`The PAX frames are ${Math.round(-filler)} mm too wide: take a unit off.`);
    else if (filler > R.fillerMax) problems.push(`${Math.round(filler)} mm of filler left over: add a single?`);
  } else if (doorW > R.doorMax) problems.push(`Doors would be ${Math.round(doorW)} mm wide: add a unit.`);
  else if (doorW < R.doorMin) problems.push(`Doors would be ${Math.round(doorW)} mm wide: use fewer units.`);
  if (ikea && s.ceiling < s.pax) problems.push(`The ${s.pax} frame is taller than the ceiling.`);

  // inside: from the top of the bottom board to the underside of the top board
  const z0 = ikea ? R.paxBase + R.board : R.plinth + R.board;
  const z1 = (ikea ? s.pax : s.ceiling) - R.board;
  let x = takeOff(s.left) + (ikea ? Math.max(filler, 0) / 2 : 0);
  const units = s.units.map((u, i) => {
    const w = ikea ? paxWidth(u.type) : u.type === 'single' ? share : 2 * share;
    const { sections, short } = stack(u.pieces, z0, z1);
    const ok = short <= 0;
    const note = !u.pieces.length ? 'Empty inside' : ok ? `${Math.round(-short)} mm to spare` : `${Math.round(short)} mm too much inside`;
    if (!ok) problems.push(`Unit ${i + 1}: ${note}.`);
    const p = { x, w, doors: unitDoors(u.type), z0, z1, sections, ok, note };
    x += w;
    return p;
  });
  return { doors, size, avail, doorW, filler, carcassH, above, top, units, problems };
}

export const unitName = (t: UnitType, build: Build) => (build === 'ikea' ? `PAX ${NOMINAL[t]}` : t === 'single' ? 'single' : 'double');

export const unitText = (u: Unit) => (u.pieces.length ? u.pieces.map(pieceText).join(', ') : 'empty');

/* The planner in words, for notes.txt. */
export function specLines(s: WardrobeSpec): string[] {
  const p = plan(s);
  const endWord = (e: End) => (e === 'panel' ? 'end panel' : e === 'wall' ? 'against a wall' : 'nothing');
  return [
    `Build: ${s.build === 'ikea' ? `IKEA PAX, ${s.pax} frames` : 'MDF, floor to ceiling'}`,
    `Wall to wall ${s.width} mm, ceiling ${s.ceiling} mm, depth ${s.depth} mm`,
    `Layout: ${layoutLabel(s.units, s.build)} (${p.doors} doors${s.build === 'mdf' && p.doorW > 0 ? ` of ${Math.round(p.doorW)} mm` : ''})`,
    `Left end: ${endWord(s.left)}. Right end: ${endWord(s.right)}.`,
    ...(s.build === 'ikea' ? [`Filler left: ${Math.round(p.filler)} mm. Above the frames: ${p.top === 'box' ? `top box ${p.above} mm` : p.top === 'infill' ? `infill strip ${p.above} mm` : 'nothing'}`] : []),
    ...s.units.map((u, i) => `Unit ${i + 1} (${unitName(u.type, s.build)}), bottom to top: ${unitText(u)}`),
    `Doors: ${s.doors}. Handles: ${s.handles === 'push' ? 'push to open' : s.handles}.`,
    ...(p.problems.length ? [`Planner warnings: ${p.problems.join(' ')}`] : []),
  ];
}
