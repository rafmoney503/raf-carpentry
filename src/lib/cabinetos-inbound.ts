/* Sends a wardrobe planner design (/wardrobe-planner) to CabinetOS, where it becomes a project in Raf's account
   (cabinetos-site src/app/api/inbound/website-design/route.ts). Called by /api/brief after the ServiceM8 job is
   made; best effort, so a CabinetOS problem never stops the brief reaching Raf. Needs CABINETOS_INBOUND_URL and
   CABINETOS_INBOUND_SECRET (the same secret as CabinetOS's WEBSITE_INBOUND_SECRET); without them it does nothing.
   Server only: the secret never reaches the browser. */

export type CabinetOSResult = { ok: true; name: string; notes: string[] } | { ok: false; reason: string };

export const PLANNER_SOURCE = 'rafcarpentry-wardrobe-planner';

export function cabinetosSetUp() {
  return Boolean(process.env.CABINETOS_INBOUND_URL && process.env.CABINETOS_INBOUND_SECRET);
}

/** A planner design as the browser sent it (checked fully by CabinetOS), or null if it isn't one. */
export function plannerDesign(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const d = v as Record<string, unknown>;
  if (d.source !== PLANNER_SOURCE || !Array.isArray(d.units) || !d.units.length) return null;
  return JSON.stringify(d).length <= 20000 ? d : null;
}

export async function sendDesignToCabinetOS(
  design: Record<string, unknown>,
  customer: { name: string; postcode: string; jobNumber: string },
): Promise<CabinetOSResult> {
  if (!cabinetosSetUp()) return { ok: false, reason: 'not-set-up' };
  try {
    const res = await fetch(process.env.CABINETOS_INBOUND_URL as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CABINETOS_INBOUND_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ design: { ...design, customer } }),
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    const out = (await res.json().catch(() => ({}))) as { ok?: boolean; name?: string; notes?: unknown; error?: string; reason?: string };
    if (res.ok && out.ok) return { ok: true, name: String(out.name ?? ''), notes: Array.isArray(out.notes) ? out.notes.map(String).slice(0, 10) : [] };
    return { ok: false, reason: [out.error, out.reason].filter(Boolean).join(': ') || `CabinetOS answered ${res.status}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === 'TimeoutError' ? 'CabinetOS took too long' : 'CabinetOS could not be reached' };
  }
}

export type CutlistResult =
  | { ok: true; sent: boolean; token: string; name: string; parts: number; boards: number }
  | { ok: false; reason: string };

/**
 * The planner's 'Get the cut list': CabinetOS works the cut list out with its own code and emails it with the
 * spreadsheet (cabinetos-site src/app/api/inbound/cutlist/route.ts, same secret, the address next to
 * CABINETOS_INBOUND_URL). Waited on, so the planner can say it's on its way; 25 s at most.
 */
export async function requestCutlistFromCabinetOS(design: Record<string, unknown>, email: string, host: string): Promise<CutlistResult> {
  if (!cabinetosSetUp()) return { ok: false, reason: 'not-set-up' };
  try {
    const url = new URL('/api/inbound/cutlist', process.env.CABINETOS_INBOUND_URL as string);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CABINETOS_INBOUND_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ design, email, host }),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
    const out = (await res.json().catch(() => ({}))) as { ok?: boolean; sent?: boolean; token?: string; name?: string; parts?: number; boards?: number; error?: string; reason?: string };
    if (res.ok && out.ok) {
      return { ok: true, sent: out.sent === true, token: String(out.token ?? ''), name: String(out.name ?? ''), parts: Number(out.parts) || 0, boards: Number(out.boards) || 0 };
    }
    return { ok: false, reason: [out.error, out.reason].filter(Boolean).join(': ') || `CabinetOS answered ${res.status}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === 'TimeoutError' ? 'CabinetOS took too long' : 'CabinetOS could not be reached' };
  }
}
