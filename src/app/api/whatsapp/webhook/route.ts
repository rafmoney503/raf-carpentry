import { after } from 'next/server';
import { hookOk, ingest, readPending, waStoreSetUp } from '@/lib/wa-server';
import { parseWebhook } from '@/lib/wa-live';

/* Where 360dialog posts everything that happens on Raf's WhatsApp number (src/lib/wa-live.ts says what comes). The
   address carries a secret (?k=, made in wa-server.ts hookSecret), so anything else gets 403. It answers 200 at once
   (360dialog wants that before any work, or it sends again) and does the work after: the messages kept, photos and
   PDFs copied, and one chat that has gone quiet read by Claude, so new enquiries are ready in the Job Kit. */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!hookOk(req)) return new Response('no', { status: 403 });
  if (!waStoreSetUp()) return new Response('not set up', { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body) return new Response('ok');
  const parsed = parseWebhook(body);
  after(async () => {
    try {
      if (parsed.msgs.length || parsed.contacts.length || parsed.statuses.length || parsed.historyOff || parsed.history) await ingest(parsed);
      await readPending(1, 30000);
    } catch (e) {
      console.error('wa webhook', e);
    }
  });
  return new Response('ok');
}

export async function GET(req: Request) {
  return new Response(hookOk(req) ? 'ok' : 'no', { status: hookOk(req) ? 200 : 403 });
}
