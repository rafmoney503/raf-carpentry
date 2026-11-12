import { timingSafeEqual } from 'node:crypto';
import { after } from 'next/server';
import { assistantSetUp, runAssistant } from '@/lib/assistant';

/* The Job Kit's assistant run (src/lib/assistant.ts), every 30 minutes: Supabase pg_cron posts here through pg_net
   with "Authorization: Bearer <ASSISTANT_SECRET>" (kept in Supabase's Vault as assistant_run_secret). It answers at
   once (pg_net doesn't wait long) and runs after the answer. */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const allowed = (req: Request) => {
  const secret = process.env.ASSISTANT_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') || '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
};

export async function POST(req: Request) {
  if (!process.env.ASSISTANT_SECRET) return Response.json({ error: 'not-set-up' }, { status: 503 });
  if (!allowed(req)) return Response.json({ error: 'not-allowed' }, { status: 401 });
  if (!assistantSetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  after(() => runAssistant('cron').catch((e) => console.error('assistant cron', e)));
  return Response.json({ state: 'started' }, { status: 202 });
}
