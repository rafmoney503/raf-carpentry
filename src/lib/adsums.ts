import type { AdDraft, AdResult, AdRow, AdsReport, Business, CampaignRow, OurDay, PlaceRow } from './ads-types';

/* HQ's Ads section's sums, for one business or both (pure, checked by scripts/check-ads.ts). Meta's numbers are
   added up from its ad rows; what the website counters saw comes from rafcarpentry.com's and CabinetOS's own
   visit counts. Nothing is guessed: a cost per enquiry is only worked out when there was at least one. */

export type Pick = 'both' | Business;
export const PICKS: { key: Pick; label: string }[] = [
  { key: 'both', label: 'Both' },
  { key: 'raf', label: 'Raf Carpentry' },
  { key: 'cabinetos', label: 'CabinetOS' },
];
export const BUSINESS_NAME: Record<Business, string> = { raf: 'Raf Carpentry', cabinetos: 'CabinetOS' };

export type DayRow = { day: string; spend: number; clicks: number; impressions: number; enquiries: number; signups: number };
export type BestAd = { ad: AdRow; why: string };
export type Ours = { visits: number; enquiries: number; signups: number; fb: number; ig: number; untagged: number; untaggedEnq: number; untaggedSignups: number };

export type AdSums = {
  pick: Pick;
  spend: number;
  impressions: number;
  reach: number;
  reachAdded: boolean; // reach added up from ads (people can be counted twice)
  clicks: number;
  cpc: number | null;
  ctr: number | null; // %
  ours: Ours | null;
  perEnquiry: number | null;
  perSignup: number | null;
  meta: AdResult | null; // what Meta itself counts (leads, messages, sign-ups, landing page views)
  days: DayRow[];
  ads: AdRow[];
  live: AdRow[]; // running now
  campaigns: CampaignRow[];
  places: PlaceRow[] | null; // only for both (Meta splits the whole account)
  best: BestAd | null;
  before: { spend: number; clicks: number } | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const inPick = (pick: Pick, b: Business | null) => pick === 'both' || b === pick;

function everyDay(since: string, until: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${since}T12:00:00Z`); t <= Date.parse(`${until}T12:00:00Z`) && out.length < 400; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function oursOf(days: OurDay[] | null, pick: Pick): Ours | null {
  if (!days) return null;
  const o: Ours = { visits: 0, enquiries: 0, signups: 0, fb: 0, ig: 0, untagged: 0, untaggedEnq: 0, untaggedSignups: 0 };
  for (const d of days) {
    if (pick !== 'cabinetos') {
      o.visits += d.raf.paid;
      o.enquiries += d.raf.paidEnq;
      o.fb += d.raf.paidFb;
      o.ig += d.raf.paidIg;
      o.untagged += d.raf.meta;
      o.untaggedEnq += d.raf.metaEnq;
    }
    if (pick !== 'raf') {
      o.visits += d.cos.paid;
      o.signups += d.cos.paidSignups;
      o.fb += d.cos.paidFb;
      o.ig += d.cos.paidIg;
      o.untagged += d.cos.meta;
      o.untaggedSignups += d.cos.metaSignups;
    }
  }
  return o;
}

const sumResult = (rows: { result: AdResult | null }[]): AdResult | null => {
  const order: AdResult['kind'][] = ['lead', 'message', 'signup', 'landing'];
  const by = new Map<AdResult['kind'], number>();
  for (const r of rows) if (r.result) by.set(r.result.kind, (by.get(r.result.kind) ?? 0) + r.result.n);
  for (const k of order) if (by.get(k)) return { kind: k, n: by.get(k)! };
  return null;
};

/* The best ad: of those that spent at least £1 and got a click, the cheapest result Meta counted, else the
   cheapest click; ties to the higher click-through rate. */
export function bestAd(ads: AdRow[]): BestAd | null {
  const tried = ads.filter((a) => a.spend >= 1 && a.clicks > 0);
  if (!tried.length) return null;
  const ctr = (a: AdRow) => (a.impressions ? a.clicks / a.impressions : 0);
  const withResult = tried.filter((a) => a.result && a.result.kind !== 'landing');
  if (withResult.length) {
    const best = [...withResult].sort((a, b) => a.spend / a.result!.n - b.spend / b.result!.n || ctr(b) - ctr(a))[0];
    return { ad: best, why: `${money(best.spend / best.result!.n)} a ${RESULT_ONE[best.result!.kind]}` };
  }
  const best = [...tried].sort((a, b) => a.spend / a.clicks - b.spend / b.clicks || ctr(b) - ctr(a))[0];
  return { ad: best, why: `${money(best.spend / best.clicks)} a click, ${pct(ctr(best) * 100)} of people who saw it clicked` };
}

export function adSums(r: AdsReport, pick: Pick): AdSums {
  const meta = r.meta;
  const ads = (meta?.ads ?? []).filter((a) => inPick(pick, a.business));
  const ids = new Set(ads.map((a) => a.id));
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  const impressions = ads.reduce((s, a) => s + a.impressions, 0);
  const clicks = ads.reduce((s, a) => s + a.clicks, 0);
  const reachAdded = pick !== 'both' || !meta;
  const reach = pick === 'both' && meta ? meta.totals.reach : ads.reduce((s, a) => s + a.reach, 0);
  const ours = oursOf(r.ours, pick);

  const byDay = new Map<string, DayRow>();
  for (const day of everyDay(r.since, r.until)) byDay.set(day, { day, spend: 0, clicks: 0, impressions: 0, enquiries: 0, signups: 0 });
  for (const d of meta?.days ?? []) {
    if (!ids.has(d.ad)) continue;
    const row = byDay.get(d.day);
    if (!row) continue;
    row.spend += d.spend;
    row.clicks += d.clicks;
    row.impressions += d.impressions;
  }
  for (const d of r.ours ?? []) {
    const row = byDay.get(d.day);
    if (!row) continue;
    if (pick !== 'cabinetos') row.enquiries += d.raf.paidEnq;
    if (pick !== 'raf') row.signups += d.cos.paidSignups;
  }
  for (const row of byDay.values()) row.spend = r2(row.spend);

  const rafSpend = (meta?.ads ?? []).filter((a) => a.business === 'raf').reduce((s, a) => s + a.spend, 0);
  const cosSpend = (meta?.ads ?? []).filter((a) => a.business === 'cabinetos').reduce((s, a) => s + a.spend, 0);
  const rafOurs = oursOf(r.ours, 'raf');
  const cosOurs = oursOf(r.ours, 'cabinetos');
  return {
    pick,
    spend: r2(spend),
    impressions,
    reach,
    reachAdded,
    clicks,
    cpc: clicks ? r2(spend / clicks) : null,
    ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : null,
    ours,
    perEnquiry: pick !== 'cabinetos' && rafOurs && rafOurs.enquiries ? r2(rafSpend / rafOurs.enquiries) : null,
    perSignup: pick !== 'raf' && cosOurs && cosOurs.signups ? r2(cosSpend / cosOurs.signups) : null,
    meta: sumResult(ads),
    days: [...byDay.values()],
    ads,
    live: ads.filter((a) => a.status === 'ACTIVE'),
    campaigns: (meta?.campaigns ?? []).filter((c) => inPick(pick, c.business)),
    places: pick === 'both' && meta ? meta.places : null,
    best: bestAd(ads),
    before: pick === 'both' ? (meta?.before ?? null) : null,
  };
}

export type DraftGroups = { waiting: AdDraft[]; approved: AdDraft[]; live: AdDraft[]; no: AdDraft[] };
export function draftGroups(drafts: AdDraft[], pick: Pick): DraftGroups {
  const mine = drafts.filter((d) => inPick(pick, d.business));
  return {
    live: mine.filter((d) => d.live && d.status !== 'no'),
    approved: mine.filter((d) => !d.live && d.status === 'approved'),
    waiting: mine.filter((d) => !d.live && d.status === 'new'),
    no: mine.filter((d) => d.status === 'no'),
  };
}

export const RESULT_ONE: Record<AdResult['kind'], string> = { lead: 'lead', message: 'message', signup: 'sign-up', landing: 'page view' };
export const RESULT_MANY: Record<AdResult['kind'], string> = { lead: 'leads', message: 'messages started', signup: 'sign-ups', landing: 'landing page views' };

export function money(n: number, currency = 'GBP'): string {
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : `${currency} `;
  const whole = Math.abs(n) >= 100 || Number.isInteger(n);
  return `${n < 0 ? '−' : ''}${sym}${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}
export function pct(n: number): string {
  return `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}%`;
}

/* Meta's effective status in plain words, and whether it's running. */
export function statusWords(s: string): { text: string; on: boolean; bad: boolean } {
  const m: Record<string, string> = {
    ACTIVE: 'Running',
    PAUSED: 'Paused',
    CAMPAIGN_PAUSED: 'Campaign paused',
    ADSET_PAUSED: 'Ad set paused',
    IN_PROCESS: 'Being checked by Meta',
    PENDING_REVIEW: 'Being checked by Meta',
    WITH_ISSUES: 'Has a problem',
    DISAPPROVED: 'Turned down by Meta',
    PREAPPROVED: 'Approved, not started',
    PENDING_BILLING_INFO: 'Needs payment details',
    ARCHIVED: 'Finished',
    DELETED: 'Deleted',
  };
  return { text: m[s] ?? (s ? s.toLowerCase().replace(/_/g, ' ') : 'Not running'), on: s === 'ACTIVE', bad: s === 'DISAPPROVED' || s === 'WITH_ISSUES' || s === 'PENDING_BILLING_INFO' };
}

/* What to do when the ads can't be read. */
export function adsProblem(state: string, detail?: string): { h: string; steps: string[]; kit?: boolean } {
  const kit = 'In the Job Kit: Social media, at the bottom, tap Connect ads, and say yes to everything Facebook asks.';
  const say: Record<string, { h: string; steps: string[]; kit?: boolean }> = {
    'hq-not-set-up': { h: 'HQ can’t ask rafcarpentry.com yet', steps: ['Add HQ_NOTIFY_SECRET to the rafal-hq project in Vercel (the same value as on raf-carpentry), then redeploy.'] },
    'not-set-up': { h: 'Facebook isn’t set up on rafcarpentry.com', steps: [`It’s missing ${detail || 'its Meta settings'} in Vercel.`] },
    'not-connected': { h: 'Facebook isn’t connected yet', steps: ['Open the Job Kit, Social media, and Connect Instagram and Facebook.', kit], kit: true },
    'no-permission': {
      h: 'HQ can’t read your ads yet',
      steps: [
        'Make sure you have an ad account: open Meta Ads Manager (adsmanager.facebook.com) once and it makes one.',
        kit,
        'If Facebook says “Invalid scopes: ads_read”: developers.facebook.com, your app Raf Job Kit, Add product, Marketing API, Set up. Then Connect ads again.',
      ],
      kit: true,
    },
    'no-account': { h: 'Your login has no ad account', steps: ['Open Meta Ads Manager (adsmanager.facebook.com) once: it makes your ad account. Add a payment method there only when you’re ready to run an ad.', 'Then come back here: HQ looks again every few minutes.'] },
    expired: { h: 'Facebook wants you to connect again', steps: ['In the Job Kit: Social media, Connect ads.'], kit: true },
  };
  return say[state] ?? { h: 'Couldn’t read the ads just now', steps: [detail ? `${detail}. HQ tries again in a minute.` : 'HQ tries again in a minute.'] };
}
