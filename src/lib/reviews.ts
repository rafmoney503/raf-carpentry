import { readPageJson } from './pages';

/* Customer reviews, edited in TinaCMS ("Reviews"), copied from Raf's Google Business Profile.
   googleRating and googleCount are typed in by hand, so update them when new reviews come in. */

export type Review = { name: string; area?: string; text: string; stars?: number; job?: string };
export type ReviewsData = { heading: string; intro: string; googleRating: string; googleCount: string; reviews: Review[] };

export function getReviews(): ReviewsData {
  const d = readPageJson<ReviewsData>('reviews.json');
  return { ...d, reviews: (d.reviews ?? []).filter((r) => r?.text?.trim()) };
}

/* Up to `max` reviews, the ones about this job first. */
export function pickReviews(all: Review[], max: number, jobSlug?: string) {
  const mine = jobSlug ? all.filter((r) => r.job === jobSlug) : [];
  return [...mine, ...all.filter((r) => !mine.includes(r))].slice(0, max);
}
