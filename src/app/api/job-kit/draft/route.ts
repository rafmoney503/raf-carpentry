import { guard } from '@/lib/job-kit-server';
import { aiSetUp, draftReply, DraftError, type DraftInput } from '@/lib/draft-reply';

/* The Job Kit's "Draft a reply" (a job's Emails and texts), behind the PIN: Claude writes the next email or text
   from the job and the conversation (src/lib/draft-reply.ts). Answers { text } for the box; nothing is sent or kept. */
export const maxDuration = 30;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  if (!aiSetUp()) return Response.json({ error: 'ai-not-set-up' }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const thread = (Array.isArray(body.thread) ? body.thread : []).slice(-8).map((m) => {
    const r = (m ?? {}) as Record<string, unknown>;
    return { dir: r.dir === 'in' ? 'in' : 'out', via: r.via === 'sms' ? 'sms' : 'email', subject: text(r.subject, 200), text: text(r.text, 2000) } as DraftInput['thread'][number];
  });
  const input: DraftInput = {
    mode: body.mode === 'sms' ? 'sms' : 'email',
    first: text(body.first, 40),
    what: text(body.what, 120),
    status: text(body.status, 20),
    area: text(body.area, 60),
    description: text(body.description, 4000),
    thread: thread.filter((m) => m.text),
    note: text(body.note, 600),
    name: text(body.name, 120),
  };
  try {
    return Response.json({ text: await draftReply(input) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof DraftError) return Response.json({ error: e.code, detail: e.detail }, { status: e.code === 'ai-busy' ? 503 : 502 });
    console.error('job-kit draft', e);
    return Response.json({ error: 'ai-error' }, { status: 502 });
  }
}
