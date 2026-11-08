/* The decking calculator at /tools/decking-calculator (7 Nov 2026, Raf picked mockup A, "Drawing first", on the
   'Decking calculator mockups' design canvas). From the size of the deck, the boards, which way they run and how high
   it is, it works out what to buy: boards, joists, rims, noggins, pads or posts, clips or screws, fascia, membrane and
   joist tape, plus a plan of the deck from above. No imports, so it runs in tests (scripts/decking-calculator/check.mjs).

   The rules (RULES below) are a carpenter's usual ones, with Raf's own deck in Camden Town for the frame: joists
   47 × 100 at about 400 on pads. Board sizes are common UK ones; the page says to check the board maker's sheet. */

export type DeckBoard = 'composite' | 'softwood';
export type DeckRun = 'along' | 'out';
export type DeckHeight = 'ground' | 'raised';

export type DeckInput = {
  /** metres along the house */
  len: number;
  /** metres out from the house */
  dep: number;
  board: DeckBoard;
  /** boards run along the house, or out from it */
  run: DeckRun;
  height: DeckHeight;
  /** joist centres, mm */
  centres: number;
};

export const DECK_START: DeckInput = { len: 3.5, dep: 3.0, board: 'composite', run: 'along', height: 'ground', centres: 400 };
export const DECK_MIN = 1;
export const DECK_MAX = 20;
export const CENTRES = [300, 400, 450] as const;

export const BOARDS: Record<DeckBoard, { name: string; w: number; t: number; gap: number; lengths: number[] }> = {
  composite: { name: 'Composite', w: 146, t: 23, gap: 6, lengths: [3.6] },
  softwood: { name: 'Softwood', w: 144, t: 28, gap: 5, lengths: [2.4, 3.6, 4.8] },
};

export const RULES = {
  /** spare boards, on top of what the deck takes */
  spare: 0.05,
  /** extra when boards are joined end to end (offcuts that don't reach a joist) */
  joinWaste: 0.1,
  /** joist and rim thickness, mm */
  joist: 47,
  /** pads under each joist about every this many metres (on the ground) */
  padEvery: 1.2,
  /** posts and bearers about every this many metres (raised) */
  postEvery: 1.8,
  /** a row of noggins about every this many metres of joist */
  nogginEvery: 1.5,
  /** fall away from the house, mm a metre */
  fallPerMetre: 5,
  /** weed membrane overlaps */
  membraneExtra: 0.1,
  /** timber lengths a merchant sells, metres */
  timber: [2.4, 3.0, 3.6, 4.2, 4.8],
  /** fascia lengths, metres */
  fascia: 3.6,
  /** above this a deck needs planning permission (England, a house), mm */
  planningMm: 300,
} as const;

export type DeckItem = { group: 'Boards' | 'Frame' | 'Ground' | 'Fixings' | 'Finishing'; qty: string; what: string; note: string };
export type DeckCheck = { warn: boolean; text: string };

export type Deck = {
  input: DeckInput;
  /** m² */
  area: number;
  /** the boards' run (along their length) and the width across them, metres */
  run: number;
  across: number;
  rows: number;
  boardLength: number;
  /** boards the deck takes, the spares, and the two together */
  boardsNeeded: number;
  spare: number;
  boards: number;
  /** joins in each row of boards (one line of joins over a doubled joist) */
  joins: number;
  /** the edge board(s) cut to fit: the last one, or the first and last when the last would be under half a board */
  edges: 'last' | 'both';
  edgeWidth: number;
  /** joists at the centres, and with the doubled ones under the joins */
  joistsAtCentres: number;
  joists: number;
  joistBuy: { len: number; per: number };
  rimBuy: { len: number; per: number };
  joistSize: string;
  nogginRows: number;
  nogginPieces: number;
  nogginLengths: number;
  padsPerJoist: number;
  pads: number;
  postRows: number;
  postCols: number;
  posts: number;
  bearers: number;
  clips: number;
  screws: number;
  screwBoxes: number;
  frameScrews: number;
  fasciaMetres: number;
  fascia: number;
  membrane: number;
  tape: number;
  /** mm the deck falls from the house to the front */
  fall: number;
  items: DeckItem[];
  checks: DeckCheck[];
};

const EPS = 1e-6;
const m1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

/** "3,5" or " 3.5 m" → 3.5; null when it isn't a size the calculator takes */
export function readMetres(t: string): number | null {
  const v = parseFloat(String(t ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) && v >= DECK_MIN && v <= DECK_MAX ? Math.round(v * 100) / 100 : null;
}

/** the shortest length a merchant sells that's long enough, or 4.8 m lengths joined */
function buyLength(x: number): { len: number; per: number } {
  for (const l of RULES.timber) if (l >= x - EPS) return { len: l, per: 1 };
  return { len: 4.8, per: Math.ceil(x / 4.8 - EPS) };
}

export function deck(input: DeckInput): Deck {
  const len = Math.min(DECK_MAX, Math.max(DECK_MIN, input.len));
  const dep = Math.min(DECK_MAX, Math.max(DECK_MIN, input.dep));
  const i: DeckInput = { ...input, len, dep };
  const b = BOARDS[i.board];
  const comp = i.board === 'composite';
  const raised = i.height === 'raised';
  const sp = CENTRES.includes(i.centres as (typeof CENTRES)[number]) ? i.centres : 400;
  const along = i.run === 'along';
  const R = along ? len : dep; // the way the boards run
  const W = along ? dep : len; // across the boards

  // rows of boards across, each a gap apart, the edge one cut to fit
  const rows = Math.ceil((W * 1000 + b.gap) / (b.w + b.gap) - EPS);

  // the board length that means the least bought; a tie goes to fewer joins
  let best = { lb: b.lengths[0], n: Infinity, joins: 0, bought: Infinity };
  for (const lb of b.lengths) {
    let n: number;
    let joins: number;
    if (R <= lb + EPS) {
      n = Math.ceil(rows / Math.floor(lb / R + EPS));
      joins = 0;
    } else {
      joins = Math.ceil(R / lb - EPS) - 1;
      n = Math.ceil((rows * R * (1 + RULES.joinWaste)) / lb - EPS);
    }
    const bought = n * lb;
    if (bought < best.bought - EPS || (Math.abs(bought - best.bought) < EPS && joins < best.joins)) best = { lb, n, joins, bought };
  }
  const spare = Math.max(1, Math.round(best.n * RULES.spare));

  const over = rows * b.w + (rows - 1) * b.gap - W * 1000;
  let edgeWidth = b.w - over;
  let edges: 'last' | 'both' = 'last';
  if (edgeWidth < b.w / 2) {
    edgeWidth = b.w - over / 2;
    edges = 'both';
  }
  edgeWidth = Math.round(edgeWidth);

  // joists across the boards, at the centres along the run, plus one doubled under each line of joins
  const joistsAtCentres = Math.ceil((R * 1000) / sp - EPS) + 1;
  const joists = joistsAtCentres + best.joins;
  const joistBuy = buyLength(W);
  const rimBuy = buyLength(R);
  const joistSize = raised ? '47 × 150' : '47 × 100';
  const nogginRows = Math.max(1, Math.ceil(W / RULES.nogginEvery - EPS) - 1);
  const nogginPieces = nogginRows * (joistsAtCentres - 1);
  const nogginLengths = Math.ceil(nogginPieces / Math.floor(3600 / (sp - RULES.joist)) - EPS);
  const padsPerJoist = Math.ceil(W / RULES.padEvery - EPS) + 1;
  const pads = joists * padsPerJoist;
  const postRows = Math.ceil(W / RULES.postEvery - EPS) + 1;
  const postCols = Math.ceil(R / RULES.postEvery - EPS) + 1;
  const posts = postRows * postCols;
  const bearers = postRows * 2 * rimBuy.per;
  const clips = rows * joists + joists;
  const screws = rows * joists * 2;
  const screwBoxes = Math.ceil(screws / 500 - EPS);
  const frameScrews = Math.ceil((joists * 4 + nogginPieces * 4) / 100 - EPS) * 100;
  const fasciaMetres = len + 2 * dep;
  const fascia = Math.ceil(fasciaMetres / RULES.fascia - EPS);
  const area = Math.round(len * dep * 100) / 100;
  const membrane = Math.ceil(area * (1 + RULES.membraneExtra) - EPS);
  const tape = Math.ceil(joists * W + 2 * R - EPS);
  const fall = Math.round(dep * RULES.fallPerMetre);

  const cut = `${edges === 'both' ? 'first and last' : 'last one'} cut to ${edgeWidth} mm`;
  const items: DeckItem[] = [
    {
      group: 'Boards',
      qty: String(best.n + spare),
      what: `${b.name} deck boards, ${b.w} × ${b.t}, ${best.lb.toFixed(1)} m`,
      note: `${best.n} + ${spare} spare · ${cut}`,
    },
  ];
  if (raised) items.push({ group: 'Frame', qty: String(bearers), what: `Bearers 47 × 150, treated, ${rimBuy.len.toFixed(1)} m`, note: 'doubled, on the posts' });
  items.push({
    group: 'Frame',
    qty: String(joists * joistBuy.per),
    what: `Joists ${joistSize}, treated, ${joistBuy.len.toFixed(1)} m`,
    note: `${joistsAtCentres} at ${sp} mm${best.joins ? `, + ${best.joins} doubled under the joins` : ''}${joistBuy.per > 1 ? `, ${joistBuy.per} lengths each` : ''}`,
  });
  items.push({ group: 'Frame', qty: String(2 * rimBuy.per), what: `Rim joists ${joistSize}, ${rimBuy.len.toFixed(1)} m`, note: 'across the ends of the joists' });
  items.push({ group: 'Frame', qty: String(nogginLengths), what: `Noggins ${joistSize}, 3.6 m`, note: `cut into ${nogginPieces} pieces` });
  if (raised) items.push({ group: 'Ground', qty: String(posts), what: 'Posts 100 × 100, treated', note: 'about every 1.8 m, set in postcrete' });
  else items.push({ group: 'Ground', qty: String(pads), what: 'Adjustable deck pads', note: `${padsPerJoist} under each joist, about every 1.2 m` });
  if (comp) items.push({ group: 'Fixings', qty: String(clips), what: 'Hidden clips with screws', note: 'one where each board crosses a joist' });
  else items.push({ group: 'Fixings', qty: String(screwBoxes * 500), what: 'Deck screws 4.5 × 60', note: `${screws} needed, 2 a board at every joist` });
  items.push({ group: 'Fixings', qty: String(frameScrews), what: 'Frame screws 6 × 100', note: '4 at each joist end and noggin' });
  items.push({ group: 'Finishing', qty: String(fascia), what: `${comp ? 'Composite fascia' : 'Fascia boards'}, 3.6 m`, note: `${m1(fasciaMetres)} m round the open sides` });
  items.push({ group: 'Finishing', qty: `${membrane} m²`, what: 'Weed membrane', note: 'the area plus 10% for overlaps' });
  items.push({ group: 'Finishing', qty: `${tape} m`, what: 'Joist tape', note: 'on top of every joist' });

  const checks: DeckCheck[] = [
    raised
      ? { warn: true, text: 'Over 30 cm high, a deck needs planning permission. Ask your council first.' }
      : { warn: false, text: 'Under 30 cm high: a house usually needs no planning permission.' },
    { warn: false, text: `Falls ${fall} mm from the house to the front, so rain runs off.` },
    best.joins
      ? { warn: false, text: `Boards longer than ${best.lb.toFixed(1)} m join in one line, over a doubled joist.` }
      : { warn: false, text: 'Every board is one length: no joins.' },
    { warn: false, text: `Boards ${b.gap} mm apart; the ${edges === 'both' ? 'first and last' : 'last'} cut to ${edgeWidth} mm to fit.` },
  ];

  return {
    input: i,
    area,
    run: R,
    across: W,
    rows,
    boardLength: best.lb,
    boardsNeeded: best.n,
    spare,
    boards: best.n + spare,
    joins: best.joins,
    edges,
    edgeWidth,
    joistsAtCentres,
    joists,
    joistBuy,
    rimBuy,
    joistSize,
    nogginRows,
    nogginPieces,
    nogginLengths,
    padsPerJoist,
    pads,
    postRows,
    postCols,
    posts,
    bearers,
    clips,
    screws,
    screwBoxes,
    frameScrews,
    fasciaMetres,
    fascia,
    membrane,
    tape,
    fall,
    items,
    checks,
  };
}

export type PlanRect = { x: number; y: number; w: number; h: number; kind: 'board' | 'board2' | 'join' | 'joist' | 'pad' | 'post' };

/** The deck from above, in mm: x along the house (0 at the left), y out from it (0 at the house wall). */
export function deckPlan(d: Deck, view: 'boards' | 'frame'): { w: number; h: number; rects: PlanRect[] } {
  const { len, dep, board } = d.input;
  const b = BOARDS[board];
  const along = d.input.run === 'along';
  const L = len * 1000;
  const D = dep * 1000;
  const rects: PlanRect[] = [];
  const at = (u: number, v: number, du: number, dv: number, kind: PlanRect['kind']) =>
    rects.push(along ? { x: u, y: v, w: du, h: dv, kind } : { x: v, y: u, w: dv, h: du, kind });
  // u = the way the boards run, v = across them
  const runLen = along ? L : D;
  const across = along ? D : L;
  if (view === 'boards') {
    let v = 0;
    for (let r = 0; r < d.rows; r++) {
      const edge = r === d.rows - 1 || (d.edges === 'both' && r === 0);
      const w = Math.min(edge ? d.edgeWidth : b.w, across - v);
      if (w > 0) at(0, v, runLen, w, r % 2 ? 'board2' : 'board');
      v += w + b.gap;
    }
    for (let j = 1; j <= d.joins; j++) at(j * d.boardLength * 1000 - 3, 0, 6, across, 'join');
  } else {
    const t = RULES.joist;
    const pos: number[] = [];
    for (let k = 0; k < d.joistsAtCentres; k++) pos.push(Math.min(k * d.input.centres, runLen - t));
    for (const p of pos) at(p, 0, t, across, 'joist');
    at(0, 0, runLen, t, 'joist');
    at(0, across - t, runLen, t, 'joist');
    for (let n = 1; n <= d.nogginRows; n++) {
      const v = (n / (d.nogginRows + 1)) * across - t / 2;
      for (let k = 0; k < pos.length - 1; k++) {
        const u = pos[k] + t;
        const du = pos[k + 1] - u;
        if (du > 0) at(u, v, du, t, 'joist');
      }
    }
    if (d.input.height === 'raised') {
      const s = 100;
      for (let a = 0; a < d.postCols; a++)
        for (let c = 0; c < d.postRows; c++) {
          const u = (d.postCols > 1 ? a / (d.postCols - 1) : 0) * (runLen - s);
          const v = (d.postRows > 1 ? c / (d.postRows - 1) : 0) * (across - s);
          at(u, v, s, s, 'post');
        }
    } else {
      const s = 80;
      for (const p of pos)
        for (let j = 0; j < d.padsPerJoist; j++) {
          const v = (d.padsPerJoist > 1 ? j / (d.padsPerJoist - 1) : 0) * (across - s);
          at(Math.max(0, Math.min(runLen - s, p + t / 2 - s / 2)), v, s, s, 'pad');
        }
    }
  }
  return { w: L, h: D, rects };
}

/** The list as text, for WhatsApp or the clipboard. */
export function deckText(d: Deck): string {
  const { len, dep, board, run, height } = d.input;
  const head = `My deck: ${m1(len)} × ${m1(dep)} m (${d.area} m²), ${board} boards ${run === 'along' ? 'along the house' : 'out from the house'}, ${height === 'raised' ? 'raised on posts' : 'on the ground'}`;
  return [head, ...d.items.map((it) => `- ${it.qty}  ${it.what}`), '', 'Worked out with the free decking calculator at rafcarpentry.com/tools/decking-calculator'].join('\n');
}

/** Get a quote: the brief on Plan your project, with Decking ticked, the size filled in and the deck in the notes
 *  (and, from a job page, the job it was opened from). */
export function deckBriefHref(d: Deck, job?: string): string {
  const { len, dep, board, run, height } = d.input;
  const note = `From the decking calculator: ${board} boards ${run === 'along' ? 'along the house' : 'out from the house'}, ${height === 'raised' ? 'raised on posts' : 'on the ground'}. About ${d.boards} boards and ${d.joists} joists.`;
  const q = new URLSearchParams({ what: 'Decking', w: String(Math.round(len * 1000)), h: String(Math.round(dep * 1000)), note });
  if (job) q.set('job', job);
  return `/how-it-works?${q.toString()}#brief`;
}
