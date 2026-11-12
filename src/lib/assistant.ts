import { randomInt } from 'node:crypto';
import { jobkitRpc, syncSetUp } from './job-kit-sync-server';
import { addJobNote, allClients, createEnquiry, currentJobs, sm8SetUp, Sm8Error, type CurrentJob } from './servicem8';
import { inbox, message, outlookSetUp, OutlookError, type FullMail, type InboxMail } from './outlook';
import { addEmailPhotos } from './email-photos';
import { listQuotes, makeQuote, quotesSetUp, type QuoteRow } from './quote-maker';
import { conceptsRpc, conceptsSetUp, runConcept } from './concept-maker';
import { cleanBrief, newBrief, newCode, type ConceptRow } from './concept-plan';
import { fillFromJob, mergeFill, type JobFacts } from './concept-from-job';
import { jobDiary } from './servicem8-diary';
import { lookupProperty, type Property } from './property';
import { MailReadError, readMail, type MailRead } from './assistant-mail';
import { parseBrief } from '../app/job-kit/brief-paste';
import { firstOf, noReply, replyWho } from './mail-who';
import { cleanLinks } from './mail-text';
import { stableUuid } from './brief-token';
import { fromPrice, optionsFor, picked, pricesWith, type QuoteEdits } from './quote-sums';
import { BOARDS, PRICE_BASE } from './cworkshop-boards';
import { fillWall } from './pax-brief';
import { isFurniture, pounds, settingsOf, stepLines, type AssistantList, type AssistantSettings, type EnquiryItem, type MailItem, type RunInfo, type Source } from './assistant-types';

/* The Job Kit's assistant (Raf, 12 Nov 2026: "check all my apps in jobkit new customers make a new job quote drawings
   etc automatically and give summary in jobkit for jobkit and hq for all in general and cabinetos in admin", then his
   picks: make the job by itself, drawings for every fitted furniture enquiry, every 30 minutes, a buzz on HQ for each
   new enquiry). One run, started every 30 minutes by Supabase pg_cron (/api/assistant/run) or by Check now in the
   Job Kit:
   1. New emails in info@ from people ServiceM8 doesn't know: Claude says what each is (src/lib/assistant-mail.ts).
      A plain new enquiry becomes a ServiceM8 customer and Quote job (createEnquiry, as New enquiry from this email
      does), with the email's photos on it and a note saying the assistant made it. One it isn't sure about, or a
      lead from Bark and the like, is listed for Raf instead. Emails are never marked read, moved or answered.
   2. Every new Quote job (from the email, the website's brief or typed into ServiceM8): the rough quote worked out
      from Raf's price list (Quotes, src/lib/quote-maker.ts), quick drawings for fitted furniture (Design with
      Claude, kept private: nothing goes online until Raf puts it there), and the house looked up in public records.
   3. What it did is kept in Supabase (jobkit.assistant through public.jobkit_assistant) for the Job Kit's Assistant
      box and HQ, and HQ buzzes Raf's phone for new enquiries (07:00 to 21:30; the night's wait for the morning).
   Nothing is ever sent to a customer: the reply with the rough prices waits on the quote for Raf to check and send.
   One run at a time (a claim in Supabase); a run stops starting new work after about 3 minutes. */

const MAX_MAILS = 6; // emails Claude reads a run
const MAX_ENQUIRIES = 4; // new enquiries worked on a run (the rest next time)
const NEW_DAYS = 3; // a Quote job counts as new for 3 days
const FIRST_LOOK_MS = 48 * 3600e3; // the first run looks at emails from the last 48 hours
const KEEP_IDS = 400;
const STOP_NEW_AFTER = 170_000; // no new Claude work after this long into a run

export const assistantSetUp = () => syncSetUp() && sm8SetUp();
export const assistantRpc = (action: string, p: Record<string, unknown> = {}, ms = 15000) => jobkitRpc('jobkit_assistant', { p_action: action, p }, ms);

type State = {
  since: number; // emails from before this weren't looked at
  mails: string[]; // emails already looked at
  jobs: string[]; // Quote jobs already worked on
  later: string[]; // jobs whose drawings wait for the next run (out of time)
  pending: string[]; // new enquiries not yet buzzed on the phone (quiet hours)
};
function stateOf(raw: unknown, now: number): State {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-KEEP_IDS) : []);
  return { since: typeof o.since === 'number' && o.since > 0 ? o.since : now - FIRST_LOOK_MS, mails: ids(o.mails), jobs: ids(o.jobs), later: ids(o.later), pending: ids(o.pending) };
}
const remember = (list: string[], id: string) => {
  if (!list.includes(id)) list.push(id);
  if (list.length > KEEP_IDS) list.splice(0, list.length - KEEP_IDS);
};

/* ---------- small pieces ---------- */

export function whatOfText(d: string) {
  const lines = d.split('\n').map((l) => l.trim()).filter((l) => l && !/^(hi|hello|dear)\b/i.test(l));
  const what = lines.find((l) => /^what\s*:/i.test(l))?.replace(/^what\s*:\s*/i, '');
  const line = (what ?? lines[0] ?? '').split(/\.\s/)[0].replace(/\.$/, '');
  const short = (line.length > 60 ? line.slice(0, 60).replace(/\s+\S*$/, '') : line).replace(/[\s,;:]+$/, '');
  return short.charAt(0).toUpperCase() + short.slice(1);
}
const sourceOf = (d: string): Source => (/sent with send to raf|from the website brief|from the cost calculator|from the wardrobe planner|here is my brief from your website/i.test(d) ? 'website' : 'servicem8');
const createdAt = (c: string | null) => (c ? Date.parse(c.length <= 19 ? `${c.replace(' ', 'T')}Z` : c) : NaN); // ServiceM8's London time, read as UTC: an hour out at most
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
const OURS = /@(rafcarpentry\.com|servicem8\.com|cabinetos\.co\.uk|rafalsolutions\.co\.uk|builditin3d\.com)$/i;
const OUR_SUBJECT = /^(new brief from the website|thanks for your brief|paid drawings order|drawings order|your cut list|\[preview\])/i;

/* A new ServiceM8 enquiry from an email, the way the Inbox's New enquiry from this email fills it in. */
export function enquiryOfMail(m: FullMail) {
  const w = replyWho(m);
  const text = cleanLinks(m.text || m.preview);
  const b = parseBrief(text);
  const said = b.description.trim() || text.trim();
  const named = b.name || (w.name && !w.name.includes('@') && !/^(info|sales|hello|admin|office|enquiries)$/i.test(w.name.trim()) ? w.name.trim() : '');
  return {
    name: named || firstOf(w) || w.email,
    mobile: b.mobile,
    email: b.email || w.email,
    address: b.address || text.match(POSTCODE)?.[0]?.toUpperCase() || '',
    description: `${m.subject && !/^(re|fw|fwd):/i.test(m.subject) ? `${m.subject.trim()}\n\n` : ''}${said}`.slice(0, 3500) + '\n\nMade by the Job Kit assistant from an email to info@.',
  };
}

/* The house in a line: "Mid-terrace house · 86 m² · Freehold · 1 planning application". */
export function propertyLine(p: Property): string {
  const bits = [
    p.epc?.type || p.sale?.type || '',
    p.epc?.area ? `${p.epc.area} m²` : '',
    p.sale?.tenure ? p.sale.tenure[0].toUpperCase() + p.sale.tenure.slice(1) : '',
    p.planning?.here.length ? `${p.planning.here.length} planning application${p.planning.here.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return bits.length ? bits.join(' · ') : '';
}

const london = (ms: number) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { h: n('hour'), m: n('minute') };
};
export const quietHours = (ms: number) => {
  const { h, m } = london(ms);
  return h < 7 || h > 21 || (h === 21 && m >= 30);
};

/* The cheapest option and how many there are, from Raf's own prices (as the Quotes screen works it out). */
function priceOf(row: QuoteRow | undefined, prices: unknown): { from?: number; options?: number } {
  const read = row?.data?.read;
  if (!read) return {};
  const edits = (row?.edits ?? {}) as QuoteEdits;
  try {
    const options = optionsFor(read, pricesWith(prices, PRICE_BASE), BOARDS, edits, fillWall);
    const from = fromPrice(options, edits);
    return { from: from || undefined, options: options.filter((o) => picked(o, edits)).length || undefined };
  } catch {
    return {};
  }
}

/* ---------- HQ: a buzz on the phone ---------- */

async function notifyHq(notes: { title: string; body: string; tag: string }[]) {
  const url = process.env.HQ_NOTIFY_URL;
  const secret = process.env.HQ_NOTIFY_SECRET;
  if (!url || !secret || !notes.length) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'assistant', notes }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
export function noteFor(items: EnquiryItem[]): { title: string; body: string; tag: string }[] {
  if (!items.length) return [];
  if (items.length === 1) {
    const e = items[0];
    const lines = stepLines(e).filter((l) => l.state === 'done').map((l) => l.text);
    return [{ title: `New enquiry: ${e.name}${e.area ? `, ${e.area}` : ''}`, body: [e.what, ...lines].filter(Boolean).join(' · ').slice(0, 220), tag: `assistant-${e.job}` }];
  }
  const ready = items.filter((e) => e.quote?.state === 'ready').length;
  return [{ title: `${items.length} new enquiries`, body: `${items.map((e) => e.name).join(', ')}${ready ? ` · ${ready} rough quote${ready === 1 ? '' : 's'} ready` : ''}`.slice(0, 220), tag: `assistant-${items.map((e) => e.job).join('-').slice(0, 60)}` }];
}

/* ---------- the run ---------- */

type Ctx = {
  started: number;
  why: RunInfo['why'];
  settings: AssistantSettings;
  state: State;
  run: RunInfo;
  concepts: ConceptRow[] | null; // every design, to see if a job already has one
  saved: Map<string, EnquiryItem>;
};

const saveItem = (id: string, kind: string, data: object) => assistantRpc('item', { id, kind, data }).catch((e) => console.error('assistant item', id, e));
const late = (c: Ctx) => Date.now() - c.started > STOP_NEW_AFTER;
const problem = (c: Ctx, p: string) => {
  if (!c.run.problems.includes(p)) c.run.problems.push(p);
};
/* Microsoft's or ServiceM8's own answer, kept on the run (Vercel's logs only last an hour on this plan). */
const note = (c: Ctx, where: string, e: unknown) => {
  const d = e instanceof OutlookError ? `${e.code} ${e.status} ${e.detail}` : e instanceof Sm8Error ? `${e.code} ${String(e.detail ?? '')}` : e instanceof Error ? e.message : String(e);
  const line = `${where}: ${d}`.replace(/\s+/g, ' ').slice(0, 300);
  console.error('assistant', line);
  (c.run.detail ??= []).length < 12 && c.run.detail.push(line);
};
const sm8Problem = (e: unknown) => {
  console.error('assistant sm8', e instanceof Sm8Error ? `${e.code} ${String(e.detail ?? '').slice(0, 200)}` : e);
  return 'ServiceM8 didn’t answer, so nothing new was checked: it tries again in 30 minutes';
};

/* 1. New emails into jobs. Returns the jobs it made, with the email each came from. */
async function emailsStep(c: Ctx, jobs: CurrentJob[]): Promise<{ job: CurrentJob; mail: FullMail; read: MailRead }[]> {
  let list: InboxMail[];
  try {
    list = (await inbox(0)).mails;
  } catch (e) {
    problem(
      c,
      e instanceof OutlookError && e.code === 'outlook-busy'
        ? 'Microsoft isn’t answering for info@ right now, so emails weren’t checked: it tries again in 30 minutes'
        : e instanceof OutlookError
          ? `The Inbox didn’t open (${e.code})`
          : 'The Inbox didn’t open',
    );
    note(c, 'inbox', e);
    return [];
  }
  const fresh = list
    .filter((m) => !m.mine && !c.state.mails.includes(m.id) && Date.parse(m.at) >= c.state.since && !noReply(m))
    .filter((m) => !OURS.test(replyWho(m).email) && !OUR_SUBJECT.test(m.subject.trim()))
    .sort((a, b) => a.at.localeCompare(b.at));
  if (!fresh.length) return [];
  // who ServiceM8 already knows (a reply from a customer isn't a new enquiry)
  const known = new Set(jobs.map((j) => j.email.trim().toLowerCase()).filter(Boolean));
  try {
    for (const cl of await allClients()) for (const p of cl.people) if (p.email.trim()) known.add(p.email.trim().toLowerCase());
  } catch (e) {
    problem(c, sm8Problem(e));
    return []; // without the customers list it can't tell new from old: next time
  }
  const made: { job: CurrentJob; mail: FullMail; read: MailRead }[] = [];
  for (const m of fresh) {
    const email = replyWho(m).email.trim().toLowerCase();
    if (known.has(email)) {
      remember(c.state.mails, m.id);
      c.run.left++;
      continue;
    }
    if (c.run.mails >= MAX_MAILS || late(c)) break; // the rest next run
    let full: FullMail;
    try {
      full = await message(m.id, false); // never marked read
    } catch (e) {
      if (e instanceof OutlookError && e.code === 'outlook-gone') remember(c.state.mails, m.id);
      else {
        problem(c, `An email didn’t open (${e instanceof OutlookError ? e.code : 'error'})`);
        note(c, 'email', e);
      }
      continue;
    }
    let read: MailRead;
    try {
      read = await readMail(full);
    } catch (e) {
      if (e instanceof MailReadError && e.code === 'ai-limit') {
        problem(c, 'Claude credit has run out: top up to keep it going');
        break;
      }
      if (e instanceof MailReadError && e.code === 'ai-key') {
        problem(c, 'Claude turned the key down');
        break;
      }
      problem(c, 'Claude was busy reading an email: tried again next time');
      continue; // not remembered: read again next run
    }
    c.run.mails++;
    remember(c.state.mails, m.id);
    if (read.kind === 'enquiry' && read.sure && c.settings.jobsFromEmail) {
      try {
        const e = enquiryOfMail(full);
        const job = await createEnquiry({ ...e, newClient: stableUuid(`assistant:client:${m.id}`) });
        known.add(email);
        let photos = 0;
        try {
          photos = (await addEmailPhotos(job.uuid, email, full.id)).added;
        } catch {
          // the job is there; its photos can be put on from the Inbox
        }
        const at = new Date(full.at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        await addJobNote(job.uuid, `Made by the Job Kit assistant from an email to info@ (${at}${full.subject ? `, “${full.subject.slice(0, 80)}”` : ''}).${photos ? ` ${photos} photo${photos === 1 ? '' : 's'} from the email put on the job.` : ''} Nothing has been sent to them.`, stableUuid(`assistant:note:${job.uuid}`)).catch(() => undefined);
        c.run.made++;
        made.push({ job, mail: full, read });
        const item: Partial<EnquiryItem> = { kind: 'enquiry', made: { mail: full.id, subject: full.subject.slice(0, 120), at: full.at, photos } };
        await saveItem(`job:${job.uuid}`, 'enquiry', item);
      } catch (e) {
        sm8Problem(e);
        problem(c, `Couldn’t make a job from ${replyWho(m).name || email}’s email: ServiceM8 didn’t answer. It tries again next time`);
        c.state.mails.splice(c.state.mails.indexOf(m.id), 1); // try again next run
      }
    } else if (read.kind === 'enquiry' || read.kind === 'platform') {
      const item: MailItem = { kind: 'mail', mail: m.id, from: replyWho(m).name || email, subject: m.subject.slice(0, 120), what: read.what, read: read.kind === 'platform' ? 'platform' : read.sure ? 'enquiry' : 'maybe', at: m.at, seenAt: Date.now() };
      await saveItem(`mail:${m.id}`, 'mail', item);
    } else c.run.left++;
  }
  return made;
}

/* The brief Design with Claude gets for a job, from its diary, its quote and the email it came from. */
async function briefFor(job: CurrentJob, quote: QuoteRow | undefined, mail?: FullMail) {
  const diary = await jobDiary(job.uuid, job.email, job.mobile).then((d) => d.entries).catch(() => null);
  const read = quote?.data?.read;
  const facts: JobFacts = {
    job: { uuid: job.uuid, number: job.number, name: job.name, first: job.first, description: job.description },
    diary,
    kit: [],
    quote: read ? { runs: read.runs ?? [], own: ((quote?.edits ?? {}) as { runs?: { w?: number; h?: number; d?: number }[] }).runs ?? [] } : null,
    mail: mail ? { id: mail.id, subject: mail.subject, text: mail.text, at: mail.at, photos: mail.files.filter((f) => /^image\//i.test(f.type) && !f.inline).map((f) => ({ id: f.id, name: f.name })) } : null,
  };
  const b = mergeFill(newBrief({ first: job.first }), fillFromJob(facts), Date.now());
  return cleanBrief(b); // the phone-only `found` goes
}

/* 2. One new enquiry: the quote, then the drawings, and the house. */
async function enquiryStep(c: Ctx, job: CurrentJob, made?: { mail: FullMail; read: MailRead }, again = false) {
  const id = `job:${job.uuid}`;
  const item: EnquiryItem = {
    ...(c.saved.get(id) ?? {}),
    kind: 'enquiry',
    job: job.uuid,
    number: job.number,
    name: job.name,
    first: job.first,
    what: made?.read.what || whatOfText(job.description),
    area: job.area,
    source: made ? 'email' : (c.saved.get(id)?.source ?? sourceOf(job.description)),
    created: job.created,
    seenAt: c.saved.get(id)?.seenAt ?? Date.now(),
  };
  if (!again) {
    c.run.enquiries++;
    await saveItem(id, 'enquiry', item);
  }
  const propP = !again && job.address && /\d/.test(job.address) ? lookupProperty(job.address).then(propertyLine).catch(() => '') : Promise.resolve(item.property ?? '');

  if (!again) {
    if (quotesSetUp()) {
      const q = await makeQuote(job.uuid, { job }).catch(() => ({ ok: false, state: 'failed' }));
      item.quote = { state: q.ok ? 'ready' : q.state === 'ready' || q.state === 'working' || q.state === 'failed' ? q.state : 'none' };
      if (q.ok) c.run.quotes++;
    } else item.quote = { state: 'none' };
  }

  const furniture = made ? made.read.furniture || isFurniture(job.description) : isFurniture(job.description);
  const has = (c.concepts ?? []).find((r) => r.data?.brief?.sm8 === job.uuid);
  if (!c.settings.drawings) item.drawings = { skipped: 'off' };
  else if (!conceptsSetUp()) item.drawings = { skipped: 'not-set-up' };
  else if (!furniture) item.drawings = { skipped: 'not-furniture' };
  else if (has) item.drawings = { code: has.id, state: has.state === 'ready' ? 'ready' : has.state === 'failed' ? 'failed' : 'working', options: has.data?.plan?.options.length };
  else if (late(c)) remember(c.state.later, job.uuid);
  else {
    const quotes = (await listQuotes().catch(() => null))?.quotes ?? [];
    const brief = await briefFor(job, quotes.find((r) => r.id === job.uuid), made?.mail);
    const code = newCode((n) => randomInt(n));
    const data = { brief };
    const start = (await conceptsRpc('start', { id: code, data }).catch(() => null)) as { ok?: boolean } | null;
    if (start?.ok) {
      item.drawings = { code, state: 'working' };
      await saveItem(id, 'enquiry', { drawings: item.drawings });
      const r = await runConcept(code, data);
      item.drawings = { code, state: r.ok ? 'ready' : 'failed' };
      if (r.ok) c.run.drawings++;
      c.state.later = c.state.later.filter((u) => u !== job.uuid);
    } else problem(c, 'Design with Claude didn’t start: tried again next time');
  }
  item.property = (await propP) || item.property;
  item.doneAt = Date.now();
  await saveItem(id, 'enquiry', item);
  c.saved.set(id, item);
  return item;
}

/* 3. Brings recent items up to date: a quote or a drawing that was still being worked out, the price from Raf's
   list (which he may have changed since). Cheap: two reads from Supabase. */
const AGAIN = /^ai-(limit|busy|error|key)$/; // failures worth trying again: Claude's credit, busy or a hiccup
const MAX_TRIES = 6; // about three hours of runs
const AGAIN_AFTER = 30 * 60e3; // the quotes store won't take a new try sooner

/* Quotes and drawings that failed because Claude ran out of credit or was busy, tried again on a later run
   (two a run, up to six times each). Nothing is tried while this run has already found the credit gone. */
async function againStep(c: Ctx, jobs: CurrentJob[]) {
  if (late(c) || c.run.problems.some((p) => p.startsWith('Claude credit'))) return;
  const recent = [...c.saved.values()].filter((e) => e.kind === 'enquiry' && Date.now() - e.seenAt < NEW_DAYS * 864e5 && (e.tries ?? 0) < MAX_TRIES);
  if (!recent.length) return;
  const [q, concepts] = await Promise.all([listQuotes().catch(() => null), conceptsRpc('list').then((r) => (r as { concepts: ConceptRow[] }).concepts).catch(() => null)]);
  let budget = 2;
  for (const e of recent) {
    if (budget <= 0 || late(c)) break;
    const job = jobs.find((j) => j.uuid === e.job);
    if (!job || job.status !== 'Quote') continue;
    const row = q?.quotes.find((r) => r.id === e.job);
    const qAgain = row?.state === 'failed' && AGAIN.test(String(row.data?.error ?? '')) && Date.now() - Number(row.data?.at ?? 0) >= AGAIN_AFTER;
    const d = e.drawings && 'code' in e.drawings ? e.drawings : null;
    const crow = d ? concepts?.find((r) => r.id === d.code) : undefined;
    const cErr = String((crow?.data as { error?: unknown } | undefined)?.error ?? '');
    const dAgain = Boolean(crow && crow.state === 'failed' && !crow.data?.plan && crow.data?.brief && AGAIN.test(cErr));
    if (!qAgain && !dAgain) continue;
    budget--;
    e.tries = (e.tries ?? 0) + 1;
    await saveItem(`job:${e.job}`, 'enquiry', { tries: e.tries });
    if (qAgain) {
      const r = await makeQuote(e.job, { job, force: true }).catch(() => ({ ok: false }));
      if (r.ok) c.run.quotes++;
    }
    const brief = crow?.data?.brief;
    if (dAgain && crow && brief && !c.run.problems.some((p) => p.startsWith('Claude credit'))) {
      const data = { brief };
      const start = (await conceptsRpc('start', { id: crow.id, data }).catch(() => null)) as { ok?: boolean } | null;
      if (start?.ok) {
        const r = await runConcept(crow.id, data);
        if (r.ok) c.run.drawings++;
      }
    }
  }
}

const failWords = (code: unknown) =>
  code === 'ai-limit' ? 'out of Claude credit' : code === 'ai-busy' ? 'Claude was busy' : code === 'no-text' ? 'nothing to go on' : code === 'ai-key' ? 'the Claude key was turned down' : undefined;

async function refreshStep(c: Ctx) {
  const recent = [...c.saved.values()].filter((e) => e.kind === 'enquiry' && Date.now() - e.seenAt < 14 * 864e5);
  if (!recent.length) return;
  const [q, concepts] = await Promise.all([listQuotes().catch(() => null), conceptsRpc('list').then((r) => (r as { concepts: ConceptRow[] }).concepts).catch(() => null)]);
  for (const e of recent) {
    const next: Partial<EnquiryItem> = {};
    const row = q?.quotes.find((r) => r.id === e.job);
    if (row && q) {
      const st = row.state === 'ready' || row.state === 'working' || row.state === 'failed' ? row.state : 'none';
      const price = st === 'ready' ? priceOf(row, q.prices?.data) : {};
      const err = st === 'failed' ? failWords(row.data?.error) : undefined;
      if (st === 'failed' && row.data?.error === 'ai-limit' && Number(row.data?.at ?? 0) >= c.started) problem(c, 'Claude credit has run out: top up to keep it going');
      const quote = { state: st, ...price, ...(err ? { error: err } : {}) } as EnquiryItem['quote'];
      if (JSON.stringify(quote) !== JSON.stringify(e.quote)) next.quote = quote;
    }
    const d = e.drawings && 'code' in e.drawings ? e.drawings : null;
    const crow = d && concepts ? concepts.find((r) => r.id === d.code) : undefined;
    if (d && crow) {
      const cd = crow.data as { error?: string; at?: number; plan?: { options: unknown[] } } | undefined;
      const st = crow.state === 'ready' ? 'ready' : crow.state === 'failed' ? 'failed' : 'working';
      const words = st === 'failed' ? failWords(cd?.error) : undefined;
      if (st === 'failed' && cd?.error === 'ai-limit' && Number(cd?.at ?? 0) >= c.started) problem(c, 'Claude credit has run out: top up to keep it going');
      const drawings = { code: d.code, state: st, options: cd?.plan?.options.length, ...(words ? { error: words } : {}) } as EnquiryItem['drawings'];
      if (JSON.stringify(drawings) !== JSON.stringify(e.drawings)) next.drawings = drawings;
    }
    if (Object.keys(next).length) {
      Object.assign(e, next);
      await saveItem(`job:${e.job}`, 'enquiry', next);
    }
  }
}

export async function runAssistant(why: RunInfo['why']): Promise<RunInfo | { busy: true }> {
  const started = Date.now();
  const claim = (await assistantRpc('claim')) as { ok?: boolean; state?: unknown; settings?: unknown };
  if (!claim?.ok) return { busy: true };
  const run: RunInfo = { at: started, ms: 0, why, enquiries: 0, made: 0, quotes: 0, drawings: 0, mails: 0, left: 0, problems: [] };
  const c: Ctx = { started, why, settings: settingsOf(claim.settings), state: stateOf(claim.state, started), run, concepts: null, saved: new Map() };
  try {
    if (c.settings.paused) {
      run.skipped = 'paused';
      return run;
    }
    if (!assistantSetUp()) {
      run.skipped = 'not-set-up';
      return run;
    }
    // what it already kept (to merge with, and to bring up to date)
    const listed = (await assistantRpc('list', { days: 14 }).catch(() => null)) as AssistantList | null;
    for (const r of listed?.items ?? []) if (r.data?.kind === 'enquiry') c.saved.set(r.id, r.data);

    let jobs: CurrentJob[] = [];
    let sm8Ok = true;
    try {
      jobs = (await currentJobs()).jobs;
    } catch (e) {
      sm8Ok = false;
      problem(c, sm8Problem(e));
      note(c, 'servicem8', e);
    }

    const made = sm8Ok && outlookSetUp() ? await emailsStep(c, jobs) : [];
    for (const m of made) if (!jobs.some((j) => j.uuid === m.job.uuid)) jobs.push(m.job);

    if (sm8Ok) {
      c.concepts = conceptsSetUp() ? await conceptsRpc('list').then((r) => (r as { concepts: ConceptRow[] }).concepts ?? []).catch(() => null) : [];
      const cutoff = Date.now() - NEW_DAYS * 864e5;
      const fresh = jobs
        .filter((j) => j.status === 'Quote' && !c.state.jobs.includes(j.uuid))
        .filter((j) => made.some((m) => m.job.uuid === j.uuid) || createdAt(j.created) >= cutoff)
        .sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''))
        .slice(0, MAX_ENQUIRIES);
      const later = jobs.filter((j) => c.state.later.includes(j.uuid) && c.state.jobs.includes(j.uuid)).slice(0, 2);
      const done = await Promise.all([
        ...fresh.map((j) => {
          remember(c.state.jobs, j.uuid);
          const m = made.find((x) => x.job.uuid === j.uuid);
          return enquiryStep(c, j, m ? { mail: m.mail, read: m.read } : undefined).catch((e) => {
            console.error('assistant enquiry', j.uuid, e);
            problem(c, `Something went wrong with ${j.name}’s enquiry`);
            return null;
          });
        }),
        ...later.map((j) => enquiryStep(c, j, undefined, true).catch(() => null)),
      ]);
      for (const e of done.slice(0, fresh.length)) if (e) remember(c.state.pending, e.job);
      // jobs that stopped being new (no longer Quote, or over 3 days) leave the drawings queue
      c.state.later = c.state.later.filter((u) => jobs.some((j) => j.uuid === u && j.status === 'Quote'));
      await againStep(c, jobs);
      await refreshStep(c);
    }

    // the buzz on the phone, not in the night
    if (c.state.pending.length && !quietHours(Date.now())) {
      const items = c.state.pending.map((u) => c.saved.get(`job:${u}`)).filter((e): e is EnquiryItem => Boolean(e));
      if (!items.length || (await notifyHq(noteFor(items)))) c.state.pending = [];
      else if (!process.env.HQ_NOTIFY_URL) c.state.pending = []; // no HQ to tell
    }
    return run;
  } catch (e) {
    console.error('assistant run', e);
    problem(c, 'The run stopped part way');
    note(c, 'run', e);
    return run;
  } finally {
    run.ms = Date.now() - started;
    await assistantRpc('finish', { state: c.state, run }).catch(async (e) => {
      console.error('assistant finish', e);
      await assistantRpc('release').catch(() => null);
    });
  }
}

/* For the Job Kit's "Check now" and the morning line in HQ: the price words used on the box. */
export const fromWords = (e: EnquiryItem) => (e.quote?.from ? `from ${pounds(e.quote.from)} + VAT` : '');
