/* "Draft a reply" in the Job Kit (a job's Emails and texts): Claude writes the next email or text to the customer
   from what they asked for and the conversation so far, keeping to what the site promises. Raf reads it, changes
   what he wants and sends it himself through ServiceM8: nothing here sends anything.
   What goes to Claude (Anthropic's API, ANTHROPIC_API_KEY in Vercel): the customer's first name, what the job is,
   ServiceM8's description and the last few messages, with email addresses, phone numbers, postcodes and
   Address / Mobile / Phone / Email lines taken out first. Their full name, address and contact details never go.
   ANTHROPIC_API overrides the address for local tests, ANTHROPIC_MODEL the model. */

const API = () => (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/+$/, '');
const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-sonnet-5';
export const aiSetUp = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type DraftInput = {
  mode: 'email' | 'sms';
  first: string;
  what: string;
  status: string;
  area: string;
  description: string;
  thread: { dir: 'in' | 'out'; via: 'email' | 'sms'; subject: string; text: string }[];
  note: string;
  name?: string; // their full name: only used to take the surname out, never sent
  source?: 'job' | 'inbox'; // inbox: an email to info@ (the Job Kit's Inbox), maybe not from a customer
};

export class DraftError extends Error {
  code: 'ai-key' | 'ai-limit' | 'ai-busy' | 'ai-error';
  detail: string;
  constructor(code: DraftError['code'], detail = '') {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/* Contact details out: whole lines that carry them, then anything that looks like one; their surname too. */
export function redact(s: string, name = '') {
  const [first, ...rest] = name.trim().split(/\s+/);
  const surnames = rest.filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  let t = s;
  if (first && surnames.length) t = t.replace(new RegExp(`\\b(${surnames.join('|')})\\b`, 'gi'), '').replace(/ {2,}/g, ' ').replace(/ ([,.])/g, '$1');
  return t
    .split(/\r?\n/)
    .filter((l) => !/^\s*(address|mobile|phone|tel|telephone|email|e-mail|postcode)\s*:/i.test(l))
    .join('\n')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/https?:\/\/\S+/g, (u) => (/rafcarpentry\.com/i.test(u) ? u : '[link]'))
    .replace(/(?:\+44|\b0044|\b0)[\d\s()-]{8,}\d/g, (m) => (m.replace(/\D/g, '').length >= 10 ? '[phone]' : m))
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, '[postcode]')
    .replace(STREET, '[address]');
}
// A house number and a street ("14 Oak Lane", "Flat 2, 7a High Street"): signatures carry them without a label.
const STREET =
  /\b(?:flat|apartment|unit)?\s*\d{1,4}[a-z]?,?\s+(?:[A-Z][\w'-]+\s+){1,3}(?:road|rd|street|st|lane|ln|avenue|ave|close|cl|gardens|gdns|grove|way|drive|dr|crescent|cres|place|pl|terrace|court|ct|hill|rise|walk|mews|square|sq|park|row|vale|view|green|parade)\b\.?/gi;

const SYSTEM = `You write replies for Raf, a carpenter in London who runs Raf Carpentry: fitted wardrobes, alcove units and bookcases, wall panelling, window seats, desks, cupboards and built-in storage, kitchen fitting, doors, flooring and stud walls. Raf reads every draft and sends it himself.

Write as Raf, in the first person, in UK English: plain, friendly and short. No dashes of any kind between words (no em or en dashes), no emoji, no bullet points.

Only promise what Raf already promises on his website:
- he replies within 24 hours;
- he comes round to measure up for free, then sends a quote, free as well;
- he draws it in 3D for them to approve, and nothing is cut until they sign it off.

Never give, guess or hint at prices, costs, budgets, deposits, dates, start dates, lead times, how long it takes, or guarantees. If they ask about any of these, say Raf will go through it at the visit or with the quote.
Never say Raf paints, sprays or stains anything: he does the woodwork and leaves it ready for their decorator.
Never make up anything about their room, sizes, materials, or past jobs.
Don't offer particular days or times unless Raf's note gives them; otherwise ask which days and times suit them for a visit.
If Raf's note says something, include it faithfully and in his words where you can.
Answer their questions where these rules allow; otherwise say Raf will confirm.
Text in square brackets like [phone] or [postcode] was removed for privacy: don't repeat it or ask about it.
Don't sign off with a name: Raf's name and details are added after your text.

For an email: start with "Hi <first name>," on its own line, then a blank line, then two to four short paragraphs. You may end with a short line such as "Thanks," on its own.
For a text message: one short paragraph starting "Hi <first name>, ", with no line breaks. Aim for under 130 characters (one text credit with Raf's name added); never over 290.

Reply with the message only: no subject line, no notes, no quotes around it.`;

function prompt(d: DraftInput) {
  const redact = (s: string) => redactWith(s, d.name ?? '');
  const thread = d.thread
    .slice(-8)
    .map((m) => `[${m.dir === 'in' ? (d.source === 'inbox' ? 'Them' : 'Customer') : 'Raf'}, ${m.via === 'sms' ? 'text' : 'email'}]${m.subject ? ` Subject: ${redact(m.subject).slice(0, 160)}\n` : ' '}${redact(m.text).slice(0, 1500)}`)
    .join('\n\n');
  if (d.source === 'inbox') {
    return [
      "Write Raf's reply to the newest email below. It came to his business inbox, info@rafcarpentry.com.",
      'It may be from a customer or someone asking about work, or from a supplier, a company or someone else: work out which from the emails.',
      'If it is not about work for a customer, write a short, polite reply that only answers what it asks, and leave out visits, quotes and 3D drawings.',
      'If it looks like spam, a newsletter or an automatic message, write only: This one looks automatic, so there is probably nothing to reply.',
      '',
      `Their first name: ${d.first || 'not known (start with "Hi,")'}`,
      d.description.trim() ? `\nWhat Raf has on them in ServiceM8:\n${redact(d.description).slice(0, 1500)}` : '',
      '',
      thread ? `The emails, oldest first (the last one is the one to answer):\n${thread}` : '(no email text)',
      '',
      `Raf's note for this reply: ${d.note.trim() ? redact(d.note).slice(0, 600) : 'none'}`,
    ].join('\n');
  }
  return [
    `Write Raf's next ${d.mode === 'sms' ? 'text message' : 'email'} to this customer.`,
    '',
    `Customer's first name: ${d.first || 'there'}`,
    `The job: ${redact(d.what) || 'not given'}${d.area ? `, ${redact(d.area)}` : ''} (ServiceM8 status: ${d.status || 'Quote'})`,
    '',
    'What they asked for, as it is in ServiceM8:',
    redact(d.description).slice(0, 3000) || '(nothing written down yet)',
    '',
    thread ? `The conversation so far, oldest first:\n${thread}` : 'There are no emails or texts on the job yet: this is Raf’s first reply.',
    '',
    `Raf's note for this reply: ${d.note.trim() ? redact(d.note).slice(0, 600) : 'none'}`,
  ].join('\n');
}

const redactWith = redact;

/* The draft as the box should get it: no dashes, no signature, the right greeting, a text on one line. */
export function tidyDraft(raw: string, d: Pick<DraftInput, 'mode' | 'first'>) {
  let t = raw.trim().replace(/^["“]|["”]$/g, '').trim();
  t = t
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/ ,/g, ',');
  const lines = t.split('\n');
  while (lines.length && /^\s*(raf|raf carpentry|raf janczy|07792\s?860221|www\.rafcarpentry\.com|rafcarpentry\.com)?\s*$/i.test(lines[lines.length - 1])) lines.pop();
  t = lines.join('\n').trim();
  if (d.mode === 'sms') {
    t = t.replace(/\s*\n+\s*/g, ' ').trim();
    if (t.length > 600) t = `${t.slice(0, 597).replace(/\s+\S*$/, '')}...`;
  }
  return t;
}

async function ask(model: string, d: DraftInput) {
  let res: Response;
  try {
    res = await fetch(`${API()}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 800, system: SYSTEM, messages: [{ role: 'user', content: prompt(d) }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new DraftError('ai-busy', 'no answer');
  }
  const text = await res.text().catch(() => '');
  return { res, text };
}

export async function draftReply(d: DraftInput): Promise<string> {
  let { res, text } = await ask(MODEL(), d);
  // A model this account doesn't have (yet): try the one before it.
  if (res.status === 404 || (res.status === 400 && /model/i.test(text) && !/usage limit/i.test(text))) ({ res, text } = await ask(FALLBACK_MODEL, d));
  const short = text.replace(/\s+/g, ' ').slice(0, 240);
  if (res.status === 401 || res.status === 403) throw new DraftError('ai-key', short);
  if (/usage limit|spend limit|credit balance/i.test(text)) throw new DraftError('ai-limit', short);
  if (res.status === 429 || res.status === 529 || res.status >= 500) throw new DraftError('ai-busy', short);
  if (!res.ok) throw new DraftError('ai-error', `${res.status} ${short}`);
  let body: { content?: { type: string; text?: string }[] };
  try {
    body = JSON.parse(text);
  } catch {
    throw new DraftError('ai-error', 'unreadable answer');
  }
  const out = (body.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
    .trim();
  if (!out) throw new DraftError('ai-error', 'empty answer');
  return tidyDraft(out, d);
}
