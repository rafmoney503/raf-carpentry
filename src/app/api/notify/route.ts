import { timingSafeEqual } from 'node:crypto';
import { cleanNotes } from '@/lib/assistant';
import { dbReady, hqApi, type PushSub } from '@/lib/db';
import { pushReady, sendTo } from '@/lib/push';

/* A buzz from another app, sent to the phones that turned HQ's notifications on (Alerts). Today only the Job Kit
   assistant on rafcarpentry.com uses it, for new enquiries (it keeps quiet from 21:30 to 7:00 itself).
   POST { from, notes: [{ title, body, tag }] } with Authorization: Bearer HQ_NOTIFY_SECRET. Tapping it opens Today. */
export const maxDuration = 30;

function authorised(req: Request): boolean {
  const secret = process.env.HQ_NOTIFY_SECRET ?? '';
  const want = `Bearer ${secret}`;
  const got = req.headers.get('authorization') ?? '';
  return secret.length >= 24 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function POST(req: Request) {
  if (!authorised(req)) return Response.json({ error: 'no' }, { status: 401 });
  if (!dbReady() || !pushReady()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const notes = cleanNotes(await req.json().catch(() => null));
  if (!notes) return Response.json({ error: 'bad-notes' }, { status: 400 });
  const subs = await hqApi<PushSub[]>('push_list');
  const out = subs.length ? await sendTo(subs, notes.map((n) => ({ ...n, url: '/' }))) : { sent: 0, failed: 0 };
  return Response.json({ ok: true, phones: subs.length, ...out });
}
