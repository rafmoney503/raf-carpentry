/* Quotes in the Job Kit (Raf, 2 Nov 2026: "if new job come through ... with pictures I'd like you to be in jobkit
   analyse it and create answer with proposed quote price ... if wardrobes make plain design with quote, ikea pax
   with mdf outside, custom mdf shaker and match colour from Cworkshop with their prices. I will approve or change
   prices once your quotes are ready").
   Claude reads the brief and the photos (src/lib/quote-maker.ts) and says what it sees: the sizes, the insides,
   the colours that suit the room, what to check and ask. It never sets a price. The prices are worked out here,
   from Raf's own price list, so they're always his numbers and change when he changes them. No imports, so the
   sums can be tested on their own (scripts/quotes/check.mjs). Every price is before VAT, rounded up to the
   nearest £50 (roundTo), as on his quotes. */

export const VAT = 0.2;
export const SHEET_M2 = 2.8 * 2.07; // an Egger board from Cworkshop, 2800 x 2070
export const SHEET_YIELD = 0.72; // what's left after cutting round grain, edges and offcuts

/* ---------- Raf's price list ---------- */

export type PriceKey =
  | 'plainPerM'
  | 'shakerPerM'
  | 'paxPerM'
  | 'paxIkeaPerM'
  | 'drawer'
  | 'topPerM'
  | 'openPerM'
  | 'oakPerM'
  | 'rack'
  | 'riser'
  | 'stripOut'
  | 'dayRate'
  | 'boardSetupDays'
  | 'boardDaysPerM'
  | 'cutEdgeSheet'
  | 'edgeSheet'
  | 'hardwareUnit'
  | 'delivery'
  | 'boardMarkup'
  | 'kitchen'
  | 'laminateM2'
  | 'loftM2'
  | 'deckingM2'
  | 'door'
  | 'mediaBasic'
  | 'mediaMid'
  | 'minJob'
  | 'roundTo';

export type Prices = Record<PriceKey, number> & { boards: Record<string, number> };

type Row = { key: PriceKey; label: string; unit: string; group: 'Wardrobes' | 'Cupboards and pantries' | 'Finished board' | 'Other jobs' | 'Rounding'; from: string; guess?: boolean; step?: number };
export const PRICE_ROWS: Row[] = [
  { key: 'plainPerM', label: 'MDF, flat doors', unit: 'a metre', group: 'Wardrobes', from: 'Your price, 1 Nov' },
  { key: 'shakerPerM', label: 'MDF, shaker doors', unit: 'a metre', group: 'Wardrobes', from: 'Your price, 1 Nov' },
  { key: 'paxPerM', label: 'IKEA PAX built in with MDF', unit: 'a metre', group: 'Wardrobes', from: 'Your Wandsworth quote: £2,100 for two 1 m alcoves, they buy the IKEA parts' },
  { key: 'paxIkeaPerM', label: 'Their IKEA parts, roughly', unit: 'a metre', group: 'Wardrobes', from: 'Said in the message, not in your price', guess: true },
  { key: 'drawer', label: 'Each drawer inside', unit: 'each', group: 'Wardrobes', from: 'My guess', guess: true },
  { key: 'topPerM', label: 'Top cupboards over the doors', unit: 'a metre', group: 'Wardrobes', from: 'My guess', guess: true },
  { key: 'openPerM', label: 'Open shelving or dresser (no doors)', unit: 'a metre', group: 'Cupboards and pantries', from: 'My guess: Design with Claude, 3 Nov', guess: true },
  { key: 'oakPerM', label: 'Solid oak worktop shelf', unit: 'a metre', group: 'Cupboards and pantries', from: 'My guess', guess: true },
  { key: 'rack', label: 'Door rack inside a door', unit: 'each', group: 'Cupboards and pantries', from: 'My guess', guess: true },
  { key: 'riser', label: 'Step riser on a shelf', unit: 'each', group: 'Cupboards and pantries', from: 'My guess', guess: true },
  { key: 'stripOut', label: 'Take out old units first', unit: 'a job', group: 'Cupboards and pantries', from: 'My guess', guess: true },
  { key: 'dayRate', label: 'Your day rate', unit: 'a day', group: 'Finished board', from: 'Your rate, 1 Nov' },
  { key: 'boardSetupDays', label: 'Days on every job', unit: 'days', group: 'Finished board', from: 'My guess', guess: true, step: 0.25 },
  { key: 'boardDaysPerM', label: 'Days for each metre', unit: 'days', group: 'Finished board', from: 'My guess (3.5 days for the 3.1 m LP wall)', guess: true, step: 0.25 },
  { key: 'cutEdgeSheet', label: 'Cworkshop cutting', unit: 'a sheet', group: 'Finished board', from: 'Cworkshop’s pages, 2 Nov: £47.30 a sheet on the cutting list', step: 0.1 },
  { key: 'edgeSheet', label: 'Edging (Cworkshop doesn’t publish it)', unit: 'a sheet', group: 'Finished board', from: 'My guess: priced live in their cutting list', guess: true },
  { key: 'hardwareUnit', label: 'Hinges, rail and fixings', unit: 'a unit', group: 'Finished board', from: 'My guess', guess: true },
  { key: 'delivery', label: 'Cworkshop delivery', unit: 'a job', group: 'Finished board', from: 'My guess: Cworkshop works it out by distance', guess: true },
  { key: 'boardMarkup', label: 'On top of the board', unit: '%', group: 'Finished board', from: 'Nothing to start with' },
  { key: 'kitchen', label: 'Kitchen fit, labour only', unit: 'standard kitchen', group: 'Other jobs', from: 'Your price, 1 Nov' },
  { key: 'laminateM2', label: 'Laminate laying, labour only', unit: 'a m²', group: 'Other jobs', from: 'Your price, 1 Nov' },
  { key: 'loftM2', label: 'Loft boarding, raised', unit: 'a m²', group: 'Other jobs', from: 'Your price, 1 Nov' },
  { key: 'deckingM2', label: 'Composite decking', unit: 'a m²', group: 'Other jobs', from: 'Your price, 1 Nov' },
  { key: 'door', label: 'Hanging an internal door, labour only', unit: 'a door', group: 'Other jobs', from: 'Your price, 1 Nov' },
  { key: 'mediaBasic', label: 'Media wall, basic', unit: 'a wall', group: 'Other jobs', from: 'Your price, 1 Nov' },
  { key: 'mediaMid', label: 'Media wall, mid', unit: 'a wall', group: 'Other jobs', from: 'Your price, 1 Nov' },
  { key: 'minJob', label: 'Smallest job', unit: 'a job', group: 'Rounding', from: 'The cost calculator’s, a guess', guess: true },
  { key: 'roundTo', label: 'Round prices up to', unit: '£', group: 'Rounding', from: 'As on your quotes' },
];

export const DEFAULT_PRICES: Prices = {
  plainPerM: 1200,
  shakerPerM: 1600,
  paxPerM: 1050,
  paxIkeaPerM: 400,
  drawer: 80,
  topPerM: 250,
  openPerM: 900,
  oakPerM: 150,
  rack: 50,
  riser: 20,
  stripOut: 400,
  dayRate: 650,
  boardSetupDays: 0.5,
  boardDaysPerM: 1,
  cutEdgeSheet: 47.3,
  edgeSheet: 15,
  hardwareUnit: 50,
  delivery: 60,
  boardMarkup: 0,
  kitchen: 2200,
  laminateM2: 40,
  loftM2: 120,
  deckingM2: 250,
  door: 250,
  mediaBasic: 2800,
  mediaMid: 5400,
  minJob: 330,
  roundTo: 50,
  boards: {},
};

/* Saved prices over the defaults; anything missing or not a number keeps the default. */
export function pricesWith(saved: unknown): Prices {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PRICES, boards: {} as Record<string, number> };
  for (const r of PRICE_ROWS) {
    const v = Number(s[r.key]);
    if (Number.isFinite(v) && v >= 0 && v < 1e6) out[r.key] = v;
  }
  if (out.roundTo < 1) out.roundTo = 1;
  const b = s.boards && typeof s.boards === 'object' ? (s.boards as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(b)) if (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) < 5000) out.boards[k] = Number(v);
  return out;
}

/* ---------- what Claude read (the tool's answer, checked in quote-maker.ts) ---------- */

export type From = 'given' | 'photo' | 'guess';
export type Run = { label: string; width: number; height: number; depth: number; widthFrom: From; heightFrom: From };
export type RateKey = 'kitchen' | 'laminateM2' | 'loftM2' | 'deckingM2' | 'door' | 'mediaBasic' | 'mediaMid';
export const RATE_KEYS: RateKey[] = ['kitchen', 'laminateM2', 'loftM2', 'deckingM2', 'door', 'mediaBasic', 'mediaMid'];
export type OtherOption = {
  name: string;
  says: string; // what's in it, for the customer
  how: 'rate' | 'build';
  rate?: RateKey;
  qty?: number;
  days?: number;
  materials?: { item: string; cost: number }[]; // before VAT
};
export type QuoteRead = {
  kind: 'wardrobe' | 'other';
  title: string;
  summary: string;
  runs: Run[];
  seen: string[];
  check: string[];
  questions: string[];
  intro: string;
  budget: string;
  wardrobe?: { units: number; drawers: number; top: boolean; sliding: boolean; inside: string; paxOk: boolean; paxNote: string };
  colours: { code: string; why: string }[];
  inside: string; // board code for the inside of the finished-board option
  recommend: 'plain' | 'pax' | 'shaker' | 'board' | 'none';
  recommendWhy: string;
  other: OtherOption[];
  extra?: string; // a paragraph Raf's instructions ask for in every message, before the closing
  closing?: string; // his own closing paragraph, when his instructions change the usual one
};

/* Raf's changes to one quote, kept with it and in step between the phone and the computer. */
export type QuoteEdits = {
  runs?: { w?: number; h?: number; d?: number }[];
  price?: Record<string, number>; // option id -> his price before VAT
  pick?: Record<string, boolean>; // option id -> in the message
  colour?: string;
  inside?: string;
  sheets?: { out?: number; in?: number };
  days?: number;
  drawers?: number;
  top?: boolean;
  ask?: Record<string, boolean>; // question number -> in the message (all in to start with)
  text?: string; // the message as he changed it by hand
  sentAt?: number;
  sentHow?: 'email' | 'whatsapp' | 'copy' | 'box';
  note?: string; // his instructions for this quote only (saved even before it's read again; '' = cleared)
};

/* His instructions for one quote: at most this long (the route cuts them to it too). */
export const NOTE_MAX = 1500;

export type Board = { code: string; name: string; family: string; describe: string; exVat: number; normalExVat?: number | null; offerEnds?: string | null; url: string; hex: string };

/* ---------- money ---------- */

export const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
export const money2 = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const roundUp = (n: number, to: number) => Math.ceil(Math.max(0, n) / Math.max(1, to) - 1e-9) * Math.max(1, to);
export const withVat = (n: number) => Math.round(n * (1 + VAT));
export const priceWords = (n: number) => `${money(n)} + VAT (${money(withVat(n))})`;

/* ---------- sizes ---------- */

export type Size = { label: string; w: number; h: number; d: number; wFrom: From; hFrom: From };
/* The runs as priced: Claude's, with Raf's own numbers over them. Sensible bounds so a slip can't price 24 metres. */
export function sizesOf(read: Pick<QuoteRead, 'runs'>, edits: QuoteEdits = {}): Size[] {
  const runs = read.runs.length ? read.runs : [{ label: '', width: 1000, height: 2400, depth: 600, widthFrom: 'guess' as From, heightFrom: 'guess' as From }];
  return runs.map((r, i) => {
    const e = edits.runs?.[i] ?? {};
    const pick = (v: number | undefined, fallback: number, lo: number, hi: number) => (v && v >= lo && v <= hi ? Math.round(v) : fallback);
    return {
      label: r.label,
      w: pick(e.w, clamp(r.width, 200, 12000, 1000), 200, 12000),
      h: pick(e.h, clamp(r.height, 300, 4000, 2400), 300, 4000),
      d: pick(e.d, clamp(r.depth, 150, 1200, 600), 150, 1200),
      wFrom: e.w ? 'given' : r.widthFrom,
      hFrom: e.h ? 'given' : r.heightFrom,
    };
  });
}
const clamp = (v: number, lo: number, hi: number, fallback: number) => (Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : fallback);

const mm = (n: number) => n.toLocaleString('en-GB');
/* "about 1,100 mm wide and 2,400 mm high", or for two runs "two spaces of about 950 and 1,000 mm wide, 2,400 mm high". */
export function sizeWords(sizes: Size[]) {
  const guessed = sizes.some((s) => s.wFrom !== 'given' || s.hFrom !== 'given');
  const hs = [...new Set(sizes.map((s) => s.h))];
  const h = hs.length === 1 ? `${mm(hs[0])} mm high` : `${hs.map(mm).join(' and ')} mm high`;
  const w =
    sizes.length === 1
      ? `a space about ${mm(sizes[0].w)} mm wide`
      : `${sizes.length === 2 ? 'two' : sizes.length === 3 ? 'three' : sizes.length} spaces of about ${sizes.slice(0, -1).map((s) => mm(s.w)).join(', ')} and ${mm(sizes[sizes.length - 1].w)} mm wide`;
  return { words: `${w} and ${h}`, guessed };
}

/* ---------- the options ---------- */

export type Line = { label: string; amount: number; note?: string };
export type Option = {
  id: string;
  title: string; // for Raf's card
  short: string; // for the message's first words
  worked: number; // the price the sums give, before VAT, rounded
  price: number; // his price if he typed one, else worked
  changed: boolean; // he typed his own
  lines: Line[]; // how the sums got there
  says: string; // the sentence for the customer, after the price
  offered: boolean; // false: shown to Raf with why, never in the message
  why?: string; // why it isn't offered
  extra?: string; // a note for Raf
};

const totalWidth = (sizes: Size[]) => sizes.reduce((n, s) => n + s.w, 0);
const metres = (mmW: number) => Math.round(mmW / 10) / 100;
const boardOf = (boards: Board[], code?: string) => boards.find((b) => b.code === code);
export const sheetPrice = (b: Board | undefined, p: Prices) => (b ? (p.boards[b.code] ?? b.exVat) : 0);

/* Sheets for a finished-board wardrobe, worked out from its parts and rounded up. Outside: the doors, the plinth and
   top infill, the fillers and drawer fronts. Inside: sides and dividers, the top, bottom and two shelves in each
   unit, 18 mm backs (Raf's way), drawer boxes. */
export function boardSheets(sizes: Size[], units: number, drawers: number, top: boolean) {
  let outM2 = 0;
  let inM2 = 0;
  const n = Math.max(1, units);
  for (const s of sizes) {
    const W = s.w / 1000;
    const H = s.h / 1000;
    const D = s.d / 1000;
    const u = Math.max(1, Math.round((n * s.w) / Math.max(1, totalWidth(sizes))));
    outM2 += W * H + W * 0.25 + 2 * H * 0.1 + (top ? W * 0.1 : 0);
    inM2 += (u + 1) * H * D + 4 * W * D + W * H + (top ? 2 * W * D : 0);
  }
  outM2 += drawers * 0.6 * 0.2;
  inM2 += drawers * 0.55;
  const sheets = (m2: number) => Math.max(1, Math.ceil(m2 / (SHEET_M2 * SHEET_YIELD) - 1e-9));
  return { out: sheets(outM2), in: sheets(inM2), outM2: Math.round(outM2 * 10) / 10, inM2: Math.round(inM2 * 10) / 10 };
}

export const unitsFor = (sizes: Size[], said?: number) => (said && said > 0 && said < 20 ? Math.round(said) : Math.max(1, sizes.reduce((n, s) => n + Math.max(1, Math.round(s.w / 750)), 0)));

/* PAX frames that suit a run, from the website's own PAX sums (src/lib/pax-brief.ts fillWall, passed in so this
   file keeps no imports). */
export type FillWall = (wall: number) => number[];

/* The finished-board wardrobe's sheets and days: worked out from the sizes, or Raf's own numbers. */
export function boardWork(read: QuoteRead, p: Prices, edits: QuoteEdits = {}) {
  const sizes = sizesOf(read, edits);
  const w = totalWidth(sizes);
  const wr = read.wardrobe;
  const drawers = Math.max(0, Math.min(24, Math.round(edits.drawers ?? wr?.drawers ?? 0)));
  const top = edits.top ?? wr?.top ?? false;
  const calc = boardSheets(sizes, unitsFor(sizes, wr?.units), drawers, top);
  const workedDays = Math.round((p.boardSetupDays + p.boardDaysPerM * (w / 1000) + drawers * 0.15 + (top ? 0.3 * (w / 1000) : 0)) * 4) / 4;
  const own = (v: number | undefined, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
  return {
    calc,
    workedDays,
    out: Math.round(own(edits.sheets?.out, 0, 60) ?? calc.out),
    in: Math.round(own(edits.sheets?.in, 0, 60) ?? calc.in),
    days: Math.round((own(edits.days, 0.25, 60) ?? workedDays) * 4) / 4,
  };
}

export function wardrobeOptions(read: QuoteRead, p: Prices, boards: Board[], edits: QuoteEdits = {}, fillWall?: FillWall): Option[] {
  const sizes = sizesOf(read, edits);
  const w = totalWidth(sizes);
  const m = metres(w);
  const wr = read.wardrobe ?? { units: 0, drawers: 0, top: false, sliding: false, inside: '', paxOk: true, paxNote: '' };
  const drawers = Math.max(0, Math.min(24, Math.round(edits.drawers ?? wr.drawers ?? 0)));
  const top = edits.top ?? wr.top ?? false;
  const units = unitsFor(sizes, wr.units);
  const round = (n: number) => roundUp(Math.max(n, p.minJob), p.roundTo);
  const own = (id: string, worked: number) => {
    const v = edits.price?.[id];
    return v && v > 0 ? { price: Math.round(v), changed: Math.round(v) !== worked } : { price: worked, changed: false };
  };
  const extras = (): Line[] => [
    ...(drawers ? [{ label: `${drawers} drawer${drawers === 1 ? '' : 's'} at ${money(p.drawer)}`, amount: drawers * p.drawer }] : []),
    ...(top ? [{ label: `Top cupboards, ${m} m at ${money(p.topPerM)}`, amount: m * p.topPerM }] : []),
  ];
  const extraWords = [drawers ? `${drawers} drawer${drawers === 1 ? '' : 's'}` : '', top ? 'top cupboards over the doors' : ''].filter(Boolean).join(' and ');
  const inside = wr.inside ? ` Inside: ${wr.inside}${extraWords ? `, with ${extraWords}` : ''}.` : extraWords ? ` With ${extraWords}.` : '';
  const out: Option[] = [];

  // 1. Plain MDF, flat doors
  {
    const lines = [{ label: `${m} m at ${money(p.plainPerM)} a metre`, amount: m * p.plainPerM }, ...extras()];
    const worked = round(lines.reduce((n, l) => n + l.amount, 0));
    out.push({
      id: 'plain',
      title: 'MDF, flat doors',
      short: 'Made to measure in MDF with flat doors',
      worked,
      ...own('plain', worked),
      lines,
      says: `Floor to ceiling in 18 mm MDF with full backs, scribed to your walls and ready for your decorator to paint.${inside}`,
      offered: true,
    });
  }

  // 2. IKEA PAX built in with MDF outside: Raf's work and the MDF; they buy the IKEA parts
  {
    const lowest = Math.min(...sizes.map((s) => s.h));
    const shallow = sizes.some((s) => s.d < 600);
    const frames = fillWall ? sizes.map((s) => fillWall(s.w)) : [];
    const noFrames = frames.some((f) => !f.length);
    const why = !wr.paxOk ? wr.paxNote || 'Claude doesn’t think PAX suits this space.' : lowest < 2030 ? `At ${mm(lowest)} high it’s lower than a PAX frame (it needs about 2,030).` : noFrames ? 'Too narrow for a PAX frame.' : '';
    const lines = [{ label: `${m} m at ${money(p.paxPerM)} a metre (fitting, MDF plinth, fillers and top)`, amount: m * p.paxPerM }];
    const worked = round(lines[0].amount);
    const ikea = roundUp(m * p.paxIkeaPerM, 50);
    const names = frames.length && !noFrames ? frames.map((f) => `PAX ${f.map((x) => x / 10).join(' + ')}`).join(', and ') : '';
    out.push({
      id: 'pax',
      title: 'IKEA PAX with MDF outside',
      short: 'IKEA PAX built in with MDF',
      worked,
      ...own('pax', worked),
      lines,
      says: `I fit the PAX frames and build them in with an MDF plinth, fillers and a top box to the ceiling, all scribed to your walls. You buy the PAX parts from IKEA${names ? ` (${names})` : ''}, roughly ${money(ikea)}, and have them delivered.${shallow && wr.paxOk ? ' PAX is 58 cm deep before the doors, so I’ll check the depth on the visit.' : ''}`,
      offered: !why,
      why: why || undefined,
      extra: `Their IKEA parts aren’t in your price: about ${money(ikea)} (${money(p.paxIkeaPerM)} a metre in your price list).`,
    });
  }

  // 3. Shaker doors
  {
    const lines = [{ label: `${m} m at ${money(p.shakerPerM)} a metre`, amount: m * p.shakerPerM }, ...extras()];
    const worked = round(lines.reduce((n, l) => n + l.amount, 0));
    out.push({
      id: 'shaker',
      title: 'MDF, shaker doors',
      short: 'Made to measure with shaker doors',
      worked,
      ...own('shaker', worked),
      lines,
      says: `The same build with classic shaker doors (a 70 mm frame round a flat panel), ready for your decorator to paint.${inside}`,
      offered: true,
    });
  }

  // 4. Finished board from Cworkshop in a colour that suits the room: nothing to paint
  {
    const colour = boardOf(boards, edits.colour) ?? boardOf(boards, read.colours.find((c) => boardOf(boards, c.code))?.code) ?? boards[0];
    const insideBoard = boardOf(boards, edits.inside) ?? boardOf(boards, read.inside) ?? boards.find((b) => b.code === 'W1000 ST9') ?? colour;
    const same = colour?.code === insideBoard?.code;
    const work = boardWork(read, p, edits);
    const calc = work.calc;
    const outSheets = work.out;
    const inSheets = work.in;
    const markup = 1 + p.boardMarkup / 100;
    const days = work.days;
    const lines: Line[] = [];
    if (colour) {
      if (same) lines.push({ label: `${outSheets + inSheets} sheets ${colour.name} at ${money2(sheetPrice(colour, p))}`, amount: (outSheets + inSheets) * sheetPrice(colour, p) * markup });
      else {
        lines.push({ label: `${outSheets} sheet${outSheets === 1 ? '' : 's'} ${colour.name} (outside) at ${money2(sheetPrice(colour, p))}`, amount: outSheets * sheetPrice(colour, p) * markup });
        if (insideBoard) lines.push({ label: `${inSheets} sheet${inSheets === 1 ? '' : 's'} ${insideBoard.name} (inside) at ${money2(sheetPrice(insideBoard, p))}`, amount: inSheets * sheetPrice(insideBoard, p) * markup });
      }
    }
    lines.push({ label: `Cworkshop cutting, ${outSheets + inSheets} sheets at ${money2(p.cutEdgeSheet)}`, amount: (outSheets + inSheets) * p.cutEdgeSheet });
    if (p.edgeSheet) lines.push({ label: `Edging, ${outSheets + inSheets} sheets at about ${money(p.edgeSheet)}`, amount: (outSheets + inSheets) * p.edgeSheet });
    lines.push({ label: `Hinges, rails and fixings, ${units} unit${units === 1 ? '' : 's'} at ${money(p.hardwareUnit)}`, amount: units * p.hardwareUnit });
    if (drawers) lines.push({ label: `Drawer runners, ${drawers} at £25`, amount: drawers * 25 });
    lines.push({ label: 'Delivery', amount: p.delivery });
    lines.push({ label: `Labour, ${days} day${days === 1 ? '' : 's'} at ${money(p.dayRate)}`, amount: days * p.dayRate });
    const worked = round(lines.reduce((n, l) => n + l.amount, 0));
    const why = read.colours.find((c) => c.code === colour?.code)?.why ?? '';
    const reason = why ? ` (${why.replace(/\.$/, '')})` : '';
    const shade = colour ? (insideBoard && !same ? `Egger ${colour.name} outside${reason}, ${insideBoard.name} inside` : `Egger ${colour.name} inside and out${reason}`) : 'finished board';
    out.push({
      id: 'board',
      title: 'Finished board, colour matched',
      short: 'In finished board, nothing to paint',
      worked,
      ...own('board', worked),
      lines,
      says: `${shade}. The board comes finished, so there’s no painting and no decorator needed.${inside}`,
      offered: Boolean(colour),
      why: colour ? undefined : 'No boards in the list.',
      extra: colour ? `Sheets worked out from the parts: about ${calc.outM2} m² outside, ${calc.inM2} m² inside, ${Math.round(SHEET_YIELD * 100)}% of each sheet used.` : undefined,
    });
  }
  return out;
}

const UNIT_WORD: Partial<Record<RateKey, [string, string]>> = { laminateM2: ['m²', 'm²'], loftM2: ['m²', 'm²'], deckingM2: ['m²', 'm²'], door: ['door', 'doors'] };

/* Other jobs: either one of Raf's own rates (area or count times his price) or days and materials. */
export function otherOptions(read: QuoteRead, p: Prices, edits: QuoteEdits = {}): Option[] {
  return read.other.slice(0, 3).map((o, i) => {
    const id = `o${i + 1}`;
    const lines: Line[] = [];
    if (o.how === 'rate' && o.rate && RATE_KEYS.includes(o.rate)) {
      const word = UNIT_WORD[o.rate];
      const q = word ? Math.max(1, Math.round((Number(o.qty) || 1) * 10) / 10) : Math.max(1, Math.round(Number(o.qty) || 1));
      const label = PRICE_ROWS.find((r) => r.key === o.rate)?.label ?? 'Job';
      lines.push({ label: word ? `${q} ${q === 1 ? word[0] : word[1]} at ${money(p[o.rate])}` : `${q === 1 ? '' : `${q} × `}${label} at ${money(p[o.rate])}`, amount: q * p[o.rate] });
    } else {
      const markup = 1 + p.boardMarkup / 100;
      for (const mt of (o.materials ?? []).slice(0, 12)) if (mt.cost > 0) lines.push({ label: mt.item, amount: mt.cost * markup });
      const days = Math.max(0.25, Math.round((Number(o.days) || 1) * 4) / 4);
      lines.push({ label: `Labour, ${days} day${days === 1 ? '' : 's'} at ${money(p.dayRate)}`, amount: days * p.dayRate });
    }
    const worked = roundUp(Math.max(lines.reduce((n, l) => n + l.amount, 0), p.minJob), p.roundTo);
    const v = edits.price?.[id];
    const price = v && v > 0 ? Math.round(v) : worked;
    return { id, title: o.name, short: o.name, worked, price, changed: price !== worked, lines, says: o.says, offered: true };
  });
}

export function optionsFor(read: QuoteRead, p: Prices, boards: Board[], edits: QuoteEdits = {}, fillWall?: FillWall): Option[] {
  return read.kind === 'wardrobe' ? wardrobeOptions(read, p, boards, edits, fillWall) : otherOptions(read, p, edits);
}

/* In the message unless Raf takes it out; PAX only when it fits. */
export const picked = (o: Option, edits: QuoteEdits = {}) => o.offered && (edits.pick?.[o.id] ?? true);

/* ---------- the message ---------- */

export const CLOSING = 'The next step is a free visit to measure up, then your written quote. I draw it in 3D for you to approve, and nothing is cut until you sign it off.';

export function quoteMessage(read: QuoteRead, options: Option[], edits: QuoteEdits = {}, first = '', sign = false): string {
  const sizes = sizesOf(read, edits);
  const { words, guessed } = sizeWords(sizes);
  const chosen = options.filter((o) => picked(o, edits));
  const asks = read.questions.filter((_, i) => edits.ask?.[String(i)] ?? true);
  const out: string[] = [`Hi ${first || 'there'},`, ''];
  if (read.intro.trim()) out.push(read.intro.trim(), '');
  const basis = read.kind === 'wardrobe' ? ` for ${words}${guessed ? ' (from your brief and photos; I’ll measure properly on the visit)' : ''}` : '';
  if (chosen.length === 1) {
    const o = chosen[0];
    out.push(`My rough price${basis}:`, '', `${o.short}: ${priceWords(o.price)}. ${o.says}`.trim(), '');
  } else if (chosen.length) {
    out.push(`Here are my rough prices${basis}:`, '');
    chosen.forEach((o, i) => out.push(`${i + 1}. ${o.short}: ${priceWords(o.price)}. ${o.says}`.trim(), ''));
  }
  const q = (x: string) => (/[?.!]$/.test(x.trim()) ? x.trim() : `${x.trim()}?`);
  if (asks.length === 1) out.push(`One question to firm it up: ${q(asks[0])}`, '');
  else if (asks.length) out.push('A few questions to firm it up:', ...asks.map((x) => `- ${q(x)}`), '');
  if (read.extra?.trim()) out.push(read.extra.trim(), '');
  out.push(read.closing?.trim() || CLOSING, '', 'Thanks,');
  if (sign) out.push('Raf');
  return out.join('\n');
}

/* The cheapest option in the message, for the list: "from £1,150 + VAT". */
export function fromPrice(options: Option[], edits: QuoteEdits = {}) {
  const ps = options.filter((o) => picked(o, edits)).map((o) => o.price);
  return ps.length ? Math.min(...ps) : 0;
}
