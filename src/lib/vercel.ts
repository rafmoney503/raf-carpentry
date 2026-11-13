import 'server-only';
import { TEAM_ID } from './sites';

/* Vercel's REST API with the token Rafal made for HQ (VERCEL_ACCESS_TOKEN, Vercel > Account > Tokens, scoped to
   "Rafal's projects"). Only reads: Web Analytics (visits) and deployments. VERCEL_API overrides the address
   for tests. */

export class NotCounting extends Error {}
export class VercelError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function vercelReady(): boolean {
  return Boolean(process.env.VERCEL_ACCESS_TOKEN);
}

async function get(path: string, q: Record<string, string | number | undefined>): Promise<unknown> {
  const base = process.env.VERCEL_API || 'https://api.vercel.com';
  const url = new URL(path, base);
  for (const [k, v] of Object.entries({ ...q, teamId: TEAM_ID })) if (v !== undefined) url.searchParams.set(k, String(v));
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_ACCESS_TOKEN ?? ''}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) return res.json();
    let body: { error?: { code?: string; message?: string } } = {};
    try {
      body = await res.json();
    } catch {}
    const code = body.error?.code ?? '';
    if (code === 'web_analytics_not_enabled') throw new NotCounting(code);
    last = new VercelError(res.status, code, body.error?.message ?? `Vercel answered ${res.status}`);
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  throw last;
}

export type Row = { visitors: number; pageviews: number } & Record<string, string | number>;

/* GET /v1/query/web-analytics/visits/aggregate: `by` is a time granularity or a dimension. */
export async function aggregate(
  projectId: string,
  by: string,
  since: Date,
  until: Date,
  opts: { limit?: number; filter?: string } = {},
): Promise<Row[]> {
  const j = (await get('/v1/query/web-analytics/visits/aggregate', {
    projectId,
    by,
    since: since.toISOString(),
    until: until.toISOString(),
    limit: opts.limit,
    filter: opts.filter,
  })) as { data?: Row[] };
  return Array.isArray(j.data) ? j.data : [];
}

/* GET /v1/query/web-analytics/visits/count */
export async function count(projectId: string, since: Date, until: Date, filter?: string): Promise<{ visitors: number; pageviews: number }> {
  const j = (await get('/v1/query/web-analytics/visits/count', {
    projectId,
    since: since.toISOString(),
    until: until.toISOString(),
    filter,
  })) as { data?: { visitors?: number; pageviews?: number } };
  return { visitors: Number(j.data?.visitors ?? 0), pageviews: Number(j.data?.pageviews ?? 0) };
}

export type Deploy = { state: string; at: number; message: string; url: string };

/* The newest production deployment. */
export async function lastDeploy(projectId: string): Promise<Deploy | null> {
  const j = (await get('/v6/deployments', { projectId, target: 'production', limit: 1 })) as {
    deployments?: { state?: string; readyState?: string; created?: number; createdAt?: number; url?: string; meta?: Record<string, string> }[];
  };
  const d = j.deployments?.[0];
  if (!d) return null;
  const message = (d.meta?.githubCommitMessage ?? '').split('\n')[0].slice(0, 120);
  return { state: d.state ?? d.readyState ?? 'UNKNOWN', at: d.createdAt ?? d.created ?? 0, message, url: d.url ?? '' };
}

/* The production deployments made between two times (the daily review's "what went live"), oldest first. */
export async function deploysBetween(projectId: string, since: Date, until: Date): Promise<Deploy[]> {
  const j = (await get('/v6/deployments', { projectId, target: 'production', since: since.getTime(), until: until.getTime(), limit: 40 })) as {
    deployments?: { state?: string; readyState?: string; created?: number; createdAt?: number; url?: string; meta?: Record<string, string> }[];
  };
  return (j.deployments ?? [])
    .map((d) => ({
      state: d.state ?? d.readyState ?? 'UNKNOWN',
      at: d.createdAt ?? d.created ?? 0,
      message: (d.meta?.githubCommitMessage ?? '').split('\n')[0].slice(0, 160),
      url: d.url ?? '',
    }))
    .filter((d) => d.at >= since.getTime() && d.at < until.getTime())
    .sort((a, b) => a.at - b.at);
}
