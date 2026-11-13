/* Mini Raf beside the logo (src/components/MiniRaf.tsx, played by the Navbar). Rafal, 13 Nov 2026: 'mini me walking
   kick the log and a cupboard pop up', then 'make some variations of units, maybe running and making new stuff or
   dancing make it work infinite units'. Each page shows the next round: six pieces, three ways of coming in and six
   colours, so it goes through 36 different ones before one comes round again. No imports, so it can be tested on its
   own. */

export type MiniRafUnit = 'cupboard' | 'chest' | 'wardrobe' | 'bookcase' | 'bedside' | 'tv';
export type MiniRafAct = 'w' | 'r' | 'd'; // walks in, runs in, dances first

export const MINI_RAF_UNITS: { key: MiniRafUnit; name: string; mm: string }[] = [
  { key: 'cupboard', name: 'Cupboard', mm: '600' },
  { key: 'chest', name: 'Chest of drawers', mm: '800' },
  { key: 'wardrobe', name: 'Wardrobe', mm: '1000' },
  { key: 'bookcase', name: 'Bookcase', mm: '600' },
  { key: 'bedside', name: 'Bedside table', mm: '450' },
  { key: 'tv', name: 'TV unit', mm: '1800' },
];
export const MINI_RAF_ACTS: MiniRafAct[] = ['w', 'r', 'd'];
// Sage (the hero doors), off-white, navy, oak, pale blue, slate: the colours painted furniture comes in.
export const MINI_RAF_COLOURS = ['#a8b8a0', '#e8e2d4', '#3d5a80', '#c9a47a', '#b9cbd9', '#5b6670'];

/* One round lasts this long: in from the left, the log kicked, the piece pops up, its size, the doors open and shut,
   then it fades and the name comes back. The CSS keyframes (src/components/mini-raf.css) are percentages of it. */
export const MINI_RAF_MS = 7000;
/* The name starts coming back as the scene fades (90% of the round). */
export const MINI_RAF_NAME_BACK_MS = 6300;

export type MiniRafVariant = { unit: MiniRafUnit; act: MiniRafAct; colour: string; mm: string; name: string };

export function miniRafVariant(round: number): MiniRafVariant {
  const r = Math.max(0, Math.floor(round));
  const u = MINI_RAF_UNITS[r % 6];
  const k = Math.floor(r / 6);
  return { unit: u.key, act: MINI_RAF_ACTS[(r + k) % 3], colour: MINI_RAF_COLOURS[(r * 5 + k) % 6], mm: u.mm, name: u.name };
}

/* The round to play next, kept in the browser so the next page (and the next visit) shows a different piece. Storage
   blocked: counted for this visit only. */
const KEY = 'raf_mini_raf';
let memory = -1;
export function nextMiniRafRound(): number {
  let last = memory;
  try {
    const text = window.localStorage.getItem(KEY);
    const kept = text === null || text === '' ? NaN : Number(text);
    if (Number.isFinite(kept) && kept >= 0) last = Math.max(last, Math.floor(kept));
  } catch {
    /* storage blocked */
  }
  const next = (last + 1) % 3600;
  memory = next;
  try {
    window.localStorage.setItem(KEY, String(next));
  } catch {
    /* storage blocked */
  }
  return next;
}
