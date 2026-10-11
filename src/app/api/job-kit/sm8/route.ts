import { guard } from '@/lib/job-kit-server';
import { createEnquiry, currentJobs, setStatus, sm8SetUp, Sm8Error, STATUSES, type Status } from '@/lib/servicem8';

/* The Job Kit's Current jobs (ServiceM8), behind the PIN:
   { action: 'list' }                                    open quotes, work orders, jobs finished in the last 30 days
   { action: 'enquiry', name, mobile, email, address, description }   adds the client and a Quote job
   { action: 'status', uuid, status }                    moves a job on (never deletes anything) */
export const maxDuration = 30;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  if (!sm8SetUp()) return Response.json({ error: 'sm8-not-set-up' }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  try {
    if (body.action === 'list') {
      return Response.json({ jobs: await currentJobs(), at: Date.now() }, { headers: noStore });
    }
    if (body.action === 'enquiry') {
      const e = {
        name: text(body.name, 120),
        mobile: text(body.mobile, 40),
        email: text(body.email, 160),
        address: text(body.address, 400),
        description: text(body.description, 4000),
      };
      if (!e.name || !e.description) return Response.json({ error: 'missing' }, { status: 400 });
      return Response.json({ job: await createEnquiry(e) }, { headers: noStore });
    }
    if (body.action === 'status') {
      const uuid = text(body.uuid, 40);
      const status = text(body.status, 20) as Status;
      if (!/^[0-9a-f-]{36}$/i.test(uuid) || !STATUSES.includes(status)) return Response.json({ error: 'bad' }, { status: 400 });
      await setStatus(uuid, status);
      return Response.json({ ok: true }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    if (e instanceof Sm8Error) return Response.json({ error: e.code, detail: e.detail }, { status: e.status });
    console.error('job-kit sm8', e);
    return Response.json({ error: 'sm8-error' }, { status: 502 });
  }
}
