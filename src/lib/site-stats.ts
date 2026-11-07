/* Website stats, shared by the visitor counter (src/components/SiteStats.tsx), its server route (/api/stats/hit),
   the privacy page's opt-out and the Job Kit's Website stats screen (src/app/job-kit/stats.tsx).
   No cookies: the browser keeps nothing except, when someone opts out (or Raf's own phone), STATS_OFF_KEY. */

export const STATS_OFF_KEY = 'raf_stats_off';

export function statsOff(): boolean {
  try {
    return localStorage.getItem(STATS_OFF_KEY) === '1';
  } catch {
    return false;
  }
}
export function setStatsOff(off: boolean) {
  try {
    if (off) localStorage.setItem(STATS_OFF_KEY, '1');
    else localStorage.removeItem(STATS_OFF_KEY);
  } catch {
    /* storage blocked: nothing to keep */
  }
}

/* What a tap was for, when it's one of the ways to get in touch (or plan a wardrobe). */
export type Goal = 'quote' | 'send' | 'call' | 'whatsapp' | 'email' | 'planner' | 'cutlist';
export const GOAL_LABEL: Record<Goal, string> = {
  quote: 'Get a quote',
  send: 'Send to Raf',
  call: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  planner: 'Wardrobe planner',
  cutlist: 'Cut list button (planner)',
};
export function goalOf(href: string, text: string): Goal | '' {
  const h = href.toLowerCase();
  if (h.startsWith('tel:')) return 'call';
  if (h.startsWith('mailto:')) return 'email';
  if (h.includes('wa.me/') || h.includes('whatsapp.com')) return 'whatsapp';
  if (/^send to raf\b/i.test(text.trim())) return 'send';
  if (/^get the cut list\b/i.test(text.trim())) return 'cutlist';
  let path = '';
  try {
    const u = new URL(href, 'https://www.rafcarpentry.com');
    if (u.hostname.endsWith('rafcarpentry.com')) path = u.pathname;
  } catch {
    /* not a link */
  }
  if (path === '/how-it-works') return 'quote';
  if (path === '/wardrobe-planner') return 'planner';
  return '';
}

/* One tap: where on the element (fx, fy as fractions), where on the screen (x as a fraction of the width) and the
   page (y in px, of a page docH tall), its label and what it was for. s finds the element again in the Job Kit.
   sv: the job it saved with a heart (its slug), for the 'Saved for a brief' line of the recently looked at card.
   cd: a tap on that small card, by what it suggested: 'app' (Workshop Tools), 'post:<slug>' or 'recent' (a job). */
export type Tap = { s: string; fx: number; fy: number; x: number; y: number; h: number; t: string; g?: Goal | ''; sv?: string; cd?: string };

/** Taps on the small card bottom left, by what it suggested (rafsite_cards). */
export type CardTaps = { days: number; app: number; recent: number; posts: { slug: string; n: number; title?: string }[]; total: number };

/* Workshop Games (/tools/games/app) is one page with the screen after '#' (#/stack, #/nail/levels ...). Since
   6 Nov 2026 each screen is counted as a page of its own, /tools/games/app/stack, so the Job Kit shows which games
   are played (Raf: 'is it possible to see which games have been used and being popular'). Before that every game
   counted as /tools/games/app. */
export const GAMES_APP = '/tools/games/app';
export const GAME_NAMES: Record<string, string> = {
  stack: 'Timber Stack',
  nail: 'Nail Pop',
  measure: 'Measure Up',
  sheet: 'Sheet Saver',
  level: 'Level Best',
  diff: 'Find the Difference',
};
const GAME_MORE: Record<string, string> = { levels: 'levels', packs: 'practice packs', boards: 'boards' };
const GAME_SCREEN = /^(stack|nail|measure|sheet|level|diff)(?:\/(levels|packs|boards))?$/;

/* The path a page view is counted under: the page's own, or a game's for the games app (unknown screens are the
   games' home screen, as the app shows it). */
export function statPath(pathname: string, hash: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p !== GAMES_APP) return p;
  const s = hash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase();
  return GAME_SCREEN.test(s) ? `${p}/${s}` : p;
}
/* Back from a counted path to the address that opens it (the Job Kit's heatmaps and its Open the page). */
export const pageHref = (path: string) => (path.startsWith(`${GAMES_APP}/`) ? `${GAMES_APP}#/${path.slice(GAMES_APP.length + 1)}` : path);
/* 'Workshop Games: Timber Stack', 'Workshop Games: Timber Stack, levels', 'Workshop Games: home screen'; null when
   the path isn't one of the games' screens. */
export function gameScreenName(path: string): string | null {
  if (path === GAMES_APP) return 'Workshop Games: home screen';
  if (!path.startsWith(`${GAMES_APP}/`)) return null;
  const m = GAME_SCREEN.exec(path.slice(GAMES_APP.length + 1));
  return m ? `Workshop Games: ${GAME_NAMES[m[1]]}${m[2] ? `, ${GAME_MORE[m[2]]}` : ''}` : null;
}

/** Workshop Games in the Job Kit (rafsite_games): who played, which games, how they found them. ms = time in use. */
export type GamesStats = {
  days: number;
  since: string;
  today: string;
  gamesFrom: string | null; // the first day a game was counted on its own
  totals: { visits: number; people: number; ms: number; pageVisits: number; home: number; installs: number; shares: number; beat: number; fromBeat: number; qr: number };
  games: { game: string; visits: number; people: number; opens: number; ms: number; levels: number; shares: number }[];
  sources: { kind: string; host: string | null; visits: number; played: number; ms: number }[];
  places: { country: string; city: string | null; visits: number; played: number; ms: number }[];
  daily: { day: string; visits: number; ms: number }[];
  latest: (Place & { at: string; device: Device | null; src: string; host: string | null; ms: number; games: string[]; shares: number; played: boolean })[];
};

export type Device = 'phone' | 'tablet' | 'computer';
export const deviceOf = (vw: number): Device => (vw < 700 ? 'phone' : vw < 1024 ? 'tablet' : 'computer');

/* What the Job Kit gets back (rafsite_report and rafsite_page in the stats database). */
export type StatsReport = {
  since: string;
  today: string;
  days: number;
  first: string | null;
  totals: { visitors: number; visits: number; views: number; engagedAvg: number; onePage: number; phone: number; tablet: number; computer: number };
  daily: { day: string; visitors: number; views: number }[];
  sources: { kind: string; visits: number }[];
  countries: { country: string; visits: number }[];
  goals: Partial<Record<Goal, number>>;
  pages: { path: string; title: string | null; views: number; visitors: number; engagedAvg: number; scrollAvg: number; entries: number; exits: number; goals: number }[];
  journeys: { paths: string[]; more: boolean; visits: number }[];
  // since 22 Oct 2026: roughly where visits came from (missing in a report from before that)
  places?: { country: string; city: string | null; visits: number; districts: { d: string; n: number }[] }[];
  placesFrom?: string | null; // the first day a place was counted
  latest?: Visit[]; // the newest 30 visits, newest first
};
/* Roughly where from, as the connection says (see placeOf in site-stats-server.ts). */
export type Place = { country?: string | null; city?: string | null; region?: string | null; district?: string | null };
export type Visit = Place & {
  at: string;
  last: string;
  device: Device | null;
  src: string;
  engaged: number;
  pages: { p: string; t: string | null; e: number }[];
  goals: Goal[];
  saves: number;
};
export type StatsPage = {
  path: string;
  device: Device | null;
  since: string;
  title: string | null;
  views: number;
  visitors: number;
  engagedAvg: number;
  scrollAvg: number;
  exits: number;
  devices: Partial<Record<Device, number>> | null;
  docH: number | null;
  vw: number | null;
  reach: number[] | null; // 21 points: the share of views that got at least 0%, 5% ... 100% of the way down
  dwell: number[]; // 20 bands: ms spent with the middle of the screen in each twentieth of the page
  clicks: Tap[];
  top: { t: string; g: Goal | null; n: number }[];
  next: { path: string; n: number }[]; // '' = left the website
  from: { from: string; n: number }[]; // 'src:google' etc. for the first page of a visit, else the page before
  // every screen size, since 22 Oct 2026: where the people who looked at it were, and its latest views
  places?: (Place & { country: string; n: number })[];
  recent?: (Place & { at: string; device: Device | null; engaged: number; scroll: number; src: string; prev: string | null })[];
};

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en-GB'], { type: 'region' });
  } catch {
    return null;
  }
})();
export const countryName = (c: string) => (c === 'GB' ? 'UK' : (() => {
  try {
    return regionNames?.of(c) ?? c;
  } catch {
    return c;
  }
})());

/* 'London N22', 'Enfield', 'Warsaw, Poland', 'Somewhere in the UK', 'Not known'. */
export function placeName(p: Place, opts: { district?: boolean } = {}) {
  const c = p.country && p.country !== '?' ? p.country : '';
  const d = opts.district === false ? '' : p.district || '';
  if (c === 'GB' || (!c && d)) return [p.city || (d ? '' : 'Somewhere in the UK'), d].filter(Boolean).join(' ');
  if (!c) return p.city || 'Not known';
  const name = countryName(c);
  return p.city ? `${p.city}${c === 'US' && p.region ? `, ${p.region}` : ''}, ${name}` : name;
}

export const SOURCE_LABEL: Record<string, string> = {
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  yahoo: 'Yahoo',
  ecosia: 'Ecosia',
  chatgpt: 'ChatGPT',
  ai: 'AI assistants',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
  whatsapp: 'WhatsApp',
  email: 'Email',
  rafalsolutions: 'rafalsolutions.co.uk',
  cabinetos: 'cabinetos.co.uk',
  directory: 'Trade directories',
  direct: 'Typed in or a saved link',
  internal: 'Back on the site later',
  other: 'Other websites',
  // Workshop Tools campaign tags (25 Oct 2026; the launch campaign doc's Tracking table)
  pwa: 'Workshop Tools, opened from the home screen',
  'qr-web': 'QR code on the Workshop Tools page',
  'qr-quote': 'QR on a quote or invoice',
  'qr-card': 'QR on a business card',
  'qr-handover': 'QR on the finished-job card',
  'qr-sticker': 'QR sticker in a door',
  'qr-van': 'QR on the van',
  'email-brief': 'Thank-you email after a brief',
  quote: 'Quote email',
  booked: 'Job booked email',
  invoice: 'Invoice email',
  review: 'Review request email',
  'launch-email': 'Launch email to past clients',
  gbp: 'Google Business posts',
  groups: 'Trade groups',
  // Workshop Games (25 Oct 2026)
  'pwa-games': 'Workshop Games, opened from the home screen',
  // the first time on that phone (6 Nov 2026): an install
  'pwa-games-new': 'Workshop Games, first opened from the home screen (installed)',
  'pwa-new': 'Workshop Tools, first opened from the home screen (installed)',
  // the simple calculator (7 Nov 2026)
  'pwa-calc': 'Simple calculator, opened from the home screen',
  beat: 'A friend’s score link (Workshop Games)',
  'qr-games': 'QR code on the Workshop Games page',
};
