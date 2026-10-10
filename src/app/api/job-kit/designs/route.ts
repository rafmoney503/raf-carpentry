import { guard } from '@/lib/job-kit-server';
import { getAllDesigns } from '@/lib/designs';

/* The Job Kit's Designs screen: which design requests have a page yet, and the version each one answers.
   Behind the PIN, because the codes are what keep the pages private. */
export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  const ready: Record<string, { code: string; title: string; updatedFor: string }> = {};
  for (const d of getAllDesigns()) {
    if (!d.request || !d.updatedFor) continue;
    const had = ready[d.request];
    if (!had || Date.parse(d.updatedFor) > Date.parse(had.updatedFor)) ready[d.request] = { code: d.code, title: d.title, updatedFor: d.updatedFor };
  }
  return Response.json({ ready }, { headers: { 'Cache-Control': 'no-store' } });
}
