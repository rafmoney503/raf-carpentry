import { jobkitRpc, syncSetUp } from './job-kit-sync-server';

/* Claude credit in the Job Kit (Raf, 3 Nov 2026: 'i'd like to have in job kit the status of account with claude
   regarding creating notes and designs to see when i need to top up'). Anthropic's API has no way to read the
   prepaid credit balance, so every Claude call the website makes is noted here with its tokens and what it cost
   at list price, and an out-of-credit refusal is noted too; Raf types the balance the Claude Console shows when he
   tops up, and the Job Kit works out what's left (src/app/job-kit/claude-credit.tsx). Supabase jobkit.ai_uses
   through public.jobkit_ai. Noting never stops or slows a call by more than 3 s, and never throws. */

export type Feature = 'quotes' | 'design' | 'draft' | 'pots' | 'receipts' | 'assistant' | 'review' | 'whatsapp';

/* List prices in US dollars a million tokens (Anthropic's pricing page, checked 3 Nov 2026: Sonnet 5 and 5.5
   $2 in, $10 out, cache reads $0.20, 5-minute cache writes $2.50). Any other model is counted at Sonnet's prices. */
const PRICE = { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 };

type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
export function costOf(u: Usage): number {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  return (n(u.input_tokens) * PRICE.in + n(u.output_tokens) * PRICE.out + n(u.cache_read_input_tokens) * PRICE.cacheRead + n(u.cache_creation_input_tokens) * PRICE.cacheWrite) / 1e6;
}
export const REFUSED = /credit balance|usage limit|spend limit/i;

/* After a call: what it cost, or that Claude turned it down for credit. `text` is the raw answer. */
export async function noteClaude(feature: Feature, model: string, status: number, text: string): Promise<void> {
  if (!syncSetUp()) return;
  try {
    let p: Record<string, unknown> | null = null;
    if (REFUSED.test(text) && status >= 400) p = { feature, model, refused: true };
    else if (status >= 200 && status < 300) {
      const body = JSON.parse(text) as { usage?: Usage; model?: string };
      const u = body.usage ?? {};
      p = { feature, model: body.model || model, in: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), out: u.output_tokens ?? 0, cost: Math.round(costOf(u) * 1e6) / 1e6 };
    }
    if (p) await jobkitRpc('jobkit_ai', { p_action: 'log', p }, 3000);
  } catch {
    /* noting is best effort */
  }
}

export const aiRpc = (action: string, p: Record<string, unknown> = {}) => jobkitRpc('jobkit_ai', { p_action: action, p }, 10000);

/* With an Admin API key (ANTHROPIC_ADMIN_KEY, sk-ant-admin..., made by an admin in the Claude Console), what the
   Console itself counts as spent since a time, in dollars: the Cost report, which covers everything on the account,
   not only the website. Null when there's no key or it can't be read. */
export async function consoleSpentSince(sinceMs: number): Promise<number | null> {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) return null;
  const base = (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/+$/, '');
  const start = new Date(Math.max(sinceMs, Date.now() - 31 * 864e5));
  start.setUTCHours(0, 0, 0, 0); // the report's days run midnight to midnight UTC
  let total = 0;
  let page = '';
  try {
    for (let i = 0; i < 5; i++) {
      const q = new URLSearchParams({ starting_at: start.toISOString().replace(/\.\d+Z$/, 'Z'), bucket_width: '1d', limit: '31' });
      if (page) q.set('page', page);
      const res = await fetch(`${base}/v1/organizations/cost_report?${q}`, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { results?: { amount?: string | number; currency?: string }[] }[]; has_more?: boolean; next_page?: string };
      for (const b of body.data ?? []) for (const r of b.results ?? []) total += Number(r.amount) || 0; // cents, as a decimal string
      if (!body.has_more || !body.next_page) break;
      page = body.next_page;
    }
    return total / 100;
  } catch {
    return null;
  }
}
