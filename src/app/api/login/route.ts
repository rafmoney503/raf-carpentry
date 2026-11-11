import { timingSafeEqual } from 'node:crypto';
import { COOKIE, DAYS, makeSession } from '@/lib/session';

/* The PIN is the Job Kit's. HQ asks rafcarpentry.com whether it's right (Money pots' check, which only answers
   yes or no), unless HQ_PIN is set here. Five wrong tries from one address wait 10 minutes. */

const tries = new Map<string, { n: number; at: number }>();

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function pinRight(pin: string): Promise<boolean | null> {
  if (process.env.HQ_PIN) return same(pin, process.env.HQ_PIN);
  const base = process.env.HQ_PIN_CHECK || 'https://www.rafcarpentry.com';
  try {
    const res = await fetch(`${base}/api/pots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pots-pin': pin },
      body: JSON.stringify({ action: 'check' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401) return false;
    if (!res.ok) return null;
    const j = (await res.json()) as { ok?: boolean };
    return j.ok === true;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'here';
  const t = tries.get(ip);
  if (t && t.n >= 5 && Date.now() - t.at < 10 * 60000) return Response.json({ error: 'wait' }, { status: 429 });
  let pin = '';
  try {
    pin = String(((await req.json()) as { pin?: unknown }).pin ?? '').trim();
  } catch {}
  if (!/^[0-9A-Za-z]{3,40}$/.test(pin)) return Response.json({ error: 'wrong' }, { status: 401 });
  const ok = await pinRight(pin);
  if (ok === null) return Response.json({ error: 'check-down' }, { status: 503 });
  if (!ok) {
    const n = t && Date.now() - t.at < 10 * 60000 ? t.n + 1 : 1;
    tries.set(ip, { n, at: Date.now() });
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: 'wrong' }, { status: 401 });
  }
  tries.delete(ip);
  const value = await makeSession();
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE}=${value}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
