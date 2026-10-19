import { createHash, createHmac, timingSafeEqual } from 'crypto';

/* After "Send to Raf" makes the job, the browser gets a token that lets it add up to `n` photos to that one job
   for 30 minutes. Signed with a key only the server knows (BRIEF_SECRET, or derived from the ServiceM8 key), so a
   token can't be made up or pointed at another job. Each photo's ServiceM8 uuid comes from the job and its
   number, so a retried photo lands on the same attachment instead of a second copy, and no more than `n` can
   ever be added. */

const TTL = 30 * 60 * 1000;
const key = () => `raf-brief:${process.env.BRIEF_SECRET || process.env.SERVICEM8_API_KEY || ''}`;
const sign = (s: string) => createHmac('sha256', key()).update(s).digest('base64url');

export function makeToken(job: string, n: number, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ j: job, n, e: now + TTL })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function readToken(token: string, now = Date.now()): { job: string; n: number } | null {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof t.j !== 'string' || typeof t.n !== 'number' || typeof t.e !== 'number' || t.e < now) return null;
    return { job: t.j, n: t.n };
  } catch {
    return null;
  }
}

/* A uuid that is always the same for this job's photo number i. */
export function photoUuid(job: string, i: number) {
  return stableUuid(`${job}:photo:${i}`);
}
/* The same words always give the same uuid (a v4-shaped one), so sending a thing again to ServiceM8 is a 409, not
   a second copy. */
export function stableUuid(words: string) {
  const h = createHash('sha256').update(words).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
