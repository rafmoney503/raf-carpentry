import { timingSafeEqual } from 'node:crypto';
import { dbReady, hqApi, type PushSub } from '@/lib/db';
import { morningNotes } from '@/lib/morning';
import { pushReady, sendTo } from '@/lib/push';
import { getReport } from '@/lib/report';
import { londonDay, londonHour } from '@/lib/time';

/* The morning summary. Vercel calls this at 06:43 and 07:43 UTC (vercel.json); it sends only in the run that is
   07:43 in London, once a day (hq.sent). ?force=1 sends now (still needs the secret). */
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const want = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  const got = req.headers.get('authorization') ?? '';
  return Boolean(process.env.CRON_SECRET) && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(req: Request) {
  if (!authorised(req)) return Response.json({ error: 'no' }, { status: 401 });
  if (!dbReady() || !pushReady()) return Response.json({ skipped: 'not-set-up' });
  const force = new URL(req.url).searchParams.get('force') === '1';
  const now = new Date();
  if (!force && londonHour(now) !== 7) return Response.json({ skipped: 'not-7am-in-london' });

  const last = await hqApi<{ day: string; at: string } | null>('last_sent').catch(() => null);
  const day = londonDay(now);
  if (!force) {
    const claim = await hqApi<{ claimed: boolean }>('claim_day', { day, body: { at: now.toISOString() } });
    if (!claim.claimed) return Response.json({ skipped: 'already-sent' });
  }
  const r = await getReport(true);
  const since = last?.at ? new Date(last.at).getTime() : now.getTime() - 24 * 3600 * 1000;
  const notes = morningNotes(r, since);
  const subs = await hqApi<PushSub[]>('push_list');
  const out = subs.length ? await sendTo(subs, notes) : { sent: 0, failed: 0 };
  return Response.json({ day, notes: notes.length, ...out });
}
