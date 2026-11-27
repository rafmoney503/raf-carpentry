import { createHash, createHmac } from 'crypto';
import { forget, keep, kept, newState, seal, stateOk, unseal } from './social-store';

/* Etsy in the Job Kit (27 Nov 2026, Raf: 'is it possible so you can run etsy store for me', then 'do 1 and 2 points':
   the PAX guide listed on his Etsy shop, and the shop's orders and reviews in the Job Kit). Read only: the shop, its
   orders (receipts) and reviews, shown on the Guide sales screen and as To do lines for new orders.
   Raf's own Etsy app (etsy.com/developers/your-apps): its Keystring and Shared Secret are ETSY_KEYSTRING and
   ETSY_SHARED_SECRET in Vercel (Production, Sensitive); its Callback URL is
   https://www.rafcarpentry.com/api/job-kit/etsy/callback. Connected once from the Guide sales screen: OAuth 2 with PKCE
   (the code verifier is made from the signed state, so nothing is kept between the start and the callback). Etsy's
   access token lasts an hour and its refresh token 90 days, and each refresh gives a new refresh token, so the newest
   one is kept SEALED in jobkit.social under 'etsy' (social-store.ts), shared by the phone and the computer. 'etsy-seen'
   there is the newest order Raf has had in front of him. Since 9 Feb 2026 every call sends x-api-key
   'keystring:shared secret'. ETSY_API, ETSY_AUTHORIZE change the addresses (tests); ETSY_REDIRECT_URI the callback. */

const KEY = () => process.env.ETSY_KEYSTRING ?? '';
const SECRET = () => process.env.ETSY_SHARED_SECRET ?? '';
const API = () => (process.env.ETSY_API || 'https://api.etsy.com').replace(/\/$/, '');
const AUTHORIZE = () => process.env.ETSY_AUTHORIZE || 'https://www.etsy.com/oauth/connect';
const ROW = 'etsy';
const SEEN = 'etsy-seen';
const TAG = 'etsy';
export const ETSY_SCOPES = 'shops_r listings_r transactions_r';

export type EtsyCode = 'etsy-not-set-up' | 'etsy-not-connected' | 'etsy-expired' | 'etsy-busy' | 'etsy-store' | 'etsy-error';
export class EtsyError extends Error {
  constructor(
    public code: EtsyCode,
    public status: number,
    public detail = '',
  ) {
    super(code);
  }
}

export function etsyMissing(): string[] {
  const out: string[] = [];
  if (!KEY()) out.push('ETSY_KEYSTRING');
  if (!SECRET()) out.push('ETSY_SHARED_SECRET');
  if (!process.env.JOBKIT_SYNC_SECRET) out.push('JOBKIT_SYNC_SECRET');
  return out;
}
export const etsySetUp = () => etsyMissing().length === 0;
const needSetUp = () => {
  const m = etsyMissing();
  if (m.length) throw new EtsyError('etsy-not-set-up', 503, m.join(', '));
};

export const etsyRedirectUri = (origin: string) => process.env.ETSY_REDIRECT_URI || `${origin.replace(/\/$/, '')}/api/job-kit/etsy/callback`;

/* PKCE: the verifier comes from the state (signed, single-use, 30 minutes), so the callback can make it again. */
const verifierOf = (state: string) => createHmac('sha256', `${SECRET()}|etsy-pkce`).update(state).digest('base64url');
const challengeOf = (v: string) => createHash('sha256').update(v).digest('base64url');

export function etsyLoginUrl(origin: string) {
  needSetUp();
  const state = newState(SECRET(), TAG);
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: KEY(),
    redirect_uri: etsyRedirectUri(origin),
    scope: ETSY_SCOPES,
    state,
    code_challenge: challengeOf(verifierOf(state)),
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE()}?${q}`;
}
export const etsyStateOk = (state: string | null) => stateOk(state, SECRET(), TAG);

type Saved = { token: string; userId?: string; shopId?: number; shopName?: string; connectedAt?: string; refreshedAt?: string };
type TokenAnswer = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

async function tokenCall(form: Record<string, string>): Promise<TokenAnswer> {
  let res: Response;
  try {
    res = await fetch(`${API()}/v3/public/oauth/token`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ client_id: KEY(), ...form }),
    });
  } catch {
    throw new EtsyError('etsy-busy', 503, 'token');
  }
  const j = (await res.json().catch(() => ({}))) as TokenAnswer;
  if (res.ok && j.access_token) return j;
  const e = String(j.error ?? res.status);
  if (e === 'invalid_grant') throw new EtsyError('etsy-expired', 401, `${e}: ${j.error_description ?? ''}`.slice(0, 200));
  if (res.status === 429 || res.status >= 500) throw new EtsyError('etsy-busy', 503, e);
  throw new EtsyError('etsy-error', 502, `${e}${j.error_description ? `: ${j.error_description}` : ''}`.slice(0, 200));
}

let access: { token: string; until: number } | null = null;
let refreshing: Promise<string> | null = null;

async function savedRow(): Promise<Saved | null> {
  try {
    return await kept<Saved>(ROW);
  } catch {
    throw new EtsyError('etsy-store', 503);
  }
}

/* An hour's access token, made from the kept refresh token; Etsy hands back a new refresh token each time, which
   replaces the old one in the store. One refresh at a time on this server. */
async function accessToken(fresh = false): Promise<string> {
  needSetUp();
  if (!fresh && access && access.until > Date.now() + 60_000) return access.token;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const saved = await savedRow();
    if (!saved?.token) throw new EtsyError('etsy-not-connected', 409);
    let refresh: string;
    try {
      refresh = unseal(saved.token);
    } catch {
      throw new EtsyError('etsy-expired', 401, 'sealed');
    }
    const j = await tokenCall({ grant_type: 'refresh_token', refresh_token: refresh });
    access = { token: j.access_token!, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
    if (j.refresh_token && j.refresh_token !== refresh) {
      try {
        await keep(ROW, { ...saved, token: seal(j.refresh_token), refreshedAt: new Date().toISOString() } satisfies Saved);
      } catch {
        /* the old refresh token still works until it runs out; the next refresh tries again */
      }
    }
    return access.token;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function get<T>(path: string, retried = false): Promise<T> {
  const token = await accessToken(retried);
  let res: Response;
  try {
    res = await fetch(`${API()}/v3/application${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
      headers: { 'x-api-key': `${KEY()}:${SECRET()}`, authorization: `Bearer ${token}`, accept: 'application/json' },
    });
  } catch {
    throw new EtsyError('etsy-busy', 503, path);
  }
  if (res.ok) return (await res.json()) as T;
  const t = (await res.text().catch(() => '')).slice(0, 300);
  if (res.status === 401 && !retried) {
    access = null;
    return get<T>(path, true);
  }
  if (res.status === 401 || res.status === 403) throw new EtsyError('etsy-expired', 401, `${res.status} ${t}`.slice(0, 200));
  if (res.status === 429 || res.status >= 500) throw new EtsyError('etsy-busy', 503, `${res.status}`);
  throw new EtsyError('etsy-error', 502, `${res.status} ${t}`.slice(0, 200));
}

/* Back from Etsy's page: the code becomes tokens; the user's shop is looked up and kept with them. */
export async function connectEtsy(code: string, state: string, origin: string) {
  needSetUp();
  const j = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: etsyRedirectUri(origin), code_verifier: verifierOf(state) });
  if (!j.refresh_token) throw new EtsyError('etsy-error', 502, 'no refresh token');
  access = { token: j.access_token!, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  // the access token starts with the user's numeric id
  const userId = j.access_token!.split('.')[0];
  let shopId: number | undefined;
  let shopName: string | undefined;
  try {
    await keep(ROW, { token: seal(j.refresh_token), userId, connectedAt: new Date().toISOString() } satisfies Saved);
  } catch {
    throw new EtsyError('etsy-store', 503);
  }
  try {
    const me = await get<{ user_id?: number; shop_id?: number }>('/users/me');
    shopId = me.shop_id;
    if (shopId) shopName = (await get<{ shop_name?: string }>(`/shops/${shopId}`)).shop_name;
  } catch {
    /* looked up again on the first overview */
  }
  // the store may hold a newer refresh token by now (a refresh ran inside get): read it back before adding the shop
  const now = (await savedRow()) ?? { token: seal(j.refresh_token) };
  await keep(ROW, { ...now, userId, shopId, shopName } satisfies Saved).catch(() => null);
}

export async function disconnectEtsy() {
  access = null;
  try {
    await forget(ROW);
  } catch {
    throw new EtsyError('etsy-store', 503);
  }
}

/* ---------- what the Job Kit shows ---------- */

type Money = { amount?: number; divisor?: number; currency_code?: string };
const pence = (m?: Money) => (m && typeof m.amount === 'number' ? Math.round((m.amount * 100) / (m.divisor || 100)) : 0);

export type EtsyOrder = {
  id: number;
  at: string; // ISO
  name: string; // the buyer's name as on the order
  country: string; // ISO code
  pence: number; // what they paid, in the shop's currency
  currency: string;
  items: { title: string; qty: number; digital: boolean }[];
  paid: boolean;
  shipped: boolean;
  status: string;
};
export type EtsyReview = { at: string; rating: number; text: string; listingId: number | null };
export type EtsyOverview = {
  connected: boolean;
  missing?: string[];
  shop?: { id: number; name: string; url: string; listings: number; sold: number; reviewAverage: number | null; reviewCount: number; currency: string; title: string };
  orders: EtsyOrder[];
  reviews: EtsyReview[];
  seenAt: string | null;
  at: string;
};

type Receipt = {
  receipt_id: number;
  name?: string;
  country_iso?: string;
  created_timestamp?: number;
  create_timestamp?: number;
  grandtotal?: Money;
  is_paid?: boolean;
  is_shipped?: boolean;
  status?: string;
  transactions?: { title?: string; quantity?: number; is_digital?: boolean }[];
};
type ShopAnswer = { shop_id: number; shop_name?: string; url?: string; listing_active_count?: number; transaction_sold_count?: number; review_average?: number | null; review_count?: number; currency_code?: string; title?: string };

export function orderOf(r: Receipt): EtsyOrder {
  const ts = r.created_timestamp ?? r.create_timestamp ?? 0;
  return {
    id: r.receipt_id,
    at: new Date(ts * 1000).toISOString(),
    name: (r.name ?? '').trim(),
    country: (r.country_iso ?? '').toUpperCase(),
    pence: pence(r.grandtotal),
    currency: r.grandtotal?.currency_code ?? 'GBP',
    items: (r.transactions ?? []).map((t) => ({ title: (t.title ?? '').trim(), qty: t.quantity ?? 1, digital: !!t.is_digital })),
    paid: !!r.is_paid,
    shipped: !!r.is_shipped,
    status: r.status ?? '',
  };
}

export async function etsyOverview(): Promise<EtsyOverview> {
  const at = new Date().toISOString();
  if (!etsySetUp()) return { connected: false, missing: etsyMissing(), orders: [], reviews: [], seenAt: null, at };
  const saved = await savedRow();
  if (!saved?.token) return { connected: false, orders: [], reviews: [], seenAt: null, at };
  let shopId = saved.shopId;
  if (!shopId) {
    shopId = (await get<{ shop_id?: number }>('/users/me')).shop_id;
    if (!shopId) throw new EtsyError('etsy-error', 502, 'no shop on this Etsy account');
    const cur = await savedRow();
    if (cur) await keep(ROW, { ...cur, shopId }).catch(() => null);
  }
  const [s, rec, rev, seen] = await Promise.all([
    get<ShopAnswer>(`/shops/${shopId}`),
    get<{ results?: Receipt[] }>(`/shops/${shopId}/receipts?limit=50&sort_on=created&sort_order=desc`),
    get<{ results?: { rating?: number; review?: string; created_timestamp?: number; create_timestamp?: number; listing_id?: number }[] }>(`/shops/${shopId}/reviews?limit=10`).catch(() => ({ results: [] })),
    kept<{ at?: string }>(SEEN).catch(() => null),
  ]);
  return {
    connected: true,
    shop: {
      id: s.shop_id,
      name: s.shop_name ?? '',
      url: s.url ?? `https://www.etsy.com/shop/${s.shop_name ?? ''}`,
      listings: s.listing_active_count ?? 0,
      sold: s.transaction_sold_count ?? 0,
      reviewAverage: s.review_average ?? null,
      reviewCount: s.review_count ?? 0,
      currency: s.currency_code ?? 'GBP',
      title: s.title ?? '',
    },
    orders: (rec.results ?? []).map(orderOf).sort((a, b) => b.at.localeCompare(a.at)),
    reviews: (rev.results ?? []).map((r) => ({ at: new Date(((r.created_timestamp ?? r.create_timestamp) || 0) * 1000).toISOString(), rating: r.rating ?? 0, text: (r.review ?? '').trim(), listingId: r.listing_id ?? null })),
    seenAt: seen?.at ?? null,
    at,
  };
}

/* Raf has had the orders up to this time in front of him: kept for every device. */
export async function etsySeen(upto: string) {
  const cur = await kept<{ at?: string }>(SEEN).catch(() => null);
  if (cur?.at && cur.at >= upto) return cur.at;
  try {
    await keep(SEEN, { at: upto });
  } catch {
    throw new EtsyError('etsy-store', 503);
  }
  return upto;
}
