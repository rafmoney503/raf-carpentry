/* The batten grid calculator on a wall panelling job page (8 Nov 2026, Raf: "Add to this job wall panelling
   calculator nicely somewhere in this job page", on /portfolio/wall-panelling-barnet). No imports, so the check
   (scripts/panelling-calc/check.mjs) and the page read the same sums.

   The grid is the Workshop Tools app's batten grid (panelCalc in scripts/workshop-tools/Main.dc.html), for one wall:
   a rail along the bottom and the top (and one between each row), uprights between them, the openings all the same.
   The check compares every answer here with the app's own panelCalc, so the two can't drift apart.

   What's added here: the cutting. The app buys battens by the metre plus 10%; here the rails are cut into pieces
   that join over an upright (the middle of one, so each piece covers half of it) and the pieces and uprights are laid
   out on the lengths, with 3 mm for each saw cut, so the number to buy is the number the cuts really take. */

export type GridFrom = 'floor' | 'skirting';

export type GridInput = {
  /** wall width, mm */
  w: number;
  /** from the floor: the panelling's height; above the skirting: the top of the panelling from the floor */
  h: number;
  /** batten width, mm */
  batten: number;
  /** panels across; 0 = worked out from the panel size aimed for (target) */
  panels: number;
  /** rows of panels, 1 to 4 */
  rows: number;
  from: GridFrom;
  /** skirting height and the gap above it, mm (above the skirting only) */
  skirting: number;
  gap: number;
};

export const GRID = {
  /** the panel width aimed for when Panels is on Auto (the app's AIM FOR PANELS OF) */
  target: 500,
  /** batten lengths sold, mm */
  stock: 2440,
  /** the app's spare on the metres, % */
  waste: 10,
  /** each saw cut, mm */
  kerf: 3,
  maxPanels: 40,
  maxRows: 4,
};

export type Piece = { kind: 'rail' | 'upright'; len: number };
export type Length = { pieces: Piece[]; used: number; left: number };

export type Grid = {
  error: string;
  input: GridInput;
  W: number;
  /** the top of the panelling from the floor */
  H: number;
  /** the grid's own height (H less the skirting and the gap) */
  G: number;
  /** the underside of the bottom rail from the floor */
  base: number;
  B: number;
  rows: number;
  /** panels across, and what Auto would give */
  n: number;
  autoN: number;
  /** each opening */
  openW: number;
  openH: number;
  /** each upright's left edge from the left end of the wall */
  ups: number[];
  /** where each rail joins (from the left end): over an upright when one is in reach */
  joins: number[];
  /** a join that couldn't go over an upright (an opening wider than a length) */
  joinOffUpright: boolean;
  rails: number;
  uprights: number;
  railPieces: number[];
  /** all the batten, mm, before any spare */
  total: number;
  /** the app's way: the metres plus 10%, in lengths */
  lengthsByMetre: number;
  /** the lengths the cuts take, each with its pieces */
  lengths: Length[];
  panelsAll: number;
};

export const GRID_START: GridInput = { w: 4105, h: 1000, batten: 69, panels: 6, rows: 1, from: 'floor', skirting: 100, gap: 0 };

/** "4,105", "4105 mm", "603.7" or "603,7" -> mm; null if it isn't a number */
export function readMm(t: string): number | null {
  let s = String(t ?? '').trim().toLowerCase().replace(/mm$/, '').trim();
  if (!s) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** one decimal, as the app shows it: 603.7, 862, 1345.3 */
export const mm1 = (v: number) => String(Math.round(v * 10) / 10);
/** a long number with a thousands comma: 4,105 */
export const mmc = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 });

function empty(input: GridInput, error: string): Grid {
  return {
    error,
    input,
    W: input.w,
    H: input.h,
    G: NaN,
    base: 0,
    B: input.batten,
    rows: input.rows,
    n: 0,
    autoN: 0,
    openW: NaN,
    openH: NaN,
    ups: [],
    joins: [],
    joinOffUpright: false,
    rails: 0,
    uprights: 0,
    railPieces: [],
    total: 0,
    lengthsByMetre: 0,
    lengths: [],
    panelsAll: 0,
  };
}

/** Each rail cut into pieces no longer than a length, joined over the middle of an upright: from the left, each
 *  join as far along as a length reaches (the fewest joins). An opening wider than a length leaves no upright in
 *  reach, so that join goes between uprights. */
export function railJoins(W: number, centres: number[], stock: number): { joins: number[]; off: boolean } {
  const joins: number[] = [];
  let off = false;
  let start = 0;
  while (W - start > stock + 1e-6) {
    const reach = start + stock + 1e-6;
    const over = centres.filter((c) => c > start + 1e-6 && c <= reach && c < W - 1e-6);
    let j: number;
    if (over.length) j = over[over.length - 1];
    else {
      j = start + stock;
      off = true;
    }
    joins.push(j);
    start = j;
  }
  return { joins, off };
}

/** The pieces laid out on lengths, longest first, each into the first length it fits (a saw cut between pieces). */
export function layOut(pieces: Piece[], stock: number, kerf: number): Length[] {
  const sorted = [...pieces].sort((a, b) => b.len - a.len || (a.kind === b.kind ? 0 : a.kind === 'rail' ? -1 : 1));
  const out: Length[] = [];
  for (const p of sorted) {
    let at = out.find((l) => l.used + kerf + p.len <= stock + 1e-6);
    if (!at) {
      at = { pieces: [], used: -kerf, left: 0 };
      out.push(at);
    }
    at.pieces.push(p);
    at.used += kerf + p.len;
  }
  for (const l of out) l.left = stock - l.used;
  return out;
}

export function grid(input: GridInput): Grid {
  const { w: W, h: H, batten: B, rows } = input;
  const fromSk = input.from === 'skirting';
  const SK = fromSk ? input.skirting : 0;
  const GP = fromSk ? input.gap : 0;
  const base = SK + GP;
  const G = H - base;
  const nums = [W, H, B, SK, GP];
  if (nums.some((x) => !Number.isFinite(x)) || B < 10) return empty(input, 'Check the numbers: one of the boxes is empty or not a number.');
  if (SK < 0 || GP < 0) return empty(input, 'The skirting and the gap can’t be below 0.');
  if (G < 150)
    return empty(
      input,
      fromSk
        ? `Only ${mm1(Math.max(0, G))} mm from the bottom rail to the top. The grid needs at least 150: raise the top, or lower the skirting or the gap.`
        : 'The panelling needs to be at least 150 mm high.',
    );
  const openH = (G - (rows + 1) * B) / rows;
  if (openH < 20) return empty(input, 'Too many rows for this height. Use fewer rows.');
  if (W < 300) return empty(input, 'The wall needs to be at least 300 mm wide.');
  const autoN = Math.max(1, Math.round((W - B) / (GRID.target + B)));
  const n = input.panels > 0 ? Math.round(input.panels) : autoN;
  const openW = (W - (n + 1) * B) / n;
  if (openW < 20) return { ...empty(input, 'Too many panels: the openings come out under 20 mm. Use fewer panels.'), autoN, n };
  if (openH > GRID.stock) return { ...empty(input, `Each upright comes out longer than a ${mmc(GRID.stock)} length. Use two rows.`), autoN, n };

  const ups: number[] = [];
  for (let k = 0; k <= n; k++) ups.push(k * (openW + B));
  const centres = ups.map((x) => x + B / 2);
  const { joins, off } = railJoins(W, centres, GRID.stock);
  const edges = [0, ...joins, W];
  const railPieces = edges.slice(1).map((x, i) => x - edges[i]);
  const rails = rows + 1;
  const uprights = (n + 1) * rows;
  const total = rails * W + uprights * openH;
  const lengthsByMetre = Math.ceil((total * (1 + GRID.waste / 100)) / GRID.stock);
  const pieces: Piece[] = [];
  for (let r = 0; r < rails; r++) for (const len of railPieces) pieces.push({ kind: 'rail', len });
  for (let u = 0; u < uprights; u++) pieces.push({ kind: 'upright', len: openH });
  const lengths = layOut(pieces, GRID.stock, GRID.kerf);
  return {
    error: '',
    input,
    W,
    H,
    G,
    base,
    B,
    rows,
    n,
    autoN,
    openW,
    openH,
    ups,
    joins,
    joinOffUpright: off,
    rails,
    uprights,
    railPieces,
    total,
    lengthsByMetre,
    lengths,
    panelsAll: n * rows,
  };
}

/** what the grid takes, as text: Copy the list and WhatsApp */
export function gridText(g: Grid, page: string): string {
  if (g.error) return '';
  const pieceLine = (len: number, count: number, what: string) => `${count} × ${mm1(len)} mm ${what}`;
  const railCounts = new Map<string, number>();
  for (const p of g.railPieces) railCounts.set(mm1(p), (railCounts.get(mm1(p)) ?? 0) + g.rails);
  const lines = [
    `Batten grid: ${mmc(g.W)} wide, ${mmc(g.H)} high${g.input.from === 'skirting' ? ' from the floor' : ''}, ${mm1(g.B)} mm battens`,
    `${g.n} panels across${g.rows > 1 ? `, ${g.rows} rows` : ''}: each opening ${mm1(g.openW)} × ${mm1(g.openH)} mm`,
  ];
  if (g.input.from === 'skirting') lines.push(`Bottom rail at ${mm1(g.base)} from the floor${g.input.gap > 0 ? `, ${mm1(g.input.gap)} above the skirting` : ', on the skirting'}`);
  lines.push(`Uprights, left edge from the left end: ${g.ups.map(mm1).join(', ')}`);
  lines.push('Cut:');
  for (const [len, count] of railCounts) lines.push(`- ${pieceLine(Number(len), count, 'rail')}`);
  lines.push(`- ${pieceLine(g.openH, g.uprights, 'uprights')}`);
  if (g.joins.length) lines.push(`Rails join at ${g.joins.map(mm1).join(', ')} from the left${g.joinOffUpright ? '' : ', over an upright'}`);
  lines.push(`Buy: ${g.lengths.length} lengths of ${mmc(GRID.stock)} (${(g.total / 1000).toFixed(1)} m of batten)`);
  lines.push(`Worked out with the batten grid calculator from Raf Carpentry / rafcarpentry.com${page}`);
  return lines.join('\n');
}

/** Get a quote: the brief with Wall panelling ticked, the size filled in and the grid in the notes */
export function gridBriefHref(g: Grid, job: string): string {
  const q = new URLSearchParams({ job, what: 'Wall panelling', w: String(Math.round(g.W)), h: String(Math.round(g.H)) });
  if (!g.error) {
    q.set('note', `From the batten grid calculator: ${g.n} panels across${g.rows > 1 ? `, ${g.rows} rows` : ''}, ${mm1(g.B)} mm battens, openings ${mm1(g.openW)} × ${mm1(g.openH)}.`);
  }
  return `/how-it-works?${q.toString()}#brief`;
}

/** Open these sizes in the Workshop Tools app's batten grid (src/app/tools/workshop/app/workshop-app.tsx reads them) */
export function gridAppHref(input: GridInput): string {
  const q = new URLSearchParams({
    tool: 'grid',
    w: mm1(input.w),
    h: mm1(input.h),
    b: mm1(input.batten),
    n: String(Math.max(0, Math.round(input.panels))),
    rows: String(input.rows),
    from: input.from,
  });
  if (input.from === 'skirting') {
    q.set('sk', mm1(input.skirting));
    q.set('gap', mm1(input.gap));
  }
  return `/tools/workshop/app?${q.toString()}`;
}

/** The Workshop Tools app's own settings for these sizes (what gridAppHref asks it to open) */
export function appStateFor(q: URLSearchParams): Record<string, unknown> | null {
  if (q.get('tool') !== 'grid') return null;
  const num = (k: string, lo: number, hi: number) => {
    const v = readMm(q.get(k) ?? '');
    return v != null && v >= lo && v <= hi ? mm1(v) : null;
  };
  const w = num('w', 300, 30000);
  const h = num('h', 150, 6000);
  const b = num('b', 10, 300);
  if (!w || !h || !b) return null;
  const n = Math.min(GRID.maxPanels, Math.max(0, Math.round(Number(q.get('n')) || 0)));
  const rows = Math.min(GRID.maxRows, Math.max(1, Math.round(Number(q.get('rows')) || 1)));
  const from = q.get('from') === 'skirting' ? 'skirting' : 'floor';
  const st: Record<string, unknown> = { pnStyle: 'grid', pgWalls: [{ w, n }], pgSel: 0, pH: h, pBat: b, pRows: rows, pgFrom: from };
  if (from === 'skirting') {
    st.pfSkirt = num('sk', 0, 1000) ?? '100';
    st.pgGap = num('gap', 0, 1000) ?? '0';
  }
  return st;
}
