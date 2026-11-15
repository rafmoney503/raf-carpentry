import 'server-only';
import type { PageReport } from './fbpage-types';

/* One Facebook Page's progress (the Cabinet OS Page), asked of rafcarpentry.com, which holds the Page tokens from the
   Job Kit's Social screen: GET /api/hq/facebook?name=… with Authorization: Bearer HQ_NOTIFY_SECRET (the secret HQ and
   the Job Kit already share). FB_REPORT_URL points at a stand-in in tests. Kept 5 minutes per server, as the report. */

export const FB_PAGE_NAME = 'Cabinet OS';
const KEEP_MS = 5 * 60 * 1000;

export type FbResult = { ok: true; report: PageReport } | { ok: false; why: 'not-set-up' | 'unreachable'; detail?: string };

type Kept = { at: number; result: Promise<FbResult> } | null;
const box = globalThis as typeof globalThis & { __hqFb?: Kept };

export function fbReady(): boolean {
  return (process.env.HQ_NOTIFY_SECRET ?? '').length >= 24;
}

async function ask(): Promise<FbResult> {
  if (!fbReady()) return { ok: false, why: 'not-set-up' };
  const url = new URL(process.env.FB_REPORT_URL || 'https://www.rafcarpentry.com/api/hq/facebook');
  url.searchParams.set('name', FB_PAGE_NAME);
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${process.env.HQ_NOTIFY_SECRET}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { ok: false, why: 'unreachable', detail: `rafcarpentry.com answered ${res.status}` };
    const report = (await res.json()) as PageReport;
    if (report?.v !== 1) return { ok: false, why: 'unreachable', detail: 'an answer HQ doesn’t know' };
    return { ok: true, report };
  } catch (e) {
    return { ok: false, why: 'unreachable', detail: e instanceof Error && e.name === 'TimeoutError' ? 'rafcarpentry.com took too long' : 'rafcarpentry.com didn’t answer' };
  }
}

export function getFbPage(fresh = false): Promise<FbResult> {
  const kept = box.__hqFb;
  if (!fresh && kept && Date.now() - kept.at < KEEP_MS) return kept.result;
  const result = ask().then((r) => {
    if (!r.ok || r.report.state !== 'ok') box.__hqFb = { at: Date.now() - KEEP_MS + 60_000, result: Promise.resolve(r) }; // try again in a minute
    return r;
  });
  box.__hqFb = { at: Date.now(), result };
  return result;
}

/* For Today and the CabinetOS page: the Page if it comes within `ms`, else nothing this time (it keeps coming, for the
   next look). */
export async function fbPageSoon(ms = 4000): Promise<FbResult | null> {
  return Promise.race([getFbPage(), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}
