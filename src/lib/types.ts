import type { AssistantSummary } from './assistant';
import type { ReviewList } from './review-types';
/* What the HQ screens get. Shared by the server (report.ts) and the screens. */

export type DayPoint = { day: string; visitors: number; views: number };
export type Source = { key: string; name: string; visitors: number; isNew: boolean };
export type Page = { path: string; visitors: number; views: number };
export type Count = { name: string; visitors: number };
export type ExtraCount = { key: string; label: string; week: number; last: number };

export type SiteStatus = 'ok' | 'not-counting' | 'error' | 'no-token';

export type SiteStats = {
  key: string;
  name: string;
  sub: string;
  url: string;
  initial: string;
  color: string;
  ink: string;
  light: string;
  vercelName: string;
  status: SiteStatus;
  error?: string;
  /* 28 days, oldest first, the last one today (so far). */
  days: DayPoint[];
  today: number;
  yesterday: number;
  /* Yesterday's visitors up to this time of day, worked out from the hourly counts. */
  yesterdayByNow: number | null;
  /* The 7 days to yesterday, and the 7 before. */
  week: number;
  lastWeek: number;
  weekViews: number;
  /* People in the last 7 days who saw only the home page. */
  homeOnly: number | null;
  sources: Source[];
  pages: Page[];
  countries: Count[];
  devices: Count[];
  extras: ExtraCount[];
  deploy: { state: string; at: number; message: string } | null;
  up: { ok: boolean; status: number; ms: number } | null;
};

export type GoalRow = { goal: string; label: string; short: string; week: number; last: number; today: number; people: number };

export type Leads = {
  rafsite: GoalRow[];
  rafsiteDays: { day: string; taps: number }[];
  cabinetos: {
    signupsWeek: number;
    signupsLast: number;
    signupsToday: number;
    signupsYesterday: number;
    signupsDays: { day: string; n: number }[];
    accounts: number;
    paying: { plan: string; status: string; n: number }[];
    payingTotal: number;
    sketchupWeek: { action: string; n: number }[];
  };
};

export type Viz =
  | { type: 'bar'; parts: { n: number; label: string; color: string }[] }
  | { type: 'bars'; values: number[]; mark: number; color: string; dim: string }
  | { type: 'dots'; n: number; color: string; label: string }
  | { type: 'chips'; items: string[] };

export type Insight = {
  id: string;
  site?: string;
  tone: 'alert' | 'good' | 'info' | 'setup';
  mark: string;
  where: string;
  title: string;
  body: string;
  action?: { label: string; href: string; external?: boolean };
  viz?: Viz;
  firstSeen?: string;
  isNew?: boolean;
};

export type Report = {
  at: number;
  today: string;
  sites: SiteStats[];
  leads: Leads | null;
  insights: Insight[];
  /* Messages sent with Tell us on Build It in 3D: not read yet, the newest one's number, yesterday's and the week's. */
  messages: { unread: number; newest: number | null; yesterday: number; week: number } | null;
  /* The Job Kit assistant on rafcarpentry.com: new enquiries and what it did with them. */
  assistant: AssistantSummary | null;
  /* The daily review (written each morning on rafcarpentry.com): the last few days and the marks on their ideas. */
  review: ReviewList | null;
  vercel: boolean;
  db: boolean;
  problems: string[];
};
