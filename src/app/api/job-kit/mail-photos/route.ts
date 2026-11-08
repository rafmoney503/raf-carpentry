import { guard } from '@/lib/job-kit-server';
import { OutlookError, outlookMissing, outlookSetUp } from '@/lib/outlook';
import { sm8SetUp, Sm8Error } from '@/lib/servicem8';
import { addEmailPhotos, emailPhotos } from '@/lib/email-photos';

/* The photos a customer emailed to info@, for their ServiceM8 job (src/lib/email-photos.ts), behind the PIN:
   { action: 'list', job, email, mail? }  their photos in their newest emails, and which are on the job already
   { action: 'add', job, email, mail? }   puts the ones not on the job onto it; answers how many went
   `mail` keeps it to one email (a new enquiry made from it). Nothing is ever taken off the job or out of Outlook. */
export const maxDuration = 60;

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const idOk = (v: string) => /^[A-Za-z0-9+/=_-]{4,400}$/.test(v);
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const job = typeof body.job === 'string' ? body.job.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 160) : '';
  const mail = typeof body.mail === 'string' ? body.mail.trim().slice(0, 400) : '';
  if (!isUuid(job) || (mail && !idOk(mail)) || (!mail && !/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email))) return Response.json({ error: 'bad' }, { status: 400 });
  if (!outlookSetUp()) return Response.json({ error: 'outlook-not-set-up', detail: outlookMissing().join(', ') }, { status: 503 });
  if (!sm8SetUp()) return Response.json({ error: 'sm8-not-set-up' }, { status: 503 });
  try {
    if (body.action === 'list') return Response.json({ photos: await emailPhotos(job, email, mail), at: Date.now() }, { headers: noStore });
    if (body.action === 'add') return Response.json({ ...(await addEmailPhotos(job, email, mail)), at: Date.now() }, { headers: noStore });
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    if (e instanceof OutlookError) return Response.json({ error: e.code, detail: e.detail }, { status: e.status });
    if (e instanceof Sm8Error) return Response.json({ error: e.code, detail: e.detail }, { status: e.status === 429 ? 429 : 502 });
    console.error('job-kit mail-photos', e);
    return Response.json({ error: 'outlook-error' }, { status: 502 });
  }
}
