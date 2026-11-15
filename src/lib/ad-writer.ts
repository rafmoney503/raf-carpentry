import { randomInt } from 'crypto';
import fs from 'fs';
import path from 'path';
import { listDrafts, putDrafts } from './ad-drafts';
import type { AdDraft, Business } from './ads-types';
import { noteClaude, REFUSED } from './ai-usage';
import { costJob, VAT_RATE } from './cost-calculator';
import { jpegOf } from './photo-jpeg';
import { getAllProjects } from './projects';

/* Ads for HQ's Ads section, written by Claude from Raf's own job photos (Raf Carpentry) or CabinetOS's own screens
   (15 Nov 2026, Raf: 'Results + ready ads'). Raf taps Write ads in HQ; Claude looks at up to 8 pictures and the
   facts below and writes each ad (picture, headline, words, button, the page it sends people to, who to show it to,
   why it should work); they're kept as drafts (src/lib/ad-drafts.ts) for Raf to approve or turn down. Nothing is
   sent to Meta: Raf makes an approved ad in Ads Manager himself, so no money moves without him.

   The pictures are fetched from www.rafcarpentry.com (ADS_PHOTO_ORIGIN in tests), because the website's public
   folder isn't inside its functions. ADS_MODEL (else ANTHROPIC_MODEL, else claude-sonnet-5-5) picks the model; the
   Job Kit's ANTHROPIC_API_KEY (prepaid credit), noted as 'ads' in the Job Kit's Claude credit. */

const API = () => (process.env.ANTHROPIC_API || 'https://api.anthropic.com').replace(/\/+$/, '');
const MODEL = () => process.env.ADS_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-sonnet-5';
const ORIGIN = () => (process.env.ADS_PHOTO_ORIGIN || 'https://www.rafcarpentry.com').replace(/\/+$/, '');

export class AdWriteError extends Error {
  constructor(public code: 'not-set-up' | 'ai-key' | 'ai-limit' | 'ai-busy' | 'ai-error' | 'store' | 'bad', public detail = '') {
    super(code);
  }
}

type Pic = { src: string; alt: string; job?: string; title?: string; area?: string; w?: number; h?: number; page?: string };

const CABINETOS_PICS: Pic[] = [
  { src: '/images/cabinetos/screens/3d-computer.webp', alt: 'CabinetOS on a computer: a bedroom job in 3D, two wardrobes, a chest of drawers and a bedside table', w: 2400, h: 1500 },
  { src: '/images/cabinetos/screens/cutlist-computer.webp', alt: 'CabinetOS on a computer: the cut list, every part with its code, size and edge banding', w: 2400, h: 1500 },
  { src: '/images/cabinetos/screens/optimise-computer.webp', alt: 'CabinetOS on a computer: the board layouts, parts packed on each sheet', w: 2400, h: 1500 },
  { src: '/images/cabinetos/screens/build-phone.webp', alt: 'CabinetOS on a phone, a tall screenshot (shows cropped in a feed): the units drawn to size on the Build page', w: 780, h: 1688 },
  { src: '/images/cabinetos/screens/cutlist-phone.webp', alt: 'CabinetOS on a phone, a tall screenshot (shows cropped in a feed): the cut list', w: 780, h: 1688 },
  { src: '/images/cabinetos/screens/2d-tablet.webp', alt: 'CabinetOS on a tablet: a unit drawn front on with every size', w: 1230, h: 1770 },
  { src: '/images/sketchup/extension/build-square-a568dfad.jpg', alt: 'The CabinetOS extension for SketchUp drawing an angled unit, a wardrobe and a chest board by board', w: 720, h: 720 },
  { src: '/images/drawings/whole-job-326649ff.webp', alt: 'A drawing sheet from CabinetOS: the whole job in 3D with its sizes', w: 1600, h: 1667 },
];

const RAF_PAGES: Record<string, string> = {
  '/cost/fitted-wardrobes': 'Wardrobe prices: a calculator, then Get a quote',
  '/how-it-works': 'Plan your project: the 3-step brief that sends Raf the job with photos',
  '/wardrobe-planner': 'Free wardrobe planner in 3D, then Send to Raf',
  '/designs/wardrobes': 'Fitted wardrobes Raf has built, each in 3D',
  '/services/fitted-wardrobes': 'Fitted wardrobes service page',
  '/services/alcove-units-and-bookcases': 'Alcove units and bookcases',
  '/services/wall-panelling': 'Wall panelling',
  '/services/kitchens': 'Kitchen fitting',
  '/services/window-seats-and-benches': 'Window seats and benches',
  '/portfolio': 'My Work: every job with photos',
  job: 'the job page of the picture (its photos, the steps, the job in 3D)',
};
const COS_PAGES: Record<string, string> = {
  '/': 'CabinetOS home page',
  '/demo': 'Try the real app, no sign-up',
  '/pricing': 'Plans and prices',
  '/sketchup-extension': 'The CabinetOS extension for SketchUp',
  '/blog/your-first-cut-list': 'Guide: your first cut list in 5 minutes',
  '/done-for-you': 'Done for you: drawings and cut lists drawn by Rafal, from £40 + VAT',
  '/cut-list-optimizer': 'Free cut list optimizer, no sign-up',
};
const CTAS = ['LEARN_MORE', 'GET_QUOTE', 'SIGN_UP', 'CONTACT_US', 'BOOK_NOW', 'SEE_MORE', 'GET_OFFER'];

/* the Black Friday week on CabinetOS (its src/lib/blackFriday.ts) */
const BF_END = Date.parse('2026-11-30T23:59:59Z');

function rating(): { stars: string; count: string } | null {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/pages/reviews.json'), 'utf8')) as { googleRating?: string; googleCount?: string };
    return r.googleRating && r.googleCount ? { stars: r.googleRating, count: r.googleCount } : null;
  } catch {
    return null;
  }
}

function rafFacts(): string {
  const w = costJob('fitted-wardrobes');
  const rate = w?.options.find((o) => o.id === w.def)?.rate ?? w?.options[0]?.rate;
  const r = rating();
  const areas = [...new Set(getAllProjects().map((p) => p.area))].slice(0, 16).join(', ');
  return [
    'RAF CARPENTRY (www.rafcarpentry.com). Rafal (Raf) Janczy, a carpenter in London, based in Wood Green N22, over 20 years in the trade.',
    'He builds fitted wardrobes, alcove units and bookcases, wall panelling, window seats, desks, cupboards and built-in storage; he also fits kitchens, doors, flooring and stud walls. Small and medium jobs in homes, not loft conversions or extensions.',
    `Jobs so far were in: ${areas}.`,
    rate ? `Price on the website: fitted wardrobes from £${rate.toLocaleString('en-GB')} a metre + VAT (£${Math.round(rate * (1 + VAT_RATE)).toLocaleString('en-GB')} with VAT), basic MDF with flat doors, ready for the customer's decorator. Shaker and mirror doors are priced on the visit.` : '',
    'What he promises: a reply within 24 hours, a free visit to measure up and a free quote, a 3D drawing to approve before anything is cut, 18 mm board with full backs, scribed to uneven walls, and the room left clean.',
    r ? `Google: ${r.stars} stars from ${r.count} reviews.` : '',
    'Brand line: "Just Build."',
    'Never say: that Raf paints or stains (his work is left ready for a decorator), how long a job takes, guarantees, deposits, discounts, "best" or "cheapest", or anything not written here.',
  ]
    .filter(Boolean)
    .join('\n');
}

function cosFacts(now = Date.now()): string {
  return [
    'CABINETOS (www.cabinetos.co.uk), Cabinet Operating System: an app for carpenters, joiners and cabinet makers. Draw the units to size and it makes the cut list, the board layouts, 2D and 3D drawings, an assembly guide and a client quote, then exports for a cutting company. Works on a computer, tablet and phone.',
    'Built by Rafal, a London carpenter, for his own jobs first. Trust line: "A carpenter built this. It actually works."',
    'Plans: Free (3 projects, 1 unit a project, 3 exports a month). Every new account gets a 14-day free trial with Pro\'s limits. Starter £19 a month (10 projects, 2 units a project), Pro £47 a month (20 projects, 3 units a project, includes the SketchUp extension), Studio £97 a month (30 projects, 5 units a project). Yearly: £190, £470, £970.',
    'Also: the real app to try with no sign-up (/demo); a free cut list optimizer; the CabinetOS extension for SketchUp (with Pro, Studio and Enterprise); Done for you, drawings and cut lists drawn by Rafal from £40 + VAT.',
    now <= BF_END
      ? 'Black Friday, Monday 23 to Monday 30 November 2026 only: 40% off the first year of a yearly plan (Starter £114, Pro £282 instead of £470, Studio £582), and new accounts made that week get a 30-day free trial. An ad using this must say the dates, and is only for that week: mark it black_friday.'
      : '',
    'Never say: anything about the app that isn\'t written here, "best", "No.1", guarantees, or prices other than these.',
  ]
    .filter(Boolean)
    .join('\n');
}

const RULES = [
  'Write in UK English, plainly, like a tradesperson talking: short sentences, concrete things (sizes, materials, what happens next). No long dashes, no emoji, no hashtags, no exclamation marks in a row, no ALL CAPS words.',
  'Headline up to 40 characters. Primary text: the first sentence is the hook and must work alone (Facebook shows about 125 characters before "See more"); 2 to 4 short sentences in all, under 300 characters. Description up to 30 characters.',
  "Meta's ad rules: never assert or imply the reader's personal attributes (no \"Are you a struggling carpenter?\", no \"Your messy bedroom\"); talk about the work, the app or what happens next. No fake urgency or countdowns, no before-and-after claims you can't see in the picture.",
  'Every ad different: a different picture, a different angle (price, the 3D drawing first, a real job and its area, no sign-up demo, the time it saves...). Pick only pictures that are sharp and show the finished thing well; say in angle why that picture.',
  'Audience: where (places and a radius), ages and 3 to 6 interests that exist in Meta\'s targeting, as Raf would type them in Ads Manager. Raf Carpentry: homeowners round his areas in North and West London. CabinetOS: carpenters, joiners and cabinet makers in the UK.',
];

const TOOL = {
  name: 'ad_drafts',
  description: 'The ads, each ready for Raf to check and paste into Meta Ads Manager.',
  input_schema: {
    type: 'object',
    properties: {
      ads: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            photo: { type: 'integer', description: 'the number of the picture used' },
            page: { type: 'string', description: 'where the ad sends people: one of the pages listed' },
            headline: { type: 'string' },
            text: { type: 'string', description: 'the primary text' },
            description: { type: 'string' },
            cta: { type: 'string', enum: CTAS },
            where: { type: 'string', description: 'places and radius' },
            ages: { type: 'string', description: 'e.g. 30 to 65' },
            interests: { type: 'array', items: { type: 'string' } },
            audience_note: { type: 'string', description: 'anything else about who to show it to, short' },
            angle: { type: 'string', description: 'for Raf: why this ad and this picture should work, one sentence' },
            black_friday: { type: 'boolean' },
          },
          required: ['photo', 'page', 'headline', 'text', 'description', 'cta', 'where', 'ages', 'interests', 'angle'],
        },
      },
    },
    required: ['ads'],
  },
};

const clean = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/ +([,.;:!?])/g, '$1')
        .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max)
    : '';
/* Cut to `max`: at the last comma or full stop that keeps over half of it, else on a word, and never ending on a
   little word ("from", "a", "no"...). */
const LITTLE = /\s+(a|an|the|and|or|but|to|from|for|of|in|on|at|by|with|no|your|our|my|is|are)$/i;
export function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const c = s.slice(0, max + 1);
  const stop = Math.max(c.lastIndexOf(', '), c.lastIndexOf('. '), c.lastIndexOf('; '));
  let out = stop > max * 0.5 ? c.slice(0, stop) : c.lastIndexOf(' ') > max * 0.6 ? c.slice(0, c.lastIndexOf(' ')) : s.slice(0, max);
  for (let i = 0; i < 3 && LITTLE.test(out); i++) out = out.replace(LITTLE, '');
  return out.replace(/[,;:\s]+$/, '');
}
const newId = () => Array.from({ length: 8 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[randomInt(32)]).join('');

/* Pictures to choose from: Raf's job photos, newest jobs first, wardrobes first (his price page is live), one or
   two from each job, leaving out those already in a draft he hasn't turned down; or CabinetOS's own screens. */
export function candidates(business: Business, used: Set<string>, note = '', usedJobs = new Set<string>()): Pic[] {
  if (business === 'cabinetos') return CABINETOS_PICS.filter((p) => !used.has(p.src)).concat(CABINETOS_PICS.filter((p) => used.has(p.src))).slice(0, 8);
  const words = note
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);
  const jobs = getAllProjects();
  // the jobs that match more of what Raf asked for first
  const hit = (p: (typeof jobs)[number]) => {
    const t = `${p.title} ${p.type} ${(p.tags ?? []).join(' ')} ${p.area}`.toLowerCase();
    return words.filter((w) => t.includes(w.replace(/s$/, ''))).length;
  };
  const wardrobe = (p: (typeof jobs)[number]) => /wardrobe|pax/i.test(`${p.title} ${p.type}`);
  const order = [...jobs].sort((a, b) => hit(b) - hit(a) || Number(usedJobs.has(a.slug)) - Number(usedJobs.has(b.slug)) || Number(wardrobe(b)) - Number(wardrobe(a)) || a.order - b.order);
  const out: Pic[] = [];
  for (const p of order) {
    const photos = [p.cover, ...(p.gallery ?? []).slice(0, 2)].filter((x) => x && !used.has(x.src));
    for (const ph of photos.slice(0, out.length < 4 ? 2 : 1)) {
      out.push({ src: ph.src, alt: ph.alt, w: ph.w, h: ph.h, job: p.slug, title: p.title, area: p.area, page: `/portfolio/${p.slug}` });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

async function picture(src: string): Promise<string | null> {
  try {
    const res = await fetch(`${ORIGIN()}${src}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const jpg = await jpegOf(new Uint8Array(await res.arrayBuffer()), 900, 80);
    return Buffer.from(jpg).toString('base64');
  } catch {
    return null;
  }
}

type Content = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };

async function ask(model: string, system: string, content: Content[]) {
  let res: Response;
  try {
    res = await fetch(`${API()}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 6000, system, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(100_000),
    });
  } catch {
    throw new AdWriteError('ai-busy', 'no answer');
  }
  return { res, text: await res.text().catch(() => '') };
}

type Raw = Record<string, unknown>;

/* Claude's answer made safe: the picture and page from the lists, lengths kept, no dashes or emoji, the link and
   URL parameters ours. */
export function cleanAds(raw: unknown, business: Business, pics: Pic[], note: string, now = Date.now()): AdDraft[] {
  const list = Array.isArray((raw as Raw)?.ads) ? ((raw as Raw).ads as Raw[]) : [];
  const pages = business === 'raf' ? RAF_PAGES : COS_PAGES;
  const out: AdDraft[] = [];
  const usedPics = new Set<number>();
  for (const a of list.slice(0, 6)) {
    const n = Math.round(Number(a?.photo));
    const pic = pics[n - 1];
    if (!pic || usedPics.has(n)) continue;
    usedPics.add(n);
    const headline = cut(clean(a.headline, 80), 40);
    const text = cut(clean(a.text, 700), 500);
    if (!headline || !text) continue;
    let page = typeof a.page === 'string' && a.page in pages ? a.page : business === 'raf' ? '/cost/fitted-wardrobes' : '/';
    if (page === 'job') page = pic.page || '/portfolio';
    const host = business === 'raf' ? 'https://www.rafcarpentry.com' : 'https://www.cabinetos.co.uk';
    const id = newId();
    const bf = business === 'cabinetos' && a.black_friday === true && now <= BF_END;
    out.push({
      id,
      business,
      status: 'new',
      at: now,
      photo: { src: pic.src, alt: pic.alt, job: pic.job, w: pic.w, h: pic.h },
      headline,
      text,
      description: cut(clean(a.description, 60), 30),
      cta: CTAS.includes(String(a.cta)) ? String(a.cta) : 'LEARN_MORE',
      page: `${host}${page === '/' ? '' : page}`,
      params: `utm_source=ads-{{site_source_name}}&utm_content=${id}`,
      audience: {
        where: cut(clean(a.where, 200), 160),
        ages: cut(clean(a.ages, 30), 20),
        interests: (Array.isArray(a.interests) ? a.interests : []).map((x) => cut(clean(x, 60), 40)).filter(Boolean).slice(0, 6),
        note: cut(clean(a.audience_note, 300), 200) || undefined,
      },
      angle: cut(clean(a.angle, 400), 240),
      offer: bf ? 'black-friday' : undefined,
      note: note || undefined,
    });
  }
  return out;
}

export async function writeAds(business: Business, count = 3, note = ''): Promise<AdDraft[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AdWriteError('not-set-up', 'ANTHROPIC_API_KEY');
  const want = Math.min(6, Math.max(1, Math.round(count) || 3));
  let before: AdDraft[] = [];
  try {
    before = await listDrafts();
  } catch {
    throw new AdWriteError('store');
  }
  const mine = before.filter((d) => d.business === business);
  const recent = mine.filter((d) => d.status !== 'no' && Date.now() - d.at < 60 * 86_400_000);
  const pics = candidates(business, new Set(recent.map((d) => d.photo.src)), note, new Set(recent.map((d) => d.photo.job ?? '')));
  const images = await Promise.all(pics.map((p) => picture(p.src)));
  const shown = pics.map((p, i) => ({ p, img: images[i] })).filter((x) => x.img);
  if (shown.length < Math.min(2, want)) throw new AdWriteError('ai-error', 'the pictures couldn’t be fetched from rafcarpentry.com');

  const system = [
    'You write Facebook and Instagram ads for a London carpenter\'s two businesses. You get the facts, the pictures you may use, and what was written before. Use only the facts; make nothing up.',
    business === 'raf' ? rafFacts() : cosFacts(),
    'Rules:',
    ...RULES.map((r) => `- ${r}`),
  ].join('\n\n');

  const content: Content[] = [];
  shown.forEach(({ p, img }, i) => {
    content.push({ type: 'text', text: `Picture ${i + 1}: ${p.alt}${p.title ? ` (job: ${p.title}, ${p.area})` : ''}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img! } });
  });
  const pages = business === 'raf' ? RAF_PAGES : COS_PAGES;
  const liked = mine.filter((d) => d.status === 'approved').slice(0, 6);
  const no = mine.filter((d) => d.status === 'no').slice(0, 6);
  const waiting = mine.filter((d) => d.status === 'new').slice(0, 8);
  content.push({
    type: 'text',
    text: [
      `Write ${want} different ${want === 1 ? 'ad' : 'ads'} for ${business === 'raf' ? 'Raf Carpentry' : 'CabinetOS'}.`,
      `Pages the ad can send people to (page):\n${Object.entries(pages)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')}`,
      liked.length ? `Raf approved these before (same style, new angles):\n${liked.map((d) => `- ${d.headline}: ${d.text}`).join('\n')}` : '',
      no.length ? `Raf said no to these (don't repeat them):\n${no.map((d) => `- ${d.headline}`).join('\n')}` : '',
      waiting.length ? `Already waiting for him (don't repeat the headlines or pictures):\n${waiting.map((d) => `- ${d.headline}`).join('\n')}` : '',
      note ? `Raf asked: ${note}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  });

  let model = MODEL();
  let { res, text } = await ask(model, system, content);
  if (res.status === 404 && /model/i.test(text) && model !== FALLBACK_MODEL) {
    model = FALLBACK_MODEL;
    ({ res, text } = await ask(model, system, content));
  }
  void noteClaude('ads', model, res.status, text);
  if (res.status === 401 || res.status === 403) throw new AdWriteError('ai-key');
  if (REFUSED.test(text) && res.status >= 400) throw new AdWriteError('ai-limit');
  if (res.status === 429 || res.status === 529 || res.status >= 500) throw new AdWriteError('ai-busy', `HTTP ${res.status}`);
  if (!res.ok) throw new AdWriteError('ai-error', text.slice(0, 200));
  let input: unknown;
  try {
    const body = JSON.parse(text) as { content?: { type: string; input?: unknown }[] };
    input = body.content?.find((c) => c.type === 'tool_use')?.input;
  } catch {
    throw new AdWriteError('ai-error', 'an answer that couldn’t be read');
  }
  const drafts = cleanAds(input, business, shown.map((x) => x.p), note).slice(0, want);
  if (!drafts.length) throw new AdWriteError('ai-error', 'no ads in the answer');
  try {
    await putDrafts(drafts);
  } catch {
    throw new AdWriteError('store');
  }
  return drafts;
}
