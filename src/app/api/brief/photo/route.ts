import { attachPhoto, sm8SetUp, Sm8Error } from '@/lib/servicem8';
import { photoUuid, readToken } from '@/lib/brief-token';

/* One photo for a brief sent with "Send to Raf": multipart { token, i, file }. The token says which job and how
   many photos (/api/brief); photo i always gets the same ServiceM8 uuid, so sending it again is harmless.
   Only JPEGs as the brief makes them on the phone (redrawn, so no GPS or other hidden data), up to 3 MB. */
export const maxDuration = 30;

const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(req: Request) {
  if (!sm8SetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const t = readToken(String(fd.get('token') ?? ''));
  if (!t) return Response.json({ error: 'token' }, { status: 403 });
  const i = Number(fd.get('i'));
  if (!Number.isInteger(i) || i < 0 || i >= t.n) return Response.json({ error: 'number' }, { status: 400 });
  const file = fd.get('file');
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ error: 'size' }, { status: 400 });
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return Response.json({ error: 'type' }, { status: 400 });
  try {
    await attachPhoto(t.job, new Blob([await file.arrayBuffer()], { type: 'image/jpeg' }), `brief-photo-${String(i + 1).padStart(2, '0')}.jpg`, photoUuid(t.job, i));
    return Response.json({ ok: true });
  } catch (e) {
    const code = e instanceof Sm8Error ? e.code : 'error';
    return Response.json({ error: code }, { status: e instanceof Sm8Error && e.status === 429 ? 429 : 502 });
  }
}
