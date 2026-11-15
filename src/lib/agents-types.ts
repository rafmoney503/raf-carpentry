/* HQ's agents (public.hq_agents, migration 'hq_agents'): the shapes HQ gets, and the words for them. No imports, so
   the screens, the server and the checks share it. Times are ms. */

export type AgentId = 'money' | 'report' | 'growth' | 'sales' | string;
export type Sched =
  | { kind: 'daily'; at: string }
  | { kind: 'days'; days: number[]; at: string }
  | { kind: 'every'; hours: number; from: string; to: string };

export type ReportNumber = { label: string; value: string; hi?: boolean; note?: string };
export type AgentReport = { id: number; at: number; headline: string; body: string; numbers: ReportNumber[]; foot: string };

export type NeedStatus = 'open' | 'doing' | 'done' | 'no';
/* `button` 'do': Do it (the agent does it on its next check, or HQ opens `action.open` after copying `action.copy`);
   'done': Rafal does it himself and presses Done. */
export type Need = {
  id: number;
  text: string;
  how: string;
  button: 'do' | 'done';
  action: { open?: string; copy?: string; label?: string };
  status: NeedStatus;
  result: string;
  at: number;
  marked: number | null;
};

export type Repeat = 'once' | 'daily' | 'weekly' | 'date';
export type JobStatus = 'waiting' | 'working' | 'done' | 'failed' | 'cancelled';
export type Job = {
  id: number;
  text: string;
  repeat: Repeat;
  weekday: number | null; // ISO, 1 = Monday
  onDay: string | null; // 'YYYY-MM-DD'
  status: JobStatus;
  answer: string;
  due: number;
  at: number;
  done: number | null;
  runs: number;
};
export type Note = { id: number; text: string; by: 'agent' | 'raf'; at: number };

export type Agent = {
  id: AgentId;
  name: string;
  role: string;
  schedule: string;
  sched: Sched;
  sources: string[];
  may: 'tell' | 'act';
  paused: boolean;
  brief: string;
  lastRun: number | null;
  report: AgentReport | null;
  needs: Need[];
  jobs: Job[];
  notes: Note[];
};
export type AgentRun = { at: number; ms: number | null; did: Record<string, string>; problems: string[] };
export type AgentList = { now: number; agents: Agent[]; run: AgentRun | null; review: { day: string; headline: string } | null };

export const JOB_MAX = 2000;
export const NOTE_MAX = 500;
export const BRIEF_MAX = 2000;

const DOW_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* The London hour and weekday (ISO) of `at`. */
function london(at: number) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(at));
  const h = Number(p.find((x) => x.type === 'hour')?.value);
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.find((x) => x.type === 'weekday')?.value ?? '') + 1;
  return { h, wd };
}

/* When a job given now gets picked up: the agents check every hour from 7:00 to 21:00. */
export function pickupWords(now: number): string {
  const { h } = london(now);
  if (h < 7) return 'Picked up after 7:00';
  if (h >= 21) return 'Picked up tomorrow after 7:00';
  return 'Picked up within the hour';
}

export const openNeeds = (a: Pick<Agent, 'needs'>) => a.needs.filter((n) => n.status === 'open');
export const needCount = (agents: Pick<Agent, 'needs'>[]) => agents.reduce((s, a) => s + openNeeds(a).length, 0);
export const waitingJobs = (a: Pick<Agent, 'jobs'>) => a.jobs.filter((j) => j.status === 'waiting' && j.repeat === 'once');

/* 'Every Monday', 'Every day', 'On 20 Nov', 'Once' */
export function repeatWords(j: Pick<Job, 'repeat' | 'weekday' | 'onDay'>): string {
  if (j.repeat === 'daily') return 'Every day';
  if (j.repeat === 'weekly') return `Every ${DOW_LONG[j.weekday ?? 1] ?? 'week'}`;
  if (j.repeat === 'date' && j.onDay) return `On ${shortDate(j.onDay)}`;
  return 'Once';
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DOW[w]} ${d} ${MON[m - 1]}`;
}

function londonDayOf(at: number): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}
function clockOf(at: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));
}

/* 'today 07:31', 'yesterday 18:02', 'Fri 13 Nov' */
export function agoWords(at: number, now: number): string {
  const d = londonDayOf(at);
  const t = londonDayOf(now);
  if (d === t) return `today ${clockOf(at)}`;
  const y = londonDayOf(now - 864e5);
  if (d === y) return `yesterday ${clockOf(at)}`;
  return shortDate(d);
}

/* What a job's line says about where it is. */
export function jobState(j: Job, now: number): { tag: string; tone: 'wait' | 'work' | 'done' | 'fail' | 'off' } {
  if (j.status === 'working') return { tag: 'Working on it now', tone: 'work' };
  if (j.status === 'done') return { tag: `Done · ${agoWords(j.done ?? j.at, now)}`, tone: 'done' };
  if (j.status === 'failed') return { tag: `Couldn’t do it · ${agoWords(j.done ?? j.at, now)}`, tone: 'fail' };
  if (j.status === 'cancelled') return { tag: 'Cancelled', tone: 'off' };
  if (j.repeat === 'once' || j.due <= now) return { tag: `Waiting · ${pickupWords(now).toLowerCase()}`, tone: 'wait' };
  return { tag: `${repeatWords(j)} · next ${nextWords(j.due, now)}`, tone: 'wait' };
}

/* 'today', 'tomorrow', 'Mon 16 Nov' */
export function nextWords(at: number, now: number): string {
  const d = londonDayOf(at);
  if (d === londonDayOf(now)) return 'today';
  if (d === londonDayOf(now + 864e5)) return 'tomorrow';
  return shortDate(d);
}

/* The line under an agent's name: 'Every day at 7:30 · ran 07:31' / '... · first report today at 7:30'. */
export function runWords(a: Pick<Agent, 'schedule' | 'report' | 'paused'>, now: number): string {
  if (a.paused) return `${a.schedule} · paused`;
  if (!a.report) return `${a.schedule} · no report yet`;
  return `${a.schedule} · ran ${agoWords(a.report.at, now)}`;
}

/* A job's text, kept as typed but tidied: no runs of spaces, at most JOB_MAX characters. */
export function cleanText(s: string, max: number): string {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

/* Only web links HQ may open from a need. */
export function safeOpen(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const x = new URL(u);
    return x.protocol === 'https:' ? x.toString() : null;
  } catch {
    return null;
  }
}

/* Shape what the database sent into what the screens expect (missing parts filled in). */
export function cleanList(r: unknown): AgentList {
  const o = (r && typeof r === 'object' ? r : {}) as Partial<AgentList>;
  const agents = Array.isArray(o.agents) ? o.agents.map(cleanAgent).filter((a): a is Agent => Boolean(a)) : [];
  return { now: Number(o.now) || Date.now(), agents, run: o.run ?? null, review: o.review ?? null };
}
export function cleanAgent(x: unknown): Agent | null {
  if (!x || typeof x !== 'object') return null;
  const a = x as Partial<Agent>;
  if (typeof a.id !== 'string' || typeof a.name !== 'string') return null;
  return {
    id: a.id,
    name: a.name,
    role: a.role ?? '',
    schedule: a.schedule ?? '',
    sched: (a.sched ?? { kind: 'daily', at: '07:00' }) as Sched,
    sources: Array.isArray(a.sources) ? a.sources.filter((s) => typeof s === 'string') : [],
    may: a.may === 'tell' ? 'tell' : 'act',
    paused: Boolean(a.paused),
    brief: a.brief ?? '',
    lastRun: a.lastRun ?? null,
    report: a.report && typeof a.report.headline === 'string' ? { ...a.report, numbers: Array.isArray(a.report.numbers) ? a.report.numbers : [], body: a.report.body ?? '', foot: a.report.foot ?? '' } : null,
    needs: Array.isArray(a.needs) ? a.needs.map((n) => ({ ...n, action: n.action && typeof n.action === 'object' ? n.action : {} })) : [],
    jobs: Array.isArray(a.jobs) ? a.jobs : [],
    notes: Array.isArray(a.notes) ? a.notes : [],
  };
}
