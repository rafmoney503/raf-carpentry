/* What each guide sale brings in, for the Job Kit's Guide sales (src/app/job-kit/guide-sales.tsx). No imports, so
   scripts and tests can run it. Prices include UK VAT at 20% (the guide is £9.99 with VAT). Stripe's fee is the real
   one when it has been read from Stripe (rafsite.guide_sales.fee), else worked out from Stripe's UK rates by where the
   buyer was: 1.5% + 20p for UK cards, 2.5% + 20p for European ones, 3.25% + 20p for the rest (Adaptive Pricing's
   conversion is paid by the buyer, so none of it is ours). The real fee on the first sale (16 Nov 2026, a Belgian
   card) was 45p, as the European rate gives. */

export type GuideSale = {
  at: string; // when it was paid (ISO)
  product: string;
  first: string | null; // the buyer's first name
  name?: string | null; // their name as they typed it at Stripe (since 19 Nov 2026 afternoon)
  email?: string | null; // their email, for a reply
  country: string | null; // two letters, from their billing address
  amount: number | null; // pence, with VAT
  currency: string | null;
  buyerAmount: number | null; // what they paid in their own money (Stripe's Adaptive Pricing), in its smallest unit
  buyerCurrency: string | null;
  fee: number | null; // Stripe's fee in pence, when read from Stripe
  downloads: number;
  emailed: boolean;
  seen: string | null; // when Raf first saw it in the Job Kit
  key: string;
};

export const GUIDE_TITLES: Record<string, string> = { 'pax-guide': 'IKEA PAX, built in' };
export const guideTitle = (p: string) => GUIDE_TITLES[p] ?? p;

const EEA = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO'.split(' '));
export const isEEA = (c: string | null) => Boolean(c && EEA.has(c.toUpperCase()));
export const isUK = (c: string | null) => !c || ['GB', 'UK', 'IM', 'JE', 'GG'].includes(c.toUpperCase());

/* Stripe's fee in pence: { pence, real } (real = read from Stripe, else worked out from its rates). */
export function feeOf(s: Pick<GuideSale, 'amount' | 'fee' | 'country'>): { pence: number; real: boolean } {
  if (typeof s.fee === 'number' && s.fee >= 0) return { pence: s.fee, real: true };
  const a = s.amount ?? 0;
  if (!a) return { pence: 0, real: false };
  const rate = !s.country || s.country.toUpperCase() === 'GB' ? 0.015 : isEEA(s.country) ? 0.025 : 0.0325;
  return { pence: Math.round(a * rate + 20), real: false };
}

/* The VAT inside a price that includes 20%: what's left after it is the price ÷ 1.2, to the penny. */
export const beforeVat = (pence: number) => Math.round(pence / 1.2);
export const vatIn = (pence: number) => pence - beforeVat(pence);

export type Income = {
  count: number;
  paid: number; // what buyers paid, pence with VAT
  vat: number; // the VAT in it (to HMRC)
  fee: number; // Stripe's fees
  feeReal: boolean; // every fee was read from Stripe
  kept: number; // paid less VAT and fees
  payout: number; // what Stripe pays into the bank (paid less fees; the VAT is in it)
};

export function incomeOf(sales: GuideSale[]): Income {
  let paid = 0;
  let vat = 0;
  let fee = 0;
  let feeReal = true;
  for (const s of sales) {
    const a = s.amount ?? 0;
    paid += a;
    vat += vatIn(a);
    const f = feeOf(s);
    fee += f.pence;
    if (!f.real && a) feeReal = false;
  }
  return { count: sales.length, paid, vat, fee, feeReal, kept: paid - vat - fee, payout: paid - fee };
}

/* London days and months, so 'today' and 'this month' are Raf's. */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
export const londonDayOf = (d: Date | string) => dayFmt.format(typeof d === 'string' ? new Date(d) : d);
export const londonMonthOf = (d: Date | string) => londonDayOf(d).slice(0, 7);

export function periods(sales: GuideSale[], now = new Date()) {
  const today = londonDayOf(now);
  const month = today.slice(0, 7);
  return {
    today: incomeOf(sales.filter((s) => londonDayOf(s.at) === today)),
    month: incomeOf(sales.filter((s) => londonMonthOf(s.at) === month)),
    all: incomeOf(sales),
  };
}

export const pounds = (pence: number) => `${pence < 0 ? '−' : ''}£${(Math.abs(pence) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* What they paid in their own money, when it wasn't pounds: "€12.45". */
export function buyerMoney(s: Pick<GuideSale, 'buyerAmount' | 'buyerCurrency'>): string | null {
  if (!s.buyerAmount || !s.buyerCurrency || s.buyerCurrency.toLowerCase() === 'gbp') return null;
  try {
    const nf = new Intl.NumberFormat('en-GB', { style: 'currency', currency: s.buyerCurrency.toUpperCase() });
    const digits = nf.resolvedOptions().maximumFractionDigits ?? 2;
    return nf.format(s.buyerAmount / 10 ** digits);
  } catch {
    return null;
  }
}

export function countryName(c: string | null): string {
  if (!c) return '';
  try {
    return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(c.toUpperCase()) ?? c;
  } catch {
    return c;
  }
}

/* Sales not seen in the Job Kit yet, from the last 14 days (the To do lines). */
export const unseen = (sales: GuideSale[], now = Date.now()) => sales.filter((s) => !s.seen && now - Date.parse(s.at) < 14 * 86_400_000);
