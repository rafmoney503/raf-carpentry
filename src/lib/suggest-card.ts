import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getAllProjects } from './projects';
import { areaPages } from './areas';

/* What the small card bottom left (src/components/RecentDesign.tsx) may suggest on each page (25 Oct 2026, Raf:
   'suggest new visitor to check workshop tool or blog discretely'). Made at deploy time as /card-index.json and
   fetched only when the card is about to show (20 s into a visit).

   - trade: pages carpenters and DIYers read (tools, tips, CabinetOS, SketchUp and the trade blog posts): the Workshop
     Tools app, once per browser.
   - pages: the blog posts to suggest there, first one not read yet: a job page gets the post that tells that job's
     story (and the PAX guides on a PAX job), the wardrobe service, 3D wardrobes and area pages the PAX guides (the
     posts ChatGPT sends people to), a PAX post the other PAX guides.
   Anywhere else the card shows a job someone really looked at lately, as before. */

export const PAX_GUIDES = ['ikea-pax-or-made-to-measure-wardrobe', 'ikea-pax-height-for-your-ceiling', 'fitting-ikea-pax-wall-to-wall'];
const TRADE_PAGES = ['/tools', '/tips', '/cabinetos', '/sketchup'];
const TRADE_CATEGORIES = /^(sketchup|cabinetos)$/i;
const WARDROBE_PAGES = ['/services/fitted-wardrobes', '/designs/wardrobes'];

export type CardPost = {
  /** title */
  t: string;
  /** its main photo */
  img?: string;
  /** minutes to read */
  m: number;
  /** a job's story or a guide */
  k: 'job' | 'guide';
};
export type CardIndex = { v: 1; posts: Record<string, CardPost>; pages: Record<string, string[]>; trade: string[] };

const postsDir = path.join(process.cwd(), 'content/blog');

function readPosts() {
  if (!fs.existsSync(postsDir)) return [];
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(postsDir, f), 'utf-8'));
      // words as read: no image addresses, links' addresses or markdown marks
      const words = content
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\]\([^)]*\)/g, ']')
        .replace(/[#*_>`[\]|-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length;
      return {
        slug: f.replace(/\.md$/, ''),
        title: String(data.title || f),
        image: typeof data.image === 'string' ? data.image : undefined,
        category: String(data.category || ''),
        minutes: Math.max(1, Math.round(words / 200)),
      };
    });
}

export function buildCardIndex(): CardIndex {
  const list = readPosts();
  const posts: Record<string, CardPost> = {};
  for (const p of list) posts[p.slug] = { t: p.title, ...(p.image ? { img: p.image } : {}), m: p.minutes, k: /^projects$/i.test(p.category) ? 'job' : 'guide' };
  const has = (s: string) => Boolean(posts[s]);
  const guides = PAX_GUIDES.filter(has);
  const pages: Record<string, string[]> = {};
  const paxPosts = new Set<string>(guides);

  for (const job of getAllProjects()) {
    const pax = job.tags?.some((t) => /\bpax\b/i.test(t)) || /\bpax\b/i.test(job.title);
    const own = job.blogSlug && has(job.blogSlug) ? [job.blogSlug] : [];
    if (pax) own.forEach((s) => paxPosts.add(s));
    const want = [...own, ...(pax ? guides : [])];
    if (want.length) pages[`/portfolio/${job.slug}`] = want;
  }
  for (const p of WARDROBE_PAGES) pages[p] = guides;
  for (const a of areaPages()) pages[`/areas/${a.slug}`] = guides;
  // a PAX post: the PAX guides it isn't
  for (const s of paxPosts) pages[`/blog/${s}`] = guides.filter((g) => g !== s);

  const trade = [...TRADE_PAGES, ...list.filter((p) => TRADE_CATEGORIES.test(p.category)).map((p) => `/blog/${p.slug}`)];
  for (const k of Object.keys(pages)) if (!pages[k].length) delete pages[k];
  return { v: 1, posts, pages, trade };
}
