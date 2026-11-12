import { dbReady, hqApi } from '@/lib/db';
import { forgetReport } from '@/lib/report';

/* Messages from Tell us: { ids: number[], read: boolean } marks those read (or new again); { all: true } marks every
   one read. Behind the sign-in (proxy). Nothing is ever deleted from here. */
export async function POST(req: Request) {
  if (!dbReady()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  let body: { ids?: unknown; read?: unknown; all?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  try {
    forgetReport();
    if (body.all === true) return Response.json(await hqApi('suggestions_read', { all: true }));
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is number => Number.isSafeInteger(x) && (x as number) > 0) : [];
    if (!ids.length || ids.length > 500) return Response.json({ error: 'bad' }, { status: 400 });
    return Response.json(await hqApi('suggestions_read', { ids, read: body.read !== false }));
  } catch (e) {
    return Response.json({ error: 'store', detail: (e as Error).message }, { status: 502 });
  }
}
