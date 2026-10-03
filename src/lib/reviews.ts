import { readPageJson } from './pages';

/* Customer reviews, edited in TinaCMS ("Reviews"), copied from Raf's Google Business Profile.
   googleRating and googleCount are typed in by hand, so update them when new reviews come in. */

export type Review = { name: string; area?: string; text: string; stars?: number; job?: string };
export type ReviewsData = { heading: string; intro: string; googleRating: string; googleCount: string; reviews: Review[] };

export function getReviews(): ReviewsData {
  const d = readPageJson<ReviewsData>('reviews.json');
  return { ...d, reviews: (d.reviews ?? []).filter((r) => r?.text?.trim()) };
}

/* What a review or a job is about, so a wardrobe job shows the wardrobe review first. */
const TOPICS: RegExp[] = [/wardrobe/i, /book(shel|case)|shel(f|v)/i, /panel/i, /kitchen|pantry/i, /door/i, /cabinet|cupboard/i, /desk|office/i, /seat|bench/i, /stud|partition|built walls/i, /flooring|floorboard/i];
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
