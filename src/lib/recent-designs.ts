import { getAllProjects, modelOf } from './projects';
import { kindForJob } from './design-library';

/* The small "Looked at 40 minutes ago" card (src/components/RecentDesign.tsx), made only from what really
   happened: views of job pages and saves (the heart) counted by the website's own visit counter in the last
   7 days (rafsite_recent in the stats database), never who looked or where from. The visitor asking is left
   out, so nobody is shown their own visit. Each item links to the job's 3D view on the Designs in 3D page. */

export type RecentRow = { slug: string; last: string; views?: number; visits?: number; saves?: number };
export type RecentData = { now: string; views: RecentRow[]; saves: RecentRow[] };
export type RecentItem = { slug: string; title: string; area: string; poster: string; href: string; line: string };

const MIN = 60_000;
const HOUR = 60 * MIN;

/* "a few minutes ago", "40 minutes ago", "an hour ago", "5 hours ago", "yesterday"; null when longer ago. */
export function agoWords(ms: number): string | null {
  if (ms < 0) ms = 0;
  if (ms < 15 * MIN) return 'a few minutes ago';
  if (ms < 58 * MIN) return `${Math.round(ms / (5 * MIN)) * 5} minutes ago`;
  if (ms < 2 * HOUR) return 'an hour ago';
  if (ms < 24 * HOUR) return `${Math.floor(ms / HOUR)} hours ago`;
  if (ms < 48 * HOUR) return 'yesterday';
  return null;
}

/* What the card says about one job, from its views and saves: a save counts for more than a look. */
export function recentLine(now: number, view?: RecentRow, save?: RecentRow): string | null {
  const saves = save?.saves ?? 0;
  if (saves >= 2) return `Saved for a brief ${saves === 2 ? 'twice' : `${saves} times`} in the past week`;
  if (saves === 1 && save) {
    const a = agoWords(now - Date.parse(save.last));
    return a ? `Saved for a brief ${a}` : 'Saved for a brief in the past week';
  }
  if (!view) return null;
  const a = agoWords(now - Date.parse(view.last));
  if (a) return `Looked at ${a}`;
  const n = view.visits ?? 0;
  return n >= 2 ? `Looked at ${n === 2 ? 'twice' : `${n} times`} in the past week` : 'Looked at in the past week';
}

export function recentItems(data: RecentData): RecentItem[] {
  const now = Date.parse(data.now) || Date.now();
  const views = new Map(data.views.map((r) => [r.slug, r]));
  const saves = new Map(data.saves.map((r) => [r.slug, r]));
  const slugs = [...new Set([...data.saves.map((r) => r.slug), ...data.views.map((r) => r.slug)])];
  const jobs = new Map(getAllProjects().map((p) => [p.slug, p]));
  return slugs.flatMap((slug) => {
    const p = jobs.get(slug);
    const model = p ? modelOf(p) : undefined;
    const line = recentLine(now, views.get(slug), saves.get(slug));
    if (!p || !model || !line) return [];
    const k = kindForJob(p);
    return [{ slug, title: p.title, area: p.area, poster: model.poster.src, href: k ? `/designs/${k.slug}#${slug}` : `/portfolio/${slug}#in-3d`, line }];
  });
}
