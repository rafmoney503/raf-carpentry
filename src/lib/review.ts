import 'server-only';
import type { ReviewList } from './review-types';

/* The daily review, written each morning on rafcarpentry.com (its src/lib/review-writer.ts) and kept in Supabase
   (jobkit.reviews). HQ reads it and marks its ideas through public.hq_review (migration 'jobkit_review'), behind
   HQ_DB_SECRET. src/lib/review-types.ts is a copy of rafcarpentry's: change them together. */

async function call<T>(action: string, p: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${process.env.HQ_SUPABASE_URL}/rest/v1/rpc/hq_review`, {
    method: 'POST',
    headers: { apikey: process.env.HQ_SUPABASE_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: process.env.HQ_DB_SECRET, p_action: action, p }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) throw new Error('hq_review missing');
  if (!res.ok) throw new Error(`hq_review ${action}: ${res.status}`);
  return (await res.json()) as T;
}

/* The last `days` reviews and every mark; null when it can't be read. */
export async function reviewList(days = 14): Promise<ReviewList | null> {
  try {
    const r = await call<ReviewList>('list', { days });
    return { days: Array.isArray(r?.days) ? r.days : [], marks: r?.marks && typeof r.marks === 'object' ? r.marks : {} };
  } catch {
    return null;
  }
}

export const reviewMark = (id: string, status: string, note = '') => call<{ status: string; at: number }>('mark', { id, status, note });
