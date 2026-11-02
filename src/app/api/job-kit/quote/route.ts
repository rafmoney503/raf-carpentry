import { after } from 'next/server';
import { guard } from '@/lib/job-kit-server';
import { SyncError } from '@/lib/job-kit-sync-server';
import { claimQuote, listQuotes, quotesRpc, quotesSetUp, RULES_MAX, runQuote } from '@/lib/quote-maker';
import { NOTE_MAX } from '@/lib/quote-sums';

/* The Job Kit's Quotes, behind the PIN (src/lib/quote-maker.ts, src/app/job-kit/quotes.tsx).
   { action: 'list' }                         every quote of the last 90 days, Raf's price list and instructions
   { action: 'make', job, force?, note? }     Claude reads the job (after the answer, so the phone isn't kept
                                              waiting): { state: 'working' }, or the state already there
   { action: 'edit', id, edits, at }          Raf's changes to a quote (the later change wins)
   { action: 'prices', prices, at }           his price list
   { action: 'rules', rules: { text }, at }    his instructions for Claude, used on every reading after this */
export const maxDuration = 120;

const noStore = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const stop = await guard(req);
  if (stop) return stop;
  if (!quotesSetUp()) return Response.json({ error: 'quotes-not-set-up' }, { status: 503, headers: noStore });
  const raw = await req.text();
  if (raw.length > 60_000) return Response.json({ error: 'too-big' }, { status: 413, headers: noStore });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  }
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const at = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : Date.now());
  try {
    switch (body.action) {
      case 'list':
        return Response.json(await listQuotes(), { headers: noStore });
      case 'make': {
        const job = typeof body.job === 'string' && UUID.test(body.job) ? body.job : '';
        if (!job) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        const note = typeof body.note === 'string' ? body.note.replace(/\r\n?/g, '\n').trim().slice(0, NOTE_MAX) : '';
        const c = await claimQuote(job, body.force === true);
        if (!c.ok) return Response.json({ state: c.state }, { headers: noStore });
        after(() => runQuote(job, { note }));
        return Response.json({ state: 'working' }, { headers: noStore });
      }
      case 'edit': {
        const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : '';
        const edits = obj(body.edits);
        if (!id || !edits) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        return Response.json(await quotesRpc('edit', { id, edits, at: at(body.at) }), { headers: noStore });
      }
      case 'rules': {
        const rules = obj(body.rules);
        if (!rules || typeof rules.text !== 'string') return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        const text = rules.text.replace(/\r\n?/g, '\n').trim().slice(0, RULES_MAX);
        return Response.json(await quotesRpc('edit', { id: '_rules', edits: { text }, at: at(body.at) }), { headers: noStore });
      }
      case 'prices': {
        const prices = obj(body.prices);
        if (!prices) return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
        return Response.json(await quotesRpc('edit', { id: '_prices', edits: prices, at: at(body.at) }), { headers: noStore });
      }
    }
    return Response.json({ error: 'bad' }, { status: 400, headers: noStore });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'sync-down';
    if (!(e instanceof SyncError)) console.error('job-kit quote', e);
    return Response.json({ error: code }, { status: code === 'sync-bad' ? 400 : 502, headers: noStore });
  }
}
