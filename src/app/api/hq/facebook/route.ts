import { timingSafeEqual } from 'crypto';
import { pageReport } from '@/lib/meta-social';

/* Rafal Solutions HQ asks here for one Facebook Page's progress (its Facebook section, 15 Nov 2026): the Page's
   followers and their days, its latest posts with reactions, comments and shares, and the comments not answered yet.
   GET ?name=Cabinet OS with Authorization: Bearer HQ_NOTIFY_SECRET (the secret HQ and the Job Kit already share).
   Only reads, through the Pages connected on the Job Kit's Social screen (src/lib/meta-social.ts pageReport). */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function authorised(req: Request): boolean {
  const secret = process.env.HQ_NOTIFY_SECRET ?? '';
  const want = `Bearer ${secret}`;
  const got = req.headers.get('authorization') ?? '';
  return secret.length >= 24 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(req: Request) {
  if (!authorised(req)) return Response.json({ error: 'no' }, { status: 401 });
  const name = (new URL(req.url).searchParams.get('name') ?? 'Cabinet OS').trim();
  if (!/^[\p{L}\p{N} .&'-]{2,60}$/u.test(name)) return Response.json({ error: 'name' }, { status: 400 });
  return Response.json(await pageReport(name), { headers: { 'Cache-Control': 'no-store' } });
}
