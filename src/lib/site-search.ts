import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getAllPosts } from './blog';
import { getLibraryItems, libraryKinds } from './design-library';
import { readPageJson } from './pages';
import { jobSearchText } from './portfolio-chips';
import { formatMonth, getAllProjects } from './projects';
import { getServices, jobsFor } from './services';
import { getTipsData } from './tips';
import { toolsSectionId } from './menu-panels';

/* Everything the search in the menu looks through (magnifier on a computer, the box at the top of the phone menu),
   built once at deploy time and served as /search-index.json (src/app/search-index.json/route.ts). The browser
   loads it the first time search opens and searches it there (src/components/SiteSearch.tsx), with the same
   word matching as My Work (src/lib/search.ts). `text` holds each distinct word once, lower case, to keep the
   file small; titles are searched as they are. */

export type SearchKind = 'job' | 'post' | 'service' | 'design' | 'page' | 'tip' | 'tool' | 'material' | 'faq' | 'brief';

export type SearchEntry = {
  k: SearchKind;
  title: string;
  href: string;
  sub?: string; // a short line under the title
  img?: string;
  tags?: string[]; // shown as "# Boiler cupboard" when the words match one
  text: string;
};

const words = (...parts: (string | undefined)[]) => {
  const seen = new Set<string>();
  for (const w of parts.join(' ').toLowerCase().match(/[a-z0-9£]+/g) ?? []) if (w.length > 1) seen.add(w);
  return [...seen].join(' ');
};

/* Markdown to plain words: images and links keep their words, the rest of the marks go. */
const plain = (md: string) =>
  md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/[#*_>`|-]+/g, ' ');

/* Pages that aren't a job, post or service, with the words people might type for them. */
const PAGES: { title: string; href: string; sub: string; words: string }[] = [
  { title: 'Plan your project', href: '/how-it-works', sub: 'Your brief, what I need, what you get', words: 'quote brief plan project price cost visit measure photos 3d drawing how it works get a quote' },
  { title: 'Designs in 3D', href: '/designs', sub: 'Turn them round, open the doors', words: '3d designs models sketchup look ideas' },
  { title: 'My Work', href: '/portfolio', sub: 'Every job with photos and steps', words: 'portfolio jobs work photos projects gallery' },
  { title: 'Services', href: '/services', sub: 'What I build and fit', words: 'services build fit carpenter joiner' },
  { title: 'SketchUp', href: '/sketchup', sub: 'Drawing every build in 3D first', words: 'sketchup 3d drawing plans models learn course' },
  { title: 'CabinetOS', href: '/cabinetos', sub: 'My cutting list app for cabinet makers', words: 'cabinetos app cut list cutlist cutting board optimise optimisation cabinet maker software' },
  { title: 'Workshop calculator', href: '/calculator', sub: 'Sums in mm, how many fit on a board', words: 'calculator calc mm sums maths board sheet 2440 1220 inches' },
  { title: 'Workshop tips', href: '/tips', sub: 'For carpenters and DIYers', words: 'tips tricks diy how to advice' },
  { title: 'Tools I use', href: '/tools', sub: 'My kit, with links', words: 'tools kit amazon dewalt festool makita buy' },
  { title: 'Timber Stack', href: '/tools/timber-stack', sub: 'A free game: stack the timber', words: 'game timber stack play fun' },
  { title: 'Blog', href: '/blog', sub: 'Jobs step by step, SketchUp and CabinetOS', words: 'blog posts articles write ups' },
  { title: 'About', href: '/about', sub: 'Who I am and how I work', words: 'about raf rafal story who carpenter london' },
  { title: 'Contact', href: '/contact', sub: 'Phone, WhatsApp, email', words: 'contact phone call email whatsapp number message' },
];

type HowItWorks = {
  briefWhat: string[];
  briefRoom: string[];
  briefUses: string[];
  materials: { name: string; bestFor?: string; description?: string }[];
  faq: { question: string; answer: string }[];
};
type ToolsPage = { categories: { name: string; tools: { name?: string; description?: string }[] }[] };

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function buildSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];

  for (const p of getAllProjects()) {
    out.push({
      k: 'job',
      title: p.title,
      href: `/portfolio/${p.slug}`,
      sub: `${p.area} · ${formatMonth(p.finished)}`,
      img: p.cover.src,
      text: words(jobSearchText(p), ...p.steps.map((s) => s.text)),
    });
  }

  const blogDir = path.join(process.cwd(), 'content/blog');
  for (const post of getAllPosts()) {
    let body = '';
    try {
      body = matter(fs.readFileSync(path.join(blogDir, `${post.slug}.md`), 'utf-8')).content;
    } catch {
      /* no body: title and excerpt still count */
    }
    out.push({ k: 'post', title: post.title, href: `/blog/${post.slug}`, sub: post.category, text: words(post.excerpt, post.category, plain(body)) });
  }

  for (const s of getServices()) {
    const n = jobsFor(s).length;
    out.push({
      k: 'service',
      title: s.name,
      href: `/services/${s.slug}`,
      sub: n ? `Service · ${n} ${n === 1 ? 'job' : 'jobs'}` : 'Service',
      tags: [...s.matchTags],
      text: words(s.summary, s.intro, ...s.matchTypes, ...s.matchTags, ...s.points.flatMap((x) => [x.title, x.description]), ...s.faq.map((f) => f.question)),
    });
  }

  for (const k of libraryKinds(getLibraryItems())) {
    out.push({
      k: 'design',
      title: `${k.label} in 3D`,
      href: `/designs/${k.slug}`,
      sub: `${k.count} ${k.count === 1 ? 'design' : 'designs'} to turn round`,
      text: words(k.short, k.words.source.replace(/\\b|[|?()\\]/g, ' ')),
    });
  }

  for (const p of PAGES) out.push({ k: 'page', title: p.title, href: p.href, sub: p.sub, text: words(p.words) });

  const tips = getTipsData().tips;
  for (const t of tips) out.push({ k: 'tip', title: t.title, href: `/tips#${t.id}`, sub: `Workshop tip · ${t.section}`, text: words(t.section, t.body) });

  const tools = readPageJson<ToolsPage>('tools.json');
  for (const c of tools.categories) {
    for (const t of c.tools) {
      if (!t.name) continue;
      out.push({ k: 'tool', title: t.name, href: `/tools#${toolsSectionId(c.name)}`, sub: `Tools I use · ${c.name}`, text: words(c.name, t.description) });
    }
  }

  const how = readPageJson<HowItWorks>('how-it-works.json');
  for (const m of how.materials ?? []) {
    if (m.name) out.push({ k: 'material', title: m.name, href: '/how-it-works#materials', sub: 'Materials in plain English', text: words(m.bestFor, m.description) });
  }
  for (const f of how.faq ?? []) {
    if (f.question) out.push({ k: 'faq', title: f.question, href: '/how-it-works#faq', sub: 'Questions people ask', text: words(f.answer) });
  }
  // Brief choices: the link opens Plan your project with that choice already ticked.
  const brief = (list: string[] | undefined, key: string) => {
    for (const c of list ?? []) {
      if (/^not sure/i.test(c)) continue;
      out.push({ k: 'brief', title: `Start a brief: ${lowerFirst(c)}`, href: `/how-it-works?${key}=${encodeURIComponent(c)}#brief`, sub: 'Plan your project', text: words(c) });
    }
  };
  brief(how.briefWhat, 'what');
  brief(how.briefUses, 'for');
  brief(how.briefRoom, 'room');

  return out;
}
