/* Rafal's LinkedIn numbers (hq.linkedin, a row a day), and what the card says about them. No imports, so
   `npm run check` can test it. LinkedIn has no way for an app to read a personal profile's numbers: they are
   typed in from LinkedIn's Analytics box, or put in by Claude when it has the profile open. */

export const LINKEDIN_PROFILE = 'https://www.linkedin.com/in/rafaljanczy/';
export const LINKEDIN_ANALYTICS = 'https://www.linkedin.com/dashboard/';

export type LiKey = 'followers' | 'connections' | 'profileViews' | 'searchAppearances' | 'postImpressions';

export type LiRow = {
  day: string;
  followers: number | null;
  connections: number | null;
  profileViews: number | null;
  searchAppearances: number | null;
  postImpressions: number | null;
  source: 'typed' | 'browser';
  at: number;
};

export type LiList = { today: string; rows: LiRow[] };

/* What each number is, as LinkedIn's own Analytics box counts it. */
export const LI_FIELDS: { key: LiKey; label: string; span: string }[] = [
  { key: 'followers', label: 'Followers', span: 'in all' },
  { key: 'connections', label: 'Connections', span: 'in all' },
  { key: 'profileViews', label: 'Profile views', span: 'past 90 days' },
  { key: 'searchAppearances', label: 'Search appearances', span: 'past 7 days' },
  { key: 'postImpressions', label: 'Post impressions', span: 'past 7 days' },
];

const KEYS = LI_FIELDS.map((f) => f.key);
const MAX = 10_000_000;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX;

export function cleanList(raw: unknown): LiList | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { today?: unknown; rows?: unknown };
  if (typeof r.today !== 'string' || !Array.isArray(r.rows)) return null;
  const rows: LiRow[] = [];
  for (const x of r.rows) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.day)) continue;
    const row = { day: o.day, source: o.source === 'browser' ? 'browser' : 'typed', at: typeof o.at === 'number' ? o.at : 0 } as LiRow;
    for (const k of KEYS) row[k] = isNum(o[k]) ? (o[k] as number) : null;
    rows.push(row);
  }
  rows.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return { today: r.today, rows };
}

/* A box as typed: '' = left out, '1,530' = 1530; anything else is refused (null). */
export function readBox(s: string): number | '' | null {
  const t = s.replace(/[\s,]/g, '');
  if (!t) return '';
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= MAX ? n : null;
}

/* Days from `a` to `b` ('YYYY-MM-DD'). */
export function daysBetween(a: string, b: string): number {
  const t = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

export type LiSummary = {
  latest: LiRow;
  /* The row to compare with: the newest one at least 6 days older than the latest, else the oldest. */
  before: LiRow | null;
  /* Days since the latest numbers were put in. */
  age: number;
  /* Each number now, and its change since `before` (null when either is missing). */
  values: { key: LiKey; label: string; span: string; now: number | null; change: number | null }[];
  headline: string;
  since: string;
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function short(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MON[m - 1]}`;
}

const say = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

export function summarise(list: LiList | null): LiSummary | null {
  if (!list || !list.rows.length) return null;
  const rows = list.rows;
  const latest = rows[rows.length - 1];
  const older = rows.filter((r) => daysBetween(r.day, latest.day) >= 6);
  const before = older.length ? older[older.length - 1] : rows.length > 1 ? rows[0] : null;
  const values = LI_FIELDS.map((f) => {
    const now = latest[f.key];
    const was = before ? before[f.key] : null;
    // Followers and connections are totals, so a change means something. The others are rolling counts LinkedIn
    // works out over its own window, so they're shown as they are.
    const total = f.key === 'followers' || f.key === 'connections';
    return { key: f.key, label: f.label, span: f.span, now, change: total && now !== null && was !== null ? now - was : null };
  });
  const v = (k: LiKey) => values.find((x) => x.key === k)!;
  const parts: string[] = [];
  const fo = v('followers');
  if (fo.now !== null) parts.push(say(fo.now, 'follower'));
  const sa = v('searchAppearances');
  if (sa.now !== null) parts.push(`${say(sa.now, 'search appearance')} this week`);
  const pv = v('profileViews');
  if (pv.now !== null) parts.push(say(pv.now, 'profile view') + ' in 90 days');
  return {
    latest,
    before,
    age: daysBetween(latest.day, list.today),
    values,
    headline: parts.length ? parts.join(' · ') : 'Numbers saved',
    since: before ? short(before.day) : '',
  };
}

/* 'today', 'yesterday', '3 days ago' */
export function ageWords(age: number): string {
  if (age <= 0) return 'today';
  if (age === 1) return 'yesterday';
  return `${age} days ago`;
}

/* The numbers are worth putting in again after a week. */
export const STALE_DAYS = 7;
