import { timingSafeEqual } from 'crypto';
import { markDraft } from '@/lib/ad-drafts';
import { AdWriteError, writeAds } from '@/lib/ad-writer';
import type { Business, DraftStatus } from '@/lib/ads-types';
import { adsReport } from '@/lib/meta-ads';

/* Rafal Solutions HQ's Ads section (15 Nov 2026), with Authorization: Bearer HQ_NOTIFY_SECRET (the secret HQ and the
   Job Kit already share):
   GET ?days=7|30|90                               the ads from Meta (read only), what the website counters saw from
                                                   them, and the drafts (src/lib/meta-ads.ts)
   POST { action: 'write', business, count?, note? } Claude writes 1 to 6 ads from the photos (src/lib/ad-writer.ts)
   POST { action: 'mark', id, status }             approved, no, or new again
   Nothing here creates an ad or spends money: Raf makes an approved ad in Ads Manager himself. */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorised(req: Request): boolean {
  const secret = process.env.HQ_NOTIFY_SECRET ?? '';
  const want = `Bearer ${secret}`;
  const got = req.headers.get('authorization') ?? '';
  return secret.length >= 24 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
const noStore = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  if (!authorised(req)) return Response.json({ error: 'no' }, { status: 401 });
  const days = Number(new URL(req.url).searchParams.get('days') ?? 30);
  return Response.json(await adsReport(days), { headers: noStore });
}

export async function POST(req: Request) {
  if (!authorised(req)) return Response.json({ error: 'no' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: 'bad' }, { status: 400 });
  }
  if (body.action === 'write') {
    const business = body.business === 'cabinetos' ? 'cabinetos' : body.business === 'raf' ? 'raf' : null;
    if (!business) return Response.json({ ok: false, error: 'bad' }, { status: 400 });
    const note = typeof body.note === 'string' ? body.note.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    try {
      const drafts = await writeAds(business as Business, Number(body.count ?? 3), note);
      return Response.json({ ok: true, drafts }, { headers: noStore });
    } catch (e) {
      if (e instanceof AdWriteError) return Response.json({ ok: false, error: e.code, detail: e.detail || undefined }, { status: e.code === 'ai-busy' ? 503 : 502 });
      console.error('hq ads write', e);
      return Response.json({ ok: false, error: 'ai-error' }, { status: 502 });
    }
  }
  if (body.action === 'mark') {
    const id = typeof body.id === 'string' && /^[a-z0-9]{8}$/.test(body.id) ? body.id : '';
    const status = ['new', 'approved', 'no'].includes(String(body.status)) ? (body.status as DraftStatus) : null;
    if (!id || !status) return Response.json({ ok: false, error: 'bad' }, { status: 400 });
    try {
      await markDraft(id, status);
      return Response.json({ ok: true }, { headers: noStore });
    } catch (e) {
      const gone = e instanceof Error && /sync-bad/.test(e.message);
      return Response.json({ ok: false, error: gone ? 'gone' : 'store' }, { status: gone ? 404 : 503 });
    }
  }
  return Response.json({ ok: false, error: 'bad' }, { status: 400 });
}
