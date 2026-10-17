import { CONTACT_ITEM, MENU } from './menu';
import { FAQ, INTEGRATIONS, TRADES } from './content';
import { CABINETOS_URL } from './site';

/* What the site can find. Everything is searched in the browser, so answers come as the visitor types.
   The hero search on the home page uses HERO_ITEMS; the tape search in the header searches the whole site:
   every page, every # section, the systems, the trades, the questions, the connections, a paint sum when the
   visitor types something like "4 doors", and three things it can do (sketch, WhatsApp, send to Rafal). */

/* ---------- the hero search's list (also part of the site search) ---------- */

export type HeroKind = 'Live' | 'Being built' | 'Idea' | 'Trade' | 'How I work';
export type HeroItem = { k: HeroKind; title: string; sub: string; href?: string; trade?: string; words: string };

export const HERO_ITEMS: HeroItem[] = [
  { k: 'Live', title: 'CabinetOS', sub: 'Cut lists, board layouts and drawings for wardrobe and cabinet makers.', href: CABINETOS_URL, words: 'cabinetos cut list cutlist cutlists cutting board boards sheet sheets optimise waste carpenter carpenters joiner joinery cabinet cabinets wardrobe wardrobes drawing drawings parts mdf materials' },
  { k: 'Live', title: 'Job Kit', sub: 'The phone app that runs my business: enquiries, diary, emails, texts, money owed.', href: '/systems#job-kit', words: 'job kit phone app enquiry enquiries whatsapp lost diary schedule booking bookings email emails inbox reply replies text texts admin evenings paperwork today morning quote quotes follow' },
  { k: 'Live', title: 'ServiceM8 connection', sub: 'Jobs, clients, diary, payments, photos, emails and texts, read and written through the official API.', href: '/servicem8', words: 'servicem8 service m8 sm8 api jobs job clients client diary schedule payments invoices photos attachments integration connect connected tradify xero' },
  { k: 'Live', title: 'Website brief to ServiceM8', sub: 'A customer sends their brief and photos. It lands as a job and they get a reply with designs like theirs.', href: '/how-it-works#enquiry', words: 'website form lead leads enquiry enquiries photos auto automatic reply email brief customers lost missed' },
  { k: 'Live', title: 'Wardrobe planner', sub: 'Customers plan their wardrobe in 3D on your site. You get the job and the cut list.', href: '/systems#planner', words: 'wardrobe wardrobes planner configurator 3d design customer customers sizes doors' },
  { k: 'Being built', title: 'Paint schedule for decorators', sub: 'Litres per coat from the doors, fronts and panels. Brush or spray.', href: '/paint-schedule', words: 'paint painting painter painters decorator decorators decorating litres litre coats coat spray spraying brush primer undercoat doors door cupboards cupboard fronts m2 metres tins' },
  { k: 'Live', title: 'Money owed, every morning', sub: 'Who has paid, what is left, and a message ready to send.', href: '/how-it-works#enquiry', words: 'money payment payments chase chasing owe owed invoice invoices deposit deposits paid cash late' },
  { k: 'Live', title: 'Review requests', sub: 'A finished job asks for its Google review, ready for you to send.', href: '/how-it-works#enquiry', words: 'review reviews google ask stars finished feedback' },
  { k: 'Live', title: 'Replies drafted for you', sub: 'Claude writes the first draft of each reply. Nothing goes until you press send.', href: '/how-it-works#enquiry', words: 'reply replies email emails answer answering ai claude chatgpt draft drafts write writing messages' },
  { k: 'Idea', title: 'Quotes from the drawing', sub: 'Materials, labour and VAT worked out from the design you already drew.', trade: '', words: 'quote quotes quoting price pricing estimate estimates estimating evenings vat materials labour' },
  { k: 'Trade', title: 'Decorators', sub: 'Paint litres and shopping lists from the drawing, by hand or spray.', href: '/trades#decorators', words: 'decorator decorators decorating painter painters' },
  { k: 'Trade', title: 'Carpenters and joiners', sub: 'Cut lists, 3D designs for clients and a wardrobe planner on your website.', href: '/trades#carpenters', words: 'carpenter carpenters joiner joiners joinery cabinet makers fitted furniture' },
  { k: 'Trade', title: 'Kitchen fitters', sub: 'Fitting packs, appliance lists and snagging photos.', href: '/trades#kitchen-fitters', words: 'kitchen kitchens fitter fitters fitting appliances snagging worktop worktops' },
  { k: 'Trade', title: 'Builders and renovators', sub: 'Stage payments, extras and client updates in one place.', href: '/trades#builders', words: 'builder builders renovation renovations refurb extension stage payments extras variations bathroom bathrooms loft' },
  { k: 'Trade', title: 'Electricians and plumbers', sub: 'Job sheets, parts lists and certificates filed on the job.', href: '/trades#electricians-plumbers', words: 'electrician electricians electrical plumber plumbers plumbing heating gas boiler certificate certificates parts' },
  { k: 'How I work', title: 'How long it takes', sub: 'A mockup in 2 days. A working version in 2 to 4 weeks.', href: '/how-it-works#steps', words: 'how long fast quick time delivery cost price process start weeks days own owner' },
];

/* ---------- the site index ---------- */

export type HitKind = 'page' | 'section' | 'system' | 'trade' | 'faq' | 'connection' | 'sum' | 'sketch' | 'whatsapp' | 'send';
export type Hit = { kind: HitKind; title: string; sub: string; href?: string; external?: boolean; big?: string; bigNote?: string };
type Entry = Hit & { words: string; titleWords: string; boost: number };

// Extra words people might type for each # section, so "faq", "cost" or "formula" finds the right place.
const SECTION_WORDS: Record<string, string> = {
  cabinetos: 'cut list cutlist boards sheet waste wardrobe cabinet carpenter',
  'job-kit': 'phone app enquiries diary emails texts money owed quote quotes follow up today whatsapp morning',
  planner: 'wardrobe planner 3d configurator customers design',
  next: 'paint decorator schedule litres being built',
  steps: 'process how long weeks days mockup visit price start four',
  enquiry: 'enquiry enquiries form lead website servicem8 job typed once reply review payments start finish',
  questions: 'faq questions cost price own phone customers details',
  reads: 'servicem8 jobs clients payments diary emails texts read',
  writes: 'servicem8 clients jobs photos status bookings emails texts write',
  rules: 'servicem8 delete never privacy customers details rules',
  setup: 'servicem8 api key account need setup set up',
  integrations: 'microsoft outlook whatsapp claude stripe supabase sketchup postcode land registry connections',
  calculator: 'paint litres calculator doors fronts coats spray brush tins try',
  sums: 'sum sums formula coverage coats litres spray brush maths',
  app: 'decorator app phone cabinetos drawing paint list shopping',
  story: 'about rafal carpenter london years workshop story',
  numbers: 'numbers jobs years systems facts',
  company: 'company vat number address wood green ltd raf carpentry',
  form: 'contact message send form servicem8',
  details: 'phone call whatsapp email number mobile',
  'next-steps': 'after send reply visit mockup next',
};

const words = (s: string) => s.toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(Boolean).join(' ');

/* Rafal wants the search to lead with CabinetOS and the systems running today, and to keep decorating in the
   background. A match on any of these gets a weight on top of its score; it never makes an unrelated result appear. */
function weight(h: Hit) {
  const where = `${h.href ?? ''} ${h.title}`.toLowerCase();
  if (where.includes('cabinetos')) return 4;
  if (/paint|decorat/.test(where) || where.includes('/systems#next')) return -4;
  if (where.startsWith('/systems') || h.href?.startsWith('/systems')) return 2;
  return 0;
}

function buildIndex(): Entry[] {
  const out: Entry[] = [];
  const add = (h: Hit, extra = '') => out.push({ ...h, titleWords: words(h.title), words: words(`${h.title} ${h.sub} ${extra}`), boost: weight(h) });

  for (const m of [...MENU, CONTACT_ITEM]) {
    add({ kind: 'page', title: m.label, sub: `${m.title}.`, href: m.href }, `${m.kicker} ${m.line}`);
    for (const t of m.tags) add({ kind: 'section', title: `# ${t.label}`, sub: `On ${m.label}`, href: `${m.href}#${t.id}` }, SECTION_WORDS[t.id] ?? '');
  }
  for (const it of HERO_ITEMS) {
    if (!it.href || it.k === 'Trade') continue;
    add({ kind: 'system', title: it.title, sub: it.sub, href: it.href, external: it.href.startsWith('http') }, it.words);
  }
  for (const t of TRADES) add({ kind: 'trade', title: t.name, sub: t.short, href: `/trades#${t.id}` }, `${t.trade} ${t.time.join(' ')} ${t.system.join(' ')}`);
  for (const f of FAQ) {
    // the first sentence of the answer, or the first two when the first is just "Yes."
    const parts = f.a.split('. ');
    const sub = (parts[0].length < 20 ? parts.slice(0, 2).join('. ') : parts[0]).replace(/\.$/, '') + '.';
    add({ kind: 'faq', title: f.q, sub, href: '/how-it-works#questions' }, f.a);
  }
  for (const i of INTEGRATIONS) add({ kind: 'connection', title: i.name, sub: i.what, href: '/servicem8#integrations' }, i.where);
  return out;
}

const INDEX = buildIndex();
const STOP = new Set(['the', 'my', 'me', 'to', 'of', 'for', 'and', 'a', 'an', 'is', 'it', 'in', 'on', 'do', 'how', 'what', 'i', 'you', 'your', 'can', 'with']);

function score(e: Entry, terms: string[], phrase: string) {
  const ws = e.words.split(' ');
  const tw = e.titleWords.split(' ');
  let s = 0;
  for (const t of terms) {
    if (tw.includes(t)) s += 5;
    else if (ws.includes(t)) s += 3;
    else if (ws.some((x) => x.startsWith(t) || (t.length > 3 && x.length > 3 && t.startsWith(x)))) s += 1;
  }
  if (phrase.length > 2 && e.titleWords.includes(phrase)) s += 4;
  if (e.kind === 'page' && e.titleWords === phrase) s += 3;
  return s;
}

/* ---------- paint sums ---------- */

// Same sizes and figures as the paint schedule page: a 600 x 2000 door and a 600 x 400 front, both faces and the
// four 18 mm edges; 2 coats of top coat at 12 m² per litre; about 95% lands by brush, 65% by spray.
const DOOR = 2 * 0.6 * 2.0 + 2 * (0.6 + 2.0) * 0.018;
const FRONT = 2 * 0.6 * 0.4 + 2 * (0.6 + 0.4) * 0.018;
const litres = (area: number, share: number) => (area * 2) / 12 / share;
const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

export function paintSum(q: string): Hit | null {
  const s = q.toLowerCase();
  const doors = s.match(/(\d{1,3})\s*(?:x\s*)?(?:tall\s+)?doors?\b/);
  const fronts = s.match(/(\d{1,3})\s*(?:x\s*)?(?:drawer\s*)?(?:fronts?|drawers?)\b/);
  const d = doors ? Number(doors[1]) : 0;
  const f = fronts ? Number(fronts[1]) : 0;
  if (!d && !f) return null;
  const area = d * DOOR + f * FRONT;
  const parts = [d ? `${d} door${d > 1 ? 's' : ''}` : '', f ? `${f} front${f > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ');
  const sizes = [d ? '600 × 2000' : '', f ? '600 × 400' : ''].filter(Boolean).join(', ');
  return {
    kind: 'sum',
    title: `Paint for ${parts}`,
    sub: `${sizes}, 2 coats · ${one(litres(area, 0.65))} L if sprayed`,
    big: `${one(litres(area, 0.95))} L`,
    bigNote: 'BRUSHED',
    href: '/paint-schedule#calculator',
  };
}

/* ---------- the search ---------- */

export function siteSearch(raw: string): Hit[] {
  const q = raw.trim();
  if (!q) return [];
  const phrase = words(q);
  const terms = phrase.split(' ').filter((t) => t.length > 1 && !STOP.has(t));
  const sum = paintSum(q);
  const best = new Map<string, { e: Entry; s: number }>();
  if (terms.length) {
    for (const e of INDEX) {
      const raw = score(e, terms, phrase);
      if (raw <= 0) continue;
      const s = Math.max(1, raw + e.boost);
      const key = e.href ?? e.title;
      const had = best.get(key);
      if (!had || s > had.s) best.set(key, { e, s });
    }
  }
  const ranked = [...best.values()].sort((a, b) => b.s - a.s).map(({ e }) => {
    const { words: _w, titleWords: _t, boost: _b, ...hit } = e;
    return hit as Hit;
  });
  let hits: Hit[] = ranked.slice(0, sum ? 3 : 4);
  if (sum) hits = [sum, ...hits];
  if (hits.length < 2) hits.push({ kind: 'sketch', title: 'Sketch my system', sub: 'The 60-second planner, with your words in it' });
  const short = q.length > 22 ? `${q.slice(0, 21)}…` : q;
  hits.push({ kind: 'send', title: `Send “${short}” to Rafal`, sub: 'Lands in his ServiceM8 as a job' });
  return hits.slice(0, 5);
}

export const KIND_LABEL: Record<HitKind, string> = {
  page: 'PAGE',
  section: 'SECTION',
  system: 'SYSTEM',
  trade: 'TRADE',
  faq: 'FAQ',
  connection: 'CONNECTION',
  sum: 'SUM',
  sketch: 'TOOL',
  whatsapp: 'DO',
  send: 'SEND',
};

export const SEARCH_TRIES = ['cut lists', 'wardrobe planner', 'ServiceM8', 'enquiries', 'quotes'];

// Shown when the tape opens, before anything is typed: the systems running today, CabinetOS as the longest piece.
export const RUNNING_TODAY: Hit[] = [
  { kind: 'system', title: 'CabinetOS', sub: 'Cut lists, board layouts and drawings for wardrobe and cabinet makers.', href: '/systems#cabinetos' },
  { kind: 'system', title: 'Job Kit', sub: 'Enquiries, diary, emails and money owed on my phone, with ServiceM8.', href: '/systems#job-kit' },
  { kind: 'system', title: 'Wardrobe planner', sub: 'Customers plan in 3D; you get the job and the cut list.', href: '/systems#planner' },
];
