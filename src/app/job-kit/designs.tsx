'use client';
import { useEffect, useRef, useState } from 'react';
import Mark from './mark';
import { Area, field, label, Missing, SectionView, TalkBox } from './parts';
import { DESIGN_IDEAS, DESIGN_SPACE, type Section, type Slot } from './plan';
import { emptyBrief, emptyNotes, newJobId, type DesignBrief, type Item, type Job, type Size } from './store';

/* Designs: Raf's requests for a customer's 3D design. He fills in the space (photos), sizes, what they want
   and the options, and taps Send for design; it goes to the inbox like a job. A scheduled Claude run builds it
   in SketchUp and publishes a private page at rafcarpentry.com/d/<code> (content/designs/<code>.json carries
   `request` = this id and `updatedFor` = the send it answers); /job-kit reads those at build, so the request
   here turns into "Design ready" with Send on WhatsApp and Copy link. Changes are added to the same request
   and the same link updates. */

export type DesignsReady = Record<string, { code: string; title: string; updatedFor: string }>;
type State = 'draft' | 'sending' | 'waiting' | 'ready' | 'updating';

const SITE = 'https://www.rafcarpentry.com';
const linkOf = (code: string) => `${SITE}/d/${code}`;

export function designState(job: Job, ready?: { updatedFor: string }): State {
  if (!job.readyAt) return 'draft';
  const doneFor = ready ? Date.parse(ready.updatedFor) || 0 : 0;
  if (ready && doneFor >= job.readyAt) return 'ready';
  if ((job.detailsSentAt || 0) < job.readyAt) return 'sending';
  return ready ? 'updating' : 'waiting';
}

/* Which requests have a page: asked for behind the PIN (the codes keep the pages private) and kept on the
   phone for when there's no signal. */
const READY_KEY = 'raf_jobkit_designs';
export function savedReady(): DesignsReady {
  try {
    return JSON.parse(localStorage.getItem(READY_KEY) || '{}') as DesignsReady;
  } catch {
    return {};
  }
}
export async function fetchReady(pin: string): Promise<DesignsReady | null> {
  if (!pin) return null;
  try {
    const res = await fetch('/api/job-kit/designs', { method: 'POST', headers: { 'x-job-kit-pin': pin }, cache: 'no-store' });
    if (!res.ok) return null;
    const { ready } = (await res.json()) as { ready: DesignsReady };
    try {
      localStorage.setItem(READY_KEY, JSON.stringify(ready));
    } catch {
      /* no storage */
    }
    return ready;
  } catch {
    return null;
  }
}

const when = (t?: number) => (t ? new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/* UK mobile to the digits WhatsApp wants: "07700 900123" -> "447700900123". */
function toIntl(raw: string) {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '44' + d.slice(1);
  return d.replace(/\D/g, '');
}

function whatsappTo(mobile: string, text: string) {
  const n = toIntl(mobile);
  return `https://wa.me/${n.length >= 10 ? n : ''}?text=${encodeURIComponent(text)}`;
}

/* ---------- the list ---------- */

export function DesignsList({ jobs, items, ready, onNew, onOpen }: { jobs: Job[]; items: Item[]; ready: DesignsReady; onNew: () => void; onOpen: (id: string) => void }) {
  return (
    <div className="pt-7">
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">Designs</h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">
        A customer’s piece in 3D before you quote: they turn it round, open the doors and look inside on their phone. Fill in what you know and send it; the link appears here.
      </p>
      <button type="button" onClick={onNew} className="btn btn-primary mt-6 w-full">
        New design
      </button>
      {jobs.length ? (
        <ul className="mt-7 grid gap-3">
          {jobs.map((j) => {
            const st = designState(j, ready[j.id]);
            const thumb = items.find((i) => i.jobId === j.id && i.thumb)?.thumb;
            const text = { draft: 'Not sent yet', sending: 'Sending…', waiting: `Sent ${when(j.readyAt)}, design on its way`, ready: 'Design ready', updating: 'Changes on their way' }[st];
            return (
              <li key={j.id}>
                <button type="button" onClick={() => onOpen(j.id)} className="flex w-full items-stretch gap-3 rounded-sm border border-line-strong bg-mount p-2.5 text-left transition-colors hover:border-ink">
                  <span className="relative block h-[76px] w-[76px] shrink-0 overflow-hidden rounded-sm bg-raised">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail kept on the phone */}
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="block truncate text-[16.5px] font-semibold leading-snug">{j.what}</span>
                    <span className="block truncate text-[14.5px] text-muted">{j.area}</span>
                    <span className="mt-1.5 flex items-center gap-1.5 font-mono text-[12.5px] text-faint">
                      <Mark state={st === 'ready' ? 'sent' : st === 'draft' ? 'waiting' : 'sending'} />
                      {text}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-7 font-mono text-[13.5px] text-faint">No designs yet.</p>
      )}
    </div>
  );
}

/* ---------- a new request ---------- */

export function NewDesign({ onCancel, onCreate }: { onCancel: () => void; onCreate: (j: Job) => void | Promise<void> }) {
  const [what, setWhat] = useState('');
  const [area, setArea] = useState('');
  const [tried, setTried] = useState(false);
  const whatRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);
  return (
    <form
      className="pt-7"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!what.trim() || !area.trim()) {
          (what.trim() ? areaRef : whatRef).current?.focus();
          return;
        }
        const now = Date.now();
        const d = new Date();
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        void onCreate({
          id: `design-${newJobId(month, what, area)}`,
          kind: 'design',
          design: emptyBrief(),
          what: what.trim(),
          area: area.trim(),
          month,
          kinds: [],
          notes: { ...emptyNotes(), sizes: [{ what: 'The space', w: '', h: '', d: '' }] },
          createdAt: now,
          updatedAt: now,
          seq: 0,
        });
      }}
    >
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">New design</h1>
      <div className="mt-6 grid gap-5">
        <label className="grid gap-1.5">
          <span className={label}>What</span>
          <input ref={whatRef} className={`${field} h-12 ${tried && !what.trim() ? 'border-ink' : ''}`} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Wardrobes either side of the chimney" autoCapitalize="sentences" />
          {tried && !what.trim() ? <Missing>Type what they want made.</Missing> : null}
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Area</span>
          <input ref={areaRef} className={`${field} h-12 ${tried && !area.trim() ? 'border-ink' : ''}`} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Muswell Hill" autoCapitalize="words" />
          <span className="text-[13.5px] text-faint">Area only. The page never shows the customer’s name or street.</span>
          {tried && !area.trim() ? <Missing>Type the area.</Missing> : null}
        </label>
      </div>
      <div className="mt-8 flex gap-3">
        <button type="submit" className="btn btn-primary flex-1">
          Start the design
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- one request ---------- */

export function DesignView({
  job,
  items,
  ready,
  busy,
  onAdd,
  onRemove,
  onCaption,
  onJob,
  onSend,
  onForget,
}: {
  job: Job;
  items: Item[];
  ready?: { code: string; title: string; updatedFor: string };
  busy: Record<string, number>;
  onAdd: (jobId: string, section: Section, slot: Slot, files: File[]) => Promise<void>;
  onRemove: (i: Item) => Promise<void>;
  onCaption: (i: Item, c: string) => Promise<void>;
  onJob: (change: (j: Job) => Job) => Promise<void>;
  onSend: () => Promise<void>;
  onForget: () => Promise<void>;
}) {
  const st = designState(job, ready);
  const live = items.filter((i) => !i.lost);
  const left = live.filter((i) => !i.sent).length;

  // Typing saves to the phone after a short pause; leaving the screen saves at once.
  const [d, setD] = useState<DesignBrief>(job.design ?? emptyBrief());
  const [sizes, setSizes] = useState<Size[]>(job.notes.sizes);
  const [talk, setTalk] = useState(job.notes.talk ?? '');
  const latest = useRef({ d, sizes, talk });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keep = (j: Job): Job => ({ ...j, design: latest.current.d, notes: { ...j.notes, sizes: latest.current.sizes, talk: latest.current.talk } });
  const save = (next: { d?: DesignBrief; sizes?: Size[]; talk?: string }) => {
    if (next.d) setD(next.d);
    if (next.sizes) setSizes(next.sizes);
    if (next.talk !== undefined) setTalk(next.talk);
    latest.current = { d: next.d ?? latest.current.d, sizes: next.sizes ?? latest.current.sizes, talk: next.talk ?? latest.current.talk };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void onJob(keep);
    }, 700);
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void onJob(keep);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const size = (i: number, k: keyof Size, v: string) => save({ sizes: sizes.map((s, j) => (j === i ? { ...s, [k]: k === 'what' ? v : v.replace(/[^\d.]/g, '') } : s)) });

  const [change, setChange] = useState('');
  const [copied, setCopied] = useState(false);
  const [sure, setSure] = useState(false);
  const link = ready ? linkOf(ready.code) : '';
  const message = `Hi, here’s the 3D design for your ${job.what.charAt(0).toLowerCase() + job.what.slice(1)}:\n${link}\n\nYou can turn it round, open the doors and look inside on your phone. Let me know what you think.\nRaf`;

  const flushAndSend = async (changeText?: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
    const brief = latest.current.d;
    const nextBrief = changeText ? { ...brief, changes: [...brief.changes, { at: Date.now(), text: changeText }] } : brief;
    setD(nextBrief);
    latest.current = { ...latest.current, d: nextBrief };
    await onJob(keep);
    await onSend();
  };

  return (
    <div className="pt-5">
      <p className="kicker">Design request</p>
      <h1 className="mt-1 font-display text-[28px] font-[680] leading-[1.05] tracking-[-0.025em]">{job.what}</h1>
      <p className="mt-0.5 text-[15.5px] text-muted">{job.area}</p>

      {st === 'ready' || st === 'updating' ? (
        <div className="mt-5 rounded-sm border border-accent bg-accent-soft p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Mark state={st === 'ready' ? 'sent' : 'sending'} /> {st === 'ready' ? 'Design ready' : `Changes sent ${when(job.readyAt)}`}
          </p>
          {st === 'updating' ? <p className="mt-1 text-[14.5px] leading-relaxed text-muted">The same link updates when they’re done, usually within 2 hours (7am to 8pm). Until then it shows the last version.</p> : null}
          <p className="mt-2 break-all rounded-sm border border-line bg-mount px-3 py-2.5 font-mono text-[13.5px]">{link}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={whatsappTo(d.mobile, message)} className="btn btn-whatsapp btn-sm" target="_blank" rel="noopener">
              Send on WhatsApp
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(link)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  })
                  .catch(() => {})
              }
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a href={link} className="btn btn-ghost btn-sm" target="_blank" rel="noopener">
              Open
            </a>
          </div>
        </div>
      ) : st === 'waiting' || st === 'sending' ? (
        <div className="mt-5 rounded-sm border border-accent bg-accent-soft p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Mark state="sending" /> {st === 'sending' ? 'Sending…' : `Sent ${when(job.readyAt)}`}
          </p>
          <p className="mt-1 text-[14.5px] leading-relaxed text-muted">
            {st === 'sending'
              ? `${left ? `${left} photo${left === 1 ? '' : 's'} still to go. ` : ''}Keep the app open with signal.`
              : 'Claude makes the design and the link appears here, usually within 2 hours (7am to 8pm). Nothing after that? Tell Claude: make the new design.'}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[15.5px] leading-relaxed text-muted">Add what you know (say it, photos, sizes), then tap Send for design at the bottom. Gaps are fine: anything missing is drawn at standard sizes and the page says so.</p>
      )}

      <div className="mt-7 grid gap-8">
        <TalkBox
          value={talk}
          onChange={(v) => save({ talk: v })}
          hint="Walk round the room and say what they want: what goes where, sizes you measured, doors or drawers, colours, anything in the way, the options to show. Messy is fine, Claude sorts it out."
        />

        <section>
          <h2 className="text-[19px] font-[650]">{DESIGN_SPACE.title}</h2>
          <div className="mt-2">
            <SectionView section={DESIGN_SPACE} job={job} items={live} busy={busy} onAdd={onAdd} onRemove={onRemove} onCaption={onCaption} />
          </div>
        </section>

        <fieldset>
          <legend className="text-[19px] font-[650]">Sizes in mm (W x H x D)</legend>
          <p className="mt-1 text-[14.5px] text-muted">The space first, then anything fixed: chimney breast, window, boiler.</p>
          <div className="mt-3 grid gap-3">
            {sizes.map((s, i) => (
              <div key={i} className="rounded-sm border border-line bg-mount p-2.5">
                <input className={`${field} h-11`} value={s.what} onChange={(e) => size(i, 'what', e.target.value)} placeholder="e.g. The space, chimney breast" aria-label="What this size is" />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(['w', 'h', 'd'] as const).map((k) => (
                    <label key={k} className="grid gap-1">
                      <span className="font-mono text-[11.5px] text-faint">{k === 'w' ? 'Width' : k === 'h' ? 'Height' : 'Depth'}</span>
                      <input className={`${field} h-11 font-mono`} inputMode="numeric" value={s[k]} onChange={(e) => size(i, k, e.target.value)} placeholder="mm" />
                    </label>
                  ))}
                </div>
                {sizes.length > 1 ? (
                  <button type="button" className="mt-1.5 h-9 text-[14px] text-muted" onClick={() => save({ sizes: sizes.filter((_, j) => j !== i) })}>
                    Remove this size
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => save({ sizes: [...sizes, { what: '', w: '', h: '', d: '' }] })}>
              Add a size
            </button>
          </div>
        </fieldset>

        <div className="grid gap-5">
          <Area label="What they want" value={d.brief} onChange={(e) => save({ d: { ...d, brief: e.target.value } })} placeholder="e.g. Two wardrobes either side of the chimney, rail and shelves, panelled doors, top boxes to the ceiling" />
          <Area label="Options to show (optional)" value={d.options} onChange={(e) => save({ d: { ...d, options: e.target.value } })} placeholder="e.g. A: flat doors. B: panelled doors with a bridge over the chimney" />
          <label className="grid gap-1.5">
            <span className={label}>Customer’s mobile (optional, stays on this phone)</span>
            <input className={`${field} h-12 font-mono`} type="tel" inputMode="tel" autoComplete="off" value={d.mobile} onChange={(e) => save({ d: { ...d, mobile: e.target.value } })} placeholder="07…" />
            <span className="text-[13.5px] text-faint">So Send on WhatsApp opens their chat with the link typed in. It is never sent anywhere else.</span>
          </label>
        </div>

        <section>
          <h2 className="text-[19px] font-[650]">{DESIGN_IDEAS.title}</h2>
          <div className="mt-2">
            <SectionView section={DESIGN_IDEAS} job={job} items={live} busy={busy} onAdd={onAdd} onRemove={onRemove} onCaption={onCaption} />
          </div>
        </section>

        {st === 'ready' || st === 'updating' ? (
          <section className="rounded-sm border border-line-strong bg-mount p-4">
            <h2 className="text-[19px] font-[650]">Changes</h2>
            {d.changes.length ? (
              <ul className="mt-2 grid gap-1 text-[14.5px] text-muted">
                {d.changes.map((c) => (
                  <li key={c.at}>
                    <span className="font-mono text-[12.5px] text-faint">{when(c.at)}</span> {c.text}
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea className={`${field} mt-3 min-h-[76px] py-2.5 leading-snug`} value={change} onChange={(e) => setChange(e.target.value)} placeholder="e.g. Make it 1850 wide, add 3 drawers on the right, flat doors" aria-label="What to change" />
            <button
              type="button"
              className="btn btn-primary btn-sm mt-3 w-full disabled:opacity-45"
              disabled={!change.trim()}
              onClick={() => {
                const t = change.trim();
                setChange('');
                void flushAndSend(t);
              }}
            >
              Send changes
            </button>
            <p className="mt-1.5 font-mono text-[12px] text-faint">The same link updates, so the customer doesn’t need a new one.</p>
          </section>
        ) : (
          st === 'draft' ? (
            <button type="button" className="btn btn-primary w-full" onClick={() => void flushAndSend()}>
              Send for design
            </button>
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-sm border border-line-strong bg-mount py-3 font-mono text-[13.5px] text-muted">
              <Mark state="sending" /> Sent, the link appears at the top
            </p>
          )
        )}

        <div className="border-t border-line pt-4">
          <button type="button" className={`h-10 text-[14.5px] font-semibold ${sure ? 'text-ink underline' : 'text-muted'}`} onClick={() => (sure ? void onForget() : setSure(true))}>
            {sure ? 'Tap again to remove it from this phone' : 'Remove this request from the phone'}
          </button>
        </div>
      </div>
    </div>
  );
}
