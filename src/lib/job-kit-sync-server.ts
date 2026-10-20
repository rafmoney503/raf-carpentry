/* The Job Kit's phone and computer in step (src/app/job-kit/sync.ts): one Supabase function, public.jobkit_sync, in
   the cabinetos project's schema jobkit (RLS on, no policies, not exposed). It runs with the publishable key and
   checks JOBKIT_SYNC_SECRET, whose sha256 alone is stored in jobkit.config. The address and key are the website
   stats' (same project) unless JOBKIT_SYNC_URL / JOBKIT_SYNC_KEY are set (tests). */

const url = () => process.env.JOBKIT_SYNC_URL || process.env.RAFSTATS_URL || '';
const key = () => process.env.JOBKIT_SYNC_KEY || process.env.RAFSTATS_KEY || '';

export const syncSetUp = () => Boolean(url() && key() && process.env.JOBKIT_SYNC_SECRET);

export class SyncError extends Error {
  constructor(public code: 'sync-down' | 'sync-key' | 'sync-bad') {
    super(code);
  }
}

export type SyncDoc = { kind: 'mark' | 'posted' | 'job' | 'item' | 'wa' | 'wafile'; id: string; at: number; data: Record<string, unknown> | null };

/* Another jobkit function in the same project (jobkit_social: src/lib/meta-social.ts), with the same secret. */
export async function jobkitRpc(fn: string, args: Record<string, unknown>, timeoutMs = 10000): Promise<unknown> {
  const res = await fetch(`${url().replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { apikey: key(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_secret: process.env.JOBKIT_SYNC_SECRET, ...args }),
  }).catch(() => null);
  if (!res) throw new SyncError('sync-down');
  if (res.status === 401 || res.status === 403) throw new SyncError('sync-key');
  if (res.status === 400) {
    const t = await res.text().catch(() => '');
    throw new SyncError(/not allowed/.test(t) ? 'sync-key' : 'sync-bad');
  }
  if (!res.ok) throw new SyncError('sync-down');
  return res.json();
}

export async function syncRpc(args: { device: string; label: string; since: number; docs: SyncDoc[] }, timeoutMs = 20000): Promise<unknown> {
  const res = await fetch(`${url().replace(/\/$/, '')}/rest/v1/rpc/jobkit_sync`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { apikey: key(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_secret: process.env.JOBKIT_SYNC_SECRET, p_device: args.device, p_label: args.label, p_since: args.since, p_docs: args.docs }),
  }).catch(() => null);
  if (!res) throw new SyncError('sync-down');
  if (res.status === 401 || res.status === 403) throw new SyncError('sync-key');
  if (res.status === 400) {
    // the function's own checks ('not allowed' = the secret; 'bad doc' = something it won't keep)
    const t = await res.text().catch(() => '');
    throw new SyncError(/not allowed/.test(t) ? 'sync-key' : 'sync-bad');
  }
  if (!res.ok) throw new SyncError('sync-down');
  return res.json();
}
