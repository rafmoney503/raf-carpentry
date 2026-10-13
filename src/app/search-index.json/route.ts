import { buildSearchIndex } from '@/lib/site-search';

/* /search-index.json: everything the menu search looks through (src/lib/site-search.ts), made at deploy time. */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(buildSearchIndex());
}
