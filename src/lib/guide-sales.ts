import { outlookSetUp, sendNew } from '@/lib/outlook';
import { statsRpc, statsSetUp } from '@/lib/site-stats-server';
import type { Session } from '@/lib/stripe-checkout';

/* Guides sold on the website, the £9.99 IKEA PAX guide first (/pax-guide). Raf, 16 Nov 2026: "Can we just adapt a
   button to pay in Stripe, why so many payments" (instead of a Payhip shop).
   How a sale goes:
   - The page's button is a Stripe Payment Link on the Rafal Solutions Ltd account (made in Stripe, its address in
     content/pages/pax-guide.json buyUrl; metadata kind 'pax-guide', copied to each Checkout Session). After paying,
     Stripe sends the buyer to /pax-guide/thanks?session_id=<the Checkout Session id>.
   - Stripe's webhook (/api/drawings/stripe, signed with STRIPE_WEBHOOK_SECRET) records the paid session in
     rafsite.guide_sales (Supabase, through public.rafsite_guide with the visit counter's secret) and emails the buyer
     from info@ a link to that thank-you page (Microsoft Graph, the Job Kit's 'Raf Job Kit' app, Mail.Send). If the
     email can't go, the webhook answers 500 so Stripe tries again later.
   - The thank-you page asks /api/pax-guide/order until the sale is there, then offers the download:
     /api/pax-guide/download?s=<session id> counts it (30 at most) and sends the PDF.
   - The PDF isn't in this repo (it's public): it's in the private rafmoney503/raf-job-inbox at
     products/ikea-pax-built-in.pdf, read with JOBKIT_GITHUB_TOKEN (production only).
   The session id is the buyer's key: a long random string Stripe makes. No Stripe API key is needed for any of it.
   The Job Kit's Guide sales screen (src/app/job-kit/guide-sales.tsx, /api/job-kit/sales) shows each sale and the
   income, and a To do line until Raf has seen it. */

export const MAX_DOWNLOADS = 30;

export const GUIDES = {
  'pax-guide': { title: 'IKEA PAX, built in', file: 'products/ikea-pax-built-in.pdf', name: 'IKEA-PAX-built-in.pdf', page: '/pax-guide' },
} as const;
export type GuideId = keyof typeof GUIDES;
export const isGuide = (k: unknown): k is GuideId => typeof k === 'string' && k in GUIDES;

/* A Checkout Session id as Stripe makes them (cs_live_ / cs_test_ and 50-odd letters and digits). */
export const sessionOk = (s: unknown): s is string => typeof s === 'string' && /^cs_(live|test)_[A-Za-z0-9]{20,200}$/.test(s);

export const guideSalesSetUp = () => statsSetUp();

export type Sale = { found: boolean; product?: string; email?: string | null; name?: string | null; emailed?: boolean; downloads?: number };

export const saleOf = (session: string) => statsRpc<Sale>('rafsite_guide', { p_action: 'get', p: { session } });

export const countDownload = (session: string) =>
  statsRpc<{ ok: boolean; reason?: 'limit' | 'none'; product?: string; downloads?: number }>('rafsite_guide', { p_action: 'download', p: { session } });

/* ---------- the PDF, from the private repo ---------- */

const pdfs = new Map<string, { bytes: Uint8Array; at: number }>();
export async function guidePdf(id: GuideId): Promise<Uint8Array> {
  const kept = pdfs.get(id);
  if (kept && Date.now() - kept.at < 10 * 60_000) return kept.bytes; // kept 10 minutes, so a new upload shows soon
  const api = (process.env.JOBKIT_GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
  const repo = process.env.GUIDES_REPO || process.env.JOBKIT_REPO || 'rafmoney503/raf-job-inbox';
  const token = process.env.JOBKIT_GITHUB_TOKEN?.trim();
  if (!token) throw new Error('no-token');
  const res = await fetch(`${api}/repos/${repo}/contents/${GUIDES[id].file}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'rafcarpentry-guides' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 1000 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('not-a-pdf');
  pdfs.set(id, { bytes, at: Date.now() });
  return bytes;
}

/* ---------- a paid session, from Stripe's webhook ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstName = (name: string) => {
  const f = name.trim().split(/\s+/)[0] ?? '';
  return /^[\p{L}'-]{2,30}$/u.test(f) ? f[0].toUpperCase() + f.slice(1).toLowerCase() : '';
};

export function guideEmail(id: GuideId, link: string, name: string) {
  const first = firstName(name);
  const title = GUIDES[id].title;
  const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
  const html = `<div style="font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.5;color:#16191c;max-width:560px">
${p(first ? `Hi ${esc(first)},` : 'Hi,')}
${p(`Thanks for buying <b>${esc(title)}</b>. Here's your guide:`)}
<p style="margin:0 0 18px"><a href="${esc(link)}" style="display:inline-block;background:#2547d0;color:#ffffff;text-decoration:none;font-weight:bold;padding:11px 18px;border-radius:2px">Download the guide (PDF)</a></p>
${p(`Keep this email: the link works for ${MAX_DOWNLOADS} downloads. On a phone, open the PDF and save it to Files or Books.`)}
${p('Any questions about your wardrobe, just reply to this email.')}
${p('Raf<br>Raf Carpentry · 07792 860221 · <a href="https://www.rafcarpentry.com" style="color:#2547d0">www.rafcarpentry.com</a>')}
</div>`;
  return { subject: `Your guide: ${title}`, html };
}

async function buzz(title: string, body: string, tag: string) {
  const url = process.env.HQ_NOTIFY_URL;
  const secret = process.env.HQ_NOTIFY_SECRET;
  if (!url || !secret) return;
  await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'site', notes: [{ title, body, tag }] }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
}

/* How the buyer's visit began and the page it began on, from the Buy button's client_reference_id
   ('threads__blog_ikea-pax-height-for-your-ceiling': the kind, two underscores, the page with its slashes as _;
   SiteStats' fromRef). Nothing when the link was opened without it. */
export function cameFrom(ref?: string | null): { source: string; landing: string } {
  const m = /^([a-z0-9-]{1,40})__([A-Za-z0-9-]+(?:_[A-Za-z0-9-]+)*)$/.exec(ref ?? '');
  if (!m || m[2].length > 120) return { source: '', landing: '' };
  return { source: m[1], landing: m[2] === 'home' ? '/' : '/' + m[2].replace(/_/g, '/') };
}

/* Records the sale and emails the buyer. Answers whether all of it is done: false means try again later (Stripe's
   retry), true when it is, or when there's nothing to do. Throws when the sale itself couldn't be recorded. */
export async function paidGuide(s: Session, origin: string): Promise<boolean> {
  const id = s.metadata?.kind;
  if (!isGuide(id) || s.payment_status !== 'paid' || !sessionOk(s.id)) return true;
  const email = (s.customer_details?.email ?? s.customer_email ?? '').trim().toLowerCase();
  const name = (s.customer_details?.name ?? '').trim();
  const added = await statsRpc<{ ok: boolean; new: boolean; emailed: boolean }>('rafsite_guide', {
    p_action: 'add',
    p: {
      session: s.id,
      product: id,
      email,
      name,
      amount: s.amount_total ?? null,
      currency: s.currency ?? 'gbp',
      link: s.payment_link ?? '',
      // for the Job Kit's Guide sales (where they were, and what they paid in their own money)
      country: s.customer_details?.address?.country ?? '',
      buyerAmount: s.presentment_details?.presentment_amount ?? '',
      buyerCurrency: s.presentment_details?.presentment_currency ?? '',
      // how they found the page (the Buy button's client_reference_id)
      ...cameFrom(s.client_reference_id),
    },
  });
  if (added.new) await buzz(`Sold: ${GUIDES[id].title}`, `£${((s.amount_total ?? 0) / 100).toFixed(2)}${name ? ` · ${name}` : ''}${email ? ` · ${email}` : ''}`.slice(0, 220), `guide-${s.id.slice(-12)}`);
  if (added.emailed || !email) return true;
  if (!outlookSetUp()) return true; // a preview: nothing to send with
  const link = `${origin}${GUIDES[id].page}/thanks?session_id=${encodeURIComponent(s.id)}`;
  try {
    await sendNew({ to: { email, name }, ...guideEmail(id, link, name) });
  } catch (e) {
    console.error('[guide] email', e);
    return false;
  }
  await statsRpc('rafsite_guide', { p_action: 'emailed', p: { session: s.id } }).catch(() => null);
  return true;
}
