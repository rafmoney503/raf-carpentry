import { sm8SetUp, Sm8Error } from '@/lib/servicem8';
import { OrderError, startOrder } from '@/lib/drawings-order';
import { stripeSetUp } from '@/lib/stripe-checkout';

/* Drawings service, step 1: the order form becomes a Quote job in ServiceM8 ("Drawings order ... Not paid yet") and
   the answer is a token for adding its files (/api/drawings/file) and paying (/api/drawings/pay). Public, so the same
   guards as Send to Raf: a hidden box bots fill in, a minimum time on the page and a few orders per address per
   10 minutes; a bot gets an ordinary-looking answer and nothing is made. */
export const maxDuration = 30;

const MIN_MS = 6000;
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 2000) recent.clear();
  return list.length > 4;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  if ((typeof body.company === 'string' && body.company.trim()) || Number(body.ms) < MIN_MS) return Response.json({ ok: true, token: '', files: 0, total: 0 });
  if (!sm8SetUp() || !stripeSetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return Response.json({ error: 'busy' }, { status: 429 });
  try {
    return Response.json({ ok: true, ...(await startOrder(body)) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.code }, { status: e.status });
    const code = e instanceof Sm8Error ? e.code : 'error';
    return Response.json({ error: code }, { status: e instanceof Sm8Error && e.status === 429 ? 429 : 502 });
  }
}
