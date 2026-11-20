import { PLANNER_IMAGE_SQUARE } from '@/lib/planner-picture';

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

/* What's drawn over a square tile's photo, in the site's blue (Raf, 20 Nov 2026: "can we make those tiles be more
   interesting", then "A" on the same canvas). Each moves a little while on screen (./ms.css). */
export type TileArt =
  | 'panels' // Workshop Tools: one opening of the Barnet panelling marked, with the app's answer for that wall
  | 'sum' // Calculator: the calculator's display over a photo of bare MDF shelves
  | 'skirting' // Workshop Tips: a line across an alcove, skirting to skirting (the first tip)
  | 'wipe'; // SketchUp: the 3D drawing wipes across to the photo of the same wardrobe built

export type Mark = 'rs' | 'r' | 'google';

export type Look = {
  group: Group;
  kind: Kind;
  image?: string;
  /* Where the photo is cropped from, as CSS object-position. */
  position?: string;
  mark?: Mark;
  tag?: string;
  art?: TileArt;
  /* For 'wipe': the 3D drawing, cropped the same as the photo. */
  drawing?: string;
};

/* The Barnet wall in the Workshop Tools app's batten grid: 4105 wide, 1000 high, 69 mm battens, 6 panels
   (content/projects/wall-panelling-barnet.json, calculator). */
export const PANELS_ANSWER = '6 panels · 603.7 × 862';

const LOOKS: Record<string, Look> = {
  '/contact': { group: 'quote', kind: 'half', image: '/images/projects/IMG_8405.jpg', position: '50% 40%', tag: 'London' },
  whatsapp: { group: 'quote', kind: 'whatsapp', tag: 'Reply in 24 h' },
  '/how-it-works': { group: 'quote', kind: 'row', image: PLANNER_IMAGE_SQUARE },
  '/portfolio': { group: 'work', kind: 'collage' },
  '/designs': { group: 'work', kind: 'model', image: '/images/projects/chimney-breast-wardrobes-palmers-green/model-3d.jpg', tag: '3D' },
  '/pax-guide': { group: 'trade', kind: 'guide' },
  'cabinetos.co.uk': { group: 'trade', kind: 'app', tag: 'Free plan · no card' },
  '/tools/workshop': { group: 'trade', kind: 'tile', image: '/images/ms/tile-panelling-da5ac4ab.jpg', tag: 'Free app', art: 'panels' },
  '/tools/calculator': { group: 'trade', kind: 'tile', image: '/images/ms/tile-shelves-a9301429.jpg', tag: 'Free', art: 'sum' },
  '/tips': { group: 'trade', kind: 'tile', image: '/images/ms/tile-alcove-d581ccf3.jpg', art: 'skirting' },
  '/sketchup': { group: 'trade', kind: 'tile', image: '/images/ms/tile-wardrobe-7874a830.jpg', drawing: '/images/ms/tile-wardrobe-3d-127743cf.jpg', art: 'wipe' },
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
