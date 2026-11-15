import { dbReady } from '@/lib/db';
import { agentAction, AgentsError, forgetAgentCount, type AgentAction } from '@/lib/agents';
import { BRIEF_MAX, JOB_MAX, NOTE_MAX, cleanText } from '@/lib/agents-types';

/* A change from the Agents screens (behind the sign-in): a job given, a job cancelled, a need marked, a note added,
   changed or taken off, an agent's settings. Answers the agent as it is now. */

const AGENT = /^[a-z]{2,20}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const id = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : 0);

function read(b: Record<string, unknown> | null): AgentAction | null {
  if (!b || typeof b.action !== 'string') return null;
  const agent = typeof b.agent === 'string' && AGENT.test(b.agent) ? b.agent : '';
  const text = (max: number) => (typeof b.text === 'string' ? cleanText(b.text, max) : '');
  switch (b.action) {
    case 'job_add': {
      const repeat = ['once', 'daily', 'weekly', 'date'].includes(b.repeat as string) ? (b.repeat as string) : '';
      const t = text(JOB_MAX);
      if (!agent || !t || !repeat) return null;
      const weekday = Number(b.weekday);
      if (repeat === 'weekly' && !(weekday >= 1 && weekday <= 7)) return null;
      if (repeat === 'date' && !(typeof b.onDay === 'string' && DAY.test(b.onDay))) return null;
      return { action: 'job_add', agent, text: t, repeat, ...(repeat === 'weekly' ? { weekday } : {}), ...(repeat === 'date' ? { onDay: b.onDay as string } : {}) };
    }
    case 'job_cancel':
    case 'note_gone':
      return id(b.id) ? { action: b.action, id: id(b.id) } : null;
    case 'need_mark':
      return id(b.id) && ['open', 'doing', 'done', 'no'].includes(b.status as string) ? { action: 'need_mark', id: id(b.id), status: b.status as string } : null;
    case 'note_add': {
      const t = text(NOTE_MAX);
      return agent && t ? { action: 'note_add', agent, text: t } : null;
    }
    case 'note_edit': {
      const t = text(NOTE_MAX);
      return id(b.id) && t ? { action: 'note_edit', id: id(b.id), text: t } : null;
    }
    case 'settings': {
      if (!agent) return null;
      const out: Extract<AgentAction, { action: 'settings' }> = { action: 'settings', agent };
      if (b.may === 'tell' || b.may === 'act') out.may = b.may;
      if (typeof b.paused === 'boolean') out.paused = b.paused;
      if (typeof b.brief === 'string') out.brief = cleanText(b.brief, BRIEF_MAX);
      return out;
    }
  }
  return null;
}

export async function POST(req: Request) {
  if (!dbReady()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const a = read((await req.json().catch(() => null)) as Record<string, unknown> | null);
  if (!a) return Response.json({ error: 'bad' }, { status: 400 });
  try {
    const agent = await agentAction(a);
    forgetAgentCount();
    return Response.json({ agent });
  } catch (e) {
    if (e instanceof AgentsError && e.code === 'bad') return Response.json({ error: 'bad', detail: e.detail }, { status: 400 });
    return Response.json({ error: 'db' }, { status: 502 });
  }
}
