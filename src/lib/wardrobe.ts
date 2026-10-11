/* The wardrobe planner: Raf's rules for a fitted wardrobe, shared by the Job Kit's design request (the picker
   and its live sums) and, in the same words, by scripts/wardrobe/plan.py, which builds the 3D model from it.
   Agreed with Raf 11 Oct 2026 (the 'Wardrobe builder' spreadsheet): a double unit counts as 1 (two doors), a
   single as 0.5 (one door); end panels at both ends unless he says otherwise; ceiling usually 2400. MDF goes
   floor to ceiling on a plinth, every door the same width. IKEA PAX uses 100 and 50 cm frames, 2010 high with
   a small top box above, or 2364 high for taller ceilings, with a taller top box; what is left of the width
   goes into fillers. Numbers marked 'suggested' were Claude's defaults that Raf hasn't changed yet.
   Keep this file and scripts/wardrobe/plan.py saying the same thing. */

export type Build = 'mdf' | 'ikea';
export type End = 'panel' | 'wall' | 'none';
export type Bottom = 'none' | 'baskets' | 'drawers' | 'shoes';
export type Above = 'long' | 'short' | 'two' | 'shelves';
export type Unit = { type: 'double' | 'single'; bottom: Bottom; count: number; above: Above; shelves: number; topShelf: boolean };
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
  paxDouble: 1000,
  paxSingle: 500,
  paxDoor: 497,
  fillerMax: 250, // suggested
  drawer: 200, // suggested
  basket: 160, // suggested
  shoes: 250, // suggested
  topShelfSpace: 300, // suggested
  longNeeds: 1400, // suggested
  shortNeeds: 1000, // suggested
  board: 18,
};

export const LAYOUTS: { label: string; units: ('double' | 'single')[] }[] = [
  { label: '1', units: ['double'] },
  { label: '1 + 0.5', units: ['double', 'single'] },
  { label: '0.5 + 1', units: ['single', 'double'] },
  { label: '1 + 1', units: ['double', 'double'] },
  { label: '1 + 1 + 0.5', units: ['double', 'double', 'single'] },
  { label: '0.5 + 1 + 0.5', units: ['single', 'double', 'single'] },
  { label: '1 + 1 + 1', units: ['double', 'double', 'double'] },
];

export const layoutLabel = (units: Unit[]) => units.map((u) => (u.type === 'double' ? '1' : '0.5')).join(' + ');

export const defaultUnit = (type: 'double' | 'single'): Unit =>
  type === 'double' ? { type, bottom: 'none', count: 0, above: 'long', shelves: 0, topShelf: true } : { type, bottom: 'none', count: 0, above: 'shelves', shelves: 4, topShelf: false };

/* Change the layout but keep what was picked inside each unit, where the type at that place is the same. */
export function withLayout(units: Unit[], types: ('double' | 'single')[]): Unit[] {
  return types.map((t, i) => (units[i]?.type === t ? units[i] : defaultUnit(t)));
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

const takeOff = (e: End) => (e === 'panel' ? RULES.panel : e === 'wall' ? RULES.scribe : 0);

export type UnitPlan = { x: number; w: number; doors: number; inner: number; bottomH: number; space: number; ok: boolean; note: string };
export type Plan = {
  doors: number;
  size: number; // in units: double 1, single 0.5
  avail: number; // width left for the units
  doorW: number;
  filler: number; // IKEA: width left after the frames, split between the two ends
  carcassH: number; // MDF carcass on the plinth, or the PAX frame
  above: number; // IKEA: ceiling minus frame
  top: 'none' | 'box' | 'infill';
  units: UnitPlan[];
  problems: string[];
};

export function plan(s: WardrobeSpec): Plan {
  const R = RULES;
  const doors = s.units.reduce((n, u) => n + (u.type === 'double' ? 2 : 1), 0);
  const size = s.units.reduce((n, u) => n + (u.type === 'double' ? 1 : 0.5), 0);
  const avail = s.width - takeOff(s.left) - takeOff(s.right);
  const ikea = s.build === 'ikea';
  const share = doors ? avail / doors : 0;
  const frames = s.units.reduce((n, u) => n + (u.type === 'double' ? R.paxDouble : R.paxSingle), 0);
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

  let x = takeOff(s.left) + (ikea ? Math.max(filler, 0) / 2 : 0);
  const inner = carcassH - 2 * R.board;
  const units = s.units.map((u, i) => {
    const w = ikea ? (u.type === 'double' ? R.paxDouble : R.paxSingle) : u.type === 'double' ? 2 * share : share;
    const bottomH = u.bottom === 'drawers' ? u.count * R.drawer : u.bottom === 'baskets' ? u.count * R.basket : u.bottom === 'shoes' ? R.shoes : 0;
    const space = inner - bottomH - (u.topShelf ? R.topShelfSpace : 0);
    let ok = true;
    let note = '';
    if (u.above === 'long' && space < R.longNeeds) [ok, note] = [false, `${Math.round(space)} mm is short for long hanging`];
    else if (u.above === 'short' && space < R.shortNeeds) [ok, note] = [false, `${Math.round(space)} mm is short for short hanging`];
    else if (u.above === 'two' && space < 2 * R.shortNeeds) [ok, note] = [false, `${Math.round(space)} mm is short for two rails`];
    else note = `${Math.round(space)} mm above the bottom`;
    if (!ok) problems.push(`Unit ${i + 1}: ${note}.`);
    const p = { x, w, doors: u.type === 'double' ? 2 : 1, inner, bottomH, space, ok, note };
    x += w;
    return p;
  });
  return { doors, size, avail, doorW, filler, carcassH, above, top, units, problems };
}

const BOTTOM: Record<Bottom, string> = { none: 'nothing at the bottom', baskets: 'IKEA baskets', drawers: 'drawers', shoes: 'a shoe shelf' };
const ABOVE: Record<Above, string> = { long: 'long hanging', short: 'short hanging', two: 'two short rails', shelves: 'shelves' };

export function unitText(u: Unit) {
  const bottom = u.bottom === 'baskets' || u.bottom === 'drawers' ? `${u.count} ${u.bottom === 'baskets' ? (u.count === 1 ? 'IKEA basket' : 'IKEA baskets') : u.count === 1 ? 'drawer' : 'drawers'}` : u.bottom === 'shoes' ? BOTTOM.shoes : '';
  const above = u.above === 'shelves' ? `${u.shelves} shelves` : ABOVE[u.above];
  return [bottom ? `${bottom}, then ${above}` : above, u.topShelf ? 'top shelf' : ''].filter(Boolean).join(', ');
}

/* The planner in words, for notes.txt. */
export function specLines(s: WardrobeSpec): string[] {
  const p = plan(s);
  const endWord = (e: End) => (e === 'panel' ? 'end panel' : e === 'wall' ? 'against a wall' : 'nothing');
  return [
    `Build: ${s.build === 'ikea' ? `IKEA PAX, ${s.pax} frames` : 'MDF, floor to ceiling'}`,
    `Wall to wall ${s.width} mm, ceiling ${s.ceiling} mm, depth ${s.depth} mm`,
    `Layout: ${layoutLabel(s.units)} (${p.doors} doors${s.build === 'mdf' && p.doorW > 0 ? ` of ${Math.round(p.doorW)} mm` : ''})`,
    `Left end: ${endWord(s.left)}. Right end: ${endWord(s.right)}.`,
    ...(s.build === 'ikea' ? [`Filler left: ${Math.round(p.filler)} mm. Above the frames: ${p.top === 'box' ? `top box ${p.above} mm` : p.top === 'infill' ? `infill strip ${p.above} mm` : 'nothing'}`] : []),
    ...s.units.map((u, i) => `Unit ${i + 1} (${u.type}): ${unitText(u)}`),
    `Doors: ${s.doors}. Handles: ${s.handles === 'push' ? 'push to open' : s.handles}.`,
    ...(p.problems.length ? [`Planner warnings: ${p.problems.join(' ')}`] : []),
  ];
}
