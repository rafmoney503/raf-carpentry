import fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fetchGoogleReviews, sameReviews, FILE } from '@/lib/google-reviews-fetch.mjs';

/* Vercel's cron calls this once a day (vercel.json) with "Authorization: Bearer <CRON_SECRET>". It asks Google for the
   rating, count and reviews and, when they differ from what the site was built with, starts a new build through the
   Vercel deploy hook (VERCEL_DEPLOY_HOOK_URL), whose first step saves the new ones (scripts/google-reviews.mjs).
   ?dry=1 says what it found without building. */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const allowed = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') || '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
};

export async function GET(req: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!process.env.CRON_SECRET || !key) return Response.json({ error: 'not-set-up' }, { status: 503 });
  if (!allowed(req)) return Response.json({ error: 'not-allowed' }, { status: 401 });
  let built = null;
  try {
    built = JSON.parse(fs.readFileSync(path.join(process.cwd(), FILE), 'utf-8'));
  } catch {}
  let now;
  try {
    now = await fetchGoogleReviews(key, { api: process.env.GOOGLE_PLACES_API || undefined });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
  const changed = !sameReviews(built, now);
  const summary = { rating: now.rating, count: now.count, reviews: now.reviews.length, builtWith: built ? { rating: built.rating, count: built.count } : null, changed };
  if (!changed || new URL(req.url).searchParams.get('dry') === '1') return Response.json({ ...summary, rebuilt: false });
  if (!hook) return Response.json({ ...summary, rebuilt: false, error: 'no-deploy-hook' }, { status: 503 });
  const res = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10000) }).catch(() => null);
  return Response.json({ ...summary, rebuilt: !!res?.ok }, { status: res?.ok ? 200 : 502 });
}
