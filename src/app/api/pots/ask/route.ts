import { noStore, potsGuard } from '@/lib/pots-server';

/* Ask Claude in Money pots, behind the PIN. The page runs the conversation and its tools (recording a payment,
   marking a bill paid...) itself; this only passes one round to the Claude API and hands back its answer.
   { system, messages, tools }  ->  { content, stop_reason }
   ANTHROPIC_API_KEY (the Job Kit's key, prepaid credit), POTS_MODEL or ANTHROPIC_MODEL picks the model,
   ANTHROPIC_API overrides the address for tests. */
export const maxDuration = 60;

const API = () => (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/+$/, '');
const MODEL = () => process.env.POTS_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-sonnet-5';
const MAX_BODY = 4_300_000;
const BLOCKS = new Set(['text', 'image', 'tool_use', 'tool_result']);

type Msg = { role: 'user' | 'assistant'; content: string | Record<string, unknown>[] };
type Tool = { name: string; description: string; input_schema: Record<string, unknown> };

function messagesOf(v: unknown): Msg[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > 120) return null;
  for (const m of v) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof content === 'string') continue;
    if (!Array.isArray(content) || content.length > 60) return null;
    for (const b of content) if (!b || typeof b !== 'object' || !BLOCKS.has(String((b as Record<string, unknown>).type))) return null;
  }
  if ((v[0] as Msg).role !== 'user') return null;
  return v as Msg[];
}

function toolsOf(v: unknown): Tool[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 16) return null;
  for (const t of v) {
    if (!t || typeof t !== 'object') return null;
    const { name, description, input_schema } = t as Record<string, unknown>;
    if (typeof name !== 'string' || !/^[a-z_]{1,64}$/.test(name)) return null;
    if (typeof description !== 'string' || description.length > 2000) return null;
    if (!input_schema || typeof input_schema !== 'object' || Array.isArray(input_schema)) return null;
  }
  return v as Tool[];
}

async function call(model: string, system: string, messages: Msg[], tools: Tool[]) {
  try {
    const res = await fetch(`${API()}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1600, ...(system ? { system } : {}), messages, ...(tools.length ? { tools } : {}) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(55_000),
    });
    return { res, text: await res.text().catch(() => '') };
  } catch {
    return { res: null, text: '' };
  }
}

const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

export async function POST(req: Request) {
  const stop = await potsGuard(req);
  if (stop) return stop;
  if (!process.env.ANTHROPIC_API_KEY) return fail('ai-not-set-up', 503);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail('too-big', 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return fail('bad', 400);
  }
  const system = typeof body.system === 'string' ? body.system.slice(0, 80_000) : '';
  const messages = messagesOf(body.messages);
  const tools = toolsOf(body.tools);
  if (!messages || !tools) return fail('bad', 400);

  let { res, text } = await call(MODEL(), system, messages, tools);
  // a model this account doesn't have (yet): try the one before it
  if (res && (res.status === 404 || (res.status === 400 && /model/i.test(text) && !/usage limit|credit/i.test(text)))) ({ res, text } = await call(FALLBACK_MODEL, system, messages, tools));
  if (!res) return fail('ai-busy', 502);
  if (res.status === 401 || res.status === 403) return fail('ai-key', 502);
  if (/usage limit|spend limit|credit balance/i.test(text)) return fail('ai-limit', 502);
  if (res.status === 429 || res.status === 529 || res.status >= 500) return fail('ai-busy', 502);
  if (res.status === 413 || /too large|too long|maximum.*tokens/i.test(text)) return fail('prompt_too_large', 400);
  if (res.status === 400 && /image/i.test(text)) return fail('image_rejected', 400);
  if (!res.ok) return fail('ai-error', 502);
  try {
    const out = JSON.parse(text) as { content?: unknown[]; stop_reason?: string };
    return Response.json({ content: out.content ?? [], stop_reason: out.stop_reason ?? 'end_turn' }, { headers: noStore });
  } catch {
    return fail('ai-error', 502);
  }
}
