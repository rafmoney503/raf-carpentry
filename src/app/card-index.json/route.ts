import { buildCardIndex } from '@/lib/suggest-card';

/* /card-index.json: what the small card bottom left may suggest on each page (src/lib/suggest-card.ts), made at
   deploy time and fetched by src/components/RecentDesign.tsx only when the card is about to show. */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(buildCardIndex());
}
