import { after } from 'next/server';
import { pinGuard } from '@/lib/job-kit-server';
import { SyncError } from '@/lib/job-kit-sync-server';
import { reviewRpc, reviewSetUp, runReview, yesterday } from '@/lib/review-writer';
import { MARKS } from '@/lib/review-types';

/* The Job Kit's daily review (src/app/job-kit/review.tsx), behind the PIN.
   { action: 'list', days? }                the last reviews and how each idea is marked
   { action: 'mark', id, status, note? }   an idea: new, doing (I'll do it), done or no (not for me)
   { action: 'run', day?, force? }         write it now (or again): after the answer, { state: 'started' } */
export const maxDuration = 300;

const noStore = { 'Cache-Control': 'no-store' };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d{4}-\d{2}-\d{2}:[a-z0-9]{2,20}:\d{1,2}$/;

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  if (!reviewSetUp()) return Response.json({ error: 'review-not-set-up' }, { status: 503, headers: noStore });
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
        const days = typeof body.days === 'number' ? Math.min(60, Math.max(1, Math.round(body.days))) : 14;
        return Response.json({ ...((await reviewRpc('list', { days })) as object), yesterday: yesterday() }, { headers: noStore });
      }
      case 'mark': {
        const id = typeof body.id === 'string' && ID.test(body.id) ? body.id : '';
        const status = MARKS.includes(body.status as never) ? body.status : '';
        if (!id || !status) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        const note = typeof body.note === 'string' ? body.note.slice(0, 300) : '';
        return Response.json({ id, mark: await reviewRpc('mark', { id, status, note, by: 'jobkit' }) }, { headers: noStore });
      }
      case 'run': {
        const day = typeof body.day === 'string' && DAY.test(body.day) ? body.day : yesterday();
        const got = (await reviewRpc('get', { day })) as { state?: string; at?: string } | null;
        if (got?.state === 'working' && Date.now() - Date.parse(got.at ?? '') < 6 * 60e3) return Response.json({ state: 'busy', day }, { headers: noStore });
        after(() => runReview({ day, force: body.force === true, why: 'asked' }).catch((e) => console.error('review asked', e)));
        return Response.json({ state: 'started', day }, { headers: noStore });
      }
    }
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'sync-down';
    if (!(e instanceof SyncError)) console.error('job-kit review', e);
    return Response.json({ error: code }, { status: code === 'sync-bad' ? 400 : 502, headers: noStore });
  }
}
