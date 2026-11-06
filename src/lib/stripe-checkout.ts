import { createHmac, timingSafeEqual } from 'crypto';

/* Card payments through Stripe Checkout, for the drawings service (/drawings). Plain fetch on Stripe's API (no SDK):
   make a Checkout Session, read one back, and check a webhook's signature.
   Settings in Vercel: STRIPE_SECRET_KEY (a restricted key with Checkout Sessions write is enough), optionally
   STRIPE_VAT_TAX_RATE_ID (an inclusive 20% VAT tax rate, so Stripe's receipt shows the VAT) and STRIPE_WEBHOOK_SECRET
   (the endpoint /api/drawings/stripe, event checkout.session.completed). The same Stripe account as CabinetOS
   (Rafal Solutions Ltd) is fine: its webhook leaves payments it doesn't know alone. STRIPE_API overrides the address
   for tests. */

export const stripeSetUp = () => Boolean(process.env.STRIPE_SECRET_KEY?.trim());

export class StripeError extends Error {
  constructor(
    public code: string,
    public status = 502,
    public detail = '',
  ) {
    super(code);
  }
}

/* Stripe's form encoding: nested objects and arrays as a[b][0]=c. */
function form(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? form(x as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(path: string, init: { method?: 'GET' | 'POST'; body?: Record<string, unknown>; idempotency?: string } = {}): Promise<T> {
  const base = (process.env.STRIPE_API || 'https://api.stripe.com').replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/v1/${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY?.trim() ?? ''}`,
        ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(init.idempotency ? { 'Idempotency-Key': init.idempotency } : {}),
      },
      body: init.body ? form(init.body).toString() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new StripeError('stripe-down');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } };
  if (!res.ok) {
    const msg = String(data?.error?.message ?? res.status).slice(0, 240);
    throw new StripeError(res.status === 401 ? 'stripe-key' : res.status === 404 ? 'stripe-gone' : 'stripe-error', res.status === 404 ? 404 : 502, msg);
  }
  return data;
}

export type Session = {
  id: string;
  url?: string | null;
  payment_status?: string;
  status?: string;
  amount_total?: number | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  payment_intent?: string | null;
  metadata?: Record<string, string> | null;
  created?: number;
};

export async function createCheckout(c: {
  amount: number; // pence, VAT included
  name: string;
  description: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  idempotency?: string;
}): Promise<Session> {
  const vat = process.env.STRIPE_VAT_TAX_RATE_ID?.trim();
  return stripe<Session>('checkout/sessions', {
    method: 'POST',
    idempotency: c.idempotency,
    body: {
      mode: 'payment',
      locale: 'en-GB',
      customer_email: c.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: { currency: 'gbp', unit_amount: c.amount, product_data: { name: c.name, description: c.description } },
          ...(vat ? { tax_rates: [vat] } : {}),
        },
      ],
      metadata: c.metadata,
      payment_intent_data: { metadata: c.metadata, description: `${c.name}: ${c.description}`.slice(0, 500), statement_descriptor_suffix: 'RAF DRAWINGS' },
      success_url: c.successUrl,
      cancel_url: c.cancelUrl,
    },
  });
}

export const getSession = (id: string) => stripe<Session>(`checkout/sessions/${encodeURIComponent(id)}`);

/* Stripe-Signature: t=<time>,v1=<hmac of "t.payload">; within 5 minutes. */
export function webhookOk(payload: string, header: string | null, secret: string, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300) return false;
  const want = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .some((p) => {
      const got = Buffer.from(p.slice(3));
      const w = Buffer.from(want);
      return got.length === w.length && timingSafeEqual(got, w);
    });
}
