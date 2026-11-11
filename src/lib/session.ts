/* HQ's sign-in: a cookie good for 90 days, signed with HQ_SESSION_SECRET. Works in the proxy and on the server
   (Web Crypto only). */

export const COOKIE = 'hq_s';
export const DAYS = 90;

const enc = new TextEncoder();

async function key(): Promise<CryptoKey> {
  const secret = process.env.HQ_SESSION_SECRET;
  if (!secret || secret.length < 24) throw new Error('HQ_SESSION_SECRET is missing');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeSession(now = Date.now()): Promise<string> {
  const exp = now + DAYS * 86400000;
  const sig = hex(await crypto.subtle.sign('HMAC', await key(), enc.encode(`hq|${exp}`)));
  return `${exp}.${sig}`;
}

export async function sessionOk(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const [expS, sig] = value.split('.');
  const exp = Number(expS);
  if (!Number.isFinite(exp) || exp < Date.now() || !/^[0-9a-f]{64}$/.test(sig ?? '')) return false;
  try {
    const bytes = new Uint8Array(sig.match(/../g)!.map((h) => parseInt(h, 16)));
    return await crypto.subtle.verify('HMAC', await key(), bytes, enc.encode(`hq|${exp}`));
  } catch {
    return false;
  }
}
