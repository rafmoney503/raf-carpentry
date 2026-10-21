import { connectOrigin } from '@/lib/meta-origin';
import { connectThreads, ThreadsError, threadsSetUp, threadsStateOk } from '@/lib/threads-social';

/* Where the Threads login comes back to (listed in the Threads app's settings as a Redirect Callback URL). Not behind
   the PIN, as Threads sends the browser here; the signed state proves the login was started from the Job Kit. Then
   back to the Job Kit's Social screen: ?social=threads-ok | cancelled | expired | <error code>. */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const origin = connectOrigin(req);
  const back = (q: string) => new Response(null, { status: 303, headers: { Location: `${origin}/job-kit?social=${encodeURIComponent(q)}`, 'Cache-Control': 'no-store' } });
  if (!threadsSetUp()) return back('threads-not-set-up');
  if (u.searchParams.get('error')) return back('cancelled');
  if (!threadsStateOk(u.searchParams.get('state'))) return back('expired');
  const code = u.searchParams.get('code');
  if (!code) return back('cancelled');
  try {
    await connectThreads(code, origin);
    return back('threads-ok');
  } catch (e) {
    if (!(e instanceof ThreadsError)) console.error('job-kit threads callback', e);
    return back(e instanceof ThreadsError ? e.code : 'threads-error');
  }
}
