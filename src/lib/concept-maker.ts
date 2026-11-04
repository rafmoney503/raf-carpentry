import { noteClaude } from './ai-usage';
import { attachment, outlookSetUp } from './outlook';
import { jpegOf } from './photo-jpeg';
import { sm8SetUp } from './servicem8';
import { attachmentFile } from './servicem8-diary';
import { redact } from './draft-reply';
import { jobkitRpc, syncSetUp } from './job-kit-sync-server';
import { cleanPlan, photoCount, type Brief, type ConceptData, type Plan } from './concept-plan';

/* Design with Claude (Job Kit, 3 Nov 2026): Claude plans a customer's piece of fitted furniture from the brief Raf
   fills in (often straight from their email in the Inbox, with its photos) as a layout of bays and sections, through
   one forced tool. The drawing and the prices are worked out from that layout by the Job Kit and the customer's page
   (src/lib/concept-plan.ts, src/components/ConceptDrawing.tsx), never by Claude.
   - What goes to Claude (ANTHROPIC_API_KEY, the Job Kit's prepaid key): the brief with contact details and the
     surname taken out (redact()), the customer's first name, up to 4 photos (from the email, or from the ServiceM8
     job it started from: Find their job, src/lib/concept-from-job.ts) made 1568 px, and for a
     change the current layout and what Raf asked for.
   - Kept in Supabase (cabinetos project, jobkit.concepts through public.jobkit_concepts with the Job Kit secret):
     the brief, the layout, the model; Raf's changes beside it (prices, what the page shows, live).
   - CONCEPT_MODEL (else ANTHROPIC_MODEL, else claude-sonnet-5-5) picks the model; ANTHROPIC_API the address (tests). */

const API = () => (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/+$/, '');
const MODEL = () => process.env.CONCEPT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-sonnet-5';
const MAX_PHOTOS = 4;
const PHOTO_EDGE = 1568;

export const conceptsSetUp = () => Boolean(process.env.ANTHROPIC_API_KEY) && syncSetUp();
export const conceptsRpc = (action: string, p: Record<string, unknown> = {}) => jobkitRpc('jobkit_concepts', { p_action: action, p }, 15000);

export class ConceptError extends Error {
  constructor(public code: 'ai-key' | 'ai-limit' | 'ai-busy' | 'ai-error' | 'no-text', public detail = '') {
    super(code);
  }
}

/* ---------- what Claude is told ---------- */

const SYSTEM = `You help Raf, a carpenter in London (Raf Carpentry), turn a customer's enquiry into concept drawings of fitted furniture: pantries and larders, cupboards, wardrobes, alcove units, bookcases, utility and boot room storage, built-in storage. You plan the layout through the concept_plan tool; Raf's app draws it to scale and prices it from his own price list. You never set or mention a price.

How a layout works (all sizes in mm):
- The run is the whole piece, left to right as you face it: width and height (the tallest bay).
- Bays are the upright sections across the run, left to right. Their widths add up to the run width exactly. Keep bays 400 to 1200 wide.
- Each bay has sections stacked from the floor (from 0) to the bay's top (its height). Sections touch: each one's to is the next one's from, and the last one ends at the bay's height.
- A bay is lower than the run when something is over it (a boxing, a slope, a window, a beam): give it its lower height and boxed_above true.
- front: "doors" is a pair of hinged doors (bays 600 to 1200 wide), "door" is one hinged door (bays up to 600 wide, hinge left or right), "drawers" (with how many), "open" is no front (open shelves; worktop true stands it on a solid oak top, e.g. a dresser's work surface).
- Inside each section: shelves as heights from the floor (food shelves 250 to 350 apart, more for tall things; heavy things low), rail for hanging, hooks for a broom cupboard, and a short label of what goes there for the customer ("tins, jars, spices").
- boxes: beams, pipe boxes or boxing that come into a bay at the back, as the bay's index (0 = leftmost), from and to heights. Shelves are cut round them, so a shelf just under or in front of one is shallow.
- Extras Raf prices: racks (door racks on the inside of doors, a count), risers (step risers on deep shelves, a count), oak_m (metres of solid oak worktop shelf), strip_out (old units to take out first).

Rules:
- Follow the must-haves exactly ("No drawers" means no drawers anywhere, "Shelves only" means shelves inside, no pull-outs).
- Use the sizes given. Guess sensibly where one is missing (a ceiling 2,400, pantry shelves 300 to 400 deep, a broom cupboard 500 to 900 wide) and say so in seen.
- A brief started from a job has parts: their enquiry first, then 'From your visit (Job Kit)' and 'Your notes on the job' (Raf's own words and sizes from seeing it: they win where they differ from the customer's), 'Their messages' and 'Their email to info@' (newest first: a newer message wins over an older one), and 'Your 3D design request'. Other sizes may list more than one space (two alcoves): design the one the sizes are for, and say in seen if they want the others too.
- Give exactly the number of options asked. If styles are named, one option per style in that order; else make them genuinely different (open or closed, budget, look). Mark one as your pick and say why.
- style: flat (MDF flat doors) or shaker. handles: bar, knob, edge (edge pulls) or push (push to open).
- Words are for a UK customer: plain English, short, no dashes, no prices, no timescales or guarantees. Never say Raf paints: the work is ready for their decorator.`;

const TOOL = {
  name: 'concept_plan',
  description: 'The layout of each option, drawn and priced by Raf’s app.',
  input_schema: {
    type: 'object',
    required: ['title', 'seen', 'intro', 'width', 'height', 'options', 'questions', 'strip_out'],
    properties: {
      title: { type: 'string', description: 'What it is, one or two words: "Pantry", "Alcove units".' },
      seen: { type: 'string', description: 'For Raf: what you understood from the brief and photos, sizes you guessed, anything to check. Two or three sentences.' },
      intro: { type: 'string', description: 'One sentence for the customer’s email after "Thanks for the details.", e.g. "Because of the beam boxes I’d go with shelves only, every shelf cut to fit round them."' },
      width: { type: 'number' },
      height: { type: 'number' },
      depth: { type: 'number', description: 'mm, if known' },
      strip_out: { type: 'boolean', description: 'Old units to take out first.' },
      questions: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short questions for the customer.' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'summary', 'style', 'handles', 'pick', 'bays', 'boxes', 'racks', 'risers', 'oak_m'],
          properties: {
            name: { type: 'string', description: '2 or 3 words: "Larder wall", "Open dresser".' },
            summary: { type: 'string', description: 'One line for the customer.' },
            style: { type: 'string', enum: ['flat', 'shaker'] },
            handles: { type: 'string', enum: ['bar', 'knob', 'edge', 'push'] },
            pick: { type: 'boolean' },
            why: { type: 'string', description: 'Only for your pick: why, one line for the customer.' },
            racks: { type: 'number' },
            risers: { type: 'number' },
            oak_m: { type: 'number' },
            boxes: {
              type: 'array',
              items: { type: 'object', required: ['bay', 'from', 'to'], properties: { bay: { type: 'number' }, from: { type: 'number' }, to: { type: 'number' }, label: { type: 'string' } } },
            },
            bays: {
              type: 'array',
              items: {
                type: 'object',
                required: ['width', 'height', 'sections'],
                properties: {
                  width: { type: 'number' },
                  height: { type: 'number' },
                  boxed_above: { type: 'boolean' },
                  sections: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['from', 'to', 'front', 'shelves'],
                      properties: {
                        from: { type: 'number' },
                        to: { type: 'number' },
                        front: { type: 'string', enum: ['doors', 'door', 'drawers', 'open'] },
                        hinge: { type: 'string', enum: ['left', 'right'] },
                        drawers: { type: 'number' },
                        worktop: { type: 'boolean' },
                        shelves: { type: 'array', items: { type: 'number' } },
                        rail: { type: 'number' },
                        hooks: { type: 'boolean' },
                        label: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

function briefText(b: Brief) {
  const name = b.first;
  const clean = (t: string) => redact(t, name).trim();
  return [
    `The customer: ${b.first || 'not named'}.`,
    `What they want:\n${clean(b.want) || '(not written)'}`,
    `Sizes: ${b.width ? `${b.width} wide` : 'width not given'}, ${b.height ? `${b.height} high` : 'height not given'}${b.depth ? `, depth ${b.depth}` : ''}.`,
    b.other.trim() ? `Other sizes and things to know: ${clean(b.other)}` : '',
    b.must.length ? `Must have: ${b.must.join('; ')}.` : '',
    b.styles.length ? `Styles to show, one option each in this order: ${b.styles.join('; ')}.` : 'Styles: pick them yourself.',
    `Options: ${Math.min(3, Math.max(1, b.count || 3))}.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/* ---------- photos from the customer's email and the job ---------- */

async function photoOf(mail: string, att: string): Promise<string | null> {
  try {
    const f = await attachment(mail, att);
    if (!f.type.startsWith('image/')) return null;
    return Buffer.from(await jpegOf(f.bytes, PHOTO_EDGE, 80)).toString('base64');
  } catch {
    return null;
  }
}
async function jobPhotoOf(uuid: string): Promise<string | null> {
  try {
    const f = await attachmentFile(uuid, 'full');
    if (!f.type.startsWith('image/')) return null;
    return Buffer.from(await jpegOf(f.bytes, PHOTO_EDGE, 80)).toString('base64'); // iPhone photos (HEIC) too
  } catch {
    return null;
  }
}
/* Up to 4: the email's first, then the job's (the phone picks them; cleanBrief keeps 4 at most). */
async function photosFor(b: Brief): Promise<{ data: string; from: string }[]> {
  const mail = b.mail && outlookSetUp() ? (b.photos ?? []).slice(0, MAX_PHOTOS).map((a) => ({ get: () => photoOf(b.mail as string, a), from: 'their email' })) : [];
  const job = b.sm8 && sm8SetUp() ? (b.jobPhotos ?? []).map((u) => ({ get: () => jobPhotoOf(u), from: 'the job' })) : [];
  const want = [...mail, ...job].slice(0, MAX_PHOTOS);
  const got = await Promise.all(want.map((w) => w.get()));
  return want.map((w, i) => ({ data: got[i] ?? '', from: w.from })).filter((x) => x.data);
}

/* ---------- asking Claude ---------- */

type Content = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };

async function ask(model: string, content: Content[]) {
  let res: Response;
  try {
    res = await fetch(`${API()}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 12000, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(110_000),
    });
  } catch {
    throw new ConceptError('ai-busy', 'no answer');
  }
  return { res, text: await res.text().catch(() => '') };
}

export async function drawConcept(data: ConceptData, note = '', current?: Plan): Promise<ConceptData> {
  const started = Date.now();
  const b = data.brief;
  if (!b.want.trim() && !b.width && !photoCount(b)) throw new ConceptError('no-text');
  const photos = await photosFor(b);
  const content: Content[] = [{ type: 'text', text: briefText(b) }];
  photos.forEach((p, i) => {
    content.push({ type: 'text', text: `Photo ${i + 1} from ${p.from}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.data } });
  });
  if (current && note.trim()) {
    content.push({ type: 'text', text: `The design as it is now (JSON):\n${JSON.stringify(current)}` });
    content.push({ type: 'text', text: `Raf wants this changed (it wins over the brief where they differ). Give the whole design again with the change made and everything else as it was:\n${redact(note, b.first).slice(0, 800)}` });
  } else if (note.trim()) {
    content.push({ type: 'text', text: `Raf adds (it wins over the brief where they differ):\n${redact(note, b.first).slice(0, 800)}` });
  }
  let model = MODEL();
  let { res, text } = await ask(model, content);
  if (res.status === 404 || (res.status === 400 && /model/i.test(text) && !/usage limit/i.test(text))) {
    model = FALLBACK_MODEL;
    ({ res, text } = await ask(model, content));
  }
  await noteClaude('design', model, res.status, text);
  const short = text.replace(/\s+/g, ' ').slice(0, 240);
  if (res.status === 401 || res.status === 403) throw new ConceptError('ai-key', short);
  if (/usage limit|spend limit|credit balance/i.test(text)) throw new ConceptError('ai-limit', short);
  if (res.status === 429 || res.status === 529 || res.status >= 500) throw new ConceptError('ai-busy', short);
  if (!res.ok) throw new ConceptError('ai-error', `${res.status} ${short}`);
  let body: { content?: { type: string; name?: string; input?: Record<string, unknown> }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  try {
    body = JSON.parse(text);
  } catch {
    throw new ConceptError('ai-error', 'unreadable answer');
  }
  const use = (body.content ?? []).find((c) => c.type === 'tool_use' && c.name === TOOL.name);
  if (!use?.input) throw new ConceptError('ai-error', 'no design in the answer');
  const plan = cleanPlan(use.input, b);
  if (!plan.options.length) throw new ConceptError('ai-error', 'no options in the answer');
  return {
    brief: b,
    plan,
    note: note.trim() || undefined,
    model,
    at: Date.now(),
    ms: Date.now() - started,
    tokens: { in: body.usage?.input_tokens ?? 0, out: body.usage?.output_tokens ?? 0 },
    photosSent: photos.length,
  };
}

/* Draws a claimed design and keeps the answer. Never throws: a failure is kept with its code (and the earlier
   drawing stays, so a failed change doesn't lose it). */
export async function runConcept(id: string, data: ConceptData, note = '', current?: Plan) {
  try {
    const out = await drawConcept(data, note, current);
    await conceptsRpc('save', { id, state: 'ready', data: out });
    return { ok: true, state: 'ready' };
  } catch (e) {
    const code = e instanceof ConceptError ? e.code : 'ai-error';
    const detail = e instanceof ConceptError ? e.detail : '';
    if (!(e instanceof ConceptError)) console.error('concept', id, e);
    await conceptsRpc('save', { id, state: 'failed', data: { brief: data.brief, error: code, detail: detail.slice(0, 200), at: Date.now() } }).catch(() => null);
    return { ok: false, state: 'failed' };
  }
}
