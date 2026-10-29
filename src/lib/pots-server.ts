import { pinOk } from '@/lib/job-kit-server';
import { jobkitRpc, SyncError, syncSetUp } from '@/lib/job-kit-sync-server';

/* Money pots (rafcarpentry.com/pots): Rafal Solutions' money and deadlines app, full screen on Raf's phone.
   The page (src/app/pots/app.html) keeps its data in Supabase (cabinetos project, table jobkit.pots, through
   public.jobkit_pots with the Job Kit's sync secret) and is opened with the Job Kit's PIN (JOBKIT_PIN), sent as
   x-pots-pin. Ask Claude goes through /api/pots/ask with ANTHROPIC_API_KEY. */

export const noStore = { 'Cache-Control': 'no-store' };

export async function potsGuard(req: Request): Promise<Response | null> {
  if (!process.env.JOBKIT_PIN) return Response.json({ error: 'not-set-up' }, { status: 503, headers: noStore });
  if (!pinOk(req.headers.get('x-pots-pin'))) {
    await new Promise((r) => setTimeout(r, 700));
    return Response.json({ error: 'wrong-pin' }, { status: 401, headers: noStore });
  }
  return null;
}

export type PotsDoc = { kind: 'book' | 'entry'; id: string; data: Record<string, unknown> | null };

/* What the page sends to keep: book/settings, book/chat and entries/<id>. */
export function potsDocsOf(v: unknown): PotsDoc[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > 100) return null;
  const out: PotsDoc[] = [];
  for (const d of v) {
    if (!d || typeof d !== 'object') return null;
    const { kind, id, data } = d as Record<string, unknown>;
    if (kind !== 'book' && kind !== 'entry') return null;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
    if (kind === 'book' && id !== 'settings' && id !== 'chat') return null;
    if (data !== null && (typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 400_000)) return null;
    out.push({ kind, id, data: data as PotsDoc['data'] });
  }
  return out;
}

export const potsStoreReady = syncSetUp;

export async function potsRpc(action: 'load' | 'put', p: Record<string, unknown>) {
  return jobkitRpc('jobkit_pots', { p_action: action, p }, 15000);
}

export function storeError(e: unknown) {
  const code = e instanceof SyncError ? e.code : 'sync-down';
  return Response.json({ error: code }, { status: code === 'sync-bad' ? 400 : 502, headers: noStore });
}
