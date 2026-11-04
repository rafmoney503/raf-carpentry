import type { Prices } from './quote-sums';

/* Design with Claude (Job Kit, 3 Nov 2026, Raf: 'in jobkit i paste what client wants, then there is a small window
   where claude is ... creating design, and once design is created i can send email from jobkit from info@ and just
   attach created link'). Claude plans a piece of fitted furniture as a layout (src/lib/concept-maker.ts); the Job Kit
   and the customer's page draw it (src/components/ConceptDrawing.tsx) and the prices come from Raf's own price list,
   worked out here, never by Claude. Only a type import, so the sums can be tested on their own. All sizes in mm. */

export type Front = 'doors' | 'door' | 'drawers' | 'open';
export type Section = {
  from: number; // mm from the floor
  to: number;
  front: Front; // doors = a pair, door = one
  hinge?: 'left' | 'right'; // one door: which side it hangs on
  drawers?: number; // how many high, one above the other
  across?: number; // how many side by side (4 Nov 2026, Raf: 'I told him three drawers in a row and not three drawers in one column'); 1 when missing
  worktop?: boolean; // an open section standing on a solid oak top
  shelves: number[]; // heights from the floor
  rail?: number; // a hanging rail's height
  hooks?: boolean; // hooks for a broom and mop
  label?: string; // what goes in it, for the customer
};
export type Bay = { width: number; height: number; boxedAbove: boolean; sections: Section[] };
export type Box = { bay: number; from: number; to: number; label: string }; // a beam or boxing inside a bay, at the back
export type Style = 'flat' | 'shaker';
export type Handles = 'bar' | 'knob' | 'edge' | 'push';
export type Option = {
  name: string;
  summary: string; // one line for the customer
  style: Style;
  handles: Handles;
  pick: boolean;
  why: string; // why Claude picks it
  bays: Bay[];
  boxes: Box[];
  racks: number; // door racks
  risers: number; // step risers on deep shelves
  oak: number; // metres of solid oak worktop shelf
};
export type Plan = {
  title: string; // 'Pantry'
  seen: string; // what Claude made of the brief and photos, for Raf
  intro: string; // the email's opening line after 'Thanks ...'
  width: number;
  height: number;
  depth: number | null;
  stripOut: boolean; // old units to take out first
  options: Option[];
  questions: string[];
};
export type Brief = {
  want: string; // what they want, in their words or Raf's
  width: number;
  height: number;
  depth: string; // '600', 'varies'
  other: string; // other sizes and things to know
  must: string[];
  styles: string[]; // empty: Claude picks
  count: number; // 1 to 3 options
  first: string; // the customer's first name
  mail?: string; // the Outlook email it came from (Inbox), or their newest email when it started from a job
  photos?: string[]; // that email's photos (attachment ids)
  sm8?: string; // the ServiceM8 job it started from (Find their job; src/lib/concept-from-job.ts)
  jobPhotos?: string[]; // photos on that job in ServiceM8 (attachment uuids); with `photos`, 4 at most
  // On the phone only (the server drops it): where each box was filled from, Quotes' guesses for empty sizes, what
  // was found on the job. Shown while the brief is filled in.
  found?: { at: number; from: Partial<Record<'want' | 'first' | 'width' | 'height' | 'depth' | 'other' | 'must', string>>; guess: { width?: number; height?: number; depth?: number }; lines: string[]; none: string[]; problems: string[]; photos: { src: 'job' | 'mail'; id: string; name: string; at: string | null }[] };
};
export type ConceptData = {
  brief: Brief;
  plan?: Plan;
  note?: string; // what Raf asked Claude to change last
  model?: string;
  at?: number;
  ms?: number;
  tokens?: { in: number; out: number };
  photosSent?: number;
  error?: string;
  detail?: string;
};
export type ConceptEdits = {
  width?: number; // Raf's own run size (the drawing is stretched to it)
  height?: number;
  own?: Record<string, number>; // his own price for an option (index)
  hide?: number[]; // options left off the customer's page
  prices?: boolean; // show prices on the page (default yes)
  inside?: boolean; // show the inside view on the page (default yes)
  colour?: string; // the doors' colour in the drawing
  live?: boolean; // the customer's page is on
  liveAt?: number;
};
export type ConceptRow = { id: string; state: 'brief' | 'working' | 'ready' | 'failed'; data: ConceptData | null; edits: ConceptEdits | null; editsAt: number; claimed?: number | null; updated: number };

export const MAX_W = 12000;
export const MAX_H = 3200;
export const COLOURS = [
  { hex: '#b7c0ae', name: 'Sage' },
  { hex: '#eeeae1', name: 'Off-white' },
  { hex: '#cfc6b5', name: 'Stone' },
  { hex: '#b9c4cc', name: 'Pale blue' },
  { hex: '#4a5568', name: 'Slate' },
];
export const DEFAULT_COLOUR = COLOURS[0].hex;
export const newBrief = (b: Partial<Brief> = {}): Brief => ({ want: '', width: 0, height: 0, depth: '', other: '', must: [], styles: [], count: 3, first: '', ...b });
export const MUST_IDEAS = ['Shelves only', 'No drawers', 'Round the beam boxes', 'Broom cupboard', 'Keep the cost down', 'Doors to hide it all', 'Some open shelves'];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.parseFloat(String(v ?? '')) || 0);
const s = (v: unknown, max = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/\s*[—–]\s*/g, ', ').trim().slice(0, max) : '');
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r5 = (v: number) => Math.round(v / 5) * 5;

/* ---------- Claude's answer made safe ---------- */

/* Sections cover the bay from the floor to its top with no gaps; widths add up to the run; nothing outside it. */
export function cleanPlan(raw: Record<string, unknown>, brief: Brief): Plan {
  const width = clamp(r5(num(raw.width) || brief.width || 2400), 300, MAX_W);
  const height = clamp(r5(num(raw.height) || brief.height || 2400), 300, MAX_H);
  const depthN = num(raw.depth);
  const opts = (Array.isArray(raw.options) ? raw.options : []).slice(0, 3).map((o) => cleanOption((o ?? {}) as Record<string, unknown>, width, height));
  const options = opts.filter((o) => o.bays.length);
  if (options.length && !options.some((o) => o.pick)) options[0].pick = true;
  let picked = false;
  for (const o of options) {
    if (o.pick && !picked) picked = true;
    else o.pick = false;
  }
  return {
    title: s(raw.title, 40) || 'Your design',
    seen: s(raw.seen, 600),
    intro: s(raw.intro, 400),
    width,
    height,
    depth: depthN > 100 && depthN < 1500 ? r5(depthN) : null,
    stripOut: raw.strip_out === true || raw.stripOut === true,
    options,
    questions: (Array.isArray(raw.questions) ? raw.questions : []).map((q) => s(q, 200)).filter(Boolean).slice(0, 4),
  };
}

function cleanOption(o: Record<string, unknown>, width: number, height: number): Option {
  const raw = (Array.isArray(o.bays) ? o.bays : []).slice(0, 12).map((b) => (b ?? {}) as Record<string, unknown>);
  const widths = raw.map((b) => Math.max(1, num(b.width)));
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  // widths scaled to fill the run exactly, the odd mm on the last bay
  const ws = widths.map((w) => Math.max(150, r5((w / total) * width)));
  if (ws.length) ws[ws.length - 1] += width - ws.reduce((a, b) => a + b, 0);
  const bays: Bay[] = raw.map((b, i) => cleanBay(b, ws[i], height));
  const boxes: Box[] = (Array.isArray(o.boxes) ? o.boxes : [])
    .slice(0, 12)
    .map((x) => {
      const b = (x ?? {}) as Record<string, unknown>;
      const bay = Math.round(num(b.bay));
      const top = bays[bay]?.height ?? height;
      const from = clamp(r5(num(b.from)), 0, top);
      const to = clamp(r5(num(b.to) || top), from + 20, top);
      return { bay, from, to, label: s(b.label, 40) || 'boxing' };
    })
    .filter((b) => b.bay >= 0 && b.bay < bays.length && b.to > b.from);
  return {
    name: s(o.name, 40) || 'Option',
    summary: s(o.summary, 220),
    style: o.style === 'shaker' ? 'shaker' : 'flat',
    handles: o.handles === 'knob' || o.handles === 'edge' || o.handles === 'push' ? o.handles : 'bar',
    pick: o.pick === true,
    why: s(o.why, 220),
    bays,
    boxes,
    racks: clamp(Math.round(num(o.racks)), 0, 20),
    risers: clamp(Math.round(num(o.risers)), 0, 20),
    oak: clamp(Math.round(num(o.oak_m ?? o.oak) * 10) / 10, 0, 12),
  };
}

function cleanBay(b: Record<string, unknown>, width: number, runH: number): Bay {
  const height = clamp(r5(num(b.height) || runH), 300, runH);
  const raw = (Array.isArray(b.sections) ? b.sections : []).slice(0, 6).map((x) => (x ?? {}) as Record<string, unknown>);
  raw.sort((a, c) => num(a.from) - num(c.from));
  const sections: Section[] = [];
  let at = 0;
  raw.forEach((x, i) => {
    const last = i === raw.length - 1;
    const to = last ? height : clamp(r5(num(x.to)), at + 150, height - 150 * (raw.length - 1 - i));
    if (to <= at) return;
    const front: Front = x.front === 'door' || x.front === 'drawers' || x.front === 'open' ? x.front : 'doors';
    const sec: Section = { from: at, to, front: front === 'doors' && width < 500 ? 'door' : front === 'door' && width > 700 ? 'doors' : front, shelves: [] };
    if (sec.front === 'door') sec.hinge = x.hinge === 'right' ? 'right' : 'left';
    if (sec.front === 'drawers') {
      sec.drawers = clamp(Math.round(num(x.drawers) || 3), 1, 6);
      const across = Math.round(num(x.across));
      const most = Math.min(6, Math.floor(width / 250)); // no drawer narrower than 250
      if (across >= 2 && most >= 2) sec.across = Math.min(across, most);
    }
    if (sec.front === 'open' && x.worktop === true) sec.worktop = true;
    sec.shelves = (Array.isArray(x.shelves) ? x.shelves : [])
      .map((h) => r5(num(h)))
      .filter((h) => h > at + 60 && h < to - 60)
      .sort((a, c) => a - c)
      .filter((h, j, all) => j === 0 || h - all[j - 1] >= 120)
      .slice(0, 10);
    const rail = r5(num(x.rail));
    if (rail > at + 400 && rail < to - 20) sec.rail = rail;
    if (x.hooks === true) sec.hooks = true;
    const label = s(x.label, 60);
    if (label) sec.label = label;
    sections.push(sec);
    at = to;
  });
  if (!sections.length) sections.push({ from: 0, to: height, front: width < 500 ? 'door' : 'doors', hinge: 'left', shelves: [] });
  sections[sections.length - 1].to = height;
  return { width, height, boxedAbove: b.boxed_above === true || b.boxedAbove === true || height < runH - 100, sections };
}

/* How a bank of drawers is laid out: rows (one above the other) by columns (side by side). A plan that doesn't say
   (drawn before 'across' was there, or Claude leaving it out) with drawers that would be thin strips wider than any
   drawer Raf makes, like three stacked in a 1,500 bench, has them side by side instead: the same number of drawers. */
export function drawerGrid(s: Pick<Section, 'from' | 'to' | 'drawers' | 'across'>, bayWidth: number): { rows: number; cols: number } {
  const n = Math.max(1, s.drawers ?? 3);
  if (s.across && s.across >= 2) return { rows: n, cols: Math.max(1, Math.min(s.across, Math.floor(bayWidth / 250))) };
  if (n >= 2 && bayWidth > 1000 && (s.to - s.from) / n < 200 && bayWidth / n >= 300) return { rows: 1, cols: n };
  return { rows: n, cols: 1 };
}
/* The plan with every bank of drawers written as it's drawn, for sending the current design back to Claude. */
export const asDrawn = (plan: Plan): Plan => ({
  ...plan,
  options: plan.options.map((o) => ({
    ...o,
    bays: o.bays.map((b) => ({
      ...b,
      sections: b.sections.map((x) => {
        if (x.front !== 'drawers') return x;
        const g = drawerGrid(x, b.width);
        return { ...x, drawers: g.rows, across: g.cols };
      }),
    })),
  })),
});
export const drawerCount = (s: Section, bayWidth: number) => {
  if (s.front !== 'drawers') return 0;
  const g = drawerGrid(s, bayWidth);
  return g.rows * g.cols;
};

/* ---------- Raf's own size: the drawing stretched to it ---------- */

export function sizedPlan(plan: Plan, edits?: ConceptEdits | null): Plan {
  const w = edits?.width && edits.width >= 300 && edits.width <= MAX_W ? edits.width : plan.width;
  const h = edits?.height && edits.height >= 300 && edits.height <= MAX_H ? edits.height : plan.height;
  if (w === plan.width && h === plan.height) return plan;
  const sx = w / plan.width;
  const sy = h / plan.height;
  const y = (v: number) => r5(v * sy);
  return {
    ...plan,
    width: w,
    height: h,
    options: plan.options.map((o) => {
      const ws = o.bays.map((b) => Math.max(150, r5(b.width * sx)));
      if (ws.length) ws[ws.length - 1] += w - ws.reduce((a, b) => a + b, 0);
      return {
        ...o,
        bays: o.bays.map((b, i) => ({
          ...b,
          width: ws[i],
          height: Math.min(h, y(b.height)),
          sections: b.sections.map((x, j) => ({
            ...x,
            from: j === 0 ? 0 : y(x.from),
            to: j === b.sections.length - 1 ? Math.min(h, y(b.height)) : y(x.to),
            shelves: x.shelves.map(y),
            rail: x.rail ? y(x.rail) : undefined,
          })),
        })),
        boxes: o.boxes.map((b) => ({ ...b, from: y(b.from), to: y(b.to) })),
      };
    }),
  };
}

/* ---------- prices, from Raf's list ---------- */

export type PriceLine = { label: string; amount: number };
export type OptionPrice = { lines: PriceLine[]; worked: number; total: number; low: number; high: number; own: boolean };
const roundUp = (n: number, to: number) => Math.ceil(Math.max(0, n) / Math.max(1, to) - 1e-9) * Math.max(1, to);
const roundDown = (n: number, to: number) => Math.floor(Math.max(0, n) / Math.max(1, to) + 1e-9) * Math.max(1, to);
export const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const m1 = (mm: number) => `${(Math.round(mm / 100) / 10).toLocaleString('en-GB')} m`;

/* A bay that's mostly open shelves is priced at the open rate; the rest at the door style's rate a metre. */
export const isOpenBay = (b: Bay) => b.sections.filter((x) => x.front === 'open').reduce((n, x) => n + x.to - x.from, 0) >= b.height / 2;

export function priceOption(o: Option, p: Prices, stripOut: boolean, own?: number): OptionPrice {
  const lines: PriceLine[] = [];
  const closed = o.bays.filter((b) => !isOpenBay(b)).reduce((n, b) => n + b.width, 0);
  const open = o.bays.filter(isOpenBay).reduce((n, b) => n + b.width, 0);
  const rate = o.style === 'shaker' ? p.shakerPerM : p.plainPerM;
  if (closed) lines.push({ label: `${o.style === 'shaker' ? 'Shaker doors' : 'Flat doors'}, ${m1(closed)} at ${money(rate)} a metre`, amount: (closed / 1000) * rate });
  if (open) lines.push({ label: `Open shelving, ${m1(open)} at ${money(p.openPerM)} a metre`, amount: (open / 1000) * p.openPerM });
  const drawers = o.bays.reduce((n, b) => n + b.sections.reduce((k, x) => k + drawerCount(x, b.width), 0), 0);
  if (drawers) lines.push({ label: `${drawers} drawer${drawers === 1 ? '' : 's'} at ${money(p.drawer)}`, amount: drawers * p.drawer });
  if (o.oak) lines.push({ label: `Solid oak worktop shelf, ${o.oak.toLocaleString('en-GB')} m at ${money(p.oakPerM)}`, amount: o.oak * p.oakPerM });
  if (o.racks) lines.push({ label: `${o.racks} door rack${o.racks === 1 ? '' : 's'} at ${money(p.rack)}`, amount: o.racks * p.rack });
  if (o.risers) lines.push({ label: `${o.risers} step riser${o.risers === 1 ? '' : 's'} at ${money(p.riser)}`, amount: o.risers * p.riser });
  if (stripOut) lines.push({ label: 'Take out the old units', amount: p.stripOut });
  const worked = roundUp(Math.max(lines.reduce((n, l) => n + l.amount, 0), p.minJob), p.roundTo);
  const total = own && own > 0 ? own : worked;
  return { lines, worked, total, low: roundDown(total * 0.95, p.roundTo), high: roundUp(total * 1.07, p.roundTo), own: Boolean(own && own > 0) };
}
export const rangeText = (pr: OptionPrice) => `${money(pr.low)} – ${money(pr.high)}`;

/* ---------- the email ---------- */

export function conceptMessage(plan: Plan, edits: ConceptEdits | null | undefined, prices: Prices, link: string, first: string) {
  const shown = plan.options.map((o, i) => ({ o, i })).filter(({ i }) => !(edits?.hide ?? []).includes(i));
  const showPrices = edits?.prices !== false;
  const lines = shown.map(({ o, i }, k) => {
    const pr = priceOption(o, prices, plan.stripOut, edits?.own?.[String(i)]);
    return `${k + 1}. ${o.name}${o.pick && shown.length > 1 ? ' (my pick)' : ''}${showPrices ? `: ${rangeText(pr)} + VAT` : ''}`;
  });
  const many = shown.length > 1;
  return [
    first ? `Hi ${first},` : 'Hi,',
    '',
    `Thanks for the details.${plan.intro ? ` ${plan.intro}` : ''} ${many ? `Here are ${shown.length === 2 ? 'two' : 'three'} ways to do it` : 'Here’s how I’d do it'}${showPrices ? ', with rough prices' : ''}:`,
    '',
    ...lines,
    '',
    `You can see ${many ? 'them all' : 'it'} drawn up here, doors closed and inside:`,
    link,
    '',
    ...(showPrices ? ['The prices are for the woodwork, supplied and fitted, ready for your decorator to paint. I’ll measure properly on a free visit, then send a written quote.', ''] : []),
    ...(plan.questions.length ? [plan.questions.length === 1 ? `One question: ${plan.questions[0]}` : `A few questions:\n${plan.questions.map((q) => `- ${q}`).join('\n')}`, ''] : []),
    `If ${many ? 'one of these is' : 'this is'} within budget, send me a couple of days that suit and I’ll come and measure up.`,
    '',
    'Thanks,',
    'Raf',
  ].join('\n');
}

/* ---------- sizes in an email ('3.8m wide and 1.75m high', '2400 x 2200') ---------- */

const toMm = (v: number, unit: string) => {
  const u = unit.toLowerCase();
  if (u.startsWith('mm')) return v;
  if (u.startsWith('cm')) return v * 10;
  if (u.startsWith('m')) return v * 1000;
  return v < 20 ? v * 1000 : v; // no unit: metres when small
};
export function sizesFromText(text: string): { width?: number; height?: number; depth?: number } {
  const out: { width?: number; height?: number; depth?: number } = {};
  const t = text.replace(/,(\d{3})\b/g, '$1');
  const put = (k: 'width' | 'height' | 'depth', v: number) => {
    if (!out[k] && v >= 200 && v <= 15000) out[k] = Math.round(v);
  };
  const re = /(\d+(?:\.\d+)?)\s*(mm|cm|m(?:etres?|eters?)?)?\b\s*(?:\(\w+\)\s*)?(wide|width|long|high|height|tall|deep|depth)/gi;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const v = toMm(Number.parseFloat(m[1]), m[2] ?? '');
    const k = /wid|long/i.test(m[3]) ? 'width' : /hig|tall/i.test(m[3]) ? 'height' : 'depth';
    put(k, v);
  }
  const re2 = /(width|height|depth|ceiling(?: height)?)\s*(?:of|is|:)?\s*(?:about|roughly|approx\.?)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m(?:etres?|eters?)?)?\b/gi;
  for (let m = re2.exec(t); m; m = re2.exec(t)) put(/^ceiling/i.test(m[1]) ? 'height' : (m[1].toLowerCase() as 'width' | 'height' | 'depth'), toMm(Number.parseFloat(m[2]), m[3] ?? ''));
  const x = /(\d+(?:\.\d+)?)\s*(mm|cm|m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)?\b/i.exec(t);
  if (x && !out.width && !out.height) {
    put('width', toMm(Number.parseFloat(x[1]), x[2] ?? x[4] ?? ''));
    put('height', toMm(Number.parseFloat(x[3]), x[4] ?? x[2] ?? ''));
  }
  return out;
}

/* A new design's link code: 10 letters and digits, the only key to the customer's page. */
export function newCode(rand: (n: number) => number = (n) => Math.floor(Math.random() * n)) {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let c = '';
  for (let i = 0; i < 10; i++) c += a[rand(a.length)];
  return c;
}
export const CODE_RE = /^[a-z0-9]{10}$/;

/* A brief from the phone, made safe before it's kept or sent. */
export function cleanBrief(raw: unknown): Brief {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '');
  const size = (v: unknown, max: number) => {
    const n = Math.round(num(v));
    return n >= 100 && n <= max ? n : 0;
  };
  const words = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x, 60)).filter(Boolean).slice(0, 8) : []);
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_=+/-]{8,400}$/.test(x)).slice(0, 4) : []);
  const mail = typeof b.mail === 'string' && /^[A-Za-z0-9_=+/-]{8,400}$/.test(b.mail) ? b.mail : undefined;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sm8 = typeof b.sm8 === 'string' && uuid.test(b.sm8) ? b.sm8.toLowerCase() : undefined;
  const mailPhotos = mail ? ids(b.photos) : [];
  // the job's photos only with the job, and 4 photos at most altogether
  const jobPhotos = sm8 && Array.isArray(b.jobPhotos) ? b.jobPhotos.filter((x): x is string => typeof x === 'string' && uuid.test(x)).slice(0, Math.max(0, 4 - mailPhotos.length)) : [];
  return {
    want: text(b.want, 3000),
    width: size(b.width, MAX_W),
    height: size(b.height, MAX_H),
    depth: s(b.depth, 30),
    other: text(b.other, 600),
    must: words(b.must),
    styles: words(b.styles).slice(0, 3),
    count: clamp(Math.round(num(b.count) || 3), 1, 3),
    first: s(b.first, 40),
    ...(mail ? { mail, photos: mailPhotos } : {}),
    ...(sm8 ? { sm8, jobPhotos } : {}),
  };
}
/* Photos that go to Claude with this brief: the email's and the job's. */
export const photoCount = (b: Pick<Brief, 'photos' | 'jobPhotos' | 'mail' | 'sm8'>) => (b.mail ? (b.photos ?? []).length : 0) + (b.sm8 ? (b.jobPhotos ?? []).length : 0);
