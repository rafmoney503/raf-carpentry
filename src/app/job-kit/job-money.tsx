'use client';
/* eslint-disable @next/next/no-img-element -- receipt pictures are small thumbnails made on the phone or fetched from ServiceM8 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  awayFromJobs,
  byKind,
  COST_KINDS,
  costsOn,
  daysText,
  daysTotal,
  evenShares,
  inPeriod,
  insights,
  jobRow,
  kindLabel,
  mailKey,
  PERIODS,
  pounds,
  priceOf,
  readAmount,
  receiptLike,
  round2,
  sameSnap,
  siteDays,
  sinceOf,
  snapOf,
  totalsOf,
  vsWords,
  workBookingsOf,
  madeOf,
  VAT_RATE,
  type Cost,
  type CostKind,
  type CostLine,
  type JobRow,
  type Period,
  type Snap,
} from '@/lib/job-costs';
import type { Booking, CurrentJob } from '@/lib/servicem8';
import type { ReceiptRead } from '@/lib/receipt-reader';
import type { InboxMail } from '@/lib/outlook';
import { shortDay, todayKey } from '@/lib/job-timeline';
import { blobOf, dropDoc, keepBlob, keepThumb, newCostId, putCost, putDoc, putSnap, readCosts, sendPhoto, setJob, thumbOf, useCosts, useCostSync } from './costs-store';
import { fileBlob } from './job-notes';
import { shrinkPhoto } from './media';
import { problemText } from './sm8-post';
import { readPin } from './uploader';
import { field, label } from './parts';
import { SecIcon } from './job-menu';
import { Icon } from './icons';
import { TimelineTabs } from './client-board';
import type { TodayLine } from './current';

/* What each job made, on the Job Kit's screens (src/lib/job-costs.ts has the sums):
   - ReceiptView ('receipt' screen): snap a receipt or choose a PDF, read by Claude; or a supplier's email in info@;
     or a cost typed by hand (parking, a helper). Raf picks the job (the one booked today first), or splits it, or
     keeps it as van stock or a company cost. The photo goes in the job's diary in ServiceM8 too.
   - MadeBox on each Work Order and Completed job: price, costs, days on site, and what that comes to a day.
   - MadeView ('made', the third tab of the Job timeline): every finished job, by kind of work, against his rate.
   - The To do lines and the receipt box on an email in the Inbox. */

const fmtDay = (key: string) => (key ? shortDay(key) : '');
const whatShort = (d: string) => {
  const line = d.split(/\n|\.\s/)[0].trim().replace(/\.$/, '');
  const short = (line.length > 48 ? line.slice(0, 48).replace(/\s+\S*$/, '') : line).replace(/[\s,;:]+$/, '');
  return short.charAt(0).toUpperCase() + short.slice(1);
};
const possessive = (name: string) => `${name}’s`;
const asText = (n: number) => (n ? (n % 1 ? n.toFixed(2) : String(n)) : '');

function receiptProblem(code?: string, detail?: string) {
  switch (code) {
    case 'ai-not-set-up':
      return 'Reading receipts isn’t switched on here: ANTHROPIC_API_KEY is missing in Vercel. Type it in below.';
    case 'ai-key':
      return 'Claude turned the key down, so it couldn’t read the receipt. Type it in below, and replace ANTHROPIC_API_KEY in Vercel.';
    case 'ai-limit':
      return 'Claude credit has run out, so it couldn’t read the receipt. Type it in below, and top up in the Claude Console.';
    case 'ai-busy':
      return 'Claude is busy or didn’t answer. Try again, or type it in below.';
    case 'ai-error':
      return 'Claude couldn’t read it. Type it in below, or try a clearer photo.';
    case 'type':
      return 'That file isn’t a photo or a PDF.';
    case 'too-big':
      return 'That file is over 4 MB. Take a photo of it instead.';
    case 'offline':
      return 'No signal: Claude can’t read it now. Type it in below; the photo goes on the job when the signal is back.';
    default:
      return problemText(code, detail) || 'Something went wrong. Type it in below.';
  }
}

async function postJson<T>(path: string, body: unknown): Promise<{ data: T } | { error: string; detail?: string }> {
  const pin = readPin();
  if (!pin) return { error: 'no-pin' };
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const r = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
    if (!res.ok) return { error: r.error || 'error', detail: r.detail };
    return { data: r };
  } catch {
    return { error: 'offline' };
  }
}
async function readFile(file: Blob, name: string): Promise<{ data: { read: ReceiptRead } } | { error: string; detail?: string }> {
  const pin = readPin();
  if (!pin) return { error: 'no-pin' };
  const fd = new FormData();
  fd.set('action', 'read');
  fd.set('file', file, name);
  try {
    const res = await fetch('/api/job-kit/receipt', { method: 'POST', headers: { 'x-job-kit-pin': pin }, body: fd, cache: 'no-store' });
    const r = (await res.json().catch(() => ({}))) as { read?: ReceiptRead; error?: string; detail?: string };
    if (!res.ok || !r.read) return { error: r.error || 'error', detail: r.detail };
    return { data: { read: r.read } };
  } catch {
    return { error: 'offline' };
  }
}

/* ---------- which job a receipt is for ---------- */

type JobChoice = { job: CurrentJob; sub: string; today: boolean };
function jobChoices(jobs: CurrentJob[], bookings: Booking[], now = todayKey()): JobChoice[] {
  const recent = (j: CurrentJob) => j.status === 'Completed' && (j.completed ?? '').slice(0, 10) >= new Date(Date.parse(`${now}T12:00`) - 21 * 864e5).toLocaleDateString('sv-SE');
  const list = jobs.filter((j) => j.status === 'Work Order' || recent(j));
  const out = list.map((j) => {
    const days = siteDays(workBookingsOf(j, bookings));
    const idx = days.findIndex((d) => d.day === now);
    const next = days.find((d) => d.day > now);
    const what = j.description ? whatShort(j.description) : 'Job';
    const sub =
      j.status === 'Completed'
        ? `${what}${j.area ? `, ${j.area}` : ''} · finished ${fmtDay((j.completed ?? '').slice(0, 10))}`
        : idx >= 0
          ? `${what}${j.area ? `, ${j.area}` : ''} · booked there today, day ${idx + 1} of ${days.length}`
          : next
            ? `${what}${j.area ? `, ${j.area}` : ''} · starts ${fmtDay(next.day)}`
            : `${what}${j.area ? `, ${j.area}` : ''} · going ahead`;
    return { job: j, sub, today: idx >= 0, order: idx >= 0 ? 0 : j.status === 'Work Order' ? 1 : 2, key: next?.day ?? days[days.length - 1]?.day ?? '' };
  });
  out.sort((a, b) => a.order - b.order || (a.order === 2 ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)));
  return out.map(({ job, sub, today }) => ({ job, sub, today }));
}

/* ---------- Snap a receipt: one tap to the camera ---------- */

/* The photo taken from Today or a job, handed to the receipt screen it opens.
   Kept here only (a File can't go in the screen's saved state): a reload lands on the screen's first step. */
let pendingSnap: File | null = null;
export const holdSnap = (f: File) => {
  pendingSnap = f;
};
const takeSnap = () => {
  const f = pendingSnap;
  pendingSnap = null;
  return f;
};

/* The job a receipt snapped now most likely goes on: the one booked today. */
export function snapLine(jobs: CurrentJob[], bookings: Booking[] | null): string {
  const today = jobChoices(jobs, bookings ?? []).filter((c) => c.today);
  if (today.length === 1) return `For ${possessive(today[0].job.name)} job, booked today`;
  if (today.length > 1) return `${today.length} jobs booked today: pick one after`;
  return 'Claude reads it, then you pick the job';
}

/* The camera straight from the tap (on a phone); on a computer, a photo or a PDF from the files. */
export function SnapButton({ wide, line, onFile, onOther, other, big }: { wide: boolean; line?: string; onFile: (f: File) => void; onOther: () => void; other: string; big?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div data-snap-box>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={big ? 'jk-snapbig flex min-h-[64px] w-full items-center gap-3 rounded-sm border border-line-strong bg-mount px-3.5 py-2.5 text-left' : 'btn btn-primary w-full'}
        data-snap
      >
        {big ? (
          <>
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-ink text-paper">
              <Icon name="receipt" className="h-[24px] w-[24px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold leading-tight">Snap a receipt</span>
              {line ? <span className="mt-0.5 block text-[14px] leading-snug text-muted">{line}</span> : null}
            </span>
            <span aria-hidden className="text-[18px] jk-sec-ink">
              →
            </span>
          </>
        ) : (
          'Snap a receipt'
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={wide ? 'image/*,application/pdf,.pdf' : 'image/*'}
        {...(wide ? {} : { capture: 'environment' as const })}
        className="hidden"
        data-snap-input
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <button type="button" onClick={onOther} className={`${big ? 'mt-1.5' : 'mt-1'} flex min-h-11 w-full items-center justify-center text-[14.5px] text-accent underline`} data-snap-other>
        {other}
      </button>
    </div>
  );
}

/* ---------- a receipt, or a cost typed by hand ---------- */

type FileHere = { blob: Blob; name: string; type: string; url: string; thumb: string };
type Where = 'job' | 'split' | 'van' | 'company';

export function ReceiptView({
  id,
  job: jobAt,
  mail,
  mailHead,
  typed,
  snap,
  jobs,
  bookings,
  onDone,
  onOpenJob,
}: {
  snap?: boolean; // opened by Snap a receipt: the photo just taken is waiting (holdSnap)
  id?: string; // a cost already put in: change it
  job?: string; // started from this job
  mail?: string; // a supplier's email in info@
  mailHead?: InboxMail;
  typed?: boolean; // Add a cost by hand
  jobs: CurrentJob[];
  bookings: Booking[];
  onDone: () => void;
  onOpenJob: (uuid: string) => void;
}) {
  const view = useCosts();
  const existing = id ? view.costs.find((c) => c.id === id) : undefined;
  const choices = useMemo(() => jobChoices(jobs, bookings), [jobs, bookings]);
  const jobOf = (uuid: string) => jobs.find((j) => j.uuid === uuid);
  const startJob = existing?.data.where === 'job' && existing.data.jobs.length === 1 ? existing.data.jobs[0].job : jobAt ?? (choices.find((c) => c.today)?.job.uuid || '');

  const [first] = useState(() => (snap && !id && !mail && !typed ? takeSnap() : null));
  const [stage, setStage] = useState<'pick' | 'reading' | 'form'>(existing || typed ? 'form' : mail || first ? 'reading' : 'pick');
  const [file, setFile] = useState<FileHere | null>(null);
  const [mailAtt, setMailAtt] = useState(existing?.data.mailAtt ?? '');
  const [read, setRead] = useState<ReceiptRead | null>(null);
  const [problem, setProblem] = useState('');
  const [shop, setShop] = useState(existing?.data.shop ?? '');
  const [date, setDate] = useState(existing?.data.date ?? todayKey());
  const [gross, setGross] = useState(asText(existing?.data.gross ?? 0));
  const [vat, setVat] = useState(asText(existing?.data.vat ?? 0));
  const [withVat, setWithVat] = useState(existing ? existing.data.vat > 0 : !typed);
  const [lines, setLines] = useState<CostLine[]>(existing?.data.lines ?? []);
  const [note, setNote] = useState(existing?.data.note ?? '');
  const [what, setWhat] = useState<CostKind>(existing?.data.what ?? (typed ? 'parking' : 'materials'));
  const startWhere: Where = existing ? (existing.data.where === 'job' ? (existing.data.jobs.length > 1 ? 'split' : 'job') : existing.data.where) : 'job';
  const [where, setWhere] = useState<Where>(startWhere);
  const [job, setJobPick] = useState(startJob);
  const [split, setSplit] = useState<Record<string, string>>(() => (existing && existing.data.jobs.length > 1 ? Object.fromEntries(existing.data.jobs.map((s) => [s.job, asText(s.amount)])) : {}));
  const [more, setMore] = useState(false);
  const [saved, setSaved] = useState<{ id: string; cost: Cost } | null>(null);
  const [sure, setSure] = useState(false);
  const [missing, setMissing] = useState('');
  const take = useRef<HTMLInputElement>(null);
  const choose = useRef<HTMLInputElement>(null);
  const grossBox = useRef<HTMLInputElement>(null);

  const fill = (r: ReceiptRead) => {
    setRead(r);
    setShop(r.shop === 'Receipt' ? '' : r.shop);
    if (r.date) setDate(r.date);
    setGross(asText(r.gross));
    setVat(asText(r.vat));
    setWithVat(r.vat > 0);
    setLines(r.lines);
    setNote(r.summary);
    setWhat(r.what);
    if (r.what === 'tools') setWhere('company');
  };

  // an email: read it as soon as the screen opens
  useEffect(() => {
    if (!mail || existing) return;
    let gone = false;
    void postJson<{ read: ReceiptRead; files: { id: string; name: string; type: string }[] }>('/api/job-kit/receipt', { action: 'mail', id: mail }).then((r) => {
      if (gone) return;
      if ('data' in r) {
        fill(r.data.read);
        setMailAtt(r.data.files[0]?.id ?? '');
        if (!r.data.read.receipt) setProblem('Claude doesn’t think this email is a receipt. Check it, or tap Not a receipt.');
      } else {
        setProblem(receiptProblem(r.error, r.detail));
        if (mailHead) setShop(mailHead.from.name || mailHead.from.email);
      }
      setStage('form');
    });
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for this email
  }, [mail]);

  const picked = async (f: File | undefined) => {
    if (!f) return;
    setProblem('');
    setStage('reading');
    let here: FileHere;
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      if (f.size > 4 * 1024 * 1024) {
        setProblem(receiptProblem('too-big'));
        setStage('pick');
        return;
      }
      here = { blob: f, name: f.name || 'receipt.pdf', type: 'application/pdf', url: '', thumb: '' };
    } else {
      try {
        const p = await shrinkPhoto(f);
        here = { blob: p.blob, name: 'receipt.jpg', type: 'image/jpeg', url: URL.createObjectURL(p.blob), thumb: p.thumb };
      } catch {
        setProblem(receiptProblem('type'));
        setStage('pick');
        return;
      }
    }
    setFile(here);
    const r = await readFile(here.blob, here.name);
    if ('data' in r) {
      fill(r.data.read);
      if (!r.data.read.receipt) setProblem('Claude doesn’t think this is a receipt. Check what it read, or retake it.');
      else if (!r.data.read.sure) setProblem(r.data.read.note || 'Some of it was hard to read: check the total and the date.');
    } else setProblem(receiptProblem(r.error, r.detail));
    setStage('form');
  };

  // a photo taken from Today or the job: read it straight away
  const started = useRef(false);
  useEffect(() => {
    if (!first || started.current) return;
    started.current = true;
    void picked(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the photo just taken
  }, [first]);

  const g = readAmount(gross);
  const v = withVat ? (vat.trim() ? readAmount(vat) : 0) : 0;
  const net = Number.isFinite(g) && Number.isFinite(v) ? round2(g - v) : Number.NaN;
  const splitJobs = Object.keys(split);
  const splitSum = round2(splitJobs.reduce((a, k) => a + (readAmount(split[k]) || 0), 0));
  const tools = what === 'tools';
  const whereNow: Where = tools ? 'company' : where;
  const jobName = (uuid: string) => jobOf(uuid)?.name ?? 'the job';
  const pickJob = (uuid: string) => {
    setWhere('job');
    setJobPick(uuid);
  };

  const shares = () => {
    if (whereNow === 'job') return job ? [{ job, amount: net }] : [];
    if (whereNow === 'split') return splitJobs.map((k) => ({ job: k, amount: readAmount(split[k]) || 0 }));
    return [];
  };
  const problemNow = () => {
    if (!Number.isFinite(g) || g <= 0) return 'What was paid, in pounds';
    if (!Number.isFinite(v) || v > g) return 'The VAT, in pounds (no more than what was paid)';
    if (!shop.trim()) return what === 'helper' ? 'Who helped' : what === 'parking' ? 'Where you parked, or how you paid' : 'The shop or supplier';
    if (whereNow === 'job' && !job) return 'Which job it’s for';
    if (whereNow === 'split') {
      if (splitJobs.length < 2) return 'At least two jobs to split it between';
      if (Math.abs(splitSum - net) > 0.01) return `The jobs to add up to ${pounds(net, true)} (now ${pounds(splitSum, true)})`;
    }
    return '';
  };

  const save = () => {
    const m = problemNow();
    if (m) {
      setMissing(m);
      if (/paid|VAT/.test(m)) grossBox.current?.focus();
      return;
    }
    setMissing('');
    const cid = existing?.id ?? newCostId();
    const firstJob = whereNow === 'job' ? job : whereNow === 'split' ? splitJobs[0] : '';
    const hasFile = Boolean(file) || Boolean(mail && mailAtt);
    const was = existing?.data;
    const cost: Cost = {
      kind: 'cost',
      date: date || todayKey(),
      shop: shop.trim().slice(0, 60),
      what,
      gross: round2(g),
      vat: round2(v),
      net,
      lines: lines.length ? lines : undefined,
      note: note.trim().slice(0, 120) || undefined,
      where: whereNow === 'split' ? 'job' : whereNow,
      jobs: shares(),
      from: was?.from ?? (mail ? 'email' : file ? (file.type === 'application/pdf' ? 'pdf' : 'photo') : 'typed'),
      mail: was?.mail ?? mail,
      mailAtt: was?.mailAtt ?? (mailAtt || undefined),
      client: jobOf(firstJob)?.client ?? was?.client,
      // a receipt moved to another job keeps its photo where it went first (it's in that job's diary)
      photo: was?.photo,
      photoWaiting: was ? was.photoWaiting : hasFile && Boolean(firstJob),
      read: was?.read ?? (read ? { model: read.model, sure: read.sure } : undefined),
      made: was?.made ?? Date.now(),
    };
    putCost(cid, cost);
    if (file && !existing) {
      void keepBlob(cid, { blob: file.blob, name: file.name, type: file.type }).then(() => void sendPhoto(cid));
      if (file.thumb) keepThumb(cid, file.thumb);
    } else if (cost.photoWaiting) void sendPhoto(cid);
    setSaved({ id: cid, cost });
  };
  const undo = () => {
    if (!saved) return;
    if (existing) putCost(saved.id, existing.data);
    else dropDoc(saved.id);
    setSaved(null);
  };
  const remove = () => {
    if (!existing) return;
    if (!sure) {
      setSure(true);
      setTimeout(() => setSure(false), 5000);
      return;
    }
    dropDoc(existing.id);
    onDone();
  };

  if (saved) {
    const c = saved.cost;
    const first = c.jobs[0]?.job;
    const soFar = first ? round2(costsOn(first, readCosts().costs).reduce((a, x) => a + x.net, 0)) : 0;
    const head = c.where === 'van' ? 'Kept as van stock' : c.where === 'company' ? 'Kept as a company cost' : c.jobs.length > 1 ? `Split between ${c.jobs.length} jobs` : `On ${possessive(jobName(first))} job`;
    const sub =
      c.where === 'van'
        ? 'Not counted on one job.'
        : c.where === 'company'
          ? 'With your receipts for the accountant, not on a job.'
          : c.jobs.length > 1
            ? c.jobs.map((s) => `${jobName(s.job)} ${pounds(s.amount, true)}`).join(' · ')
            : `Costs on it so far ${pounds(soFar, true)}${c.photoWaiting || c.photo ? ' · the receipt goes in its diary in ServiceM8' : ''}`;
    return (
      <div className="pt-7">
        <p className="kicker">{existing ? 'Changed' : 'Saved'}</p>
        <div className="mt-3 rounded-sm border-[1.5px] border-[var(--sec,var(--color-accent))] bg-mount px-4 py-4" data-receipt-saved>
          <p className="flex items-center gap-2 text-[17px] font-[650]">
            <span aria-hidden className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[var(--sec,var(--color-accent))] text-[13px] text-mount">✓</span>
            {head}
          </p>
          <p className="ml-[30px] mt-1 font-mono text-[13px] leading-relaxed text-muted">{sub}</p>
          {c.where === 'van' || c.where === 'company' ? <p className="ml-[30px] mt-1 text-[14px] text-muted">Keep the paper receipt: it isn’t on a job in ServiceM8.</p> : null}
          <button type="button" onClick={undo} className="ml-[30px] mt-2.5 text-[15px] font-semibold text-accent underline">
            Undo
          </button>
        </div>
        <div className="mt-5 grid gap-2.5">
          {first && c.jobs.length === 1 && first !== jobAt ? (
            <button type="button" className="btn btn-ghost w-full" onClick={() => onOpenJob(first)}>
              Open {possessive(jobName(first))} job
            </button>
          ) : null}
          {!mail ? (
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => {
                setSaved(null);
                setFile(null);
                setRead(null);
                setProblem('');
                setShop('');
                setGross('');
                setVat('');
                setLines([]);
                setNote('');
                setWhat(typed ? 'parking' : 'materials');
                setWhere('job');
                setSplit({});
                setMissing('');
                setWithVat(!typed);
                setStage(typed ? 'form' : 'pick');
              }}
            >
              {typed ? 'Add another cost' : 'Snap another receipt'}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary w-full" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const title = existing ? (existing.data.from === 'typed' ? 'Change this cost' : 'Change this receipt') : typed ? 'Add a cost' : mail ? 'Receipt from an email' : 'Snap a receipt';
  return (
    <div className="pt-7" data-receipt>
      <p className="kicker">{jobAt && jobOf(jobAt) ? `For ${possessive(jobOf(jobAt)!.name)} job` : 'What each job made'}</p>
      <h1 className="mt-1 font-display text-[30px] font-[680] leading-[1.05] tracking-[-0.02em]">{title}</h1>

      <input ref={take} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void picked(e.target.files?.[0] ?? undefined).finally(() => (e.target.value = ''))} />
      <input ref={choose} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void picked(e.target.files?.[0] ?? undefined).finally(() => (e.target.value = ''))} />

      {stage === 'pick' ? (
        <div className="mt-5 grid gap-2.5">
          <button type="button" className="btn btn-primary h-14 w-full text-[17px]" onClick={() => take.current?.click()} data-take>
            Take a photo of it
          </button>
          <button type="button" className="btn btn-ghost w-full" onClick={() => choose.current?.click()} data-choose>
            Choose a photo or PDF
          </button>
          <button type="button" className="py-2 text-center text-[15px] text-accent underline" onClick={() => setStage('form')}>
            No receipt: type it in
          </button>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">Claude reads the shop, the day, the total and the VAT; you pick the job. The photo goes in the job’s diary in ServiceM8 too, so it’s there for your accountant.</p>
          {problem ? (
            <p role="alert" className="rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
              {problem}
            </p>
          ) : null}
        </div>
      ) : null}

      {stage === 'reading' ? (
        <div className="mt-5" data-reading>
          {file?.url ? <img src={file.url} alt="The receipt" className="h-[220px] w-full rounded-sm bg-[#2b2e31] object-contain" /> : null}
          <p className="mt-4 text-center font-mono text-[14px] text-muted">{mail ? 'Claude is reading the email…' : 'Claude is reading it…'}</p>
        </div>
      ) : null}

      {stage === 'form' ? (
        <>
          {file?.url || (existing && (existing.data.photo || thumbOf(existing.id))) ? (
            <div className="relative mt-4">
              {file?.url ? <img src={file.url} alt="The receipt" className="h-[220px] w-full rounded-sm bg-[#2b2e31] object-contain" /> : existing ? <CostPic id={existing.id} cost={existing.data} big /> : null}
              {file && !existing ? (
                <button type="button" onClick={() => take.current?.click()} className="absolute bottom-2.5 right-2.5 rounded-sm bg-ink/80 px-2.5 py-1 font-mono text-[12px] text-paper">
                  Retake
                </button>
              ) : null}
            </div>
          ) : file?.type === 'application/pdf' ? (
            <p className="mt-4 rounded-sm border border-line-strong bg-mount px-3 py-2.5 font-mono text-[13px]">PDF: {file.name}</p>
          ) : null}
          {mail && mailHead ? (
            <p className="mt-4 text-[14.5px] text-muted">
              From {mailHead.from.name || mailHead.from.email}: “{mailHead.subject}”{mailAtt ? ', its PDF or photo goes on the job' : ''}
            </p>
          ) : null}

          {problem ? (
            <p role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
              {problem}
            </p>
          ) : null}

          <section className="mt-4 rounded-sm border border-line-strong bg-mount px-4 py-3.5">
            {read ? (
              <p className="font-mono text-[11.5px] uppercase tracking-[0.06em]" style={{ color: '#6a45b8' }}>
                ✓ Read by Claude{read.sure ? '' : ', check it'}
              </p>
            ) : null}
            {typed || existing?.data.from === 'typed' ? (
              <div className="mt-1">
                <p className={label}>What is it?</p>
                <KindChips value={what} onChange={setWhat} typed />
              </div>
            ) : null}
            <label className="mt-3 block">
              <span className={label}>{what === 'helper' ? 'Who helped' : what === 'parking' ? 'Where, or how you paid' : 'Shop or supplier'}</span>
              <input value={shop} onChange={(e) => setShop(e.target.value)} className={`${field} mt-1 h-12`} placeholder={what === 'helper' ? 'Kamil' : what === 'parking' ? 'Pay by phone' : 'Screwfix, East Finchley'} data-shop />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="block min-w-0">
                <span className={label}>Paid, £</span>
                <input ref={grossBox} value={gross} onChange={(e) => setGross(e.target.value)} inputMode="decimal" className={`${field} mt-1 h-12 font-mono`} placeholder="58.20" data-gross />
              </label>
              <label className="block min-w-0">
                <span className={label}>Day</span>
                <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1 h-12 font-mono`} data-date />
              </label>
            </div>
            <label className="mt-3 flex min-h-11 items-center gap-2.5">
              <input type="checkbox" checked={withVat} onChange={(e) => setWithVat(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" data-with-vat />
              <span className="text-[15px]">VAT on it</span>
              {withVat ? (
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="font-mono text-[13px] text-faint">£</span>
                  <input value={vat} onChange={(e) => setVat(e.target.value)} inputMode="decimal" className={`${field.replace('w-full ', '')} h-11 w-[96px] font-mono`} placeholder={Number.isFinite(g) && g > 0 ? (g - g / (1 + VAT_RATE)).toFixed(2) : '9.70'} aria-label="VAT, pounds" data-vat />
                  {Number.isFinite(g) && g > 0 && !vat.trim() ? (
                    <button type="button" className="font-mono text-[12.5px] text-accent underline" onClick={() => setVat((g - g / (1 + VAT_RATE)).toFixed(2))}>
                      20%
                    </button>
                  ) : null}
                </span>
              ) : null}
            </label>
            <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2.5">
              <div>
                <dt className={label}>Before VAT</dt>
                <dd className="mt-0.5 font-mono text-[17px] font-semibold" data-net>
                  {Number.isFinite(net) && net > 0 ? pounds(net, true) : '–'}
                </dd>
              </div>
              <div>
                <dt className={label}>VAT</dt>
                <dd className="mt-0.5 font-mono text-[17px]">{Number.isFinite(v) ? pounds(v, true) : '–'}</dd>
              </div>
              <div>
                <dt className={label}>Paid</dt>
                <dd className="mt-0.5 font-mono text-[17px]">{Number.isFinite(g) && g > 0 ? pounds(g, true) : '–'}</dd>
              </div>
            </dl>
            {lines.length ? (
              <>
                <ul className="mt-3 grid gap-1 border-t border-line pt-2.5 text-[14px]">
                  {lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="min-w-0">{l.text}</span>
                      <span className="shrink-0 font-mono text-muted">{pounds(l.amount, true)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 font-mono text-[12px] text-faint">As printed.</p>
              </>
            ) : null}
            <label className="mt-3 block">
              <span className={label}>What it was (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1 h-11`} placeholder={what === 'helper' ? 'Thursday, fitting the doors' : 'Hinges, screws and glue'} />
            </label>
          </section>

          {!(typed || existing?.data.from === 'typed') ? (
            <section className="mt-5">
              <h2 className="text-[17px] font-[650]">What is it?</h2>
              <KindChips
                value={what}
                onChange={(k) => {
                  setWhat(k);
                  if (k !== 'tools' && where === 'company') setWhere('job');
                }}
              />
              {tools ? <p className="mt-2 text-[14px] leading-relaxed text-muted">Tools last for many jobs, so they aren’t put on one. They stay with your other receipts for the accountant.</p> : null}
            </section>
          ) : null}

          {!tools ? (
            <section className="mt-5">
              <h2 className="text-[17px] font-[650]">Which job?</h2>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1.5" role="radiogroup" aria-label="Which job">
                {(more ? choices : choices.slice(0, 5)).map((c) => (
                  <Radio key={c.job.uuid} on={where === 'job' && job === c.job.uuid} onPick={() => pickJob(c.job.uuid)} title={c.job.name} sub={c.sub} tag={c.today ? 'Booked today' : undefined} id={c.job.uuid} />
                ))}
                {jobAt && !choices.some((c) => c.job.uuid === jobAt) && jobOf(jobAt) ? (
                  <Radio on={where === 'job' && job === jobAt} onPick={() => pickJob(jobAt)} title={jobOf(jobAt)!.name} sub={jobOf(jobAt)!.description ? whatShort(jobOf(jobAt)!.description) : 'This job'} id={jobAt} />
                ) : null}
                {!more && choices.length > 5 ? (
                  <button type="button" onClick={() => setMore(true)} className="py-1.5 text-left text-[14.5px] text-accent underline">
                    Show {choices.length - 5} more jobs
                  </button>
                ) : null}
                {!choices.length && !jobAt ? <p className="text-[14.5px] text-muted">No jobs going ahead or just finished in ServiceM8.</p> : null}
                <Radio on={where === 'split'} onPick={() => setWhere('split')} title="Split it between jobs" sub="Say how much goes on each" />
                <Radio on={where === 'van'} onPick={() => setWhere('van')} title="Van stock, not one job" sub="Screws and glue you use on every job" />
              </div>
              {where === 'split' ? (
                <div className="mt-3 rounded-sm border border-line-strong bg-mount px-3.5 py-3" data-split>
                  <p className="text-[14.5px] text-muted">Tick the jobs, then how much of the {Number.isFinite(net) && net > 0 ? pounds(net, true) : ''} before VAT goes on each.</p>
                  <ul className="mt-2 grid gap-1.5">
                    {choices.map((c) => {
                      const on = c.job.uuid in split;
                      return (
                        <li key={c.job.uuid} className="flex items-center gap-2.5">
                          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={on}
                              className="h-5 w-5 accent-[var(--color-accent)]"
                              onChange={(e) => {
                                const keys = e.target.checked ? [...splitJobs, c.job.uuid] : splitJobs.filter((k) => k !== c.job.uuid);
                                const even = Number.isFinite(net) && net > 0 ? evenShares(net, keys) : keys.map((k) => ({ job: k, amount: 0 }));
                                setSplit(Object.fromEntries(even.map((s) => [s.job, asText(s.amount)])));
                              }}
                            />
                            <span className="truncate text-[15px]">{c.job.name}</span>
                          </label>
                          {on ? <input value={split[c.job.uuid]} onChange={(e) => setSplit({ ...split, [c.job.uuid]: e.target.value })} inputMode="decimal" className={`${field.replace('w-full ', '')} h-11 w-[100px] font-mono`} aria-label={`Before VAT on ${c.job.name}`} /> : null}
                        </li>
                      );
                    })}
                  </ul>
                  {splitJobs.length >= 2 ? <p className={`mt-1.5 font-mono text-[12.5px] ${Math.abs(splitSum - net) > 0.01 ? 'text-ink' : 'text-faint'}`}>Adds up to {pounds(splitSum, true)} of {Number.isFinite(net) ? pounds(net, true) : '?'}</p> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {missing ? (
            <p role="alert" className="mt-4 text-[15px] font-semibold">
              Add: {missing}.
            </p>
          ) : null}
          <button type="button" onClick={save} className="btn btn-primary mt-5 h-[52px] w-full text-[16px]" data-save-cost>
            {existing
              ? 'Save the changes'
              : tools
                ? 'Keep it as a company cost'
                : whereNow === 'van'
                  ? 'Keep it as van stock'
                  : whereNow === 'split'
                    ? `Split ${Number.isFinite(net) && net > 0 ? pounds(net, true) : 'it'} between jobs`
                    : `Put ${Number.isFinite(net) && net > 0 ? pounds(net, true) : 'it'} on ${job ? possessive(jobName(job).split(' ')[0]) + ' job' : 'the job'}`}
          </button>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            {file || mail
              ? 'The receipt goes in the job’s diary in ServiceM8 too, so it’s there for your accountant.'
              : 'Counted before VAT, like the price.'}
          </p>
          {mail && !existing ? (
            <button
              type="button"
              className="mt-3 py-1.5 text-[15px] text-accent underline"
              onClick={() => {
                putDoc(mailKey(mail), { kind: 'skip', mail });
                onDone();
              }}
              data-not-receipt
            >
              Not a receipt
            </button>
          ) : null}
          {existing ? (
            <button type="button" onClick={remove} className={`btn btn-sm mt-5 ${sure ? 'btn-primary' : 'btn-ghost'}`} data-delete-cost>
              {sure ? 'Tap again to take it off' : 'Take this cost off'}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function KindChips({ value, onChange, typed }: { value: CostKind; onChange: (k: CostKind) => void; typed?: boolean }) {
  const list = typed ? COST_KINDS.filter((k) => k.id !== 'tools') : COST_KINDS;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {list.map((k) => {
        const on = value === k.id;
        return (
          <button key={k.id} type="button" aria-pressed={on} onClick={() => onChange(k.id)} className={`h-10 rounded-sm border px-3.5 text-[14.5px] ${on ? 'border-ink bg-ink font-semibold text-paper' : 'border-line-strong bg-mount text-ink hover:border-ink'}`}>
            {k.label}
          </button>
        );
      })}
    </div>
  );
}

function Radio({ on, onPick, title, sub, tag, id }: { on: boolean; onPick: () => void; title: string; sub: string; tag?: string; id?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} data-pick={id} className={`flex min-h-[58px] w-full items-center gap-3 rounded-sm bg-mount px-3 py-2.5 text-left ${on ? 'border-2 border-accent' : 'border border-line-strong hover:border-ink'}`}>
      <span aria-hidden className={`h-[18px] w-[18px] shrink-0 rounded-full bg-mount ${on ? 'border-[5px] border-accent' : 'border-[1.5px] border-ink/40'}`} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[15px] font-[650]">
          {title}
          {tag ? <span className="rounded-sm bg-accent-soft px-1.5 font-mono text-[10.5px] font-medium text-accent">{tag}</span> : null}
        </span>
        <span className="mt-0.5 block text-[13.5px] text-muted">{sub}</span>
      </span>
    </button>
  );
}

/* A receipt's picture: the one taken here, else its photo on the ServiceM8 job, else the shop's initial. */
const picUrls = new Map<string, string>();
function CostPic({ id, cost, big }: { id: string; cost: Cost; big?: boolean }) {
  const [url, setUrl] = useState(() => thumbOf(id) || (cost.photo ? picUrls.get(cost.photo.uuid) ?? '' : ''));
  useEffect(() => {
    if (url || !cost.photo?.uuid || cost.from === 'pdf') return;
    let gone = false;
    void fileBlob(cost.photo.uuid, 'thumb').then((r) => {
      if (gone || !('blob' in r) || !r.blob.type.startsWith('image/')) return;
      const u = URL.createObjectURL(r.blob);
      picUrls.set(cost.photo!.uuid, u);
      setUrl(u);
    });
    return () => {
      gone = true;
    };
  }, [url, cost.photo, cost.from]);
  if (big) return url ? <img src={url} alt="The receipt" className="h-[220px] w-full rounded-sm bg-[#2b2e31] object-contain" /> : null;
  if (url) return <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-sm border border-line object-cover" />;
  const letter = cost.what === 'parking' ? 'P' : cost.what === 'helper' ? '☺' : (cost.shop.trim()[0] ?? '£').toUpperCase();
  return (
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-line bg-paper font-mono text-[15px] font-semibold text-muted">
      {cost.from === 'pdf' || cost.from === 'email' ? 'PDF' : letter}
    </span>
  );
}

/* ---------- on the job: what it made ---------- */

function checkinHours(job: string): { n: number; mins: number } | null {
  try {
    const all = JSON.parse(localStorage.getItem('raf_jobkit_diary') || '{}') as Record<string, { diary?: { entries?: { kind?: string; at?: string | null; end?: string | null }[] } }>;
    const list = (all[job]?.diary?.entries ?? []).filter((e) => e.kind === 'checkin' && e.at && e.end && e.end > e.at);
    if (!list.length) return null;
    const mins = list.reduce((a, e) => a + (Date.parse(`${e.end}:00`) - Date.parse(`${e.at}:00`)) / 60000, 0);
    return mins > 0 ? { n: list.length, mins: Math.round(mins) } : null;
  } catch {
    return null;
  }
}

export function MadeBox({ job, bookings, rate, wide, onSnap, onReceipt, onTyped, onCost }: { job: CurrentJob; bookings: Booking[] | null; rate: number; wide: boolean; onSnap: (f: File) => void; onReceipt: () => void; onTyped: () => void; onCost: (id: string) => void }) {
  const view = useCosts();
  const set = view.sets[job.uuid];
  const days = useMemo(() => siteDays(workBookingsOf(job, bookings ?? [])), [job, bookings]);
  const snap = view.snaps[job.uuid];
  const diaryDays = days.length ? daysTotal(days) : snap?.days ?? 0;
  const on = costsOn(job.uuid, view.costs);
  const price = priceOf(job);
  const m = madeOf(price?.net ?? null, on, diaryDays, set, rate);
  const done = job.status === 'Completed';
  const today = todayKey();
  const doneDays = days.filter((d) => d.day <= today);
  const [editDays, setEditDays] = useState(false);
  const [daysBox, setDaysBox] = useState('');
  const [open, setOpen] = useState(false);
  const checkins = useMemo(() => checkinHours(job.uuid), [job.uuid]);
  const show = done || job.status === 'Work Order' || on.length > 0;
  if (!show) return null;

  const shown = open ? on : on.slice(0, 5);
  const share = m.price && m.price > 0 ? Math.min(100, Math.max(0, (m.costs / m.price) * 100)) : 0;
  const word = m.perDay !== null ? `${pounds(m.perDay)}/day` : m.count ? pounds(m.costs) : '';
  return (
    <section id="made" data-jsec="made" data-jsec-note={word} className="mt-6 scroll-mt-[calc(env(safe-area-inset-top)-20px)] rounded-sm border border-line-strong bg-mount p-4" data-made>
      <h2 className="flex items-center gap-2.5 text-[19px] font-[650]">
        <SecIcon k="made" />
        {done ? 'What it made' : 'What it’s making'}
      </h2>

      {m.perDay !== null ? (
        <>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-[40px] font-[680] leading-none tracking-[-0.02em]" data-per-day>
              {m.noCosts ? '≈ ' : ''}
              {pounds(m.perDay)}
            </span>
            <span className="text-[15px] text-muted">a day{done ? '' : ' so far'}</span>
          </p>
          <p className="mt-1 font-mono text-[13px] text-muted" data-vs>
            {vsWords(m.vsRate, rate)}
          </p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-[2px] bg-raised" role="img" aria-label={`Of the ${pounds(m.price ?? 0)} price, ${pounds(m.costs)} went on costs and ${pounds((m.price ?? 0) - m.costs)} was yours`}>
            <span className="h-full bg-ink/45" style={{ width: `${share}%` }} />
            <span className="h-full flex-1 bg-accent" style={{ marginLeft: share > 0 && share < 100 ? 2 : 0 }} />
          </div>
          <p className="mt-1 flex justify-between font-mono text-[12px] text-muted">
            <span>Costs {pounds(m.costs)}</span>
            <span className="text-accent">Yours {pounds((m.price ?? 0) - m.costs)}</span>
          </p>
        </>
      ) : (
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
          {m.price === null ? 'No price on this job in ServiceM8 yet.' : m.days === 0 ? 'No work days booked for it in your Diary yet.' : ''} {m.price !== null && m.days === 0 ? 'Add the days below to see what it makes a day.' : ''}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <div>
          <dt className={label}>Price</dt>
          <dd className="mt-0.5 font-mono text-[17px]">{m.price === null ? '?' : pounds(m.price)}</dd>
        </div>
        <div>
          <dt className={label}>Costs</dt>
          <dd className="mt-0.5 font-mono text-[17px]">{pounds(m.costs)}</dd>
        </div>
        <div>
          <dt className={label}>Days on site</dt>
          <dd className="mt-0.5 font-mono text-[17px]">{m.days ? daysText(m.days).replace(/ days?$/, '') : '–'}</dd>
        </div>
      </dl>
      {m.perDay !== null ? (
        <p className="mt-2 font-mono text-[12px] text-faint">
          ({pounds(m.price ?? 0)} − {pounds(m.costs)}) ÷ {daysText(m.days)} = {pounds(m.perDay)} a day. Before VAT{price?.from === 'paid' ? ', from what’s been paid' : ''}.
        </p>
      ) : null}

      <div className="mt-4 border-t border-line pt-3">
        <h3 className="flex items-baseline justify-between gap-2 text-[16px] font-[650]">
          <span>
            Costs <span className="font-mono text-[13px] font-normal text-faint">{on.length || ''}</span>
          </span>
          {on.some((c) => c.entry.data.photo || c.entry.data.photoWaiting) ? <span className="font-mono text-[12px] font-normal text-faint">receipts on the ServiceM8 job</span> : null}
        </h3>
        {on.length ? (
          <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {shown.map(({ entry, net }) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onCost(entry.id)} className="flex w-full items-center gap-3 rounded-sm py-1.5 text-left hover:bg-raised" data-cost={entry.id}>
                  <CostPic id={entry.id} cost={entry.data} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{entry.data.what === 'parking' || entry.data.what === 'helper' ? kindLabel(entry.data.what) : entry.data.shop}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {[entry.data.what === 'parking' || entry.data.what === 'helper' ? entry.data.shop : entry.data.note, fmtDay(entry.data.date), entry.data.from === 'typed' ? 'typed' : entry.data.from, entry.data.jobs.length > 1 ? 'split' : '', entry.data.photoWaiting ? 'photo to send' : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[14px]">{pounds(net, true)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[14.5px] text-muted">{done ? (set?.allCosts ? 'None: you said there were no costs.' : 'Nothing on it yet.') : 'Nothing on it yet. Snap each receipt as you go.'}</p>
        )}
        {on.length > 5 && !open ? (
          <button type="button" className="mt-1 text-[14.5px] text-accent underline" onClick={() => setOpen(true)}>
            Show all {on.length}
          </button>
        ) : null}
        {on.length ? (
          <>
            <p className="mt-2 flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
              <span>Costs before VAT</span>
              <span className="font-mono">{pounds(m.costs, true)}</span>
            </p>
            {m.vat > 0 ? <p className="mt-0.5 font-mono text-[12px] text-faint">VAT on the receipts {pounds(m.vat, true)}, to claim back</p> : null}
          </>
        ) : null}
        <div className="mt-3 grid gap-1">
          <SnapButton wide={wide} onFile={onSnap} onOther={onReceipt} other={wide ? 'More ways to add it' : 'A PDF or a photo from the phone'} />
          <button type="button" onClick={onTyped} className="btn btn-ghost w-full" data-typed>
            Add a cost by hand
          </button>
        </div>
        {done ? (
          <label className="mt-3 flex min-h-11 items-center gap-2.5 text-[15px]">
            <input type="checkbox" checked={Boolean(set?.allCosts)} onChange={(e) => setJob(job.uuid, { allCosts: e.target.checked, checkedAt: Date.now() })} className="h-5 w-5 accent-[var(--color-accent)]" data-all-costs />
            That’s all the costs on it
          </label>
        ) : null}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <h3 className="flex items-baseline justify-between gap-2 text-[16px] font-[650]">
          Days on site
          {!editDays ? (
            <button
              type="button"
              className="text-[14px] font-normal text-accent underline"
              onClick={() => {
                setDaysBox(String(m.days || diaryDays || ''));
                setEditDays(true);
              }}
              data-change-days
            >
              Change
            </button>
          ) : null}
        </h3>
        {editDays ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="h-11 w-11 rounded-sm border border-line-strong bg-mount text-[20px]" aria-label="Half a day less" onClick={() => setDaysBox(String(Math.max(0.5, (Number(daysBox) || 0) - 0.5)))}>
              −
            </button>
            <input value={daysBox} onChange={(e) => setDaysBox(e.target.value)} inputMode="decimal" className={`${field.replace('w-full ', '')} h-11 w-[80px] text-center font-mono`} aria-label="Days on site" data-days-box />
            <button type="button" className="h-11 w-11 rounded-sm border border-line-strong bg-mount text-[20px]" aria-label="Half a day more" onClick={() => setDaysBox(String((Number(daysBox) || 0) + 0.5))}>
              +
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                const d = Math.round((Number(daysBox) || 0) * 2) / 2;
                setJob(job.uuid, { days: d > 0 ? d : null });
                setEditDays(false);
              }}
              data-save-days
            >
              Save
            </button>
            {set?.days ? (
              <button
                type="button"
                className="text-[14px] text-accent underline"
                onClick={() => {
                  setJob(job.uuid, { days: null });
                  setEditDays(false);
                }}
              >
                Use the Diary’s{diaryDays ? ` (${diaryDays})` : ''}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-[14.5px] text-muted" data-days-words>
            {m.daysFrom === 'raf'
              ? `${daysText(m.days)}, as you said${diaryDays ? ` (the Diary has ${daysText(diaryDays)})` : ''}.`
              : days.length
                ? `${daysText(diaryDays)}${days.length > 1 ? `, ${fmtDay(days[0].day)} to ${fmtDay(days[days.length - 1].day)}` : `, ${fmtDay(days[0].day)}`}, from your Diary${!done && doneDays.length < days.length ? ` (${daysText(daysTotal(doneDays))} gone)` : ''}.`
                : snap?.days
                  ? `${daysText(snap.days)}, from your Diary.`
                  : 'No work booked in your Diary. Tap Change to say how many.'}
          </p>
        )}
        {days.length && !editDays ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {days.slice(0, 21).map((d) => (
              <span key={d.day} title={`${d.hours} h booked`} className={`grid h-11 min-w-[40px] place-items-center rounded-sm border px-1 text-center font-mono text-[11px] leading-tight ${d.day <= today ? 'border-accent bg-accent-soft text-accent' : 'border-dashed border-line-strong text-muted'}`}>
                <span>
                  {fmtDay(d.day).split(' ')[0]}
                  <br />
                  {fmtDay(d.day).split(' ')[1]}
                  {d.value === 0.5 ? '½' : ''}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        {checkins ? (
          <p className="mt-2 font-mono text-[12px] text-faint">
            Checked in {checkins.n} time{checkins.n === 1 ? '' : 's'} in ServiceM8: {Math.floor(checkins.mins / 60)} h {checkins.mins % 60} min.
          </p>
        ) : null}
        <p className="mt-2 font-mono text-[12px] text-faint">A day booked under {5} hours counts as half a day.</p>
      </div>
    </section>
  );
}

/* ---------- finished jobs ---------- */

/* Every finished job: kept snapshots, with the ones ServiceM8 sent this time over them. */
export function madeRows(view: ReturnType<typeof readCosts>, jobs: CurrentJob[], bookings: Booking[] | null, rate: number): JobRow[] {
  const snaps = { ...view.snaps };
  for (const j of jobs) {
    if (j.status !== 'Completed' || !j.completed) continue;
    const days = bookings ? siteDays(workBookingsOf(j, bookings)) : [];
    const s = snapOf(j, days, j.description ? whatShort(j.description) : 'Job');
    const was = snaps[j.uuid];
    if (was && !days.length) {
      s.days = was.days;
      s.firstDay = was.firstDay;
      s.lastDay = was.lastDay;
    }
    snaps[j.uuid] = s;
  }
  return Object.values(snaps).map((s) => jobRow(s, view.costs, view.sets[s.job], rate));
}

/* Keeps a snapshot of each finished job ServiceM8 sent, so it's still counted once it's older than ServiceM8's
   30 days. Only what changed is written. */
export function keepSnaps(jobs: CurrentJob[], bookings: Booking[] | null) {
  if (!bookings) return;
  const have = readCosts().snaps;
  for (const j of jobs) {
    if (j.status !== 'Completed' || !j.completed) continue;
    const days = siteDays(workBookingsOf(j, bookings));
    const s = snapOf(j, days, j.description ? whatShort(j.description) : 'Job');
    const was = have[j.uuid];
    if (was && !days.length && was.days) {
      s.days = was.days;
      s.firstDay = was.firstDay;
      s.lastDay = was.lastDay;
    }
    if (!sameSnap(was, s)) putSnap(s);
  }
}

export function madeHomeLine(rows: JobRow[], rate: number) {
  const t = totalsOf(inPeriod(rows, '90', todayKey()));
  if (!t.jobs || t.perDay === null) return rows.length ? 'Add the days on site to see what they made' : 'Price, costs and days on site of each finished job';
  return `${t.noCosts ? '≈ ' : ''}${pounds(t.perDay)} a day on ${t.jobs} job${t.jobs === 1 ? '' : 's'} in 90 days, your rate ${pounds(rate)}`;
}

export function MadeView({ jobs, bookings, rate, onOpen, onGantt, onBoard }: { jobs: CurrentJob[]; bookings: Booking[] | null; rate: number; onOpen: (r: Snap) => void; onGantt: () => void; onBoard: () => void }) {
  const view = useCosts();
  const sync = useCostSync();
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const p = localStorage.getItem('raf_jobkit_made_period') as Period | null;
      return p && PERIODS.some((x) => x.id === p) ? p : '90';
    } catch {
      return '90';
    }
  });
  const [all, setAll] = useState(false);
  const today = todayKey();
  const rows = useMemo(() => inPeriod(madeRows(view, jobs, bookings, rate), period, today), [view, jobs, bookings, rate, period, today]);
  const t = totalsOf(rows);
  const kinds = byKind(rows);
  const away = awayFromJobs(view.costs, sinceOf(period, today));
  const says = insights(rows, rate, away);
  const max = Math.max(rate * 1.25, ...kinds.map((k) => k.perDay), 1);
  const pick = (p: Period) => {
    setPeriod(p);
    try {
      localStorage.setItem('raf_jobkit_made_period', p);
    } catch {
      /* this visit only */
    }
  };
  const list = all ? rows : rows.slice(0, 8);
  const words = PERIODS.find((p) => p.id === period)!.words;
  return (
    <div className="pb-6" data-made-view>
      <TimelineTabs on="made" onGantt={onGantt} onBoard={onBoard} onMade={() => {}} />
      <p className="kicker mt-5">Finished jobs · before VAT</p>
      <h1 className="mt-1 font-display text-[32px] font-[680] leading-[1.04] tracking-[-0.02em]">What jobs made</h1>
      <div className="mt-3 flex gap-1.5" role="group" aria-label="How far back">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => pick(p.id)} className={`h-10 rounded-sm border px-3.5 font-mono text-[13px] ${period === p.id ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-mount hover:border-ink'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-sm border border-line-strong bg-mount p-4" data-made-hero>
          <p className={label}>After costs, a day on site</p>
          {t.perDay !== null ? (
            <>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[46px] font-[680] leading-none tracking-[-0.02em]">
                  {t.noCosts ? '≈ ' : ''}
                  {pounds(t.perDay)}
                </span>
                <span className="text-[15px] text-muted">a day</span>
              </p>
              <p className="mt-1 font-mono text-[13px] text-muted">{vsWords(t.perDay - rate, rate)}</p>
            </>
          ) : (
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{rows.length ? 'No finished job in these days has its price and days on site yet.' : `No finished jobs ${words}. Jobs ServiceM8 marks Completed show here, with their price and the days booked in your Diary.`}</p>
          )}
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
            <div>
              <dt className={label}>
                {t.jobs} job{t.jobs === 1 ? '' : 's'}
              </dt>
              <dd className="mt-0.5 font-mono text-[17px]">{pounds(t.price)}</dd>
            </div>
            <div>
              <dt className={label}>Costs</dt>
              <dd className="mt-0.5 font-mono text-[17px]">{pounds(t.costs)}</dd>
            </div>
            <div>
              <dt className={label}>Days</dt>
              <dd className="mt-0.5 font-mono text-[17px]">{t.days % 1 ? t.days.toFixed(1) : t.days}</dd>
            </div>
          </dl>
          {t.noCosts ? <p className="mt-2 font-mono text-[12px] leading-relaxed text-faint">≈ {t.noCosts === 1 ? '1 job has' : `${t.noCosts} jobs have`} no costs on {t.noCosts === 1 ? 'it' : 'them'} yet.</p> : null}
          {t.left ? <p className="mt-1 font-mono text-[12px] leading-relaxed text-faint">{t.left === 1 ? '1 job isn’t' : `${t.left} jobs aren’t`} counted: no price or no days yet.</p> : null}
        </section>

        {kinds.length ? (
          <section className="rounded-sm border border-line-strong bg-mount p-4">
            <h2 className="text-[17px] font-[650]">By kind of work</h2>
            <div className="relative mt-3" role="img" aria-label={`Pounds a day by kind of work: ${kinds.map((k) => `${k.kind.label} ${Math.round(k.perDay)}`).join(', ')}, against your rate of ${rate}`}>
              <div aria-hidden className="pointer-events-none absolute bottom-0 top-0 z-10 border-l-[1.5px] border-dashed border-ink/55" style={{ left: `calc(116px + (100% - 116px - 68px) * ${Math.min(1, rate / max)})` }}>
                <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-muted">your rate {pounds(rate)}</span>
              </div>
              <ul className="mt-5 grid gap-1.5">
                {kinds.map((k) => (
                  <li key={k.kind.id} className="grid min-h-11 grid-cols-[116px_minmax(0,1fr)_68px] items-center gap-0" title={`${k.kind.label}: ${k.jobs} job${k.jobs === 1 ? '' : 's'}, ${daysText(k.days)}, ${pounds(k.perDay)} a day`}>
                    <span className="min-w-0 pr-2 text-[13.5px] leading-tight">
                      {k.kind.short}
                      <span className="block font-mono text-[11px] text-faint">
                        {k.jobs} job{k.jobs === 1 ? '' : 's'} · {daysText(k.days)}
                      </span>
                    </span>
                    <span className="h-5">
                      <span className="block h-full rounded-r-[4px] bg-accent" style={{ width: `${Math.max(2, Math.min(100, (Math.max(0, k.perDay) / max) * 100))}%` }} />
                    </span>
                    <span className="pl-2 text-right font-mono text-[13px]">{pounds(k.perDay)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>

      {says.length ? (
        <section className="mt-4 rounded-sm border border-line-strong bg-mount p-4">
          <h2 className="text-[17px] font-[650]">What it tells you</h2>
          <ol className="mt-2 grid gap-2">
            {says.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="font-mono text-[13px] text-accent">{String(i + 1).padStart(2, '0')}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {rows.length ? (
        <section className="mt-4 rounded-sm border border-line-strong bg-mount p-4">
          <h2 className="flex items-baseline justify-between gap-2 text-[17px] font-[650]">
            Every job <span className="font-mono text-[12px] font-normal text-faint">newest first</span>
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {list.map((r) => (
              <li key={r.snap.job}>
                <button type="button" onClick={() => onOpen(r.snap)} className="flex w-full items-center gap-3 py-2.5 text-left" data-made-row={r.snap.job}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-semibold">{r.snap.name}</span>
                    <span className="block truncate text-[13.5px] text-muted">
                      {r.snap.what}
                      {r.snap.area ? ` · ${r.snap.area}` : ''} · {fmtDay(r.snap.completed)}
                    </span>
                    <span className="block truncate font-mono text-[12px] text-faint">
                      {r.made.price === null ? 'no price' : pounds(r.made.price)} · costs {r.made.noCosts ? 'none yet' : pounds(r.made.costs)} · {r.made.days ? daysText(r.made.days) : 'no days'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[15px] font-semibold">{r.made.perDay === null ? '–' : `${r.made.noCosts ? '≈ ' : ''}${pounds(r.made.perDay)}`}</span>
                    <span className="block font-mono text-[11.5px] text-muted">{r.made.vsRate === null ? '' : Math.abs(r.made.vsRate) < 5 ? 'on your rate' : `${pounds(Math.abs(r.made.vsRate))} ${r.made.vsRate > 0 ? 'over' : 'under'}`}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {rows.length > list.length ? (
            <button type="button" className="mt-1 text-[14.5px] text-accent underline" onClick={() => setAll(true)}>
              Show all {rows.length}
            </button>
          ) : null}
        </section>
      ) : null}

      <p className="mt-5 font-mono text-[12px] leading-relaxed text-faint">
        Price from ServiceM8, less VAT. Costs from receipts and what you typed. Days from the work booked in your Diary, unless you changed them. Your van, tools and insurance aren’t counted. {sync.state === 'syncing' ? 'Bringing in the other device’s…' : sync.state === 'offline' ? 'No signal: showing what’s on this device.' : ''}
      </p>
    </div>
  );
}

/* ---------- To do, and the box on an email ---------- */

export function madeTodayLines(o: { mails: InboxMail[]; jobs: CurrentJob[]; bookings: Booking[] | null; rate: number }): TodayLine[] {
  const view = readCosts();
  const out: TodayLine[] = [];
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const receipts = o.mails.filter((m) => m.at >= since && !view.mails.has(m.id) && !view.skips.has(m.id) && receiptLike(m));
  if (receipts.length === 1) out.push({ text: `${receipts[0].from.name || receipts[0].from.email} email in info@: which job is it for?`, go: 'receipt', id: receipts[0].id, icon: 'receipt', urgent: true });
  else if (receipts.length > 1) out.push({ text: `${receipts.length} receipts in info@ to put on jobs`, go: 'receipt', id: receipts[0].id, icon: 'receipt', urgent: true });
  const week = new Date(Date.now() - 7 * 864e5).toLocaleDateString('sv-SE');
  const done = o.jobs.filter((j) => j.status === 'Completed' && (j.completed ?? '').slice(0, 10) >= week && !view.sets[j.uuid]?.checkedAt);
  for (const j of done.slice(0, 2)) {
    const days = o.bookings ? daysTotal(siteDays(workBookingsOf(j, o.bookings))) : view.snaps[j.uuid]?.days ?? 0;
    const p = priceOf(j);
    const m = madeOf(p?.net ?? null, costsOn(j.uuid, view.costs), days, view.sets[j.uuid], o.rate);
    out.push({ text: m.perDay !== null ? `${possessive(j.name)} job made about ${pounds(m.perDay)} a day: any receipts still to add?` : `${possessive(j.name)} job is finished: put its costs on it`, go: 'sm8', id: j.uuid, icon: 'made' });
  }
  return out;
}

/* On an email in the Inbox that looks like a supplier's receipt. */
export function MailReceiptBox({ mail, onPut, onOpenJob, jobs }: { mail: InboxMail; onPut: () => void; onOpenJob: (uuid: string) => void; jobs: CurrentJob[] }) {
  const view = useCosts();
  const on = view.costs.find((c) => c.data.mail === mail.id);
  const skipped = view.skips.has(mail.id);
  if (!on && (skipped || !receiptLike(mail))) return null;
  if (on) {
    const j = on.data.jobs[0]?.job;
    const who = j ? jobs.find((x) => x.uuid === j)?.name : '';
    return (
      <div className="mt-4 rounded-sm border border-line-strong bg-mount px-3.5 py-3" data-mail-receipt="on">
        <p className="text-[15px]">
          <span className="font-semibold">{on.data.where === 'van' ? 'Kept as van stock' : on.data.where === 'company' ? 'Kept as a company cost' : who ? `On ${possessive(who)} job` : 'On a job'}</span>: {pounds(on.data.net, true)} before VAT
        </p>
        {j && who ? (
          <button type="button" className="mt-1.5 text-[14.5px] text-accent underline" onClick={() => onOpenJob(j)}>
            Open the job
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-sm border-[1.5px] border-accent bg-mount px-3.5 py-3" data-mail-receipt="new">
      <p className="text-[15px] font-semibold">Looks like a receipt from {mail.from.name || mail.from.email}</p>
      <p className="mt-0.5 text-[14px] text-muted">Claude reads it; you pick the job, and its PDF goes in the job’s diary.</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={onPut}>
          Put it on a job
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => putDoc(mailKey(mail.id), { kind: 'skip', mail: mail.id })}>
          Not a receipt
        </button>
      </div>
    </div>
  );
}

/* A photo still waiting on this device, for the Settings line. */
export async function waitingReceipts() {
  let n = 0;
  for (const c of readCosts().costs) if (c.data.photoWaiting && (await blobOf(c.id))) n++;
  return n;
}
