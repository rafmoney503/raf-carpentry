import { pinGuard } from '@/lib/job-kit-server';
import { jobkitRpc, SyncError, syncSetUp } from '@/lib/job-kit-sync-server';

/* What each job made, on the phone and the computer (src/app/job-kit/costs-store.ts), behind the PIN.
   { device, since, docs: [{ id, at, data | null }] }  this device's changes go in (the later change wins), and what
                                                       changed after `since` comes back: { docs, rev, more, now } */
export const maxDuration = 20;

const noStore = { 'Cache-Control': 'no-store' };
const MAX_BODY = 1_600_000;

type Doc = { id: string; at: number; data: Record<string, unknown> | null };

function docsOf(v: unknown): Doc[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 300) return null;
  const out: Doc[] = [];
  for (const d of v) {
    if (!d || typeof d !== 'object') return null;
    const { id, at, data } = d as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
    if (typeof at !== 'number' || !Number.isSafeInteger(at) || at < 0) return null;
    if (data !== null && (typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 11000)) return null;
    out.push({ id, at, data: data as Doc['data'] });
  }
  return out;
}

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  if (!syncSetUp()) return Response.json({ error: 'sync-not-set-up' }, { status: 503, headers: noStore });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: 'too-big' }, { status: 413, headers: noStore });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  const device = typeof body.device === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(body.device) ? body.device : '';
  const since = typeof body.since === 'number' && Number.isSafeInteger(body.since) && body.since >= 0 ? body.since : 0;
  const docs = docsOf(body.docs);
  if (!device || !docs) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  try {
    return Response.json(await jobkitRpc('jobkit_costs', { p_device: device, p_since: since, p_docs: docs }, 15000), { headers: noStore });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'sync-down';
    return Response.json({ error: code }, { status: code === 'sync-bad' ? 400 : 502, headers: noStore });
  }
}
