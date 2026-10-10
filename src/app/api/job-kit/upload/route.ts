import type { NextRequest } from 'next/server';
import { answer, filePathOk, guard, jobIdOk, MAX_PART, saveFile } from '@/lib/job-kit-server';

export const maxDuration = 60;

/* One photo, or one piece of a clip, from the Job Kit: POST the bytes with
   ?job=<job id>&path=<section/file>&part=<n>&parts=<count>. Pieces are saved as
   "<file>.part02of05" and joined again when the job is processed. */
export async function POST(req: NextRequest) {
  const stop = await guard(req);
  if (stop) return stop;
  const q = req.nextUrl.searchParams;
  const job = q.get('job');
  const path = q.get('path');
  const part = Number(q.get('part') || 1);
  const parts = Number(q.get('parts') || 1);
  if (!jobIdOk(job) || !filePathOk(path) || !Number.isInteger(part) || !Number.isInteger(parts) || parts < 1 || parts > 999 || part < 1 || part > parts) {
    return Response.json({ error: 'bad-request' }, { status: 400 });
  }
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PART) return Response.json({ error: 'bad-size' }, { status: 413 });
  const pad = (n: number) => String(n).padStart(String(parts).length < 2 ? 2 : String(parts).length, '0');
  const file = parts > 1 ? `${path}.part${pad(part)}of${pad(parts)}` : path;
  try {
    await saveFile(job, file, bytes, `Job kit: ${file}`);
    return Response.json({ ok: true });
  } catch (e) {
    return answer(e);
  }
}
