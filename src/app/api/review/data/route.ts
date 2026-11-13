import { timingSafeEqual } from 'node:crypto';
import { reviewDayData } from '@/lib/reviewdata';
import { addDays, londonDay } from '@/lib/time';

/* The daily review on rafcarpentry.com asks here for one London day's numbers from Vercel (each site's visitors,
   sources, pages, what went live) and whether each site is up. GET ?day=YYYY-MM-DD with
   Authorization: Bearer HQ_NOTIFY_SECRET (the same secret the Job Kit's buzz uses). Outside the sign-in. */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.HQ_NOTIFY_SECRET ?? '';
  const want = `Bearer ${secret}`;
  const got = req.headers.get('authorization') ?? '';
  return secret.length >= 24 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(req: Request) {
  if (!authorised(req)) return Response.json({ error: 'no' }, { status: 401 });
  const today = londonDay();
  const asked = new URL(req.url).searchParams.get('day') ?? '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today && asked >= addDays(today, -60) ? asked : addDays(today, -1);
  return Response.json(await reviewDayData(day), { headers: { 'Cache-Control': 'no-store' } });
}
