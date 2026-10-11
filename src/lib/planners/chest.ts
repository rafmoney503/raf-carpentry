/* Chest of drawers planner (Job Kit design request). Raf asked for it 11 Oct 2026. Self-contained (no
   runtime imports) so scripts/planner-plan.mjs can run it with node. 'suggested' numbers are Claude's
   starting points until Raf gives his own. All mm. */

export type ChestSpec = {
  kind: 'chest';
  width: number;
  height: number;
  depth: number;
  columns: 1 | 2 | 3;
  rows: number; // drawers down each column
  topSplit: boolean; // top row in two small drawers (one column only)
  graduated: boolean; // deeper drawers lower down
  base: 'plinth' | 'legs' | 'none';
  handles: 'knobs' | 'bars' | 'push';
};

export const CHEST_RULES = {
  board: 18,
  top: 25,
  plinth: 80, // suggested
  legs: 120, // suggested
  gap: 3,
  minFront: 110, // suggested: shallower fronts give a warning
};

export function newChest(w?: number, h?: number, d?: number): ChestSpec {
  return {
    kind: 'chest',
    width: w && w > 0 ? w : 900, // suggested
    height: h && h > 0 ? h : 850, // suggested
    depth: d && d > 0 ? d : 450, // suggested
    columns: 1,
    rows: 4,
    topSplit: false,
    graduated: true,
    base: 'plinth',
    handles: 'knobs',
  };
}

export type Front = { x0: number; x1: number; z0: number; z1: number };
export type ChestPlan = { baseH: number; bodyTop: number; fronts: Front[]; problems: string[] };

export function planChest(s: ChestSpec): ChestPlan {
  const R = CHEST_RULES;
  const problems: string[] = [];
  const baseH = s.base === 'plinth' ? R.plinth : s.base === 'legs' ? R.legs : 0;
  const bodyTop = s.height - R.top;
  const z0 = baseH;
  const H = bodyTop - z0;
  const rows = Math.max(1, s.rows);
  // graduated: each row down is 15% deeper than the one above
  const weights = Array.from({ length: rows }, (_, i) => (s.graduated ? 1 + 0.15 * (rows - 1 - i) : 1)); // i = 0 is the bottom row
  const total = weights.reduce((a, b) => a + b, 0);
  const cols = s.columns;
  const colW = s.width / cols;
  const fronts: Front[] = [];
  let z = z0;
  weights.forEach((wt, i) => {
    const h = (H * wt) / total;
    const topRow = i === rows - 1;
    const split = topRow && s.topSplit && cols === 1 ? 2 : cols;
    const w = s.width / split;
    for (let c = 0; c < split; c++) fronts.push({ x0: c * w + R.gap / 2, x1: (c + 1) * w - R.gap / 2, z0: z + R.gap / 2, z1: z + h - R.gap / 2 });
    if (h - R.gap < R.minFront) problems.push(`Drawer fronts only ${Math.round(h - R.gap)} mm high: fewer drawers?`);
    z += h;
  });
  if (colW < 300) problems.push(`Columns only ${Math.round(colW)} mm wide.`);
  return { baseH, bodyTop, fronts, problems: [...new Set(problems)] };
}

export function chestLines(s: ChestSpec): string[] {
  const p = planChest(s);
  return [
    `Chest of drawers ${s.width} wide, ${s.height} high, ${s.depth} deep`,
    `${s.columns} column${s.columns === 1 ? '' : 's'} of ${s.rows} drawers${s.topSplit && s.columns === 1 ? ', top row split in two' : ''}${s.graduated ? ', deeper towards the bottom' : ', all the same'}`,
    `Base: ${s.base === 'none' ? 'none' : s.base}. Handles: ${s.handles === 'push' ? 'push to open' : s.handles}.`,
    ...(p.problems.length ? [`Planner warnings: ${p.problems.join(' ')}`] : []),
  ];
}

export function chestSummary(s: ChestSpec) {
  const p = planChest(s);
  const handle = { knobs: 'wooden knobs', bars: 'bar handles', push: 'push to open' }[s.handles];
  const n = p.fronts.length;
  const text = `A chest of ${n} drawers${s.columns > 1 ? ` in ${s.columns} columns` : ''}${s.topSplit && s.columns === 1 ? ', two small ones at the top' : ''}${s.graduated ? ', deeper towards the bottom' : ''}, with ${handle}${s.base === 'legs' ? ', on legs' : s.base === 'plinth' ? ', on a plinth' : ''}.`;
  const sizes = [
    { label: 'Width', value: `${s.width} mm` },
    { label: 'Height', value: `${s.height} mm` },
    { label: 'Depth', value: `${s.depth} mm` },
    { label: 'Drawers', value: String(n) },
  ];
  return { text, sizes, problems: p.problems, title: 'Chest of drawers' };
}
