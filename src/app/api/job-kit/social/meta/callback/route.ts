import { connectOrigin } from '@/lib/meta-origin';
import { connectMeta, MetaError, metaSetUp, metaStateOk } from '@/lib/meta-social';

/* Where Facebook's login comes back to (listed in the Meta app as a Valid OAuth Redirect URI). Not behind the PIN,
   as Facebook sends the browser here; the signed state proves the login was started from the Job Kit. Then back to
   the Job Kit's Social screen with how it went: ?social=ok | pick | cancelled | expired | <error code>. */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const origin = connectOrigin(req);
  const back = (q: string) => new Response(null, { status: 303, headers: { Location: `${origin}/job-kit?social=${encodeURIComponent(q)}`, 'Cache-Control': 'no-store' } });
  if (!metaSetUp()) return back('meta-not-set-up');
  if (u.searchParams.get('error')) return back('cancelled'); // 'Not now' or closed in Facebook's dialog
  if (!metaStateOk(u.searchParams.get('state'))) return back('expired');
  const code = u.searchParams.get('code');
  if (!code) return back('cancelled');
  try {
    const r = await connectMeta(code, origin);
    return back(r.picked ? 'ok' : 'pick');
  } catch (e) {
    if (!(e instanceof MetaError)) console.error('job-kit social callback', e);
    return back(e instanceof MetaError ? e.code : 'meta-error');
  }
}
