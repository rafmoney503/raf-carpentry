import { pinGuard } from '@/lib/job-kit-server';
import { readReceipt, ReceiptError, receiptsSetUp, type ReceiptFile } from '@/lib/receipt-reader';
import { attachFile, sm8SetUp, Sm8Error, touchJob } from '@/lib/servicem8';
import { attachment, mailFiles, message, OutlookError, outlookSetUp } from '@/lib/outlook';
import { stableUuid } from '@/lib/brief-token';
import { jpegOf, sniff } from '@/lib/photo-jpeg';

/* Receipts for What each job made (src/lib/job-costs.ts), behind the PIN.
   multipart { action: 'read', file }                 a photo (JPEG from the phone) or a PDF, read by Claude: { read }
   { action: 'mail', id }                             a supplier's email in info@: its PDF or photos (else its words)
                                                       read by Claude: { read, files: [{ id, name, type, size }] }
   multipart { action: 'attach', file, job, key, name }  the photo or PDF onto the ServiceM8 job: { uuid }
   { action: 'attach-mail', id, att, job, key, name } one of the email's files onto the ServiceM8 job: { uuid }
   key names the receipt (its cost id), so sending it again is the same ServiceM8 attachment (a 409, counted done).
   The email is never marked read here. */
export const maxDuration = 90;

const MAX_BYTES = 4 * 1024 * 1024;
const noStore = { 'Cache-Control': 'no-store' };
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const keyOk = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
const nameOf = (v: unknown, ext: string) =>
  `${String(v ?? '')
    .replace(/\.[A-Za-z0-9]{2,5}$/, '')
    .replace(/[^\w .,()&'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Receipt'}${ext}`;

function problem(e: unknown) {
  if (e instanceof ReceiptError) return Response.json({ error: e.code, detail: e.detail }, { status: e.code === 'ai-not-set-up' ? 503 : 502, headers: noStore });
  if (e instanceof Sm8Error) return Response.json({ error: e.code, detail: e.detail }, { status: e.status === 429 ? 429 : 502, headers: noStore });
  if (e instanceof OutlookError) return Response.json({ error: e.code, detail: e.detail }, { status: 502, headers: noStore });
  console.error('receipt', e);
  return Response.json({ error: 'error' }, { status: 502, headers: noStore });
}

/* What can be read: JPEG and PNG photos, PDFs (other photos made JPEG). */
async function asReceiptFile(bytes: Uint8Array, name?: string): Promise<ReceiptFile | null> {
  const t = sniff(bytes.slice(0, 16));
  if (t === 'image/jpeg' || t === 'image/png') return { bytes: bytes.length > 3_500_000 ? await jpegOf(bytes, 2000, 82) : bytes, type: t === 'image/png' && bytes.length > 3_500_000 ? 'image/jpeg' : t, name };
  if (t === 'application/pdf') return bytes.length <= 20_000_000 ? { bytes, type: 'application/pdf', name } : null;
  if (t && t.startsWith('image/')) return { bytes: await jpegOf(bytes, 2000, 82), type: 'image/jpeg', name };
  return null;
}

async function onJob(job: string, key: string, file: ReceiptFile, name: string) {
  const ext = file.type === 'application/pdf' ? '.pdf' : '.jpg';
  const bytes = file.type === 'image/png' ? await jpegOf(file.bytes, 2400, 85) : file.bytes;
  const r = await attachFile(job, new Blob([Buffer.from(bytes)], { type: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg' }), nameOf(name, ext), stableUuid(`${job}:receipt:${key}`));
  if (!r.existed) await touchJob(job);
  return r.uuid;
}

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  const multipart = (req.headers.get('content-type') ?? '').includes('multipart/form-data');
  try {
    if (multipart) {
      let fd: FormData;
      try {
        fd = await req.formData();
      } catch {
        return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      }
      const action = String(fd.get('action') ?? '');
      const file = fd.get('file');
      if (!(file instanceof Blob) || !file.size) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      if (file.size > MAX_BYTES) return Response.json({ error: 'too-big' }, { status: 413, headers: noStore });
      const rf = await asReceiptFile(new Uint8Array(await file.arrayBuffer()), String(fd.get('name') ?? ''));
      if (!rf) return Response.json({ error: 'type' }, { status: 400, headers: noStore });
      if (action === 'read') {
        if (!receiptsSetUp()) return Response.json({ error: 'ai-not-set-up' }, { status: 503, headers: noStore });
        return Response.json({ read: await readReceipt([rf]) }, { headers: noStore });
      }
      if (action === 'attach') {
        const job = String(fd.get('job') ?? '');
        const key = String(fd.get('key') ?? '');
        if (!isUuid(job) || !keyOk(key)) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        if (!sm8SetUp()) return Response.json({ error: 'sm8-not-set-up' }, { status: 503, headers: noStore });
        return Response.json({ uuid: await onJob(job, key, rf, String(fd.get('name') ?? '')) }, { headers: noStore });
      }
      return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
    }
    const id = typeof body.id === 'string' && body.id.length > 10 && body.id.length < 400 ? body.id : '';
    if (!id) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
    if (!outlookSetUp()) return Response.json({ error: 'outlook-not-set-up' }, { status: 503, headers: noStore });

    if (body.action === 'mail') {
      if (!receiptsSetUp()) return Response.json({ error: 'ai-not-set-up' }, { status: 503, headers: noStore });
      const [mail, atts] = await Promise.all([message(id, false), mailFiles(id).catch(() => [])]);
      // the receipt itself: PDFs first, then photos that aren't a logo in the signature
      const use = atts
        .filter((a) => a.type === 'application/pdf' || /\.pdf$/i.test(a.name) || (a.type.startsWith('image/') && a.size >= 30_000 && !a.inline))
        .sort((a, b) => Number(b.type === 'application/pdf') - Number(a.type === 'application/pdf'))
        .slice(0, 3);
      const files: ReceiptFile[] = [];
      for (const a of use) {
        const got = await attachment(id, a.id).catch(() => null);
        const rf = got ? await asReceiptFile(got.bytes, a.name) : null;
        if (rf) files.push(rf);
      }
      const words = `From: ${mail.from.name || ''} ${mail.from.email}\nSubject: ${mail.subject}\n\n${mail.full || mail.text}`;
      const read = await readReceipt(files, words);
      return Response.json({ read, files: use.map((a) => ({ id: a.id, name: a.name, type: a.type, size: a.size })) }, { headers: noStore });
    }

    if (body.action === 'attach-mail') {
      const job = typeof body.job === 'string' ? body.job : '';
      const key = typeof body.key === 'string' ? body.key : '';
      const att = typeof body.att === 'string' && body.att.length < 400 ? body.att : '';
      if (!isUuid(job) || !keyOk(key) || !att) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      if (!sm8SetUp()) return Response.json({ error: 'sm8-not-set-up' }, { status: 503, headers: noStore });
      const got = await attachment(id, att);
      const rf = await asReceiptFile(got.bytes, got.name);
      if (!rf) return Response.json({ error: 'type' }, { status: 400, headers: noStore });
      return Response.json({ uuid: await onJob(job, key, rf, String(body.name ?? got.name ?? '')) }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    return problem(e);
  }
}
