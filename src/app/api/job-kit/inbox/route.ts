import { guard } from '@/lib/job-kit-server';
import { attachment, inbox, message, OutlookError, outlookSetUp, outlookMissing, reply, setRead } from '@/lib/outlook';
import { signOff } from '@/lib/mail-text';

/* The Job Kit's Inbox: Raf's info@rafcarpentry.com mailbox (Microsoft 365) through src/lib/outlook.ts, behind the PIN.
   { action: 'list', skip? }               the newest 30 emails in the Inbox (and the unread count)
   { action: 'open', id }                  one email, its attachments and conversation; marks it read
   { action: 'read', id, read }            mark read or unread
   { action: 'file', id, att }             an attachment's bytes (photos made smaller when big)
   { action: 'reply', id, text, send }     Raf's reply from info@ with his sign-off: sent (send: true) or left in
                                           Drafts for Outlook. Only ever because Raf pressed the button.
   Nothing here deletes or moves an email. */
export const maxDuration = 30;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const idOk = (v: string) => /^[A-Za-z0-9+/=_-]{4,400}$/.test(v);
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  if (!outlookSetUp()) return Response.json({ error: 'outlook-not-set-up', detail: outlookMissing().join(', ') }, { status: 503 });
  const id = str(body.id, 400);
  try {
    if (body.action === 'list') {
      const skip = Math.max(0, Math.min(600, Math.floor(Number(body.skip) || 0)));
      return Response.json({ ...(await inbox(skip)), at: Date.now() }, { headers: noStore });
    }
    if (!idOk(id)) return Response.json({ error: 'bad' }, { status: 400 });
    if (body.action === 'open') return Response.json({ mail: await message(id, body.markRead !== false) }, { headers: noStore });
    if (body.action === 'read') {
      await setRead(id, body.read !== false);
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (body.action === 'file') {
      const att = str(body.att, 400);
      if (!idOk(att)) return Response.json({ error: 'bad' }, { status: 400 });
      const f = await attachment(id, att);
      return new Response(f.bytes as BodyInit, { headers: { ...noStore, 'content-type': f.type, 'x-file-name': encodeURIComponent(f.name) } });
    }
    if (body.action === 'reply') {
      const text = str(body.text, 10000);
      if (!text) return Response.json({ error: 'missing-mail' }, { status: 400 });
      return Response.json({ sent: await reply(id, text, signOff(), body.send === true) }, { headers: noStore });
    }
    return Response.json({ error: 'bad' }, { status: 400 });
  } catch (e) {
    if (e instanceof OutlookError) return Response.json({ error: e.code, detail: e.detail }, { status: e.status });
    console.error('job-kit inbox', e);
    return Response.json({ error: 'outlook-error' }, { status: 502 });
  }
}
