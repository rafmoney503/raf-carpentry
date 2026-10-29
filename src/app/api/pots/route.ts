import { noStore, potsDocsOf, potsGuard, potsRpc, potsStoreReady, storeError } from '@/lib/pots-server';

/* Money pots' data (src/lib/pots-server.ts), behind the PIN.
   { action: 'check' }                     the PIN is right: { ok: true }
   { action: 'load', since }               everything changed after rev `since` (0 = all): { docs: [{ kind, id, data, rev }], rev }
   { action: 'put', docs: [{ kind, id, data | null }] }   keep these (null = deleted): { rev } */
export const maxDuration = 20;

const MAX_BODY = 1_600_000;

export async function POST(req: Request) {
  const stop = await potsGuard(req);
  if (stop) return stop;
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: 'too-big' }, { status: 413, headers: noStore });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  if (body.action === 'check') return Response.json({ ok: true }, { headers: noStore });
  if (!potsStoreReady()) return Response.json({ error: 'store-not-set-up' }, { status: 503, headers: noStore });
  try {
    if (body.action === 'load') {
      const since = typeof body.since === 'number' && Number.isSafeInteger(body.since) && body.since > 0 ? body.since : 0;
      return Response.json(await potsRpc('load', { since }), { headers: noStore });
    }
    if (body.action === 'put') {
      const docs = potsDocsOf(body.docs);
      if (!docs) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      return Response.json(await potsRpc('put', { docs }), { headers: noStore });
    }
  } catch (e) {
    return storeError(e);
  }
  return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
}
