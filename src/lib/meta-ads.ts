import { listDrafts } from './ad-drafts';
import type { AdAccount, AdDay, AdDraft, AdResult, AdRow, AdsReport, AdsState, Business, CampaignRow, MetaSide, OurDay, PlaceRow } from './ads-types';
import { jobkitRpc, syncSetUp } from './job-kit-sync-server';
import { MetaError, metaAdsAuth, metaGraph, metaSetUp } from './meta-social';

/* HQ's Ads section (15 Nov 2026, Raf: 'create another section for ads for facebook and instagram as i need to push
   hard', then 'Both' (Raf Carpentry and CabinetOS) and 'Results + ready ads'). What rafcarpentry.com answers
   GET /api/hq/ads: the ads from Meta's Marketing API, what the website counters saw from them, and the ads Claude
   wrote for Raf to approve (src/lib/ad-writer.ts).

   Read only. The long-lived user token from the Job Kit's Social screen (src/lib/meta-social.ts), with the ads_read
   permission it asks for only when Raf taps Connect ads there. Every ad account the login sees (up to 3, closed ones
   left out), the period's totals, a day at a time per ad, per campaign, per ad with its picture and words, and
   Facebook against Instagram. Nothing here changes an ad, a budget or a payment.

   Which business an ad is for comes from where it sends people (cabinetos.co.uk or rafcarpentry.com), else its
   campaign's name. */

const DAY = 86_400_000;
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function londonDay(ms = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export function businessOf(link?: string, name = ''): Business | null {
  const l = (link || '').toLowerCase();
  if (/(^|\/\/|\.)cabinetos\.co\.uk/.test(l)) return 'cabinetos';
  if (/(^|\/\/|\.)rafcarpentry\.com/.test(l)) return 'raf';
  if (/cabinet\s*os/i.test(name)) return 'cabinetos';
  if (/\braf\b|carpentry|wardrobe|alcove|kitchen|panelling|joiner/i.test(name)) return 'raf';
  return null;
}

type Action = { action_type?: string; value?: string };
const KINDS: { kind: AdResult['kind']; types: string[] }[] = [
  { kind: 'lead', types: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'] },
  { kind: 'message', types: ['onsite_conversion.messaging_conversation_started_7d'] },
  { kind: 'signup', types: ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration', 'omni_complete_registration'] },
  { kind: 'landing', types: ['landing_page_view', 'omni_landing_page_view'] },
];
/* What Meta counts as the result: the first of these it has (types for one thing can be listed twice: the biggest). */
export function resultOf(actions?: Action[]): AdResult | null {
  if (!Array.isArray(actions)) return null;
  for (const k of KINDS) {
    const n = Math.max(0, ...actions.filter((a) => a.action_type && k.types.includes(a.action_type)).map((a) => num(a.value)));
    if (n > 0) return { kind: k.kind, n };
  }
  return null;
}
const addResult = (a: AdResult | null, b: AdResult | null): AdResult | null => {
  if (!a) return b;
  if (!b) return a;
  if (a.kind === b.kind) return { kind: a.kind, n: a.n + b.n };
  // two kinds: keep the one higher on the list
  return KINDS.findIndex((k) => k.kind === a.kind) <= KINDS.findIndex((k) => k.kind === b.kind) ? a : b;
};

/* The draft an ad was made from: utm_content=<id> in its URL parameters or link. */
export function draftOf(...where: (string | undefined)[]): string | undefined {
  for (const w of where) {
    const m = /utm_content=([a-z0-9]{8})\b/.exec(w || '');
    if (m) return m[1];
  }
  return undefined;
}

type Paged<T> = { data?: T[]; paging?: { cursors?: { after?: string }; next?: string } };
async function all<T>(path: string, token: string, params: Record<string, string>, pages = 5): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < pages; i++) {
    const r = await metaGraph<Paged<T>>(path, token, after ? { ...params, after } : params);
    out.push(...(r.data ?? []));
    after = r.paging?.next ? r.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return out;
}

type Creative = {
  thumbnail_url?: string;
  image_url?: string;
  title?: string;
  body?: string;
  url_tags?: string;
  link_url?: string;
  object_story_spec?: {
    link_data?: { link?: string; name?: string; message?: string; picture?: string };
    video_data?: { title?: string; message?: string; image_url?: string; call_to_action?: { value?: { link?: string } } };
  };
  asset_feed_spec?: { link_urls?: { website_url?: string }[]; titles?: { text?: string }[]; bodies?: { text?: string }[] };
};
type MetaAd = { id: string; name?: string; effective_status?: string; campaign_id?: string; creative?: Creative };
type MetaCampaign = { id: string; name?: string; effective_status?: string; objective?: string; daily_budget?: string; lifetime_budget?: string };
type Insight = {
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  inline_link_clicks?: string;
  actions?: Action[];
  date_start?: string;
  publisher_platform?: string;
};

const linkOf = (c?: Creative) =>
  str(c?.object_story_spec?.link_data?.link, 300) ||
  str(c?.object_story_spec?.video_data?.call_to_action?.value?.link, 300) ||
  str(c?.asset_feed_spec?.link_urls?.[0]?.website_url, 300) ||
  str(c?.link_url, 300);

const PLACES = ['facebook', 'instagram', 'messenger', 'audience_network'] as const;

async function account(acc: AdAccount, token: string, since: string, until: string, before: { since: string; until: string }) {
  const act = `/${acc.id}/insights`;
  const range = (a: string, b: string) => JSON.stringify({ since: a, until: b });
  const tr = range(since, until);
  const [tot, prev, byAd, daily, places, ads, campaigns] = await Promise.all([
    metaGraph<{ data?: Insight[] }>(act, token, { level: 'account', fields: 'spend,impressions,reach,inline_link_clicks', time_range: tr }),
    metaGraph<{ data?: Insight[] }>(act, token, { level: 'account', fields: 'spend,inline_link_clicks', time_range: range(before.since, before.until) }).catch(() => ({ data: undefined })),
    all<Insight>(act, token, { level: 'ad', fields: 'ad_id,ad_name,campaign_id,campaign_name,spend,impressions,reach,inline_link_clicks,actions', time_range: tr, limit: '200' }),
    all<Insight>(act, token, { level: 'ad', fields: 'ad_id,spend,impressions,inline_link_clicks', time_range: tr, time_increment: '1', limit: '500' }),
    metaGraph<{ data?: Insight[] }>(act, token, { level: 'account', fields: 'spend,impressions,inline_link_clicks', breakdowns: 'publisher_platform', time_range: tr }).catch(() => ({ data: [] })),
    all<MetaAd>(`/${acc.id}/ads`, token, {
      fields: 'id,name,effective_status,campaign_id,creative{thumbnail_url,image_url,title,body,url_tags,link_url,object_story_spec,asset_feed_spec}',
      limit: '100',
    }),
    all<MetaCampaign>(`/${acc.id}/campaigns`, token, { fields: 'id,name,effective_status,objective,daily_budget,lifetime_budget', limit: '100' }),
  ]);
  return { acc, tot: tot.data?.[0], prev: prev.data?.[0], byAd, daily, places: places.data ?? [], ads, campaigns };
}

async function metaSide(token: string, days: number, since: string, until: string): Promise<{ state: AdsState; detail?: string; meta: MetaSide | null }> {
  const list = await all<{ id: string; name?: string; account_status?: number; currency?: string; amount_spent?: string }>('/me/adaccounts', token, {
    fields: 'id,name,account_status,currency,amount_spent',
    limit: '50',
  });
  const accounts: AdAccount[] = list
    .filter((a) => a.account_status !== 100 && a.account_status !== 101)
    .map((a) => ({ id: a.id.startsWith('act_') ? a.id : `act_${a.id}`, name: str(a.name, 80) || a.id, currency: a.currency || 'GBP', status: a.account_status ?? 0, active: a.account_status === 1, spentAll: num(a.amount_spent) / 100 }))
    .sort((a, b) => Number(b.active) - Number(a.active) || b.spentAll - a.spentAll)
    .slice(0, 3);
  if (!accounts.length) return { state: 'no-account', meta: null };
  const before = { since: shift(since, -days), until: shift(since, -1) };
  const got = await Promise.all(accounts.map((a) => account(a, token, since, until, before)));

  const totals = { spend: 0, impressions: 0, reach: 0, clicks: 0 };
  const prev = { spend: 0, clicks: 0, any: false };
  const placeMap = new Map<string, PlaceRow>();
  const dayRows: AdDay[] = [];
  const ads: AdRow[] = [];
  const camps: CampaignRow[] = [];
  for (const g of got) {
    totals.spend += num(g.tot?.spend);
    totals.impressions += num(g.tot?.impressions);
    totals.reach += num(g.tot?.reach);
    totals.clicks += num(g.tot?.inline_link_clicks);
    if (g.prev) {
      prev.spend += num(g.prev.spend);
      prev.clicks += num(g.prev.inline_link_clicks);
      prev.any = true;
    }
    for (const p of g.places) {
      const key = (PLACES as readonly string[]).includes(p.publisher_platform ?? '') ? (p.publisher_platform as PlaceRow['place']) : 'other';
      const row = placeMap.get(key) ?? { place: key, spend: 0, impressions: 0, clicks: 0 };
      row.spend += num(p.spend);
      row.impressions += num(p.impressions);
      row.clicks += num(p.inline_link_clicks);
      placeMap.set(key, row);
    }
    for (const d of g.daily) if (d.ad_id && d.date_start) dayRows.push({ day: d.date_start, ad: d.ad_id, spend: num(d.spend), impressions: num(d.impressions), clicks: num(d.inline_link_clicks) });
    const ins = new Map(g.byAd.filter((x) => x.ad_id).map((x) => [x.ad_id!, x]));
    const campName = new Map(g.campaigns.map((c) => [c.id, str(c.name, 120)]));
    const seen = new Set<string>();
    const rowOf = (id: string, ad?: MetaAd, i?: Insight): AdRow => {
      const c = ad?.creative;
      const link = linkOf(c);
      const campaignId = ad?.campaign_id || i?.campaign_id || '';
      const campaign = campName.get(campaignId) || str(i?.campaign_name, 120);
      const name = str(ad?.name, 120) || str(i?.ad_name, 120) || id;
      return {
        id,
        name,
        status: ad?.effective_status || 'ARCHIVED',
        account: g.acc.name,
        campaignId,
        campaign,
        business: businessOf(link, `${campaign} ${name}`),
        thumb: str(c?.thumbnail_url || c?.image_url || c?.object_story_spec?.link_data?.picture || c?.object_story_spec?.video_data?.image_url, 1000) || undefined,
        headline: str(c?.object_story_spec?.link_data?.name || c?.object_story_spec?.video_data?.title || c?.asset_feed_spec?.titles?.[0]?.text || c?.title, 120) || undefined,
        text: str(c?.object_story_spec?.link_data?.message || c?.object_story_spec?.video_data?.message || c?.asset_feed_spec?.bodies?.[0]?.text || c?.body, 600) || undefined,
        link: link || undefined,
        draft: draftOf(c?.url_tags, link),
        spend: num(i?.spend),
        impressions: num(i?.impressions),
        reach: num(i?.reach),
        clicks: num(i?.inline_link_clicks),
        result: resultOf(i?.actions),
      };
    };
    for (const ad of g.ads) {
      seen.add(ad.id);
      ads.push(rowOf(ad.id, ad, ins.get(ad.id)));
    }
    // ads deleted since, that still ran in the period
    for (const [id, i] of ins) if (!seen.has(id)) ads.push(rowOf(id, undefined, i));
    for (const c of g.campaigns) {
      const mine = ads.filter((a) => a.campaignId === c.id);
      const votes = new Map<Business, number>();
      for (const a of mine) if (a.business) votes.set(a.business, (votes.get(a.business) ?? 0) + Math.max(1, a.spend));
      const business = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? businessOf('', str(c.name, 120));
      camps.push({
        id: c.id,
        name: str(c.name, 120) || c.id,
        status: c.effective_status || '',
        objective: c.objective || '',
        daily: c.daily_budget ? num(c.daily_budget) / 100 : undefined,
        lifetime: c.lifetime_budget ? num(c.lifetime_budget) / 100 : undefined,
        business,
        ads: mine.length,
        spend: mine.reduce((s, a) => s + a.spend, 0),
        impressions: mine.reduce((s, a) => s + a.impressions, 0),
        reach: mine.reduce((s, a) => s + a.reach, 0),
        clicks: mine.reduce((s, a) => s + a.clicks, 0),
        result: mine.reduce<AdResult | null>((r, a) => addResult(r, a.result), null),
      });
    }
  }
  // an ad's business follows its campaign's when its own link and name don't say
  const campBiz = new Map(camps.map((c) => [c.id, c.business]));
  for (const a of ads) if (!a.business) a.business = campBiz.get(a.campaignId) ?? null;
  ads.sort((a, b) => b.spend - a.spend || (a.status === 'ACTIVE' ? -1 : 1));
  camps.sort((a, b) => b.spend - a.spend);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    state: 'ok',
    meta: {
      accounts,
      currency: accounts[0].currency,
      totals: { ...totals, spend: round(totals.spend) },
      before: prev.any ? { spend: round(prev.spend), clicks: prev.clicks } : null,
      places: [...placeMap.values()].sort((a, b) => b.spend - a.spend),
      days: dayRows.sort((a, b) => a.day.localeCompare(b.day)),
      campaigns: camps,
      ads,
    },
  };
}

const stateOfError = (e: unknown): { state: AdsState; detail?: string } => {
  if (e instanceof MetaError) {
    if (e.code === 'meta-expired') return { state: 'expired', detail: e.detail };
    if (e.code === 'meta-permission') return { state: 'no-permission', detail: e.detail };
    if (e.code === 'meta-not-connected') return { state: 'not-connected' };
    return { state: 'error', detail: e.detail || (e.code === 'meta-busy' ? 'Meta is busy or didn’t answer' : e.code) };
  }
  return { state: 'error', detail: e instanceof Error ? e.message.slice(0, 200) : 'something went wrong' };
};

async function ours(since: string, until: string): Promise<OurDay[]> {
  const r = (await jobkitRpc('jobkit_ads', { p_action: 'results', p: { since, until } }, 12000)) as { days?: OurDay[] };
  return Array.isArray(r?.days) ? r.days : [];
}

export async function adsReport(daysIn: number): Promise<AdsReport> {
  const days = [7, 30, 90].includes(daysIn) ? daysIn : 30;
  const until = londonDay();
  const since = shift(until, -(days - 1));
  const base = { v: 1 as const, at: Date.now(), days, since, until, canWrite: Boolean(process.env.ANTHROPIC_API_KEY) };
  if (!metaSetUp() || !syncSetUp()) return { ...base, state: 'not-set-up', meta: null, ours: null, drafts: [] };

  const [side, own, drafts] = await Promise.all([
    (async () => {
      try {
        const auth = await metaAdsAuth();
        if (auth.state !== 'ok') return { state: auth.state as AdsState, who: auth.who, meta: null };
        const r = await metaSide(auth.token, days, since, until);
        return { ...r, who: auth.who };
      } catch (e) {
        return { ...stateOfError(e), meta: null, who: undefined };
      }
    })(),
    ours(since, until).then(
      (d) => ({ d, error: undefined as string | undefined }),
      (e) => ({ d: null, error: e instanceof Error ? e.message : 'store' }),
    ),
    listDrafts().then(
      (d) => ({ d, error: undefined as string | undefined }),
      (e) => ({ d: [] as AdDraft[], error: e instanceof Error ? e.message : 'store' }),
    ),
  ]);

  // a draft made in Ads Manager shows as live with its numbers
  const withLive = drafts.d.map((d): AdDraft => {
    const ad = side.meta?.ads.find((a) => a.draft === d.id);
    return ad ? { ...d, live: { ad: ad.id, name: ad.name, status: ad.status, spend: ad.spend, clicks: ad.clicks } } : d;
  });
  return {
    ...base,
    state: side.state,
    detail: 'detail' in side ? side.detail : undefined,
    who: side.who,
    meta: side.meta,
    ours: own.d,
    oursError: own.error,
    drafts: withLive,
    draftsError: drafts.error,
  };
}
