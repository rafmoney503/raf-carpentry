import { createHmac } from 'crypto';
import { syncSetUp } from './job-kit-sync-server';
import { counts, forget, keep, kept, newState, seal, stateOk, StoreError, unseal } from './social-store';
import type { PageComment, PagePost, PageReport } from './page-report-types';
import { answeredOf, clip, ms, type MetaAccount, type Platform, type SocialComment, type SocialPart, type SocialPost, type SocialProblem, type SocialProfile } from './social-types';

/* The Job Kit's Social screen, part 1: Raf's Instagram and Facebook (20 Oct 2026, Raf: 'is there a way to see in job kit
   social media profiles with followers and comments as a separate section', then 'start with instagram and facebook').

   One Facebook login (Meta's own app 'Raf Job Kit', in development mode: only people with a role on it can use it,
   so no App Review) gives a Page access token for the Raf Carpentry Page, which also reads the Instagram professional
   account linked to that Page. Page tokens made from a long-lived user token don't run out; they stop working if
   Raf changes his Facebook password, removes the app, or loses his role on the Page (then: Connect again).

   Kept (src/lib/social-store.ts): jobkit.social 'meta' = who connected, the Pages with their tokens sealed, which
   Page and the permissions given. The overview of all the platforms is put together in src/lib/social.ts.

   More Pages (15 Nov 2026, Raf, the day he made the Cabinet OS Page: 'add also stats from facebook to jobkit'): beside
   the picked Page, any other Page the login shared can be shown too (kept as `show`; until Raf chooses, a Page called
   Cabinet OS is shown by itself), each with its own followers, posts and comments, and its own Instagram if one is
   linked to it. The list of Pages is asked again with the long-lived user token at most every 6 hours (pagesAt), so a
   Page made after connecting shows up without logging in again when the login shared all Pages; otherwise Connect
   again and tick it.

   Vercel: META_APP_ID, META_APP_SECRET (sensitive). Optional: META_LOGIN_CONFIG_ID (a Facebook Login for Business
   configuration; without it the login asks for SCOPES), META_SCOPES (comma list, replaces SCOPES), META_API_VERSION
   (default v25.0), META_REDIRECT_URI (default <site>/api/job-kit/social/meta/callback); META_GRAPH_API and
   META_DIALOG point at a pretend Meta in tests. */

const GRAPH = () => (process.env.META_GRAPH_API || 'https://graph.facebook.com').replace(/\/$/, '');
const DIALOG = () => (process.env.META_DIALOG || 'https://www.facebook.com').replace(/\/$/, '');
const V = () => process.env.META_API_VERSION || 'v25.0';
const APP_ID = () => process.env.META_APP_ID || '';
const APP_SECRET = () => process.env.META_APP_SECRET || '';

/* What the login asks for. Reading: the Page list, the Page's posts and followers, who commented (pages_read_user_
   content), the Instagram profile and media (instagram_basic), Instagram comments (instagram_manage_comments, which
   is also what replying needs). Replying on Facebook: pages_manage_engagement. business_management: Pages kept in a
   Meta business portfolio only show up with it. */
export const SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement', 'instagram_basic', 'instagram_manage_comments', 'business_management'];
const scopes = () =>
  process.env.META_SCOPES
    ? process.env.META_SCOPES.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : SCOPES;

export const metaMissing = () => [!APP_ID() && 'META_APP_ID', !APP_SECRET() && 'META_APP_SECRET', !syncSetUp() && 'JOBKIT_SYNC_SECRET'].filter(Boolean) as string[];
export const metaSetUp = () => metaMissing().length === 0;

export class MetaError extends Error {
  constructor(public code: 'meta-expired' | 'meta-permission' | 'meta-busy' | 'meta-gone' | 'meta-error' | 'meta-store' | 'meta-no-page' | 'meta-no-ig' | 'meta-not-connected', public detail = '') {
    super(code);
  }
}

const STATE_TAG = 'job-kit-social-state';
export const metaStateOk = (state: string | null) => stateOk(state, APP_SECRET(), STATE_TAG);

export const redirectUri = (origin: string) => process.env.META_REDIRECT_URI || `${origin.replace(/\/$/, '')}/api/job-kit/social/meta/callback`;

export function metaLoginUrl(origin: string, again = false) {
  const p = new URLSearchParams({ client_id: APP_ID(), redirect_uri: redirectUri(origin), state: newState(APP_SECRET(), STATE_TAG), response_type: 'code' });
  if (process.env.META_LOGIN_CONFIG_ID) p.set('config_id', process.env.META_LOGIN_CONFIG_ID);
  else p.set('scope', scopes().join(','));
  if (again) p.set('auth_type', 'rerequest'); // asks again for what was turned down last time
  return `${DIALOG()}/${V()}/dialog/oauth?${p}`;
}

/* ---------- Graph API ---------- */

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } };

const proof = (token: string) => createHmac('sha256', APP_SECRET()).update(token).digest('hex');

async function graph<T>(path: string, token: string | null, params: Record<string, string> = {}, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const q = new URLSearchParams(params);
  if (token) {
    q.set('access_token', token);
    q.set('appsecret_proof', proof(token));
  }
  const url = `${GRAPH()}/${V()}${path}`;
  const res = await fetch(method === 'GET' ? `${url}?${q}` : url, {
    method,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? q.toString() : undefined,
  }).catch(() => null);
  if (!res) throw new MetaError('meta-busy', 'Meta didn’t answer');
  const body = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || body.error) {
    const e = body.error ?? {};
    const code = Number(e.code);
    const msg = String(e.error_user_msg || e.message || `HTTP ${res.status}`).slice(0, 300);
    if (code === 190 || code === 102 || code === 463 || code === 467) throw new MetaError('meta-expired', msg);
    if ([4, 17, 32, 341, 613].includes(code) || (code >= 80000 && code < 80100) || res.status === 429) throw new MetaError('meta-busy', msg);
    if (code === 10 || code === 3 || (code >= 200 && code < 300)) throw new MetaError('meta-permission', msg);
    if (code === 100 && /does not exist|cannot be loaded|missing permissions|unsupported get/i.test(msg)) throw new MetaError(/missing permissions/i.test(msg) ? 'meta-permission' : 'meta-gone', msg);
    throw new MetaError(res.status >= 500 ? 'meta-busy' : 'meta-error', msg);
  }
  return body;
}

/* ---------- what's kept ---------- */

type Page = { id: string; name: string; token: string; ig?: { id: string; username?: string } };
type Kept = {
  v: 1;
  user: { id: string; name: string };
  userToken: string; // sealed, long-lived (about 60 days): only a fallback for Instagram
  userUntil?: number;
  pages: Page[]; // tokens sealed
  pick?: string;
  show?: string[]; // Pages shown beside the picked one (unset: a Page called Cabinet OS)
  pagesAt?: number; // when the list of Pages was last asked of Facebook
  perms: string[];
  declined: string[];
  connectedAt: number;
  seenAt?: number; // until 21 Oct 2026; now kept as 'seen' (src/lib/social.ts)
};

async function load(): Promise<Kept | null> {
  try {
    const k = await kept<Kept>('meta');
    return k && k.v === 1 && Array.isArray(k.pages) ? k : null;
  } catch {
    throw new MetaError('meta-store');
  }
}
async function save(k: Kept) {
  try {
    await keep('meta', k);
  } catch {
    throw new MetaError('meta-store');
  }
}
const open = (s: string) => {
  try {
    return unseal(s);
  } catch {
    // the sync secret changed since: the tokens can't be read, so connect again
    throw new MetaError('meta-expired', 'sealed with an older secret');
  }
};

/* ---------- connecting (the callback) ---------- */

/* The Pages a user token can see, each with its own token (sealed) and linked Instagram. */
async function pagesOf(token: string): Promise<Page[]> {
  const accounts = await graph<{ data?: { id: string; name: string; access_token?: string; instagram_business_account?: { id: string; username?: string } }[] }>('/me/accounts', token, {
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    limit: '100',
  });
  const pages: Page[] = [];
  for (const p of accounts.data ?? []) {
    if (!p.access_token) continue;
    let ig = p.instagram_business_account;
    if (!ig) {
      // asked of the Page itself, in case the list left it out
      ig = await graph<{ instagram_business_account?: { id: string; username?: string } }>(`/${p.id}`, p.access_token, { fields: 'instagram_business_account{id,username}' })
        .then((r) => r.instagram_business_account)
        .catch(() => undefined);
    }
    pages.push({ id: p.id, name: p.name, token: seal(p.access_token), ig: ig ? { id: ig.id, username: ig.username } : undefined });
  }
  return pages;
}

/* The Pages shown on the Social screen: the picked one first, then the others Raf chose (until he chooses: a Page
   called Cabinet OS). Only Pages still in the list. */
const CABINET = /cabinet\s*os/i;
export function shownIds(k: { pages: { id: string; name: string }[]; pick?: string; show?: string[] }) {
  const more = k.show ?? k.pages.filter((p) => CABINET.test(p.name)).map((p) => p.id);
  return [...new Set([k.pick, ...more].filter((x): x is string => Boolean(x)))].filter((id) => k.pages.some((p) => p.id === id));
}

const PAGES_EVERY = 6 * 3600_000;

/* The list of Pages asked again with the long-lived user token: a Page made since connecting shows up (when the login
   shared every Page), a renamed one gets its new name, and fresh Page tokens. A Page no longer in the answer is kept,
   with its old token, so a hiccup never loses one. Quietly does nothing when the user token has run out or Facebook
   says no. */
async function refreshPages(k: Kept, userToken: string, force = false): Promise<Kept> {
  if (!userToken) return k;
  if (!force && Date.now() - (k.pagesAt ?? k.connectedAt) < PAGES_EVERY) return k;
  let fresh: Page[];
  try {
    fresh = await pagesOf(userToken);
  } catch (e) {
    if (force) throw e;
    const next = { ...k, pagesAt: Date.now() }; // not again for 6 hours
    await save(next).catch(() => undefined);
    return next;
  }
  const next: Kept = { ...k, pages: [...fresh, ...k.pages.filter((p) => !fresh.some((f) => f.id === p.id))], pagesAt: Date.now() };
  await save(next).catch(() => undefined);
  return next;
}

/* Look for Pages now (Raf tapped Look for new Pages): answers how many there are. */
export async function lookForPages(): Promise<{ pages: number; added: string[] }> {
  const k = await load();
  if (!k) throw new MetaError('meta-not-connected');
  const userToken = open(k.userToken);
  const next = await refreshPages(k, userToken, true);
  return { pages: next.pages.length, added: next.pages.filter((p) => !k.pages.some((o) => o.id === p.id)).map((p) => p.name) };
}

/* Show a Page on the Social screen, or stop showing it (never the picked one). */
export async function showPage(id: string, on: boolean) {
  const k = await load();
  if (!k) throw new MetaError('meta-not-connected');
  if (!k.pages.some((p) => p.id === id)) throw new MetaError('meta-gone', 'That Page');
  if (id === k.pick) return;
  const now = shownIds(k).filter((x) => x !== k.pick);
  await save({ ...k, show: on ? [...new Set([...now, id])] : now.filter((x) => x !== id) });
}

/* The code from Facebook's login -> a long-lived user token -> the Pages with their own tokens and linked Instagram.
   Answers whether a Page is picked (several Pages and no clear one: Raf picks in the app). */
export async function connectMeta(code: string, origin: string): Promise<{ picked: boolean }> {
  const short = await graph<{ access_token: string }>('/oauth/access_token', null, {
    client_id: APP_ID(),
    client_secret: APP_SECRET(),
    redirect_uri: redirectUri(origin),
    code,
  });
  const long = await graph<{ access_token: string; expires_in?: number }>('/oauth/access_token', null, {
    grant_type: 'fb_exchange_token',
    client_id: APP_ID(),
    client_secret: APP_SECRET(),
    fb_exchange_token: short.access_token,
  });
  const token = long.access_token;
  const [me, perms, pages] = await Promise.all([
    graph<{ id: string; name?: string }>('/me', token, { fields: 'id,name' }),
    graph<{ data?: { permission: string; status: string }[] }>('/me/permissions', token).catch(() => ({ data: [] })),
    pagesOf(token),
  ]);
  if (!pages.length) throw new MetaError('meta-no-page');
  const before = await load().catch(() => null);
  const withIg = pages.filter((p) => p.ig);
  const pick =
    before?.pick && pages.some((p) => p.id === before.pick)
      ? before.pick
      : pages.length === 1
      ? pages[0].id
      : withIg.length === 1
      ? withIg[0].id
      : pages.filter((p) => /raf/i.test(p.name)).length === 1
      ? pages.find((p) => /raf/i.test(p.name))!.id
      : undefined;
  const list = perms.data ?? [];
  await save({
    v: 1,
    user: { id: me.id, name: me.name || '' },
    userToken: seal(token),
    userUntil: long.expires_in ? Date.now() + long.expires_in * 1000 : undefined,
    pages,
    pick,
    show: before?.show,
    pagesAt: Date.now(),
    perms: list.filter((p) => p.status === 'granted').map((p) => p.permission),
    declined: list.filter((p) => p.status !== 'granted').map((p) => p.permission),
    connectedAt: Date.now(),
    seenAt: before?.seenAt,
  });
  return { picked: Boolean(pick) };
}

export async function pickPage(id: string) {
  const k = await load();
  if (!k) throw new MetaError('meta-not-connected');
  if (!k.pages.some((p) => p.id === id)) throw new MetaError('meta-gone', 'That Page');
  await save({ ...k, pick: id });
}

export async function disconnectMeta() {
  try {
    await forget('meta');
  } catch {
    throw new MetaError('meta-store');
  }
}

/* ---------- the overview ---------- */

type FbComment = { id: string; message?: string; created_time?: string; from?: { id: string; name?: string }; permalink_url?: string; like_count?: number; comments?: { data?: FbComment[] } };
type FbPost = {
  id: string;
  message?: string;
  story?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  status_type?: string;
  reactions?: { summary?: { total_count?: number } };
  comments?: { data?: FbComment[]; summary?: { total_count?: number } };
};
type IgComment = { id: string; text?: string; timestamp?: string; username?: string; like_count?: number; replies?: { data?: IgComment[] } };
type IgMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  comments?: { data?: IgComment[] };
};

async function facebook(page: Page, token: string) {
  const [info, feed] = await Promise.all([
    graph<{ id: string; name?: string; link?: string; username?: string; followers_count?: number; fan_count?: number; picture?: { data?: { url?: string } } }>(`/${page.id}`, token, {
      fields: 'id,name,link,username,followers_count,fan_count,picture.type(large){url}',
    }),
    graph<{ data?: FbPost[] }>(`/${page.id}/published_posts`, token, {
      fields:
        'id,message,story,created_time,permalink_url,full_picture,status_type,reactions.summary(total_count).limit(0),' +
        'comments.order(reverse_chronological).limit(25).summary(true){id,message,created_time,from{id,name},permalink_url,like_count,comments.limit(10){id,message,created_time,from{id,name}}}',
      limit: '10',
    }),
  ]);
  const profile: SocialProfile = {
    platform: 'fb',
    id: page.id,
    name: info.name || page.name,
    handle: info.username,
    link: info.link || `https://www.facebook.com/${info.username || page.id}`,
    picture: info.picture?.data?.url,
    followers: typeof info.followers_count === 'number' ? info.followers_count : typeof info.fan_count === 'number' ? info.fan_count : null,
    history: [],
  };
  const owned = { owner: page.id, ownerName: profile.name, page: page.id };
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  for (const p of feed.data ?? []) {
    const link = p.permalink_url || `https://www.facebook.com/${p.id}`;
    posts.push({
      id: p.id,
      platform: 'fb',
      ...owned,
      text: clip(p.message || p.story, 300),
      at: ms(p.created_time),
      link,
      thumb: p.full_picture,
      kind: /video/.test(p.status_type ?? '') ? 'video' : p.full_picture ? 'photo' : 'post',
      likes: p.reactions?.summary?.total_count ?? null,
      comments: p.comments?.summary?.total_count ?? p.comments?.data?.length ?? 0,
    });
    for (const c of p.comments?.data ?? []) {
      if (c.from?.id === page.id) continue; // the Page's own comment
      const replies = (c.comments?.data ?? []).map((r) => ({
        id: r.id,
        who: r.from?.name || 'Someone on Facebook',
        text: clip(r.message, 2000),
        at: ms(r.created_time),
        mine: r.from?.id === page.id,
      }));
      const at = ms(c.created_time);
      comments.push({
        id: c.id,
        platform: 'fb',
        ...owned,
        post: p.id,
        who: c.from?.name || 'Someone on Facebook',
        text: clip(c.message, 2000),
        at,
        likes: c.like_count ?? 0,
        link: c.permalink_url || link,
        replies: replies.sort((a, b) => a.at - b.at),
        ...answeredOf(replies, at),
      });
    }
  }
  return { profile, posts, comments };
}

async function instagram(ig: { id: string; username?: string }, token: string, pageId: string) {
  const [info, media] = await Promise.all([
    graph<{ id: string; username?: string; name?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number }>(`/${ig.id}`, token, {
      fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count',
    }),
    graph<{ data?: IgMedia[] }>(`/${ig.id}/media`, token, {
      fields:
        'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,' +
        'comments.limit(50){id,text,timestamp,username,like_count,replies.limit(20){id,text,timestamp,username}}',
      limit: '12',
    }),
  ]);
  const me = (info.username || ig.username || '').toLowerCase();
  const profile: SocialProfile = {
    platform: 'ig',
    id: ig.id,
    name: info.name || info.username || 'Instagram',
    handle: info.username || ig.username,
    link: `https://www.instagram.com/${info.username || ig.username || ''}`,
    picture: info.profile_picture_url,
    followers: info.followers_count ?? null,
    following: info.follows_count ?? null,
    posts: info.media_count ?? null,
    history: [],
  };
  const owned = { owner: ig.id, ownerName: profile.handle ? `@${profile.handle}` : profile.name, page: pageId };
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  for (const m of media.data ?? []) {
    const link = m.permalink || profile.link;
    const t = (m.media_type ?? '').toUpperCase();
    posts.push({
      id: m.id,
      platform: 'ig',
      ...owned,
      text: clip(m.caption, 300),
      at: ms(m.timestamp),
      link,
      thumb: t === 'VIDEO' ? m.thumbnail_url || undefined : m.media_url || m.thumbnail_url,
      kind: m.media_product_type === 'REELS' ? 'reel' : t === 'VIDEO' ? 'video' : t === 'CAROUSEL_ALBUM' ? 'carousel' : 'photo',
      likes: typeof m.like_count === 'number' ? m.like_count : null, // hidden when likes are hidden on the post
      comments: m.comments_count ?? m.comments?.data?.length ?? 0,
    });
    for (const c of m.comments?.data ?? []) {
      if (me && c.username?.toLowerCase() === me) continue; // Raf's own comment under his post
      const replies = (c.replies?.data ?? []).map((r) => ({
        id: r.id,
        who: r.username ? `@${r.username}` : 'Someone on Instagram',
        text: clip(r.text, 2000),
        at: ms(r.timestamp),
        mine: Boolean(me && r.username?.toLowerCase() === me),
      }));
      const at = ms(c.timestamp);
      comments.push({
        id: c.id,
        platform: 'ig',
        ...owned,
        post: m.id,
        who: c.username ? `@${c.username}` : 'Someone on Instagram',
        text: clip(c.text, 2000),
        at,
        likes: c.like_count ?? 0,
        link,
        replies: replies.sort((a, b) => a.at - b.at),
        ...answeredOf(replies, at),
      });
    }
  }
  return { profile, posts, comments };
}

const problemOf = (platform: Platform, e: unknown): SocialProblem =>
  e instanceof MetaError
    ? { platform, error: e.code, detail: e.detail || undefined }
    : e instanceof StoreError
    ? { platform, error: 'meta-store' }
    : { platform, error: 'meta-error', detail: e instanceof Error ? e.message.slice(0, 200) : undefined };

const EMPTY: SocialPart = { profiles: [], posts: [], comments: [], problems: [] };

/* Instagram and Facebook for the overview (src/lib/social.ts): the account's state and what it shows. Never throws:
   a login that stopped working, or a store that's down, is said in account.error. */
export async function metaPart(): Promise<{ account: MetaAccount; part: SocialPart }> {
  if (!metaSetUp()) return { account: { setUp: false, missing: metaMissing(), connected: false }, part: EMPTY };
  let k: Kept | null;
  try {
    k = await load();
  } catch (e) {
    const p = problemOf('fb', e);
    return { account: { setUp: true, missing: [], connected: false, error: p.error, detail: p.detail }, part: EMPTY };
  }
  if (!k) return { account: { setUp: true, missing: [], connected: false }, part: EMPTY };
  const userToken = (() => {
    try {
      return open(k.userToken);
    } catch {
      return '';
    }
  })();
  k = await refreshPages(k, userToken).catch(() => k!);
  const page = k.pages.find((p) => p.id === k!.pick);
  const asked = process.env.META_LOGIN_CONFIG_ID ? [] : scopes();
  const ids = shownIds(k);
  const account: MetaAccount = {
    setUp: true,
    missing: [],
    connected: true,
    who: k.user.name,
    connectedAt: k.connectedAt,
    pages: k.pages.map((p) => ({ id: p.id, name: p.name, ig: p.ig?.username, shown: ids.includes(p.id) })),
    page: page ? { id: page.id, name: page.name } : undefined,
    notGranted: asked.filter((s) => !k!.perms.includes(s)),
  };
  if (!page) return { account, part: EMPTY };
  try {
    open(page.token);
  } catch (e) {
    const p = problemOf('fb', e);
    return { account: { ...account, error: p.error, detail: p.detail }, part: EMPTY };
  }
  type One = { profile: SocialProfile; posts: SocialPost[]; comments: SocialComment[] };
  const problems: SocialProblem[] = [];
  const parts: One[] = [];
  // each shown Page (the picked one first): its Facebook, and its Instagram when one is linked
  const results = await Promise.all(
    ids.map(async (id) => {
      const pg = k!.pages.find((p) => p.id === id)!;
      const main = id === k!.pick;
      let token: string;
      try {
        token = open(pg.token);
      } catch (e) {
        return { pg, main, fb: { status: 'rejected', reason: e } as PromiseSettledResult<One>, ig: null };
      }
      const [fb, ig] = await Promise.allSettled([
        facebook(pg, token),
        pg.ig
          ? instagram(pg.ig, token, pg.id).catch((e) => {
              // the Page's token normally reads its Instagram; if Meta says no, the user token may still
              if (userToken && e instanceof MetaError && (e.code === 'meta-permission' || e.code === 'meta-expired')) return instagram(pg.ig!, userToken, pg.id);
              throw e;
            })
          : Promise.reject(new MetaError('meta-no-ig')),
      ]);
      return { pg, main, fb, ig: pg.ig || main ? ig : null };
    })
  );
  for (const r of results) {
    const named = (p: SocialProblem): SocialProblem => (r.main ? p : { ...p, account: r.pg.name });
    if (r.ig?.status === 'fulfilled') parts.push(r.ig.value);
    else if (r.ig) problems.push(named(problemOf('ig', r.ig.reason)));
  }
  for (const r of results) {
    const named = (p: SocialProblem): SocialProblem => (r.main ? p : { ...p, account: r.pg.name });
    if (r.fb.status === 'fulfilled') parts.push(r.fb.value);
    else problems.push(named(problemOf('fb', r.fb.reason)));
  }
  // the login stopped working everywhere: connect again (the device keeps its last numbers)
  if (!parts.length && problems.every((p) => p.error === 'meta-expired')) return { account: { ...account, error: 'meta-expired', detail: problems[0]?.detail }, part: EMPTY };
  return {
    account,
    part: { profiles: parts.map((p) => p.profile), posts: parts.flatMap((p) => p.posts), comments: parts.flatMap((p) => p.comments), problems },
  };
}

/* ---------- replying (only ever because Raf pressed Send reply) ---------- */

export async function replyMeta(platform: Platform, commentId: string, text: string, pageId?: string): Promise<{ id: string }> {
  const k = await load();
  if (!k) throw new MetaError('meta-not-connected');
  // the Page the comment came through (a comment on the Cabinet OS Page is answered as Cabinet OS); else the picked one
  const page = k.pages.find((p) => p.id === (pageId || k.pick));
  if (!page) throw new MetaError('meta-no-page');
  const token = open(page.token);
  // Instagram: a reply under the comment; Facebook: a comment on the comment, as the Page
  const r = await graph<{ id?: string }>(platform === 'ig' ? `/${commentId}/replies` : `/${commentId}/comments`, token, { message: text }, 'POST');
  return { id: r.id || '' };
}

/* ---------- one Page's progress, for Rafal Solutions HQ (src/app/api/hq/facebook/route.ts) ---------- */

/* 15 Nov 2026, Raf: 'add separate section in hq for this page and its progress' (the Cabinet OS Page). The Page is
   found by name among the Pages the login shares (letters and digits only, so 'cabinetos' finds 'Cabinet OS'); when
   it isn't there the list is asked again (at most every 15 minutes), so a Page made after connecting shows up without
   logging in again when the login shared every Page. Each call keeps the day's followers in jobkit.social_counts, as
   the Job Kit's Social screen does, so the history grows whichever of the two is opened. Only reads: never posts,
   never replies. */
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const LOOK_AGAIN = 15 * 60_000;

export async function pageReport(name: string): Promise<PageReport> {
  const base: PageReport = { v: 1, at: Date.now(), state: 'ok', history: [], posts: [], comments: [] };
  if (!metaSetUp()) return { ...base, state: 'not-set-up', detail: metaMissing().join(', ') };
  let k: Kept | null;
  try {
    k = await load();
  } catch {
    return { ...base, state: 'error', detail: 'store' };
  }
  if (!k) return { ...base, state: 'not-connected' };
  const userToken = (() => {
    try {
      return open(k.userToken);
    } catch {
      return '';
    }
  })();
  const want = nameKey(name);
  const find = (x: Kept) => x.pages.find((p) => nameKey(p.name).includes(want));
  k = await refreshPages(k, userToken).catch(() => k!);
  if (!find(k) && userToken && Date.now() - (k.pagesAt ?? 0) > LOOK_AGAIN) k = await refreshPages(k, userToken, true).catch(() => k!);
  const pg = find(k);
  if (!pg) return { ...base, state: 'not-shared', pages: k.pages.map((p) => p.name) };
  let token: string;
  try {
    token = open(pg.token);
  } catch {
    return { ...base, state: 'expired' };
  }
  type Post = FbPost & { shares?: { count?: number } };
  let info: { id: string; name?: string; link?: string; username?: string; followers_count?: number; fan_count?: number; picture?: { data?: { url?: string } } };
  let feed: { data?: Post[] };
  try {
    [info, feed] = await Promise.all([
      graph<typeof info>(`/${pg.id}`, token, { fields: 'id,name,link,username,followers_count,fan_count,picture.type(large){url}' }),
      graph<typeof feed>(`/${pg.id}/published_posts`, token, {
        fields:
          'id,message,story,created_time,permalink_url,full_picture,status_type,shares,reactions.summary(total_count).limit(0),' +
          'comments.order(reverse_chronological).limit(25).summary(true){id,message,created_time,from{id,name},permalink_url,comments.limit(10){created_time,from{id}}}',
        limit: '25',
      }),
    ]);
  } catch (e) {
    if (e instanceof MetaError && e.code === 'meta-expired') return { ...base, state: 'expired', detail: e.detail || undefined };
    return { ...base, state: 'error', detail: e instanceof MetaError ? e.code : e instanceof Error ? e.message.slice(0, 200) : undefined };
  }
  const followers = typeof info.followers_count === 'number' ? info.followers_count : typeof info.fan_count === 'number' ? info.fan_count : null;
  const page: PageReport['page'] = {
    id: pg.id,
    name: info.name || pg.name,
    link: info.link || `https://www.facebook.com/${info.username || pg.id}`,
    handle: info.username,
    picture: info.picture?.data?.url,
    followers,
    likes: typeof info.fan_count === 'number' ? info.fan_count : null,
  };
  const posts: PagePost[] = [];
  const comments: PageComment[] = [];
  for (const p of feed.data ?? []) {
    const link = p.permalink_url || `https://www.facebook.com/${p.id}`;
    posts.push({
      id: p.id,
      text: clip(p.message || p.story, 300),
      at: ms(p.created_time),
      link,
      thumb: p.full_picture,
      kind: /video/.test(p.status_type ?? '') ? 'video' : p.full_picture ? 'photo' : 'post',
      reactions: p.reactions?.summary?.total_count ?? 0,
      comments: p.comments?.summary?.total_count ?? p.comments?.data?.length ?? 0,
      shares: p.shares?.count ?? 0,
    });
    for (const c of p.comments?.data ?? []) {
      if (c.from?.id === pg.id) continue; // the Page's own comment
      const replies = (c.comments?.data ?? []).map((r) => ({ id: '', who: '', text: '', at: ms(r.created_time), mine: r.from?.id === pg.id }));
      const at = ms(c.created_time);
      const { answered, activeAt } = answeredOf(replies, at);
      comments.push({ id: c.id, post: p.id, who: c.from?.name || 'Someone on Facebook', text: clip(c.message, 600), at: activeAt ?? at, link: c.permalink_url || link, answered });
    }
  }
  // today's followers, then the days before (a store that's down leaves the history empty, not the report)
  const history = await counts([{ platform: 'fb', account: pg.id, followers, posts: null }])
    .then((h) => h.filter((d) => d.platform === 'fb' && d.account === pg.id).map((d) => ({ day: d.day, followers: d.followers })))
    .catch(() => []);
  return {
    ...base,
    page,
    history,
    posts: posts.sort((a, b) => b.at - a.at),
    comments: comments.sort((a, b) => b.at - a.at).slice(0, 40),
  };
}
