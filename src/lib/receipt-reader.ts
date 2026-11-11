import { noteClaude } from './ai-usage';
import { round2, type CostKind, type CostLine } from './job-costs';

/* A receipt read by Claude for the Job Kit (job-costs.ts): a photo taken on the phone, a PDF, or a supplier's
   email to info@ with its PDF or photos. One forced tool, receipt_read, gives the shop, the day, what was paid, the
   VAT as printed and the lines; cleanReceipt() makes it safe and makes the sums agree. Claude never decides which
   job it goes on: Raf picks that. Uses the Job Kit's prepaid ANTHROPIC_API_KEY (RECEIPT_MODEL, else
   ANTHROPIC_MODEL, else claude-sonnet-5-5; claude-sonnet-5 if the account hasn't got it), noted as 'receipts' in
   Claude credit. */

const API = () => (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/+$/, '');
const MODEL = () => process.env.RECEIPT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-sonnet-5';
export const receiptsSetUp = () => Boolean(process.env.ANTHROPIC_API_KEY);

export class ReceiptError extends Error {
  constructor(public code: 'ai-key' | 'ai-limit' | 'ai-busy' | 'ai-error' | 'ai-not-set-up' | 'not-receipt', public detail = '') {
    super(code);
  }
}

export type ReceiptRead = {
  receipt: boolean; // false: it isn't a receipt or invoice
  shop: string;
  date: string; // YYYY-MM-DD, '' when it can't be read
  gross: number;
  vat: number;
  net: number;
  vatShown: boolean;
  lines: CostLine[];
  what: CostKind; // Claude's guess at what it is
  summary: string; // 'Hinges, screws, glue'
  sure: boolean;
  note: string; // anything Raf should check ('the total is hard to read')
  model: string;
};

const TOOL = {
  name: 'receipt_read',
  description: 'What the receipt or invoice says.',
  input_schema: {
    type: 'object',
    properties: {
      is_receipt: { type: 'boolean', description: 'True for a receipt, till slip, invoice or order confirmation with a price paid.' },
      shop: { type: 'string', description: "The shop or supplier and, when printed, its branch: 'Screwfix, East Finchley', 'Cworkshop', 'Travis Perkins, Hornsey'." },
      date: { type: 'string', description: 'The day of the purchase as YYYY-MM-DD, or empty when it cannot be read. UK receipts print day first (11/11/26 is 2026-11-11).' },
      total_paid: { type: 'number', description: 'The total paid in pounds, with VAT.' },
      vat: { type: 'number', description: 'The VAT in pounds as printed on it, or 0 when no VAT is shown.' },
      vat_shown: { type: 'boolean', description: 'True when the receipt prints a VAT amount or a VAT breakdown.' },
      lines: {
        type: 'array',
        description: 'Each thing bought, in plain words (not the shop code), with its price as printed. At most 20.',
        items: { type: 'object', properties: { text: { type: 'string' }, amount: { type: 'number' } }, required: ['text', 'amount'] },
      },
      kind: { type: 'string', enum: ['materials', 'hardware', 'parking', 'helper', 'tools', 'other'], description: 'materials: boards, timber, MDF, sheets cut to size, mouldings, paint. hardware: hinges, runners, handles, screws, glue, fixings. tools: power tools, blades, anything that lasts many jobs. parking: parking or congestion charge.' },
      summary: { type: 'string', description: "What was bought in a few words: 'Hinges, screws and glue', 'MDF, 11 sheets cut to size'." },
      sure: { type: 'boolean', description: 'False when the total or the date is hard to read, or the photo is cut off.' },
      note: { type: 'string', description: 'One short sentence for anything to check, else empty.' },
    },
    required: ['is_receipt', 'shop', 'date', 'total_paid', 'vat', 'vat_shown', 'lines', 'kind', 'summary', 'sure', 'note'],
  },
};

const SYSTEM = `You read receipts, till slips, invoices and order confirmations for Raf, a carpenter in London (Raf Carpentry, Rafal Solutions Ltd, VAT registered). He puts each one on the job it was for, so he can see what each job made.
Read what is printed; never guess a number. Prices are in pounds. Give the total paid with VAT, and the VAT only as printed (0 and vat_shown false when none is shown). For an order confirmation email, the total is the order total including delivery.
Lines in plain English, as a carpenter would say them: 'Soft-close hinges, 10 pack', not 'HNG110SC'. Leave out card numbers, loyalty numbers and the customer's address.
No dashes in what you write.`;

type Content = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } } | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };
export type ReceiptFile = { bytes: Uint8Array; type: 'image/jpeg' | 'image/png' | 'application/pdf'; name?: string };

async function ask(model: string, content: Content[]) {
  let res: Response;
  try {
    res = await fetch(`${API()}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1500, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(80_000),
    });
  } catch {
    throw new ReceiptError('ai-busy', 'no answer');
  }
  return { res, text: await res.text().catch(() => '') };
}

const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/\s*[—–]\s*/g, ', ').trim().slice(0, max) : '');
const n = (v: unknown) => {
  const x = typeof v === 'number' ? v : Number.parseFloat(String(v ?? '').replace(/[£,]/g, ''));
  return Number.isFinite(x) ? x : 0;
};
const KINDS: CostKind[] = ['materials', 'hardware', 'parking', 'helper', 'tools', 'other'];

/* The tool's answer made safe: amounts to the penny and never below 0, the VAT never more than the total, a date
   that is a real day (not in the future, not before 2020), at most 20 lines. */
export function cleanReceipt(raw: Record<string, unknown>, model = '', today = new Date().toISOString().slice(0, 10)): ReceiptRead {
  const gross = Math.max(0, round2(n(raw.total_paid)));
  let vat = Math.max(0, round2(n(raw.vat)));
  if (vat > gross) vat = 0;
  const d = s(raw.date, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && d <= today && d >= '2020-01-01' ? d : '';
  const lines = (Array.isArray(raw.lines) ? raw.lines : [])
    .slice(0, 20)
    .map((l) => ({ text: s((l as Record<string, unknown>)?.text, 80), amount: round2(n((l as Record<string, unknown>)?.amount)) }))
    .filter((l) => l.text);
  return {
    receipt: raw.is_receipt !== false,
    shop: s(raw.shop, 60) || 'Receipt',
    date,
    gross,
    vat,
    net: round2(gross - vat),
    vatShown: raw.vat_shown === true && vat > 0,
    lines,
    what: KINDS.includes(raw.kind as CostKind) ? (raw.kind as CostKind) : 'materials',
    summary: s(raw.summary, 80),
    sure: raw.sure !== false && gross > 0 && Boolean(date),
    note: s(raw.note, 160),
    model,
  };
}

/* Reads one receipt: up to 4 photos or PDFs, and the email's words when it came by email. */
export async function readReceipt(files: ReceiptFile[], words = ''): Promise<ReceiptRead> {
  if (!receiptsSetUp()) throw new ReceiptError('ai-not-set-up');
  const content: Content[] = [];
  files.slice(0, 4).forEach((f, i) => {
    const data = Buffer.from(f.bytes).toString('base64');
    if (files.length > 1) content.push({ type: 'text', text: `File ${i + 1}${f.name ? `: ${f.name}` : ''}` });
    content.push(f.type === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } : { type: 'image', source: { type: 'base64', media_type: f.type, data } });
  });
  if (words.trim()) content.push({ type: 'text', text: `The email it came in:\n${words.slice(0, 6000)}` });
  content.push({ type: 'text', text: files.length ? 'Read this receipt.' : 'Read the receipt in this email.' });
  let model = MODEL();
  let { res, text } = await ask(model, content);
  if (res.status === 404 || (res.status === 400 && /model/i.test(text) && !/usage limit/i.test(text))) {
    model = FALLBACK_MODEL;
    ({ res, text } = await ask(model, content));
  }
  await noteClaude('receipts', model, res.status, text);
  const short = text.replace(/\s+/g, ' ').slice(0, 240);
  if (res.status === 401 || res.status === 403) throw new ReceiptError('ai-key', short);
  if (/usage limit|spend limit|credit balance/i.test(text)) throw new ReceiptError('ai-limit', short);
  if (res.status === 429 || res.status === 529 || res.status >= 500) throw new ReceiptError('ai-busy', short);
  if (!res.ok) throw new ReceiptError('ai-error', `${res.status} ${short}`);
  let body: { content?: { type: string; name?: string; input?: Record<string, unknown> }[]; model?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ReceiptError('ai-error', 'unreadable answer');
  }
  const use = (body.content ?? []).find((c) => c.type === 'tool_use' && c.name === TOOL.name);
  if (!use?.input) throw new ReceiptError('ai-error', 'no reading in the answer');
  return cleanReceipt(use.input, body.model || model);
}
