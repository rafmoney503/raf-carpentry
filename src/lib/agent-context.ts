import { jobkitRpc, syncSetUp } from './job-kit-sync-server';
import { whatOfJob } from './review-numbers';
import type { Booking, CurrentJob } from './servicem8';

/* The snapshot of ServiceM8 that HQ's agents read (Money, Sales, Day report). They run as a scheduled Claude task
   with the Supabase connector and no keys, so rafcarpentry.com writes what they need into jobkit.context (key
   'business', public.jobkit_context, migration 'hq_agents') each time the Job Kit assistant has read ServiceM8, every
   30 minutes. Only what the agents need: first name and surname initial, the area, what the job is, its dates, money
   and bookings. No mobiles, emails or street addresses. */

export type ContextJob = {
  uuid: string;
  number: string;
  status: CurrentJob['status'];
  name: string; // "Amelia S."
  area: string;
  what: string;
  created: string | null;
  quoteSent: string | null;
  workOrder: string | null;
  completed: string | null;
  lost: string | null;
  total: number | null; // ServiceM8's total, with VAT
  paid: number | null; // null: ServiceM8 wouldn't give the payments this time
  left: number | null;
  paidInFull: boolean;
  payments: { amount: number; date: string | null; deposit: boolean }[] | null;
};
export type BusinessContext = {
  v: 1;
  at: number;
  jobs: ContextJob[];
  bookings: { job: string; start: string; end: string | null }[] | null;
};

const money = (n: number) => Math.round(n * 100) / 100;

export function shortName(name: string, first: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const f = first.trim() || words[0] || '';
  const last = words.length > 1 ? words[words.length - 1] : '';
  return last && last.toLowerCase() !== f.toLowerCase() ? `${f} ${last[0].toUpperCase()}.` : f;
}

export function businessContext(jobs: CurrentJob[], bookings: Booking[] | null, now = Date.now()): BusinessContext {
  const since = new Date(now - 7 * 864e5).toISOString().slice(0, 10);
  return {
    v: 1,
    at: now,
    jobs: jobs.map((j) => {
      const paid = j.payments ? money(j.payments.reduce((s, p) => s + (p.amount || 0), 0)) : null;
      const left = j.total != null && paid != null ? money(Math.max(0, j.total - paid)) : null;
      return {
        uuid: j.uuid,
        number: j.number,
        status: j.status,
        name: shortName(j.name, j.first),
        area: j.area,
        what: whatOfJob(j.description || ''),
        created: j.created,
        quoteSent: j.quoteSent,
        workOrder: j.workOrder,
        completed: j.completed,
        lost: j.lost,
        total: j.total,
        paid,
        left: j.paid ? 0 : left,
        paidInFull: j.paid || (left === 0 && (j.total ?? 0) > 0),
        payments: j.payments ? j.payments.map((p) => ({ amount: money(p.amount || 0), date: p.date, deposit: p.deposit })) : null,
      };
    }),
    bookings: bookings ? bookings.filter((b) => b.start.slice(0, 10) >= since).map((b) => ({ job: b.jobUuid, start: b.start, end: b.end })) : null,
  };
}

/* Best effort: the agents just read an older snapshot (it carries its time) when this fails. */
export async function saveBusinessContext(jobs: CurrentJob[], bookings: Booking[] | null): Promise<boolean> {
  if (!syncSetUp()) return false;
  try {
    await jobkitRpc('jobkit_context', { p_action: 'put', p: { key: 'business', data: businessContext(jobs, bookings) } }, 8000);
    return true;
  } catch (e) {
    console.error('agent context', e);
    return false;
  }
}
