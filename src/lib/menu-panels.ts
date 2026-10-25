import { getAllPosts } from './blog';
import { getLibraryItems, libraryKinds } from './design-library';
import { readPageJson } from './pages';
import { portfolioChips } from './portfolio-chips';
import { getAllProjects } from './projects';
import { PLANNER_HREF, PLANNER_IMAGE, PLANNER_IMAGE_SQUARE } from './planner-picture';
import { getServices, jobsFor } from './services';

/* What each main menu item shows when the mouse rests on it (computer) or its + is tapped (phone menu):
   that page in a line, its sections as # tags that jump straight there, sometimes a short list (newest
   posts, free tools), and a picture from the page. Built at deploy time from the same content the pages use,
   so the counts and lists keep up by themselves. Section ids live on the pages (scroll-mt-24 so the sticky
   menu doesn't cover the heading). */

export type MenuTag = { label: string; href: string; count?: number };
export type MenuPanel = {
  href: string; // the menu item
  kicker: string;
  title: string;
  blurb: string;
  cta: string;
  tagsTitle: string;
  tags: MenuTag[];
  listTitle?: string;
  list?: { label: string; href: string }[];
  image?: { src: string; alt: string; caption: string; contain?: boolean };
  /** A linked picture in place of `image` (Tools: the wardrobe planner), also shown in the phone menu under the + */
  feature?: { href: string; src: string; square: string; kicker: string; title: string; line: string };
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
/* No checks on public/ files here: the home page is rebuilt every hour on Vercel, where public/ isn't beside the
   server code (next.config outputFileTracingExcludes), so a file check would say no and drop the pictures. */

/* The blog page's two groups, shared with src/app/blog/page.tsx. */
export const isGuide = (category: string) => /sketchup|cabinetos/i.test(category);

type ToolsPage = { categories: { name: string; tools: { image?: string; name?: string }[] }[] };

export function getMenuPanels(): Record<string, MenuPanel> {
  const jobs = getAllProjects();
  const services = getServices();
  const designs = getLibraryItems();
  const kinds = libraryKinds(designs);
  const posts = getAllPosts();
  const guides = posts.filter((p) => isGuide(p.category));
  const tools = readPageJson<ToolsPage>('tools.json');
  const toolImage = tools.categories.flatMap((c) => c.tools).find((t) => t.image?.startsWith('/'));
  const newestPost = posts.find((p) => p.image?.startsWith('/'));

  return {
    '/services': {
      href: '/services',
      kicker: `${services.length} services`,
      title: 'Services',
      blurb: 'What I build and fit, each with its jobs, the questions people ask and a quote button.',
      cta: 'All services',
      tagsTitle: 'Jump to',
      tags: services.map((s) => ({ label: s.name, href: `/services/${s.slug}`, count: jobsFor(s).length || undefined })),
      image: jobs[0] ? { src: jobs[0].cover.src, alt: '', caption: `${jobs[0].title}, ${jobs[0].area}` } : undefined,
    },
    '/portfolio': {
      href: '/portfolio',
      kicker: `${jobs.length} jobs`,
      title: 'My Work',
      blurb: 'Every job with its photos, how it went together step by step, and a 3D model.',
      cta: `All ${jobs.length} jobs`,
      tagsTitle: 'Show me',
      tags: portfolioChips(jobs).map((c) => ({ label: c, href: `/portfolio?q=${encodeURIComponent(c)}` })),
      image: jobs[1] ? { src: jobs[1].cover.src, alt: '', caption: `${jobs[1].title}, ${jobs[1].area}` } : undefined,
    },
    '/designs': {
      href: '/designs',
      kicker: `${designs.length} designs`,
      title: 'Designs in 3D',
      blurb: 'Find something like yours, turn it round and open the doors, then get yours drawn to your room.',
      cta: 'See them all',
      tagsTitle: 'What are you planning?',
      tags: kinds.map((k) => ({ label: k.label, href: `/designs/${k.slug}`, count: k.count })),
      image: designs[0] ? { src: designs[0].model.poster.src, alt: '', caption: `${designs[0].title}, in 3D`, contain: true } : undefined,
    },
    '/sketchup': {
      href: '/sketchup',
      kicker: 'How I draw every job',
      title: 'SketchUp',
      blurb: 'Why every job is drawn in 3D first, and how you can learn to draw your own furniture.',
      cta: 'Open the page',
      tagsTitle: 'On this page',
      tags: [
        { label: 'Real jobs, in 3D', href: '/sketchup#in-3d' },
        { label: 'Benefits for carpenters', href: '/sketchup#benefits' },
        { label: '3D designs vs real builds', href: '/sketchup#compare' },
        ...(jobs.some((j) => j.planSale?.buyUrl || j.planSale?.freeDownload) ? [{ label: 'Plans from real jobs', href: '/sketchup#plans' }] : []),
        { label: 'Learn SketchUp with me', href: '/sketchup#learn' },
        { label: 'Get a 3D design', href: '/sketchup#get-a-design' },
      ],
      image: designs[2] ? { src: designs[2].model.poster.src, alt: '', caption: `${designs[2].title}, in 3D`, contain: true } : undefined,
    },
    '/cabinetos': {
      href: '/cabinetos',
      kicker: 'My cutting list app',
      title: 'CabinetOS',
      blurb: 'Parts list, cut list, boards and printing for cabinet makers. Free to start.',
      cta: 'Open the page',
      tagsTitle: 'On this page',
      tags: [
        { label: 'App screens', href: '/cabinetos#screens' },
        { label: 'How it works', href: '/cabinetos#features' },
        { label: 'Pencil and paper, or the app', href: '/cabinetos#compare' },
        { label: 'How it works out the sizes', href: '/cabinetos#sizes' },
        { label: 'Questions', href: '/cabinetos#faq' },
        { label: 'Try it free', href: '/cabinetos#try' },
      ],
      image: { src: '/images/cabinetos/screens/build-computer.webp', alt: '', caption: 'The Build screen' },
    },
    '/blog': {
      href: '/blog',
      kicker: `${posts.length} posts`,
      title: 'The Workshop Journal',
      blurb: 'The story of each job and what was hard about it, plus how I use SketchUp and CabinetOS.',
      cta: 'All posts',
      tagsTitle: 'Topics',
      tags: [
        { label: 'Jobs, step by step', href: '/blog#jobs', count: posts.length - guides.length },
        ...(guides.length ? [{ label: 'SketchUp and CabinetOS', href: '/blog#guides', count: guides.length }] : []),
      ],
      listTitle: 'Newest',
      list: posts.slice(0, 3).map((p) => ({ label: p.title, href: `/blog/${p.slug}` })),
      image: newestPost?.image ? { src: newestPost.image, alt: '', caption: newestPost.title } : undefined,
    },
    '/tools': {
      href: '/tools',
      kicker: 'My kit',
      title: 'Tools',
      blurb: 'The tools I use on every job, and free tools for your own projects.',
      cta: 'Open the page',
      tagsTitle: 'My kit',
      tags: tools.categories.map((c) => ({ label: c.name.replace(/\s*&\s*/g, ' and '), href: `/tools#${slug(c.name)}`, count: c.tools.length })),
      listTitle: 'Free to use',
      list: [
        { label: 'Wardrobe planner in 3D', href: '/wardrobe-planner' },
        { label: 'Workshop Tools app for your phone', href: '/tools/workshop' },
        { label: 'Workshop calculator in mm', href: '/calculator' },
        { label: 'Spirit level on your phone', href: '/tools/spirit-level' },
        { label: 'Workshop tips', href: '/tips' },
        { label: 'Timber Stack, a game', href: '/tools/timber-stack' },
      ],
      image: toolImage?.image ? { src: toolImage.image, alt: '', caption: toolImage.name ?? 'From my kit' } : undefined,
      feature: { href: PLANNER_HREF, src: PLANNER_IMAGE, square: PLANNER_IMAGE_SQUARE, kicker: 'Free planner', title: 'Plan your own wardrobe in 3D', line: 'Your sizes, units and doors. Then send it to me.' },
    },
    '/about': {
      href: '/about',
      kicker: 'Rafal Janczy',
      title: 'About me',
      blurb: 'A carpenter who thinks in code: the story so far, how I work, and where to follow the jobs.',
      cta: 'Read my story',
      tagsTitle: 'On this page',
      tags: [
        { label: 'My story', href: '/about#story' },
        { label: 'What makes me different', href: '/about#different' },
        { label: 'Follow the work', href: '/about#follow' },
        { label: 'The company', href: '/about#company' },
      ],
      image: { src: '/images/raf-at-work.jpg', alt: '', caption: 'Measuring up' },
    },
  };
}

/* "power-tools" for "Power Tools", "measuring-layout" for "Measuring & Layout": the Tools page's section ids. */
export const toolsSectionId = slug;
