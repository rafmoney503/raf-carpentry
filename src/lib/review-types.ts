/* The daily review (src/lib/review-writer.ts): what it says, as kept in Supabase (jobkit.reviews) and shown in the Job
   Kit, HQ and CabinetOS's status app. No imports, so the screens, the writer and the checks share it. HQ and
   cabinetos-site keep a copy of the parts they show (src/lib/review.ts there): change them together. */

export const REVIEW_APPS = ['rafcarpentry', 'business', 'cabinetos', 'builditin3d', 'rafalsolutions', 'builtforyou'] as const;
export type ReviewApp = (typeof REVIEW_APPS)[number];

export const APP_NAMES: Record<ReviewApp, string> = {
  rafcarpentry: 'rafcarpentry.com',
  business: 'Your business',
  cabinetos: 'CabinetOS',
  builditin3d: 'Build It in 3D',
  rafalsolutions: 'Rafal Solutions',
  builtforyou: 'Built for you',
};
export const APP_SUBS: Record<ReviewApp, string> = {
  rafcarpentry: 'the website',
  business: 'ServiceM8 and the Job Kit',
  cabinetos: 'cabinetos.co.uk',
  builditin3d: 'builditin3d.com',
  rafalsolutions: 'rafalsolutions.co.uk',
  builtforyou: 'app.rafalsolutions.co.uk',
};
/* Where Claude Code should build an idea (for Copy for Claude). */
export const APP_REPOS: Record<ReviewApp, string> = {
  rafcarpentry: 'rafmoney503/raf-carpentry (rafcarpentry.com)',
  business: 'rafmoney503/raf-carpentry (the Job Kit, rafcarpentry.com/job-kit)',
  cabinetos: 'rafmoney503/cabinetos-site (cabinetos.co.uk)',
  builditin3d: 'rafmoney503/builditin3d (builditin3d.com)',
  rafalsolutions: 'the rafal-solutions-site branch of rafmoney503/raf-carpentry (rafalsolutions.co.uk)',
  builtforyou: 'the Built for you app (app.rafalsolutions.co.uk)',
};

export type Trend = 'better' | 'worse' | 'same' | 'quiet';
export type Tone = 'good' | 'bad' | 'note';
export type IdeaKind = 'fix' | 'change' | 'improve' | 'add';
export type Effort = 'small' | 'medium' | 'big';
export const IDEA_KINDS: IdeaKind[] = ['fix', 'change', 'improve', 'add'];
export const EFFORTS: Effort[] = ['small', 'medium', 'big'];
export const TRENDS: Trend[] = ['better', 'worse', 'same', 'quiet'];

export type Idea = {
  id: string; // '<day>:<app>:<n>'
  title: string;
  what: string; // what to change
  why: string; // the numbers behind it
  kind: IdeaKind;
  effort: Effort;
  where: string; // the page or screen
  watch: string; // the number that says whether it worked
};

export type AppReview = {
  app: ReviewApp;
  trend: Trend;
  summary: string;
  stoodOut: { text: string; tone: Tone }[];
  why: string; // what probably caused it
  ideas: Idea[];
};

export type Verdict = 'worked' | 'too_early' | 'no_change' | 'worse';
export const VERDICTS: Verdict[] = ['worked', 'too_early', 'no_change', 'worse'];
export type Followup = { id: string; title: string; verdict: Verdict; text: string };

export type DayReview = {
  day: string;
  headline: string;
  overall: string;
  apps: AppReview[];
  followups: Followup[];
  watch: string[];
};

/* A number worked out from the data (never by Claude): the day, and the daily average of the 7 days before. */
export type KeyNumber = { label: string; value: number; before: number | null; unit?: '£' | '%' };

export type ReviewData = {
  review: DayReview;
  numbers: Partial<Record<ReviewApp, KeyNumber[]>>;
  live: Partial<Record<ReviewApp, string[]>>; // what went live that day (commit messages)
  missing: string[]; // what couldn't be read ('Vercel', 'ServiceM8')
  model: string;
  cost: number; // US dollars
  at: number;
  why: 'cron' | 'asked';
  error?: string; // a later rewrite that failed (this review kept)
};

export type MarkStatus = 'new' | 'doing' | 'done' | 'no';
export const MARKS: MarkStatus[] = ['new', 'doing', 'done', 'no'];
export type Mark = { status: MarkStatus; at: number; by: string; note: string };

export type ReviewDay = { day: string; state: 'working' | 'ready' | 'failed'; data: Partial<ReviewData> & { error?: string; failedAt?: number }; at: string };
export type ReviewList = { days: ReviewDay[]; marks: Record<string, Mark> };

export const ideaId = (day: string, app: ReviewApp, n: number) => `${day}:${app}:${n}`;
export const statusOf = (marks: Record<string, Mark> | undefined, id: string): MarkStatus => marks?.[id]?.status ?? 'new';

export const KIND_WORDS: Record<IdeaKind, string> = { fix: 'Fix', change: 'Change', improve: 'Improve', add: 'Add' };
export const EFFORT_WORDS: Record<Effort, string> = { small: 'Small job', medium: 'A day or so', big: 'A bigger job' };
export const MARK_WORDS: Record<MarkStatus, string> = { new: 'New', doing: 'I’ll do it', done: 'Done', no: 'Not for me' };
export const VERDICT_WORDS: Record<Verdict, string> = { worked: 'It worked', too_early: 'Too early to tell', no_change: 'No change yet', worse: 'It got worse' };
export const TREND_WORDS: Record<Trend, string> = { better: 'Up', worse: 'Down', same: 'Steady', quiet: 'Quiet' };

/* What Copy for Claude puts on the clipboard: an idea, ready to paste into a chat with Claude to build it. */
export function claudePrompt(idea: Idea, app: ReviewApp, day: string): string {
  return [
    `An idea from the daily review of ${day} for ${APP_NAMES[app]} (${APP_REPOS[app]}):`,
    '',
    idea.title,
    '',
    `What to do: ${idea.what}`,
    `Why: ${idea.why}`,
    idea.where ? `Where: ${idea.where}` : '',
    idea.watch ? `How we'll know it worked: ${idea.watch}` : '',
    '',
    'Please check it against the code and the numbers first, then build it on a branch so I can see a preview before it goes live.',
  ]
    .filter((l, i, a) => l || (a[i - 1] ?? '') !== '')
    .join('\n');
}

/* '26' / '£1,350' / '38%' */
export function numberText(n: KeyNumber, v: number = n.value): string {
  const r = Math.round(v * 10) / 10;
  const s = Math.abs(r) >= 100 || Number.isInteger(r) ? Math.round(r).toLocaleString('en-GB') : r.toFixed(1);
  return n.unit === '£' ? `£${s}` : n.unit === '%' ? `${s}%` : s;
}

/* Against the 7 days before: 'avg 32' (and up / down / same). */
export function beforeText(n: KeyNumber): { text: string; dir: 'up' | 'down' | 'same' } | null {
  if (n.before === null || !Number.isFinite(n.before)) return null;
  const b = n.before;
  const dir = Math.abs(n.value - b) < Math.max(0.5, b * 0.1) ? 'same' : n.value > b ? 'up' : 'down';
  return { text: `avg ${numberText(n, b)}`, dir };
}

/* The ideas of the last days that still want doing: newest first, without done or not-for-me ones. */
export function openIdeas(list: ReviewList, apps?: ReviewApp[]): { day: string; app: ReviewApp; idea: Idea; status: MarkStatus }[] {
  const out: { day: string; app: ReviewApp; idea: Idea; status: MarkStatus }[] = [];
  for (const d of list.days) {
    for (const a of d.data.review?.apps ?? []) {
      if (apps && !apps.includes(a.app)) continue;
      for (const idea of a.ideas) {
        const status = statusOf(list.marks, idea.id);
        if (status === 'new' || status === 'doing') out.push({ day: d.day, app: a.app, idea, status });
      }
    }
  }
  return out;
}
