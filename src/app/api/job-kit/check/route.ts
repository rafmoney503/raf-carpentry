import { answer, checkInbox, guard } from '@/lib/job-kit-server';

/* The Job Kit's "Check" button: right PIN, and the inbox is there and can be written to. */
export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  try {
    const inbox = await checkInbox();
    if (!inbox.canWrite) return Response.json({ error: 'inbox-key' }, { status: 502 });
    return Response.json({ ok: true, private: inbox.private });
  } catch (e) {
    return answer(e);
  }
}
