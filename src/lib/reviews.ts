import fs from 'fs';
import path from 'path';
import { readPageJson } from './pages';

/* Customer reviews. The rating, the count and the newest reviews come from Google by themselves
   (content/pages/google-reviews.json, saved at each build by scripts/google-reviews.mjs and checked daily by
   /api/reviews/refresh). The ones typed in TinaCMS ("Reviews") come after them, and are all there is
   (with the typed-in rating and count) when Google's file isn't there. */

export type Review = { name: string; area?: string; text: string; stars?: number; job?: string; uri?: string; when?: string };
export type ReviewsData = { heading: string; intro: string; googleRating: string; googleCount: string; reviews: Review[]; live?: boolean;
  /* Which job a Google review is about (by the reviewer's name as Google shows it), set in TinaCMS. */
  googleJobs?: { name: string; job: string }[] };
type GoogleFile = { rating: number; count: number; reviews: { name: string; uri: string; stars: number; text: string; when: string }[] };

/* Cards show Google's 4 and 5 star reviews; the rating and count above them are the whole profile's. */
const MIN_STARS = 4;

function googleFile(): GoogleFile | null {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/pages/google-reviews.json'), 'utf-8')) as GoogleFile;
    return d && d.rating > 0 && d.count > 0 ? d : null;
  } catch {
    return null;
  }
}

/* Long Google reviews are cut on a word with … (the name links to the whole review on Google). */
const MAX_CHARS = 320;
const clip = (t: string) => {
  const s = t.trim().replace(/\s+/g, ' ');
  if (s.length <= MAX_CHARS) return s;
  return s.slice(0, s.lastIndexOf(' ', MAX_CHARS)).replace(/[,.;:!?\s]+$/, '') + '…';
};

const firstName = (n: string) => n.trim().split(/\s+/)[0]?.toLowerCase() ?? '';

export function getReviews(): ReviewsData {
  const d = readPageJson<ReviewsData>('reviews.json');
  const typed = (d.reviews ?? []).filter((r) => r?.text?.trim());
  const g = googleFile();
  if (!g) return { ...d, reviews: typed };
  const links = (d.googleJobs ?? []).filter((l) => l?.name?.trim() && l?.job?.trim());
  const norm = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');
  const jobOf = (n: string) =>
    links.find((l) => norm(l.name) === norm(n))?.job.trim() ?? links.find((l) => firstName(l.name) === firstName(n) && !l.name.trim().includes(' '))?.job.trim();
  const fromGoogle: Review[] = g.reviews
    .filter((r) => r.stars >= MIN_STARS && r.text.trim())
    .map((r) => ({ name: r.name, text: clip(r.text), stars: r.stars, uri: r.uri || undefined, when: r.when || undefined, job: jobOf(r.name) }));
  const seen = new Set(fromGoogle.map((r) => firstName(r.name)));
  return {
    ...d,
    googleRating: g.rating.toFixed(1),
    googleCount: String(g.count),
    reviews: [...fromGoogle, ...typed.filter((r) => !seen.has(firstName(r.name)))],
    live: true,
  };
}

/* What a review or a job is about, so a wardrobe job shows the wardrobe review first. */
const TOPICS: RegExp[] = [/wardrobe/i, /book(shel|case)|shel(f|v)/i, /panel/i, /kitchen|pantry/i, /door/i, /cabinet|cupboard/i, /desk|office/i, /seat|bench/i, /stud|partition|built walls/i, /flooring|floorboard/i];
/* The review wall's filter chips, one per topic above. */
const TOPIC_NAMES = ['Wardrobes', 'Bookcases', 'Panelling', 'Kitchens', 'Doors', 'Cupboards', 'Desks', 'Seats', 'Walls', 'Floors'];
export const topicNames = (text: string) => TOPICS.flatMap((t, i) => (t.test(text) ? [TOPIC_NAMES[i]] : []));
const topicsOf = (text: string) => TOPICS.filter((t) => t.test(text));

/* Up to `max` reviews: one linked to this job first, then the ones about the same kind of work
   (the job's type and title count double, its tags once), then the rest in TinaCMS order. */
export type JobForReviews = { slug: string; main: string; tags: string };
export function pickReviews(all: Review[], max: number, job?: JobForReviews) {
  if (!job) return all.slice(0, max);
  const main = topicsOf(job.main);
  const extra = topicsOf(job.tags);
  const score = (r: Review) =>
    (r.job === job.slug ? 100 : 0) + topicsOf(r.text).reduce((n, t) => n + (main.includes(t) ? 2 : 0) + (extra.includes(t) ? 1 : 0), 0);
  return all
    .map((r, i) => ({ r, i, s: score(r) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, max)
    .map((x) => x.r);
}
