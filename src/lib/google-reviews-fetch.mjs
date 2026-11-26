/* The Google rating, review count and the reviews Google gives for Raf's Business Profile, from the Places API (New):
   GET places.googleapis.com/v1/places/<place id> with the field mask rating,userRatingCount,reviews.
   Google returns at most 5 reviews (its "most relevant"). Plain JavaScript so the build script
   (scripts/google-reviews.mjs) and the daily check (/api/reviews/refresh) share it. */

export const PLACE_ID = 'ChIJOZ8b3lgZdkgRGsfKVoPIUDc';
export const FILE = 'content/pages/google-reviews.json';

/** @returns {Promise<{rating: number, count: number, reviews: {name: string, uri: string, stars: number, text: string, when: string, at: string}[]}>} */
export async function fetchGoogleReviews(key, { api = 'https://places.googleapis.com', timeoutMs = 10000 } = {}) {
  const res = await fetch(`${api}/v1/places/${PLACE_ID}?languageCode=en&regionCode=GB`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`google ${res.status}: ${body?.error?.message ?? 'no answer'}`);
  const rating = Number(body.rating);
  const count = Number(body.userRatingCount);
  if (!(rating > 0 && rating <= 5) || !(count > 0)) throw new Error('google: no rating in the answer');
  const reviews = (body.reviews ?? [])
    .map((r) => ({
      name: String(r.authorAttribution?.displayName ?? '').trim(),
      uri: String(r.authorAttribution?.uri ?? r.googleMapsUri ?? ''),
      stars: Number(r.rating) || 0,
      text: String(r.originalText?.text ?? r.text?.text ?? '').trim(),
      when: String(r.relativePublishTimeDescription ?? ''),
      at: String(r.publishTime ?? ''),
    }))
    .filter((r) => r.name && r.text);
  return { rating, count, reviews };
}

/* What a page shows, without the times (so "3 weeks ago" becoming "a month ago" isn't a change worth a rebuild). */
export const sameReviews = (a, b) =>
  JSON.stringify(a && [a.rating, a.count, a.reviews.map((r) => [r.name, r.stars, r.text])]) ===
  JSON.stringify(b && [b.rating, b.count, b.reviews.map((r) => [r.name, r.stars, r.text])]);
