import { dbReady } from '@/lib/db';
import { linkedinPut } from '@/lib/linkedin';
import { LI_FIELDS, type LiKey } from '@/lib/linkedin-types';

/* Today's LinkedIn numbers, typed in on Today (behind the sign-in). Answers the list as it is now. */

export async function POST(req: Request) {
  if (!dbReady()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ error: 'bad' }, { status: 400 });
  const values: Partial<Record<LiKey, number>> = {};
  for (const { key } of LI_FIELDS) {
    const v = b[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10_000_000) return Response.json({ error: 'bad', field: key }, { status: 400 });
    values[key] = v;
  }
  if (!Object.keys(values).length) return Response.json({ error: 'empty' }, { status: 400 });
  try {
    const list = await linkedinPut(values);
    if (!list) return Response.json({ error: 'missing' }, { status: 503 });
    return Response.json({ list });
  } catch (e) {
    if (e instanceof Error && e.message === 'bad') return Response.json({ error: 'bad' }, { status: 400 });
    return Response.json({ error: 'db' }, { status: 502 });
  }
}
