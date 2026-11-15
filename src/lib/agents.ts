import 'server-only';
import { cleanAgent, cleanList, needCount, type Agent, type AgentList } from './agents-types';

/* HQ's agents, kept in Supabase (hq.agents and friends, migration 'hq_agents') and read and changed through
   public.hq_agents behind HQ_DB_SECRET. The agents themselves are the scheduled Claude task 'HQ agents', which works
   with the Supabase connector (see supabase/hq-agents.sql and AGENTS.md). */

async function call(action: string, p: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(`${process.env.HQ_SUPABASE_URL}/rest/v1/rpc/hq_agents`, {
    method: 'POST',
    headers: { apikey: process.env.HQ_SUPABASE_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: process.env.HQ_DB_SECRET, p_action: action, p }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) throw new AgentsError('missing');
  if (res.status === 400) {
    const t = await res.text().catch(() => '');
    throw new AgentsError(/not allowed/.test(t) ? 'key' : 'bad', t.match(/"message":"([^"]+)"/)?.[1] ?? '');
  }
  if (!res.ok) throw new AgentsError('down');
  return res.json();
}

export class AgentsError extends Error {
  constructor(
    public code: 'missing' | 'key' | 'bad' | 'down',
    public detail = '',
  ) {
    super(code);
  }
}

/* Everything for the Agents screens; null when it can't be read. */
export async function agentList(): Promise<AgentList | null> {
  try {
    return cleanList(await call('list'));
  } catch {
    return null;
  }
}

export type AgentAction =
  | { action: 'job_add'; agent: string; text: string; repeat: string; weekday?: number; onDay?: string }
  | { action: 'job_cancel'; id: number }
  | { action: 'need_mark'; id: number; status: string }
  | { action: 'note_add'; agent: string; text: string }
  | { action: 'note_edit'; id: number; text: string }
  | { action: 'note_gone'; id: number }
  | { action: 'settings'; agent: string; may?: string; paused?: boolean; brief?: string };

/* One change; answers the agent as it is now. */
export async function agentAction(a: AgentAction): Promise<Agent | null> {
  const { action, ...p } = a;
  return cleanAgent(await call(action, p));
}

/* How many things need Rafal, for the tab's badge: kept a minute per server (on globalThis, as the pages and API routes
   are bundled apart), and forgotten after a change from the Agents screens. */
const box = globalThis as typeof globalThis & { __hqAgentNeeds?: { at: number; n: Promise<number> } | null };
export function forgetAgentCount() {
  box.__hqAgentNeeds = null;
}
export function agentNeedCount(): Promise<number> {
  const kept = box.__hqAgentNeeds;
  if (kept && Date.now() - kept.at < 60_000) return kept.n;
  const n = agentList().then((l) => (l ? needCount(l.agents) : 0));
  box.__hqAgentNeeds = { at: Date.now(), n };
  return n;
}
