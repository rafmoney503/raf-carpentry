/* Workshop Tools (25 Oct 2026): the free app for carpenters and DIYers, as Raf designed it on the 'Raf Workshop
   Tools' design canvas. Shared by its page (/tools/workshop), the Tools page card, AppNudge and the menus. */

export const APP_PAGE = '/tools/workshop';
export const APP_OPEN = '/tools/workshop/app';
// Printed on cards and said in videos; next.config.ts sends it to APP_PAGE with any ?utm_source kept.
export const APP_SHORT = 'rafcarpentry.com/app';

export const APP_SCREENS = {
  home: { src: '/images/tools/workshop/screen-home-e87ea5ad.jpg', alt: 'The Workshop Tools app on a phone: Carry on with the stud wall left this morning (7 studs, cut each to 2324), then the tools in three groups with a small drawing each.' },
  stud: { src: '/images/tools/workshop/screen-stud-fb359b7d.jpg', alt: 'The stud wall tool: the answer first, 7 studs cut to 2324 for a 3600 by 2400 wall with the timber, sheets and noggins, then the wall drawn to scale.' },
  stairs: { src: '/images/tools/workshop/screen-stairs-5304eb3f.jpg', alt: 'Picture frame panelling up the stairs: 12 frames at a 41.6 degree pitch, the frame size and mitres, then the wall drawn opened out flat.' },
  calc: { src: '/images/tools/workshop/screen-calc-89fdcad9.jpg', alt: 'The calculator with big keys: 2,400 minus 18 times 2 comes to 2,364, with VAT, waste and square metre keys above.' },
  og: '/images/tools/workshop/og-f7e8dfbc.jpg',
  w: 780,
  h: 1688,
};

export const APP_ICON = '/images/tools/workshop/icon-192.png';

// The ten tiles on the app's home screen, in its order, with a line more than the tile has room for.
export const APP_TOOLS: { name: string; line: string }[] = [
  { name: 'Unit sizes', line: 'Doors, shelves, hanging rail and full height for a wardrobe or cupboard, from the outside sizes.' },
  { name: 'Door hinges', line: 'Hinge centres that miss every shelf, marked from the top or the bottom of the door.' },
  { name: 'Drawer runners', line: 'Where each pair of runners goes and the size of every drawer box and front.' },
  { name: 'Wall panelling', line: 'Picture frames on walls and up the stairs, or a batten grid: every mark, cut and mitre.' },
  { name: 'Flooring', line: 'Packs to order, the number of rows and how wide the last row comes out, room by room.' },
  { name: 'Stud wall', line: 'CLS, 2×3 or 2×4: studs, plates, noggins, the lengths to buy, plasterboard and insulation.' },
  { name: 'Spirit level', line: 'Set zero on any surface, flip check for true level, the mm to pack the low end, and a tone or a voice when your hands are full.' },
  { name: 'mm ↔ inches', line: 'Both ways, to the nearest 1/8, 1/16 or 1/32, with timber lengths and door sizes ready to tap.' },
  { name: 'Calculator', line: 'Big keys, VAT on and off, 10% waste, square metres and your last answers.' },
  { name: 'My kit', line: 'The tools I use on every job, with a link to today’s price.' },
];
