import { after } from 'next/server';
import { pinGuard } from '@/lib/job-kit-server';
import { SyncError } from '@/lib/job-kit-sync-server';
import { assistantRpc, assistantSetUp, runAssistant } from '@/lib/assistant';
import { settingsOf } from '@/lib/assistant-types';

/* The Job Kit's Assistant box, behind the PIN (src/app/job-kit/assistant.tsx).
   { action: 'list', days? }           what it found and did, Raf's switches, when he last looked, the runs
   { action: 'seen', at }              Raf has looked (the box stops calling them new)
   { action: 'settings', settings }    his switches: paused, jobs from emails, drawings
   { action: 'run' }                   Check now: a run after the answer ({ state: 'started' }, or 'busy') */
export const maxDuration = 300;

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  if (!assistantSetUp()) return Response.json({ error: 'assistant-not-set-up' }, { status: 503, headers: noStore });
  const raw = await req.text();
  if (raw.length > 4000) return Response.json({ error: 'too-big' }, { status: 413, headers: noStore });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  try {
    switch (body.action) {
      case 'list': {
        const days = typeof body.days === 'number' ? Math.min(90, Math.max(1, Math.round(body.days))) : 14;
        const r = (await assistantRpc('list', { days })) as Record<string, unknown>;
        return Response.json({ ...r, settings: settingsOf(r.settings) }, { headers: noStore });
      }
      case 'seen': {
        const at = typeof body.at === 'number' && Number.isSafeInteger(body.at) && body.at > 0 ? body.at : Date.now();
        return Response.json(await assistantRpc('seen', { at }), { headers: noStore });
      }
      case 'settings': {
        const s = body.settings && typeof body.settings === 'object' ? (body.settings as Record<string, unknown>) : null;
        if (!s) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        const keep: Record<string, boolean> = {};
        for (const k of ['paused', 'jobsFromEmail', 'drawings']) if (typeof s[k] === 'boolean') keep[k] = s[k] as boolean;
        const r = (await assistantRpc('settings', { settings: keep })) as Record<string, unknown>;
        return Response.json({ settings: settingsOf(r.settings) }, { headers: noStore });
      }
      case 'run': {
        const claim = (await assistantRpc('list', { days: 1 })) as { run?: { running?: boolean; updated?: number } };
        if (claim.run?.running && Date.now() - (claim.run.updated ?? 0) < 6 * 60e3) return Response.json({ state: 'busy' }, { headers: noStore });
        after(() => runAssistant('now').catch((e) => console.error('assistant now', e)));
        return Response.json({ state: 'started' }, { headers: noStore });
      }
    }
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'sync-down';
    if (!(e instanceof SyncError)) console.error('job-kit assistant', e);
    return Response.json({ error: code }, { status: code === 'sync-bad' ? 400 : 502, headers: noStore });
  }
}
