import { costOf, noteClaude } from './ai-usage';
import { jobkitRpc, syncSetUp } from './job-kit-sync-server';
import { currentJobs, sm8SetUp, type Current } from './servicem8';
import { REVIEW_BRIEF } from './review-brief';
import { businessDay, keyNumbers, liveOf, type BizDay, type HqDay, type SqlDay } from './review-numbers';
import {
  APP_NAMES,
  EFFORTS,
  IDEA_KINDS,
  REVIEW_APPS,
  TRENDS,
  VERDICTS,
  ideaId,
  statusOf,
  type AppReview,
  type DayReview,
  type Followup,
  type Idea,
  type ReviewApp,
  type ReviewData,
  type ReviewList,
} from './review-types';

/* The daily review (Raf, 12 Nov 2026: "check websites and apps daily see what is happening, make a summary, rethink what
   happened on that day and suggest what should we change, improve, add to make each website or app better based on
   data he receives"). Once a day, about 6 in the morning (Supabase pg_cron posts /api/review/run), for yesterday:
   1. The numbers: everything kept in Supabase (rafcarpentry.com's visit counter, CabinetOS's sign-ups, app use, events
      and support reads, Build It in 3D's messages, the Job Kit's records: public.jobkit_review 'data'), ServiceM8's jobs
      (enquiries, quotes sent, jobs won, money in) and HQ's (each site's Vercel visitors, what went live, up or down).
   2. The earlier reviews' ideas and how Raf marked them (done, I'll do it, not for me), so it doesn't say the same
      again, never brings back one he turned down, and says whether the done ones moved the numbers.
   3. Claude writes the review through one forced tool (day_review); the numbers shown are worked out here.
   Kept in Supabase (jobkit.reviews) for the Job Kit, HQ and CabinetOS's status app. It only advises: nothing is changed
   or sent anywhere. One writer a day (a claim); a review that's there is only written again when Raf asks. */

const API = () => (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/+$/, '');
const MODEL = () => process.env.REVIEW_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-sonnet-5';
const EARLIER_DAYS = 21;

export const reviewSetUp = () => syncSetUp() && Boolean(process.env.ANTHROPIC_API_KEY);
export const reviewRpc = (action: string, p: Record<string, unknown> = {}, ms = 20000) => jobkitRpc('jobkit_review', { p_action: action, p }, ms);

export class ReviewError extends Error {
  constructor(public code: 'ai-key' | 'ai-limit' | 'ai-busy' | 'ai-error' | 'no-data', public detail = '') {
    super(code);
  }
}

/* ---------- days ---------- */

export const londonDay = (ms = Date.now()) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/London' });
export const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
export const yesterday = (ms = Date.now()) => addDays(londonDay(ms), -1);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function longDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/* ---------- the sources ---------- */

async function hqDay(day: string): Promise<HqDay> {
  const base = process.env.REVIEW_HQ_URL || (process.env.HQ_NOTIFY_URL ? new URL('/api/review/data', process.env.HQ_NOTIFY_URL).toString() : '');
  const secret = process.env.HQ_NOTIFY_SECRET;
  if (!base || !secret) throw new Error('HQ not set up');
  const url = new URL(base);
  url.searchParams.set('day', day);
  const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` }, cache: 'no-store', signal: AbortSignal.timeout(55_000) });
  if (!res.ok) throw new Error(`HQ answered ${res.status}`);
  return (await res.json()) as HqDay;
}

/* Contact details out of anything people typed (Build It in 3D's messages): emails, phone numbers and links. */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, '[number]');
}

/* ---------- what Claude gets ---------- */

type Earlier = { id: string; day: string; app: ReviewApp; title: string; watch: string; status: string; markedAt: number | null };

export function earlierIdeas(list: ReviewList | null, day: string): Earlier[] {
  const from = addDays(day, -EARLIER_DAYS);
  const out: Earlier[] = [];
  for (const d of list?.days ?? []) {
    if (d.day >= day || d.day < from) continue;
    for (const a of d.data?.review?.apps ?? []) {
      for (const i of a.ideas ?? []) {
        const m = list?.marks?.[i.id];
        out.push({ id: i.id, day: d.day, app: a.app, title: i.title, watch: i.watch, status: statusOf(list?.marks, i.id), markedAt: m?.at ?? null });
      }
    }
  }
  return out;
}

export function reviewPrompt(day: string, sql: SqlDay, hq: HqDay | null, biz: BizDay | null, list: ReviewList | null, missing: string[]): string {
  const site = (k: string) => hq?.sites.find((s) => s.key === k) ?? null;
  const strip = (s: ReturnType<typeof site>) => (s ? { status: s.status, visitors: s.visitors, views: s.views, before7days: s.before, sameDayLastWeek: s.lastWeek, sources: s.sources, pages: s.pages, countries: s.countries, devices: s.devices, extras: s.extras, upNow: s.up } : null);
  const b3 = sql.b3d ?? {};
  const messages = Array.isArray(b3.messages) ? (b3.messages as Record<string, unknown>[]).map((m) => ({ ...m, text: scrub(String(m.text ?? '')) })) : [];
  const jk = sql.jobkit ?? {};
  const data = {
    rafcarpentry: { ownCounter: { ...sql.rafsite }, vercel: site('rafcarpentry') ? { visitors: site('rafcarpentry')!.visitors, before7days: site('rafcarpentry')!.before, upNow: site('rafcarpentry')!.up } : null },
    business: { servicem8: biz, jobKit: { claudeCreditUsed: jk.claude, claudeCreditUsed7daysBefore: jk.claudeBefore, assistant: jk.assistantRuns, roughQuotesWorkedOut: jk.quotesRead, quickDrawingsMade: jk.designsMade, receiptsAdded: jk.receiptsAdded, socialFollowers: jk.social } },
    cabinetos: { ownTables: { ...sql.cabinetos }, vercel: site('cabinetos') ? { visitors: site('cabinetos')!.visitors, before7days: site('cabinetos')!.before, upNow: site('cabinetos')!.up } : null },
    builditin3d: { vercel: strip(site('builditin3d')), tellUs: { messages, ratings: b3.ratings, messages7daysBefore: b3.messagesBefore } },
    rafalsolutions: { vercel: strip(site('rafalsolutions')) },
    builtforyou: { vercel: strip(site('builtforyou')) },
  };
  const live = liveOf(hq);
  const numbers = keyNumbers(sql, hq, biz);
  const earlier = earlierIdeas(list, day);
  const heads = (list?.days ?? []).filter((d) => d.day < day && d.data?.review?.headline).slice(0, 7);
  const when = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }) : '');

  return [
    `YESTERDAY: ${longDay(day)} (London). Today is ${longDay(addDays(day, 1))}.`,
    missing.length ? `\nNOT AVAILABLE THIS TIME: ${missing.join('; ')}. Say so where it matters; don't guess.` : '',
    '\nWHAT WENT LIVE YESTERDAY (updates put live, by app):',
    REVIEW_APPS.map((a) => `- ${APP_NAMES[a]}: ${(live[a] ?? []).join(' | ') || 'nothing'}`).join('\n'),
    '\nTHE NUMBERS SHOWN TO RAF (worked out from the data; "before" is the daily average of the 7 days before):',
    JSON.stringify(numbers),
    '\nTHE DATA, BY APP ("before" totals are for the 7 days before unless they say otherwise):',
    JSON.stringify(data),
    '\nEARLIER IDEAS (last 3 weeks: id, day, app, title, status, when marked, what to watch):',
    earlier.length ? earlier.map((e) => `- [${e.id}] ${e.title} (${e.status}${e.markedAt ? ` ${when(e.markedAt)}` : ''}). Watch: ${e.watch}`).join('\n') : 'none yet: this is one of the first reviews.',
    '\nEARLIER HEADLINES:',
    heads.length ? heads.map((d) => `- ${d.day}: ${d.data!.review!.headline}`).join('\n') : 'none yet.',
    '\nWrite the review of yesterday with the day_review tool: every app in the list, quiet ones in a line.',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/* ---------- Claude ---------- */

const IDEA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'The idea in a few words, at most 10.' },
    what: { type: 'string', description: 'What to change, add or fix, and where: specific enough to build. Two or three sentences.' },
    why: { type: 'string', description: 'The numbers in the data behind it. One or two sentences.' },
    kind: { type: 'string', enum: IDEA_KINDS },
    effort: { type: 'string', enum: EFFORTS },
    where: { type: 'string', description: 'The page or screen, e.g. "/how-it-works" or "the Job Kit Today screen".' },
    watch: { type: 'string', description: 'The number that will show whether it worked.' },
  },
  required: ['title', 'what', 'why', 'kind', 'effort', 'where', 'watch'],
};
const TOOL = {
  name: 'day_review',
  description: "Yesterday's review across Rafal's apps.",
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'One sentence: the most useful thing to know about yesterday.' },
      overall: { type: 'string', description: 'Two to four sentences across everything.' },
      apps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            app: { type: 'string', enum: [...REVIEW_APPS] },
            trend: { type: 'string', enum: TRENDS, description: 'better / worse / same than the 7 days before, or quiet when there was almost nothing.' },
            summary: { type: 'string', description: "Two or three sentences with the day's numbers." },
            stood_out: {
              type: 'array',
              maxItems: 3,
              items: { type: 'object', properties: { text: { type: 'string' }, tone: { type: 'string', enum: ['good', 'bad', 'note'] } }, required: ['text', 'tone'] },
            },
            why: { type: 'string', description: 'What probably caused it, honestly. One to three sentences; empty when nothing needs explaining.' },
            ideas: { type: 'array', maxItems: 3, items: IDEA },
          },
          required: ['app', 'trend', 'summary', 'stood_out', 'why', 'ideas'],
        },
      },
      followups: {
        type: 'array',
        description: 'For each earlier idea marked done: did the numbers move since?',
        items: { type: 'object', properties: { id: { type: 'string' }, verdict: { type: 'string', enum: VERDICTS }, text: { type: 'string' } }, required: ['id', 'verdict', 'text'] },
      },
      watch: { type: 'array', maxItems: 3, items: { type: 'string' }, description: 'Up to 3 things to keep an eye on today.' },
    },
    required: ['headline', 'overall', 'apps', 'followups', 'watch'],
  },
};

const str = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, ' ')
        .trim()
        .slice(0, max)
    : '';
const pick = <T extends string>(v: unknown, list: readonly T[], or: T): T => (list.includes(v as T) ? (v as T) : or);
/* A list from Claude's answer: models sometimes send a nested list as a JSON string, so that's read too. */
function items(v: unknown): Record<string, unknown>[] {
  let x = v;
  if (typeof x === 'string') {
    try {
      x = JSON.parse(x);
    } catch {
      return [];
    }
  }
  return Array.isArray(x) ? (x as Record<string, unknown>[]) : [];
}
/* What came back, for the error line when a review is empty: each field's type (and length). */
export function shapeOf(raw: Record<string, unknown>): string {
  return Object.entries(raw)
    .map(([k, v]) => `${k} ${Array.isArray(v) ? `list ${v.length}` : typeof v === 'string' ? `text ${v.length}` : typeof v}`)
    .join(', ')
    .slice(0, 160);
}

/* Claude's answer made safe: known apps only, in order, once each; ideas numbered; follow-ups only for done ideas. */
export function cleanReview(raw: Record<string, unknown>, day: string, earlier: Earlier[]): DayReview {
  const seen = new Set<ReviewApp>();
  const apps: AppReview[] = [];
  for (const a of items(raw.apps)) {
    const app = a?.app as ReviewApp;
    if (!REVIEW_APPS.includes(app) || seen.has(app)) continue;
    seen.add(app);
    const ideas: Idea[] = items(a.ideas)
      .map((i) => ({ title: str(i?.title, 90), what: str(i?.what, 600), why: str(i?.why, 400), kind: pick(i?.kind, IDEA_KINDS, 'improve'), effort: pick(i?.effort, EFFORTS, 'small'), where: str(i?.where, 100), watch: str(i?.watch, 200) }))
      .filter((i) => i.title && i.what)
      .slice(0, 3)
      .map((i, n) => ({ id: ideaId(day, app, n + 1), ...i }));
    apps.push({
      app,
      trend: pick(a.trend, TRENDS, 'same'),
      summary: str(a.summary, 600),
      stoodOut: items(a.stood_out)
        .map((s) => ({ text: str(s?.text, 240), tone: pick(s?.tone, ['good', 'bad', 'note'] as const, 'note') }))
        .filter((s) => s.text)
        .slice(0, 3),
      why: str(a.why, 600),
      ideas,
    });
  }
  apps.sort((x, y) => REVIEW_APPS.indexOf(x.app) - REVIEW_APPS.indexOf(y.app));
  const done = new Map(earlier.filter((e) => e.status === 'done').map((e) => [e.id, e]));
  const followups: Followup[] = items(raw.followups)
    .filter((f) => done.has(String(f?.id)))
    .map((f) => ({ id: String(f.id), title: done.get(String(f.id))!.title, verdict: pick(f.verdict, VERDICTS, 'too_early'), text: str(f.text, 400) }))
    .filter((f, i, all) => f.text && all.findIndex((g) => g.id === f.id) === i);
  return {
    day,
    headline: str(raw.headline, 200),
    overall: str(raw.overall, 900),
    apps,
    followups,
    watch: (items(raw.watch) as unknown[]).map((w) => str(w, 220)).filter(Boolean).slice(0, 3),
  };
}

async function ask(model: string, text: string) {
  let res: Response;
  try {
    res = await fetch(`${API()}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 8000, system: REVIEW_BRIEF, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content: [{ type: 'text', text }] }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(230_000),
    });
  } catch {
    throw new ReviewError('ai-busy', 'no answer');
  }
  return { res, text: await res.text().catch(() => '') };
}

async function writeWithClaude(prompt: string): Promise<{ raw: Record<string, unknown>; model: string; cost: number }> {
  let model = MODEL();
  let { res, text } = await ask(model, prompt);
  if (res.status === 404 || (res.status === 400 && /model/i.test(text) && !/usage limit|credit/i.test(text))) {
    model = FALLBACK_MODEL;
    ({ res, text } = await ask(model, prompt));
  }
  await noteClaude('review', model, res.status, text);
  const short = text.replace(/\s+/g, ' ').slice(0, 200);
  if (res.status === 401 || res.status === 403) throw new ReviewError('ai-key', short);
  if (/usage limit|spend limit|credit balance/i.test(text)) throw new ReviewError('ai-limit', short);
  if (res.status === 429 || res.status === 529 || res.status >= 500) throw new ReviewError('ai-busy', short);
  if (!res.ok) throw new ReviewError('ai-error', `${res.status} ${short}`);
  try {
    const body = JSON.parse(text) as { model?: string; usage?: Parameters<typeof costOf>[0]; content?: { type: string; name?: string; input?: Record<string, unknown> }[] };
    const use = (body.content ?? []).find((c) => c.type === 'tool_use' && c.name === TOOL.name);
    if (!use?.input) throw new Error('none');
    return { raw: use.input, model: body.model || model, cost: Math.round(costOf(body.usage ?? {}) * 1e4) / 1e4 };
  } catch {
    throw new ReviewError('ai-error', 'no review in the answer');
  }
}

/* ---------- a run ---------- */

const PROBLEM: Record<ReviewError['code'], string> = {
  'ai-key': 'Claude turned the key down',
  'ai-limit': 'Your Claude API credit has run out',
  'ai-busy': 'Claude was busy',
  'ai-error': 'Claude’s answer couldn’t be read',
  'no-data': 'The numbers couldn’t be read from Supabase',
};

export type RunResult = { day: string; state: 'ready' | 'working' | 'failed'; error?: string };

export async function runReview(opts: { day?: string; force?: boolean; why: 'cron' | 'asked' }): Promise<RunResult> {
  const day = opts.day && /^\d{4}-\d{2}-\d{2}$/.test(opts.day) ? opts.day : yesterday();
  const claim = (await reviewRpc('claim', { day, force: Boolean(opts.force) })) as { claimed: boolean; state?: 'ready' | 'working' };
  if (!claim.claimed) return { day, state: claim.state ?? 'working' };

  try {
    const [sqlR, hqR, sm8R, listR] = await Promise.allSettled([
      reviewRpc('data', { day }, 45_000) as Promise<SqlDay>,
      hqDay(day),
      sm8SetUp() ? currentJobs() : Promise.reject(new Error('ServiceM8 not set up')),
      reviewRpc('list', { days: EARLIER_DAYS + 2 }) as Promise<ReviewList>,
    ]);
    if (sqlR.status !== 'fulfilled' || !sqlR.value?.rafsite) throw new ReviewError('no-data', sqlR.status === 'rejected' ? String((sqlR.reason as Error)?.message ?? sqlR.reason) : 'empty');
    const sql = sqlR.value;
    const hq = hqR.status === 'fulfilled' && Array.isArray(hqR.value?.sites) ? hqR.value : null;
    const sm8 = sm8R.status === 'fulfilled' ? (sm8R.value as Current) : null;
    const list = listR.status === 'fulfilled' ? listR.value : null;
    const missing = [
      !hq ? 'HQ (each site’s Vercel visitors and what went live)' : hq.vercel ? '' : 'Vercel visitors (HQ isn’t connected to Vercel)',
      !sm8 ? 'ServiceM8 (enquiries, quotes, jobs and money)' : '',
      !list ? 'the earlier reviews' : '',
    ].filter(Boolean);
    const marks = (sql.jobkit?.quoteMarks ?? {}) as Record<string, number>;
    const biz = sm8 ? businessDay(sm8.jobs, sm8.bookings, marks, day) : null;

    const prompt = reviewPrompt(day, sql, hq, biz, list, missing);
    const { raw, model, cost } = await writeWithClaude(prompt);
    const review = cleanReview(raw, day, earlierIdeas(list, day));
    if (!review.headline || !review.apps.length) throw new ReviewError('ai-error', `an empty review: ${shapeOf(raw)}`);

    const data: ReviewData & { input: unknown } = {
      review,
      numbers: keyNumbers(sql, hq, biz),
      live: liveOf(hq),
      missing,
      model,
      cost,
      at: Date.now(),
      why: opts.why,
      input: { sql, hq, biz },
    };
    await reviewRpc('save', { day, data }, 30_000);
    return { day, state: 'ready' };
  } catch (e) {
    const err = e instanceof ReviewError ? `${PROBLEM[e.code]}${e.detail ? ` (${e.detail.slice(0, 220)})` : ''}` : `It stopped: ${(e as Error)?.message ?? e}`;
    console.error('review', day, err);
    await reviewRpc('fail', { day, error: err }).catch(() => {});
    return { day, state: 'failed', error: err };
  }
}
