import { GOOGLE_WRITE_REVIEW_URL } from '@/lib/site';

/* rafcarpentry.com/review/google opens Google's "write a review" box for RAF CARPENTRY.
   Printed QR codes and cards point here rather than at Google directly, so if Google ever
   changes the link, only GOOGLE_WRITE_REVIEW_URL needs updating and the printed cards keep working. */
export function GET() {
  return new Response(null, { status: 307, headers: { Location: GOOGLE_WRITE_REVIEW_URL, 'Cache-Control': 'no-store' } });
}
