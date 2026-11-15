import 'server-only';
import { cleanList, type LiKey, type LiList } from './linkedin-types';

/* Rafal's LinkedIn numbers, kept in Supabase (hq.linkedin, migration 'hq_linkedin') through public.hq_linkedin
   behind HQ_DB_SECRET. */

async function call(action: 'list' | 'put', p: Record<string, unknown> = {}): Promise<LiList | null> {
  const res = await fetch(`${process.env.HQ_SUPABASE_URL}/rest/v1/rpc/hq_linkedin`, {
    method: 'POST',
    headers: { apikey: process.env.HQ_SUPABASE_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: process.env.HQ_DB_SECRET, p_action: action, p }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null; // before the migration
  if (res.status === 400) throw new Error('bad');
  if (!res.ok) throw new Error(`hq_linkedin ${action}: ${res.status}`);
  return cleanList(await res.json());
}

/* The last 400 days; null when they can't be read. */
export async function linkedinList(): Promise<LiList | null> {
  try {
    return await call('list');
  } catch {
    return null;
  }
}

/* Today's numbers (each left out keeps what was put in earlier today). */
export function linkedinPut(values: Partial<Record<LiKey, number>>): Promise<LiList | null> {
  return call('put', { ...values, source: 'typed' });
}
