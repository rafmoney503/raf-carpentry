import { PLANNER_IMAGE_SQUARE } from '@/lib/planner-picture';
import { EXTENSION_STILL_SQUARE } from '@/lib/extension-clip';

/* How each button on the Instagram page (/ms) looks: which group it sits in and its picture (Raf, 20 Nov 2026:
   "add some mini miniatures for each button/section to make it more interesting", then "C" on the "Instagram page
   with mini pictures" design canvas). The words, links and order stay in content/pages/ms.json (TinaCMS); this file
   only matches each link to its look, by the page it goes to (or the site, for a link to another website). A link
   that isn't here goes under "More from me" as a plain row, so a button added in TinaCMS still shows. */

export type Group = 'quote' | 'work' | 'trade' | 'more';

export const GROUPS: { id: Group; title: string }[] = [
  { id: 'quote', title: 'Get a quote' },
  { id: 'work', title: 'See my work' },
  { id: 'trade', title: 'For carpenters' },
  { id: 'more', title: 'More from me' },
];

export type Kind =
  | 'half' // a photo tile, half the width (Book a Service)
  | 'whatsapp' // the green WhatsApp tile beside it
  | 'collage' // My Work: three job photos and the number of jobs
  | 'model' // Designs in 3D: a 3D model on graph paper
  | 'guide' // the PAX guide, blue, with its cover
  | 'app' // CabinetOS, dark, with the app on a phone
  | 'tile' // a square photo tile, two to a row
  | 'tools' // My Carpentry Tools: three tool photos
  | 'row'; // a row with a small picture

export type Mark = 'rs' | 'r' | 'google';

export type Look = {
  group: Group;
  kind: Kind;
  image?: string;
  /* Where the photo is cropped from, as CSS object-position. */
  position?: string;
  mark?: Mark;
  tag?: string;
};

const LOOKS: Record<string, Look> = {
  '/contact': { group: 'quote', kind: 'half', image: '/images/projects/IMG_8405.jpg', position: '50% 40%', tag: 'London' },
  whatsapp: { group: 'quote', kind: 'whatsapp', tag: 'Reply in 24 h' },
  '/how-it-works': { group: 'quote', kind: 'row', image: PLANNER_IMAGE_SQUARE },
  '/portfolio': { group: 'work', kind: 'collage' },
  '/designs': { group: 'work', kind: 'model', image: '/images/projects/chimney-breast-wardrobes-palmers-green/model-3d.jpg', tag: '3D' },
  '/pax-guide': { group: 'trade', kind: 'guide' },
  'cabinetos.co.uk': { group: 'trade', kind: 'app', tag: 'Free plan · no card' },
  '/tools/workshop': { group: 'trade', kind: 'tile', image: '/images/tools/workshop/screen-home-e87ea5ad.jpg', position: '50% 9%', tag: 'Free app' },
  '/tools/calculator': { group: 'trade', kind: 'tile', image: '/images/tools/calculator-1f5bd09d.jpg', position: '50% 30%', tag: 'Free' },
  '/tips': { group: 'trade', kind: 'tile', image: '/images/projects/desk-wood-green/s2.jpg' },
  '/sketchup': { group: 'trade', kind: 'tile', image: EXTENSION_STILL_SQUARE },
  '/tools': { group: 'trade', kind: 'tools' },
  '/blog': { group: 'more', kind: 'row', image: '/images/blog/floating-walnut-desk-highbury/hero.jpg' },
  '/about': { group: 'more', kind: 'row', image: '/images/raf-at-work.jpg', position: '50% 35%' },
  'rafalsolutions.co.uk': { group: 'more', kind: 'row', mark: 'rs' },
  '/': { group: 'more', kind: 'row', mark: 'r' },
  '/review': { group: 'more', kind: 'row', mark: 'google' },
};

/* The tool photos on My Carpentry Tools (Raf's own tools, as on the Tools page). */
export const TOOL_PHOTOS = ['/images/tools/festool-track-saw.jpg', '/images/tools/dewalt-impact-driver.jpg', '/images/tools/stabila-electronic-level.jpg'];

/* Jobs whose photos make the banner at the top and the My Work collage (from the home page's photo of the day). */
export const BANNER_JOBS = ['pax-wardrobe-finchley', 'kitchen-panelling-crouch-end', 'reception-desk-brentwood'];
export const COLLAGE_JOBS = ['floating-walnut-desk-highbury', 'bookcase-radiator-cover-east-finchley', 'tv-unit-and-bookcase-haringey'];

/* The key a link is looked up by: "whatsapp" for a WhatsApp link, the site for another website, else the page. */
export function keyOf(url: string): string {
  const u = url.trim();
  if (/wa\.me\/|whatsapp\.com/i.test(u)) return 'whatsapp';
  if (/^https?:\/\//i.test(u)) {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return u;
    }
  }
  const path = u.split(/[?#]/)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function lookOf(url: string): Look {
  return LOOKS[keyOf(url)] ?? { group: 'more', kind: 'row' };
}
