/* Wardrobe planner units built on CabinetOS's own rules (16 Oct 2026, Raf: 'improve wardrobe planner with cabinetos
   taking into account cabinetos set of rules for creating units and presenting them').

   Every unit the customer sets up in /wardrobe-planner is a CabinetOS wardrobe (a combined unit with top cupboards):
   the planner draws it, sizes it and sends it with the same settings CabinetOS uses, so what the customer sees is what
   CabinetOS builds the cut list from. The numbers in COS are CabinetOS's own (cabinetos-site src/lib/cabinetRules.ts,
   "single source of truth"); the sums repeat CabinetOS's (shelfLayout.ts computeShelfYFromBottomMmList and
   computeHangingRailYFromBottomMm, calcDrawerBank.ts, elevationDoors.ts, viewportGeometry.ts getDoorSizingForHeight,
   generateParts in CabinetApp.tsx). PLAN holds the planner's own choices, which CabinetOS doesn't decide (how long
   clothes hang, how close shelves may be, how tall a drawer is).

   `bash scripts/cabinetos-check/run.sh` builds designs with this file, sends them through CabinetOS's own mapper
   (src/lib/inbound/websiteDesign.ts) and compares every shelf, rail, drawer, door and cut-list size with CabinetOS's
   code. Run it after changing this file or CabinetOS's rules.

   No imports, so the planner engine, the check and node can all load it. */

/** CabinetOS rules (cabinetRules.ts), for an 18 mm MDF build with the app's default construction. */
export const COS = {
  board: 18, // DEFAULT_PANEL_THICKNESS_MM: sides, top, bottom, shelves
  back: 18, // DEFAULT_BACK_THICKNESS_MM, fitted inside the box (backFit BETWEEN_ALL)
  doorTopGap: 3, // DOOR_TOP_GAP_MM
  doorSideGap: 4, // DOOR_SIDE_GAP_MM, off each door's width: 2 at each outside edge, 4 between a pair
  doorBottomGap: 0, // DOOR_BOTTOM_GAP_MM
  maxDoor: 600, // MAX_DOOR_WIDTH_MM
  shelfSideGap: 2, // SHELF_SIDE_GAP_MM, each side
  shelfFrontGap: 2, // SHELF_FRONT_GAP_MM
  drawerTopGap: 3, // DRAWER_TOP_GAP_MM
  drawerBetweenGap: 3, // DRAWER_BETWEEN_GAP_MM
  drawerBottomGap: 0, // drawerBottomGapMm on a new wardrobe (unitDefaults.json)
  railFromTop: 100, // RAIL_DEFAULT_POSITION_FROM_TOP_MM (a rail with nothing set; the planner hangs it under a board)
  railBelowShelf: 20, // ANGLED_RAIL_GAP_BELOW_SHELF_MM: a rail hung under a shelf, its centre this far below the underside
  dustShelf: 18, // SHELF_DUST_THICKNESS_MM: the dust shelf on top of the drawers (dustShelfGapMm 0: straight on top)
  railDiameter: 25, // RAIL_DEFAULT_DIAMETER_MM
  hingeClearance: 30, // HINGE_CLEARANCE_DEFAULT_MM, each side of drawers behind the doors
  maxShelves: 12, // the app's shelf count limit
  maxDrawers: 10, // MAX_DRAWER_COUNT
} as const;

/** The planner's own choices. CabinetOS takes whatever the customer sets; these keep it sensible. */
export const PLAN = {
  hangLong: 1400, // clear space under a long rail: coats and dresses
  hangShort: 900, // under a short rail: shirts and jackets
  hangDouble: 850, // under each rail of double hanging (so it fits under the shelf at 2000 on a plinth up to about 240)
  minShelfGap: 200, // shelves no closer than this, board face to board face
  drawerPitch: 200, // drawer zone per drawer (3 drawers = 600, CabinetOS's own starting zone)
  maxShelves: 8,
  maxDrawers: 6,
  splitMin: 400, // each half of "hanging beside drawers": wide enough to hang clothes (so the unit is 800 or more)
  minHangWidth: 400, // narrower than this, hangers don't fit across
  minDrawerWidth: 300, // narrower than this, a drawer behind the doors is too small to be worth it (CabinetOS makes none under about 160)
  // Raf, 17 Oct 2026: 'usually on a height 2000 is a shelf or dividing unit where under you fit hanging pole'. The top
  // face of that shelf, from the floor; top cupboards start at the same height (the dividing line).
  hatShelf: 2000,
  hatMinAbove: 200, // the shelf goes in only with at least this much clear above it; else the rail hangs under the top
  aboveGap: 500, // more shelves over it when the space above is taller than this (high ceilings)
} as const;

export type Rail = 'none' | 'long' | 'short' | 'double';
/** What goes inside one CabinetOS unit. `below`: drawers on the front under the doors instead of behind them. */
export type Inside = { rail: Rail; shelves: number; drawers: number; below: boolean };

/** One CabinetOS unit as the planner places it. Heights in mm; `boxH` is the carcass from the top of the plinth to
    the top of its top panel (CabinetOS's effective height). With top cupboards, `boxH` is the base box and `topH` the
    top box above it. */
export type UnitBox = {
  w: number;
  boxH: number;
  d: number; // carcass depth (the planner's depth less the doors)
  topH?: number;
  hat?: number; // where the shelf over the hanging goes (its top face, from the carcass bottom): PLAN.hatShelf less the plinth
  hingeLeft: boolean; // a single door's hinge side
  sliding?: boolean; // sliding doors across the run instead of hinged ones
};

export type Front = { x0: number; x1: number; y0: number; y1: number; hingeLeft?: boolean };
export type Hang = { y: number; bottom: number; length: number; kind: 'long' | 'short' };

export type Layout = {
  w: number;
  boxH: number;
  /** Clear space inside: top face of the bottom panel to the underside of the top panel. */
  inner: { bottom: number; top: number };
  /** Height of the drawer zone from the carcass bottom (0 = no drawers). */
  drawerZone: number;
  /** Where the space above starts: the top of the bottom panel, or of the dust shelf on the drawers. */
  floor: number;
  /** The dust shelf on top of the drawers (its centre), or null. */
  dust: number | null;
  /** The shelf over the hanging at PLAN.hatShelf (its centre), or null; `above` = shelves over it (tall rooms). */
  hat: number | null;
  above: number;
  /** The customer's own shelves (the Shelves counter); `shelves` also holds the shelf over the hanging and any above. */
  ownShelves: number;
  drawerFront: number; // each drawer front's height
  drawers: Front[]; // fronts, from the carcass bottom; behind the doors or below them
  drawersBelow: boolean;
  shelves: number[]; // every shelf's centre from the carcass bottom, as CabinetOS counts them (not the dust shelf)
  shelfGap: number | null; // clear gap between the customer's own shelves
  rails: number[]; // rail centres from the carcass bottom, bottom to top
  hangs: Hang[];
  doors: Front[]; // base box doors (and the top box's, above boxH)
  doorCount: 1 | 2;
  sizes: {
    door: { n: number; w: number; h: number };
    topDoor: { n: number; w: number; h: number } | null;
    shelf: { n: number; w: number; d: number };
    drawer: { n: number; h: number } | null;
    dust: boolean;
    box: { w: number; h: number; d: number };
  };
  problems: string[];
  canAddShelf: boolean;
  canAddDrawer: boolean;
  /** The CabinetOS unit settings for this unit (field names as in CabinetOS's UnitItem). */
  cos: CosSettings;
};

export type CosSettings = {
  hangingRail: { enabled: boolean; railType: 'full_length' | 'half_length' | 'double'; positionFromTopMm: number; bottomRailPositionFromTopMm?: number; diameterMm: number };
  shelvesCount: number;
  shelfDistributionMode: 'equal' | 'custom';
  customShelfOffsetsFromBottomMm?: number[];
  firstShelfOffsetMm: number;
  frontConfig: 'doors' | 'doors_drawers_internal' | 'doors_drawers_external';
  drawerCount: number;
  drawerZoneHeightMm: number;
  drawerBank: { dustShelfEnabled: boolean; dustShelfThicknessMm: number; dustShelfGapMm: number };
  doorCount: 1 | 2;
  doorHinge?: 'left' | 'right';
};

const r2 = (n: number) => Math.round(n * 100) / 100; // CabinetOS rounds sizes to 0.01 mm
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** One door up to 600 wide, a pair above (the planner's rule since 14 Oct; CabinetOS's door limit is 600). */
export function doorCountFor(w: number): 1 | 2 {
  return w <= COS.maxDoor ? 1 : 2;
}

/** `n` shelf centres with equal clear gaps between the faces lo and hi (shelfLayout.ts evenShelfCentresMm). */
function evenCentres(lo: number, hi: number, n: number): number[] {
  const t = COS.board;
  const gap = Math.max(0, (hi - lo - n * t) / (n + 1));
  return Array.from({ length: n }, (_, i) => lo + gap * (i + 1) + t * i + t / 2);
}

/** Rails, the space each hangs over, and where the shelf space ends, for a rail type. `under` is the underside of
    the board the top rail hangs under (the shelf over the hanging, or the top of the box), from the carcass bottom. */
function railsFor(rail: Rail, boxH: number, floor: number, under: number) {
  const usableTop = boxH - COS.doorTopGap; // CabinetOS measures rails from the box top less the door gap
  const top = under - COS.railBelowShelf;
  const fromTop = Math.round(usableTop - top);
  if (rail === 'none') return { rails: [] as number[], hangs: [] as Hang[], shelfTop: boxH - COS.board, fromTop, lowerFromTop: undefined as number | undefined };
  if (rail === 'long') return { rails: [top], hangs: [{ y: top, bottom: top - PLAN.hangLong, length: PLAN.hangLong, kind: 'long' as const }], shelfTop: top - PLAN.hangLong, fromTop, lowerFromTop: undefined };
  if (rail === 'short') return { rails: [top], hangs: [{ y: top, bottom: top - PLAN.hangShort, length: PLAN.hangShort, kind: 'short' as const }], shelfTop: top - PLAN.hangShort, fromTop, lowerFromTop: undefined };
  // Double: the lower rail halves the space under the top rail (CabinetOS's bottomRailPositionFromTopMm).
  const lowerFromTop = Math.round(usableTop - (floor + (top - floor) / 2));
  const lower = usableTop - lowerFromTop;
  return {
    rails: [lower, top],
    hangs: [
      { y: top, bottom: top - PLAN.hangDouble, length: PLAN.hangDouble, kind: 'short' as const },
      { y: lower, bottom: lower - PLAN.hangDouble, length: PLAN.hangDouble, kind: 'short' as const },
    ],
    shelfTop: lower - PLAN.hangDouble,
    fromTop,
    lowerFromTop,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lays out one CabinetOS unit and says whether it builds as drawn. */
export function unitLayout(box: UnitBox, ins: Inside): Layout {
  const t = COS.board;
  const { w, boxH, d } = box;
  const rail = ins.rail;
  const drawers = clamp(Math.round(ins.drawers), 0, PLAN.maxDrawers);
  const below = drawers > 0 && ins.below && !box.sliding;
  // Long and double hanging take the shelf space (CabinetOS only shows shelves above a full-length rail).
  const shelvesAsked = rail === 'long' || rail === 'double' ? 0 : clamp(Math.round(ins.shelves), 0, PLAN.maxShelves);

  const drawerZone = drawers ? drawers * PLAN.drawerPitch : 0;
  const innerTop = boxH - t;
  // A dust shelf goes straight on top of the drawers (CabinetOS drawerBank.dustShelfEnabled), and the shelf space
  // starts on top of it (getShelfInteriorBoundsFromMetrics): else on the bottom panel.
  const dust = drawerZone > 0 && drawerZone + COS.dustShelf <= innerTop ? drawerZone + COS.dustShelf / 2 : null;
  const floor = drawerZone > 0 ? Math.min(drawerZone + (dust != null ? COS.dustShelf : 0), innerTop) : t;
  // Hanging goes under a shelf at PLAN.hatShelf from the floor when there's room above it; else under the top.
  const hatTop = rail !== 'none' && box.hat != null && innerTop - box.hat >= PLAN.hatMinAbove ? box.hat : null;
  const R = railsFor(rail, boxH, floor, hatTop != null ? hatTop - t : innerTop);
  const shelfTop = Math.min(innerTop, R.shelfTop);

  const own = shelvesAsked > 0 && shelfTop - floor > shelvesAsked * t ? spread(floor, shelfTop, shelvesAsked, rail) : [];
  const shelfGap = own.length ? r2((shelfTop - floor - own.length * t) / (own.length + 1)) : null;
  // The shelf over the hanging, and in a tall room as few more over it as keep the gaps up to PLAN.aboveGap.
  let above = 0;
  if (hatTop != null) while ((innerTop - hatTop - above * t) / (above + 1) > PLAN.aboveGap) above++;
  const hatShelves = hatTop != null ? [hatTop - t / 2, ...wholeMm(hatTop, innerTop, above)] : [];
  const shelves = [...own, ...hatShelves];

  // Drawer fronts (calcDrawerBank): the zone less the top gap and the gaps between, shared equally.
  const drawerFront = drawers ? (drawerZone - COS.drawerTopGap - (drawers - 1) * COS.drawerBetweenGap - COS.drawerBottomGap) / drawers : 0;
  const drawerFronts: Front[] = [];
  for (let i = 0; i < drawers; i++) {
    const y0 = COS.drawerBottomGap + i * (drawerFront + COS.drawerBetweenGap);
    // Behind the doors they stand inside the sides with the hinge clearance; below the doors, full width.
    drawerFronts.push(below ? { x0: 0, x1: w, y0, y1: y0 + drawerFront } : { x0: t + COS.hingeClearance, x1: w - t - COS.hingeClearance, y0: Math.max(t, y0), y1: y0 + drawerFront });
  }

  // Doors (getDoorSizingForHeight, elevationDoorsMm): one row from the drawer zone (or the bottom) to the box top
  // less the top gap; a top box has its own row.
  const n = doorCountFor(w);
  const doorW = r2(w / n - COS.doorSideGap);
  const gap = n === 2 ? COS.doorSideGap : 0;
  const x0 = (w - (n * doorW + (n - 1) * gap)) / 2;
  const row = (y0: number, y1: number): Front[] =>
    Array.from({ length: n }, (_, i) => ({ x0: x0 + i * (doorW + gap), x1: x0 + i * (doorW + gap) + doorW, y0, y1, hingeLeft: n === 1 ? box.hingeLeft : i < n / 2 }));
  const doorBottom = below ? drawerZone : 0;
  const doorH = r2(boxH - COS.doorTopGap - doorBottom);
  const doors = box.sliding ? [] : row(doorBottom, boxH - COS.doorTopGap);
  // Top cupboards keep hinged doors even when the doors below slide.
  const topH = box.topH && box.topH > 0 ? box.topH : 0;
  if (topH) doors.push(...row(boxH, boxH + topH - COS.doorTopGap));

  const problems = check({ w, boxH, floor, innerTop, rail, R, shelves: own.length, shelvesAsked, shelfGap, shelfTop, drawers, doorH: below ? doorH : null });

  const cosRail: CosSettings['hangingRail'] =
    rail === 'none'
      ? { enabled: false, railType: 'full_length', positionFromTopMm: COS.railFromTop, diameterMm: COS.railDiameter }
      : rail === 'double'
        ? { enabled: true, railType: 'double', positionFromTopMm: R.fromTop, bottomRailPositionFromTopMm: R.lowerFromTop, diameterMm: COS.railDiameter }
        : { enabled: true, railType: rail === 'long' ? 'full_length' : 'half_length', positionFromTopMm: R.fromTop, diameterMm: COS.railDiameter };
  // Shelves under a short rail and the shelf over the hanging sit at set heights (CabinetOS "custom": each the clear
  // gap from the bottom of the shelf space to the shelf's underside); otherwise CabinetOS spreads them evenly itself.
  const custom = (rail === 'short' && own.length > 0) || hatShelves.length > 0;
  const cos: CosSettings = {
    hangingRail: cosRail,
    shelvesCount: shelves.length,
    shelfDistributionMode: custom ? 'custom' : 'equal',
    ...(custom ? { customShelfOffsetsFromBottomMm: shelves.map((c) => Math.round(c - t / 2 - floor)) } : {}),
    firstShelfOffsetMm: 0,
    frontConfig: drawers ? (below ? 'doors_drawers_external' : 'doors_drawers_internal') : 'doors',
    drawerCount: drawers || 3,
    drawerZoneHeightMm: drawers ? drawerZone : 600,
    drawerBank: { dustShelfEnabled: dust != null, dustShelfThicknessMm: COS.dustShelf, dustShelfGapMm: 0 },
    doorCount: n,
    ...(n === 1 ? { doorHinge: box.hingeLeft ? ('left' as const) : ('right' as const) } : {}),
  };

  // Would one more shelf or drawer still build as drawn?
  const fits = (more: Partial<Inside>) => {
    const next = { ...ins, shelves: own.length, drawers, ...more };
    if (next.shelves > PLAN.maxShelves || next.drawers > PLAN.maxDrawers) return false;
    const l = unitLayout({ ...box }, next);
    return l.problems.length === 0 && l.ownShelves === (next.rail === 'long' || next.rail === 'double' ? 0 : next.shelves);
  };

  return {
    w,
    boxH,
    inner: { bottom: t, top: innerTop },
    drawerZone,
    floor,
    dust,
    hat: hatTop != null ? hatTop - t / 2 : null,
    above,
    ownShelves: own.length,
    drawerFront: r2(drawerFront),
    drawers: drawerFronts,
    drawersBelow: below,
    shelves,
    shelfGap,
    rails: R.rails,
    hangs: R.hangs.map((h) => ({ ...h, bottom: Math.max(floor, h.bottom) })),
    doors,
    doorCount: n,
    sizes: {
      door: { n: box.sliding ? 0 : n, w: doorW, h: doorH },
      topDoor: topH ? { n, w: doorW, h: r2(topH - COS.doorTopGap) } : null,
      shelf: { n: shelves.length, w: r2(w - 2 * t - 2 * COS.shelfSideGap), d: r2(d - COS.back - COS.shelfFrontGap) },
      drawer: drawers ? { n: drawers, h: r2(drawerFront) } : null,
      dust: dust != null,
      box: { w, h: boxH, d },
    },
    problems,
    canAddShelf: rail !== 'long' && rail !== 'double' && problems.length === 0 ? fitsLazy(() => fits({ shelves: own.length + 1 })) : false,
    // One more drawer may take a shelf or two out to make room (the planner does that when it's added).
    canAddDrawer: problems.length === 0 ? fitsLazy(() => Array.from({ length: own.length + 1 }, (_, k) => own.length - k).some((k) => fits({ drawers: drawers + 1, shelves: k }))) : false,
    cos,
  };
}

// The "one more" checks lay the unit out again; they stop at one level so they never recurse further.
let depth = 0;
function fitsLazy(f: () => boolean) {
  if (depth > 0) return false;
  depth++;
  try {
    return f();
  } finally {
    depth--;
  }
}

/** Shelf centres between the faces lo and hi. Under a rail they're rounded to whole mm (as sent to CabinetOS). */
function spread(lo: number, hi: number, n: number, rail: Rail): number[] {
  return rail === 'none' ? evenCentres(lo, hi, n) : wholeMm(lo, hi, n);
}
/** Even shelf centres between lo and hi, each a whole number of mm above lo (CabinetOS's custom offsets are whole mm). */
function wholeMm(lo: number, hi: number, n: number): number[] {
  const t = COS.board;
  return evenCentres(lo, hi, n).map((y) => lo + Math.round(y - t / 2 - lo) + t / 2);
}

function check(a: {
  w: number;
  boxH: number;
  floor: number;
  innerTop: number;
  rail: Rail;
  R: ReturnType<typeof railsFor>;
  shelves: number;
  shelvesAsked: number;
  shelfGap: number | null;
  shelfTop: number;
  drawers: number;
  doorH: number | null;
}): string[] {
  const out: string[] = [];
  const mm = (n: number) => `${Math.round(n)} mm`;
  if (a.drawers && a.w < PLAN.minDrawerWidth) out.push(`Too narrow for drawers: under ${PLAN.minDrawerWidth} mm. Take them out.`);
  else if (a.drawers && a.floor >= a.innerTop - 100) out.push(`No room for ${plural(a.drawers, 'drawer', 'drawers')}. Take some out.`);
  else if (a.doorH != null && a.doorH < 300) out.push(`The doors over the drawers would be only ${mm(a.doorH)} high. Take a drawer out.`);
  if (a.rail !== 'none') {
    if (a.w < PLAN.minHangWidth) out.push(`Too narrow for hanging: under ${PLAN.minHangWidth} mm, hangers don't fit across.`);
    for (const h of a.R.hangs) {
      const room = h.y - (a.rail === 'double' && h === a.R.hangs[0] ? a.R.rails[0]! : a.floor);
      if (room < h.length - 0.5) {
        const what = a.rail === 'long' ? 'Long hanging' : a.rail === 'double' ? 'Double hanging' : 'Short hanging';
        out.push(`${what} needs ${mm(h.length)} under ${a.rail === 'double' ? 'each rail' : 'the rail'}; this unit has ${mm(Math.max(0, room))}.${a.drawers ? ' Take a drawer out.' : ''}`);
        break;
      }
    }
  }
  if (a.shelvesAsked > 0 && a.shelves < a.shelvesAsked) out.push(`No room for ${plural(a.shelvesAsked, 'shelf', 'shelves')} here. Take some out.`);
  else if (a.shelfGap != null && a.shelfGap < PLAN.minShelfGap - 0.5) out.push(`Shelves only ${mm(a.shelfGap)} apart. Take one out (${PLAN.minShelfGap} mm at least).`);
  return out;
}

/* ---------------------------------------------------------------- presets and words */

export type PresetKey = 'long' | 'double' | 'short' | 'drawhang' | 'drawers' | 'shelves' | 'pair';
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'long', label: 'Long hanging' },
  { key: 'double', label: 'Double hanging' },
  { key: 'short', label: 'Short hanging + shelves' },
  { key: 'drawhang', label: 'Drawers + short hanging' },
  { key: 'drawers', label: 'Drawers + shelves' },
  { key: 'shelves', label: 'Shelves' },
  { key: 'pair', label: 'Hanging beside drawers' },
];

/** What each preset puts inside (the pair: the two halves, long hanging on the left, drawers and shelves on the right). */
export function presetInside(key: Exclude<PresetKey, 'pair'>): Inside {
  switch (key) {
    case 'long':
      return { rail: 'long', shelves: 0, drawers: 0, below: false };
    case 'double':
      return { rail: 'double', shelves: 0, drawers: 0, below: false };
    case 'short':
      return { rail: 'short', shelves: 3, drawers: 0, below: false };
    case 'drawhang':
      return { rail: 'short', shelves: 0, drawers: 3, below: false };
    case 'drawers':
      return { rail: 'none', shelves: 3, drawers: 3, below: false };
    default:
      return { rail: 'none', shelves: 5, drawers: 0, below: false };
  }
}
export const PAIR: [Inside, Inside] = [presetInside('long'), presetInside('drawers')];

/** Which preset an inside matches, if any. */
export function presetOf(ins: Inside): Exclude<PresetKey, 'pair'> | null {
  for (const k of ['long', 'double', 'short', 'drawhang', 'drawers', 'shelves'] as const) {
    const p = presetInside(k);
    if (p.rail === ins.rail && p.shelves === ins.shelves && p.drawers === ins.drawers && (!p.drawers || p.below === ins.below)) return k;
  }
  return null;
}

/** "Short hanging under a shelf, 3 shelves", "3 drawers inside, 3 shelves", "Long hanging, 2 drawers below the door",
    "Long hanging under a shelf, 1 more shelf at the top" (a tall room). */
export function insideText(ins: Inside, l?: Pick<Layout, 'ownShelves' | 'drawersBelow' | 'doorCount' | 'hat' | 'above'>): string {
  const shelves = l ? l.ownShelves : ins.rail === 'long' || ins.rail === 'double' ? 0 : ins.shelves;
  const below = l ? l.drawersBelow : ins.below;
  const parts: string[] = [];
  if (ins.rail !== 'none') parts.push(`${ins.rail === 'long' ? 'long' : ins.rail === 'short' ? 'short' : 'double'} hanging${l && l.hat != null ? ' under a shelf' : ''}`);
  if (ins.drawers) parts.push(`${plural(ins.drawers, 'drawer', 'drawers')} ${below ? `below the door${l && l.doorCount === 1 ? '' : 's'}` : 'inside'}`);
  if (shelves) parts.push(plural(shelves, 'shelf', 'shelves'));
  if (l && l.hat != null && l.above) parts.push(`${l.above} more ${l.above === 1 ? 'shelf' : 'shelves'} at the top`);
  const s = parts.join(', ') || 'empty, no shelves';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------------------------------------------------------------- sections → CabinetOS units */

/** "Hanging beside drawers" is two units side by side (CabinetOS has no divider with a different inside each side);
    the left half takes the odd mm less, as the CabinetOS mapper always did. */
export function splitWidths(w: number): [number, number] {
  const a = Math.floor(w / 2);
  return [a, w - a];
}
export const canSplit = (w: number) => Math.floor(w / 2) >= PLAN.splitMin;

/** The space as the planner holds it, for runFor(). */
export type RunSpace = {
  ceiling: number;
  plinth: number;
  infill: number; // top infill (0 when freestanding)
  free: boolean;
  freeH: number; // freestanding unit height
  topCupboards: boolean;
  topSplit: number; // where the top cupboards start, from the floor (PLAN.hatShelf)
  depth: number; // overall depth including the doors
  sliding: boolean;
};

/** CabinetOS's carcass depth: the planner's depth less 18 mm hinged doors, or about 85 mm for sliding doors and
    their track (the CabinetOS mapper's own sum). */
export const carcassDepth = (depth: number, sliding: boolean) => Math.max(300, depth - (sliding ? 85 : 18));

/** The units' height: floor to ceiling less the plinth and top infill (fitted), or the unit's own height
    (freestanding); with top cupboards the base box runs to topSplit and the top box above it. */
export function runFor(s: RunSpace): RunBox & { top: number } {
  const top = s.free ? s.freeH : s.ceiling - s.infill;
  const withTop = s.topCupboards && top - s.topSplit >= 250;
  const boxH = (withTop ? s.topSplit : top) - s.plinth;
  return { boxH, topH: withTop ? top - s.topSplit : 0, d: carcassDepth(s.depth, s.sliding), sliding: s.sliding, hat: PLAN.hatShelf - s.plinth, top };
}

/** A unit as the customer sets it up: one width, and either one inside or two halves. */
export type Section = { w: number; custom?: boolean; inside: Inside; split?: [Inside, Inside] | null };
/** The run the units stand in: their carcass height, top box, depth, doors. */
export type RunBox = { boxH: number; topH?: number; d: number; sliding?: boolean; hat?: number };

export type Piece = {
  section: number; // index of the section it belongs to
  part: '' | 'a' | 'b';
  label: string; // "Unit 2a"
  x: number; // mm from the left of the first unit
  w: number;
  inside: Inside;
  layout: Layout;
};

/** Every CabinetOS unit of the run, left to right. A single door's hinge alternates from unit to unit (left first);
    the two halves of a pair hinge on their outer sides, so they open like a pair of doors. */
export function planPieces(sections: Section[], run: RunBox): Piece[] {
  const out: Piece[] = [];
  let x = 0;
  sections.forEach((s, i) => {
    const halves: [Inside, number, '' | 'a' | 'b', boolean | null][] = s.split && canSplit(s.w)
      ? [[s.split[0], splitWidths(s.w)[0], 'a', true], [s.split[1], splitWidths(s.w)[1], 'b', false]]
      : [[s.inside, s.w, '', null]];
    for (const [inside, w, part, hinge] of halves) {
      const hingeLeft = hinge ?? out.length % 2 === 0;
      const layout = unitLayout({ w, boxH: run.boxH, topH: run.topH, d: run.d, hingeLeft, sliding: run.sliding, hat: run.hat }, inside);
      out.push({ section: i, part, label: `Unit ${i + 1}${part}`, x, w, inside, layout });
      x += w;
    }
  });
  return out;
}

/** The old (version 1) layout word for a section, for a CabinetOS that hasn't got the settings yet. */
export function legacyLayout(s: Section): 'double' | 'long' | 'longdrw' | 'short' | 'drawers' | 'shelves' {
  if (s.split && canSplit(s.w)) return 'longdrw';
  const r = s.inside.rail;
  if (r === 'long' || r === 'double' || r === 'short') return r;
  return s.inside.drawers ? 'drawers' : 'shelves';
}

/** The units as they go to CabinetOS (design version 2): each section with its CabinetOS units and their settings. */
export function payloadUnits(sections: Section[], run: RunBox) {
  const pieces = planPieces(sections, run);
  return sections.map((s, i) => ({
    widthMm: s.w,
    custom: !!s.custom,
    layout: legacyLayout(s),
    pieces: pieces
      .filter((p) => p.section === i)
      .map((p) => ({ part: p.part, widthMm: p.w, text: insideText(p.inside, p.layout), cos: p.layout.cos })),
  }));
}
