/* The Job Kit's assistant (Raf, 12 Nov 2026: 'check all my apps in jobkit new customers make a new job quote drawings
   etc automatically and give summary in jobkit ... hq ... cabinetos'). What a run finds and does, as kept in
   Supabase (jobkit.assistant through public.jobkit_assistant) and read by the Job Kit's Assistant box and HQ.
   The run is src/lib/assistant.ts. No imports, so the phone, the server and the tests share it. */

export type AssistantSettings = {
  paused: boolean; // nothing at all
  jobsFromEmail: boolean; // a new enquiry by email becomes a ServiceM8 job by itself
  drawings: boolean; // quick drawings (Design with Claude) for fitted furniture enquiries
};
export const DEFAULT_SETTINGS: AssistantSettings = { paused: false, jobsFromEmail: true, drawings: true };
export const settingsOf = (raw: unknown): AssistantSettings => {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const b = (k: keyof AssistantSettings) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_SETTINGS[k]);
  return { paused: b('paused'), jobsFromEmail: b('jobsFromEmail'), drawings: b('drawings') };
};

export type StepState = 'ready' | 'working' | 'failed';
export type Source = 'email' | 'website' | 'servicem8';

/* A new enquiry (a new Quote job in ServiceM8), id 'job:<uuid>'. */
export type EnquiryItem = {
  kind: 'enquiry';
  job: string; // ServiceM8 job uuid
  number: string;
  name: string;
  first: string;
  what: string; // the first line of the description
  area: string;
  source: Source;
  created: string | null; // ServiceM8's time
  seenAt: number; // when the assistant first saw it
  made?: { mail: string; subject: string; at: string; photos: number }; // the assistant made the job from this email
  quote?: { state: StepState | 'none'; from?: number; options?: number; error?: string }; // from: the cheapest option before VAT
  tries?: number; // quotes and drawings tried again after Claude ran out of credit or was busy (6 at most)
  drawings?: { code: string; state: StepState; options?: number; error?: string } | { skipped: 'not-furniture' | 'off' | 'had-one' | 'not-set-up' };
  property?: string; // one line about the house: "Mid-terrace house · 86 m² · Freehold"
  doneAt?: number; // the run finished its steps
};

/* An email the assistant looked at and wasn't sure about, id 'mail:<Outlook id>': Raf decides. */
export type MailItem = {
  kind: 'mail';
  mail: string;
  from: string; // their name or address
  subject: string;
  what: string; // what Claude says it's about
  read: 'maybe' | 'platform' | 'enquiry'; // looks like an enquiry / a lead from Bark, Checkatrade and the like / an enquiry left for Raf (making jobs is off)
  at: string; // when it arrived
  seenAt: number;
};

export type AssistantItem = EnquiryItem | MailItem;
export type ItemRow = { id: string; kind: string; data: AssistantItem; at: number; updated: number };

export type RunInfo = {
  at: number; // when it started
  ms: number;
  why: 'cron' | 'now';
  enquiries: number; // new Quote jobs it saw
  made: number; // jobs it made from emails
  quotes: number; // rough quotes worked out
  drawings: number; // designs drawn
  mails: number; // emails it looked at
  left: number; // emails it left alone (not enquiries)
  problems: string[];
  // what Microsoft or ServiceM8 actually answered, for working out a problem (not shown in the Job Kit)
  detail?: string[];
  skipped?: 'paused' | 'not-set-up';
};

/* What the Job Kit and HQ get: { items, settings, seen, run: { running, startedAt, last }, runs, now }. */
export type AssistantList = {
  items: ItemRow[];
  settings: AssistantSettings;
  seen: number;
  run: { running?: boolean; startedAt?: number; last?: RunInfo; updated?: number };
  runs: RunInfo[];
  now: number;
};

/* ---------- words ---------- */

export const pounds = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

/* "New enquiry by email" / "from the website" */
export const SOURCE_WORDS: Record<Source, string> = { email: 'by email to info@', website: 'from the website', servicem8: 'in ServiceM8' };

/* The steps of one enquiry as short lines, in order, for the Job Kit, HQ and the phone notification. */
export function stepLines(e: EnquiryItem): { text: string; state: 'done' | 'working' | 'failed' | 'note' }[] {
  const out: { text: string; state: 'done' | 'working' | 'failed' | 'note' }[] = [];
  if (e.made) out.push({ text: `Job made in ServiceM8 from their email${e.made.photos ? `, ${e.made.photos} photo${e.made.photos === 1 ? '' : 's'} on it` : ''}`, state: 'done' });
  const q = e.quote;
  if (q?.state === 'ready') out.push({ text: q.from ? `Rough quote ready: from ${pounds(q.from)} + VAT${q.options && q.options > 1 ? `, ${q.options} options` : ''}` : 'Rough quote ready', state: 'done' });
  else if (q?.state === 'working') out.push({ text: 'Working out the rough quote', state: 'working' });
  else if (q?.state === 'failed') out.push({ text: `Couldn’t work out the rough quote${q.error ? ` (${q.error})` : ''}`, state: 'failed' });
  const d = e.drawings;
  if (d && 'code' in d) {
    if (d.state === 'ready') out.push({ text: `${d.options && d.options > 1 ? `${d.options} quick drawings` : 'Quick drawing'} ready, private until you put them online`, state: 'done' });
    else if (d.state === 'working') out.push({ text: 'Drawing it up', state: 'working' });
    else out.push({ text: `Couldn’t draw it${d.error ? ` (${d.error})` : ''}`, state: 'failed' });
  }
  if (e.property) out.push({ text: e.property, state: 'note' });
  return out;
}

/* What Raf still has to do for it. */
export function needsYou(e: EnquiryItem): string {
  if (e.quote?.state === 'ready') return 'Check the prices and send the reply';
  if (e.quote?.state === 'failed') return 'Work out the quote yourself';
  return 'Have a look';
}

/* A run in a line: "Checked at 14:30: 1 new enquiry, 1 job made, 3 emails left alone". */
export function runLine(r: RunInfo | undefined): string {
  if (!r) return 'Not run yet';
  const t = new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  if (r.skipped === 'paused') return `Paused, last checked at ${t}`;
  const bits = [
    r.enquiries ? `${r.enquiries} new enquir${r.enquiries === 1 ? 'y' : 'ies'}` : '',
    r.made ? `${r.made} job${r.made === 1 ? '' : 's'} made` : '',
    r.quotes ? `${r.quotes} quote${r.quotes === 1 ? '' : 's'}` : '',
    r.drawings ? `${r.drawings} drawing${r.drawings === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return `Checked at ${t}: ${bits.length ? bits.join(', ') : 'nothing new'}`;
}

/* Fitted furniture Design with Claude can draw (not kitchens fitted, floors, doors, decking or stud walls). */
const FURNITURE = /\b(wardrobes?|pax|alcoves?|cupboards?|pantr(?:y|ies)|larders?|bookcases?|book ?shel(?:f|ves)|shelving|shelves|storage|desks?|home office|window seats?|bench(?:es)?|seating|tv units?|media walls?|dressers?|utility|boot ?room|built[- ]?ins?|fitted furniture|cabinets?|vanity|chest of drawers|under ?stairs|loft storage|walk[- ]in|dressing room|sideboards?|units?)\b/i;
const NOT_FURNITURE = /\b(kitchen fit(?:ting)?|fit (?:a|my|our) kitchen|floor(?:ing|s)?|laminate|decking|fenc(?:e|ing)|stud walls?|partition|skirting|doors? (?:hang|fit)|hang(?:ing)? doors?|internal doors?|loft boarding)\b/i;
export function isFurniture(text: string): boolean {
  const t = text.toLowerCase();
  if (!FURNITURE.test(t)) return false;
  // "kitchen fitting" alone is not; "kitchen fitting and a pantry cupboard" is
  if (NOT_FURNITURE.test(t)) {
    const stripped = t.replace(new RegExp(NOT_FURNITURE.source, 'gi'), ' ');
    return FURNITURE.test(stripped.replace(/\bunits?\b/g, ' ')) || /\b(wardrobe|alcove|pantry|bookcase|cupboard)/.test(stripped);
  }
  return true;
}
