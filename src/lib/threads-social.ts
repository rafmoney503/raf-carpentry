import { syncSetUp } from './job-kit-sync-server';
import { forget, keep, kept, newState, seal, stateOk, StoreError, unseal } from './social-store';
import { answeredOf, clip, ms, type SocialAccount, type SocialComment, type SocialPart, type SocialPost, type SocialProblem, type SocialProfile, type SocialReply } from './social-types';

/* The Job Kit's Social screen, part 2: Raf's Threads (21 Oct 2026, Raf: 'Let's go with threads').

   Threads has its own API and its own login (threads.com), through a Meta app with the 'Access the Threads API' use
   case, which has its own Threads App ID and Secret. In development mode only Threads Testers on the app can use it
   (Raf's own account, invited under App roles and accepted in Threads: Settings, Account, Website permissions), so no
   App Review. The login gives a short-lived token, swapped at once for a long-lived one (60 days), which is refreshed
   here every few days while the Job Kit is used, so it never runs out unless Raf leaves it for two months.

   Kept (src/lib/social-store.ts): jobkit.social 'threads' = who connected, the token sealed, when it runs out.
   Shown: the profile with followers (threads_manage_insights), the latest threads with likes and replies, and the
   replies people left under them (threads_read_replies), as comments with what was said back. Replying (only when
   Raf presses Send reply) makes a reply container and publishes it (threads_content_publish, threads_manage_replies).

   Vercel: THREADS_APP_ID, THREADS_APP_SECRET (sensitive). Optional: THREADS_SCOPES (comma list), THREADS_REDIRECT_URI
   (default <site>/api/job-kit/social/threads/callback); THREADS_GRAPH_API and THREADS_DIALOG point at a pretend
   Threads in tests. */

const GRAPH = () => (process.env.THREADS_GRAPH_API || 'https://graph.threads.com').replace(/\/$/, '');
const DIALOG = () => (process.env.THREADS_DIALOG || 'https://threads.com').replace(/\/$/, '');
const V = () => process.env.THREADS_API_VERSION || 'v1.0';
const APP_ID = () => process.env.THREADS_APP_ID || '';
const APP_SECRET = () => process.env.THREADS_APP_SECRET || '';

export const THREADS_SCOPES = ['threads_basic', 'threads_read_replies', 'threads_manage_replies', 'threads_manage_insights', 'threads_content_publish'];
const scopes = () =>
  process.env.THREADS_SCOPES
    ? process.env.THREADS_SCOPES.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : THREADS_SCOPES;

export const threadsMissing = () => [!APP_ID() && 'THREADS_APP_ID', !APP_SECRET() && 'THREADS_APP_SECRET', !syncSetUp() && 'JOBKIT_SYNC_SECRET'].filter(Boolean) as string[];
export const threadsSetUp = () => threadsMissing().length === 0;

export class ThreadsError extends Error {
  constructor(public code: 'threads-expired' | 'threads-permission' | 'threads-busy' | 'threads-gone' | 'threads-error' | 'threads-store' | 'threads-not-connected', public detail = '') {
    super(code);
  }
}

const STATE_TAG = 'job-kit-threads-state';
export const threadsStateOk = (state: string | null) => stateOk(state, APP_SECRET(), STATE_TAG);
export const threadsRedirectUri = (origin: string) => process.env.THREADS_REDIRECT_URI || `${origin.replace(/\/$/, '')}/api/job-kit/social/threads/callback`;

export function threadsLoginUrl(origin: string) {
  const p = new URLSearchParams({
    client_id: APP_ID(),
    redirect_uri: threadsRedirectUri(origin),
    scope: scopes().join(','),
    response_type: 'code',
    state: newState(APP_SECRET(), STATE_TAG),
  });
  return `${DIALOG()}/oauth/authorize?${p}`;
}

/* ---------- the API ---------- */

type ApiError = { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } };

async function api<T>(path: string, token: string | null, params: Record<string, string> = {}, method: 'GET' | 'POST' = 'GET', versioned = true): Promise<T> {
  const q = new URLSearchParams(params);
  if (token) q.set('access_token', token);
  const url = `${GRAPH()}${versioned ? `/${V()}` : ''}${path}`;
  const res = await fetch(method === 'GET' ? `${url}?${q}` : url, {
    method,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? q.toString() : undefined,
  }).catch(() => null);
  if (!res) throw new ThreadsError('threads-busy', 'Threads didn’t answer');
  const body = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok || body.error) {
    const e = body.error ?? {};
    const code = Number(e.code);
    const msg = String(e.error_user_msg || e.message || `HTTP ${res.status}`).slice(0, 300);
    // 190: the token is no good any more (expired, password changed, app removed); every other error keeps the login
    if (code === 190 || code === 102 || code === 463 || code === 467) throw new ThreadsError('threads-expired', msg);
    if ([4, 17, 32, 341, 613].includes(code) || res.status === 429) throw new ThreadsError('threads-busy', msg);
    if (code === 10 || code === 3 || (code >= 200 && code < 300) || /permission/i.test(msg)) throw new ThreadsError('threads-permission', msg);
    if (code === 100 && /does not exist|cannot be loaded|unsupported get/i.test(msg)) throw new ThreadsError('threads-gone', msg);
    throw new ThreadsError(res.status >= 500 ? 'threads-busy' : 'threads-error', msg);
  }
  return body;
}

/* ---------- what's kept ---------- */

type Kept = {
  v: 1;
  user: { id: string; username: string; name?: string };
  token: string; // sealed, long-lived
  until: number; // when it runs out
  refreshedAt: number;
  connectedAt: number;
};

async function load(): Promise<Kept | null> {
  try {
    const k = await kept<Kept>('threads');
    return k && k.v === 1 && k.token ? k : null;
  } catch {
    throw new ThreadsError('threads-store');
  }
}
async function save(k: Kept) {
  try {
    await keep('threads', k);
  } catch {
    throw new ThreadsError('threads-store');
  }
}
const open = (s: string) => {
  try {
    return unseal(s);
  } catch {
    throw new ThreadsError('threads-expired', 'sealed with an older secret');
  }
};

/* ---------- connecting (the callback) ---------- */

export async function connectThreads(code: string, origin: string) {
  const short = await api<{ access_token: string; user_id?: string | number }>(
    '/oauth/access_token',
    null,
    { client_id: APP_ID(), client_secret: APP_SECRET(), grant_type: 'authorization_code', redirect_uri: threadsRedirectUri(origin), code: code.replace(/#_$/, '') },
    'POST',
    false
  );
  const long = await api<{ access_token: string; expires_in?: number }>(
    '/access_token',
    null,
    { grant_type: 'th_exchange_token', client_secret: APP_SECRET(), access_token: short.access_token },
    'GET',
    false
  );
  const me = await api<{ id: string; username?: string; name?: string }>('/me', long.access_token, { fields: 'id,username,name' });
  const now = Date.now();
  await save({
    v: 1,
    user: { id: me.id, username: me.username || '', name: me.name },
    token: seal(long.access_token),
    until: now + (long.expires_in || 60 * 86400) * 1000,
    refreshedAt: now,
    connectedAt: now,
  });
}

export async function disconnectThreads() {
  try {
    await forget('threads');
  } catch {
    throw new ThreadsError('threads-store');
  }
}

/* The long-lived token, refreshed (a fresh 60 days) when the last one is over 3 days old. A refresh that doesn't work
   isn't a problem while the old token still has time left. */
const REFRESH_AFTER = 3 * 86400_000;
async function tokenOf(k: Kept): Promise<string> {
  const token = open(k.token);
  if (k.until && k.until < Date.now()) throw new ThreadsError('threads-expired', 'the Threads login ran out');
  if (Date.now() - k.refreshedAt < REFRESH_AFTER) return token;
  try {
    const r = await api<{ access_token: string; expires_in?: number }>('/refresh_access_token', null, { grant_type: 'th_refresh_token', access_token: token }, 'GET', false);
    const now = Date.now();
    await save({ ...k, token: seal(r.access_token), until: now + (r.expires_in || 60 * 86400) * 1000, refreshedAt: now });
    return r.access_token;
  } catch (e) {
    if (e instanceof ThreadsError && e.code === 'threads-expired') throw e;
    return token;
  }
}

/* ---------- the overview ---------- */

type ThMedia = {
  id: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  text?: string;
  timestamp?: string;
  is_quote_post?: boolean;
};
type ThReply = {
  id: string;
  text?: string;
  username?: string;
  permalink?: string;
  timestamp?: string;
  replied_to?: { id: string };
  root_post?: { id: string };
  is_reply_owned_by_me?: boolean;
  hide_status?: string;
  media_type?: string;
};
type Insights = { data?: { name: string; values?: { value?: number }[]; total_value?: { value?: number } }[] };

const metric = (r: Insights | null, name: string) => {
  const m = r?.data?.find((d) => d.name === name);
  const v = m?.total_value?.value ?? m?.values?.[0]?.value;
  return typeof v === 'number' ? v : null;
};
const hidden = (r: ThReply) => /^(HIDDEN|BLOCKED|RESTRICTED)$/i.test(r.hide_status ?? '');

/* The replies under one thread, as comments: each reply straight under the post is a comment, and everything said
   below it (Raf's answers and theirs) are its replies, oldest first. */
function commentsOf(post: ThMedia, link: string, all: ThReply[], me: string): SocialComment[] {
  const byId = new Map(all.map((r) => [r.id, r]));
  const mine = (r: ThReply) => Boolean(r.is_reply_owned_by_me || (me && r.username?.toLowerCase() === me));
  const topOf = (r: ThReply) => {
    let at: ThReply = r;
    for (let i = 0; i < 30 && at.replied_to && at.replied_to.id !== post.id; i++) {
      const up = byId.get(at.replied_to.id);
      if (!up) break;
      at = up;
    }
    return at;
  };
  const tops = all.filter((r) => !hidden(r) && (!r.replied_to || r.replied_to.id === post.id) && !mine(r));
  return tops.map((t) => {
    const replies: SocialReply[] = all
      .filter((r) => r.id !== t.id && !hidden(r) && r.replied_to && r.replied_to.id !== post.id && topOf(r).id === t.id)
      .map((r) => ({ id: r.id, who: mine(r) ? 'You' : r.username ? `@${r.username}` : 'Someone on Threads', text: clip(r.text, 2000), at: ms(r.timestamp), mine: mine(r) }))
      .sort((a, b) => a.at - b.at);
    const at = ms(t.timestamp);
    return {
      id: t.id,
      platform: 'th' as const,
      post: post.id,
      who: t.username ? `@${t.username}` : 'Someone on Threads',
      text: clip(t.text, 2000),
      at,
      likes: 0,
      link: t.permalink || link,
      replies,
      ...answeredOf(replies, at),
    };
  });
}

async function threads(k: Kept, token: string) {
  const [info, followers, list] = await Promise.all([
    api<{ id: string; username?: string; name?: string; threads_profile_picture_url?: string }>('/me', token, { fields: 'id,username,name,threads_profile_picture_url' }),
    api<Insights>(`/${k.user.id}/threads_insights`, token, { metric: 'followers_count' }).catch((e) => e as ThreadsError),
    api<{ data?: ThMedia[] }>('/me/threads', token, { fields: 'id,media_type,media_product_type,media_url,thumbnail_url,permalink,text,timestamp,is_quote_post', limit: '12' }),
  ]);
  const username = info.username || k.user.username;
  const me = username.toLowerCase();
  const problems: SocialProblem[] = [];
  if (followers instanceof Error) problems.push(problemOf(followers, 'followers'));
  const profile: SocialProfile = {
    platform: 'th',
    id: info.id || k.user.id,
    name: info.name || username || 'Threads',
    handle: username,
    link: `https://www.threads.com/@${username}`,
    picture: info.threads_profile_picture_url,
    followers: followers instanceof Error ? null : metric(followers, 'followers_count'),
    history: [],
  };
  const media = (list.data ?? []).filter((m) => m.media_type !== 'REPOST_FACADE').slice(0, 8);
  // each thread's replies and numbers, side by side; one that fails doesn't stop the others
  const extra = await Promise.all(
    media.map(async (m) => {
      const [conv, ins] = await Promise.all([
        api<{ data?: ThReply[] }>(`/${m.id}/conversation`, token, {
          fields: 'id,text,username,permalink,timestamp,replied_to,root_post,is_reply_owned_by_me,hide_status,media_type',
          reverse: 'false',
          limit: '100',
        }).catch((e) => e as ThreadsError),
        api<Insights>(`/${m.id}/insights`, token, { metric: 'likes,replies' }).catch(() => null),
      ]);
      return { conv, ins };
    })
  );
  const posts: SocialPost[] = [];
  const comments: SocialComment[] = [];
  let convFailed: ThreadsError | null = null;
  media.forEach((m, i) => {
    const { conv, ins } = extra[i];
    const link = m.permalink || profile.link;
    const t = (m.media_type ?? '').toUpperCase();
    const all = conv instanceof Error ? [] : conv.data ?? [];
    if (conv instanceof Error) convFailed = conv;
    posts.push({
      id: m.id,
      platform: 'th',
      text: clip(m.text, 300),
      at: ms(m.timestamp),
      link,
      thumb: t === 'IMAGE' ? m.media_url : t === 'VIDEO' ? m.thumbnail_url || undefined : t === 'CAROUSEL_ALBUM' ? m.thumbnail_url || m.media_url || undefined : undefined,
      kind: t === 'VIDEO' ? 'video' : t === 'IMAGE' ? 'photo' : t === 'CAROUSEL_ALBUM' ? 'carousel' : 'thread',
      likes: metric(ins, 'likes'),
      comments: metric(ins, 'replies') ?? all.filter((r) => !r.replied_to || r.replied_to.id === m.id).length,
    });
    comments.push(...commentsOf(m, link, all, me));
  });
  if (convFailed) problems.push(problemOf(convFailed, 'replies'));
  return { profile, posts, comments, problems };
}

const problemOf = (e: unknown, what?: string): SocialProblem =>
  e instanceof ThreadsError
    ? { platform: 'th', error: e.code, detail: [what, e.detail].filter(Boolean).join(': ') || undefined }
    : e instanceof StoreError
    ? { platform: 'th', error: 'threads-store' }
    : { platform: 'th', error: 'threads-error', detail: e instanceof Error ? e.message.slice(0, 200) : undefined };

const EMPTY: SocialPart = { profiles: [], posts: [], comments: [], problems: [] };

/* Threads for the overview (src/lib/social.ts). Never throws. */
export async function threadsPart(): Promise<{ account: SocialAccount; part: SocialPart }> {
  if (!threadsSetUp()) return { account: { setUp: false, missing: threadsMissing(), connected: false }, part: EMPTY };
  let k: Kept | null;
  try {
    k = await load();
  } catch (e) {
    const p = problemOf(e);
    return { account: { setUp: true, missing: [], connected: false, error: p.error }, part: EMPTY };
  }
  if (!k) return { account: { setUp: true, missing: [], connected: false }, part: EMPTY };
  const account: SocialAccount = { setUp: true, missing: [], connected: true, who: k.user.username ? `@${k.user.username}` : k.user.name, connectedAt: k.connectedAt };
  try {
    const token = await tokenOf(k);
    const r = await threads(k, token);
    return { account, part: { profiles: [r.profile], posts: r.posts, comments: r.comments, problems: r.problems } };
  } catch (e) {
    const p = problemOf(e);
    if (p.error === 'threads-expired') return { account: { ...account, error: p.error, detail: p.detail }, part: EMPTY };
    return { account, part: { ...EMPTY, problems: [p] } };
  }
}

/* ---------- replying (only ever because Raf pressed Send reply) ---------- */

const wait = (n: number) => new Promise((r) => setTimeout(r, n));

/* A reply is made in two steps: a container with the words, then publishing it. A text container is usually ready
   at once; if Threads says it isn't, its status is checked and publishing tried again (about 20 s at most), and a
   container that turns out to be published already isn't published twice. */
export async function replyThreads(commentId: string, text: string): Promise<{ id: string }> {
  const k = await load();
  if (!k) throw new ThreadsError('threads-not-connected');
  const token = await tokenOf(k);
  const box = await api<{ id: string }>('/me/threads', token, { media_type: 'TEXT', text, reply_to_id: commentId }, 'POST');
  const tries = [0, 1500, 3000, 5000, 8000];
  let last: unknown = null;
  for (const t of tries) {
    if (t) {
      await wait(t);
      const s = await api<{ status?: string; error_message?: string }>(`/${box.id}`, token, { fields: 'status,error_message' }).catch(() => null);
      if (s?.status === 'PUBLISHED') return { id: '' };
      if (s?.status === 'ERROR' || s?.status === 'EXPIRED') throw new ThreadsError('threads-error', s.error_message || 'Threads couldn’t make the reply');
      if (s?.status === 'IN_PROGRESS') continue;
    }
    try {
      const r = await api<{ id?: string }>('/me/threads_publish', token, { creation_id: box.id }, 'POST');
      return { id: r.id || '' };
    } catch (e) {
      last = e;
      if (e instanceof ThreadsError && (e.code === 'threads-expired' || e.code === 'threads-permission')) throw e;
    }
  }
  throw last instanceof ThreadsError ? last : new ThreadsError('threads-busy', 'Threads didn’t publish the reply');
}
