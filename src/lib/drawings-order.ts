import { addJobNote, addPayment, attachFile, createEnquiry, sendEmail, setStatus, sm8Call, sm8Rows, sm8Str, Sm8Error, touchJob } from '@/lib/servicem8';
import { readRecord, signRecord, stableUuid } from '@/lib/brief-token';
import { createCheckout, getSession, type Session } from '@/lib/stripe-checkout';
import { COMPANY, EMAIL, PHONE_DISPLAY } from '@/lib/site';
import {
  FREE_ROUNDS,
  MAX_FILE_BYTES,
  MAX_FILES,
  ORDER_MARK,
  PACK,
  dayWords,
  dueDay,
  extOf,
  fileOk,
  gbp,
  isPack,
  londonDay,
  orderDescription,
  priceOf,
  safeFileName,
  units as unitsOf,
  type Order,
  type Pack,
} from '@/lib/drawings-service';

/* The drawings service's order, from the form to the paid job (/drawings; src/lib/drawings-service.ts has the prices).
   1. startOrder: their details become a Quote job in ServiceM8 (createEnquiry, the website brief's way), its
      description starting "Drawings order" with "Not paid yet". So an order nobody pays for is still a lead on the
      Job Kit's Clients board. The answer is a signed token for that one job, good for 6 hours.
   2. addOrderFile: each file onto the job, one request each (a uuid per file number, so a retry is a 409, not a copy).
   3. checkout: a Stripe Checkout Session for the full price with VAT, the job in its metadata.
   4. confirmPaid (from the thank-you page, or Stripe's webhook 25 s later): the session read back from Stripe; if paid
      and its payment isn't on the job yet, the payment goes on the job (Card, paid in full), the job moves to Work
      Order with "Paid online ... Due by ..." in its description, a note goes in its diary, and Raf and the customer
      get their emails. The payment's uuid comes from the session, so a second call finds it and does nothing. */

const TOKEN_KIND = 'drawings';
const TTL = 6 * 60 * 60 * 1000;

export class OrderError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

type Token = { job: string; files: number; pack: Pack; units: number; email: string; name: string; num: string };

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[​-‏‪-‮⁠-⁤﻿]/g, '').trim().slice(0, max) : '');

export async function startOrder(body: Record<string, unknown>) {
  const pack = body.pack;
  if (!isPack(pack)) throw new OrderError('pack');
  const units = unitsOf(body.units);
  const name = text(body.name, 80).replace(/\s+/g, ' ');
  const email = text(body.email, 160).replace(/\s+/g, '');
  const mobile = text(body.mobile, 30);
  const what = text(body.what, 4000);
  const boards = text(body.boards, 300);
  const place = text(body.place, 120);
  const files = Math.max(0, Math.min(MAX_FILES, Math.floor(Number(body.files) || 0)));
  if (what.length < 10) throw new OrderError('what');
  if (!files) throw new OrderError('files');
  if (name.length < 2) throw new OrderError('name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new OrderError('email');
  if (body.check !== true || body.start !== true) throw new OrderError('ticks');
  const order: Order = { pack, units, what, boards, place, files };
  const job = await createEnquiry({ name, mobile: mobile.replace(/\D/g, '').length >= 10 ? mobile : '', email, address: place, description: orderDescription(order) });
  const token = signRecord(TOKEN_KIND, { job: job.uuid, files, pack, units, email, name, num: job.number ?? '' }, TTL);
  return { token, files, total: priceOf(pack, units).total, number: job.number ?? '' };
}

export const readOrder = (token: unknown) => readRecord<Token>(TOKEN_KIND, String(token ?? ''));

/* What the first bytes say a file is, for the types that have a sure mark; others go by their name. */
function looksRight(ext: string, head: Uint8Array) {
  const is = (...b: number[]) => b.every((x, i) => head[i] === x);
  if (ext === 'jpg' || ext === 'jpeg') return is(0xff, 0xd8, 0xff);
  if (ext === 'png') return is(0x89, 0x50, 0x4e, 0x47);
  if (ext === 'pdf') return is(0x25, 0x50, 0x44, 0x46);
  if (ext === 'webp') return is(0x52, 0x49, 0x46, 0x46);
  if (['skp', 'dwg', 'heic', 'heif', 'xlsx', 'docx'].includes(ext)) return head.length > 0 && !is(0x3c, 0x21); // not an HTML page
  return true;
}

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf', svg: 'image/svg+xml', csv: 'text/csv', txt: 'text/plain' };

export async function addOrderFile(token: unknown, i: number, file: Blob, name: string) {
  const t = readOrder(token);
  if (!t) throw new OrderError('token', 403);
  if (!Number.isInteger(i) || i < 0 || i >= t.files) throw new OrderError('number');
  if (!fileOk(name)) throw new OrderError('type');
  if (file.size === 0 || file.size > MAX_FILE_BYTES) throw new OrderError('size');
  const ext = extOf(name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksRight(ext, bytes.subarray(0, 8))) throw new OrderError('type');
  const fileName = `order-${String(i + 1).padStart(2, '0')}-${safeFileName(name)}`;
  await attachFile(t.job, new Blob([bytes], { type: TYPES[ext] ?? 'application/octet-stream' }), fileName, stableUuid(`${t.job}:drawings-file:${i}`));
}

export async function checkout(token: unknown, origin: string) {
  const t = readOrder(token);
  if (!t) throw new OrderError('token', 403);
  if (t.files) await touchJob(t.job); // so ServiceM8 shows the files in the job's diary
  const price = priceOf(t.pack, t.units);
  const session = await createCheckout({
    amount: price.total,
    name: `Drawings: ${PACK[t.pack].name}`,
    description: `${t.units} unit${t.units === 1 ? '' : 's'}${t.num ? ` · order ${t.num}` : ''} · Raf Carpentry, rafcarpentry.com`,
    email: t.email,
    successUrl: `${origin}/drawings/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/drawings?cancelled=1#order`,
    metadata: { kind: 'drawings', job: t.job, pack: t.pack, units: String(t.units), name: t.name, num: t.num },
  });
  if (!session.url) throw new OrderError('stripe', 502);
  return { url: session.url };
}

/* ---------- paid ---------- */

export type Paid = { first: boolean; pack: Pack; units: number; total: number; due: string; email: string; name: string };

async function hasRecord(path: string) {
  try {
    return sm8Rows((await sm8Call(path)).data).length > 0;
  } catch (e) {
    if (e instanceof Sm8Error && e.code === 'sm8-error' && /^404\b/.test(e.detail)) return false;
    throw e;
  }
}

export async function confirmPaid(sessionId: string, given?: Session): Promise<Paid> {
  if (!/^cs_[A-Za-z0-9_]{6,200}$/.test(sessionId)) throw new OrderError('session');
  const s = given ?? (await getSession(sessionId));
  const m = s.metadata ?? {};
  if (m.kind !== 'drawings' || !m.job || !isPack(m.pack)) throw new OrderError('session', 404);
  if (s.payment_status !== 'paid') throw new OrderError('not-paid', 409);
  const pack = m.pack;
  const units = unitsOf(m.units);
  const total = s.amount_total ?? priceOf(pack, units).total;
  const at = new Date((s.created ?? Date.now() / 1000) * 1000);
  const day = londonDay(at);
  const due = dueDay(at);
  const email = s.customer_details?.email || s.customer_email || '';
  const name = m.name || s.customer_details?.name || '';
  const payUuid = stableUuid(`drawings-pay:${s.id}`);
  const out: Paid = { first: false, pack, units, total, due, email, name };
  if (await hasRecord(`jobpayment/${payUuid}.json`)) return out;

  await addPayment({ uuid: payUuid, jobUuid: m.job, amount: total / 100, date: day, method: 'Card', deposit: false, note: `Paid online with Stripe: ${PACK[pack].name}, ${units} unit${units === 1 ? '' : 's'}` });
  // Work Order, and "Not paid yet" in the description becomes when it was paid and when it's due.
  let description = '';
  try {
    description = sm8Str(sm8Rows((await sm8Call(`job/${m.job}.json`)).data)[0]?.job_description);
  } catch {
    /* the payment is on the job either way */
  }
  const paidLine = `Paid online ${dayWords(day)}: ${gbp(total)} with VAT. Due by ${dayWords(due)}.`;
  const lines = description.split('\n');
  if (lines[0]?.startsWith(ORDER_MARK) && /^Not paid yet/.test(lines[1] ?? '')) lines[1] = paidLine;
  await sm8Call(`job/${m.job}.json`, { method: 'POST', body: { status: 'Work Order', ...(description ? { job_description: lines.join('\n') } : {}) } }).catch(() => setStatus(m.job, 'Work Order'));
  await addJobNote(m.job, `${paidLine}\nStripe payment ${s.payment_intent ?? s.id}.`, stableUuid(`drawings-note:${s.id}`)).catch(() => undefined);
  out.first = true;

  const mine = rafEmail({ name, email, pack, units, total, due, description: lines.join('\n'), num: m.num });
  const theirs = customerEmail({ name, pack, units, total, due });
  await Promise.race([
    Promise.all([
      sendEmail({ to: EMAIL, subject: mine.subject, text: mine.text, jobUuid: m.job, replyTo: email || undefined }),
      email ? sendEmail({ to: email, subject: theirs.subject, text: theirs.text, jobUuid: m.job }) : Promise.resolve(false),
    ]),
    new Promise((r) => setTimeout(r, 6000)),
  ]);
  return out;
}

/* ---------- the two emails ---------- */

const unitWords = (n: number) => `${n} unit${n === 1 ? '' : 's'}`;

export function rafEmail(o: { name: string; email: string; pack: Pack; units: number; total: number; due: string; description: string; num?: string }) {
  return {
    subject: `Paid drawings order: ${o.name}, ${PACK[o.pack].name}`,
    text: [
      `${o.name} paid ${gbp(o.total)} with VAT for ${PACK[o.pack].name}, ${unitWords(o.units)}.`,
      `Due by ${dayWords(o.due)}.`,
      '',
      o.email ? `Email: ${o.email}` : '',
      `It's a Work Order in ServiceM8${o.num ? ` (job ${o.num})` : ''}, paid in full, with their files in the job's diary.`,
      'Reply to this email to answer them, or use Emails and texts on the job in the Job Kit.',
      '',
      o.description,
    ]
      .filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '')
      .join('\n'),
  };
}

export function customerEmail(o: { name: string; pack: Pack; units: number; total: number; due: string }) {
  const price = priceOf(o.pack, o.units);
  const first = o.name.split(' ')[0] || 'there';
  return {
    subject: `Your drawings order: ${PACK[o.pack].name}`,
    text: [
      `Hi ${first},`,
      '',
      `Thanks for your order. Your payment is in and your files are with me.`,
      '',
      `${PACK[o.pack].name}, ${unitWords(o.units)}`,
      `Paid: ${gbp(o.total)} (${gbp(price.beforeVat)} + VAT ${gbp(price.vat)})`,
      `Your files by: ${dayWords(o.due)}`,
      '',
      'What happens next:',
      '1. I go through your sizes, sketch and photos. If anything is unclear, I email you first.',
      `2. You get the files by email by ${dayWords(o.due)}.`,
      `3. Up to ${FREE_ROUNDS} rounds of changes to the same design are free: reply with what to change.`,
      '',
      'Before you cut, check every size against your own measurements. The cut is your call.',
      '',
      'More photos or sizes? Reply to this email.',
      '',
      'Raf',
      'Raf Carpentry',
      PHONE_DISPLAY,
      'www.rafcarpentry.com',
      '',
      `${COMPANY.name}, ${COMPANY.office}. Company no. ${COMPANY.number}, VAT no. ${COMPANY.vat}.`,
    ].join('\n'),
  };
}

