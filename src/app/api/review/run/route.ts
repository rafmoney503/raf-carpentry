import { timingSafeEqual } from 'node:crypto';
import { after } from 'next/server';
import { reviewSetUp, runReview } from '@/lib/review-writer';

/* The daily review (src/lib/review-writer.ts), once a morning: Supabase pg_cron posts here through pg_net with
   "Authorization: Bearer <ASSISTANT_SECRET>" (Vault: assistant_run_secret) at 06:05 and 06:35 UTC; the second only
   writes if the first didn't. It answers at once and writes after the answer. Body (optional): { day, force }. */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const allowed = (req: Request) => {
  const secret = process.env.ASSISTANT_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') || '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
};

export async function POST(req: Request) {
  if (!process.env.ASSISTANT_SECRET) return Response.json({ error: 'not-set-up' }, { status: 503 });
  if (!allowed(req)) return Response.json({ error: 'not-allowed' }, { status: 401 });
  if (!reviewSetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { day?: unknown; force?: unknown };
  const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : undefined;
  after(() => runReview({ day, force: body.force === true, why: 'cron' }).catch((e) => console.error('review cron', e)));
  return Response.json({ state: 'started' }, { status: 202 });
}
