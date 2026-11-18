import 'server-only';
import type { AdsReport, MarkAnswer, WriteAnswer } from './ads-types';

/* The Ads section's numbers and drafts, asked of rafcarpentry.com, which holds the Facebook login from the Job Kit
   and the Claude key: GET/POST /api/hq/ads with Authorization: Bearer HQ_NOTIFY_SECRET. ADS_URL points at a
   stand-in in tests. Kept 5 minutes per period, as the Facebook section; writing or marking a draft asks again. */

const KEEP_MS = 5 * 60 * 1000;
const url = () => process.env.ADS_URL || 'https://www.rafcarpentry.com/api/hq/ads';

export type AdsResult = { ok: true; report: AdsReport } | { ok: false; why: 'not-set-up' | 'unreachable'; detail?: string };

type Kept = Map<number, { at: number; result: Promise<AdsResult> }>;
const box = globalThis as typeof globalThis & { __hqAds?: Kept };
const kept = () => (box.__hqAds ??= new Map());

export function adsReady(): boolean {
  return (process.env.HQ_NOTIFY_SECRET ?? '').length >= 24;
}
const auth = () => ({ authorization: `Bearer ${process.env.HQ_NOTIFY_SECRET}` });

async function ask(days: number): Promise<AdsResult> {
  if (!adsReady()) return { ok: false, why: 'not-set-up' };
  const u = new URL(url());
  u.searchParams.set('days', String(days));
  try {
    const res = await fetch(u, { headers: auth(), cache: 'no-store', signal: AbortSignal.timeout(25000) });
    if (!res.ok) return { ok: false, why: 'unreachable', detail: `rafcarpentry.com answered ${res.status}` };
    const report = (await res.json()) as AdsReport;
    if (report?.v !== 1) return { ok: false, why: 'unreachable', detail: 'an answer HQ doesn’t know' };
    return { ok: true, report };
  } catch (e) {
    return { ok: false, why: 'unreachable', detail: e instanceof Error && e.name === 'TimeoutError' ? 'rafcarpentry.com took too long' : 'rafcarpentry.com didn’t answer' };
  }
}

export function getAds(days: number, fresh = false): Promise<AdsResult> {
  const d = [7, 30, 90].includes(days) ? days : 30;
  const k = kept().get(d);
  if (!fresh && k && Date.now() - k.at < KEEP_MS) return k.result;
  const result = ask(d).then((r) => {
    if (!r.ok || r.report.state !== 'ok') kept().set(d, { at: Date.now() - KEEP_MS + 60_000, result: Promise.resolve(r) }); // again in a minute
    return r;
  });
  kept().set(d, { at: Date.now(), result });
  return result;
}

export function forgetAds() {
  kept().clear();
}

/* For Today: the week's ads if rafcarpentry.com answers within a few seconds, else nothing this time. */
export async function adsSoon(ms = 4000): Promise<AdsResult | null> {
  return Promise.race([getAds(7), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

async function post<T>(body: Record<string, unknown>, timeout: number): Promise<T | { ok: false; error: 'unreachable'; detail?: string }> {
  if (!adsReady()) return { ok: false, error: 'unreachable', detail: 'HQ_NOTIFY_SECRET isn’t set on rafal-hq' };
  try {
    const res = await fetch(url(), { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(timeout) });
    const out = (await res.json().catch(() => null)) as T | null;
    return out ?? { ok: false, error: 'unreachable', detail: `rafcarpentry.com answered ${res.status}` };
  } catch (e) {
    return { ok: false, error: 'unreachable', detail: e instanceof Error && e.name === 'TimeoutError' ? 'rafcarpentry.com took too long' : 'rafcarpentry.com didn’t answer' };
  } finally {
    forgetAds();
  }
}

export const writeAds = (business: 'raf' | 'cabinetos', count: number, note: string) => post<WriteAnswer>({ action: 'write', business, count, note }, 115_000);
export const markAd = (id: string, status: 'new' | 'approved' | 'no') => post<MarkAnswer>({ action: 'mark', id, status }, 15_000);
