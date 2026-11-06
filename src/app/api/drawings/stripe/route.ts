import { after } from 'next/server';
import { confirmPaid } from '@/lib/drawings-order';
import { webhookOk, type Session } from '@/lib/stripe-checkout';

/* Stripe's webhook for the drawings service (checkout.session.completed), for a customer who paid and closed the tab
   before the thank-you page loaded. It waits 25 s first, so the thank-you page normally records the payment and this
   finds it there and does nothing. Needs STRIPE_WEBHOOK_SECRET (the endpoint's signing secret in Stripe). Answers 200
   to anything signed, so Stripe doesn't keep retrying events that aren't ours. */
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
  if (!secret) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const payload = await req.text();
  if (!webhookOk(payload, req.headers.get('stripe-signature'), secret)) return Response.json({ error: 'signature' }, { status: 400 });
  let event: { type?: string; data?: { object?: Session } };
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const s = event.data?.object;
  if (event.type === 'checkout.session.completed' && s?.metadata?.kind === 'drawings' && s.payment_status === 'paid') {
    after(async () => {
      await new Promise((r) => setTimeout(r, Number(process.env.DRAWINGS_WEBHOOK_WAIT_MS ?? 25_000)));
      await confirmPaid(s.id).catch((e) => console.error('[drawings] webhook', e));
    });
  }
  return Response.json({ received: true });
}
