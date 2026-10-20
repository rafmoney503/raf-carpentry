import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { jobkitRpc, syncSetUp } from './job-kit-sync-server';

/* The Job Kit's Social screen, part 1: Raf's Instagram and Facebook (20 Oct 2026, Raf: 'is there a way to see in job kit
   social media profiles with followers and comments as a separate section', then 'start with instagram and facebook').

   One Facebook login (Meta's own app 'Raf Job Kit', in development mode: only people with a role on it can use it,
   so no App Review) gives a Page access token for the Raf Carpentry Page, which also reads the Instagram professional
   account linked to that Page. Page tokens made from a long-lived user token don't run out; they stop working if
   Raf changes his Facebook password, removes the app, or loses his role on the Page (then: Connect again).

   Kept in Supabase (cabinetos project, schema jobkit, through public.jobkit_social, the same secret as the sync):
   jobkit.social 'meta' = who connected, the Pages with their tokens SEALED (AES-256-GCM, a key made from
   JOBKIT_SYNC_SECRET), which Page, the permissions given, and the newest comment Raf has seen; jobkit.social_counts =
   followers per account per London day, written whenever the overview is fetched, so the screen can say '+12 this
   week'. Comments, posts and pictures are never kept on the server: they go Meta -> server -> the device that asked.

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
export const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
  'pages_manage_engagement',
  'instagram_basic',
  'instagram_manage_comments',
  'business_management',
];
const scopes = () => (process.env.META_SCOPES ? process.env.META_SCOPES.split(',').map((s) => s.trim()).filter(Boolean) : SCOPES);

export const metaMissing = () =>
  [!APP_ID() && 'META_APP_ID', !APP_SECRET() && 'META_APP_SECRET', !syncSetUp() && 'JOBKIT_SYNC_SECRET'].filter(Boolean) as string[];
export const metaSetUp = () => metaMissing().length === 0;

export class MetaError extends Error {
  constructor(
    public code: 'meta-expired' | 'meta-permission' | 'meta-busy' | 'meta-gone' | 'meta-error' | 'meta-store' | 'meta-no-page' | 'meta-no-ig' | 'meta-not-connected',
    public detail = '',
  ) {
    super(code);
  }
}

/* ---------- sealing the tokens ---------- */

const sealKey = () => createHash('sha256').update(`raf-job-kit social|${process.env.JOBKIT_SYNC_SECRET ?? ''}`).digest();
export function seal(s: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', sealKey(), iv);
  const out = Buffer.concat([c.update(s, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${out.toString('base64url')}.${c.getAuthTag().toString('base64url')}`;
}
export function unseal(s: string) {
  const [v, iv, body, tag] = s.split('.');
  if (v !== 'v1' || !iv || !body || !tag) throw new MetaError('meta-store', 'token');
  try {
    const d = createDecipheriv('aes-256-gcm', sealKey(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
  } catch {
    // the sync secret changed since: the tokens can't be read, so connect again
    throw new MetaError('meta-expired', 'sealed with an older secret');
  }
}

/* ---------- the login's state: proves the login was started from the Job Kit (behind the PIN) ---------- */

const stateMac = (s: string) => createHmac('sha256', `${APP_SECRET()}|job-kit-social-state`).update(s).digest('base64url');
export function newState() {
  const s = `${Date.now()}.${randomBytes(9).toString('base64url')}`;
  return `${s}.${stateMac(s)}`;
}
export function stateOk(state: string | null) {
  if (!state) return false;
  const i = state.lastIndexOf('.');
  if (i < 0) return false;
  const s = state.slice(0, i);
  const a = Buffer.from(state.slice(i + 1));
  const b = Buffer.from(stateMac(s));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const t = Number(s.split('.')[0]);
  return Number.isFinite(t) && Date.now() - t < 30 * 60_000 && t < Date.now() + 60_000;
}

export const redirectUri = (origin: string) => process.env.META_REDIRECT_URI || `${origin.replace(/\/$/, '')}/api/job-kit/social/meta/callback`;

export function loginUrl(origin: string, again = false) {
  const p = new URLSearchParams({ client_id: APP_ID(), redirect_uri: redirectUri(origin), state: newState(), response_type: 'code' });
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
  perms: string[];
  declined: string[];
  connectedAt: number;
  seenAt?: number; // the newest comment Raf has had in front of him
};

async function load(): Promise<Kept | null> {
  try {
    const r = (await jobkitRpc('jobkit_social', { p_action: 'get', p: { key: 'meta' } })) as { data?: Kept | null };
    return r?.data && r.data.v === 1 ? r.data : null;
  } catch {
    throw new MetaError('meta-store');
  }
}
async function save(k: Kept) {
  try {
    await jobkitRpc('jobkit_social', { p_action: 'put', p: { key: 'meta', data: k } });
  } catch {
    throw new MetaError('meta-store');
  }
}

/* ---------- connecting (the callback) ---------- */

/* The code from Facebook's login -> a long-lived user token -> the Pages with their own tokens and linked Instagram.
   Answers whether a Page is picked (several Pages and no clear one: Raf picks in the app). */
export async function connect(code: string, origin: string): Promise<{ picked: boolean }> {
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
  const [me, perms, accounts] = await Promise.all([
    graph<{ id: string; name?: string }>('/me', token, { fields: 'id,name' }),
    graph<{ data?: { permission: string; status: string }[] }>('/me/permissions', token).catch(() => ({ data: [] })),
    graph<{ data?: { id: string; name: string; access_token?: string; instagram_business_account?: { id: string; username?: string } }[] }>('/me/accounts', token, {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      limit: '100',
    }),
  ]);
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

export async function disconnect() {
  try {
    await jobkitRpc('jobkit_social', { p_action: 'del', p: { key: 'meta' } });
  } catch {
    throw new MetaError('meta-store');
  }
}

export async function markSeen(at: number) {
  const k = await load();
  if (!k) return;
  if ((k.seenAt ?? 0) >= at) return;
  try {
    await jobkitRpc('jobkit_social', { p_action: 'patch', p: { key: 'meta', data: { seenAt: Math.min(at, Date.now() + 60_000) } } });
  } catch {
    throw new MetaError('meta-store');
  }
}

/* ---------- the overview ---------- */

export type Platform = 'ig' | 'fb';
export type SocialDay = { day: string; followers: number | null };
export type SocialProfile = {
  platform: Platform;
  id: string;
  name: string;
  handle?: string;
  link: string;
  picture?: string;
  followers: number | null;
  following?: number | null;
  posts?: number | null;
  history: SocialDay[];
};
export type SocialReply = { id: string; who: string; text: string; at: number; mine: boolean };
export type SocialComment = {
  id: string;
  platform: Platform;
  post: string; // the post's id
  who: string;
  text: string;
  at: number;
  likes: number;
  link: string; // where Open goes: the comment (Facebook) or the post (Instagram)
  replies: SocialReply[];
  answered: boolean; // Raf has replied under it
};
export type SocialPost = {
  id: string;
  platform: Platform;
  text: string;
  at: number;
  link: string;
  thumb?: string;
  kind: 'reel' | 'video' | 'photo' | 'carousel' | 'post';
  likes: number | null;
  comments: number;
};
export type SocialProblem = { platform: Platform; error: string; detail?: string };
export type SocialOverview =
  | { connected: false; setUp: boolean; missing: string[] }
  | {
      connected: true;
      user: string;
      connectedAt: number;
      pages: { id: string; name: string; ig?: string }[];
      page?: { id: string; name: string }; // none: several Pages, Raf picks one
      profiles: SocialProfile[];
      posts: SocialPost[];
      comments: SocialComment[];
      seenAt: number;
      notGranted: string[]; // permissions it asked for that weren't given
      problems: SocialProblem[];
      at: number;
    };

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

const ms = (t?: string) => {
  const n = t ? Date.parse(t.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const clip = (s: string | undefined, n: number) => (s ?? '').trim().slice(0, n);

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
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  for (const p of feed.data ?? []) {
    const link = p.permalink_url || `https://www.facebook.com/${p.id}`;
    posts.push({
      id: p.id,
      platform: 'fb',
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
      const replies = (c.comments?.data ?? []).map((r) => ({ id: r.id, who: r.from?.name || 'Someone on Facebook', text: clip(r.message, 2000), at: ms(r.created_time), mine: r.from?.id === page.id }));
      comments.push({
        id: c.id,
        platform: 'fb',
        post: p.id,
        who: c.from?.name || 'Someone on Facebook',
        text: clip(c.message, 2000),
        at: ms(c.created_time),
        likes: c.like_count ?? 0,
        link: c.permalink_url || link,
        replies: replies.sort((a, b) => a.at - b.at),
        answered: replies.some((r) => r.mine),
      });
    }
  }
  return { profile, posts, comments };
}

async function instagram(ig: { id: string; username?: string }, token: string) {
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
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  for (const m of media.data ?? []) {
    const link = m.permalink || profile.link;
    const t = (m.media_type ?? '').toUpperCase();
    posts.push({
      id: m.id,
      platform: 'ig',
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
      const replies = (c.replies?.data ?? []).map((r) => ({ id: r.id, who: r.username ? `@${r.username}` : 'Someone on Instagram', text: clip(r.text, 2000), at: ms(r.timestamp), mine: Boolean(me && r.username?.toLowerCase() === me) }));
      comments.push({
        id: c.id,
        platform: 'ig',
        post: m.id,
        who: c.username ? `@${c.username}` : 'Someone on Instagram',
        text: clip(c.text, 2000),
        at: ms(c.timestamp),
        likes: c.like_count ?? 0,
        link,
        replies: replies.sort((a, b) => a.at - b.at),
        answered: replies.some((r) => r.mine),
      });
    }
  }
  return { profile, posts, comments };
}

const problemOf = (platform: Platform, e: unknown): SocialProblem =>
  e instanceof MetaError ? { platform, error: e.code, detail: e.detail || undefined } : { platform, error: 'meta-error', detail: e instanceof Error ? e.message.slice(0, 200) : undefined };

export async function overview(): Promise<SocialOverview> {
  if (!metaSetUp()) return { connected: false, setUp: false, missing: metaMissing() };
  const k = await load();
  if (!k) return { connected: false, setUp: true, missing: [] };
  const page = k.pages.find((p) => p.id === k.pick);
  const asked = process.env.META_LOGIN_CONFIG_ID ? [] : scopes();
  const base = {
    connected: true as const,
    user: k.user.name,
    connectedAt: k.connectedAt,
    pages: k.pages.map((p) => ({ id: p.id, name: p.name, ig: p.ig?.username })),
    seenAt: k.seenAt ?? 0,
    notGranted: asked.filter((s) => !k.perms.includes(s)),
    at: Date.now(),
  };
  if (!page) return { ...base, profiles: [], posts: [], comments: [], problems: [] };
  const token = unseal(page.token);
  const userToken = (() => {
    try {
      return unseal(k.userToken);
    } catch {
      return '';
    }
  })();
  const [fb, ig] = await Promise.allSettled([
    facebook(page, token),
    page.ig
      ? instagram(page.ig, token).catch((e) => {
          // the Page's token normally reads its Instagram; if Meta says no, the user token may still
          if (userToken && e instanceof MetaError && (e.code === 'meta-permission' || e.code === 'meta-expired')) return instagram(page.ig!, userToken);
          throw e;
        })
      : Promise.reject(new MetaError('meta-no-ig')),
  ]);
  const problems: SocialProblem[] = [];
  const parts: { profile: SocialProfile; posts: SocialPost[]; comments: SocialComment[] }[] = [];
  if (ig.status === 'fulfilled') parts.push(ig.value);
  else problems.push(problemOf('ig', ig.reason));
  if (fb.status === 'fulfilled') parts.push(fb.value);
  else problems.push(problemOf('fb', fb.reason));
  // the login stopped working everywhere: connect again
  if (!parts.length && problems.every((p) => p.error === 'meta-expired')) throw new MetaError('meta-expired', problems[0]?.detail);

  const profiles = parts.map((p) => p.profile);
  // today's followers, then their history (a store that's down doesn't stop the rest)
  try {
    const rows = profiles.map((p) => ({ platform: p.platform, account: p.id, followers: p.followers, posts: p.posts ?? null }));
    const r = (await jobkitRpc('jobkit_social', { p_action: 'counts', p: { rows } })) as { history?: { platform: Platform; account: string; day: string; followers: number | null }[] };
    for (const p of profiles) p.history = (r.history ?? []).filter((h) => h.platform === p.platform && h.account === p.id).map((h) => ({ day: h.day, followers: h.followers }));
  } catch {
    /* no history this time */
  }
  return {
    ...base,
    page: { id: page.id, name: page.name },
    profiles,
    posts: parts.flatMap((p) => p.posts).sort((a, b) => b.at - a.at),
    comments: parts
      .flatMap((p) => p.comments)
      .sort((a, b) => b.at - a.at)
      .slice(0, 80),
    problems,
  };
}

/* ---------- replying (only ever because Raf pressed Send reply) ---------- */

export async function replyTo(platform: Platform, commentId: string, text: string): Promise<{ id: string }> {
  const k = await load();
  if (!k) throw new MetaError('meta-not-connected');
  const page = k.pages.find((p) => p.id === k.pick);
  if (!page) throw new MetaError('meta-no-page');
  const token = unseal(page.token);
  // Instagram: a reply under the comment; Facebook: a comment on the comment, as the Page
  const r = await graph<{ id?: string }>(platform === 'ig' ? `/${commentId}/replies` : `/${commentId}/comments`, token, { message: text }, 'POST');
  return { id: r.id || '' };
}
