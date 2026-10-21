import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { jobkitRpc } from './job-kit-sync-server';

/* What the Social screen keeps on the server, shared by Instagram and Facebook (meta-social.ts) and Threads
   (threads-social.ts): Supabase, cabinetos project, schema jobkit, through public.jobkit_social (same secret as the
   sync). jobkit.social holds one row per key: 'meta' and 'threads' (who connected and their tokens, SEALED with
   AES-256-GCM under a key made from JOBKIT_SYNC_SECRET), 'seen' (the newest comment Raf has had in front of him);
   jobkit.social_counts holds followers per platform, account and London day. Nothing else: comments, posts and
   pictures go from the platform to the device that asked. */

export class StoreError extends Error {
  constructor(public code: 'store' | 'sealed') {
    super(code);
  }
}

/* ---------- sealing the tokens ---------- */

const sealKey = () =>
  createHash('sha256')
    .update(`raf-job-kit social|${process.env.JOBKIT_SYNC_SECRET ?? ''}`)
    .digest();
export function seal(s: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', sealKey(), iv);
  const out = Buffer.concat([c.update(s, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${out.toString('base64url')}.${c.getAuthTag().toString('base64url')}`;
}
/* Throws StoreError('sealed') when it can't be read (the sync secret changed since): connect again. */
export function unseal(s: string) {
  const [v, iv, body, tag] = s.split('.');
  if (v !== 'v1' || !iv || !body || !tag) throw new StoreError('sealed');
  try {
    const d = createDecipheriv('aes-256-gcm', sealKey(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
  } catch {
    throw new StoreError('sealed');
  }
}

/* ---------- a login's state: proves it was started from the Job Kit (behind the PIN) ---------- */

const mac = (secret: string, tag: string, s: string) => createHmac('sha256', `${secret}|${tag}`).update(s).digest('base64url');
export function newState(secret: string, tag: string) {
  const s = `${Date.now()}.${randomBytes(9).toString('base64url')}`;
  return `${s}.${mac(secret, tag, s)}`;
}
export function stateOk(state: string | null, secret: string, tag: string) {
  if (!state || !secret) return false;
  const i = state.lastIndexOf('.');
  if (i < 0) return false;
  const s = state.slice(0, i);
  const a = Buffer.from(state.slice(i + 1));
  const b = Buffer.from(mac(secret, tag, s));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const t = Number(s.split('.')[0]);
  return Number.isFinite(t) && Date.now() - t < 30 * 60_000 && t < Date.now() + 60_000;
}

/* ---------- the rows ---------- */

export async function kept<T>(key: string): Promise<T | null> {
  try {
    const r = (await jobkitRpc('jobkit_social', { p_action: 'get', p: { key } })) as { data?: T | null };
    return r?.data ?? null;
  } catch {
    throw new StoreError('store');
  }
}
export async function keep(key: string, data: object) {
  try {
    await jobkitRpc('jobkit_social', { p_action: 'put', p: { key, data } });
  } catch {
    throw new StoreError('store');
  }
}
export async function forget(key: string) {
  try {
    await jobkitRpc('jobkit_social', { p_action: 'del', p: { key } });
  } catch {
    throw new StoreError('store');
  }
}

export type CountRow = { platform: string; account: string; followers: number | null; posts: number | null };
export type CountDay = { platform: string; account: string; day: string; followers: number | null };
/* Today's numbers for each account, then up to 400 days of them. */
export async function counts(rows: CountRow[]): Promise<CountDay[]> {
  const r = (await jobkitRpc('jobkit_social', { p_action: 'counts', p: { rows } })) as { history?: CountDay[] };
  return r.history ?? [];
}
