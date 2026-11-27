import { connectOrigin } from '@/lib/meta-origin';
import { connectEtsy, EtsyError, etsySetUp, etsyStateOk } from '@/lib/etsy';

/* Where Etsy's 'allow access' page comes back to (the Callback URL in Raf's Etsy app). Not behind the PIN, as Etsy
   sends the browser here; the signed state proves it was started from the Job Kit. Then back to the Job Kit's Guide
   sales screen: ?etsy=ok | cancelled | expired | <error code>. */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const origin = connectOrigin(req);
  const back = (q: string) => new Response(null, { status: 303, headers: { Location: `${origin}/job-kit?etsy=${encodeURIComponent(q)}`, 'Cache-Control': 'no-store' } });
  if (!etsySetUp()) return back('etsy-not-set-up');
  if (u.searchParams.get('error')) return back('cancelled');
  const state = u.searchParams.get('state');
  if (!etsyStateOk(state)) return back('expired');
  const code = u.searchParams.get('code');
  if (!code || !state) return back('cancelled');
  try {
    await connectEtsy(code, state, origin);
    return back('ok');
  } catch (e) {
    if (!(e instanceof EtsyError)) console.error('job-kit etsy callback', e);
    return back(e instanceof EtsyError ? e.code : 'etsy-error');
  }
}
