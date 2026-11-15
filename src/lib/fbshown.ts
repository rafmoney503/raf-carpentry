import 'server-only';
import type { FbShown } from '@/components/fbpage';
import { fbPageSoon } from './fbpage';
import { fbProgress } from './fbprogress';
import { londonDay } from './time';

/* The Facebook card for Today and the CabinetOS page: the Page if rafcarpentry.com answers within a few seconds, else
   nothing this time (the answer keeps coming, for the next look). */
export async function fbShown(ms = 4000): Promise<FbShown | null> {
  const res = await fbPageSoon(ms).catch(() => null);
  if (!res) return null;
  if (!res.ok) return res.why === 'not-set-up' ? { ok: false, state: 'hq-not-set-up' } : null;
  if (res.report.state !== 'ok' || !res.report.page) return { ok: false, state: res.report.state, detail: res.report.detail, pages: res.report.pages };
  return { ok: true, r: res.report, p: fbProgress(res.report, londonDay()) };
}
