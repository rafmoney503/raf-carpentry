import { StatsError, statsRpc, statsSetUp } from '@/lib/site-stats-server';

/* The wardrobe planner's 'Get the cut list for this design' (planner-engine.ts, Send step). The cut list isn't sold
   yet: this keeps the email and the design (rafsite.cutlist_requests through public.rafsite_cutlist, the visit
   counter's secret) so Raf can send it when it's ready, and so the Job Kit's Website stats can count who asked.
   Answers 204 when kept; the same email and design twice in a day is kept once. */
export const maxDuration = 15;

const recent = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return times.length > 5;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  // Bots: the hidden box filled in, or sent within 4 s of opening the planner. They get an ordinary answer.
  if ((typeof b.company === 'string' && b.company.trim()) || (typeof b.ms === 'number' && b.ms < 4000)) return new Response(null, { status: 204 });
  const email = typeof b.email === 'string' ? b.email.trim().slice(0, 254) : '';
  if (!EMAIL.test(email)) return Response.json({ error: 'email' }, { status: 400 });
  const summary = typeof b.summary === 'string' ? b.summary.slice(0, 4000) : '';
  if (!summary) return Response.json({ error: 'bad' }, { status: 400 });
  const design = b.design && typeof b.design === 'object' && JSON.stringify(b.design).length < 60_000 ? b.design : null;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return Response.json({ error: 'busy' }, { status: 429 });
  if (!statsSetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  try {
    await statsRpc('rafsite_cutlist', {
      p_action: 'add',
      p: {
        email,
        summary,
        design,
        country: (req.headers.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 4),
        host: (req.headers.get('host') || '').slice(0, 120),
      },
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    return Response.json({ error: e instanceof StatsError ? e.code : 'stats-down' }, { status: 502 });
  }
}
