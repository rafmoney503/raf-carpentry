import { recordHere, ROBOT_UA, statsRpc, statsSetUp } from '@/lib/site-stats-server';
import { readRank, rankWords, type RankCount } from '@/lib/workshop-games/site';

/* Workshop Games rankings (13 Nov 2026): a game that has just ended sends what it was and how it went (readRank in
   src/lib/workshop-games/site.ts says what each game sends); this keeps one number for it (rafsite.game_scores
   through public.rafsite_game_rank, the visit counter's secret) and answers the end card's lines,
   { line: '14th of 230 today', more: 'better than 94%', next: '31 boards gets you 13th' }. Nothing about who played
   is kept. Previews and local runs keep theirs apart (test), so they never mix into the real rankings. */

const recent = new Map<string, number[]>();
// a school class shares one connection, so this only stops floods: 300 games in 10 minutes from one address
function tooMany(ip: string): boolean {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return times.length > 300;
}

export async function POST(req: Request) {
  if (ROBOT_UA.test(req.headers.get('user-agent') || '')) return new Response(null, { status: 204 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const entry = b && typeof b === 'object' ? readRank(b) : null;
  if (!entry) return Response.json({ error: 'bad' }, { status: 400 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return Response.json({ error: 'busy' }, { status: 429 });
  if (!statsSetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  try {
    const r = await statsRpc<{ today: RankCount; all: RankCount }>(
      'rafsite_game_rank',
      { p: { game: entry.game, key: entry.key, v: entry.v, test: !recordHere(host) } },
      6000,
    );
    if (!r?.today || !r?.all) return Response.json({ error: 'stats-down' }, { status: 502 });
    return Response.json(rankWords(entry, r), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'stats-down' }, { status: 502 });
  }
}
