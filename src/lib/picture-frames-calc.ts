/* The picture frame calculator on a wall panelling job page (8 Nov 2026, Raf: "add calculators to relevant jobs
   in jobkit new job form as you created in the wall panelling job", then "Go"). No imports, so the check
   (scripts/picture-frames-calc/check.mjs) and the page read the same sums.

   The layout is the Workshop Tools app's picture frames (frameCalc in scripts/workshop-tools/Main.dc.html), for one
   wall: a dado rail across the wall, frames below it between the skirting and the rail, and (unless the wall above is
   left plain) frames above it up to the ceiling, the same gap round every frame and between them. The check compares
   every answer here with the app's own frameCalc, so the two can't drift apart.

   What's added here: the cutting. The app buys moulding by the metre plus 10%; here every frame's four pieces are
   laid out on the lengths, each cut to its long point with a moulding's width spare for the mitre (a profiled
   moulding can't be turned round to share the cut) and 3 mm for each saw cut, so the number to buy is the number the
   cuts really take. */

export type FramesInput = {
  /** wall width, mm */
  w: number;
  /** floor to ceiling, mm */
  ceiling: number;
  /** skirting height, mm */
  skirting: number;
  /** the top of the dado rail from the floor, and the rail's own height, mm */
  railTop: number;
  railH: number;
  /** the frame moulding's width, mm */
  mould: number;
  /** the gap from each frame to the skirting, rail, ceiling and wall ends; and between frames, mm */
  around: number;
  between: number;
  /** frames across; 0 = worked out from the frame size aimed for (target) */
  frames: number;
  /** frames above the rail too, or the wall above it left plain */
  upper: boolean;
};

export const FRAMES = {
  /** the frame width aimed for when Frames is on Auto (the app's AIM FOR FRAMES OF) */
  target: 700,
  /** moulding lengths sold, mm (the app's batten length) */
  stock: 2440,
  /** dado rail lengths sold, mm (the app's PICTURE RAIL LENGTH) */
  railStock: 2400,
  /** the app's spare on the metres, % */
  waste: 10,
  /** each saw cut, mm */
  kerf: 3,
  maxFrames: 30,
};

export const FRAMES_START: FramesInput = {
  w: 3000,
  ceiling: 2400,
  skirting: 100,
  railTop: 1000,
  railH: 45,
  mould: 22,
  around: 100,
  between: 100,
  frames: 0,
  upper: true,
};

export type FramePiece = { row: 'lower' | 'upper'; side: 'top' | 'side'; len: number };
export type FrameLength = { pieces: FramePiece[]; used: number; left: number };

export type Frames = {
  error: string;
  input: FramesInput;
  W: number;
  /** frames across, and what Auto would give */
  n: number;
  autoN: number;
  /** each frame's outside width, and each one's left edge from the left end of the wall */
  fw: number;
  xs: number[];
  /** the rail's underside, and the frames' bottoms, tops and heights from the floor */
  railBot: number;
  lowBot: number;
  lowTop: number;
  lh: number;
  upBot: number;
  upTop: number;
  uh: number;
  /** all frames, lower and upper */
  frames: number;
  /** all the moulding, mm, measured round the outside of each frame */
  total: number;
  /** the app's way: the metres plus 10%, in lengths */
  lengthsByMetre: number;
  /** the lengths the cuts take, each with its pieces */
  lengths: FrameLength[];
  /** dado rail lengths: whole lengths along the wall and one for what's left */
  railLengths: number;
  /** the dado rail's pieces along the wall, from the left */
  railPieces: number[];
};

/** "4,200", "4200 mm", "22.5" or "22,5" -> mm; null if it isn't a number */
export function readMm(t: string): number | null {
  let s = String(t ?? '').trim().toLowerCase().replace(/mm$/, '').trim();
  if (!s) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** one decimal, as the app shows it: 720, 1266.7 */
export const mm1 = (v: number) => String(Math.round(v * 10) / 10);
/** a long number with a thousands comma: 4,200 */
export const mmc = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 });

function empty(input: FramesInput, error: string, extra: Partial<Frames> = {}): Frames {
  return {
    error,
    input,
    W: input.w,
    n: 0,
    autoN: 0,
    fw: NaN,
    xs: [],
    railBot: NaN,
    lowBot: NaN,
    lowTop: NaN,
    lh: NaN,
    upBot: NaN,
    upTop: NaN,
    uh: NaN,
    frames: 0,
    total: 0,
    lengthsByMetre: 0,
    lengths: [],
    railLengths: 0,
    railPieces: [],
    ...extra,
  };
}

/** The pieces laid out on lengths, longest first, each into the first length it fits. Each piece takes its long
 *  point plus one moulding width (the mitre's offcut), with a saw cut between pieces. */
export function layOutFrames(pieces: FramePiece[], stock: number, kerf: number, mould: number): FrameLength[] {
  const sorted = [...pieces].sort((a, b) => b.len - a.len);
  const out: FrameLength[] = [];
  for (const p of sorted) {
    const take = kerf + p.len + mould;
    let at = out.find((l) => l.used + take <= stock + 1e-6);
    if (!at) {
      at = { pieces: [], used: -kerf, left: 0 };
      out.push(at);
    }
    at.pieces.push(p);
    at.used += take;
  }
  for (const l of out) l.left = stock - l.used;
  return out;
}

/** The app's frameCalc for one wall, then the cutting. Same error words, in the same order, as the app. */
export function frames(input: FramesInput): Frames {
  const { w: W, ceiling: CH, skirting: SK, railTop: RT, railH: RH, mould: MW, around: GA, between: GB } = input;
  const TGT = FRAMES.target;
  const upper = input.upper;
  // the wall first, as the app does it for each wall
  let wallError = '';
  let n = 0;
  let autoN = 0;
  let fw = NaN;
  const xs: number[] = [];
  if (!Number.isFinite(W) || W < 300) wallError = 'The wall needs to be at least 300 mm wide.';
  else if (Number.isFinite(GA) && Number.isFinite(GB)) {
    const avail = W - 2 * GA;
    autoN = Math.max(1, Math.round((avail + GB) / (TGT + GB)));
    n = input.frames > 0 ? Math.round(input.frames) : autoN;
    fw = (avail - (n - 1) * GB) / n;
    if (fw < 100) wallError = 'The frames come out under 100 mm wide. Use fewer frames or smaller gaps.';
    else for (let k = 0; k < n; k++) xs.push(GA + k * (fw + GB));
  }
  const wall = { n, autoN };
  if ([CH, SK, RT, RH, MW, GA, GB].some((x) => !Number.isFinite(x)) || CH < 1000) return empty(input, 'Check the numbers: one of the boxes is empty or not a number.', wall);
  if (RT >= CH) return empty(input, 'The rail is above the ceiling height.', wall);
  const railBot = RT - RH;
  const lowBot = SK + GA;
  const lowTop = railBot - GA;
  const lh = lowTop - lowBot;
  const upBot = RT + GA;
  const upTop = CH - GA;
  const uh = upTop - upBot;
  if (wallError) return empty(input, wallError, wall);
  if (lh < 100) return empty(input, 'Not enough room between the skirting and the rail for frames. Lower the gaps or raise the rail.', wall);
  if (upper && uh < 100) return empty(input, 'Not enough room above the rail for frames. Lower the gaps, or set Above the rail to Plain wall.', wall);
  // the cutting checks the app doesn't make: a piece longer than a length can't be cut from one
  const longest = Math.max(fw, lh, upper ? uh : 0);
  if (longest + MW > FRAMES.stock) return empty(input, `A frame's side comes out longer than a ${mmc(FRAMES.stock)} length. Use more frames, or a lower rail.`, wall);

  const total = n * (2 * (fw + lh) + (upper ? 2 * (fw + uh) : 0));
  const lengthsByMetre = Math.ceil((total * (1 + FRAMES.waste / 100)) / FRAMES.stock);
  const pieces: FramePiece[] = [];
  for (let k = 0; k < n; k++) {
    pieces.push({ row: 'lower', side: 'top', len: fw }, { row: 'lower', side: 'top', len: fw }, { row: 'lower', side: 'side', len: lh }, { row: 'lower', side: 'side', len: lh });
    if (upper) pieces.push({ row: 'upper', side: 'top', len: fw }, { row: 'upper', side: 'top', len: fw }, { row: 'upper', side: 'side', len: uh }, { row: 'upper', side: 'side', len: uh });
  }
  const lengths = layOutFrames(pieces, FRAMES.stock, FRAMES.kerf, MW);
  // the dado rail, as the app counts it for one wall: whole lengths, then one for what's left
  const RS = FRAMES.railStock;
  const full = Math.floor(W / RS + 1e-9);
  const rem = W - full * RS;
  const railLengths = full + (rem > 0.5 ? 1 : 0);
  const railPieces: number[] = [];
  for (let k = 0; k < full; k++) railPieces.push(RS);
  if (rem > 0.5) railPieces.push(rem);
  return {
    error: '',
    input,
    W,
    n,
    autoN,
    fw,
    xs,
    railBot,
    lowBot,
    lowTop,
    lh,
    upBot,
    upTop,
    uh,
    frames: n * (upper ? 2 : 1),
    total,
    lengthsByMetre,
    lengths,
    railLengths,
    railPieces,
  };
}

/** what the wall takes, as text: Copy the list and WhatsApp */
export function framesText(f: Frames, page: string): string {
  if (f.error) return '';
  const i = f.input;
  const lines = [
    `Picture frames: wall ${mmc(f.W)} wide, ${mmc(i.ceiling)} to the ceiling, dado rail ${mm1(i.railH)} high with its top at ${mmc(i.railTop)}`,
    `${f.n} frames across, ${mm1(i.around)} mm round them and ${mm1(i.between)} between, in ${mm1(i.mould)} mm moulding`,
    `Below the rail: ${f.n} × ${mm1(f.fw)} × ${mm1(f.lh)} mm (outside), bottoms at ${mm1(f.lowBot)} from the floor`,
  ];
  if (i.upper) lines.push(`Above the rail: ${f.n} × ${mm1(f.fw)} × ${mm1(f.uh)} mm (outside), bottoms at ${mm1(f.upBot)}`);
  else lines.push('Above the rail: plain wall');
  lines.push(`Frames, left edge from the left end: ${f.xs.map(mm1).join(', ')}`);
  lines.push('Cut (each to its long point, mitred):');
  lines.push(`- ${f.n * 2 * (i.upper ? 2 : 1)} × ${mm1(f.fw)} mm tops and bottoms`);
  lines.push(`- ${f.n * 2} × ${mm1(f.lh)} mm sides below the rail`);
  if (i.upper) lines.push(`- ${f.n * 2} × ${mm1(f.uh)} mm sides above the rail`);
  lines.push(`Buy: ${f.lengths.length} lengths of ${mmc(FRAMES.stock)} moulding (${(f.total / 1000).toFixed(1)} m), ${f.railLengths} of ${mmc(FRAMES.railStock)} dado rail`);
  lines.push(`Worked out with the picture frame calculator from Raf Carpentry / rafcarpentry.com${page}`);
  return lines.join('\n');
}

/** Get a quote: the brief with Wall panelling ticked, the wall's size filled in and the frames in the notes */
export function framesBriefHref(f: Frames, job: string): string {
  const q = new URLSearchParams({ job, what: 'Wall panelling', w: String(Math.round(f.W)), h: String(Math.round(f.input.ceiling)) });
  if (!f.error) {
    q.set('note', `From the picture frame calculator: ${f.n} frames across, dado rail at ${mm1(f.input.railTop)}, frames ${mm1(f.fw)} × ${mm1(f.lh)} below${f.input.upper ? ` and ${mm1(f.fw)} × ${mm1(f.uh)} above` : ', plain wall above'}.`);
  }
  return `/how-it-works?${q.toString()}#brief`;
}

/** Open these sizes in the Workshop Tools app's picture frames (src/app/tools/workshop/app/workshop-app.tsx reads them) */
export function framesAppHref(i: FramesInput): string {
  const q = new URLSearchParams({
    tool: 'frames',
    w: mm1(i.w),
    n: String(Math.max(0, Math.round(i.frames))),
    ch: mm1(i.ceiling),
    sk: mm1(i.skirting),
    rt: mm1(i.railTop),
    rh: mm1(i.railH),
    mw: mm1(i.mould),
    ga: mm1(i.around),
    gb: mm1(i.between),
    up: i.upper ? 'yes' : 'no',
  });
  return `/tools/workshop/app?${q.toString()}`;
}

/** The Workshop Tools app's own settings for these sizes (what framesAppHref asks it to open) */
export function framesAppStateFor(q: URLSearchParams): Record<string, unknown> | null {
  if (q.get('tool') !== 'frames') return null;
  const num = (k: string, lo: number, hi: number) => {
    const v = readMm(q.get(k) ?? '');
    return v != null && v >= lo && v <= hi ? mm1(v) : null;
  };
  const w = num('w', 300, 30000);
  const ch = num('ch', 1000, 8000);
  if (!w || !ch) return null;
  const n = Math.min(FRAMES.maxFrames, Math.max(0, Math.round(Number(q.get('n')) || 0)));
  const st: Record<string, unknown> = { pnStyle: 'frames', pfWalls: [{ w, n }], pfSel: 0, pfCeil: ch, pfUpper: q.get('up') === 'no' ? 'no' : 'yes' };
  const more: [string, string, number, number][] = [
    ['sk', 'pfSkirt', 0, 1000],
    ['rt', 'pfRailTop', 100, 8000],
    ['rh', 'pfRailH', 0, 500],
    ['mw', 'pfMould', 5, 200],
    ['ga', 'pfAround', 0, 1000],
    ['gb', 'pfBetween', 0, 1000],
  ];
  for (const [k, key, lo, hi] of more) {
    const v = num(k, lo, hi);
    if (v != null) st[key] = v;
  }
  return st;
}
