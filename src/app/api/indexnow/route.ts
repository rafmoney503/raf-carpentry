import { timingSafeEqual } from 'node:crypto';
import { runIndexNow } from '@/lib/indexnow';

/* Vercel's cron calls this once a day (vercel.json) with "Authorization: Bearer <CRON_SECRET>". The same request by
   hand runs it at any time; ?dry=1 shows what would be sent, ?all=1 sends every page. See src/lib/indexnow.ts. */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const allowed = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') || '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
};

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'not-set-up' }, { status: 503 });
  if (!allowed(req)) return Response.json({ error: 'not-allowed' }, { status: 401 });
  const q = new URL(req.url).searchParams;
  try {
    const run = await runIndexNow({ all: q.get('all') === '1', dry: q.get('dry') === '1' });
    return Response.json(run);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: msg === 'not-set-up' ? 503 : 502 });
  }
}
