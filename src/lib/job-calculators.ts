/* Calculators on the job pages, and how a Job Kit job picks one (8 Nov 2026, Raf: "add calculators to relevant jobs
   in jobkit new job form as you created in the wall panelling job", then "Go").

   A job JSON's `calculator` puts one under the steps ("Work out your own wall / deck"), started with the job's own
   sizes: the batten grid (src/lib/panelling-calc.ts), picture frames (src/lib/picture-frames-calc.ts) or decking
   (src/lib/decking-calc.ts). In the Job Kit, a wall panelling job offers the first two and a decking job the third;
   Raf fills in the real sizes there (with the live answer, so it works on site too), they go to the inbox in
   job.json (notes.calc as typed, `calculator` ready to paste) and notes.txt, and processing the job copies
   `calculator` into the job JSON. Flooring and stud walls get theirs when the first such job comes.

   Types and sums only (the three libs have no imports), so the page, the Job Kit and the checks share them. */

import { DECK_MAX, DECK_MIN, deck, type DeckBoard, type DeckHeight, type DeckRun } from './decking-calc';
import { GRID, grid, mm1, readMm, type GridFrom } from './panelling-calc';
import { FRAMES, frames } from './picture-frames-calc';

export type CalcKind = 'batten-grid' | 'picture-frames' | 'decking';

export type BattenGridCalc = {
  kind: 'batten-grid';
  w: number;
  h: number;
  batten: number;
  panels?: number;
  rows?: number;
  from?: GridFrom;
  skirting?: number;
  gap?: number;
  /** started with standard sizes for a job like this, not measured ones (the page says so) */
  standardSizes?: boolean;
};
export type PictureFramesCalc = {
  kind: 'picture-frames';
  w: number;
  ceiling: number;
  skirting?: number;
  railTop?: number;
  railH?: number;
  mould?: number;
  around?: number;
  between?: number;
  frames?: number;
  upper?: boolean;
  standardSizes?: boolean;
};
export type DeckingCalc = {
  kind: 'decking';
  /** mm along the house and out from it */
  along: number;
  out: number;
  board?: DeckBoard;
  run?: DeckRun;
  height?: DeckHeight;
  centres?: number;
  standardSizes?: boolean;
};
export type JobCalculator = BattenGridCalc | PictureFramesCalc | DeckingCalc;

export const CALC_NAMES: Record<CalcKind, string> = { 'batten-grid': 'Batten grid', 'picture-frames': 'Picture frames', decking: 'Decking' };

/** the calculators that suit a Job Kit job, by its kinds (src/app/job-kit/plan.ts KINDS) */
export function calcKindsFor(kinds: string[]): CalcKind[] {
  const out: CalcKind[] = [];
  if (kinds.includes('Wall panelling')) out.push('batten-grid', 'picture-frames');
  if (kinds.includes('Decking or fence')) out.push('decking');
  return out;
}

/* ---------- the Job Kit's boxes ---------- */

/** what the Job Kit keeps: the calculator picked and its boxes as typed */
export type CalcDraft = { kind: CalcKind | 'none'; v: Record<string, string> };

export type CalcField = {
  key: string;
  label: string;
  /** a size in mm, a count (empty = Auto) or one of a few choices */
  type: 'mm' | 'count' | 'choice';
  def: string;
  options?: { v: string; label: string }[];
  /** filled from the job's first size (W, H or D) when the box is empty */
  fromSize?: 'w' | 'h' | 'd';
  /** shown only when another box has this value */
  when?: [string, string];
  /** the smallest a size may be */
  min?: number;
};

export const CALC_FIELDS: Record<CalcKind, CalcField[]> = {
  'batten-grid': [
    { key: 'w', label: 'Wall width', type: 'mm', def: '', fromSize: 'w', min: 300 },
    {
      key: 'from',
      label: 'Starts',
      type: 'choice',
      def: 'floor',
      options: [
        { v: 'floor', label: 'From the floor' },
        { v: 'skirting', label: 'Above the skirting' },
      ],
    },
    { key: 'skirting', label: 'Skirting', type: 'mm', def: '100', when: ['from', 'skirting'] },
    { key: 'gap', label: 'Gap above it', type: 'mm', def: '0', when: ['from', 'skirting'] },
    { key: 'h', label: 'Height (from the floor)', type: 'mm', def: '', fromSize: 'h', min: 150 },
    { key: 'batten', label: 'Batten width', type: 'mm', def: '69', min: 10 },
    { key: 'panels', label: 'Panels across', type: 'count', def: '' },
    {
      key: 'rows',
      label: 'Rows',
      type: 'choice',
      def: '1',
      options: ['1', '2', '3', '4'].map((r) => ({ v: r, label: r })),
    },
  ],
  'picture-frames': [
    { key: 'w', label: 'Wall width', type: 'mm', def: '', fromSize: 'w', min: 300 },
    { key: 'ceiling', label: 'Floor to ceiling', type: 'mm', def: '', fromSize: 'h', min: 1000 },
    { key: 'skirting', label: 'Skirting', type: 'mm', def: '100' },
    { key: 'railTop', label: 'Top of the rail', type: 'mm', def: '1000', min: 1 },
    { key: 'railH', label: 'Rail height', type: 'mm', def: '45' },
    { key: 'mould', label: 'Moulding width', type: 'mm', def: '22', min: 5 },
    { key: 'around', label: 'Gap round them', type: 'mm', def: '100' },
    { key: 'between', label: 'Gap between', type: 'mm', def: '100' },
    { key: 'frames', label: 'Frames across', type: 'count', def: '' },
    {
      key: 'upper',
      label: 'Above the rail',
      type: 'choice',
      def: 'yes',
      options: [
        { v: 'yes', label: 'Frames' },
        { v: 'no', label: 'Plain wall' },
      ],
    },
  ],
  decking: [
    { key: 'along', label: 'Along the house', type: 'mm', def: '', fromSize: 'w', min: DECK_MIN * 1000 },
    { key: 'out', label: 'Out from the house', type: 'mm', def: '', fromSize: 'd', min: DECK_MIN * 1000 },
    {
      key: 'board',
      label: 'Boards',
      type: 'choice',
      def: 'composite',
      options: [
        { v: 'composite', label: 'Composite' },
        { v: 'softwood', label: 'Softwood' },
      ],
    },
    {
      key: 'run',
      label: 'Boards run',
      type: 'choice',
      def: 'along',
      options: [
        { v: 'along', label: 'Along the house' },
        { v: 'out', label: 'Out from it' },
      ],
    },
    {
      key: 'height',
      label: 'Height',
      type: 'choice',
      def: 'ground',
      options: [
        { v: 'ground', label: 'On the ground' },
        { v: 'raised', label: 'Raised on posts' },
      ],
    },
    {
      key: 'centres',
      label: 'Joists every',
      type: 'choice',
      def: '400',
      options: ['300', '400', '450'].map((c) => ({ v: c, label: c })),
    },
  ],
};

/** the boxes that show, given what's picked */
export const shownFields = (kind: CalcKind, v: Record<string, string>) =>
  CALC_FIELDS[kind].filter((f) => !f.when || (v[f.when[0]] ?? fieldDef(kind, f.when[0])) === f.when[1]);
const fieldDef = (kind: CalcKind, key: string) => CALC_FIELDS[kind].find((f) => f.key === key)?.def ?? '';

/** a new draft for a calculator: the defaults, the job's first size where it fits, and what was typed before (the
 *  other calculators' boxes are kept too, so switching back finds them as they were) */
export function startDraft(kind: CalcKind, size: { w?: string; h?: string; d?: string } | undefined, before: Record<string, string> = {}): Record<string, string> {
  const v: Record<string, string> = { ...before };
  for (const f of CALC_FIELDS[kind]) {
    const had = before[f.key];
    if (had != null && had !== '') v[f.key] = had;
    else if (f.fromSize && size) {
      const s = size[f.fromSize] || (f.fromSize === 'd' ? size.h : '') || '';
      v[f.key] = s || f.def;
    } else v[f.key] = f.def;
  }
  return v;
}

/** the draft as the job page's calculator, or the first box that isn't a size */
export function fromDraft(d: CalcDraft): { calc: JobCalculator | null; bad: string } {
  if (d.kind === 'none') return { calc: null, bad: '' };
  const kind = d.kind;
  const val = (k: string) => d.v[k] ?? fieldDef(kind, k);
  const nums: Record<string, number> = {};
  for (const f of shownFields(kind, d.v)) {
    if (f.type === 'choice') continue;
    const t = val(f.key).trim();
    if (f.type === 'count') {
      const n = t ? Math.round(Number(t)) : 0;
      if (!Number.isFinite(n) || n < 0) return { calc: null, bad: f.key };
      nums[f.key] = n;
      continue;
    }
    const v = readMm(t);
    if (v === null || v < (f.min ?? 0)) return { calc: null, bad: f.key };
    nums[f.key] = v;
  }
  if (kind === 'batten-grid') {
    const from = val('from') === 'skirting' ? 'skirting' : 'floor';
    const c: BattenGridCalc = { kind, w: nums.w, h: nums.h, batten: nums.batten, panels: Math.min(GRID.maxPanels, nums.panels), rows: Math.min(GRID.maxRows, Math.max(1, Number(val('rows')) || 1)), from };
    if (from === 'skirting') {
      c.skirting = nums.skirting;
      c.gap = nums.gap;
    }
    return { calc: c, bad: '' };
  }
  if (kind === 'picture-frames') {
    return {
      calc: {
        kind,
        w: nums.w,
        ceiling: nums.ceiling,
        skirting: nums.skirting,
        railTop: nums.railTop,
        railH: nums.railH,
        mould: nums.mould,
        around: nums.around,
        between: nums.between,
        frames: Math.min(FRAMES.maxFrames, nums.frames),
        upper: val('upper') !== 'no',
      },
      bad: '',
    };
  }
  const along = Math.min(DECK_MAX * 1000, nums.along);
  const out = Math.min(DECK_MAX * 1000, nums.out);
  return {
    calc: {
      kind,
      along,
      out,
      board: val('board') === 'softwood' ? 'softwood' : 'composite',
      run: val('run') === 'out' ? 'out' : 'along',
      height: val('height') === 'raised' ? 'raised' : 'ground',
      centres: [300, 400, 450].includes(Number(val('centres'))) ? Number(val('centres')) : 400,
    },
    bad: '',
  };
}

/* ---------- the answer ---------- */

/** each calculator's input, filled in from a job JSON's calculator */
export const gridInput = (c: BattenGridCalc) => ({ w: c.w, h: c.h, batten: c.batten, panels: c.panels ?? 0, rows: c.rows ?? 1, from: c.from ?? 'floor', skirting: c.skirting ?? 100, gap: c.gap ?? 0 });
export const framesInput = (c: PictureFramesCalc) => ({
  w: c.w,
  ceiling: c.ceiling,
  skirting: c.skirting ?? 100,
  railTop: c.railTop ?? 1000,
  railH: c.railH ?? 45,
  mould: c.mould ?? 22,
  around: c.around ?? 100,
  between: c.between ?? 100,
  frames: c.frames ?? 0,
  upper: c.upper ?? true,
});
export const deckInput = (c: DeckingCalc) => ({
  len: Math.min(DECK_MAX, Math.max(DECK_MIN, Math.round(c.along / 100) / 10)),
  dep: Math.min(DECK_MAX, Math.max(DECK_MIN, Math.round(c.out / 100) / 10)),
  board: c.board ?? 'composite',
  run: c.run ?? 'along',
  height: c.height ?? 'ground',
  centres: c.centres ?? 400,
});

/** the answer in a line, as the Job Kit shows it under the boxes */
export function calcAnswer(c: JobCalculator): { ok: boolean; line: string } {
  if (c.kind === 'batten-grid') {
    const g = grid(gridInput(c));
    if (g.error) return { ok: false, line: g.error };
    return { ok: true, line: `${g.n} panels across${g.rows > 1 ? `, ${g.rows} rows` : ''} · openings ${mm1(g.openW)} × ${mm1(g.openH)} · ${g.lengths.length} lengths of ${GRID.stock}` };
  }
  if (c.kind === 'picture-frames') {
    const f = frames(framesInput(c));
    if (f.error) return { ok: false, line: f.error };
    return { ok: true, line: `${f.n} frames across · ${mm1(f.fw)} × ${mm1(f.lh)} below${f.input.upper ? `, ${mm1(f.fw)} × ${mm1(f.uh)} above` : ''} · ${f.lengths.length} lengths of moulding` };
  }
  const d = deck(deckInput(c));
  return { ok: true, line: `${d.area} m² · ${d.boards} boards · ${d.joists} joists · ${c.height === 'raised' ? `${d.posts} posts` : `${d.pads} pads`}` };
}

/** the calculator as a line of notes.txt */
export function calcNotesLine(c: JobCalculator): string {
  const a = calcAnswer(c);
  let what: string;
  if (c.kind === 'batten-grid')
    what = `wall ${mm1(c.w)} · height ${mm1(c.h)} ${c.from === 'skirting' ? `from the floor, above a ${mm1(c.skirting ?? 100)} skirting with a ${mm1(c.gap ?? 0)} gap` : 'from the floor'} · batten ${mm1(c.batten)} · ${c.panels ? `${c.panels} panels` : 'panels on Auto'} · ${c.rows ?? 1} row${(c.rows ?? 1) === 1 ? '' : 's'}`;
  else if (c.kind === 'picture-frames')
    what = `wall ${mm1(c.w)} · ceiling ${mm1(c.ceiling)} · skirting ${mm1(c.skirting ?? 100)} · dado rail ${mm1(c.railH ?? 45)} high, top at ${mm1(c.railTop ?? 1000)} · moulding ${mm1(c.mould ?? 22)} · gaps ${mm1(c.around ?? 100)} round, ${mm1(c.between ?? 100)} between · ${c.frames ? `${c.frames} frames` : 'frames on Auto'} · ${c.upper === false ? 'plain wall above' : 'frames above'}`;
  else what = `${mm1(c.along)} along the house × ${mm1(c.out)} out · ${c.board ?? 'composite'} boards ${c.run === 'out' ? 'out from the house' : 'along the house'} · ${c.height === 'raised' ? 'raised' : 'on the ground'} · joists every ${c.centres ?? 400}`;
  return `${CALC_NAMES[c.kind]}: ${what} (${a.line})`;
}
