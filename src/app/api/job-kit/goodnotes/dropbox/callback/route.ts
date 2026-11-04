import { connectOrigin } from '@/lib/meta-origin';
import { connectDropbox, DropboxError, dropboxSetUp, dropboxStateOk } from '@/lib/dropbox';

/* Where Dropbox's 'allow the Job Kit' page comes back to (listed in the Dropbox app's settings as a Redirect URI). Not
   behind the PIN, as Dropbox sends the browser here; the signed state proves it was started from the Job Kit. Then
   back to the Job Kit, on the screen it was on: ?dropbox=ok | cancelled | expired | <error code>. */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const origin = connectOrigin(req);
  const back = (q: string) => new Response(null, { status: 303, headers: { Location: `${origin}/job-kit?dropbox=${encodeURIComponent(q)}`, 'Cache-Control': 'no-store' } });
  if (!dropboxSetUp()) return back('gn-not-set-up');
  if (u.searchParams.get('error')) return back('cancelled');
  if (!dropboxStateOk(u.searchParams.get('state'))) return back('expired');
  const code = u.searchParams.get('code');
  if (!code) return back('cancelled');
  try {
    await connectDropbox(code, origin);
    return back('ok');
  } catch (e) {
    if (!(e instanceof DropboxError)) console.error('job-kit dropbox callback', e);
    return back(e instanceof DropboxError ? (e.code === 'dbx-store' ? 'gn-store' : e.code === 'dbx-expired' ? 'expired' : 'gn-error') : 'gn-error');
  }
}
