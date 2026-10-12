import { guard } from '@/lib/job-kit-server';
import { addBooking, cancelBooking, createEnquiry, currentJobs, moveBooking, setStatus, sm8SetUp, Sm8Error, STATUSES, type Status } from '@/lib/servicem8';

/* The Job Kit's Current jobs (ServiceM8), behind the PIN:
   { action: 'list' }                                    open quotes, work orders, jobs finished in the last 30 days,
                                                         the bookings from yesterday on, the staff
   { action: 'enquiry', name, mobile, email, address, description }   adds the client and a Quote job
   { action: 'status', uuid, status }                    moves a job on (never deletes anything)
   { action: 'book', job, start, end, staff? }           adds a booking to ServiceM8's schedule
   { action: 'move', uuid, start, end }                  moves a booking
   { action: 'cancel', uuid }                            cancels a booking (ServiceM8 archives it, restorable)
   Times are London time, "YYYY-MM-DDTHH:MM". */
export const maxDuration = 30;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const noStore = { 'Cache-Control': 'no-store' };
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const isTime = (v: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && Number.isFinite(Date.parse(v));

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
      return Response.json({ ...(await currentJobs()), at: Date.now() }, { headers: noStore });
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
      if (!isUuid(uuid) || !STATUSES.includes(status)) return Response.json({ error: 'bad' }, { status: 400 });
      await setStatus(uuid, status);
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (body.action === 'book' || body.action === 'move') {
      const start = text(body.start, 16);
      const end = text(body.end, 16);
      if (!isTime(start) || !isTime(end) || end <= start) return Response.json({ error: 'bad-time' }, { status: 400 });
      if (body.action === 'book') {
        const job = text(body.job, 40);
        const staff = text(body.staff, 40);
        if (!isUuid(job) || (staff && !isUuid(staff))) return Response.json({ error: 'bad' }, { status: 400 });
        return Response.json({ booking: await addBooking({ jobUuid: job, start, end, staffUuid: staff || undefined }) }, { headers: noStore });
      }
      const uuid = text(body.uuid, 40);
      if (!isUuid(uuid)) return Response.json({ error: 'bad' }, { status: 400 });
      await moveBooking(uuid, start, end);
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (body.action === 'cancel') {
      const uuid = text(body.uuid, 40);
      if (!isUuid(uuid)) return Response.json({ error: 'bad' }, { status: 400 });
      await cancelBooking(uuid);
      return Response.json({ ok: true }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    if (e instanceof Sm8Error) return Response.json({ error: e.code, detail: e.detail }, { status: e.status });
    console.error('job-kit sm8', e);
    return Response.json({ error: 'sm8-error' }, { status: 502 });
  }
}
