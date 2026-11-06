/* Drawings and cut lists as a paid service (/drawings; Raf, 6 Nov 2026: "making drawings, design, cutlist, 3d drawings
   and assembly as an online remote service which should be paid in advance"). The packs, the prices, what an order
   may carry, the due day and the words the order puts on its ServiceM8 job. No imports, so the page (to show the
   price) and the server (to charge it) use the same numbers.

   Prices are the same as CabinetOS's Done for you packs (£75 / £195 / £395 before VAT, each for up to 3 units, then
   £20 / £45 / £45 a unit), shown here with VAT because most buyers are people building their own furniture.
   Paid in full upfront by card. Raf's promises (6 Nov 2026): within 2 working days, 3 rounds of changes free. */

export const PACKS = ['cutlist', 'drawings', 'design'] as const;
export type Pack = (typeof PACKS)[number];

export const INCLUDED_UNITS = 3;
export const MAX_UNITS = 20;
export const VAT_RATE = 0.2;
export const WORKING_DAYS = 2;
export const FREE_ROUNDS = 3;

/** In pence before VAT: the price for up to INCLUDED_UNITS units, then each unit more. */
const BEFORE_VAT: Record<Pack, { base: number; perExtra: number }> = {
  cutlist: { base: 7500, perExtra: 2000 },
  drawings: { base: 19500, perExtra: 4500 },
  design: { base: 39500, perExtra: 4500 },
};

export const PACK: Record<Pack, { name: string; lead: string; list: string[] }> = {
  cutlist: {
    name: 'Cut list',
    lead: 'You know what you’re building. You want every part right before you buy boards.',
    list: [
      'Every part with its size, board and edge banding',
      'The board layout, so you know how many sheets to buy',
      'A code on every part, so nothing gets mixed up',
      'A spreadsheet your cutting company can take as it is',
    ],
  },
  drawings: {
    name: 'Drawings and cut list',
    lead: 'The whole job drawn and sized, from the boards to the screws.',
    list: [
      'Everything in the Cut list pack',
      'Front views to scale with every size',
      '3D drawings: the whole job, each unit and the inside',
      'Every door and drawer front with its size',
      'Where the drawer runners go, to the mm',
      'Hinges, runners and rails to buy',
      'An assembly guide, one picture per step',
    ],
  },
  design: {
    name: 'Design and drawings',
    lead: 'Not sure what should go inside? I design it with you first.',
    list: [
      'Everything in Drawings and cut list',
      'Two layouts to choose from, drawn in 3D',
      'A 3D view you can turn and open on your phone',
      'Advice on boards, hinges and runners for your job',
    ],
  },
};

export function isPack(v: unknown): v is Pack {
  return typeof v === 'string' && (PACKS as readonly string[]).includes(v);
}

export function units(n: unknown) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(MAX_UNITS, Math.max(1, v)) : 1;
}

export type Price = { beforeVat: number; vat: number; total: number; extraUnits: number };

/** In pence. The VAT is worked out on the price before VAT, so £75 + £15 = £90. */
export function priceOf(pack: Pack, n: number): Price {
  const u = units(n);
  const p = BEFORE_VAT[pack];
  const extraUnits = Math.max(0, u - INCLUDED_UNITS);
  const beforeVat = p.base + extraUnits * p.perExtra;
  const vat = Math.round(beforeVat * VAT_RATE);
  return { beforeVat, vat, total: beforeVat + vat, extraUnits };
}

/** The price shown on a pack card: up to INCLUDED_UNITS units, and each unit more, both with VAT. */
export function packPrices(pack: Pack) {
  const p = BEFORE_VAT[pack];
  return { total: Math.round(p.base * (1 + VAT_RATE)), beforeVat: p.base, perExtra: Math.round(p.perExtra * (1 + VAT_RATE)) };
}

/** £234, £1,350, £23.40 */
export function gbp(pence: number) {
  const v = pence / 100;
  return `£${Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ---------- the due day ---------- */

/* England's bank holidays, so "2 working days" skips them (gov.uk/bank-holidays). Add the next year's when it's out. */
const BANK_HOLIDAYS = new Set([
  '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
  '2028-01-03', '2028-04-14', '2028-04-17', '2028-05-01', '2028-05-29', '2028-08-28', '2028-12-25', '2028-12-26',
]);

/** Today in London, 'YYYY-MM-DD'. */
export function londonDay(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/London' });
}

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isWorkingDay = (day: string) => {
  const w = new Date(`${day}T12:00:00Z`).getUTCDay();
  return w !== 0 && w !== 6 && !BANK_HOLIDAYS.has(day);
};

/** The working day the files are due: WORKING_DAYS working days after the day of the order. */
export function dueDay(now = new Date()) {
  let day = londonDay(now);
  for (let left = WORKING_DAYS; left > 0; ) {
    day = addDays(day, 1);
    if (isWorkingDay(day)) left -= 1;
  }
  return day;
}

/** 'Tuesday 10 November' */
export function dayWords(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/* ---------- files sent with an order ---------- */

export const MAX_FILES = 10;
/** Vercel takes at most 4.5 MB in one request; photos are made smaller on the phone first. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const FILE_EXTS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf', 'skp', 'dwg', 'dxf', 'svg', 'xlsx', 'xls', 'csv', 'txt', 'docx'] as const;
export const FILE_ACCEPT = FILE_EXTS.map((e) => `.${e}`).join(',') + ',image/*';
export const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'];

export const extOf = (name: string) => (name.toLowerCase().split('.').pop() ?? '').trim();
export const fileOk = (name: string) => (FILE_EXTS as readonly string[]).includes(extOf(name));

/** A file name safe for ServiceM8: letters, digits, dot, dash, underscore; keeps the extension. */
export function safeFileName(name: string) {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-\./g, '.')
    .replace(/^[-.]+|[-.]+$/g, '');
  return (cleaned || 'file').slice(-80);
}

/* ---------- the order on its ServiceM8 job ---------- */

/** Every drawings order's job description starts with this, so the Job Kit knows it isn't a fitting job. */
export const ORDER_MARK = 'Drawings order';
export const isDrawingsOrder = (description?: string) => new RegExp(`^${ORDER_MARK}\\b`).test((description ?? '').trim());

export type Order = {
  pack: Pack;
  units: number;
  what: string;
  boards: string;
  place: string;
  files: number;
};

/** The job's description in ServiceM8: what was ordered, then their words. `paid` is filled in once the card payment is in. */
export function orderDescription(o: Order, paid?: { total: number; day: string; due: string }) {
  const price = priceOf(o.pack, o.units);
  return [
    `${ORDER_MARK}: ${PACK[o.pack].name}, ${o.units} unit${o.units === 1 ? '' : 's'}`,
    paid
      ? `Paid online ${dayWords(paid.day)}: ${gbp(paid.total)} with VAT. Due by ${dayWords(paid.due)}.`
      : `Not paid yet: ${gbp(price.total)} with VAT.`,
    o.place ? `Where: ${o.place}` : '',
    o.boards ? `Boards: ${o.boards}` : '',
    o.files ? `Files: ${o.files} sent with the order (in the job's diary).` : 'No files sent with the order.',
    '',
    o.what,
    '',
    'From the drawings page on rafcarpentry.com.',
  ]
    .filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '')
    .join('\n')
    .slice(0, 4000);
}
