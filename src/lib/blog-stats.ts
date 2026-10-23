/* Blog stats for the Job Kit (Website stats, Blog; Raf, 23 Oct 2026: "blog posts statistics, who read it, and what
   area, which blog post most popular, what should we focus on with more blog posts"). The reads come from
   rafsite_blog in the stats database (every view of a /blog/<slug> page); the posts' titles, dates and topics from
   content/blog (and the job each one is about) through /api/job-kit/stats. No imports, so the sums can be tested on
   their own. Nobody's name or address is ever known: places are the connection's rough town. */

export type BlogPostMeta = { slug: string; title: string; date: string; category: string; topic: string; format: string };
export type BlogPlace = { country: string; city: string | null; district?: string | null; n: number };
export type BlogPostStats = {
  path: string;
  title: string | null;
  reads: number;
  readers: number;
  engagedAvg: number; // seconds on the post, while in use
  scrollAvg: number; // 0..1, how far down
  finished: number; // reads that got 90% of the way down
  entries: number; // reads that were the first page of the visit (landed straight on it)
  goals: number; // reads followed by a tap on a way to get in touch, in the same visit
  last: string;
  sources: Record<string, number>; // how the visits that read it began
  from: { from: string; n: number }[]; // 'src:google' for a landing, else the page before
  places: BlogPlace[];
  next: { path: string; n: number }[]; // '' = left the website
};
export type BlogRead = {
  at: string;
  path: string;
  title: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  district: string | null;
  device: 'phone' | 'tablet' | 'computer' | null;
  src: string;
  came: string;
  engaged: number; // ms
  scroll: number;
  next: string | null;
  goals: string[];
};
export type BlogReport = {
  since: string;
  today: string;
  days: number;
  placesFrom: string | null;
  totals: { reads: number; readers: number; posts: number; engagedAvg: number; finished: number; entries: number; goals: number; index: number };
  sources: Record<string, number>;
  posts: BlogPostStats[];
  places: BlogPlace[];
  names?: Record<string, string>; // the titles of the pages read before and after a post
  latest: BlogRead[];
};

export const SEARCH_SOURCES = ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia'];
export const AI_SOURCES = ['chatgpt', 'ai'];

/* What a post is about: IKEA PAX first (it's its own search), then the job it tells the story of, then its words. */
const WORDS: [RegExp, string][] = [
  [/\bpax\b/i, 'IKEA PAX wardrobes'],
  [/wardrobe/i, 'Fitted wardrobes'],
  [/panel/i, 'Wall panelling'],
  [/alcove|bookcase|tv unit|chimney/i, 'Alcove units'],
  [/window seat|bench|seat/i, 'Window seats'],
  [/desk|office/i, 'Desks'],
  [/kitchen/i, 'Kitchens'],
  [/loft|eaves|cylinder/i, 'Loft storage'],
  [/deck|fence|gate|garden|outdoor|gym/i, 'Outdoor'],
  [/sketchup|3d/i, 'SketchUp and planning'],
  [/cut ?list|cabinetos|board/i, 'Cut lists and CabinetOS'],
];
export function topicOf(slug: string, title: string, jobType?: string) {
  const words = `${slug.replace(/-/g, ' ')} ${title}`;
  if (/\bpax\b/i.test(words)) return 'IKEA PAX wardrobes';
  if (jobType) return jobType;
  return WORDS.find(([re]) => re.test(words))?.[1] ?? 'Other';
}
export const formatOf = (category: string) => (/^projects$/i.test(category) ? 'Job story' : /^(tips|sketchup|cabinetos)$/i.test(category) ? 'Guide' : category || 'Other');

export const slugOfPath = (path: string) => path.replace(/^\/blog\//, '').replace(/\/+$/, '');
export const cleanTitle = (t: string | null | undefined) => (t ?? '').replace(/\s*[|·]\s*Raf Carpentry.*$/i, '').trim();

export function dur(s: number) {
  if (!s) return '0 s';
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return r ? `${m} min ${r} s` : `${m} min`;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pc = (n: number) => `${Math.round(n * 100)}%`;
const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export type PostRow = BlogPostMeta & { path: string; s: BlogPostStats | null; found: number; ai: number };
/* Every post, with its reads (null: not read in these days). A post read but no longer in content/blog keeps its
   stored title. */
export function postRows(meta: BlogPostMeta[], r: BlogReport | null): PostRow[] {
  const bySlug = new Map((r?.posts ?? []).map((p) => [slugOfPath(p.path), p]));
  const landed = (p: BlogPostStats | null, kinds: string[]) => (p ? p.from.filter((f) => kinds.some((k) => f.from === `src:${k}`)).reduce((a, f) => a + f.n, 0) : 0);
  const rows: PostRow[] = meta.map((m) => {
    const s = bySlug.get(m.slug) ?? null;
    bySlug.delete(m.slug);
    return { ...m, path: `/blog/${m.slug}`, s, found: landed(s, [...SEARCH_SOURCES, ...AI_SOURCES]), ai: landed(s, AI_SOURCES) };
  });
  for (const [slug, s] of bySlug) {
    const title = cleanTitle(s.title) || slug.replace(/-/g, ' ');
    rows.push({ slug, title, date: '', category: '', topic: topicOf(slug, title), format: 'Other', path: s.path, s, found: landed(s, [...SEARCH_SOURCES, ...AI_SOURCES]), ai: landed(s, AI_SOURCES) });
  }
  return rows;
}

export type TopicRow = { topic: string; posts: number; read: number; reads: number; perPost: number; time: number; finished: number; found: number; ai: number; goals: number };
export function topicRows(rows: PostRow[]): TopicRow[] {
  const m = new Map<string, TopicRow & { secs: number; timed: number }>();
  for (const p of rows) {
    const t = m.get(p.topic) ?? { topic: p.topic, posts: 0, read: 0, reads: 0, perPost: 0, time: 0, finished: 0, found: 0, ai: 0, goals: 0, secs: 0, timed: 0 };
    t.posts++;
    if (p.s) {
      t.read++;
      t.reads += p.s.reads;
      t.finished += p.s.finished;
      t.found += p.found;
      t.ai += p.ai;
      t.goals += p.s.goals;
      if (p.s.engagedAvg) {
        t.secs += p.s.engagedAvg * p.s.reads;
        t.timed += p.s.reads;
      }
    }
    m.set(p.topic, t);
  }
  return [...m.values()]
    .map(({ secs, timed, ...t }) => ({ ...t, perPost: t.posts ? t.reads / t.posts : 0, time: timed ? Math.round(secs / timed) : 0 }))
    .sort((a, b) => b.reads - a.reads || b.perPost - a.perPost || a.topic.localeCompare(b.topic));
}

export type Advice = { kind: 'topic' | 'ai' | 'format' | 'fix' | 'copy' | 'touch'; title: string; why: string; path?: string };
/* What to write next, from the reads: at most four, the strongest first. Early on (under 20 reads) it says they're hints. */
export function blogAdvice(rows: PostRow[], r: BlogReport | null): { early: string; items: Advice[] } {
  const reads = r?.totals.reads ?? 0;
  const days = r?.days ?? 0;
  if (!r || !reads) return { early: r ? `No posts read in the last ${days} days yet.` : '', items: [] };
  const early = reads < 20 ? `Early days: ${plural(reads, 'read')} in ${days} days, so take these as hints. They firm up as more people read.` : '';
  const min = early ? 1 : 2;
  const items: Advice[] = [];
  const read = rows.filter((p) => p.s);

  // 1. the topic that gets the most per post, counting arrivals from Google and AI double
  const topics = topicRows(rows).filter((t) => t.reads >= min);
  const score = (t: TopicRow) => (t.reads + t.found) / t.posts;
  const best = [...topics].sort((a, b) => score(b) - score(a) || b.reads - a.reads)[0];
  if (best) {
    const others = rows.filter((p) => p.topic !== best.topic);
    const otherPer = others.length ? others.reduce((a, p) => a + (p.s?.reads ?? 0), 0) / others.length : 0;
    if (best.perPost > otherPer) {
      items.push({
        kind: 'topic',
        title: `Write more about ${best.topic}`,
        why: `${plural(best.posts, 'post')}, ${plural(best.reads, 'read')}${best.found ? ` (${best.found} found on Google or AI)` : ''}: ${one(Math.round(best.perPost * 10) / 10)} a post, against ${one(Math.round(otherPer * 10) / 10)} for the rest of the blog.`,
      });
    }
  }

  // 2. AI assistants sending readers
  const ai = read.filter((p) => p.ai).sort((a, b) => b.ai - a.ai);
  const aiReads = ai.reduce((a, p) => a + p.ai, 0);
  if (aiReads) {
    const names = ai.slice(0, 2).map((p) => `“${p.title}”`);
    items.push({
      kind: 'ai',
      title: 'ChatGPT is sending readers',
      why: `${plural(aiReads, 'read')} came straight from ChatGPT or another AI assistant: ${names.join(' and ')}${ai.length > 2 ? ` and ${ai.length - 2} more` : ''}. Keep the answer in the first two lines, with real sizes and “London”: that’s what gets quoted.`,
      path: ai[0].path,
    });
  }

  // 3. guides that answer a question, or job stories
  const per = (f: string) => {
    const list = rows.filter((p) => p.format === f);
    return { n: list.length, reads: list.reduce((a, p) => a + (p.s?.reads ?? 0), 0), list };
  };
  const g = per('Guide');
  const j = per('Job story');
  if (g.n && j.n) {
    const gp = g.reads / g.n;
    const jp = j.reads / j.n;
    const topGuide = g.list.filter((p) => p.s).sort((a, b) => (b.s!.reads + b.found) - (a.s!.reads + a.found))[0];
    if (g.reads >= min && gp >= jp * 1.5 && topGuide) {
      items.push({
        kind: 'format',
        title: 'Write it as the question people ask',
        why: `Guides that answer one question get ${one(Math.round(gp * 10) / 10)} reads a post, job stories ${one(Math.round(jp * 10) / 10)}. Title the next one the way a customer would type it, like “${topGuide.title}”.`,
        path: topGuide.path,
      });
    } else if (j.reads >= min && jp >= gp * 1.5) {
      items.push({ kind: 'format', title: 'Tell more job stories', why: `Job stories get ${one(Math.round(jp * 10) / 10)} reads a post, guides ${one(Math.round(gp * 10) / 10)}. Each new job is a post.` });
    }
  }

  // 4. read and left early (from a search or AI, or by more than one person)
  const fix = read
    .filter((p) => p.s!.scrollAvg < 0.35 && p.s!.engagedAvg < 30 && (p.s!.reads >= 2 || p.found >= 1))
    .sort((a, b) => b.found - a.found || b.s!.reads - a.s!.reads)[0];
  if (fix) {
    items.push({
      kind: 'fix',
      title: `Most leave “${fix.title}” early`,
      why: `${fix.s!.reads === 1 ? 'Its reader' : `Its ${fix.s!.reads} readers`} got ${pc(fix.s!.scrollAvg)} of the way down in ${dur(fix.s!.engagedAvg)}${fix.found ? ', arriving from Google or AI' : ''}. Put the answer and a good photo at the very top.`,
      path: fix.path,
    });
  }

  // 5. the one read to the end, to copy
  const copy = read
    .filter((p) => p.s!.finished >= 1 && p.s!.reads >= min && p.s!.finished / p.s!.reads >= 0.5)
    .sort((a, b) => b.s!.finished - a.s!.finished || b.s!.engagedAvg - a.s!.engagedAvg)[0];
  if (copy) {
    items.push({
      kind: 'copy',
      title: `Read to the end: “${copy.title}”`,
      why: `${copy.s!.finished} of ${plural(copy.s!.reads, 'reader')} read it to the end, ${dur(copy.s!.engagedAvg)} each. Use its shape for the next one.`,
      path: copy.path,
    });
  }

  // 6. reads that turned into someone getting in touch
  const touch = read.filter((p) => p.s!.goals).sort((a, b) => b.s!.goals - a.s!.goals)[0];
  if (touch) {
    items.push({
      kind: 'touch',
      title: `“${touch.title}” led to people getting in touch`,
      why: `${plural(touch.s!.goals, 'reader')} then tapped Get a quote, Send to Raf, WhatsApp, phone or email. Worth more than reads alone: write more like it.`,
      path: touch.path,
    });
  }

  const order: Advice['kind'][] = ['topic', 'touch', 'ai', 'format', 'fix', 'copy'];
  return { early, items: items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, 4) };
}
