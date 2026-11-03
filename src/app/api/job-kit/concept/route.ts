import { after } from 'next/server';
import { pinOk } from '@/lib/job-kit-server';
import { SyncError } from '@/lib/job-kit-sync-server';
import { conceptsRpc, conceptsSetUp, runConcept } from '@/lib/concept-maker';
import { cleanBrief, CODE_RE, type ConceptData, type ConceptRow } from '@/lib/concept-plan';

/* Design with Claude in the Job Kit, behind the PIN (src/lib/concept-maker.ts, src/app/job-kit/concepts.tsx).
   { action: 'list' }                       every design of the last 180 days
   { action: 'get', id }                    one
   { action: 'draw', id, brief, note? }     Claude draws it (after the answer, so the phone isn't kept waiting):
                                            { state: 'working' }, or 'working' already under way. With a note and a
                                            drawing already there, the note is a change to that drawing.
   { action: 'edit', id, edits, at }        Raf's changes (prices, what the customer's page shows, live) */
export const maxDuration = 120;

/* The PIN only (the Job Kit's own guard also wants the GitHub token, which previews haven't got), so Design with
   Claude can be tried on a preview with the real Claude key and store. */
async function pinGuard(req: Request): Promise<Response | null> {
  if (!process.env.JOBKIT_PIN) return Response.json({ error: 'not-set-up' }, { status: 503 });
  if (!pinOk(req.headers.get('x-job-kit-pin'))) {
    await new Promise((r) => setTimeout(r, 700));
    return Response.json({ error: 'wrong-pin' }, { status: 401 });
  }
  return null;
}

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  if (!conceptsSetUp()) return Response.json({ error: 'concepts-not-set-up' }, { status: 503, headers: noStore });
  const raw = await req.text();
  if (raw.length > 60_000) return Response.json({ error: 'too-big' }, { status: 413, headers: noStore });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  const id = typeof body.id === 'string' && CODE_RE.test(body.id) ? body.id : '';
  try {
    switch (body.action) {
      case 'list':
        return Response.json(await conceptsRpc('list'), { headers: noStore });
      case 'get':
        if (!id) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        return Response.json({ concept: await conceptsRpc('get', { id }) }, { headers: noStore });
      case 'draw': {
        if (!id) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        const brief = cleanBrief(body.brief);
        const note = typeof body.note === 'string' ? body.note.replace(/\r\n?/g, '\n').trim().slice(0, 800) : '';
        if (!brief.want && !brief.width && !(brief.photos ?? []).length) return Response.json({ error: 'no-text' }, { status: 400, headers: noStore });
        const now = (await conceptsRpc('get', { id }).catch(() => null)) as ConceptRow | null;
        const current = note && now?.data?.plan ? now.data.plan : undefined;
        const data: ConceptData = { brief };
        const c = (await conceptsRpc('start', { id, data })) as { ok?: boolean; state?: string };
        if (!c.ok) return Response.json({ state: c.state ?? 'working' }, { headers: noStore });
        after(() => runConcept(id, data, note, current));
        return Response.json({ state: 'working' }, { headers: noStore });
      }
      case 'edit': {
        const edits = body.edits && typeof body.edits === 'object' && !Array.isArray(body.edits) ? (body.edits as Record<string, unknown>) : null;
        if (!id || !edits) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        const at = typeof body.at === 'number' && Number.isSafeInteger(body.at) && body.at > 0 ? body.at : Date.now();
        return Response.json(await conceptsRpc('edit', { id, edits, at }), { headers: noStore });
      }
    }
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'sync-down';
    if (!(e instanceof SyncError)) console.error('job-kit concept', e);
    return Response.json({ error: code }, { status: code === 'sync-bad' ? 400 : 502, headers: noStore });
  }
}
