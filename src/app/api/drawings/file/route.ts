import { sm8SetUp, Sm8Error } from '@/lib/servicem8';
import { addOrderFile, OrderError } from '@/lib/drawings-order';

/* Drawings service, step 2: one file onto the order's job, multipart { token, i, file, name }. Up to 4 MB (photos are
   made smaller on the phone first); file i always gets the same ServiceM8 uuid, so sending it again is harmless. */
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!sm8SetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const file = fd.get('file');
  if (!(file instanceof Blob)) return Response.json({ error: 'size' }, { status: 400 });
  try {
    await addOrderFile(fd.get('token'), Number(fd.get('i')), file, String(fd.get('name') ?? (file as File).name ?? 'file'));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.code }, { status: e.status });
    const code = e instanceof Sm8Error ? e.code : 'error';
    return Response.json({ error: code }, { status: e instanceof Sm8Error && e.status === 429 ? 429 : 502 });
  }
}
