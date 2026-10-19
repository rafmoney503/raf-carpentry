import { guard } from '@/lib/job-kit-server';
import { attachPhoto, sm8SetUp, Sm8Error } from '@/lib/servicem8';
import { stableUuid } from '@/lib/brief-token';

/* A photo or drawing for a ServiceM8 job from the Job Kit (a WhatsApp chat's pictures), behind the PIN:
   multipart { job, file, name, key }. Photos come redrawn on the phone as JPEG (no GPS or other hidden data);
   PDFs (drawings, plans) go as they are. Up to 4 MB, under Vercel's 4.5 MB limit for a request. `key` names the file
   for this job (the chat and the file's name in it), so sending it again gets the same ServiceM8 uuid: a 409,
   counted as done, never a second copy. Afterwards the phone asks /api/job-kit/sm8 { action: 'touch' } so the
   attachments show in the job's diary. */
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  if (!sm8SetUp()) return Response.json({ error: 'sm8-not-set-up' }, { status: 503 });
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const job = String(fd.get('job') ?? '');
  const key = String(fd.get('key') ?? '').slice(0, 200);
  const file = fd.get('file');
  if (!isUuid(job) || !key) return Response.json({ error: 'bad' }, { status: 400 });
  if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: 'bad' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'too-big' }, { status: 413 });
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const pdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  if (!jpeg && !pdf) return Response.json({ error: 'type' }, { status: 400 });
  const ext = jpeg ? '.jpg' : '.pdf';
  const base = String(fd.get('name') ?? '')
    .replace(/\.[A-Za-z0-9]{2,5}$/, '')
    .replace(/[^\w .()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const name = `${base || 'WhatsApp'}${ext}`;
  try {
    await attachPhoto(job, new Blob([await file.arrayBuffer()], { type: jpeg ? 'image/jpeg' : 'application/pdf' }), name, stableUuid(`${job}:wa:${key}`));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Sm8Error) return Response.json({ error: e.code, detail: e.detail }, { status: e.status === 429 ? 429 : 502 });
    return Response.json({ error: 'error' }, { status: 502 });
  }
}
