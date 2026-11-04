import { MUST_IDEAS, sizesFromText, type Brief } from './concept-plan';

/* Design with Claude started from a job (Raf, 4 Nov 2026: 'in design for customers in jobkit in new design with claude
   search first through the current jobs to get all available info and then fill missing bits below').
   The phone gathers everything it can find on one ServiceM8 job (src/app/job-kit/concepts.tsx JobFinder): the job's
   description (often the website brief), its diary (Raf's notes, WhatsApp chats added to it, their emails and texts,
   the photos), the Job Kit's own visit and 3D design request for it, the Quotes reading (Claude's sizes and Raf's
   own), and their newest email to info@. This turns that into the brief's boxes: their words and Raf's notes in
   "What they want", the sizes from the best source that has them, the must-haves their words ask for, the photos to
   send, and where each came from. Boxes it can't fill are left empty for Raf (missingOf); a size Quotes only guessed
   from the photos is offered, not filled in. Nothing here is stored or sent; it only fills the form on the phone.
   No React or browser code, so it can be tested on its own. */

export type Field = 'want' | 'first' | 'width' | 'height' | 'depth' | 'other' | 'must';
type Size3 = { width?: number; height?: number; depth?: number };
type Found = NonNullable<Brief['found']>;
export type PhotoPick = Found['photos'][number];

export type JobFacts = {
  job: { uuid: string; number: string; name: string; first: string; description: string };
  // the job's diary in ServiceM8, newest first (null: it couldn't be read)
  diary: { kind: string; at: string | null; text?: string; subject?: string; dir?: 'in' | 'out'; copy?: boolean; file?: { uuid: string; name: string; photo: boolean } }[] | null;
  // Job Kit jobs linked to it: Raf's visit (sizes and notes) and 3D design requests
  kit: { kind?: 'job' | 'design'; what: string; notes?: { talk?: string; wanted?: string; spots?: string; tricky?: string; sizes?: { what: string; w: string; h: string; d: string }[] }; design?: { brief: string; options: string; changes?: { text: string }[] } }[];
  // the Quotes reading of the job and Raf's own sizes in it
  quote: { runs: { label: string; width: number; height: number; depth: number; widthFrom: string; heightFrom: string }[]; own: { w?: number; h?: number; d?: number }[] } | null;
  // their newest email to info@ (the new part), with its photos
  mail: { id: string; subject: string; text: string; at: string; photos: { id: string; name: string }[] } | null;
};

export type JobFill = { brief: Partial<Brief>; found: Found };

export const MAX_PHOTOS = 4;
const WANT_MAX = 3000;
const OTHER_MAX = 600;
type Needed = 'want' | 'first' | 'width' | 'height' | 'depth';
const NEEDED: Needed[] = ['want', 'first', 'width', 'height', 'depth'];

/* The boxes still empty: what Raf fills in. */
export function missingOf(b: Pick<Brief, Needed>): Needed[] {
  return NEEDED.filter((k) => (k === 'width' || k === 'height' ? !b[k] : !String(b[k] ?? '').trim()));
}
export const FIELD_NAME: Record<Field, string> = { want: 'What they want', first: 'First name', width: 'Width', height: 'Height', depth: 'Depth', other: 'Other sizes', must: 'Must have' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayOf(at: string | null | undefined) {
  const m = (at ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''}` : '';
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const squash = (t: string) => t.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const cut = (t: string, max: number) => (t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* The customer's surname out of anything written here: only their first name ever goes to Claude. */
function withoutSurname(name: string) {
  const rest = name.trim().split(/\s+/).slice(1).filter((w) => w.length > 1);
  if (!rest.length) return (t: string) => t;
  const re = new RegExp(`\\b(${rest.map(esc).join('|')})\\b`, 'gi');
  return (t: string) => t.replace(re, '').replace(/ {2,}/g, ' ').replace(/ ([,.])/g, '$1');
}

/* The job's description as written for ServiceM8 (src/app/job-kit/brief-paste.ts writes the website brief as
   "What" first, then labelled lines and their words): contact details, the visit's practicalities and the
   Job Kit's own tags left out; what's left is what they want. */
const DROP_LINE = /^\s*(mobile|phone|tel|telephone|email|e-mail|address|postcode|parking|parking and access|when|price shown)\s*:/i;
const DROP_WHOLE = /^\s*(from the website brief|from an email to info@|i will send photos of the space next|photos of the space attached)\.?\s*$/i;
export function cleanDescription(d: string) {
  return squash(
    d
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter((l) => !DROP_LINE.test(l) && !DROP_WHOLE.test(l) && !/^\s*https?:\/\/\S+\s*$/i.test(l))
      .join('\n'),
  );
}

/* A size typed in the Job Kit's visit ('950', '2.4', '2400mm'): mm, or 0. */
function mmOf(v: string) {
  const m = (v ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(mm|cm|m)?/i);
  if (!m) return 0;
  const n = Number.parseFloat(m[1]);
  const u = (m[2] ?? '').toLowerCase();
  const mm = u === 'mm' ? n : u === 'cm' ? n * 10 : u === 'm' || n < 20 ? n * 1000 : n;
  return mm >= 100 && mm <= 15000 ? Math.round(mm) : 0;
}
const sizeLine = (label: string, w: number, h: number, d: number, note = '') =>
  `${label ? `${label}: ` : ''}${[w ? `${w} wide` : '', h ? `${h} high` : '', d ? `${d} deep` : ''].filter(Boolean).join(' x ')}${note}`;

const MUST_WORDS: [RegExp, string][] = [
  [/\bno drawers?\b|\bwithout drawers\b|\bdon'?t (?:want|need) (?:any )?drawers\b/i, 'No drawers'],
  [/\bshel(?:f|ves|ving) only\b|\bjust shel(?:f|ves|ving)\b|\bonly shel(?:f|ves|ving)\b/i, 'Shelves only'],
  [/\bbeam box(?:es|ing)?\b|\bboxing\b|\bboxed[- ]in\b/i, 'Round the beam boxes'],
  [/\bbroom\b|\bhoover\b|\bvacuum cleaner\b|\bmop\b|\bironing board\b/i, 'Broom cupboard'],
  [/\bkeep (?:the )?costs? down\b|\bon a (?:tight )?budget\b|\btight budget\b|\bas cheap as\b|\baffordable\b|\bcheapest\b/i, 'Keep the cost down'],
  [/\bhide (?:everything|it all|all of it)\b|\bhidden away\b|\b(?:everything|all) behind (?:closed )?doors\b/i, 'Doors to hide it all'],
  [/\bopen shel(?:f|ves|ving)\b/i, 'Some open shelves'],
];

export function fillFromJob(f: JobFacts): JobFill {
  const lines: string[] = [];
  const none: string[] = [];
  const from: Found['from'] = {};
  const guess: Size3 = {};
  const clean = withoutSurname(f.job.name);
  const diary = f.diary ?? [];

  // ---- the words ----
  const brief = clean(cleanDescription(f.job.description));
  const notes = diary.filter((e) => e.kind === 'note' && e.text?.trim() && squash(e.text) !== squash(f.job.description));
  const theirs = diary.filter((e) => (e.kind === 'email' || e.kind === 'sms') && e.dir === 'in' && !e.copy && e.text?.trim());
  const visits = f.kit.filter((k) => k.kind !== 'design' && k.notes);
  const requests = f.kit.filter((k) => k.kind === 'design' && k.design?.brief.trim());
  const same = (a: string, b: string) => squash(a).slice(0, 80).toLowerCase() === squash(b).slice(0, 80).toLowerCase();
  const mailText = f.mail && f.mail.text.trim() && !theirs.some((e) => same(e.text ?? '', f.mail!.text)) ? clean(squash(f.mail.text)) : '';

  const visitWords = visits.flatMap((k) => {
    const n = k.notes!;
    const sizes = (n.sizes ?? [])
      .map((s) => ({ what: s.what.trim(), w: mmOf(s.w), h: mmOf(s.h), d: mmOf(s.d) }))
      .filter((s) => s.w || s.h || s.d)
      .map((s) => sizeLine(s.what, s.w, s.h, s.d));
    return [n.wanted?.trim() && `They want: ${n.wanted.trim()}`, n.talk?.trim(), n.tricky?.trim() && `Tricky: ${n.tricky.trim()}`, n.spots?.trim() && `Spots: ${n.spots.trim()}`, sizes.length ? `Sizes: ${sizes.join('; ')}` : '']
      .filter((x): x is string => Boolean(x))
      .map((x) => clean(x));
  });
  const requestWords = requests.flatMap((k) => [k.design!.brief.trim(), k.design!.options.trim() && `Options asked for: ${k.design!.options.trim()}`, ...(k.design!.changes ?? []).map((c) => c.text.trim() && `Change: ${c.text.trim()}`)].filter((x): x is string => Boolean(x)).map((x) => clean(x)));

  // Sections in order; each item cut to fit, and nothing past the box's 3000 characters.
  const sections: [string, string[], number][] = [
    ['', brief ? [brief] : [], 1600],
    ['From your visit (Job Kit):', visitWords, 500],
    ['Your notes on the job:', notes.slice(0, 4).map((e) => `${dayOf(e.at) ? `${dayOf(e.at)}: ` : ''}${clean(squash(e.text ?? ''))}`), 600],
    ['Their messages:', theirs.slice(0, 3).map((e) => `${dayOf(e.at) ? `${dayOf(e.at)}: ` : ''}${clean(squash(e.text ?? ''))}`), 600],
    [`Their email to info@${f.mail ? ` (${dayOf(f.mail.at)})` : ''}:`, mailText ? [mailText] : [], 900],
    ['Your 3D design request:', requestWords, 500],
  ];
  let want = '';
  for (const [head, items, max] of sections) {
    const bits: string[] = [];
    let used = want.length + (want ? 2 : 0) + (head ? head.length + 1 : 0);
    for (const item of items) {
      const room = WANT_MAX - used - 4;
      if (room < 60) break;
      const one = cut(item, Math.min(max, room));
      const line = head && items.length > 1 ? `- ${one}` : one;
      bits.push(line);
      used += line.length + 1;
    }
    if (bits.length) want += `${want ? '\n\n' : ''}${head ? `${head}\n` : ''}${bits.join('\n')}`;
  }
  want = want.trim().slice(0, WANT_MAX);
  if (want) from.want = [brief && 'their enquiry', visitWords.length && 'your visit', notes.length && 'your notes', theirs.length && 'their messages', mailText && 'their email', requestWords.length && 'your design request'].filter(Boolean).join(', ');

  // ---- the sizes: the first source that has each ----
  const out: Size3 = {};
  const take = (s: Size3, where: string) => {
    for (const k of ['width', 'height', 'depth'] as const) {
      if (!out[k] && s[k]) {
        out[k] = s[k];
        from[k] = where;
      }
    }
  };
  const runs = f.quote?.runs ?? [];
  const own = f.quote?.own ?? [];
  if (runs.length) take({ width: own[0]?.w, height: own[0]?.h, depth: own[0]?.d }, 'your quote');
  const visitRows = visits.flatMap((k) => (k.notes?.sizes ?? []).map((s) => ({ what: s.what.trim(), w: mmOf(s.w), h: mmOf(s.h), d: mmOf(s.d) })).filter((s) => s.w || s.h || s.d));
  if (visitRows.length) take({ width: visitRows[0].w || undefined, height: visitRows[0].h || undefined, depth: visitRows[0].d || undefined }, 'your visit');
  // Raf's own measurements before the customer's rough size (the source shows by each box, so a size in a note
  // that's only part of the piece is easy to spot and change)
  for (const n of notes) take(sizesFromText(n.text ?? ''), 'your notes');
  for (const w of requestWords) take(sizesFromText(w), 'your design request');
  take(sizesFromText(f.job.description), 'their enquiry');
  for (const e of theirs) take(sizesFromText(e.text ?? ''), 'their messages');
  if (f.mail) take(sizesFromText(f.mail.text), 'their email');
  if (runs[0]) {
    const r = runs[0];
    take({ width: r.widthFrom === 'given' ? r.width : undefined, height: r.heightFrom === 'given' ? r.height : undefined }, 'the quote reading');
    // a size Quotes only guessed (from the photos or a sensible guess) is offered for an empty box, not filled in
    if (!out.width && r.width >= 100) guess.width = r.width;
    if (!out.height && r.height >= 100) guess.height = r.height;
    if (!out.depth && r.depth >= 100) guess.depth = r.depth;
  }

  // More than one space (two alcoves, a wall and a recess): every one in "Other sizes".
  const others: string[] = [];
  if (visitRows.length > 1) others.push(...visitRows.map((s) => sizeLine(s.what, s.w, s.h, s.d)));
  else if (runs.length > 1)
    others.push(
      ...runs.map((r, i) => {
        const w = own[i]?.w || r.width;
        const h = own[i]?.h || r.height;
        const d = own[i]?.d || r.depth;
        const guessed = !own[i]?.w && r.widthFrom !== 'given';
        return sizeLine(r.label || `Space ${i + 1}`, w, h, d, guessed ? ' (a guess from the photos)' : '');
      }),
    );
  const other = cut(clean(others.join('; ')), OTHER_MAX);
  if (other) from.other = visitRows.length > 1 ? 'your visit' : 'your quote';

  // ---- must-haves their words (or Raf's notes) ask for ----
  const said = [brief, ...theirs.map((e) => e.text ?? ''), mailText, ...notes.map((e) => e.text ?? ''), ...visitWords].join('\n');
  const must = MUST_WORDS.filter(([re]) => re.test(said)).map(([, m]) => m).filter((m) => MUST_IDEAS.includes(m));
  if (must.length) from.must = 'their words';

  // ---- first name ----
  const first = (f.job.first || f.job.name.trim().split(/\s+/)[0] || '').slice(0, 40);
  if (first) from.first = 'ServiceM8';

  // ---- photos: the job's and their email's, newest first; the newest 4 picked ----
  const photos: PhotoPick[] = [
    ...diary.filter((e) => e.kind === 'file' && e.file?.photo).map((e): PhotoPick => ({ src: 'job', id: e.file!.uuid, name: e.file!.name, at: e.at })),
    ...(f.mail?.photos ?? []).map((p): PhotoPick => ({ src: 'mail', id: p.id, name: p.name, at: f.mail!.at.slice(0, 16) })),
  ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const picked = photos.slice(0, MAX_PHOTOS);

  // ---- what was found, for Raf ----
  const what = brief.split('\n')[0].replace(/\.$/, '');
  if (brief) lines.push(`Their enquiry${f.job.number ? ` (job ${f.job.number})` : ''}: ${cut(what, 70)}`);
  else none.push('No description on the job');
  if (f.diary) {
    if (notes.length) lines.push(`${plural(notes.length, 'note')} on the job`);
    if (theirs.length) lines.push(`${plural(theirs.length, 'email or text', 'emails and texts')} from them`);
    const jobPhotos = photos.filter((p) => p.src === 'job').length;
    if (jobPhotos) lines.push(`${plural(jobPhotos, 'photo')} on the job`);
    if (!notes.length && !theirs.length && !jobPhotos) none.push('Nothing in the job’s diary yet (notes, messages, photos)');
  }
  if (visits.length) lines.push(`Your Job Kit visit${visitRows.length ? `: ${plural(visitRows.length, 'size')}` : ''}`);
  if (requests.length) lines.push('Your 3D design request');
  if (runs.length) lines.push(`The quote reading: ${plural(runs.length, 'space')}${own.some((o) => o?.w || o?.h || o?.d) ? ', with your own sizes' : ''}`);
  if (f.mail) lines.push(`Their email to info@ of ${dayOf(f.mail.at)}${f.mail.photos.length ? `, ${plural(f.mail.photos.length, 'photo')}` : ''}`);

  return {
    brief: {
      want,
      first,
      width: out.width ?? 0,
      height: out.height ?? 0,
      depth: out.depth ? String(out.depth) : '',
      other,
      must,
      sm8: f.job.uuid,
      jobPhotos: picked.filter((p) => p.src === 'job').map((p) => p.id),
      ...(f.mail ? { mail: f.mail.id, photos: picked.filter((p) => p.src === 'mail').map((p) => p.id) } : {}),
    },
    found: { at: 0, from, guess, lines, none, problems: [], photos },
  };
}

/* The job's facts poured into a brief Raf may have started: only boxes still empty are filled, his words stay. */
export function mergeFill(b: Brief, fill: JobFill, at: number): Brief {
  const f = fill.brief;
  const from = { ...fill.found.from };
  const keep = <K extends 'want' | 'first' | 'depth' | 'other'>(k: K) => {
    if (String(b[k] ?? '').trim()) {
      delete from[k];
      return b[k];
    }
    return (f[k] as Brief[K]) ?? b[k];
  };
  const num = (k: 'width' | 'height') => {
    if (b[k]) {
      delete from[k];
      return b[k];
    }
    return f[k] ?? 0;
  };
  return {
    ...b,
    want: keep('want'),
    first: keep('first'),
    depth: keep('depth'),
    other: keep('other'),
    width: num('width'),
    height: num('height'),
    must: [...b.must, ...(f.must ?? []).filter((m) => !b.must.includes(m))],
    sm8: f.sm8,
    jobPhotos: f.jobPhotos ?? [],
    ...(f.mail ? { mail: f.mail, photos: f.photos ?? [] } : b.mail ? {} : { mail: undefined, photos: undefined }),
    found: { ...fill.found, from, at },
  };
}
