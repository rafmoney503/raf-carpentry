import { pinGuard } from '@/lib/job-kit-server';
import { SyncError, syncSetUp } from '@/lib/job-kit-sync-server';
import { aiRpc, consoleSpentSince } from '@/lib/ai-usage';

/* Claude credit in the Job Kit, behind the PIN (src/lib/ai-usage.ts, src/app/job-kit/claude-credit.tsx).
   { action: 'status' }               the balance Raf last typed, what's been used since and this month, the last
                                      refusals; plus `console`: what the Claude Console counts as spent since he
                                      typed it, when ANTHROPIC_ADMIN_KEY is set
   { action: 'credit', balance, warn } what the Console shows now (dollars), and when to warn him
   { action: 'warn', warn }           only when to warn him */
const noStore = { 'Cache-Control': 'no-store' };
const money = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 100) / 100 : null);

export async function POST(req: Request) {
  const stop = await pinGuard(req);
  if (stop) return stop;
  if (!syncSetUp()) return Response.json({ error: 'credit-not-set-up' }, { status: 503, headers: noStore });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  try {
    if (body.action === 'status') {
      const s = (await aiRpc('status')) as { credit?: { at?: number } | null };
      const at = Number(s.credit?.at) || 0;
      const consoleSpent = at ? await consoleSpentSince(at) : null;
      return Response.json({ ...s, console: consoleSpent, admin: Boolean(process.env.ANTHROPIC_ADMIN_KEY) }, { headers: noStore });
    }
    if (body.action === 'credit') {
      const balance = money(body.balance, 100000);
      const warn = money(body.warn, 10000) ?? 5;
      if (balance === null) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      return Response.json(await aiRpc('credit', { balance, warn }), { headers: noStore });
    }
    if (body.action === 'warn') {
      const warn = money(body.warn, 10000);
      if (warn === null) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
      return Response.json(await aiRpc('warn', { warn }), { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'sync-down';
    if (!(e instanceof SyncError)) console.error('job-kit claude', e);
    return Response.json({ error: code }, { status: 502, headers: noStore });
  }
}
