import { markAd, writeAds } from '@/lib/ads';

/* The Ads section's buttons (behind the sign-in): write new ads with Claude, or approve / turn down / bring back one.
   Both are passed to rafcarpentry.com (src/lib/ads.ts), which keeps the drafts. Nothing here reaches Meta. */
export const maxDuration = 120;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ ok: false, error: 'bad' }, { status: 400 });
  if (b.action === 'write') {
    const business = b.business === 'cabinetos' ? 'cabinetos' : b.business === 'raf' ? 'raf' : null;
    if (!business) return Response.json({ ok: false, error: 'bad' }, { status: 400 });
    const count = Math.min(6, Math.max(1, Math.round(Number(b.count) || 3)));
    const note = typeof b.note === 'string' ? b.note.slice(0, 300) : '';
    return Response.json(await writeAds(business, count, note));
  }
  if (b.action === 'mark') {
    const id = typeof b.id === 'string' && /^[a-z0-9]{8}$/.test(b.id) ? b.id : '';
    const status = b.status === 'approved' || b.status === 'no' || b.status === 'new' ? b.status : null;
    if (!id || !status) return Response.json({ ok: false, error: 'bad' }, { status: 400 });
    return Response.json(await markAd(id, status));
  }
  return Response.json({ ok: false, error: 'bad' }, { status: 400 });
}
