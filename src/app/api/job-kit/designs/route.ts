import { guard } from '@/lib/job-kit-server';
import { getAllDesigns, type LibraryDesign } from '@/lib/designs';

/* The Job Kit's Designs screen and Design library, behind the PIN because the codes are what keep the pages
   private:
   ready    which design requests have a page yet, and the version each one answers
   library  every customer design (not the example), newest first, for sending to someone who wants something
            similar: code, title, area, when, option names, the first option's still, and words to search by */

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  const all = getAllDesigns();
  const ready: Record<string, { code: string; title: string; updatedFor: string }> = {};
  for (const d of all) {
    if (!d.request || !d.updatedFor) continue;
    const had = ready[d.request];
    if (!had || Date.parse(d.updatedFor) > Date.parse(had.updatedFor)) ready[d.request] = { code: d.code, title: d.title, updatedFor: d.updatedFor };
  }
  const library: LibraryDesign[] = all
    .filter((d) => !d.example && d.options.length)
    .sort((a, b) => b.made.localeCompare(a.made))
    .map((d) => {
      const p = d.options[0].model.poster;
      return {
        code: d.code,
        title: d.title,
        area: d.area,
        made: d.made,
        options: d.options.length > 1 ? d.options.map((o) => o.name) : [],
        poster: { src: p.src, w: p.w, h: p.h },
        words: [d.title, d.area, d.intro, ...d.options.flatMap((o) => [o.name, o.text, o.model.poster.alt, o.model.title])].filter(Boolean).join(' '),
      };
    });
  return Response.json({ ready, library }, { headers: { 'Cache-Control': 'no-store' } });
}
