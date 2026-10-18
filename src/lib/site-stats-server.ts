import { createHash } from 'crypto';
import { deviceOf, goalOf, type Tap } from '@/lib/site-stats';

/* Server side of the website stats. The page views go to the stats database (Supabase, the cabinetos project, its own
   'rafsite' schema, nothing shared with CabinetOS) through three functions that need RAFSTATS_SECRET:
   rafsite_hit (one page view), rafsite_report and rafsite_page (the Job Kit's Website stats screen).
   Vercel settings: RAFSTATS_URL (https://<project>.supabase.co), RAFSTATS_KEY (the publishable key) and
   RAFSTATS_SECRET (sensitive). Page views are only recorded on www.rafcarpentry.com (RAFSTATS_ANY_HOST=1 records
   them anywhere, for tests), so previews never mix test visits into the numbers.
   The visitor code is a hash of the secret, the London date, the IP address and the browser's user agent: the same
   for one person all day, different the next day, and the IP address itself is never stored. */

export const statsSetUp = () => Boolean(process.env.RAFSTATS_URL && process.env.RAFSTATS_KEY && process.env.RAFSTATS_SECRET);

export class StatsError extends Error {
  constructor(public code: 'stats-down' | 'stats-key', public status: number) {
    super(code);
  }
}

export async function statsRpc<T>(fn: 'rafsite_hit' | 'rafsite_report' | 'rafsite_page', args: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
  const url = `${process.env.RAFSTATS_URL!.replace(/\/$/, '')}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { apikey: process.env.RAFSTATS_KEY!, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_secret: process.env.RAFSTATS_SECRET, ...args }),
  }).catch(() => null);
  if (!res) throw new StatsError('stats-down', 502);
  if (res.status === 401 || res.status === 403 || res.status === 400) throw new StatsError('stats-key', 502);
  if (!res.ok) throw new StatsError('stats-down', 502);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const recordHere = (host: string) =>
  process.env.RAFSTATS_ANY_HOST === '1' || /^(www\.)?rafcarpentry\.com$/i.test(host.split(':')[0]);

export const ROBOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|python|curl|wget|httpclient|java\/|go-http|axios|node-fetch/i;

export function londonDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function visitorCode(ip: string, ua: string, now = new Date()) {
  return createHash('sha256').update(`${process.env.RAFSTATS_SECRET}|${londonDay(now)}|${ip}|${ua}`).digest('hex').slice(0, 16);
}

/* Where a visit came from, from the referring address (or ?utm_source=). */
export function sourceOf(ref: string, utm: string): { kind: string; host: string } {
  let host = '';
  try {
    host = ref ? new URL(ref).hostname.replace(/^www\./, '').toLowerCase() : '';
  } catch {
    host = '';
  }
  const u = utm.toLowerCase();
  const test = (re: RegExp) => re.test(u) || re.test(host);
  const kind = test(/(^|\.)google\.|^google$/)
    ? 'google'
    : test(/bing\.com|^bing$/)
      ? 'bing'
      : test(/duckduckgo/)
        ? 'duckduckgo'
        : test(/yahoo\./)
          ? 'yahoo'
          : test(/ecosia/)
            ? 'ecosia'
            : test(/chatgpt|openai/)
              ? 'chatgpt'
              : test(/perplexity|claude\.ai|gemini\.google|copilot\.microsoft/)
                ? 'ai'
                : test(/instagram|^ig$/)
                  ? 'instagram'
                  : test(/facebook|^fb$|fb\.com|fb\.me/)
                    ? 'facebook'
                    : test(/tiktok/)
                      ? 'tiktok'
                      : test(/youtube|youtu\.be/)
                        ? 'youtube'
                        : test(/pinterest/)
                          ? 'pinterest'
                          : test(/linkedin|lnkd\.in/)
                            ? 'linkedin'
                            : test(/^t\.co$|twitter|^x\.com$|^x$/)
                              ? 'x'
                              : test(/whatsapp|^wa\.me$/)
                                ? 'whatsapp'
                                : test(/mail\.|outlook|^email$|^newsletter$/)
                                  ? 'email'
                                  : test(/rafalsolutions/)
                                    ? 'rafalsolutions'
                                    : test(/cabinetos/)
                                      ? 'cabinetos'
                                      : test(/checkatrade|mybuilder|ratedpeople|trustatrader|yell\.com|houzz|bark\.com|nextdoor/)
                                        ? 'directory'
                                        : host || u
                                          ? 'other'
                                          : 'direct';
  return { kind, host: host.slice(0, 80) };
}

const num = (v: unknown, min: number, max: number, dflt = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const pathOf = (v: unknown) => {
  const s = str(v, 200).split(/[?#]/)[0];
  return /^\/[\w\-./~%@]*$/.test(s) ? s.replace(/\/+$/, '') || '/' : '';
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* The page view as the browser sent it, checked and trimmed; null when it isn't one. */
export function cleanHit(raw: unknown, ctx: { ip: string; ua: string; country: string }) {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const id = str(b.id, 36);
  const path = pathOf(b.path);
  if (!UUID.test(id) || !path || /^\/(job-kit|admin|editor|api|review\/send)(\/|$)/.test(path)) return null;
  const vw = Math.round(num(b.vw, 0, 10000));
  const src = sourceOf(str(b.ref, 300), str(b.utm, 40));
  const taps: Tap[] = Array.isArray(b.clicks)
    ? b.clicks.slice(0, 50).flatMap((c) => {
        if (!c || typeof c !== 'object') return [];
        const t = c as Record<string, unknown>;
        const s = str(t.s, 400);
        if (!s) return [];
        const label = str(t.t, 40);
        const g = goalOf('', label) || (['quote', 'send', 'call', 'whatsapp', 'email', 'planner'].includes(String(t.g)) ? (t.g as Tap['g']) : '');
        return [{ s, fx: num(t.fx, 0, 1, 0.5), fy: num(t.fy, 0, 1, 0.5), x: num(t.x, 0, 1, 0.5), y: Math.round(num(t.y, 0, 200000)), h: Math.round(num(t.h, 0, 200000)), t: label, ...(g ? { g } : {}) }];
      })
    : [];
  const dwell = Array.isArray(b.dwell) && b.dwell.length === 20 ? b.dwell.map((d) => Math.round(num(d, 0, 21_600_000))) : null;
  const prev = pathOf(b.prev);
  return {
    id,
    visitor: visitorCode(ctx.ip, ctx.ua),
    path,
    title: str(b.title, 140) || null,
    prev: prev || null,
    refKind: prev ? 'internal' : src.kind,
    refHost: prev ? null : src.host || null,
    device: deviceOf(vw),
    vw,
    vh: Math.round(num(b.vh, 0, 10000)),
    country: /^[A-Z]{2}$/.test(ctx.country) ? ctx.country : null,
    engaged: Math.round(num(b.engaged, 0, 21_600_000)),
    scroll: num(b.scroll, 0, 1),
    docH: Math.round(num(b.docH, 0, 200000)) || null,
    dwell,
    clicks: taps,
  };
}
