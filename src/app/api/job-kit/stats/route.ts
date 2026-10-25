import { guard } from '@/lib/job-kit-server';
import { StatsError, statsRpc, statsSetUp } from '@/lib/site-stats-server';
import { getAllPosts } from '@/lib/blog';
import { getAllProjects } from '@/lib/projects';
import { formatOf, topicOf, type BlogPostMeta } from '@/lib/blog-stats';
import type { CardTaps } from '@/lib/site-stats';

/* Every post with its topic (the job it tells the story of, or its words) and format, for Blog stats. */
function blogPosts(): BlogPostMeta[] {
  const jobType = new Map(getAllProjects().map((p) => [p.blogSlug || p.slug, p.type]));
  return getAllPosts().map((p) => ({
    slug: p.slug,
    title: p.title,
    date: (() => {
      const d = p.date as unknown;
      const t = d instanceof Date ? d : new Date(String(d));
      return Number.isFinite(t.getTime()) ? t.toISOString().slice(0, 10) : '';
    })(),
    category: p.category,
    topic: topicOf(p.slug, p.title, jobType.get(p.slug)),
    format: formatOf(p.category),
  }));
}

/* The Job Kit's Website stats screen (src/app/job-kit/stats.tsx), behind the PIN.
   { action: 'report', days }                  the numbers, sources, pages and journeys for the last `days` days, plus
                                               `cutlist`: who asked for the wardrobe planner's cut list (rafsite_cutlist),
                                               `cards`: taps on the small card bottom left, by what it suggested
   { action: 'page', path, device?, days }     one page: taps, how far down people got, time, where they came from and went
   { action: 'blog', days }                    every read of a blog post (rafsite_blog) and every post with its topic */
export const maxDuration = 20;

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  if (!statsSetUp()) return Response.json({ error: 'stats-not-set-up' }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const days = Math.max(1, Math.min(400, Math.floor(Number(body.days) || 30)));
  try {
    if (body.action === 'report') {
      // the planner's cut list button: who asked (best effort, the numbers come without it)
      // and the small card bottom left: which suggestions were tapped (rafsite_cards), with the posts' titles
      const [report, cutlist, cards] = await Promise.all([
        statsRpc('rafsite_report', { p_days: days }),
        statsRpc('rafsite_cutlist', { p_action: 'list', p: { days } }).catch(() => null),
        statsRpc('rafsite_cards', { p_days: days })
          .then((c) => {
            const card = c as CardTaps | null;
            if (!card?.posts) return card;
            const titles = new Map(getAllPosts().map((p) => [p.slug, p.title]));
            return { ...card, posts: card.posts.map((p) => ({ ...p, title: titles.get(p.slug) })) };
          })
          .catch(() => null),
      ]);
      return Response.json({ report, cutlist, cards, at: Date.now() }, { headers: noStore });
    }
    if (body.action === 'blog') {
      return Response.json({ blog: await statsRpc('rafsite_blog', { p_days: days }), posts: blogPosts(), at: Date.now() }, { headers: noStore });
    }
    if (body.action === 'page') {
      const path = typeof body.path === 'string' ? body.path.slice(0, 200) : '';
      if (!/^\/[\w\-./~%@]*$/.test(path)) return Response.json({ error: 'bad' }, { status: 400 });
      const device = body.device === 'phone' || body.device === 'tablet' || body.device === 'computer' ? body.device : null;
      return Response.json({ page: await statsRpc('rafsite_page', { p_path: path, p_device: device, p_days: days }), at: Date.now() }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    const code = e instanceof StatsError ? e.code : 'stats-down';
    return Response.json({ error: code }, { status: 502, headers: noStore });
  }
}
