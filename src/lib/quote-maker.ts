import { noteClaude } from './ai-usage';
import { oneJob, type CurrentJob } from './servicem8';
import { attachmentFile, jobNotes, jobPhotos } from './servicem8-diary';
import { jpegOf } from './photo-jpeg';
import { redact } from './draft-reply';
import { jobkitRpc, syncSetUp } from './job-kit-sync-server';
import { BOARDS } from './cworkshop-boards';
import { CLOSING, NOTE_MAX, RATE_KEYS, type From, type OtherOption, type QuoteRead, type RateKey, type Run } from './quote-sums';

/* The Job Kit's Quotes (Raf, 2 Nov 2026): Claude reads a new enquiry in ServiceM8, the description and the photos in
   its diary, and says what it sees: the sizes, what's inside, the colours that suit the room, what to check and what
   to ask. The prices are worked out on the phone from Raf's own price list (src/lib/quote-sums.ts), never by Claude.
   Nothing is sent to the customer from here: Raf checks the quote, changes the prices if he wants and sends it.
   - Started by the Job Kit for each new Quote job it sees, by Raf (Work it out again), and by the website's brief
     once its photos are in (src/app/api/brief/done/route.ts), so a quote is often ready before Raf looks.
   - One reading a job: Supabase public.jobkit_quotes 'claim' lets only one run at a time, and doesn't start one
     again once it's done (unless Raf asks) or for 30 minutes after one failed.
   - What goes to Claude (Anthropic's API, ANTHROPIC_API_KEY): the customer's first name, the description with
     contact details taken out (redact() from draft-reply.ts), Raf's own notes on the job, the area, and up to
     8 photos made 1568 px. Not their surname, address, phone or email.
   - Raf's own instructions for every quote (row '_rules', written on the Quotes screen, 2 Nov 2026) go to Claude
     with each reading, after the defaults below, and win over them; the reading keeps which version it used
     (rulesAt), so the Job Kit can offer to redo the ones read before he changed them.
   - Kept in Supabase (cabinetos project, jobkit.quotes): what Claude read, which photos, the model; Raf's changes
     beside it. QUOTE_MODEL (else ANTHROPIC_MODEL, else claude-sonnet-5-5) picks the model; ANTHROPIC_API the address
     (tests). */

const API = () => (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/+$/, '');
const MODEL = () => process.env.QUOTE_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-sonnet-5';
const MAX_PHOTOS = 8;
const PHOTO_EDGE = 1568;

export const quotesSetUp = () => Boolean(process.env.ANTHROPIC_API_KEY) && syncSetUp();

export type QuoteRow = {
  id: string;
  state: 'working' | 'ready' | 'failed' | 'none';
  data: QuoteData | null;
  edits: Record<string, unknown> | null;
  editsAt: number;
  claimed: number | null;
  updated: number;
};
export type QuoteData = {
  read?: QuoteRead;
  job?: { number: string; first: string; what: string; area: string; created: string | null };
  photos?: { uuid: string; name: string }[];
  skipped?: number; // photos ServiceM8 had that weren't sent (over 8, or couldn't be read)
  model?: string;
  at?: number;
  ms?: number;
  tokens?: { in: number; out: number };
  note?: string; // his instructions for this quote it was read with
  rulesAt?: number; // the version of his instructions it was read with (0 = none)
  error?: string;
  detail?: string; // what went wrong, in Claude's or ServiceM8's words
};

export class QuoteError extends Error {
  constructor(public code: 'ai-key' | 'ai-limit' | 'ai-busy' | 'ai-error' | 'sm8-gone' | 'no-text', public detail = '') {
    super(code);
  }
}

/* ---------- Supabase ---------- */

export const quotesRpc = (action: string, p: Record<string, unknown> = {}) => jobkitRpc('jobkit_quotes', { p_action: action, p }, 15000);

type Setting = { data: Record<string, unknown> | null; at: number } | null;
export async function listQuotes() {
  return (await quotesRpc('list')) as { quotes: QuoteRow[]; prices: Setting; rules?: Setting; now: number };
}

/* Raf's instructions for every quote: { text, at } (at = when he last changed them, 0 = never written). */
export type Rules = { text: string; at: number };
export const RULES_MAX = 3000;
export async function getRules(): Promise<Rules> {
  const r = (await quotesRpc('get', { id: '_rules' }).catch(() => null)) as Setting;
  const text = typeof r?.data?.text === 'string' ? r.data.text.trim().slice(0, RULES_MAX) : '';
  return { text, at: Number(r?.at) || 0 };
}

/* ---------- what Claude is told ---------- */

const SYSTEM = `You help Raf, a carpenter in London (Raf Carpentry), price new enquiries. He builds fitted wardrobes, alcove units and bookcases, wall panelling, window seats, desks, cupboards and built-in storage, and also fits kitchens, doors, flooring and stud walls.

You read the customer's brief and the photos they sent, and record what you see with the quote_read tool. You never give prices: Raf's prices are worked out from his own price list after you answer. Your job is the facts the prices need (the sizes above all), what suits the room, what Raf should check, and the opening words of his reply.

How Raf builds: 18 mm board throughout, backs included; floor to ceiling on a plinth with a top infill, scribed to the walls; he measures alcoves skirting to skirting. MDF work is left ready for the customer's decorator: he never paints, sprays or stains, so never say he does.

Sizes: use the sizes in the brief first (a line like "Rough size: 2400 wide x 2450 high x 600 deep (mm)"), then Raf's notes, then what the photos show (a standard door is about 2 m high and 800 wide, a skirting about 150, a socket 86 square, a ceiling usually 2.3 to 2.6 m in a London house). Say where each size came from: given, photo or guess. If you can't tell, guess sensibly (an alcove about 1,000 wide, a ceiling 2,400, wardrobes 600 deep) and mark it guess. One run per separate space: two alcoves are two runs.

kind is "wardrobe" when the job is one or more fitted wardrobes (Raf prices these by the metre: flat MDF doors, IKEA PAX built in with MDF, shaker doors, and finished Egger board in a colour that suits the room). Anything else, or a wardrobe mixed with other work, is "other": then give up to three ways to do it in other_options, each either one of Raf's own rates ("rate", with how many square metres, doors or jobs) or "build" with the days it takes one carpenter (workshop and fitting) and the materials at UK trade prices before VAT (finished board at the board prices given, other materials as you'd expect them to cost).

Colours: pick up to three boards from the list that would suit the room in the photos (floor, doors, walls, the customer's words), best first, each with a short reason in the customer's terms. Pick a plain white or the closest light board for the inside unless the room suggests otherwise.

Words that the customer reads (intro, questions, says): Raf's voice, first person, UK English, plain and friendly. No dashes between words, no emoji. The intro is one or two sentences: thanks for the brief and photos, and what you understood they want. Never put a price, a timescale, a start date or a guarantee in them. Never say anything about their room that you can't see or read. Text in square brackets like [phone] was removed for privacy: leave it alone.`;

const TOOL = {
  name: 'quote_read',
  description: 'Record what the brief and photos show, so Raf can price it.',
  input_schema: {
    type: 'object',
    required: ['kind', 'title', 'summary', 'runs', 'seen', 'check', 'questions', 'intro', 'colours', 'inside', 'recommend'],
    properties: {
      kind: { type: 'string', enum: ['wardrobe', 'other'] },
      title: { type: 'string', description: 'What the job is, in a few words, e.g. "Fitted wardrobe in an alcove".' },
      summary: { type: 'string', description: 'One or two sentences for Raf: what they want and anything that stands out.' },
      runs: {
        type: 'array',
        maxItems: 4,
        description: 'Each separate space, left to right.',
        items: {
          type: 'object',
          required: ['label', 'width_mm', 'height_mm', 'depth_mm', 'width_from', 'height_from'],
          properties: {
            label: { type: 'string', description: 'e.g. "Left alcove", or "" for a single space.' },
            width_mm: { type: 'number' },
            height_mm: { type: 'number', description: 'Floor to ceiling, or the height asked for.' },
            depth_mm: { type: 'number' },
            width_from: { type: 'string', enum: ['given', 'photo', 'guess'] },
            height_from: { type: 'string', enum: ['given', 'photo', 'guess'] },
          },
        },
      },
      seen: { type: 'array', maxItems: 6, items: { type: 'string' }, description: 'Short lines for Raf: what the photos show that matters (walls, floor, window, radiator, skirting, sockets, pipes, the colours in the room).' },
      check: { type: 'array', maxItems: 5, items: { type: 'string' }, description: 'Things Raf should check on the visit or before quoting firm.' },
      questions: { type: 'array', maxItems: 4, items: { type: 'string' }, description: 'Short questions to put in the reply, only ones that change the price or the design. Each a full question ending with a question mark, e.g. "Could you send a photo of the whole wall?"' },
      intro: { type: 'string', description: 'The opening of the reply, one or two sentences, no price.' },
      budget: { type: 'string', description: 'The budget they gave, as they said it, or "".' },
      wardrobe: {
        type: 'object',
        description: 'Only for kind "wardrobe".',
        required: ['units', 'drawers', 'top_cupboards', 'sliding', 'inside', 'pax_ok', 'pax_note'],
        properties: {
          units: { type: 'integer', description: 'How many units (carcasses) across all runs, about one per 600 to 1000 mm.' },
          drawers: { type: 'integer', description: 'Drawers asked for, in all. 0 if none mentioned.' },
          top_cupboards: { type: 'boolean', description: 'Separate cupboards over the doors, asked for or clearly wanted.' },
          sliding: { type: 'boolean', description: 'They asked for sliding doors.' },
          inside: { type: 'string', description: 'What goes inside, in the customer’s terms, e.g. "a shelf at the top, a hanging rail, and shelves below for folded clothes".' },
          pax_ok: { type: 'boolean', description: 'Whether IKEA PAX (58 cm deep, frames 50, 75 or 100 cm wide, 201 or 236 cm high) would suit this space.' },
          pax_note: { type: 'string', description: 'If not, why, in a few words for Raf.' },
        },
      },
      colours: {
        type: 'array',
        maxItems: 3,
        items: { type: 'object', required: ['code', 'why'], properties: { code: { type: 'string', description: 'A board code from the list.' }, why: { type: 'string', description: 'Up to 12 words, e.g. "a warm honey oak to go with your floor".' } } },
      },
      inside: { type: 'string', description: 'The board code for the inside of the finished-board wardrobe.' },
      recommend: { type: 'string', enum: ['plain', 'pax', 'shaker', 'board', 'none'], description: 'For a wardrobe, the option you think suits them best; "none" for other jobs.' },
      recommend_why: { type: 'string', description: 'A few words for Raf.' },
      extra: { type: 'string', description: "Only when Raf's instructions (for every quote, or for this one) ask for something in the message: that paragraph, in his voice, no price. Otherwise \"\"." },
      closing: { type: 'string', description: "Only when Raf's instructions (for every quote, or for this one) change the usual closing paragraph: his version, no price. Otherwise \"\"." },
      other_options: {
        type: 'array',
        maxItems: 3,
        description: 'Only for kind "other".',
        items: {
          type: 'object',
          required: ['name', 'says', 'how'],
          properties: {
            name: { type: 'string', description: 'Short, for the customer, e.g. "Raised loft boarding".' },
            says: { type: 'string', description: 'One or two sentences for the customer: what is in it. No price.' },
            how: { type: 'string', enum: ['rate', 'build'] },
            rate: { type: 'string', enum: RATE_KEYS, description: 'kitchen = a standard kitchen fit, labour only; laminateM2 = laying laminate per m², labour only; loftM2 = raised loft boarding per m²; deckingM2 = composite decking per m², supplied and fitted; door = hanging an internal door, labour only; mediaBasic / mediaMid = a media wall.' },
            qty: { type: 'number', description: 'For a rate: square metres, doors or jobs.' },
            days: { type: 'number', description: 'For build: days for one carpenter, workshop and fitting.' },
            materials: { type: 'array', maxItems: 12, items: { type: 'object', required: ['item', 'cost'], properties: { item: { type: 'string' }, cost: { type: 'number', description: 'Pounds before VAT.' } } } },
          },
        },
      },
    },
  },
} as const;

/* The defaults, then his own instructions for every quote, which win over them; and when he's written some for this
   quote (in the request), a word that those win over both. */
function systemFor(rules: Rules, own = false) {
  const one = own
    ? `\n\nRaf has also written instructions for this one quote, at the end of the request under "Raf's instructions for this quote". Follow them the same way: what to assume, what suits, which options to offer or leave out and which to recommend (pax_ok false when he says to leave out IKEA PAX), what to ask, and how the customer's words read; a paragraph he wants in this message goes in extra, a changed closing in closing. Where they differ from the defaults${rules.text ? ' or from his instructions for every quote' : ''}, they win. Use a fact he gives as he gives it, never make one up, and never write a price in any words.`
    : '';
  if (!rules.text) return SYSTEM + one;
  return `${SYSTEM}

Raf's own instructions for every quote follow. They come from Raf, so follow them, and where they differ from the defaults above, they win: what to assume, what suits, which options to offer or leave out and which to recommend (for example set pax_ok false when he says not to offer IKEA PAX, or put the drawers he asks for in wardrobe.drawers), what to ask, and how the customer's words read. If they ask for something in every message, write it in extra. If they change the usual closing paragraph ("${CLOSING}"), write his version in closing. Use a fact he gives (a lead time, a deposit) as he gives it, and never make one up. Never write a price in any words: the prices come only from his price list.

${rules.text}${one}`;
}

function boardList() {
  return BOARDS.map((b) => `${b.code} | ${b.name} | ${b.family} | ${b.describe} | £${b.exVat.toFixed(2)} a sheet before VAT`).join('\n');
}

function promptText(job: CurrentJob, notes: string[], photos: number) {
  const r = (s: string) => redact(s, job.name);
  return [
    `New enquiry #${job.number || '?'} in ServiceM8 (status ${job.status}${job.created ? `, came in ${job.created.slice(0, 10)}` : ''}).`,
    `Customer's first name: ${job.first || 'not known'}`,
    `Area: ${job.area || 'London'}`,
    '',
    'What they asked for, as it is in ServiceM8:',
    r(job.description).slice(0, 5000) || '(nothing written)',
    '',
    notes.length ? `Raf's own notes on the job, newest first:\n${notes.map((n) => `- ${r(n).slice(0, 800)}`).join('\n')}` : "Raf hasn't written notes on this job.",
    '',
    `${photos ? `${photos} photo${photos === 1 ? '' : 's'} from the job's diary follow.` : 'There are no photos on the job yet.'}`,
    '',
    'Finished boards Raf can buy cut and edged (Egger, 18 mm, 2800 x 2070 sheets): code | name | family | looks | price',
    boardList(),
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');
}

/* ---------- photos ---------- */

async function photoFor(uuid: string): Promise<string | null> {
  try {
    const f = await attachmentFile(uuid, 'full');
    if (!f.type.startsWith('image/')) return null;
    const jpg = await jpegOf(f.bytes, PHOTO_EDGE, 80); // iPhone photos (HEIC) too
    return Buffer.from(jpg).toString('base64');
  } catch {
    return null;
  }
}

/* ---------- asking Claude ---------- */

type Content = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };

async function ask(model: string, system: string, content: Content[]) {
  let res: Response;
  try {
    res = await fetch(`${API()}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4000, system, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(150_000),
    });
  } catch {
    throw new QuoteError('ai-busy', 'no answer');
  }
  return { res, text: await res.text().catch(() => '') };
}

const s = (v: unknown, max = 400) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/\s*[—–]\s*/g, ', ').trim().slice(0, max) : '');
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.parseFloat(String(v ?? '')) || 0);
const from = (v: unknown): From => (v === 'given' || v === 'photo' ? v : 'guess');
const list = (v: unknown, max: number, len = 200) => (Array.isArray(v) ? v.map((x) => s(x, len)).filter(Boolean).slice(0, max) : []);

/* The tool's answer made safe: strings trimmed, sizes in mm, codes from the list, at most so many of each. */
export function cleanRead(raw: Record<string, unknown>): QuoteRead {
  const codes = new Set(BOARDS.map((b) => b.code));
  const runs: Run[] = (Array.isArray(raw.runs) ? raw.runs : []).slice(0, 4).map((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    return { label: s(r.label, 40), width: Math.round(n(r.width_mm)), height: Math.round(n(r.height_mm)), depth: Math.round(n(r.depth_mm)), widthFrom: from(r.width_from), heightFrom: from(r.height_from) };
  });
  const w = (raw.wardrobe ?? {}) as Record<string, unknown>;
  const kind = raw.kind === 'wardrobe' ? 'wardrobe' : 'other';
  const other: OtherOption[] = (Array.isArray(raw.other_options) ? raw.other_options : []).slice(0, 3).map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const rate = RATE_KEYS.includes(o.rate as RateKey) ? (o.rate as RateKey) : undefined;
    return {
      name: s(o.name, 60) || 'Option',
      says: s(o.says, 400),
      how: o.how === 'rate' && rate ? 'rate' : 'build',
      rate,
      qty: n(o.qty) || undefined,
      days: n(o.days) || undefined,
      materials: (Array.isArray(o.materials) ? o.materials : []).slice(0, 12).map((mt) => ({ item: s((mt as Record<string, unknown>)?.item, 80), cost: Math.max(0, Math.round(n((mt as Record<string, unknown>)?.cost) * 100) / 100) })).filter((mt) => mt.item && mt.cost > 0),
    };
  });
  const rec = ['plain', 'pax', 'shaker', 'board', 'none'].includes(String(raw.recommend)) ? (raw.recommend as QuoteRead['recommend']) : 'none';
  return {
    kind,
    title: s(raw.title, 80) || (kind === 'wardrobe' ? 'Fitted wardrobe' : 'Enquiry'),
    summary: s(raw.summary, 500),
    runs,
    seen: list(raw.seen, 6),
    check: list(raw.check, 5),
    questions: list(raw.questions, 4),
    intro: s(raw.intro, 500),
    budget: s(raw.budget, 60),
    wardrobe:
      kind === 'wardrobe'
        ? { units: Math.max(0, Math.round(n(w.units))), drawers: Math.max(0, Math.round(n(w.drawers))), top: w.top_cupboards === true, sliding: w.sliding === true, inside: s(w.inside, 200), paxOk: w.pax_ok !== false, paxNote: s(w.pax_note, 160) }
        : undefined,
    colours: (Array.isArray(raw.colours) ? raw.colours : [])
      .map((c) => ({ code: s((c as Record<string, unknown>)?.code, 20), why: s((c as Record<string, unknown>)?.why, 90) }))
      .filter((c) => codes.has(c.code))
      .slice(0, 3),
    inside: codes.has(s(raw.inside, 20)) ? s(raw.inside, 20) : '',
    recommend: rec,
    recommendWhy: s(raw.recommend_why, 160),
    other: kind === 'other' ? other : [],
    extra: s(raw.extra, 700) || undefined,
    closing: s(raw.closing, 500) || undefined,
  };
}

export async function readEnquiry(job: CurrentJob, note = '', rules: Rules = { text: '', at: 0 }): Promise<QuoteData> {
  const started = Date.now();
  const [notes, photos] = await Promise.all([jobNotes(job.uuid).catch(() => []), jobPhotos(job.uuid).catch(() => [])]);
  const use = photos.slice(0, MAX_PHOTOS);
  const pics = await Promise.all(use.map((p) => photoFor(p.uuid)));
  const sent = use.filter((_, i) => pics[i]);
  if (!job.description.trim() && !notes.length && !sent.length) throw new QuoteError('no-text');
  const content: Content[] = [{ type: 'text', text: promptText(job, notes.map((x) => x.text).slice(0, 6), sent.length) }];
  pics.forEach((b64, i) => {
    if (!b64) return;
    content.push({ type: 'text', text: `Photo ${content.filter((c) => c.type === 'image').length + 1}: ${use[i].name}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
  });
  // his instructions for this quote last, after the photos, so they're the last thing read
  if (note.trim()) content.push({ type: 'text', text: `Raf's instructions for this quote (they win where they differ):\n${redact(note, job.name).slice(0, NOTE_MAX)}` });
  const system = systemFor(rules, Boolean(note.trim()));
  let model = MODEL();
  let { res, text } = await ask(model, system, content);
  if (res.status === 404 || (res.status === 400 && /model/i.test(text) && !/usage limit/i.test(text))) {
    model = FALLBACK_MODEL;
    ({ res, text } = await ask(model, system, content));
  }
  await noteClaude('quotes', model, res.status, text);
  const short = text.replace(/\s+/g, ' ').slice(0, 240);
  if (res.status === 401 || res.status === 403) throw new QuoteError('ai-key', short);
  if (/usage limit|spend limit|credit balance/i.test(text)) throw new QuoteError('ai-limit', short);
  if (res.status === 429 || res.status === 529 || res.status >= 500) throw new QuoteError('ai-busy', short);
  if (!res.ok) throw new QuoteError('ai-error', `${res.status} ${short}`);
  let body: { content?: { type: string; name?: string; input?: Record<string, unknown> }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  try {
    body = JSON.parse(text);
  } catch {
    throw new QuoteError('ai-error', 'unreadable answer');
  }
  const use1 = (body.content ?? []).find((c) => c.type === 'tool_use' && c.name === TOOL.name);
  if (!use1?.input) throw new QuoteError('ai-error', 'no reading in the answer');
  return {
    read: cleanRead(use1.input),
    job: { number: job.number, first: job.first, what: job.description.split('\n')[0].slice(0, 120), area: job.area, created: job.created },
    photos: sent.map((p) => ({ uuid: p.uuid, name: p.name })),
    skipped: photos.length - sent.length,
    model,
    at: Date.now(),
    ms: Date.now() - started,
    tokens: { in: body.usage?.input_tokens ?? 0, out: body.usage?.output_tokens ?? 0 },
    note: note.trim() || undefined,
    rulesAt: rules.at,
  };
}

/* Takes the job for one reading. Answers ok false with the state already there ('ready', 'working', 'failed') when
   a reading is done, under way, or failed in the last 30 minutes, unless force. */
export async function claimQuote(uuid: string, force = false): Promise<{ ok: boolean; state: string }> {
  if (!quotesSetUp()) return { ok: false, state: 'not-set-up' };
  const claim = (await quotesRpc('claim', { id: uuid, force }).catch(() => null)) as { ok?: boolean; state?: string } | null;
  return claim?.ok ? { ok: true, state: 'working' } : { ok: false, state: claim?.state ?? 'down' };
}

/* Reads a claimed job and keeps the answer. Never throws: a failure is kept as state 'failed' with its code. */
export async function runQuote(uuid: string, opts: { note?: string; job?: CurrentJob } = {}): Promise<{ ok: boolean; state: string }> {
  try {
    const job = opts.job ?? (await oneJob(uuid));
    if (!job) throw new QuoteError('sm8-gone');
    const data = await readEnquiry(job, opts.note ?? '', await getRules());
    await quotesRpc('save', { id: uuid, state: 'ready', data });
    return { ok: true, state: 'ready' };
  } catch (e) {
    const code = e instanceof QuoteError ? e.code : 'ai-error';
    const detail = e instanceof QuoteError ? e.detail : '';
    if (!(e instanceof QuoteError)) console.error('quote', uuid, e);
    await quotesRpc('save', { id: uuid, state: 'failed', data: { error: code, detail: detail.slice(0, 200), at: Date.now() } }).catch(() => null);
    return { ok: false, state: 'failed' };
  }
}

/* Both, for the website's brief (after its photos are in). */
export async function makeQuote(uuid: string, opts: { force?: boolean; note?: string; job?: CurrentJob } = {}) {
  const c = await claimQuote(uuid, Boolean(opts.force));
  return c.ok ? runQuote(uuid, opts) : c;
}
