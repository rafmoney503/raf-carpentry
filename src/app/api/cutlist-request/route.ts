import { StatsError, statsRpc, statsSetUp } from '@/lib/site-stats-server';
import { plannerDesign, requestCutlistFromCabinetOS } from '@/lib/cabinetos-inbound';

/* The wardrobe planner's 'Get the cut list for this design' (planner-engine.ts, Send step). Keeps the email and the
   design (rafsite.cutlist_requests through public.rafsite_cutlist, the visit counter's secret) for the Job Kit's
   Website stats, then asks CabinetOS to work the cut list out and email it (requestCutlistFromCabinetOS); a sent
   one is marked sent with its parts and boards. Answers { sent, parts, boards } (sent false = kept, not emailed:
   Raf sees it in the Job Kit). The same email and design twice in a day isn't emailed twice. */
export const maxDuration = 40;

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
  let id: number | null = null;
  try {
    const added = await statsRpc<{ id?: number; again?: boolean; sent?: boolean; parts?: number | null; boards?: number | null }>('rafsite_cutlist', {
      p_action: 'add',
      p: {
        email,
        summary,
        design,
        country: (req.headers.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 4),
        host: (req.headers.get('host') || '').slice(0, 120),
      },
    });
    if (added?.again && added.sent) return Response.json({ sent: true, again: true, parts: added.parts ?? null, boards: added.boards ?? null });
    id = typeof added?.id === 'number' ? added.id : null;
  } catch (e) {
    return Response.json({ error: e instanceof StatsError ? e.code : 'stats-down' }, { status: 502 });
  }
  const forCabinetOS = plannerDesign(design);
  if (!forCabinetOS) return Response.json({ sent: false });
  const cut = await requestCutlistFromCabinetOS(forCabinetOS, email, (req.headers.get('host') || '').slice(0, 120));
  if (!cut.ok || !cut.sent) {
    if (!cut.ok) console.error('[cutlist] CabinetOS', cut.reason);
    return Response.json({ sent: false });
  }
  if (id !== null) {
    await statsRpc('rafsite_cutlist', { p_action: 'sent', p: { id, parts: cut.parts, boards: cut.boards, token: cut.token } }).catch(() => {});
  }
  return Response.json({ sent: true, parts: cut.parts, boards: cut.boards });
}
