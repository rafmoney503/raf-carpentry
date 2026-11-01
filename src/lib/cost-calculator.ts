/* Cost calculator (/cost and /cost/<job>): Raf's own prices for seven jobs, and the sums that turn a size into the
   range the page shows. No imports, so scripts can check it on its own (scripts/cost-calculator/check.mts).

   Raf, 1 Nov 2026 (after the London price research): wardrobes £1,200 a metre plain, £1,600 shaker; a kitchen fit
   £2,200 (labour only); laminate £40 a m² (labour only); loft boarding £120 a m² (raised); decking £250 a m²
   (composite); hanging a door £250 (labour only); media wall £2,800 basic, £5,400 mid; day rate £650.
   His prices are before VAT, as on his quotes, so the page adds VAT. The range runs from his price to 25% over it
   (he picked that: it never shows less than his price). Marked GUESS = not from Raf, for him to check. */

export const VAT_RATE = 0.2;
export const RANGE_OVER = 0.25;
/* About half of his £650 day rate, in whole tens: the least a job is priced at. GUESS */
export const MIN_JOB = 330;

export type CostUnit = 'metre' | 'm2' | 'door' | 'job';

export type CostOption = {
  id: string;
  label: string;
  sub: string; // one line under the label
  rate: number; // £ before VAT, per unit (a whole job when the unit is 'job')
};

export type CostJob = {
  slug: string;
  name: string; // card and calculator title, e.g. "Fitted wardrobes"
  h1: string; // page title before the accent, e.g. "Fitted wardrobe cost"
  what: string; // the brief's What: line, e.g. "Fitted wardrobe"
  choicesWhat: string; // words for the thank-you email's closest designs
  unit: CostUnit;
  qty?: { label: string; min: number; max: number; step: number; def: number; word: string; words: string };
  optionLabel: string;
  /* which line of the brief the picked option goes on: the doors or boards are a Finish, a kitchen's size a Rough size */
  briefLabel: 'Finish' | 'Rough size';
  options: CostOption[];
  def: string; // option picked to start
  card: string; // the line on its card on /cost
  lede: string;
  inPrice: string[];
  notInPrice: string[];
  moves: string[]; // what takes it towards the top of the range
  service?: string; // /services/<slug> when there is one
  metaTitle: string;
  metaDescription: string;
};

export const COST_JOBS: CostJob[] = [
  {
    slug: 'fitted-wardrobes',
    name: 'Fitted wardrobes',
    h1: 'Fitted wardrobe cost',
    what: 'Fitted wardrobe',
    choicesWhat: 'Fitted wardrobe',
    unit: 'metre',
    qty: { label: 'Width of the wardrobe', min: 0.6, max: 6, step: 0.1, def: 2.4, word: 'm', words: 'metres wide' },
    briefLabel: 'Finish',
    optionLabel: 'Doors',
    options: [
      { id: 'flat', label: 'Flat doors', sub: 'Plain, smooth fronts', rate: 1200 },
      { id: 'shaker', label: 'Shaker doors', sub: 'A frame round each door', rate: 1600 },
    ],
    def: 'flat',
    card: 'Made to measure, priced by the metre.',
    lede: 'Set the width, pick the doors and see my price straight away. Then send it to me for a written quote.',
    inPrice: ['Made to measure in 18 mm board, backs included', 'Doors, shelves and a hanging rail', 'Fitted and scribed to your walls and ceiling', 'Room left clean'],
    notInPrice: ['Painting: built in MDF, ready for your decorator'],
    moves: ['Walls and ceilings far out of square', 'Drawers and a busy inside layout', 'Sloping ceilings and awkward corners'],
    service: 'fitted-wardrobes',
    metaTitle: 'Fitted wardrobe cost in London | Price calculator | Raf Carpentry',
    metaDescription: 'How much do fitted wardrobes cost in London? Set the width and the doors and see my price per metre straight away, then get a written quote.',
  },
  {
    slug: 'kitchen-fitting',
    name: 'Kitchen fitting',
    h1: 'Kitchen fitting cost',
    what: 'Kitchen fitting',
    choicesWhat: 'Kitchen',
    unit: 'job',
    briefLabel: 'Rough size',
    optionLabel: 'Size of the kitchen',
    options: [
      { id: 'small', label: 'Small', sub: 'Up to 9 units', rate: 1600 }, // GUESS: Raf gave the standard one
      { id: 'standard', label: 'Standard', sub: '10 to 14 units', rate: 2200 },
      { id: 'large', label: 'Large', sub: '15 units or more', rate: 3200 }, // GUESS
    ],
    def: 'standard',
    card: 'Labour only: you buy the kitchen, I fit it.',
    lede: 'Labour only: you buy the kitchen, I fit it. Pick the size and see my price straight away.',
    inPrice: ['Building and fitting the units', 'Doors, drawers and handles', 'Worktops and built-in appliances put in'],
    notInPrice: ['The kitchen itself (you buy it)', 'Plumbing, electrics and tiling', 'Taking out the old kitchen'],
    moves: ['Walls far out of square', 'Cutting worktops round corners and pipes', 'Tall units and end panels'],
    service: 'kitchens',
    metaTitle: 'Kitchen fitting cost in London | Price calculator | Raf Carpentry',
    metaDescription: 'How much does it cost to fit a kitchen in London? Labour only: pick the size and see my price straight away, then get a written quote.',
  },
  {
    slug: 'laminate-flooring',
    name: 'Laminate flooring',
    h1: 'Laminate flooring fitting cost',
    what: 'Laminate flooring',
    choicesWhat: 'Flooring',
    unit: 'm2',
    qty: { label: 'Floor area', min: 5, max: 150, step: 1, def: 20, word: 'm²', words: 'square metres' },
    briefLabel: 'Finish',
    optionLabel: 'Fitting',
    options: [{ id: 'fit', label: 'Laying it', sub: 'Labour only', rate: 40 }],
    def: 'fit',
    card: 'Labour only, priced by the m².',
    lede: 'Labour only: you buy the laminate and underlay, I lay it. Set the area and see my price straight away.',
    inPrice: ['Laying the laminate and underlay', 'Cutting round door frames and pipes', 'Room left clean'],
    notInPrice: ['The laminate and underlay (you buy them)', 'Levelling a bad floor', 'New skirting and trimming doors'],
    moves: ['A floor that needs levelling', 'Lots of doorways and small rooms', 'Taking up the old floor'],
    service: 'flooring',
    metaTitle: 'Laminate flooring fitting cost in London | Raf Carpentry',
    metaDescription: 'How much does it cost to lay laminate flooring in London? Set the area in m² and see my price straight away, then get a written quote.',
  },
  {
    slug: 'loft-boarding',
    name: 'Loft boarding',
    h1: 'Loft boarding cost',
    what: 'Loft boarding',
    choicesWhat: 'Loft storage',
    unit: 'm2',
    qty: { label: 'Area to board', min: 5, max: 60, step: 1, def: 20, word: 'm²', words: 'square metres' },
    briefLabel: 'Finish',
    optionLabel: 'Boarding',
    options: [{ id: 'raised', label: 'Raised boarding', sub: 'On loft legs over the insulation', rate: 120 }],
    def: 'raised',
    card: 'Raised on loft legs, supplied and fitted.',
    lede: 'Boards raised on loft legs, so your insulation keeps working. Set the area and see my price straight away.',
    inPrice: ['Loft legs, boards and fixings', 'Raised over your insulation', 'Supplied and fitted'],
    notInPrice: ['A loft ladder or a bigger hatch', 'Topping up the insulation'],
    moves: ['A tight hatch or a low roof', 'Water tanks and pipes in the way', 'Joists that need packing out'],
    metaTitle: 'Loft boarding cost in London | Price calculator | Raf Carpentry',
    metaDescription: 'How much does loft boarding cost in London? Raised boarding on loft legs: set the area in m² and see my price straight away.',
  },
  {
    slug: 'decking',
    name: 'Decking',
    h1: 'Decking cost',
    what: 'Decking',
    choicesWhat: 'Decking',
    unit: 'm2',
    qty: { label: 'Deck area', min: 5, max: 80, step: 1, def: 15, word: 'm²', words: 'square metres' },
    briefLabel: 'Finish',
    optionLabel: 'Boards',
    options: [
      { id: 'composite', label: 'Composite', sub: 'No staining, lasts longest', rate: 250 },
      { id: 'softwood', label: 'Softwood', sub: 'Treated timber boards', rate: 180 }, // GUESS: Raf gave composite only
    ],
    def: 'composite',
    card: 'Composite or softwood, supplied and fitted.',
    lede: 'Supplied and fitted, frame and all. Set the area, pick the boards and see my price straight away.',
    inPrice: ['The frame, boards and fixings', 'Supplied and fitted', 'Garden left clean'],
    notInPrice: ['Steps, railings and lights', 'Taking up an old deck'],
    moves: ['A sloping garden or a raised deck', 'Lots of corners and cuts', 'Access through the house'],
    metaTitle: 'Decking cost in London | Price calculator | Raf Carpentry',
    metaDescription: 'How much does decking cost in London? Composite or softwood, supplied and fitted: set the area in m² and see my price straight away.',
  },
  {
    slug: 'internal-doors',
    name: 'Internal doors',
    h1: 'Internal door fitting cost',
    what: 'Internal doors',
    choicesWhat: 'Door fitting',
    unit: 'door',
    qty: { label: 'How many doors', min: 1, max: 20, step: 1, def: 4, word: 'doors', words: 'doors' },
    briefLabel: 'Finish',
    optionLabel: 'Fitting',
    options: [{ id: 'hang', label: 'Hanging a door', sub: 'Labour only', rate: 250 }],
    def: 'hang',
    card: 'Labour only, priced by the door.',
    lede: 'Labour only: you buy the doors, I hang them. Set how many and see my price straight away.',
    inPrice: ['Trimming each door to fit', 'Hinges and handles fitted', 'Room left clean'],
    notInPrice: ['The doors and handles (you buy them)', 'New frames and fire doors'],
    moves: ['Frames far out of square', 'Heavy solid or glazed doors', 'Locks and closers'],
    service: 'door-fitting',
    metaTitle: 'Internal door fitting cost in London | Raf Carpentry',
    metaDescription: 'How much does it cost to hang internal doors in London? Set how many doors and see my price straight away, then get a written quote.',
  },
  {
    slug: 'media-wall',
    name: 'Media wall',
    h1: 'Media wall cost',
    what: 'Media wall',
    choicesWhat: 'TV unit',
    unit: 'job',
    briefLabel: 'Finish',
    optionLabel: 'Kind of wall',
    options: [
      { id: 'basic', label: 'Simple', sub: 'A boarded wall with a TV recess', rate: 2800 }, // GUESS: the words
      { id: 'mid', label: 'With extras', sub: 'Shelves, alcoves and a fire recess', rate: 5400 }, // GUESS: the words
    ],
    def: 'basic',
    card: 'Built in, ready for your decorator.',
    lede: 'Built in, ready for your decorator. Pick the kind and see my price straight away.',
    inPrice: ['The frame, boarding and recesses', 'Made to fit your wall and TV', 'Room left clean'],
    notInPrice: ['The fire, the TV and an electrician', 'Painting: ready for your decorator'],
    moves: ['A wider or taller wall', 'Panelling, slats or stone finishes', 'Hiding a lot of cables'],
    metaTitle: 'Media wall cost in London | Price calculator | Raf Carpentry',
    metaDescription: 'How much does a media wall cost in London? Pick a simple wall or one with extras and see my price straight away, then get a written quote.',
  },
];

export const costJob = (slug: string) => COST_JOBS.find((j) => j.slug === slug);

/* £ to the nearest 10. */
const round10 = (v: number) => Math.round(v / 10) * 10;

export type CostEstimate = {
  qty: number; // the size used (1 for a whole job)
  rate: number;
  net: [number, number]; // before VAT
  gross: [number, number]; // with VAT
  minimum: boolean; // the job came under MIN_JOB, so that is the price
};

/* Snap a typed or slid size into the job's range and step. */
export function cleanQty(job: CostJob, v: number): number {
  const q = job.qty;
  if (!q) return 1;
  if (!Number.isFinite(v)) return q.def;
  const snapped = Math.round(v / q.step) * q.step;
  const dp = q.step < 1 ? 1 : 0;
  return Number(Math.min(q.max, Math.max(q.min, snapped)).toFixed(dp));
}

export function estimate(job: CostJob, qty: number, optionId: string): CostEstimate {
  const opt = job.options.find((o) => o.id === optionId) ?? job.options.find((o) => o.id === job.def) ?? job.options[0];
  const q = job.qty ? cleanQty(job, qty) : 1;
  const raw = q * opt.rate;
  const minimum = raw < MIN_JOB;
  const lo = round10(Math.max(raw, MIN_JOB));
  const hi = round10(lo * (1 + RANGE_OVER));
  return { qty: q, rate: opt.rate, net: [lo, hi], gross: [round10(lo * (1 + VAT_RATE)), round10(hi * (1 + VAT_RATE))], minimum };
}

export const money = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;

/* "£1,440 a metre", "£2,640", "£48 a m²", "£300 a door": the lowest price with VAT, for the cards. */
export function fromPrice(job: CostJob): string {
  const low = Math.max(Math.min(...job.options.map((o) => o.rate)), job.unit === 'job' ? MIN_JOB : 0) * (1 + VAT_RATE);
  if (job.unit === 'job') return money(round10(low));
  const per = job.unit === 'metre' ? 'a metre' : job.unit === 'm2' ? 'a m²' : 'a door';
  return `${money(low)} ${per}`;
}

/* The size as words for the brief and the page: "2.4 m wide", "20 m²", "4 doors". */
export function qtyWords(job: CostJob, qty: number): string {
  if (!job.qty) return '';
  if (job.unit === 'metre') return `${qty} m wide`;
  if (job.unit === 'm2') return `${qty} m²`;
  return `${qty} ${qty === 1 ? 'door' : 'doors'}`;
}

/* The brief, written the way Plan your project writes it, so ServiceM8 and the Job Kit read it the same:
   the labelled lines first (What, Rough size, Finish, When), then the calculator's lines, then Notes. */
export function costMessage(d: { name: string; job: CostJob; qty: number; optionId: string; when: string; postcode: string; notes: string }): string {
  const e = estimate(d.job, d.qty, d.optionId);
  const opt = d.job.options.find((o) => o.id === d.optionId) ?? d.job.options[0];
  const size = qtyWords(d.job, e.qty);
  const lines: (string | null)[] = [
    `Hi Raf, this is ${d.name.trim()}. Here is my brief from your website.`,
    `What: ${d.job.what}`,
    size ? `Rough size: ${size}` : null,
    d.job.options.length > 1 ? `${d.job.briefLabel}: ${opt.label} (${opt.sub.toLowerCase()})` : null,
    d.when ? `When: ${d.when}` : null,
    '',
    'From the cost calculator:',
    `${d.job.name}${size ? `, ${size}` : ''}${d.job.options.length > 1 ? `, ${opt.label.toLowerCase()}` : ''}`,
    `Price shown: ${money(e.gross[0])} to ${money(e.gross[1])} with VAT (${money(e.net[0])} to ${money(e.net[1])} before VAT)`,
    e.minimum ? `That is the smallest job price (${money(MIN_JOB)} before VAT).` : null,
    ...(d.notes.trim() ? ['', `Notes: ${d.notes.trim()}`] : []),
  ];
  return lines
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-');
}

export const COST_WHEN = ['As soon as possible', 'In the next 3 months', 'Later this year', 'Just pricing it up'];
