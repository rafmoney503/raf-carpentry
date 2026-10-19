import { guard } from '@/lib/job-kit-server';
import { SyncError, syncRpc, syncSetUp, type SyncDoc } from '@/lib/job-kit-sync-server';

/* The Job Kit's phone and computer in step (src/app/job-kit/sync.ts), behind the PIN.
   { device, label, since, docs }  this device's changes go in (the later change wins), then what the other devices
                                   changed after `since` comes back: { saved, lost, docs, rev, more, devices, now } */
export const maxDuration = 30;

const noStore = { 'Cache-Control': 'no-store' };
const KINDS = new Set(['mark', 'posted', 'job', 'item', 'wa', 'wafile']);
const MAX_BODY = 4_200_000;

function docsOf(v: unknown): SyncDoc[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 400) return null;
  const out: SyncDoc[] = [];
  for (const d of v) {
    if (!d || typeof d !== 'object') return null;
    const { kind, id, at, data } = d as Record<string, unknown>;
    if (typeof kind !== 'string' || !KINDS.has(kind)) return null;
    if (typeof id !== 'string' || !id || id.length > 200) return null;
    if (typeof at !== 'number' || !Number.isSafeInteger(at) || at < 0) return null;
    if (data !== null && (typeof data !== 'object' || Array.isArray(data))) return null;
    out.push({ kind: kind as SyncDoc['kind'], id, at, data: data as SyncDoc['data'] });
  }
  return out;
}

export async function POST(req: Request) {
  const stop = await guard(req);
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
  const label = typeof body.label === 'string' ? body.label.slice(0, 40) : '';
  const since = typeof body.since === 'number' && Number.isSafeInteger(body.since) && body.since >= 0 ? body.since : -1;
  const docs = docsOf(body.docs);
  if (!device || since < 0 || !docs) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  try {
    return Response.json(await syncRpc({ device, label, since, docs }), { headers: noStore });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'sync-down';
    return Response.json({ error: code }, { status: code === 'sync-bad' ? 400 : 502, headers: noStore });
  }
}
