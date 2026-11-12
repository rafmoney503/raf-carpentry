/* The Job Kit assistant, as HQ shows it (no imports: npm run check runs it). The assistant runs on rafcarpentry.com
   every 30 minutes: new enquiry emails to info@ become ServiceM8 jobs, and every new enquiry gets its rough quote,
   quick drawings and the house looked up. HQ reads what it did (public.hq_assistant) and gets a buzz from it
   (/api/notify). */

export type AsQuote = { state: string; from?: number; options?: number; error?: string };
export type AsDrawings = { code: string; state: string; options?: number; error?: string } | { skipped: string };
export type AsEnquiry = {
  kind: 'enquiry';
  job: string;
  number?: string;
  name: string;
  what?: string;
  area?: string;
  source?: 'email' | 'website' | 'servicem8';
  made?: { photos?: number };
  quote?: AsQuote;
  drawings?: AsDrawings;
};
export type AsMail = { kind: 'mail'; from: string; what?: string; subject?: string; read: 'maybe' | 'platform' | 'enquiry' };
export type AsRow = { id: string; kind: string; at: number; data: AsEnquiry | AsMail };
export type AsRun = { at: number; enquiries?: number; made?: number; quotes?: number; drawings?: number; problems?: string[]; skipped?: string };
export type AsRaw = { items: AsRow[]; run: { running?: boolean; last?: AsRun }; runs: AsRun[]; settings: { paused?: boolean }; now: number };

export type AssistantSummary = {
  checkedAt: number | null;
  paused: boolean;
  problems: string[];
  /* enquiries of the last 3 days, newest first */
  recent: { id: string; at: number; name: string; area: string; what: string; source: string; lines: string[]; needs: string }[];
  mails: { leads: number; maybe: number; enquiries: number }; // emails of the last 3 days it left for Raf
  week: string; // 'Last 7 days: 3 enquiries, 1 job made from emails, 3 rough quotes, 2 drawings.'
  yesterday: { enquiries: number; quotes: number }; // for the morning summary
};

const pounds = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const s = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const SOURCE: Record<string, string> = { email: 'by email', website: 'from the website', servicem8: 'in ServiceM8' };

export function enquiryLines(e: AsEnquiry): string[] {
  const out: string[] = [];
  if (e.made) out.push(`Job made from their email${e.made.photos ? ` with ${s(e.made.photos, 'photo')}` : ''}`);
  const q = e.quote;
  if (q?.state === 'ready') out.push(q.from ? `Rough quote from ${pounds(q.from)} + VAT${q.options && q.options > 1 ? ` (${q.options} options)` : ''}` : 'Rough quote ready');
  else if (q?.state === 'working') out.push('Working out the rough quote');
  else if (q?.state === 'failed') out.push(`No rough quote${q.error ? ` (${q.error})` : ''}`);
  const d = e.drawings;
  if (d && 'code' in d) {
    if (d.state === 'ready') out.push(`${d.options && d.options > 1 ? `${d.options} quick drawings` : 'Quick drawing'} ready`);
    else if (d.state === 'working') out.push('Drawing it up');
    else out.push('Couldn’t draw it');
  }
  return out;
}

const needs = (e: AsEnquiry) => (e.quote?.state === 'ready' ? 'Check the prices and send the reply' : e.quote?.state === 'failed' ? 'Work out the quote yourself' : 'Have a look');

/* `day0`: the instant today began in London; `now` for the 3 and 7 days. */
export function summarise(raw: AsRaw | null, now: number, day0: number): AssistantSummary | null {
  if (!raw) return null;
  const items = Array.isArray(raw.items) ? raw.items : [];
  const runs = Array.isArray(raw.runs) ? raw.runs : [];
  const d3 = now - 3 * 864e5;
  const d7 = now - 7 * 864e5;
  const enq = items.filter((r) => r.data?.kind === 'enquiry') as (AsRow & { data: AsEnquiry })[];
  const mails = items.filter((r) => r.data?.kind === 'mail' && r.at >= d3) as (AsRow & { data: AsMail })[];
  const recent = enq
    .filter((r) => r.at >= d3)
    .map((r) => ({
      id: r.id,
      at: r.at,
      name: r.data.name,
      area: r.data.area ?? '',
      what: r.data.what ?? '',
      source: SOURCE[r.data.source ?? ''] ?? '',
      lines: enquiryLines(r.data),
      needs: needs(r.data),
    }));
  const wk = runs.filter((r) => r.at >= d7);
  const add = (k: 'made' | 'quotes' | 'drawings') => wk.reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const e7 = enq.filter((r) => r.at >= d7).length;
  const bits = [e7 ? s(e7, 'enquiry', 'enquiries') : '', add('made') ? `${s(add('made'), 'job')} made from emails` : '', add('quotes') ? s(add('quotes'), 'rough quote') : '', add('drawings') ? s(add('drawings'), 'drawing') : ''].filter(Boolean);
  const y0 = day0 - 864e5;
  const yEnq = enq.filter((r) => r.at >= y0 && r.at < day0);
  return {
    checkedAt: raw.run?.last?.at ?? null,
    paused: Boolean(raw.settings?.paused),
    problems: raw.run?.last?.problems ?? [],
    recent,
    mails: { leads: mails.filter((m) => m.data.read === 'platform').length, maybe: mails.filter((m) => m.data.read === 'maybe').length, enquiries: mails.filter((m) => m.data.read === 'enquiry').length },
    week: bits.length ? `Last 7 days: ${bits.join(', ')}.` : 'Nothing new in the last 7 days.',
    yesterday: { enquiries: yEnq.length, quotes: yEnq.filter((r) => r.data.quote?.state === 'ready').length },
  };
}

/* The morning summary's line: '2 new enquiries, 2 rough quotes ready'. */
export function morningLine(a: AssistantSummary | null): string {
  if (!a?.yesterday.enquiries) return '';
  const { enquiries, quotes } = a.yesterday;
  return `${s(enquiries, 'new enquiry', 'new enquiries')}${quotes ? `, ${s(quotes, 'rough quote')} ready` : ''}`;
}

/* A buzz the assistant sent, checked: up to 3 notes, short words only. */
export function cleanNotes(body: unknown): { title: string; body: string; tag: string }[] | null {
  const notes = (body as { notes?: unknown })?.notes;
  if (!Array.isArray(notes) || !notes.length || notes.length > 3) return null;
  const out: { title: string; body: string; tag: string }[] = [];
  for (const n of notes) {
    const t = (n as { title?: unknown })?.title;
    const b = (n as { body?: unknown })?.body;
    const g = (n as { tag?: unknown })?.tag;
    if (typeof t !== 'string' || !t.trim() || t.length > 160) return null;
    if (b !== undefined && (typeof b !== 'string' || b.length > 400)) return null;
    out.push({ title: t.trim(), body: typeof b === 'string' ? b.trim() : '', tag: typeof g === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(g) ? g : 'assistant' });
  }
  return out;
}
