/* How CabinetOS sizes the parts of a wardrobe, for the "How CabinetOS works out the sizes" section of the
   CabinetOS page. The numbers are CabinetOS's own starting settings (cabinetos-site src/lib/cabinetRules.ts,
   "single source of truth") and the sums are the ones its cut list uses (generateParts in
   src/components/pages/CabinetApp.tsx, getDoorSizingForHeight in src/lib/viewportGeometry.ts), with the app's
   default build: top and bottom over the sides ("ABOVE_SIDES"), back fitted inside the box ("BETWEEN_ALL").
   Checked on 12 Oct 2026 by running CabinetOS's own generateParts beside wardrobeParts() for 500 random sizes
   (every part, its length and width as listed, its edging and the edging total equal). If the app's rules change, change them here too. */

export const COS_RULES = {
  boardMm: 18, // DEFAULT_PANEL_THICKNESS_MM
  backMm: 18, // DEFAULT_BACK_THICKNESS_MM
  plinthMm: 100, // DEFAULT_BASE_HEIGHT_MM
  doorTopGapMm: 3, // DOOR_TOP_GAP_MM
  doorBottomGapMm: 0, // DOOR_BOTTOM_GAP_MM
  doorGapMm: 4, // DOOR_SIDE_GAP_MM: taken off each door's width, so 2 mm at each outside edge and 4 between a pair
  maxDoorMm: 600, // MAX_DOOR_WIDTH_MM: a wider door gets a warning ("Too wide for one door, try 2")
  shelfSideGapMm: 2, // SHELF_SIDE_GAP_MM, each side
  shelfFrontGapMm: 2, // SHELF_FRONT_GAP_MM
} as const;

/** One row of the cut list, as CabinetOS lists it: length x width (L x W), and which edges get edging tape
    (L1, L2 along the length, W1, W2 along the width). */
export type CosPart = {
  key: string;
  name: string;
  qty: number;
  length: number;
  width: number;
  hardware?: boolean;
  edges: { L1: boolean; L2: boolean; W1: boolean; W2: boolean };
  how: string;
};

const r = (n: number) => Math.round(n * 100) / 100; // CabinetOS rounds to 0.01 mm
const mm = (n: number) => String(r(n));

export function doorCount(widthMm: number) {
  return widthMm - COS_RULES.doorGapMm <= COS_RULES.maxDoorMm ? 1 : 2;
}

/** A wardrobe with doors, one shelf and a hanging rail, sized the way the CabinetOS cut list sizes it. */
export function wardrobeParts(widthMm: number, heightMm: number, depthMm: number): CosPart[] {
  const R = COS_RULES;
  const t = R.boardMm;
  const box = heightMm - R.plinthMm;
  const side = box - 2 * t;
  const inner = widthMm - 2 * t;
  const doors = doorCount(widthMm);
  const doorW = widthMm / doors - R.doorGapMm;
  const doorH = box - R.doorTopGapMm - R.doorBottomGapMm;
  const shelfW = inner - 2 * R.shelfSideGapMm;
  const shelfD = depthMm - R.backMm - R.shelfFrontGapMm;
  const front = { L1: true, L2: false, W1: false, W2: false };
  const none = { L1: false, L2: false, W1: false, W2: false };
  const all = { L1: true, L2: true, W1: true, W2: true };
  return [
    { key: 'top', name: 'Top', qty: 1, length: widthMm, width: depthMm, edges: front, how: 'Full width × full depth' },
    { key: 'bottom', name: 'Bottom', qty: 1, length: widthMm, width: depthMm, edges: front, how: 'Same as the top' },
    {
      key: 'side',
      name: 'Side',
      qty: 2,
      length: r(side),
      width: depthMm,
      edges: front,
      how: `${heightMm} − ${R.plinthMm} plinth − ${t} top − ${t} bottom = ${mm(side)}`,
    },
    {
      key: 'back',
      name: 'Back',
      qty: 1,
      length: r(inner),
      width: r(side),
      edges: none,
      how: `${widthMm} − ${t} − ${t} sides = ${mm(inner)} wide; as high as a side`,
    },
    { key: 'plinth', name: 'Plinth', qty: 1, length: widthMm, width: R.plinthMm, edges: none, how: `Full width × ${R.plinthMm}` },
    {
      key: 'shelf',
      name: 'Shelf',
      qty: 1,
      length: r(shelfW),
      width: r(shelfD),
      edges: front,
      how: `${mm(inner)} − ${R.shelfSideGapMm} − ${R.shelfSideGapMm} = ${mm(shelfW)} wide; ${depthMm} − ${R.backMm} back − ${R.shelfFrontGapMm} = ${mm(shelfD)} deep`,
    },
    {
      key: 'door',
      name: 'Door',
      qty: doors,
      length: r(doorH),
      width: r(doorW),
      edges: all,
      how:
        `${box} box − ${R.doorTopGapMm} top gap = ${mm(doorH)} high; ` +
        (doors === 2 ? `${widthMm} ÷ 2 − ${R.doorGapMm} = ${mm(doorW)} wide` : `${widthMm} − ${R.doorGapMm} = ${mm(doorW)} wide`),
    },
    {
      key: 'rail',
      name: 'Hanging rail',
      qty: 1,
      length: r(shelfW),
      width: 25,
      hardware: true,
      edges: none,
      how: 'As long as the shelf',
    },
  ];
}

/** Edging tape for the parts, in mm: the app's own sum (totalEdgeBandingLinearMm). */
export function edgingMm(parts: CosPart[]) {
  let total = 0;
  for (const p of parts) {
    if (p.edges.L1) total += p.length * p.qty;
    if (p.edges.L2) total += p.length * p.qty;
    if (p.edges.W1) total += p.width * p.qty;
    if (p.edges.W2) total += p.width * p.qty;
  }
  return r(total);
}

/** The worked example on the page. */
export const EXAMPLE = { widthMm: 900, heightMm: 2100, depthMm: 600 } as const;
