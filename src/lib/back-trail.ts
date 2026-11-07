/* The back link at the top of every page (src/components/BackBar.tsx), 7 Nov 2026: Raf found pages with no way back,
   and Safari on an iPhone tucks its own back button away. Each tab keeps the pages it went through on this site
   (sessionStorage raf_trail), so the link can say where it goes:
   - came from another page here: "‹ Back to Fitted wardrobes", which goes back in the browser (their place on that
     page kept);
   - arrived straight from Google, WhatsApp or a link: "‹ Services", the page above this one.
   No imports beyond the 3D kinds (no fs), so it runs in the browser. */

import { DESIGN_KINDS } from './design-kinds';

export type Stop = { p: string; n?: string };
export type Up = { href: string; name: string };

const KEY = 'raf_trail';
const MAX = 30;

/* Short names of the pages that have one, for "Back to ...". Pages not here are named by their heading. */
const NAMES: Record<string, string> = {
  '/': 'Home',
  '/portfolio': 'My work',
  '/services': 'Services',
  '/designs': '3D designs',
  '/blog': 'Blog',
  '/tools': 'Tools',
  '/about': 'About',
  '/contact': 'Contact',
  '/areas': 'Where I work',
  '/sketchup': 'SketchUp',
  '/cabinetos': 'CabinetOS',
  '/how-it-works': 'Plan your project',
  '/privacy': 'Privacy',
  '/tips': 'Workshop tips',
  '/calculator': 'Workshop calculator',
  '/drawings': 'Drawings and cut lists',
  '/wardrobe-planner': 'Wardrobe planner',
  '/tools/decking-calculator': 'Decking calculator',
  '/tools/spirit-level': 'Spirit level',
  '/tools/readings': 'Your readings',
  '/tools/workshop': 'Workshop Tools',
  '/tools/workshop/app': 'Workshop Tools',
  '/tools/games': 'Workshop Games',
  '/tools/games/app': 'Workshop Games',
  '/tools/games/beat': 'the score',
  '/tools/calculator': 'Simple calculator',
  '/cost/fitted-wardrobes': 'Wardrobe prices',
  '/review': 'Leave a review',
};

const sentence = (slug: string) => {
  const s = decodeURIComponent(slug).replace(/-/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const titled = (slug: string) => decodeURIComponent(slug).split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/* What a page is called in "Back to ...": its short name, or its heading. */
export function nameOf(path: string, heading?: string | null): string | undefined {
  const p = clean(path);
  if (NAMES[p]) return NAMES[p];
  const [, a, b] = p.split('/');
  if (b && a === 'services') return sentence(b);
  if (b && a === 'areas') return titled(b);
  if (b && a === 'designs') {
    const k = DESIGN_KINDS.find((x) => x.slug === b);
    return k ? `${k.label} in 3D` : undefined;
  }
  const h = (heading || '').replace(/\s+/g, ' ').trim().replace(/[.,:;]+$/, '');
  return h ? h : undefined;
}

/* The page above this one, for someone who arrived here straight from outside. */
export function upOf(path: string): Up {
  const p = clean(path);
  const to = (href: string): Up => ({ href, name: NAMES[href] });
  if (p.startsWith('/portfolio/')) return to('/portfolio');
  if (p.startsWith('/blog/')) return to('/blog');
  if (p.startsWith('/services/')) return to('/services');
  if (p.startsWith('/designs/')) return to('/designs');
  if (p.startsWith('/areas/')) return to('/areas');
  if (p.startsWith('/tools/readings')) return to('/tools/spirit-level');
  if (p.startsWith('/tools/games/beat')) return to('/tools/games');
  if (p.startsWith('/tools/')) return to('/tools');
  if (p.startsWith('/cost/')) return { href: '/services/fitted-wardrobes', name: 'Fitted wardrobes' };
  if (p.startsWith('/drawings/')) return to('/drawings');
  if (['/tips', '/calculator', '/drawings', '/wardrobe-planner'].includes(p)) return to('/tools');
  return to('/');
}

function clean(path: string) {
  const p = (path || '/').split(/[?#]/)[0].replace(/\/+$/, '');
  return p || '/';
}

/* ---- the tab's trail ---- */

let memory: Stop[] = []; // when the browser won't keep anything

function read(): Stop[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    if (Array.isArray(v)) return v.filter((s) => s && typeof s.p === 'string').slice(-MAX);
  } catch {
    // storage blocked: the copy in memory
  }
  return memory.slice(-MAX);
}

function write(t: Stop[]) {
  memory = t.slice(-MAX);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // kept in memory only
  }
}

/* How this document was opened: a reload, back or forward into it, or a new visit (from where). */
function firstLoad(): { kind: string; fromHere: boolean } {
  let kind = 'navigate';
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type) kind = nav.type;
  } catch {
    // older browsers: a plain visit
  }
  let fromHere = false;
  try {
    fromHere = !!document.referrer && new URL(document.referrer).host === location.host;
  } catch {
    fromHere = false;
  }
  return { kind, fromHere };
}

function step(t: Stop[], p: string): Stop[] {
  const last = t[t.length - 1];
  if (last?.p === p) return t; // the same page again (a reload)
  if (t.length >= 2 && t[t.length - 2].p === p) return t.slice(0, -1); // went back
  return [...t, { p }];
}

/* Called on every page shown (first: the first page of this document). Returns the trail now. */
export function noteVisit(path: string, first: boolean): Stop[] {
  const p = clean(path);
  let t = read();
  if (first) {
    const { kind, fromHere } = firstLoad();
    if (kind === 'reload' || kind === 'back_forward') {
      // back into the site, or a reload: cut the trail back to this page if it's on it
      const at = t.map((s) => s.p).lastIndexOf(p);
      t = at >= 0 ? t.slice(0, at + 1) : [{ p }];
    } else if (!fromHere) {
      t = [{ p }]; // a new visit from outside: nothing on this site to go back to
    } else {
      t = step(t, p);
    }
  } else {
    t = step(t, p);
  }
  write(t);
  return t;
}

/* Gives the page just shown its name, once its heading is on the screen. */
export function nameVisit(path: string, heading?: string | null): Stop[] {
  const p = clean(path);
  const t = read();
  const last = t[t.length - 1];
  if (last && last.p === p) {
    const n = nameOf(p, heading);
    if (n && n !== last.n) {
      last.n = n;
      write(t);
    }
  }
  return t;
}

export const pathKey = clean;
