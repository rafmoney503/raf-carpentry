import { ROBOT_UA, statsRpc, statsSetUp, visitorCode } from '@/lib/site-stats-server';
import { recentItems, type RecentData } from '@/lib/recent-designs';

/* For the "Looked at 40 minutes ago" card (src/components/RecentDesign.tsx): the jobs really looked at or saved in
   the last 7 days, with what to say about each, leaving out the visit of the person asking. Always answers, with an
   empty list when there's nothing true to show (or the stats database isn't set up), so the card just doesn't come. */
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

const answer = (items: unknown[]) => Response.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  if (!statsSetUp() || !ua || ROBOT_UA.test(ua)) return answer([]);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  try {
    const data = await statsRpc<RecentData>('rafsite_recent', { p: { exclude: visitorCode(ip, ua), days: 7 } }, 4000);
    return answer(data ? recentItems(data) : []);
  } catch {
    return answer([]);
  }
}
