import 'server-only';
import type { AdsShown } from '@/components/adsparts';
import { adsSoon } from './ads';

/* The ads card for Today: the week if rafcarpentry.com answers within a few seconds, else nothing this time (the
   answer keeps coming, for the next look). */
export async function adsShown(ms = 4000): Promise<AdsShown | null> {
  const res = await adsSoon(ms).catch(() => null);
  if (!res) return null;
  if (!res.ok) return res.why === 'not-set-up' ? { ok: false, state: 'hq-not-set-up' } : null;
  return { ok: true, r: res.report };
}
