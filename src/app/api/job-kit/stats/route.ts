import { guard } from '@/lib/job-kit-server';
import { StatsError, statsRpc, statsSetUp } from '@/lib/site-stats-server';

/* The Job Kit's Website stats screen (src/app/job-kit/stats.tsx), behind the PIN.
   { action: 'report', days }                  the numbers, sources, pages and journeys for the last `days` days
   { action: 'page', path, device?, days }     one page: taps, how far down people got, time, where they came from and went */
export const maxDuration = 20;

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  if (!statsSetUp()) return Response.json({ error: 'stats-not-set-up' }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const days = Math.max(1, Math.min(400, Math.floor(Number(body.days) || 30)));
  try {
    if (body.action === 'report') return Response.json({ report: await statsRpc('rafsite_report', { p_days: days }), at: Date.now() }, { headers: noStore });
    if (body.action === 'page') {
      const path = typeof body.path === 'string' ? body.path.slice(0, 200) : '';
      if (!/^\/[\w\-./~%@]*$/.test(path)) return Response.json({ error: 'bad' }, { status: 400 });
      const device = body.device === 'phone' || body.device === 'tablet' || body.device === 'computer' ? body.device : null;
      return Response.json({ page: await statsRpc('rafsite_page', { p_path: path, p_device: device, p_days: days }), at: Date.now() }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    const code = e instanceof StatsError ? e.code : 'stats-down';
    return Response.json({ error: code }, { status: 502, headers: noStore });
  }
}
