import 'server-only';
import { sum } from './format';
import { SITES, sourceKey, sourceName, type Site } from './sites';
import { addDays, londonMidnight } from './time';
import { aggregate, count, deploysBetween, NotCounting, vercelReady, type Row } from './vercel';

/* What HQ gives the daily review on rafcarpentry.com (its src/lib/review-writer.ts) about one London day: each site's
   visitors from Vercel Web Analytics with the 7 days before, where they came from, the pages, what went live that day
   and whether the site is up now. Asked through /api/review/data with HQ_NOTIFY_SECRET. Vercel's day buckets are UTC
   days (London's in winter); the rest is cut at London's midnights. */

export type ReviewSite = {
  key: string;
  name: string;
  status: 'ok' | 'not-counting' | 'error' | 'no-token';
  visitors: number;
  views: number;
  before: { visitors: number; views: number; days: number } | null;
  lastWeek: number | null;
  sources: { name: string; visitors: number }[];
  pages: { path: string; visitors: number; views: number }[];
  countries: { name: string; visitors: number }[];
  devices: { name: string; visitors: number }[];
  extras: { key: string; label: string; visitors: number; before: number | null }[];
  deploys: { at: number; message: string; state: string }[];
  up: { ok: boolean; status: number; ms: number } | null;
  why?: string; // what Vercel said when it couldn't be read
};
export type ReviewDayData = { day: string; vercel: boolean; sites: ReviewSite[] };

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

async function ping(url: string): Promise<ReviewSite['up']> {
  const t = Date.now();
  try {
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'RafalSolutionsHQ/1.0 (uptime check)' } });
    res.body?.cancel().catch(() => {});
    return { ok: res.status < 500, status: res.status, ms: Date.now() - t };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - t };
  }
}

const utc = (day: string) => new Date(`${day}T00:00:00.000Z`);
const empty = (s: Site, status: ReviewSite['status']): ReviewSite => ({
  key: s.key, name: s.name, status, visitors: 0, views: 0, before: null, lastWeek: null,
  sources: [], pages: [], countries: [], devices: [], extras: [], deploys: [], up: null,
});

async function siteDay(s: Site, day: string, vercel: boolean): Promise<ReviewSite> {
  const upP = ping(process.env.HQ_PING_BASE ? `${process.env.HQ_PING_BASE}/${s.key}` : s.url);
  if (!vercel) return { ...empty(s, 'no-token'), up: await upP };
  const v = <T,>(fn: () => Promise<T>) => limited(fn);
  const t0 = londonMidnight(day);
  const t1 = londonMidnight(addDays(day, 1));
  const b0 = londonMidnight(addDays(day, -7));
  const deploysP = v(() => deploysBetween(s.project, t0, t1)).catch(() => []);

  let dayRows: Row[];
  const days = () => v(() => aggregate(s.project, 'day', utc(addDays(day, -7)), utc(addDays(day, 1)), { limit: 20 }));
  try {
    dayRows = await days().catch(async (e) => {
      if (e instanceof NotCounting) throw e;
      await new Promise((r) => setTimeout(r, 2000)); // once more, a little later
      return days();
    });
  } catch (e) {
    const out = empty(s, e instanceof NotCounting ? 'not-counting' : 'error');
    if (!(e instanceof NotCounting)) out.why = String((e as Error)?.message ?? e).slice(0, 160);
    out.deploys = (await deploysP).map((d) => ({ at: d.at, message: d.message, state: d.state }));
    out.up = await upP;
    return out;
  }
  const byDay = new Map<string, { visitors: number; views: number }>();
  for (const r of dayRows) {
    const d = String(r.timestamp ?? '').slice(0, 10);
    if (d) byDay.set(d, { visitors: Number(r.visitors) || 0, views: Number(r.pageviews) || 0 });
  }
  const before: string[] = [];
  for (let i = 7; i >= 1; i--) before.push(addDays(day, -i));

  const [src, pages, countries, devices, extras] = await Promise.all([
    v(() => aggregate(s.project, 'referrerHostname', t0, t1, { limit: 15 })).catch(() => [] as Row[]),
    v(() => aggregate(s.project, 'requestPath', t0, t1, { limit: 12 })).catch(() => [] as Row[]),
    v(() => aggregate(s.project, 'country', t0, t1, { limit: 6 })).catch(() => [] as Row[]),
    v(() => aggregate(s.project, 'deviceType', t0, t1, { limit: 4 })).catch(() => [] as Row[]),
    Promise.all(
      s.extras.map(async (x) => {
        const [a, b] = await Promise.all([v(() => count(s.project, t0, t1, x.filter)).catch(() => null), v(() => count(s.project, b0, t0, x.filter)).catch(() => null)]);
        return { key: x.key, label: x.label, visitors: a?.visitors ?? 0, before: b ? Math.round((b.visitors / 7) * 10) / 10 : null };
      }),
    ),
  ]);

  const own = new URL(s.url).hostname.replace(/^www\./, '');
  const merged = new Map<string, { name: string; visitors: number }>();
  for (const r of src) {
    const host = String(r.referrerHostname ?? '');
    if (!host || host === 'Others' || host.endsWith(own)) continue;
    const key = sourceKey(host);
    const m = merged.get(key) ?? { name: sourceName(host), visitors: 0 };
    m.visitors += Number(r.visitors) || 0;
    merged.set(key, m);
  }

  return {
    ...empty(s, 'ok'),
    visitors: byDay.get(day)?.visitors ?? 0,
    views: byDay.get(day)?.views ?? 0,
    before: { visitors: sum(before.map((d) => byDay.get(d)?.visitors ?? 0)), views: sum(before.map((d) => byDay.get(d)?.views ?? 0)), days: 7 },
    lastWeek: byDay.get(addDays(day, -7))?.visitors ?? 0,
    sources: [...merged.values()].sort((a, b) => b.visitors - a.visitors).slice(0, 10),
    pages: pages.map((r) => ({ path: String(r.requestPath ?? ''), visitors: Number(r.visitors) || 0, views: Number(r.pageviews) || 0 })),
    countries: countries.map((r) => ({ name: String(r.country ?? ''), visitors: Number(r.visitors) || 0 })),
    devices: devices.map((r) => ({ name: String(r.deviceType ?? ''), visitors: Number(r.visitors) || 0 })),
    extras,
    deploys: (await deploysP).map((d) => ({ at: d.at, message: d.message, state: d.state })),
    up: await upP,
  };
}

export async function reviewDayData(day: string): Promise<ReviewDayData> {
  const vercel = vercelReady();
  return { day, vercel, sites: await Promise.all(SITES.map((s) => siteDay(s, day, vercel))) };
}
