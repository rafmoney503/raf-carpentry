import type { AdDraft, Business, DraftStatus } from './ads-types';
import { jobkitRpc } from './job-kit-sync-server';

/* The ads Claude wrote for HQ's Ads section, kept in Supabase (cabinetos project) jobkit.ad_drafts through
   public.jobkit_ads with the Job Kit's secret (migration 'jobkit_ads'): id, business, the draft, its status (new,
   approved, no). Only words and a picture's address: nothing here reaches Meta. */

type Row = { id: string; business: Business; data: Omit<AdDraft, 'id' | 'business' | 'status' | 'at' | 'statusAt' | 'live'>; status: DraftStatus; at: number; statusAt?: number | null };

export async function listDrafts(): Promise<AdDraft[]> {
  const r = (await jobkitRpc('jobkit_ads', { p_action: 'drafts', p: {} }, 10000)) as { drafts?: Row[] };
  return (r?.drafts ?? []).map((x) => ({ ...x.data, id: x.id, business: x.business, status: x.status, at: x.at, statusAt: x.statusAt ?? undefined }));
}

export async function putDrafts(drafts: AdDraft[]): Promise<void> {
  await jobkitRpc(
    'jobkit_ads',
    {
      p_action: 'put',
      p: {
        drafts: drafts.map((d) => {
          const data: Record<string, unknown> = { ...d };
          for (const k of ['id', 'business', 'status', 'at', 'statusAt', 'live']) delete data[k];
          return { id: d.id, business: d.business, data };
        }),
      },
    },
    10000,
  );
}

export async function markDraft(id: string, status: DraftStatus): Promise<void> {
  await jobkitRpc('jobkit_ads', { p_action: 'mark', p: { id, status } }, 10000);
}
