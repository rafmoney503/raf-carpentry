/* The sums behind HQ's Facebook section (the Cabinet OS Page, 15 Nov 2026): how the followers are going, the next
   round number and when it might come, the posting rhythm, the best post and the comments still to answer. Plain
   functions on the report from rafcarpentry.com (fbpage-types.ts), checked by `npm run check`. */
import type { PageComment, PagePost, PageReport } from './fbpage-types';
import { addDays, londonDay, londonMidnight } from './time';

export const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

export type FbDay = { day: string; followers: number | null; gained: number | null };
export type FbProgress = {
  followers: number | null;
  started: string | null; // the Page's first day HQ knows: its first post, or the first day counted
  since: string | null; // the first day counted
  dayN: number | null; // day 1 = started
  yesterday: number | null; // followers gained since yesterday's count
  week: { change: number; from: string; full: boolean } | null; // on the count 7 days ago (full), or the first count
  next: { at: number; prev: number; left: number; share: number; inDays: number | null } | null;
  days: FbDay[]; // up to the last 30 days, from the first count
  postsWeek: number;
  postsBefore: number;
  lastPost: { days: number; at: number } | null;
  perPost: { reactions: number; comments: number; shares: number } | null;
  totals: { posts: number; reactions: number; comments: number; shares: number };
  best: PagePost | null;
  toAnswer: PageComment[];
};

const between = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
const score = (p: PagePost) => p.reactions + 2 * p.comments + 3 * p.shares;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function fbProgress(r: PageReport, today: string = londonDay()): FbProgress {
  const known = r.history.filter((h) => typeof h.followers === 'number' && h.day <= today).sort((a, b) => (a.day < b.day ? -1 : 1)) as { day: string; followers: number }[];
  const followers = typeof r.page?.followers === 'number' ? r.page.followers : (known.at(-1)?.followers ?? null);
  const onOrBefore = (day: string) => [...known].reverse().find((h) => h.day <= day) ?? null;
  const since = known[0]?.day ?? null;
  const firstPost = r.posts.length ? londonDay(new Date(Math.min(...r.posts.map((p) => p.at).filter((t) => t > 0)))) : null;
  const started = [since, firstPost].filter((x): x is string => Boolean(x)).sort()[0] ?? null;

  let yesterday: number | null = null;
  let week: FbProgress['week'] = null;
  let next: FbProgress['next'] = null;
  if (followers !== null) {
    const y = onOrBefore(addDays(today, -1));
    if (y) yesterday = followers - y.followers;
    const w = onOrBefore(addDays(today, -7));
    const first = known.find((h) => h.day < today);
    if (w) week = { change: followers - w.followers, from: w.day, full: true };
    else if (first) week = { change: followers - first.followers, from: first.day, full: false };
    const at = MILESTONES.find((m) => m > followers) ?? Math.ceil((followers + 1) / 100000) * 100000;
    const prev = [...MILESTONES].reverse().find((m) => m <= followers) ?? 0;
    // the pace over the last 14 days, when at least 2 days of it are known
    const base = known.find((h) => h.day >= addDays(today, -14) && h.day < today);
    const span = base ? between(base.day, today) : 0;
    const pace = base && span >= 2 ? (followers - base.followers) / span : 0;
    next = { at, prev, left: at - followers, share: (followers - prev) / (at - prev), inDays: pace > 0 ? Math.ceil((at - followers) / pace) : null };
  }

  const days: FbDay[] = [];
  if (since) {
    let prev: number | null = onOrBefore(addDays(since, -1))?.followers ?? null;
    for (let d = since < addDays(today, -29) ? addDays(today, -29) : since; d <= today; d = addDays(d, 1)) {
      if (prev === null && d > since) prev = onOrBefore(addDays(d, -1))?.followers ?? null;
      const v = d === today && followers !== null ? followers : (known.find((h) => h.day === d)?.followers ?? null);
      days.push({ day: d, followers: v, gained: v !== null && prev !== null ? v - prev : null });
      if (v !== null) prev = v;
    }
  }

  const weekStart = londonMidnight(addDays(today, -6)).getTime();
  const beforeStart = londonMidnight(addDays(today, -13)).getTime();
  const posts = r.posts.filter((p) => p.at > 0);
  const postsWeek = posts.filter((p) => p.at >= weekStart).length;
  const postsBefore = posts.filter((p) => p.at >= beforeStart && p.at < weekStart).length;
  const newest = posts.length ? Math.max(...posts.map((p) => p.at)) : 0;
  const totals = {
    posts: posts.length,
    reactions: posts.reduce((a, p) => a + p.reactions, 0),
    comments: posts.reduce((a, p) => a + p.comments, 0),
    shares: posts.reduce((a, p) => a + p.shares, 0),
  };
  const best = [...posts].sort((a, b) => score(b) - score(a) || b.at - a.at)[0];
  return {
    followers,
    started,
    since,
    dayN: started ? between(started, today) + 1 : null,
    yesterday,
    week,
    next,
    days,
    postsWeek,
    postsBefore,
    lastPost: newest ? { days: between(londonDay(new Date(newest)), today), at: newest } : null,
    perPost: totals.posts ? { reactions: round1(totals.reactions / totals.posts), comments: round1(totals.comments / totals.posts), shares: round1(totals.shares / totals.posts) } : null,
    totals,
    best: best && score(best) > 0 ? best : null,
    toAnswer: r.comments.filter((c) => !c.answered).sort((a, b) => b.at - a.at),
  };
}

/* '+3', '−2', 'no change' */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : 'no change';
}

/* 'today', 'yesterday', '3 days ago' */
export function daysAgo(n: number): string {
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}

/* The morning summary's line, or none when the Page couldn't be read. */
export function fbMorningLine(r: PageReport | null, today: string): string | null {
  if (!r || r.state !== 'ok' || !r.page) return null;
  const p = fbProgress(r, today);
  if (p.followers === null) return null;
  const bits = [`${r.page.name} on Facebook: ${p.followers} ${p.followers === 1 ? 'follower' : 'followers'}${p.yesterday ? ` (${signed(p.yesterday)} yesterday)` : ''}`];
  if (p.toAnswer.length) bits.push(`${p.toAnswer.length} ${p.toAnswer.length === 1 ? 'comment' : 'comments'} to answer`);
  return bits.join(' · ');
}
