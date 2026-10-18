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
export type Goal = 'quote' | 'send' | 'call' | 'whatsapp' | 'email' | 'planner';
export const GOAL_LABEL: Record<Goal, string> = {
  quote: 'Get a quote',
  send: 'Send to Raf',
  call: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  planner: 'Wardrobe planner',
};
export function goalOf(href: string, text: string): Goal | '' {
  const h = href.toLowerCase();
  if (h.startsWith('tel:')) return 'call';
  if (h.startsWith('mailto:')) return 'email';
  if (h.includes('wa.me/') || h.includes('whatsapp.com')) return 'whatsapp';
  if (/^send to raf\b/i.test(text.trim())) return 'send';
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
   page (y in px, of a page docH tall), its label and what it was for. s finds the element again in the Job Kit. */
export type Tap = { s: string; fx: number; fy: number; x: number; y: number; h: number; t: string; g?: Goal | '' };

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
};

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
};
