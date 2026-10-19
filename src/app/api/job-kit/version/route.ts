/* Which build of the Job Kit is live (src/app/job-kit/update.ts compares it with its own). JK_BUILD is put in at
   build time (next.config.ts); JK_LIVE stands in for a newer one in tests. Nothing private: a build id. */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ v: process.env.JK_LIVE || process.env.JK_BUILD || '' }, { headers: { 'Cache-Control': 'no-store' } });
}
