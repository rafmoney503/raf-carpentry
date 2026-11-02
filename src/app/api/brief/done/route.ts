import { after } from 'next/server';
import { sm8SetUp, touchJob } from '@/lib/servicem8';
import { readToken } from '@/lib/brief-token';
import { makeQuote, quotesSetUp } from '@/lib/quote-maker';

/* After the photos: saves the job's status again so ServiceM8 shows the new attachments in its diary
   (ServiceM8 support's workaround for attachments added through the API not showing until the job changes).
   Then, after the answer, Claude reads the brief and its photos for the Job Kit's Quotes (src/lib/quote-maker.ts),
   so a rough quote is often waiting before Raf opens the job. */
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!sm8SetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  let token = '';
  try {
    token = String(((await req.json()) as { token?: unknown }).token ?? '');
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const t = readToken(token);
  if (!t) return Response.json({ error: 'token' }, { status: 403 });
  if (t.n > 0) await touchJob(t.job);
  if (quotesSetUp()) after(() => makeQuote(t.job));
  return Response.json({ ok: true });
}
