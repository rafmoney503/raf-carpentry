import { isFurniture } from './assistant-types';

/* What's agreed with the client, before Raf says yes to a job (Raf, 20 Nov 2026: "Next time on the job, I have to
   confirm everything. What type of door? Is the door have handles or knobs? Do they have push to open? Height,
   depth, everything before I accept with the client, otherwise I am surprised", then "Build").
   One list per ServiceM8 job: every choice that can catch him out, filled in on the visit (some of it already known
   from their enquiry, the rough quote or ServiceM8), sent to the client as one message for a written "yes", kept on
   the job in ServiceM8 as a note, and checked before the job moves to Work Order.
   No imports but the furniture test, so the phone, the tests and the server share it. */

export type AgreedKind = 'furniture' | 'other';
export type GroupId = 'size' | 'doors' | 'handles' | 'inside' | 'finish' | 'work' | 'price' | 'money';
export type FieldKind = 'mm' | 'num' | 'text' | 'long' | 'chips' | 'inout' | 'date';
export type Field = { id: string; group: GroupId; label: string; kind: FieldKind; options?: string[]; placeholder?: string; optional?: boolean };
export type From = 'brief' | 'quote' | 'servicem8' | 'rule';

/* Sent to them: when, how, the words' fingerprint, the words themselves (the record), and the ServiceM8 note. */
export type AgreedSent = {
  at: number;
  how: 'whatsapp' | 'wa-app' | 'email' | 'copy';
  hash: string;
  text: string;
  note?: string; // the note's uuid on the ServiceM8 job
  noted?: boolean; // ServiceM8 has the note
  wa?: { id: string; at: number; to: string; hash: string }; // sent from the Job Kit on WhatsApp (360dialog)
};
/* Their yes: when, how, which version, and their words when the Job Kit saw them (WhatsApp). */
export type AgreedOk = { at: number; how: 'whatsapp' | 'email' | 'text' | 'in-person'; hash: string; words?: string; noted?: boolean };
export type Agreed = {
  kind?: AgreedKind;
  v?: Record<string, string>; // field id -> answer ('' = cleared: the prefill doesn't come back)
  na?: string[]; // not on this job
  at?: number;
  sent?: AgreedSent;
  ok?: AgreedOk;
};

/* The day this started: jobs that went to Work Order before it aren't nagged about on Today. */
export const AGREE_FROM = '2026-11-20';

export const GROUPS: { id: GroupId; title: string; kinds: AgreedKind[] }[] = [
  { id: 'size', title: 'Size', kinds: ['furniture', 'other'] },
  { id: 'doors', title: 'Doors', kinds: ['furniture'] },
  { id: 'handles', title: 'Handles', kinds: ['furniture'] },
  { id: 'inside', title: 'Inside', kinds: ['furniture'] },
  { id: 'finish', title: 'Finish', kinds: ['furniture'] },
  { id: 'work', title: 'The work', kinds: ['other'] },
  { id: 'price', title: 'In the price', kinds: ['furniture', 'other'] },
  { id: 'money', title: 'Money and dates', kinds: ['furniture', 'other'] },
];

export const BARE = 'Bare MDF, for their decorator';
export const NO_DOORS = 'No doors';
const NO_HANDLE = ['Push to open', 'Finger cut-out', 'None'];

export const FIELDS: Field[] = [
  { id: 'w', group: 'size', label: 'Width', kind: 'mm' },
  { id: 'h', group: 'size', label: 'Height', kind: 'mm' },
  { id: 'd', group: 'size', label: 'Depth', kind: 'mm' },
  { id: 'top', group: 'size', label: 'At the top', kind: 'chips', options: ['Up to the ceiling', 'Top cupboards', 'A gap above'] },
  { id: 'skirting', group: 'size', label: 'Skirting', kind: 'chips', options: ['Taken off', 'Cut round it', 'No skirting'] },
  { id: 'plinth', group: 'size', label: 'At the bottom', kind: 'chips', options: ['Plinth', 'On legs', 'Straight on the floor'] },
  { id: 'more', group: 'size', label: 'Other sizes', kind: 'text', optional: true, placeholder: 'left alcove 950, right alcove 1,100' },
  { id: 'doors', group: 'doors', label: 'Style', kind: 'chips', options: ['Flat', 'Shaker', 'Mirror', 'Sliding', 'Glass', NO_DOORS] },
  { id: 'doorCount', group: 'doors', label: 'How many', kind: 'num' },
  { id: 'hinge', group: 'doors', label: 'Which way they open', kind: 'text', placeholder: 'in pairs, outer ones hinged at the walls' },
  { id: 'handles', group: 'handles', label: 'Type', kind: 'chips', options: ['Bar', 'Knob', 'Edge pull', ...NO_HANDLE] },
  { id: 'handleModel', group: 'handles', label: 'Which ones', kind: 'text', placeholder: 'brushed brass bar, 160 mm' },
  { id: 'handleWho', group: 'handles', label: 'Who buys them', kind: 'chips', options: ['I supply them', 'They supply them'] },
  { id: 'inside', group: 'inside', label: 'In each unit', kind: 'long', placeholder: 'Unit 1: long hanging. Unit 2: shelves over 3 drawers.' },
  { id: 'drawers', group: 'inside', label: 'Drawers', kind: 'chips', options: ['Behind the doors', 'On their own fronts', 'No drawers'] },
  { id: 'lights', group: 'inside', label: 'Lights', kind: 'chips', options: ['LED lights', 'No lights'] },
  { id: 'finish', group: 'finish', label: 'Finish', kind: 'chips', options: [BARE, 'Finished board', 'Natural wood', 'Other'] },
  { id: 'decor', group: 'finish', label: 'Colour, decor or wood', kind: 'text', placeholder: 'Egger W980 Platinum White' },
  { id: 'ends', group: 'finish', label: 'The ends', kind: 'chips', options: ['Fillers to the walls', 'End panels', 'Both'] },
  { id: 'work', group: 'work', label: 'What I’m doing', kind: 'long', placeholder: 'Lay 18 m² of laminate in the living room, with underlay and new beading.' },
  { id: 'old', group: 'price', label: 'Taking out what’s there now', kind: 'inout' },
  { id: 'waste', group: 'price', label: 'Taking the rubbish away', kind: 'inout' },
  { id: 'makegood', group: 'price', label: 'Making good the walls', kind: 'inout' },
  { id: 'decorating', group: 'price', label: 'Decorating', kind: 'inout' },
  { id: 'electrics', group: 'price', label: 'Electrics', kind: 'inout' },
  { id: 'price', group: 'money', label: 'Price', kind: 'text', placeholder: '£4,800' },
  { id: 'vat', group: 'money', label: 'VAT', kind: 'chips', options: ['Including VAT', '+ VAT'] },
  { id: 'deposit', group: 'money', label: 'Deposit', kind: 'text', placeholder: '£1,500 before I order the boards' },
  { id: 'rest', group: 'money', label: 'The rest', kind: 'chips', options: ['On the day it’s fitted', 'When it’s finished', 'In stages'] },
  { id: 'start', group: 'money', label: 'Start date', kind: 'date' },
  { id: 'days', group: 'money', label: 'Days on site', kind: 'num' },
  { id: 'access', group: 'money', label: 'Parking and access', kind: 'text', placeholder: 'on the drive, key from next door' },
  { id: 'note', group: 'money', label: 'Anything else to say', kind: 'long', optional: true, placeholder: 'I’ll bring the handles on the day for you to see first.' },
];
export const fieldOf = (id: string) => FIELDS.find((f) => f.id === id);

/* ---------- what's already known ---------- */

export type QuoteHint = { runs?: { label?: string; width: number; height: number; depth: number; widthFrom?: string; heightFrom?: string }[]; edits?: { runs?: { w?: number; h?: number; d?: number }[] } };
export type JobLike = { description?: string; total?: number | null; status?: string };

const num = (s: string) => Number(s.replace(/,/g, ''));
const mm = (n: number) => Math.round(n).toLocaleString('en-GB');
const lineOf = (text: string, label: RegExp) => new RegExp(`^\\s*${label.source}\\s*:\\s*(.+)$`, 'im').exec(text)?.[1]?.trim() ?? '';
export const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/* From their enquiry (the website brief, the wardrobe planner), Raf's rough quote and ServiceM8: what's already
   known, with where it came from. Raf's own answers always win over these. */
export function prefill(job: JobLike, quote?: QuoteHint | null): { v: Record<string, string>; from: Record<string, From> } {
  const v: Record<string, string> = {};
  const from: Record<string, From> = {};
  const put = (id: string, value: string, f: From) => {
    if (value && !v[id]) {
      v[id] = value;
      from[id] = f;
    }
  };
  // Raf's sizes in the rough quote first (his own, or given in the brief), then the brief's rough size
  const runs = quote?.runs ?? [];
  const sized = runs.map((r, i) => {
    const e = quote?.edits?.runs?.[i] ?? {};
    return { label: r.label || '', w: e.w || (r.widthFrom === 'given' ? r.width : 0), h: e.h || (r.heightFrom === 'given' ? r.height : 0), d: e.d || 0, own: Boolean(e.w || e.h || e.d) };
  });
  if (sized.length === 1) {
    const s = sized[0];
    if (s.w) put('w', String(Math.round(s.w)), 'quote');
    if (s.h) put('h', String(Math.round(s.h)), 'quote');
    if (s.d) put('d', String(Math.round(s.d)), 'quote');
  } else if (sized.length > 1 && sized.some((s) => s.w)) {
    put('more', sized.filter((s) => s.w).map((s) => `${s.label || 'space'} ${mm(s.w)}${s.h ? ` × ${mm(s.h)}` : ''}${s.d ? ` × ${mm(s.d)}` : ''}`).join('; '), 'quote');
  }
  const text = job.description ?? '';
  const rough = /Rough size:\s*([\d,]+)\s*(?:mm\s*)?wide\s*x\s*([\d,]+)\s*(?:mm\s*)?high/i.exec(text);
  if (rough) {
    put('w', String(num(rough[1])), 'brief');
    put('h', String(num(rough[2])), 'brief');
  }
  const space = /Space:\s*([\d,]+)\s*wide,\s*([\d,]+)\s*to the ceiling/i.exec(text);
  if (space) {
    put('w', String(num(space[1])), 'brief');
    put('h', String(num(space[2])), 'brief');
  }
  const height = lineOf(text, /Height/);
  if (/top cupboards?/i.test(height)) put('top', 'Top cupboards', 'brief');
  else if (/top infill/i.test(height)) put('top', 'Up to the ceiling', 'brief');
  if (/plinth\s*\d/i.test(height)) put('plinth', 'Plinth', 'brief');
  const doors = lineOf(text, /Doors/);
  if (doors) {
    const style = /shaker/i.test(doors) ? 'Shaker' : /mirror/i.test(doors) ? 'Mirror' : /sliding/i.test(doors) ? 'Sliding' : /flat/i.test(doors) ? 'Flat' : '';
    put('doors', style, 'brief');
    const n = /(\d+)\s+(?:flat |shaker |mirror |sliding )?doors?\b/i.exec(doors);
    if (n) put('doorCount', n[1], 'brief');
    if (/drawers below the doors/i.test(doors)) put('drawers', 'On their own fronts', 'brief');
  }
  const handles = `${doors} ${lineOf(text, /Handles/)}`;
  if (/push to open/i.test(handles)) put('handles', 'Push to open', 'brief');
  else if (/edge pull/i.test(handles)) put('handles', 'Edge pull', 'brief');
  else if (/\bknobs?\b/i.test(handles)) put('handles', 'Knob', 'brief');
  else if (/\bbar\b|\bbars\b/i.test(handles)) put('handles', 'Bar', 'brief');
  const inside = lineOf(text, /Inside/);
  if (inside) put('inside', inside.replace(/(^|;\s*)(\d+):\s*/g, (_, a: string, n: string) => `${a ? '. ' : ''}Unit ${n}: `).replace(/^\.\s*/, ''), 'brief');
  const finish = lineOf(text, /Finish/);
  if (/bare mdf|decorator/i.test(finish)) put('finish', BARE, 'brief');
  else if (/natural wood/i.test(finish)) put('finish', 'Natural wood', 'brief');
  const parking = lineOf(text, /Parking(?: and access)?/);
  if (parking) put('access', parking, 'brief');
  if (typeof job.total === 'number' && job.total > 0) put('price', gbp(job.total), 'servicem8');
  // Raf does the woodwork, never the decorating
  put('decorating', 'out', 'rule');
  return { v, from };
}

export const fromWords: Record<From, string> = { brief: 'from their enquiry', quote: 'from your rough quote', servicem8: 'from ServiceM8', rule: 'you don’t decorate' };

export function kindOf(a: Agreed | undefined, job: JobLike): AgreedKind {
  return a?.kind ?? (isFurniture(job.description ?? '') || !(job.description ?? '').trim() ? 'furniture' : 'other');
}

/* What doesn't apply, from the answers themselves: no doors means no hinges or handles to agree. */
export function skipped(v: Record<string, string>, na: string[] = []): Set<string> {
  const s = new Set(na);
  if (v.doors === NO_DOORS) for (const id of ['doorCount', 'hinge', 'handles', 'handleModel', 'handleWho']) s.add(id);
  if (v.doors === 'Sliding') s.add('hinge');
  if (NO_HANDLE.includes(v.handles)) {
    s.add('handleModel');
    s.add('handleWho');
  }
  if (v.finish === BARE) s.add('decor');
  return s;
}

/* ---------- the whole picture ---------- */

export type AgreedState = 'empty' | 'filling' | 'ready' | 'sent' | 'ok' | 'changed';
export type AgreedView = {
  kind: AgreedKind;
  values: Record<string, string>;
  from: Record<string, From>;
  skip: Set<string>; // not to agree: marked by hand (na) or not needed from the answers
  na: Set<string>; // marked "Not on this job" by hand
  fields: Field[]; // the ones on this kind of job
  done: number;
  total: number;
  missing: Field[];
  message: string;
  lines: string[];
  hash: string;
  state: AgreedState;
};

export function agreedView(a: Agreed | undefined, job: JobLike, opts: { first: string; what: string; quote?: QuoteHint | null }): AgreedView {
  const kind = kindOf(a, job);
  const pre = prefill(job, opts.quote);
  const own = a?.v ?? {};
  const values: Record<string, string> = { ...pre.v };
  const from: Record<string, From> = { ...pre.from };
  for (const [k, val] of Object.entries(own)) {
    values[k] = val;
    delete from[k];
  }
  const groups = new Set(GROUPS.filter((g) => g.kinds.includes(kind)).map((g) => g.id));
  const fields = FIELDS.filter((f) => groups.has(f.group));
  const skip = skipped(values, a?.na);
  const need = fields.filter((f) => !f.optional && !skip.has(f.id) && !(kind === 'other' && ['w', 'h', 'd', 'top', 'skirting', 'plinth'].includes(f.id)));
  const missing = need.filter((f) => !(values[f.id] ?? '').trim());
  const lines = agreedLines(values, kind, skip);
  const message = agreedMessage(lines, values, opts.first, opts.what);
  const hash = agreedHash(lines, values);
  const state: AgreedState = a?.ok
    ? a.ok.hash === hash
      ? 'ok'
      : 'changed'
    : a?.sent && a.sent.hash === hash
      ? 'sent'
      : !missing.length
        ? 'ready'
        : need.length - missing.length > 0 && Object.keys(own).length
          ? 'filling'
          : 'empty';
  return { kind, values, from, skip, na: new Set(a?.na ?? []), fields, done: need.length - missing.length, total: need.length, missing, message, lines, hash, state };
}

/* ---------- the words they get ---------- */

const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const listWords = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
export function dayWords(iso: string) {
  const t = Date.parse(`${iso}T12:00:00Z`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : iso;
}
const size = (s: string) => (/^\d[\d,]*$/.test(s.trim()) ? mm(num(s)) : s.trim());

export function agreedLines(v: Record<string, string>, kind: AgreedKind, skip: Set<string>): string[] {
  const has = (id: string) => !skip.has(id) && Boolean((v[id] ?? '').trim());
  const out: string[] = [];
  // Size
  const dims = [has('w') ? `${size(v.w)} wide` : '', has('h') ? `${size(v.h)} high` : '', has('d') ? `${size(v.d)} deep` : ''].filter(Boolean);
  const extras = [
    has('top') ? ({ 'Up to the ceiling': 'up to the ceiling', 'Top cupboards': 'with top cupboards', 'A gap above': 'with a gap above it' } as Record<string, string>)[v.top] ?? low(v.top) : '',
    has('skirting') ? ({ 'Taken off': 'the skirting taken off', 'Cut round it': 'cut round the skirting', 'No skirting': '' } as Record<string, string>)[v.skirting] ?? low(v.skirting) : '',
    has('plinth') ? ({ Plinth: 'on a plinth', 'On legs': 'on legs', 'Straight on the floor': 'straight on the floor' } as Record<string, string>)[v.plinth] ?? low(v.plinth) : '',
  ].filter(Boolean);
  if (dims.length || extras.length) out.push(`Size: ${[dims.length ? `${dims.join(' × ')} (mm)` : '', ...extras].filter(Boolean).join(', ')}`);
  if (has('more')) out.push(`Other sizes: ${v.more.trim()}`);
  if (kind === 'furniture') {
    // Doors
    if (v.doors === NO_DOORS && !skip.has('doors')) out.push('Doors: none, open shelves');
    else if (has('doors') || has('doorCount')) {
      const n = has('doorCount') ? Number(v.doorCount) : 0;
      const style = has('doors') ? low(v.doors) : '';
      const what = [n ? String(n) : '', style, n === 1 ? 'door' : 'doors'].filter(Boolean).join(' ');
      out.push(`Doors: ${what}${has('hinge') ? `, ${v.hinge.trim()}` : ''}`);
    }
    // Handles
    if (has('handles')) {
      const h = v.handles;
      if (h === 'Push to open') out.push('Handles: none, push to open');
      else if (h === 'Finger cut-out') out.push('Handles: none, finger cut-outs');
      else if (h === 'None') out.push('Handles: none');
      else {
        const kindWord = ({ Bar: 'bar handles', Knob: 'knobs', 'Edge pull': 'edge pulls' } as Record<string, string>)[h] ?? low(h);
        const who = has('handleWho') ? (v.handleWho === 'I supply them' ? 'I supply them' : 'you’re supplying them') : '';
        out.push(`Handles: ${[kindWord, has('handleModel') ? v.handleModel.trim() : '', who].filter(Boolean).join(', ')}`);
      }
    }
    // Inside
    if (has('inside')) out.push(`Inside: ${v.inside.trim().replace(/\s*\n+\s*/g, '. ')}`);
    if (has('drawers')) out.push(`Drawers: ${low(v.drawers)}`);
    if (has('lights')) out.push(`Lights: ${v.lights === 'No lights' ? 'none' : 'LED lights'}`);
    // Finish
    if (has('finish')) {
      const decor = has('decor') ? v.decor.trim() : '';
      const f = v.finish;
      out.push(
        f === BARE
          ? 'Finish: bare MDF, ready for your decorator to paint'
          : f === 'Finished board'
            ? `Finish: finished board${decor ? `, ${decor}` : ''}, nothing to paint`
            : f === 'Natural wood'
              ? `Finish: natural wood${decor ? `, ${decor}` : ''}`
              : `Finish: ${decor || low(f)}`,
      );
    }
    if (has('ends')) out.push(`The ends: ${({ 'Fillers to the walls': 'fillers scribed to the walls', 'End panels': 'end panels', Both: 'fillers scribed to the walls and end panels' } as Record<string, string>)[v.ends] ?? low(v.ends)}`);
  } else if (has('work')) out.push(`The work: ${v.work.trim().replace(/\s*\n+\s*/g, '. ')}`);
  // In the price
  const rows = FIELDS.filter((f) => f.kind === 'inout');
  const inP = rows.filter((f) => !skip.has(f.id) && v[f.id] === 'in').map((f) => low(f.label));
  const outP = rows.filter((f) => !skip.has(f.id) && v[f.id] === 'out').map((f) => low(f.label));
  if (inP.length) out.push(`In the price: ${listWords(inP)}`);
  if (outP.length) out.push(`Not in the price: ${listWords(outP)}`);
  // Money and dates
  if (has('price')) out.push(`Price: ${v.price.trim()}${has('vat') ? ` ${v.vat === '+ VAT' ? '+ VAT' : 'including VAT'}` : ''}`);
  if (has('deposit')) out.push(`Deposit: ${v.deposit.trim()}`);
  if (has('rest')) out.push(`The rest: ${low(v.rest)}`);
  if (has('start') || has('days')) {
    const days = has('days') ? Number(v.days) : 0;
    out.push(`Start: ${[has('start') ? dayWords(v.start) : 'date to agree', days ? `about ${days} ${days === 1 ? 'day' : 'days'} on site` : ''].filter(Boolean).join(', ')}`);
  }
  if (has('access')) out.push(`Parking and access: ${v.access.trim()}`);
  return out;
}

export function agreedMessage(lines: string[], v: Record<string, string>, first: string, what: string) {
  const hi = first ? `Hi ${first},` : 'Hi,';
  const thing = what ? `your ${low(what)}` : 'your job';
  const note = (v.note ?? '').trim();
  return [
    hi,
    '',
    `Before I order anything, here’s everything we’ve agreed for ${thing}. Please check each line and reply “Yes, agreed”, or tell me what to change:`,
    '',
    ...lines,
    ...(note ? ['', note] : []),
    '',
    'Anything not on this list isn’t in the price. If something changes after this, I’ll price the change before I do it.',
    '',
    'Thanks,',
    'Raf',
  ].join('\n');
}

/* The record on the ServiceM8 job: what was sent, and their yes when it comes. */
export function noteText(a: { sent: AgreedSent; ok?: AgreedOk }, name: string) {
  const how: Record<AgreedSent['how'], string> = { whatsapp: 'on WhatsApp from the Job Kit', 'wa-app': 'on WhatsApp', email: 'by email', copy: 'by message' };
  const yes: Record<AgreedOk['how'], string> = { whatsapp: 'on WhatsApp', email: 'by email', text: 'by text', 'in-person': 'in person' };
  const when = (t: number) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const body = a.sent.text.split('\n').filter((l, i, all) => i > 1 && i < all.length - 2).join('\n').trim(); // without the greeting and sign-off
  return [
    `What's agreed with ${name}, sent ${how[a.sent.how]}, ${when(a.sent.at)}:`,
    '',
    body,
    ...(a.ok ? ['', `${name} agreed it ${yes[a.ok.how]}, ${when(a.ok.at)}.${a.ok.words ? ` Their words: "${a.ok.words.slice(0, 300)}"` : ''}`] : ['', 'Waiting for their OK.']),
  ].join('\n');
}

/* Their WhatsApp reply reads like a yes */
export const soundsLikeYes = (s: string) => /\b(yes|yeah|yep|agreed|agree|ok|okay|perfect|go ahead|all good|happy|sounds good|great|lovely|brilliant|fine|tak|zgoda)\b/i.test(s) && !/\b(no|not|change|but|instead|wrong)\b/i.test(s);

/* What they agree to: the lines and the note (not the greeting, so a changed job name doesn't undo their yes). */
export const agreedHash = (lines: string[], v: Record<string, string>) => hashOf([...lines, (v.note ?? '').trim()].join('\n'));

/* For the warnings before Work Order: has it been agreed in writing? */
export const isAgreed = (a?: Agreed) => Boolean(a?.ok);

/* A short fingerprint of the words, so a changed list shows it hasn't been agreed in that version. */
export function hashOf(text: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
