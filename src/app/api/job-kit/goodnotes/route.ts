import { guard } from '@/lib/job-kit-server';
import { GnError, notebookFile, notebookLink, notebookPages, notebooks, notebookThumb } from '@/lib/goodnotes';
import { attachName, cleanPages, pagesSlug } from '@/lib/goodnotes-match';
import { attachFile, sm8SetUp, Sm8Error, touchJob } from '@/lib/servicem8';
import { stableUuid } from '@/lib/brief-token';

/* Goodnotes notebooks on the Job Kit's job cards (src/lib/goodnotes.ts), behind the PIN:
   { action: 'list', fresh? }     every notebook PDF in the OneDrive backup folder: { notebooks, at }
   { action: 'thumb', id }        a small picture of the first page (image bytes)
   { action: 'open', id }         a short-lived link the phone fetches the PDF from: { url, name, size, at }
   { action: 'pdf', id }          the PDF through here instead (up to 4 MB), if the phone couldn't use that link
   { action: 'pages', id, pages } some pages as a PDF of their own (up to 4 MB), so a job's pages open without the phone
                                  downloading the whole notebook (4 Nov 2026: one notebook for the year, a job a page)
   { action: 'attach', id, job, pages? }
                                  the PDF onto the ServiceM8 job ('Goodnotes - <name>.pdf'), or only those pages
                                  ('Goodnotes - <name> p14-15.pdf'); the same version twice is one attachment (its uuid
                                  comes from the notebook and when it last changed, or from what's on those pages):
                                  { uuid, at, same } */
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function fail(e: unknown) {
  if (e instanceof GnError) return Response.json({ error: e.code, detail: e.detail.slice(0, 200) }, { status: e.status, headers: noStore });
  if (e instanceof Sm8Error) return Response.json({ error: e.code, detail: (e.detail ?? '').slice(0, 200) }, { status: e.status, headers: noStore });
  return Response.json({ error: 'gn-error' }, { status: 502, headers: noStore });
}

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  const id = text(body.id, 120);
  try {
    if (body.action === 'list') {
      const list = await notebooks(body.fresh === true);
      return Response.json({ notebooks: list, at: Date.now() }, { headers: noStore });
    }
    if (body.action === 'thumb') {
      const t = await notebookThumb(id);
      return new Response(t.bytes, { headers: { 'content-type': t.type, 'Cache-Control': 'private, max-age=600' } });
    }
    if (body.action === 'open') {
      return Response.json(await notebookLink(id), { headers: noStore });
    }
    if (body.action === 'pdf') {
      // the PDF through here, for a phone that can't fetch OneDrive's link itself (a Vercel answer stops at 4.5 MB)
      const f = await notebookFile(id, 4 * 1048576);
      return new Response(f.blob, { headers: { 'content-type': 'application/pdf', 'Cache-Control': 'private, no-store' } });
    }
    const pages = cleanPages(body.pages);
    if (body.action === 'pages') {
      if (!pages.length) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      const f = await notebookPages(id, pages);
      if (f.blob.size > 4 * 1048576) throw new GnError('gn-too-big', 413, `${f.blob.size}`);
      return new Response(f.blob, { headers: { 'content-type': 'application/pdf', 'Cache-Control': 'private, no-store', 'x-gn-count': String(f.count), 'x-gn-at': f.at } });
    }
    if (body.action === 'attach') {
      const job = text(body.job, 40);
      if (!isUuid(job)) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      if (Array.isArray(body.pages) && !pages.length) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      if (!sm8SetUp()) return Response.json({ error: 'sm8-not-set-up' }, { status: 503, headers: noStore });
      if (pages.length) {
        // only those pages; the uuid comes from what's on them, so sending them again unchanged adds nothing
        const f = await notebookPages(id, pages);
        const r = await attachFile(job, f.blob, attachName(f, pages), stableUuid(`goodnotes|${job}|${id}|${pagesSlug(pages)}|${f.hash}`));
        if (!r.existed) await touchJob(job);
        return Response.json({ uuid: r.uuid, at: f.at, same: r.existed }, { headers: noStore });
      }
      const f = await notebookFile(id);
      const r = await attachFile(job, f.blob, attachName(f), stableUuid(`goodnotes|${job}|${id}|${f.at}`));
      await touchJob(job);
      return Response.json({ uuid: r.uuid, at: f.at, same: r.existed }, { headers: noStore });
    }
  } catch (e) {
    return fail(e);
  }
  return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
}
