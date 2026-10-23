/* "Got an IKEA PAX design?" (23 Oct 2026, Raf: 'is there a way to connect with ikea pax planner on rafcarpentry
   website', then 'yes' to a design-code option). IKEA's PAX planner has no API and can't be embedded: a design
   gives a code (IKEA's planner: press Finalise, the code is at the bottom of the page; the share button gives a link)
   that opens it again in IKEA's planner or in store. So the customer sends the code (or link), screenshots or the
   product list, what they want from Raf and a rough size, and Raf opens it in IKEA's planner.
   The sums and words for the wardrobe planner's IKEA PAX sheet (src/app/wardrobe-planner/pax-send.tsx) and its
   message, in the brief format parseBrief reads (src/app/job-kit/brief-paste.ts). No imports, so it can be tested
   on its own. */

export type PaxWants = { fit: boolean; fillers: boolean; top: boolean; plinth: boolean; doors: boolean };
export type PaxWantKey = keyof PaxWants;

/* What the customer can ask for, in order: title and line on the chip, words in the message. */
export const PAX_WANTS: { key: PaxWantKey; title: string; sub: string; words: string }[] = [
  { key: 'fit', title: 'Build and fit it', sub: 'Frames, doors and insides put together and fixed to the wall', words: 'build and fit it' },
  { key: 'fillers', title: 'Fillers to the walls', sub: 'Scribed to the walls, so there are no gaps at the sides', words: 'fillers scribed to the walls' },
  { key: 'top', title: 'Up to the ceiling', sub: 'Top boxes or an infill panel scribed to the ceiling', words: 'top boxes or an infill up to the ceiling' },
  { key: 'plinth', title: 'A plinth', sub: 'A kick board along the floor, like a fitted wardrobe', words: 'a plinth' },
  { key: 'doors', title: 'My own doors', sub: "Made to measure in MDF instead of IKEA's, ready for your decorator", words: 'doors made to measure in MDF, ready for my decorator' },
];

/* Built in: fitted, with fillers and up to the ceiling. The plinth and doors are theirs to add. */
export const PAX_WANTS_START: PaxWants = { fit: true, fillers: true, top: true, plinth: false, doors: false };

export const PAX_PLANNER_URL = 'https://www.ikea.com/gb/en/planner/pax-planner';
export const PAX_MAX_SHOTS = 6;
const LIST_LINES = 40;
const LIST_CHARS = 1500;

/* What was typed in the design code box: a link (kept whole, it opens the design) or a code (spaces taken out). */
export function readCode(raw: string): { kind: 'code' | 'link' | ''; value: string } {
  const s = raw.replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').trim();
  if (!s) return { kind: '', value: '' };
  const link = s.match(/https?:\/\/\S+/i);
  if (link) return { kind: 'link', value: link[0].slice(0, 300) };
  if (/^(?:www\.)?ikea\.com\//i.test(s)) return { kind: 'link', value: `https://${s.split(/\s/)[0].slice(0, 290)}` };
  return { kind: 'code', value: s.replace(/\s+/g, '').slice(0, 40) };
}

/* The product list copied from IKEA's planner: one item a line, tabs and runs of spaces tidied, empty lines out,
   at most 40 lines and 1500 characters (the brief has to fit a ServiceM8 job description). */
export function readList(raw: string): string[] {
  const out: string[] = [];
  let n = 0;
  for (const l of raw.replace(/\r/g, '').split('\n')) {
    const line = l.replace(/[\t\u00a0]+/g, ' ').replace(/ {2,}/g, ' ').trim();
    if (!line) continue;
    if (out.length >= LIST_LINES || n + line.length > LIST_CHARS) {
      out.push('(the rest of the list is in the screenshots or IKEA design)');
      break;
    }
    out.push(line);
    n += line.length;
  }
  return out;
}

/* A size typed in mm, or null when it isn't one (rough sizes, so anything from 300 to 9000). */
export function readMm(raw: string): number | null {
  const v = Math.round(Number(String(raw).replace(/[^\d.]/g, '')));
  return Number.isFinite(v) && v >= 300 && v <= 9000 ? v : null;
}

export function wantsWords(w: PaxWants): string[] {
  return PAX_WANTS.filter((x) => w[x.key]).map((x) => x.words);
}

export type PaxDesign = {
  name: string;
  code: string;
  list: string;
  shots: number;
  wants: PaxWants;
  wall: string;
  ceiling: string;
  when: string;
  notes: string;
};

/* What's missing before it can be sent: something to see the design by, then the name and a way to reply. */
export function paxMissing(d: PaxDesign & { mobile: string; email: string }): '' | 'design' | 'name' | 'contact' | 'email' {
  if (!readCode(d.code).value && !d.shots && !readList(d.list).length) return 'design';
  if (d.name.trim().length < 2) return 'name';
  const okMobile = d.mobile.replace(/\D/g, '').length >= 10;
  const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim());
  if (!okMobile && !okEmail) return 'contact';
  if (d.email.trim() && !okEmail) return 'email';
  return '';
}

/* The brief, as Plan your project writes it: the labelled lines first (What, Wardrobe, Rough size, When), then the
   IKEA design. A link never stands on a line of its own (the pasted-brief reader drops bare links). */
export function paxMessage(d: PaxDesign): string {
  const code = readCode(d.code);
  const list = readList(d.list);
  const w = readMm(d.wall);
  const h = readMm(d.ceiling);
  const from = wantsWords(d.wants);
  // null = a line left out; '' = a blank line between the parts
  const lines: (string | null)[] = [
    `Hi Raf, this is ${d.name.trim()}. Here is my brief from your website.`,
    'What: Fitted wardrobe',
    'Wardrobe: IKEA PAX built in',
    w || h ? `Rough size: ${w ? `${w} wide` : ''}${w && h ? ' x ' : ''}${h ? `${h} high` : ''} (mm)` : null,
    d.when ? `When: ${d.when}` : null,
    '',
    'My IKEA PAX design (sent from the wardrobe planner):',
    code.kind === 'link' ? `IKEA design link: ${code.value}` : code.kind === 'code' ? `IKEA design code: ${code.value}` : 'IKEA design code: not sent',
    `From me: ${from.length ? from.join(', ') : 'not sure yet, advise me'}`,
    d.wants.doors ? null : "Doors: IKEA's, in the design",
    d.shots ? `Screenshots: ${d.shots} with this brief` : null,
    ...(list.length ? ["IKEA's product list:", ...list.map((l) => `- ${l}`)] : []),
    ...(d.notes.trim() ? ['', `Notes: ${d.notes.trim()}`] : []),
  ];
  return lines
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-');
}
