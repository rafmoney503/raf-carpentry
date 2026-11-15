/* What rafcarpentry.com answers HQ's Ads section (GET /api/hq/ads, src/lib/meta-ads.ts). No imports: HQ keeps an
   exact copy in its src/lib/ads-types.ts, so change both together.

   Money is in the ad account's currency (pounds for Raf), as Meta gives it: 12.34 = £12.34. Days are the ad
   account's own days (Meta's), and London days for our own counters. */

export type Business = 'raf' | 'cabinetos';

export type AdsState =
  | 'ok'
  | 'not-set-up' // META_APP_ID / META_APP_SECRET / the store missing on rafcarpentry.com
  | 'not-connected' // nobody connected Facebook in the Job Kit's Social screen
  | 'no-permission' // connected, but without ads_read (Connect ads in the Job Kit)
  | 'no-account' // the login sees no ad account
  | 'expired' // Facebook wants a new login
  | 'error'; // Meta didn't answer or said something unexpected (detail)

export type AdAccount = { id: string; name: string; currency: string; status: number; active: boolean; spentAll: number };

export type AdNums = { spend: number; impressions: number; reach: number; clicks: number };

/* What Meta counts as the ad's result, the first of: leads, messages started, sign-ups, landing page views. */
export type AdResult = { kind: 'lead' | 'message' | 'signup' | 'landing'; n: number };

export type AdRow = AdNums & {
  id: string;
  name: string;
  status: string; // Meta's effective_status: ACTIVE, PAUSED, CAMPAIGN_PAUSED, ADSET_PAUSED, IN_PROCESS, WITH_ISSUES, DISAPPROVED...
  account: string;
  campaignId: string;
  campaign: string;
  business: Business | null;
  thumb?: string;
  headline?: string;
  text?: string;
  link?: string; // where the ad sends people
  draft?: string; // the HQ draft it was made from (utm_content in its URL parameters)
  result: AdResult | null;
};

export type CampaignRow = AdNums & {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily?: number; // budget a day
  lifetime?: number; // budget for the whole campaign
  business: Business | null;
  ads: number;
  result: AdResult | null;
};

/* One ad's day (ads × days): HQ adds them up for one business or both. */
export type AdDay = { day: string; ad: string; spend: number; impressions: number; clicks: number };

export type PlaceRow = { place: 'facebook' | 'instagram' | 'messenger' | 'audience_network' | 'other'; spend: number; impressions: number; clicks: number };

export type MetaSide = {
  accounts: AdAccount[];
  currency: string;
  totals: AdNums; // every account, the period (reach as Meta counts it: people, not added up)
  before: { spend: number; clicks: number } | null; // the same length of time just before
  places: PlaceRow[];
  days: AdDay[];
  campaigns: CampaignRow[];
  ads: AdRow[];
};

/* What the website counters saw from Facebook and Instagram, a London day at a time. `paid` = visits that came
   with the ads' URL parameters (utm_source=ads-fb / ads-ig); `meta` = from facebook.com or instagram.com without
   them (posts, or an ad without the parameters). Raf Carpentry: enquiry = Send to Raf, WhatsApp, call or email
   tapped in that visit. CabinetOS: sign-ups made that day by someone whose first visit that day came that way. */
export type OurDay = {
  day: string;
  raf: { paid: number; paidEnq: number; paidFb: number; paidIg: number; meta: number; metaEnq: number };
  cos: { paid: number; paidFb: number; paidIg: number; meta: number; paidSignups: number; metaSignups: number };
};

export type DraftStatus = 'new' | 'approved' | 'no';

/* An ad Claude wrote for Raf to approve. Nothing is sent to Meta: Raf makes it in Ads Manager himself, pasting
   these, and the URL parameters let HQ find it there once it runs (`live`). */
export type AdDraft = {
  id: string;
  business: Business;
  status: DraftStatus;
  at: number;
  statusAt?: number;
  photo: { src: string; alt: string; job?: string; w?: number; h?: number }; // src: a path on www.rafcarpentry.com
  headline: string; // up to 40 characters
  text: string; // primary text
  description: string; // up to 30 characters
  cta: string; // Meta's button: LEARN_MORE, GET_QUOTE, SIGN_UP, CONTACT_US, BOOK_NOW, SEND_MESSAGE...
  page: string; // the website address, without parameters
  params: string; // what goes in Ads Manager's URL parameters box
  audience: { where: string; ages: string; interests: string[]; note?: string };
  angle: string; // why it should work, for Raf
  offer?: 'black-friday';
  note?: string; // what Raf asked for, when he did
  live?: { ad: string; name: string; status: string; spend: number; clicks: number }; // found among the ads
};

export type AdsReport = {
  v: 1;
  state: AdsState;
  detail?: string;
  at: number;
  days: number;
  since: string; // the period, the ad account's days
  until: string;
  who?: string; // who connected Facebook
  meta: MetaSide | null; // only with state ok
  ours: OurDay[] | null;
  oursError?: string;
  drafts: AdDraft[];
  draftsError?: string;
  canWrite: boolean; // Claude is set up to write ads (ANTHROPIC_API_KEY)
};

/* POST /api/hq/ads answers */
export type WriteAnswer = { ok: true; drafts: AdDraft[] } | { ok: false; error: 'not-set-up' | 'ai-key' | 'ai-limit' | 'ai-busy' | 'ai-error' | 'store' | 'bad'; detail?: string };
export type MarkAnswer = { ok: true } | { ok: false; error: 'store' | 'bad' | 'gone' };

export const CTA_LABEL: Record<string, string> = {
  LEARN_MORE: 'Learn more',
  GET_QUOTE: 'Get quote',
  SIGN_UP: 'Sign up',
  CONTACT_US: 'Contact us',
  BOOK_NOW: 'Book now',
  SEND_MESSAGE: 'Send message',
  WHATSAPP_MESSAGE: 'Send WhatsApp message',
  GET_OFFER: 'Get offer',
  SEE_MORE: 'See more',
  TRY_IT: 'Try it',
};
