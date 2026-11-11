import 'server-only';
import { dbReady, hqApi, type DbReport } from './db';
import { sum } from './format';
import { buildInsights } from './insights';
import { SITES, sourceKey, sourceName, type Site } from './sites';
import { addDays, londonDay, londonMidnight } from './time';
import type { Count, DayPoint, Leads, Page, Report, SiteStats, Source } from './types';
import { aggregate, count, lastDeploy, NotCounting, vercelReady, type Row } from './vercel';

/* Everything on the HQ screens, read from Vercel and Supabase. Kept for 5 minutes per server, so opening the
   app again straight away doesn't ask Vercel again; Refresh asks again. */

const KEEP_MS = 5 * 60 * 1000;
let kept: { at: number; report: Promise<Report> } | null = null;

export function getReport(fresh = false): Promise<Report> {
  if (!fresh && kept && Date.now() - kept.at < KEEP_MS) return kept.report;
  const report = build().catch((e) => {
    kept = null;
    throw e;
  });
  kept = { at: Date.now(), report };
  return report;
}

/* Up to 6 Vercel calls at once. */
let running = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 6) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const utc = (day: string) => new Date(`${day}T00:00:00.000Z`);

async function build(): Promise<Report> {
  const now = new Date();
  const today = londonDay(now);
  const problems: string[] = [];
  const vercel = vercelReady();
  const db = dbReady();

  const [sites, dbRep] = await Promise.all([
    Promise.all(SITES.map((s) => siteStats(s, today, now, vercel))),
    db ? hqApi<DbReport>('report').catch((e) => {
      problems.push(`Supabase didn’t answer (${(e as Error).message}), so quote taps and sign-ups are missing.`);
      return null;
    }) : Promise.resolve(null),
  ]);
  if (!db) problems.push('HQ isn’t connected to Supabase yet, so quote taps and sign-ups are missing.');

  const leads = dbRep ? leadsOf(dbRep, today) : null;
  let insights = buildInsights(sites, leads, today);

  if (db && insights.length) {
    try {
      const seen = await hqApi<Record<string, string>>('seen', {
        items: insights.slice(0, 60).map((i) => ({ id: i.id, data: { title: i.title } })),
      });
      const cutoff = now.getTime() - 36 * 3600 * 1000;
      insights = insights.map((i) => {
        const first = seen[i.id];
        return first ? { ...i, firstSeen: first, isNew: new Date(first).getTime() > cutoff } : i;
      });
      const order = { alert: 0, good: 1, info: 2, setup: 3 } as const;
      insights.sort((a, b) => order[a.tone] - order[b.tone] || Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) || (b.firstSeen ?? '').localeCompare(a.firstSeen ?? ''));
    } catch {}
  }

  return { at: now.getTime(), today, sites, leads, insights, vercel, db, problems };
}

function emptySite(s: Site, status: SiteStats['status'], error?: string): SiteStats {
  return {
    key: s.key, name: s.name, sub: s.sub, url: s.url, initial: s.initial, color: s.color, ink: s.ink, light: s.light,
    vercelName: s.vercelName, status, error,
    days: [], today: 0, yesterday: 0, yesterdayByNow: null, week: 0, lastWeek: 0, weekViews: 0, homeOnly: null,
    sources: [], pages: [], countries: [], devices: [], extras: [], deploy: null, up: null,
  };
}

async function ping(url: string): Promise<SiteStats['up']> {
  const t = Date.now();
  try {
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'RafalSolutionsHQ/1.0 (uptime check)' } });
    res.body?.cancel().catch(() => {});
    return { ok: res.status < 500, status: res.status, ms: Date.now() - t };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - t };
  }
}

async function siteStats(s: Site, today: string, now: Date, vercel: boolean): Promise<SiteStats> {
  const upP = ping(process.env.HQ_PING_BASE ? `${process.env.HQ_PING_BASE}/${s.key}` : s.url);
  if (!vercel) return { ...emptySite(s, 'no-token'), up: await upP };

  const v = <T,>(fn: () => Promise<T>) => limited(fn);
  const first = addDays(today, -27);
  const w0 = utc(addDays(today, -7));
  const w1 = utc(today);
  const p0 = utc(addDays(today, -14));
  const b0 = utc(addDays(today, -35));
  const yMid = londonMidnight(addDays(today, -1));

  let dayRows: Row[];
  try {
    dayRows = await v(() => aggregate(s.project, 'day', utc(first), now, { limit: 100 }));
  } catch (e) {
    const status = e instanceof NotCounting ? 'not-counting' : 'error';
    const out = emptySite(s, status, status === 'error' ? (e as Error).message : undefined);
    out.up = await upP;
    out.deploy = await v(() => lastDeploy(s.project)).catch(() => null);
    return out;
  }

  const byDay = new Map<string, DayPoint>();
  for (const r of dayRows) {
    const day = String(r.timestamp ?? '').slice(0, 10);
    if (day) byDay.set(day, { day, visitors: Number(r.visitors) || 0, views: Number(r.pageviews) || 0 });
  }
  const days: DayPoint[] = [];
  for (let i = 0; i < 28; i++) {
    const day = addDays(first, i);
    days.push(byDay.get(day) ?? { day, visitors: 0, views: 0 });
  }
  const win = (from: number, to: number) => days.slice(28 + from, 28 + to);
  const weekDays = win(-8, -1);
  const lastDays = win(-15, -8);

  const homeless = `not (${s.home})`;
  const [hours, srcNow, srcBefore, notHome, pages, countries, devices, deploy, extras] = await Promise.all([
    v(() => aggregate(s.project, 'hour', yMid, now, { limit: 100 })).catch(() => [] as Row[]),
    v(() => aggregate(s.project, 'referrerHostname', w0, w1, { limit: 25 })).catch(() => [] as Row[]),
    v(() => aggregate(s.project, 'referrerHostname', b0, w0, { limit: 100 })).catch(() => [] as Row[]),
    v(() => count(s.project, w0, w1, homeless)).catch(() => null),
    v(() => aggregate(s.project, 'requestPath', w0, w1, { limit: 10 })).catch(() => [] as Row[]),
    v(() => aggregate(s.project, 'country', w0, w1, { limit: 6 })).catch(() => [] as Row[]),
    v(() => aggregate(s.project, 'deviceType', w0, w1, { limit: 4 })).catch(() => [] as Row[]),
    v(() => lastDeploy(s.project)).catch(() => null),
    Promise.all(
      s.extras.map(async (x) => {
        const [a, b] = await Promise.all([
          v(() => count(s.project, w0, w1, x.filter)).catch(() => null),
          v(() => count(s.project, p0, w0, x.filter)).catch(() => null),
        ]);
        return { key: x.key, label: x.label, week: a?.visitors ?? 0, last: b?.visitors ?? 0 };
      }),
    ),
  ]);

  /* Today against yesterday by the same time, from the hourly counts. */
  const tMid = londonMidnight(today).getTime();
  const sinceMid = now.getTime() - tMid;
  let ySoFar = 0;
  let yAll = 0;
  for (const r of hours) {
    const t = new Date(String(r.timestamp)).getTime();
    const n = Number(r.visitors) || 0;
    if (t >= yMid.getTime() && t < tMid) {
      yAll += n;
      if (t - yMid.getTime() < sinceMid) ySoFar += n;
    }
  }
  const yesterday = days[26].visitors;
  const yesterdayByNow = yAll > 0 ? Math.round((yesterday * ySoFar) / yAll) : hours.length ? 0 : null;

  /* A site with nothing in the 4 weeks before (new, or just switched on) has no "new" sources: everything would be. */
  const before = new Set(srcBefore.map((r) => sourceKey(String(r.referrerHostname ?? ''))));
  const knowsBefore = sum(srcBefore.map((r) => Number(r.visitors) || 0)) >= 20;
  const merged = new Map<string, Source>();
  for (const r of srcNow) {
    const host = String(r.referrerHostname ?? '');
    if (!host || host === 'Others') continue;
    const name = sourceName(host);
    if (name === s.name || host.endsWith(new URL(s.url).hostname.replace(/^www\./, ''))) continue;
    const key = sourceKey(host);
    const own = SITES.some((x) => x.name === name);
    const m = merged.get(key) ?? { key, name, visitors: 0, isNew: knowsBefore && !own && !before.has(key) };
    m.visitors += Number(r.visitors) || 0;
    merged.set(key, m);
  }
  const sources = [...merged.values()].map((x) => ({ ...x, isNew: x.isNew && x.visitors >= 3 })).sort((a, b) => b.visitors - a.visitors);

  const week = sum(weekDays.map((d) => d.visitors));
  const out: SiteStats = {
    ...emptySite(s, 'ok'),
    days,
    today: days[27].visitors,
    yesterday,
    yesterdayByNow,
    week,
    lastWeek: sum(lastDays.map((d) => d.visitors)),
    weekViews: sum(weekDays.map((d) => d.views)),
    homeOnly: notHome ? Math.max(0, week - notHome.visitors) : null,
    sources,
    pages: pages.map((r): Page => ({ path: String(r.requestPath ?? ''), visitors: Number(r.visitors) || 0, views: Number(r.pageviews) || 0 })),
    countries: countries.map((r): Count => ({ name: String(r.country ?? ''), visitors: Number(r.visitors) || 0 })),
    devices: devices.map((r): Count => ({ name: String(r.deviceType ?? ''), visitors: Number(r.visitors) || 0 })),
    extras,
    deploy,
    up: await upP,
  };
  return out;
}

const GOALS: Record<string, [string, string]> = {
  quote: ['Get a quote', 'quote taps'],
  send: ['Brief sent to you', 'briefs sent'],
  planner: ['Wardrobe planner', 'planner taps'],
  whatsapp: ['WhatsApp', 'WhatsApp taps'],
  call: ['Call', 'call taps'],
  email: ['Email', 'email taps'],
  cutlist: ['Cut list asked for', 'cut lists asked for'],
};
const GOAL_ORDER = Object.keys(GOALS);

function leadsOf(r: DbReport, today: string): Leads {
  const w0 = addDays(today, -7);
  const p0 = addDays(today, -14);
  const inWeek = (d: string) => d >= w0 && d < today;
  const inLast = (d: string) => d >= p0 && d < w0;

  const goals = new Map<string, Leads['rafsite'][number]>();
  for (const g of r.rafsite.goals) {
    const row = goals.get(g.goal) ?? { goal: g.goal, label: GOALS[g.goal]?.[0] ?? g.goal, short: GOALS[g.goal]?.[1] ?? `${g.goal} taps`, week: 0, last: 0, today: 0, people: 0 };
    if (inWeek(g.day)) {
      row.week += g.taps;
      row.people += g.people;
    } else if (inLast(g.day)) row.last += g.taps;
    else if (g.day === today) row.today += g.taps;
    goals.set(g.goal, row);
  }
  const rank = (g: string) => (GOAL_ORDER.includes(g) ? GOAL_ORDER.indexOf(g) : 99);
  const rafsite = [...goals.values()].sort((a, b) => rank(a.goal) - rank(b.goal) || b.week - a.week);

  const rafsiteDays: { day: string; taps: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    rafsiteDays.push({ day, taps: sum(r.rafsite.goals.filter((g) => g.day === day).map((g) => g.taps)) });
  }

  const c = r.cabinetos;
  const su = (pred: (d: string) => boolean) => sum(c.signups.filter((x) => pred(x.day)).map((x) => x.n));
  const signupsDays: { day: string; n: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    signupsDays.push({ day, n: su((d) => d === day) });
  }
  const sk = new Map<string, number>();
  for (const x of c.sketchup) if (inWeek(x.day)) sk.set(x.action ?? 'other', (sk.get(x.action ?? 'other') ?? 0) + x.n);

  return {
    rafsite,
    rafsiteDays,
    cabinetos: {
      signupsWeek: su(inWeek),
      signupsLast: su(inLast),
      signupsToday: su((d) => d === today),
      signupsYesterday: su((d) => d === addDays(today, -1)),
      signupsDays,
      accounts: c.accounts,
      paying: c.paying,
      payingTotal: sum(c.paying.map((p) => p.n)),
      sketchupWeek: [...sk.entries()].map(([action, n]) => ({ action, n })).sort((a, b) => b.n - a.n),
    },
  };
}
