/* Runs before `next build`: with GOOGLE_PLACES_API_KEY set, saves the live Google rating, count and reviews to
   content/pages/google-reviews.json, which src/lib/reviews.ts uses in place of the typed-in ones.
   Without the key, or if Google doesn't answer, it leaves whatever is there and the build goes on. */
import fs from 'node:fs';
import { fetchGoogleReviews, FILE } from '../src/lib/google-reviews-fetch.mjs';

const key = process.env.GOOGLE_PLACES_API_KEY;
if (!key) {
  console.log('google-reviews: no GOOGLE_PLACES_API_KEY, using the typed-in reviews');
} else {
  try {
    const d = await fetchGoogleReviews(key, { api: process.env.GOOGLE_PLACES_API || undefined });
    fs.writeFileSync(FILE, JSON.stringify({ ...d, savedAt: new Date().toISOString() }, null, 2) + '\n');
    console.log(`google-reviews: ${d.rating} from ${d.count} reviews, ${d.reviews.length} review texts saved`);
  } catch (e) {
    console.warn(`google-reviews: kept the last ones (${e instanceof Error ? e.message : e})`);
  }
}
