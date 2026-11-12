import 'server-only';

/* The HQ function in the cabinetos Supabase project (public.hq_api, migration 'hq_api'), behind HQ_DB_SECRET.
   It reads quote taps (rafsite.views) and CabinetOS accounts, and keeps HQ's own small bits: when each "worth
   knowing" was first seen, the phones that get the morning summary, and the days it was sent. */

export function dbReady(): boolean {
  return Boolean(process.env.HQ_SUPABASE_URL && process.env.HQ_SUPABASE_KEY && process.env.HQ_DB_SECRET);
}

export async function hqApi<T>(action: string, p: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${process.env.HQ_SUPABASE_URL}/rest/v1/rpc/hq_api`, {
    method: 'POST',
    headers: {
      apikey: process.env.HQ_SUPABASE_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_secret: process.env.HQ_DB_SECRET, p_action: action, p }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`hq_api ${action}: ${res.status}`);
  return (await res.json()) as T;
}

/* The Job Kit assistant's own read (public.hq_assistant, migration 'hq_assistant'); null before it exists. */
export async function assistantRaw<T>(): Promise<T | null> {
  const res = await fetch(`${process.env.HQ_SUPABASE_URL}/rest/v1/rpc/hq_assistant`, {
    method: 'POST',
    headers: { apikey: process.env.HQ_SUPABASE_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: process.env.HQ_DB_SECRET }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`hq_assistant: ${res.status}`);
  return (await res.json()) as T;
}

export type DbReport = {
  today: string;
  rafsite: { goals: { day: string; goal: string; taps: number; people: number }[] };
  cabinetos: {
    signups: { day: string; n: number }[];
    accounts: number;
    paying: { plan: string; status: string; n: number }[];
    sketchup: { day: string; action: string | null; n: number }[];
  };
  /* Build It in 3D's Tell us (b3d.suggestions). Missing before migration 'hq_api_b3d'. */
  b3d?: { unread: number; newest: number | null; days: { day: string; kind: string; n: number }[] };
};

export type TellKind = 'idea' | 'broke' | 'stuck' | 'liked';
export type TellMessage = {
  id: number;
  created_at: string;
  kind: TellKind;
  body: string;
  who: 'child' | 'adult' | 'teacher' | null;
  page: string;
  lang: string;
  course: string | null;
  lesson: number | null;
  read_at: string | null;
};
export type TellReport = {
  items: TellMessage[];
  unread: number;
  ratings: { course: string; lesson: number; rating: 'easy' | 'right' | 'hard'; n: number }[];
};

export type PushSub = { endpoint: string; sub: { endpoint: string; keys: { p256dh: string; auth: string } }; label: string | null; created_at: string; last_ok: string | null };
