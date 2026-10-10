import { answer, guard, jobIdOk, saveFile } from '@/lib/job-kit-server';

export const maxDuration = 30;

/* The job's details from the Job Kit: job.json (what, where, sizes, notes and the list of every photo
   and clip with its slot) and the same notes as notes.txt, in the job folder's usual shape.
   Sent again whenever they change; `ready` is set when Raf presses "Send to Claude". */
export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  const text = await req.text();
  if (text.length > 400_000) return Response.json({ error: 'bad-size' }, { status: 413 });
  let body: { job?: { id?: string; ready?: boolean }; notesTxt?: string };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: 'bad-request' }, { status: 400 });
  }
  const id = body.job?.id ?? null;
  if (!jobIdOk(id) || typeof body.notesTxt !== 'string') return Response.json({ error: 'bad-request' }, { status: 400 });
  try {
    await saveFile(id, 'notes.txt', Buffer.from(body.notesTxt, 'utf-8'), 'Job kit: notes');
    await saveFile(id, 'job.json', Buffer.from(JSON.stringify(body.job, null, 2), 'utf-8'), body.job?.ready ? 'Job kit: sent to Claude' : 'Job kit: details');
    return Response.json({ ok: true });
  } catch (e) {
    return answer(e);
  }
}
