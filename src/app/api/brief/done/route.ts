import { sm8SetUp, touchJob } from '@/lib/servicem8';
import { readToken } from '@/lib/brief-token';

/* After the photos: saves the job's status again so ServiceM8 shows the new attachments in its diary
   (ServiceM8 support's workaround for attachments added through the API not showing until the job changes). */
export const maxDuration = 20;

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
  return Response.json({ ok: true });
}
