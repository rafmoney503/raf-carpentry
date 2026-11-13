import { dbReady } from '@/lib/db';
import { forgetReport } from '@/lib/report';
import { reviewMark } from '@/lib/review';
import { MARKS } from '@/lib/review-types';

/* An idea of the daily review marked from HQ: POST { id, status } (new, doing, done or no). Behind the sign-in. */
const ID = /^\d{4}-\d{2}-\d{2}:[a-z0-9]{2,20}:\d{1,2}$/;

export async function POST(req: Request) {
  if (!dbReady()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const b = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
  const id = typeof b?.id === 'string' && ID.test(b.id) ? b.id : '';
  const status = MARKS.includes(b?.status as never) ? (b!.status as string) : '';
  if (!id || !status) return Response.json({ error: 'bad' }, { status: 400 });
  try {
    const mark = await reviewMark(id, status);
    forgetReport();
    return Response.json({ id, mark });
  } catch {
    return Response.json({ error: 'db' }, { status: 502 });
  }
}
