/* Workshop Games (25 Oct 2026, Raf: 'Go' to the four games on the 'Workshop Games mockups' design canvas): what the
   app (/tools/games/app), its page (/tools/games), the score pages (/tools/games/beat) and the rest of the site
   share. No imports, so it runs in the browser and on the server alike.

   A score is shared as a link to /tools/games/beat?g=... (a page with its own picture, so WhatsApp shows the score)
   plus a line of text; the page's button opens the same game, and for a level or a board, that one. */

export const GAMES_PAGE = '/tools/games';
export const GAMES_OPEN = '/tools/games/app';
// Printed on cards and said in videos; next.config.ts sends it to GAMES_PAGE with any ?utm_source kept.
export const GAMES_SHORT = 'rafcarpentry.com/games';
const SITE = 'https://www.rafcarpentry.com';

export type GameId = 'measure' | 'sheet' | 'stack' | 'nail';

export const GAMES: { id: GameId; name: string; daily?: boolean; line: string; levels: string }[] = [
  { id: 'measure', name: 'Measure Up', daily: true, line: 'Part of a door, a worktop or a sheet of ply is hidden. Pull the tape up to where you think it ends, then see how close you were.', levels: 'Five new tapes every day, harder by the weekend, plus four practice packs' },
  { id: 'sheet', name: 'Sheet Saver', daily: true, line: 'Fit every part on one 2440 x 1220 board. Turn them, mind the grain, leave room for the saw.', levels: 'A new board every day, plus 30 boards to work through' },
  { id: 'stack', name: 'Timber Stack', line: 'Drop each board on the one below. What hangs over is cut off, so the stack gets narrower. How high can you go?', levels: '10 levels from seat height to ten metres, plus a free stack' },
  { id: 'nail', name: 'Nail Pop', line: 'Nails pop up across the floor, the decking, the loft. Knock them flush before they squeak, and leave the screws alone.', levels: '9 levels, from a hallway floor to the whole house' },
];

export const NAIL_LEVELS = ['Hallway floor', 'Garden decking', 'Loft boarding', 'Stair treads', 'Fence panels', 'Shed at night', 'Roof battens', 'Pallet rush', 'The whole house'];
export const MEASURE_PACKS: Record<string, string> = { doors: 'Doors and rooms', kitchen: 'Kitchens and wardrobes', sheets: 'Sheets and boards', jobs: 'From my jobs' };

export type Score =
  | { g: 'stack'; n: number; h: number }
  | { g: 'nail'; n: number; lv: number }
  | { g: 'measure'; m: number; d?: string; p?: string; res: number[] }
  | { g: 'sheet'; b: number; t: number; n: number };

const int = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,7}$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
};

/* From the app (what the game passed to share) or from a link's ?g=... ; anything odd gives null. */
export function readScore(q: Record<string, unknown>): Score | null {
  const g = q.g;
  if (g === 'stack') {
    const n = int(q.n, 0, 9999), h = int(q.h, 0, 999999);
    return n == null || h == null ? null : { g, n, h };
  }
  if (g === 'nail') {
    const n = int(q.n, 0, 9999), lv = int(q.lv, 1, NAIL_LEVELS.length);
    return n == null || lv == null ? null : { g, n, lv };
  }
  if (g === 'measure') {
    const m = int(q.m, 0, 99999);
    const raw = Array.isArray(q.res) ? q.res : typeof q.r === 'string' ? q.r.split('.') : [];
    const res = raw.slice(0, 8).map((x) => int(typeof x === 'number' ? x : String(x), 0, 9999)).filter((x): x is number => x != null);
    if (m == null || !res.length) return null;
    const d = typeof q.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.d) ? q.d : undefined;
    const p = typeof q.p === 'string' && MEASURE_PACKS[q.p] ? q.p : undefined;
    if (!d && !p) return null;
    return { g, m, res, ...(d ? { d } : { p }) };
  }
  if (g === 'sheet') {
    const b = int(q.b, 1, 99999), t = int(q.t, 0, 359999), n = int(q.n, 1, 99);
    return b == null || t == null || n == null ? null : { g, b, t, n };
  }
  return null;
}

export function scoreQuery(s: Score): string {
  const q = new URLSearchParams({ g: s.g });
  if (s.g === 'stack') { q.set('n', String(s.n)); q.set('h', String(s.h)); }
  if (s.g === 'nail') { q.set('n', String(s.n)); q.set('lv', String(s.lv)); }
  if (s.g === 'measure') { q.set('m', String(s.m)); if (s.d) q.set('d', s.d); else if (s.p) q.set('p', s.p); q.set('r', s.res.join('.')); }
  if (s.g === 'sheet') { q.set('b', String(s.b)); q.set('t', String(s.t)); q.set('n', String(s.n)); }
  return q.toString();
}

export const scoreUrl = (s: Score) => `${SITE}${GAMES_PAGE}/beat?${scoreQuery(s)}`;

/* London's calendar day, and Sheet Saver's board number for it (board 112 was Sunday 25 October 2026). */
export function londonDay(at = new Date()): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const g = (t: string) => Number((p.find((x) => x.type === t) || {}).value);
  return Math.round(Date.UTC(g('year'), g('month') - 1, g('day')) / 86400000);
}
export const dailyBoard = (at = new Date()) => londonDay(at) - Math.round(Date.UTC(2026, 6, 5) / 86400000);
export function londonKey(at = new Date()): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const g = (t: string) => (p.find((x) => x.type === t) || {}).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
// '2026-10-25' as 'Sun 25 Oct'
export function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
export const metres = (mm: number) => (mm / 1000).toFixed(2) + ' m';
const thousands = (n: number) => n.toLocaleString('en-GB');
// the same squares as the game's result card: five for spot on (5 mm or less), one for over 150 mm off
export const squares = (off: number) => {
  const n = off <= 5 ? 5 : off <= 20 ? 4 : off <= 60 ? 3 : off <= 150 ? 2 : 1;
  return '■'.repeat(n) + '□'.repeat(5 - n);
};

export const gameOf = (id: GameId) => GAMES.find((g) => g.id === id)!;

/* The words for a score: the headline on the score page and its picture, the line under it, and the message
   that goes with the link. */
export function scoreWords(s: Score): { game: string; title: string; sub: string; message: string; play: string } {
  if (s.g === 'stack') {
    const title = `${s.n} board${s.n === 1 ? '' : 's'}, ${metres(s.h)} high`;
    return {
      game: 'Timber Stack',
      title,
      sub: 'Stacked in Timber Stack. Every board is 47 mm sawn timber, and what hangs over is cut off.',
      message: `I stacked ${s.n} board${s.n === 1 ? '' : 's'} of timber, ${metres(s.h)} high, in Timber Stack. Can you beat it?`,
      play: 'Play Timber Stack',
    };
  }
  if (s.g === 'nail') {
    const name = NAIL_LEVELS[s.lv - 1];
    return {
      game: 'Nail Pop',
      title: `${thousands(s.n)} nail${s.n === 1 ? '' : 's'} flush on level ${s.lv}`,
      sub: `Nail Pop, level ${s.lv}: ${name}. Knock the nails flush before they squeak, and leave the screws alone.`,
      message: `I knocked ${thousands(s.n)} nail${s.n === 1 ? '' : 's'} flush on level ${s.lv} of Nail Pop (${name}). Can you beat it?`,
      play: `Play level ${s.lv}`,
    };
  }
  if (s.g === 'measure') {
    const what = s.d ? dayLabel(s.d) : MEASURE_PACKS[s.p || ''] || 'Practice';
    return {
      game: 'Measure Up',
      title: `${thousands(s.m)} mm off over ${s.res.length} tapes`,
      sub: s.d ? `Measure Up, ${what}: ${s.res.length} tapes, the same for everyone that day.` : `Measure Up, ${what}.`,
      message: `Measure Up, ${what}: ${thousands(s.m)} mm off over ${s.res.length} tapes.\n${s.res.map(squares).join(' ')}\nCan you beat it?`,
      play: s.d ? 'Play today’s tapes' : `Play ${what}`,
    };
  }
  const daily = s.b > 30;
  const board = daily ? `today’s board (${s.b})` : `board ${s.b}`;
  const isToday = daily && s.b === dailyBoard();
  return {
    game: 'Sheet Saver',
    title: `${s.n} parts in ${clock(s.t)}`,
    sub: `Sheet Saver, ${daily ? `daily board ${s.b}` : `board ${s.b}`}: every part on one 2440 x 1220 board.`,
    message: `Sheet Saver, ${daily ? (isToday ? board : `daily board ${s.b}`) : board}: all ${s.n} parts on in ${clock(s.t)}. Can you beat it?`,
    play: daily ? 'Play today’s board' : `Play board ${s.b}`,
  };
}

/* Where the score page's button goes: the app at that game, with the level or board to start on. */
export function playHref(s: Score | null, src = 'beat'): string {
  if (!s) return `${GAMES_OPEN}?utm_source=${src}`;
  const q = new URLSearchParams({ utm_source: src });
  if (s.g === 'stack') q.set('play', 'stack:0');
  if (s.g === 'nail') q.set('play', `nail:${s.lv}`);
  if (s.g === 'measure') q.set('play', `measure:${s.d ? 'daily' : s.p}`);
  if (s.g === 'sheet') q.set('play', `sheet:${s.b > 30 ? 'daily' : s.b}`);
  return `${GAMES_OPEN}?${q.toString()}#/${s.g}`;
}

/* ?play=<game>:<level> on the app's address: the level picked before the game opens (each game reads its own). */
export function playKey(v: string | null): { key: string; value: string } | null {
  const m = /^(stack|nail|measure|sheet):([a-z0-9]{1,12})$/.exec(v || '');
  if (!m) return null;
  const [, g, lv] = m;
  if (g === 'stack' && /^(0|[1-9]|10)$/.test(lv)) return { key: 'raf_games_level_stack', value: lv };
  if (g === 'nail' && Number(lv) >= 1 && Number(lv) <= NAIL_LEVELS.length) return { key: 'raf_games_level_nail', value: lv };
  if (g === 'measure' && (lv === 'daily' || MEASURE_PACKS[lv])) return { key: 'raf_games_level_measure', value: lv };
  if (g === 'sheet' && (lv === 'daily' || (Number(lv) >= 1 && Number(lv) <= 30))) return { key: 'raf_games_level_sheet', value: lv };
  return null;
}

/* Stills of the app for its page (taken from the app with Playwright as an iPhone 13, 25 Oct 2026; 780 x 1688). */
export const GAMES_SCREENS = {
  home: { src: '/images/tools/games/screen-home-22a164ea.jpg', alt: 'Workshop Games on a phone: today’s Measure Up and Sheet Saver at the top, then all four games.' },
  stack: { src: '/images/tools/games/screen-stack-5829dee0.jpg', alt: 'Timber Stack: nine boards stacked past seat height, the tape measure up the side reading 470 mm.' },
  nail: { src: '/images/tools/games/screen-nail-825ad045.jpg', alt: 'Nail Pop, level 1: old oak floorboards with nails popping up to knock back in.' },
  measure: { src: '/images/tools/games/screen-measure-9a78ef25.jpg', alt: 'Measure Up: how tall is a metric door? The top is hidden and the tape is ready to pull up.' },
  sheet: { src: '/images/tools/games/screen-sheet-69874f41.jpg', alt: 'Sheet Saver, daily board 112: an empty 2440 by 1220 board and six parts to fit on it.' },
  og: '/images/tools/games/og-de504ef0.jpg',
  w: 780,
  h: 1688,
};

export const GAMES_ICON = '/images/tools/games/icon-192.png';
