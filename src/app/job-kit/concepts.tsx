'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConceptDrawing } from '@/components/ConceptDrawing';
import {
  COLOURS,
  conceptMessage,
  DEFAULT_COLOUR,
  MAX_H,
  MAX_W,
  money,
  MUST_IDEAS,
  newBrief,
  newCode,
  priceOption,
  rangeText,
  sizedPlan,
  type Brief,
  type ConceptEdits,
  type ConceptRow,
  type Plan,
} from '@/lib/concept-plan';
import { VAT, type Prices } from '@/lib/quote-sums';
import { SITE_URL } from '@/lib/seo';
import { field, label } from './parts';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';

/* Design with Claude (Raf, 3 Nov 2026: 'in jobkit i paste what client wants, then there is a small window where
   claude is ... creating design, and once design is created i can send email from jobkit from info@ and just attach
   created link'; mockups on the 'Job Kit, Design with Claude' design canvas, then 'build it').
   The brief (often filled in from a customer's email in the Inbox, with its photos) goes to Claude, which plans up to
   three options as a layout; they're drawn here to scale, front and inside, and priced from Raf's own price list.
   Raf can change the size, the colour, his price, or ask Claude for a change. Put online, the customer's page is
   rafcarpentry.com/ideas/<code>: no login, private to whoever has the link. Server: /api/job-kit/concept.
   On this phone: every design seen (raf_jobkit_concepts), so they open with no signal; a brief not yet drawn
   lives only here. */

const KEY = 'raf_jobkit_concepts';
const API = '/api/job-kit/concept';
export type Concepts = { rows: ConceptRow[]; at: number; error?: string };

const read = (): Concepts => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || 'null') as Concepts) ?? { rows: [], at: 0 };
  } catch {
    return { rows: [], at: 0 };
  }
};
const write = (c: Concepts) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...c, rows: c.rows.slice(0, 40) }));
  } catch {
    /* full or blocked: the next fetch brings them back */
  }
};
export const savedConcepts = read;
const localRow = (id: string) => read().rows.find((r) => r.id === id);
function keepRow(row: ConceptRow) {
  const c = read();
  write({ ...c, rows: [row, ...c.rows.filter((r) => r.id !== row.id)] });
}
function dropLocal(id: string) {
  const c = read();
  write({ ...c, rows: c.rows.filter((r) => r.id !== id) });
}

/* The store's list, with briefs not drawn yet (only on this phone) kept on top. */
export async function fetchConcepts(): Promise<Concepts> {
  const prev = read();
  const r = await post<{ concepts: ConceptRow[]; now: number }>(readPin(), { action: 'list' }, API);
  if (!r.ok) return { ...prev, error: r.error };
  const local = prev.rows.filter((x) => x.state === 'brief' && !r.data.concepts.some((y) => y.id === x.id));
  const next = { rows: [...local, ...r.data.concepts], at: Date.now() };
  write(next);
  return next;
}

/* A new design: a brief kept on this phone until it's drawn. Answers its code. */
export function startConcept(brief: Partial<Brief> = {}): string {
  const id = newCode((n) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  });
  keepRow({ id, state: 'brief', data: { brief: newBrief(brief) }, edits: null, editsAt: 0, updated: Date.now() });
  return id;
}

/* The customer's page: the live site's address, or this preview's while trying it out. */
const pageUrl = (id: string) => {
  const host = typeof location === 'undefined' ? '' : location.host;
  return `${/rafcarpentry\.com$/.test(host) || !host ? SITE_URL : location.origin}/ideas/${id}`;
};

const titleOf = (r: ConceptRow) => r.data?.plan?.title ?? (r.data?.brief.want.split(/[.\n]/)[0].slice(0, 40) || 'New design');
const whenOf = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const stateText = (r: ConceptRow) =>
  r.state === 'brief' ? 'Brief, not drawn yet' : r.state === 'working' ? 'Claude is drawing…' : r.state === 'failed' ? 'Couldn’t draw it' : r.edits?.live ? 'Online · link sent or ready' : 'Drawn · not online yet';

const Spark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5 L9.4 6.6 L14.5 8 L9.4 9.4 L8 14.5 L6.6 9.4 L1.5 8 L6.6 6.6 Z" />
  </svg>
);

/* ---------- on the Designs screen ---------- */

export function ConceptsBox({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const [c, setC] = useState<Concepts>(() => read());
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    void fetchConcepts().then((n) => {
      setC(n);
      setBusy(false);
    });
  }, []);
  return (
    <section className="jk-sec-designs mt-6 rounded-sm border border-line-strong bg-mount" aria-labelledby="concepts-h">
      <div className="jk-band-head flex items-center gap-2.5 px-3.5 py-2.5">
        <Spark className="h-5 w-5 jk-sec-ink" />
        <h2 id="concepts-h" className="font-mono text-[12.5px] uppercase tracking-[0.06em] jk-sec-ink">
          Design with Claude
        </h2>
        <span className="ml-auto font-mono text-[12px] text-faint">{busy ? 'Checking…' : `${c.rows.length} made`}</span>
      </div>
      <div className="p-3.5">
        <p className="text-[14.5px] leading-relaxed text-muted">Quick drawings in about a minute: paste what they want, Claude draws up to three options, priced from your list, with a private link to send.</p>
        <button type="button" onClick={onNew} className="btn mt-3 w-full bg-[var(--sec)] text-white hover:opacity-90">
          <Spark className="h-4 w-4" /> New design with Claude
        </button>
        {c.error ? <p className="mt-2 text-[13.5px] text-muted">{problemText(c.error)}</p> : null}
        {c.rows.length ? (
          <ul className="mt-3 divide-y divide-line">
            {c.rows.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {titleOf(r)}
                      {r.data?.brief.first ? <span className="font-normal text-muted"> · {r.data.brief.first}</span> : null}
                    </span>
                    <span className={`block text-[13.5px] ${r.state === 'failed' ? 'text-ink' : 'text-muted'}`}>{stateText(r)}</span>
                  </span>
                  <span className="font-mono text-[12px] text-faint">{whenOf(r.updated)}</span>
                  <span aria-hidden className="text-[18px] jk-sec-ink">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- one design ---------- */

export function ConceptView({ id, prices, onEmail, onClose }: { id: string; prices: Prices; onEmail: (mail: string, text: string) => void; onClose: () => void }) {
  const [row, setRow] = useState<ConceptRow | null>(() => localRow(id) ?? null);
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(!localRow(id));
  const [editingBrief, setEditingBrief] = useState(false);
  const rowRef = useRef(row);
  useEffect(() => {
    rowRef.current = row;
  }, [row]);

  const refresh = useCallback(async () => {
    const r = await post<{ concept: ConceptRow | null }>(readPin(), { action: 'get', id }, API);
    setLoading(false);
    if (!r.ok) return setProblem(problemText(r.error));
    setProblem('');
    if (!r.data.concept) return; // only on this phone so far (a brief)
    const cur = rowRef.current;
    // Raf's latest changes on this phone win until the store has them
    const edits = cur && cur.editsAt > r.data.concept.editsAt ? cur.edits : r.data.concept.edits;
    const editsAt = Math.max(cur?.editsAt ?? 0, r.data.concept.editsAt);
    const next = { ...r.data.concept, edits, editsAt };
    setRow(next);
    keepRow(next);
  }, [id]);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);
  // while Claude draws: ask every 4 seconds, and when the app comes back on screen
  const working = row?.state === 'working';
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void refresh(), 4000);
    const vis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [working, refresh]);

  const draw = async (brief: Brief, note = '') => {
    setProblem('');
    const prev = rowRef.current;
    const next: ConceptRow = { id, state: 'working', data: { ...(prev?.data ?? {}), brief }, edits: prev?.edits ?? null, editsAt: prev?.editsAt ?? 0, claimed: Date.now(), updated: Date.now() };
    setRow(next);
    keepRow(next);
    setEditingBrief(false);
    const r = await post<{ state: string }>(readPin(), { action: 'draw', id, brief, note }, API);
    if (!r.ok) {
      const back = prev ?? { ...next, state: 'brief' as const };
      setRow(back);
      keepRow(back);
      setProblem(r.error === 'concepts-not-set-up' ? 'Design with Claude isn’t switched on here: it needs ANTHROPIC_API_KEY and JOBKIT_SYNC_SECRET in Vercel.' : r.error === 'no-text' ? 'Write what they want, or give a size, first.' : problemText(r.error, r.detail));
      return;
    }
    window.setTimeout(() => void refresh(), 2500);
  };

  // Raf's changes: on the screen at once, kept on the phone, then in the store (the later change wins)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const change = (patch: Partial<ConceptEdits>) => {
    const cur = rowRef.current;
    if (!cur) return;
    const at = Date.now();
    const next = { ...cur, edits: { ...(cur.edits ?? {}), ...patch }, editsAt: at, updated: at };
    setRow(next);
    keepRow(next);
    if (cur.state === 'brief') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const r = rowRef.current;
      if (!r?.edits) return;
      void post(readPin(), { action: 'edit', id, edits: r.edits, at: r.editsAt }, API).then((res) => {
        if (!res.ok) setProblem(`Not saved yet: ${problemText(res.error)}`);
        else setProblem('');
      });
    }, 'live' in patch ? 0 : 700);
  };

  if (!row) {
    return (
      <div className="pt-7">
        <p className="text-[15px] text-muted">{loading ? 'Opening the design…' : problem || 'This design isn’t on this phone or in the store.'}</p>
      </div>
    );
  }
  const brief = row.data?.brief ?? newBrief();
  const plan = row.data?.plan;
  const showBrief = !plan || editingBrief || row.state === 'brief';
  return (
    <div className="pt-7">
      <p className="kicker jk-sec-ink">Design with Claude{row.data?.at ? ` · drawn ${whenOf(row.data.at)}` : ''}</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-[32px] font-[680] leading-[1.04] tracking-[-0.025em]">
        <Spark className="h-[28px] w-[28px] shrink-0 jk-sec-ink" />
        <span className="min-w-0">
          {plan?.title ?? 'New design'}
          {brief.first ? <span className="text-muted"> for {brief.first}</span> : null}
        </span>
      </h1>
      {problem ? (
        <p role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem}
        </p>
      ) : null}
      {row.state === 'working' ? <Working redraw={Boolean(plan)} since={row.claimed ?? row.updated} /> : null}
      {row.state === 'failed' && !plan ? (
        <p role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problemText(row.data?.error === 'no-text' ? 'ai-error' : row.data?.error, row.data?.error === 'no-text' ? 'nothing to go on' : row.data?.detail)}
        </p>
      ) : null}
      {plan && row.data?.error && row.state === 'ready' ? (
        <p className="mt-4 rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[14px] leading-relaxed text-muted">The last change didn’t go through ({problemText(row.data.error, row.data.detail)}), so this is the drawing before it.</p>
      ) : null}
      {plan && !editingBrief && row.state !== 'brief' ? (
        <Result row={row} plan={plan} prices={prices} working={row.state === 'working'} onChange={change} onRedraw={(note) => void draw(brief, note)} onBrief={() => setEditingBrief(true)} onEmail={onEmail} />
      ) : null}
      {showBrief && row.state !== 'working' ? (
        <BriefForm
          key={id}
          brief={brief}
          drawn={Boolean(plan)}
          onDraw={(b) => void draw(b)}
          onKeep={(b) => {
            const next = { ...row, data: { ...(row.data ?? {}), brief: b }, updated: Date.now() };
            setRow(next);
            keepRow(next);
          }}
          onCancel={plan ? () => setEditingBrief(false) : undefined}
          onDrop={
            row.state === 'brief'
              ? () => {
                  dropLocal(id);
                  onClose();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function Working({ redraw, since }: { redraw: boolean; since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return (
    <div role="status" className="jk-sec-designs mt-5 flex items-center gap-3 rounded-sm border border-line-strong bg-mount px-4 py-4">
      <svg viewBox="0 0 24 24" className="jk-spin h-6 w-6 shrink-0 jk-sec-ink" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <path d="M12 3 a9 9 0 1 1 -9 9" />
      </svg>
      <span className="text-[15px] leading-snug">
        <b className="font-semibold">{redraw ? 'Claude is making the change…' : 'Claude is drawing it…'}</b>
        <span className="block text-[13.5px] text-muted">
          {s < 100 ? `About a minute · ${s} s so far.` : 'Taking longer than usual.'} You can leave this screen: it carries on and shows here when it’s done.
        </span>
      </span>
    </div>
  );
}

/* ---------- the brief ---------- */

function Chips({ items, on, onToggle, onAdd, addLabel }: { items: string[]; on: string[]; onToggle: (s: string) => void; onAdd: (s: string) => void; addLabel: string }) {
  const [adding, setAdding] = useState('');
  const all = [...on.filter((x) => !items.includes(x)), ...items];
  const add = () => {
    const v = adding.trim();
    if (v) onAdd(v.slice(0, 60));
    setAdding('');
  };
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((x) => {
        const pressed = on.includes(x);
        return (
          <button
            key={x}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(x)}
            className={`min-h-9 rounded-full border px-3 text-[14px] font-medium ${pressed ? 'border-[var(--sec)] bg-[var(--sec-soft)] jk-sec-ink' : 'border-line-strong bg-mount text-muted'}`}
          >
            {pressed ? '✓ ' : ''}
            {x}
          </button>
        );
      })}
      {/* not a form: this sits inside the brief's form, and Enter here mustn't send the brief */}
      <span className="flex items-center gap-1">
        <input
          aria-label={addLabel}
          value={adding}
          maxLength={60}
          placeholder={addLabel}
          enterKeyHint="done"
          onChange={(e) => setAdding(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            add();
          }}
          className={`${field} h-9 w-[150px] rounded-full text-[14px]`}
        />
      </span>
    </div>
  );
}

function BriefForm({ brief, drawn, onDraw, onKeep, onCancel, onDrop }: { brief: Brief; drawn: boolean; onDraw: (b: Brief) => void; onKeep: (b: Brief) => void; onCancel?: () => void; onDrop?: () => void }) {
  const [b, setB] = useState<Brief>(brief);
  const set = (patch: Partial<Brief>) =>
    setB((cur) => {
      const next = { ...cur, ...patch };
      onKeep(next);
      return next;
    });
  const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const styleIdeas = ['Open dresser', 'Larder wall', 'Shaker with niche', 'Flat doors floor to ceiling', 'Doors below, open above'];
  const can = Boolean(b.want.trim() || b.width || (b.photos ?? []).length);
  return (
    // not a form, so the keyboard's Go in a box doesn't send it to Claude half written
    <div className="mt-5 grid gap-4">
      <p className="text-[15px] leading-relaxed text-muted">{b.mail ? 'Filled in from their email. Change anything, then draw.' : 'Paste what they want, add the sizes you know, then draw.'}</p>
      <label className="grid gap-1.5">
        <span className={label}>What they want</span>
        <textarea className={`${field} min-h-[150px] py-2.5 text-[15.5px] leading-relaxed`} value={b.want} maxLength={3000} placeholder="Paste their message, or say it in your words" onChange={(e) => set({ want: e.target.value })} />
      </label>
      {b.mail ? (
        <p className="text-[14px] text-muted">
          {(b.photos ?? []).length ? `${(b.photos ?? []).length} photo${(b.photos ?? []).length === 1 ? '' : 's'} from their email go with it.` : 'Their email has no photos.'}
        </p>
      ) : null}
      <label className="grid gap-1.5">
        <span className={label}>Their first name</span>
        <input className={`${field} h-11`} value={b.first} maxLength={40} onChange={(e) => set({ first: e.target.value })} />
      </label>
      <fieldset className="grid gap-2">
        <legend className={label}>Sizes in mm</legend>
        <div className="grid grid-cols-3 gap-2.5">
          {(
            [
              ['width', 'Width'],
              ['height', 'Height'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="grid gap-1 text-[13px] text-muted">
              {l}
              <input inputMode="numeric" className={`${field} h-11 font-mono`} value={b[k] || ''} onChange={(e) => set({ [k]: Math.min(12000, Number(e.target.value.replace(/\D/g, '')) || 0) } as Partial<Brief>)} />
            </label>
          ))}
          <label className="grid gap-1 text-[13px] text-muted">
            Depth
            <input className={`${field} h-11 font-mono`} value={b.depth} maxLength={30} placeholder="varies" onChange={(e) => set({ depth: e.target.value })} />
          </label>
        </div>
        <label className="grid gap-1 text-[13px] text-muted">
          Other sizes and things to know
          <input className={`${field} h-11 text-[15px]`} value={b.other} maxLength={600} placeholder="e.g. left end 1250 high under a boxing" onChange={(e) => set({ other: e.target.value })} />
        </label>
      </fieldset>
      <div className="grid gap-2">
        <span className={label}>Must have</span>
        <Chips items={MUST_IDEAS} on={b.must} onToggle={(x) => set({ must: toggle(b.must, x) })} onAdd={(x) => set({ must: [...b.must.filter((y) => y !== x), x] })} addLabel="+ Add your own" />
      </div>
      <div className="grid gap-2">
        <span className={label}>Options</span>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="How many options">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" aria-pressed={b.count === n} onClick={() => set({ count: n, styles: b.styles.slice(0, n) })} className={`h-11 rounded-sm border font-mono text-[16px] ${b.count === n ? 'border-[var(--sec)] bg-[var(--sec)] text-white' : 'border-line-strong bg-mount'}`}>
              {n}
            </button>
          ))}
        </div>
        <Chips items={styleIdeas} on={b.styles} onToggle={(x) => set({ styles: toggle(b.styles, x).slice(0, b.count) })} onAdd={(x) => set({ styles: [...b.styles.filter((y) => y !== x), x].slice(-b.count) })} addLabel="+ A style" />
        <p className="text-[13.5px] text-muted">{b.styles.length ? `One option each for ${b.styles.join(', ')}${b.styles.length < b.count ? '; Claude picks the rest' : ''}.` : 'No styles picked: Claude picks them.'}</p>
      </div>
      <button type="button" disabled={!can} onClick={() => can && onDraw(b)} className="btn w-full bg-[var(--sec)] text-white hover:opacity-90 disabled:opacity-50">
        <Spark className="h-4 w-4" /> {drawn ? 'Draw it again from this brief' : `Draw ${b.count === 1 ? 'it' : `${b.count} options`}`}
      </button>
      <p className="text-center text-[13px] leading-relaxed text-muted">
        About a minute, pence on your Claude credit. The prices come from your price list, never from Claude.
        <br />
        Their first name, these words and the photos go to Claude; phone numbers, emails and addresses are taken out.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-10 text-[14.5px] text-muted underline">
            Back to the drawing
          </button>
        ) : null}
        {onDrop ? (
          <button type="button" onClick={onDrop} className="h-10 text-[14.5px] text-muted underline">
            Throw this brief away
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- the drawing, prices and the link ---------- */

function Result({
  row,
  plan: raw,
  prices,
  working,
  onChange,
  onRedraw,
  onBrief,
  onEmail,
}: {
  row: ConceptRow;
  plan: Plan;
  prices: Prices;
  working: boolean;
  onChange: (e: Partial<ConceptEdits>) => void;
  onRedraw: (note: string) => void;
  onBrief: () => void;
  onEmail: (mail: string, text: string) => void;
}) {
  const edits = useMemo(() => row.edits ?? {}, [row.edits]);
  const plan = useMemo(() => sizedPlan(raw, edits), [raw, edits]);
  const [opt, setOpt] = useState(() => Math.max(0, plan.options.findIndex((o) => o.pick)));
  const [view, setView] = useState<'front' | 'inside'>('front');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState('');
  const o = plan.options[Math.min(opt, plan.options.length - 1)];
  const i = plan.options.indexOf(o);
  const own = edits.own?.[String(i)];
  const pr = priceOption(o, prices, plan.stripOut, own);
  const colour = edits.colour ?? DEFAULT_COLOUR;
  const link = pageUrl(row.id);
  const first = row.data?.brief.first ?? '';
  const message = conceptMessage(plan, edits, prices, link, first);
  const mail = row.data?.brief.mail;
  const hide = edits.hide ?? [];
  const labels = o.bays.flatMap((b, bi) => b.sections.filter((s) => s.label).map((s) => ({ bay: bi + 1, text: s.label as string })));
  const copy = (what: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(what);
        setTimeout(() => setCopied(''), 2000);
      },
      () => setCopied(''),
    );
  };
  return (
    <div className={`mt-5 grid gap-4 ${working ? 'opacity-60' : ''}`}>
      {plan.seen ? <p className="rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[14px] leading-relaxed text-muted">{plan.seen}</p> : null}
      {plan.options.length > 1 ? (
        <div className={`grid gap-1.5 ${plan.options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} role="group" aria-label="Options">
          {plan.options.map((x, k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === i}
              onClick={() => setOpt(k)}
              className={`flex min-h-14 flex-col items-start justify-center rounded-sm border px-2.5 py-1.5 text-left ${k === i ? 'border-[var(--sec)] bg-[var(--sec)] text-white' : 'border-line-strong bg-mount'}`}
            >
              <span className="font-mono text-[11px] opacity-85">
                Option {k + 1}
                {x.pick ? ' · pick' : ''}
              </span>
              <span className="text-[14px] font-semibold leading-tight">{x.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-sm border border-line-strong" role="group" aria-label="View">
          {(['front', 'inside'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-10 px-4 text-[14px] font-medium ${view === v ? 'bg-[var(--sec)] text-white' : 'bg-mount'} ${v === 'inside' ? 'border-l border-line-strong' : ''}`}>
              {v === 'front' ? 'Front' : 'Inside'}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-muted">{view === 'front' ? 'Doors closed' : 'Doors off'}</span>
      </div>
      <div className="rounded-sm border border-line bg-white p-2.5">
        <ConceptDrawing option={o} width={plan.width} height={plan.height} view={view} colour={colour} uid={`jk${i}${view[0]}`} />
      </div>
      <p className="text-[15px] leading-relaxed">
        <b className="font-semibold">{o.name}</b> · {o.summary}
        {o.pick && o.why ? <span className="block font-medium jk-sec-ink">Claude’s pick: {o.why}</span> : null}
      </p>
      {labels.length ? (
        <ul className="grid gap-1 text-[14px] leading-snug text-muted">
          {labels.map((l, k) => (
            <li key={k}>
              <span className="font-mono text-[12px] text-faint">Bay {l.bay} · </span>
              {l.text}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="rounded-sm border border-line-strong bg-mount p-3.5" aria-labelledby="cp-price">
        <h2 id="cp-price" className={label}>
          Price · from your price list
        </h2>
        <p className="mt-1.5 font-mono text-[22px] leading-tight">
          {rangeText(pr)} <span className="text-[14px] text-muted">+ VAT</span>
        </p>
        <p className="text-[13px] text-muted">
          {money(pr.low * (1 + VAT))} – {money(pr.high * (1 + VAT))} with VAT · {pr.own ? `your price ${money(pr.total)}` : `worked out at ${money(pr.worked)}`}
        </p>
        <ul className="mt-2.5 grid gap-1 text-[13.5px] text-muted">
          {pr.lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-3">
              <span>{l.label}</span>
              <span className="font-mono">{money(l.amount)}</span>
            </li>
          ))}
        </ul>
        <label className="mt-3 grid gap-1 text-[13px] text-muted">
          Your price for this option (optional, before VAT)
          <input
            inputMode="numeric"
            className={`${field} h-11 font-mono`}
            value={own ? String(own) : ''}
            placeholder={String(pr.worked)}
            onChange={(e) => {
              const v = Number(e.target.value.replace(/\D/g, '')) || 0;
              const next = { ...(edits.own ?? {}) };
              if (v) next[String(i)] = Math.min(v, 999999);
              else delete next[String(i)];
              onChange({ own: next });
            }}
          />
        </label>
      </section>

      <section className="rounded-sm border border-line-strong bg-mount p-3.5" aria-labelledby="cp-size">
        <h2 id="cp-size" className={label}>
          Size and colour
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          <label className="grid gap-1 text-[13px] text-muted">
            Width
            <SizeBox key={plan.width} value={plan.width} max={MAX_W} onSet={(v) => onChange({ width: v })} />
          </label>
          <label className="grid gap-1 text-[13px] text-muted">
            Height
            <SizeBox key={plan.height} value={plan.height} max={MAX_H} onSet={(v) => onChange({ height: v })} />
          </label>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">A new size stretches the drawing and the prices straight away; no Claude needed.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Door colour">
          {COLOURS.map((c) => (
            <button key={c.hex} type="button" aria-pressed={colour === c.hex} onClick={() => onChange({ colour: c.hex })} className={`flex h-10 items-center gap-2 rounded-full border px-3 text-[13.5px] ${colour === c.hex ? 'border-ink' : 'border-line-strong'} bg-mount`}>
              <span aria-hidden className="h-5 w-5 rounded-full border border-line-strong" style={{ background: c.hex }} />
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-line-strong bg-mount p-3.5" aria-labelledby="cp-change">
        <h2 id="cp-change" className={label}>
          Change something
        </h2>
        <form
          className="mt-2 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) {
              onRedraw(note.trim());
              setNote('');
            }
          }}
        >
          <label className="grid gap-1 text-[13px] text-muted">
            Tell Claude what to change
            <input className={`${field} h-11 text-[15px]`} value={note} maxLength={800} placeholder="e.g. make the broom cupboard narrower" onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!note.trim() || working} className="btn btn-ghost btn-sm">
              <Spark className="h-4 w-4" /> Redraw
            </button>
            <button type="button" onClick={onBrief} className="h-10 text-[14px] text-muted underline">
              Change the brief
            </button>
          </div>
        </form>
      </section>

      <section className="jk-sec-designs rounded-sm border-2 border-[var(--sec)] bg-mount p-3.5" aria-labelledby="cp-page">
        <h2 id="cp-page" className="font-mono text-[12.5px] uppercase tracking-[0.06em] jk-sec-ink">
          Their page
        </h2>
        {edits.live ? (
          <>
            <p className="mt-2 flex items-center gap-2 rounded-sm border border-line-strong bg-white px-3 py-2.5 font-mono text-[14px] [overflow-wrap:anywhere]">{link.replace(/^https?:\/\//, '')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy('link', link)} className="btn btn-ghost btn-sm">
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </button>
              <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                Open their page
              </a>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">Private: only people with this link can open it. No login, no Claude account.</p>
          </>
        ) : (
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">Put it online to get a private link: no login, no Claude account. Nobody sees it until you do.</p>
        )}
        <fieldset className="mt-3 grid gap-0.5">
          <legend className="sr-only">What their page shows</legend>
          {plan.options.map((x, k) => (
            <label key={k} className="flex min-h-10 items-center gap-2.5 text-[14.5px]">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--sec)]"
                checked={!hide.includes(k)}
                disabled={!hide.includes(k) && plan.options.length - hide.length <= 1}
                onChange={(e) => onChange({ hide: e.target.checked ? hide.filter((h) => h !== k) : [...hide, k] })}
              />
              Option {k + 1} · {x.name}
              {x.pick ? ' (pick)' : ''}
            </label>
          ))}
          <label className="flex min-h-10 items-center gap-2.5 border-t border-line pt-1 text-[14.5px]">
            <input type="checkbox" className="h-5 w-5 accent-[var(--sec)]" checked={edits.prices !== false} onChange={(e) => onChange({ prices: e.target.checked })} />
            Show the prices
          </label>
          <label className="flex min-h-10 items-center gap-2.5 text-[14.5px]">
            <input type="checkbox" className="h-5 w-5 accent-[var(--sec)]" checked={edits.inside !== false} onChange={(e) => onChange({ inside: e.target.checked })} />
            Show the inside view
          </label>
        </fieldset>
        {edits.live ? (
          <div className="mt-3 grid gap-2">
            {mail ? (
              <button type="button" onClick={() => onEmail(mail, message)} className="btn btn-primary w-full">
                Email it from info@
              </button>
            ) : (
              <button type="button" onClick={() => copy('message', message)} className="btn btn-primary w-full">
                {copied === 'message' ? 'Copied: paste it in your email' : 'Copy the email'}
              </button>
            )}
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn w-full bg-[#25d366] text-[#0b2e18] hover:bg-[#1ebe5d]">
              Send on WhatsApp
            </a>
            <button type="button" onClick={() => onChange({ live: false })} className="h-10 text-[14px] text-muted underline">
              Take their page down
            </button>
          </div>
        ) : (
          <button type="button" disabled={working} onClick={() => onChange({ live: true, liveAt: Date.now() })} className="btn mt-3 w-full bg-[var(--sec)] text-white hover:opacity-90">
            Put it online and get the link
          </button>
        )}
        <details className="mt-3">
          <summary className="min-h-10 cursor-pointer py-2 text-[14px] font-semibold">The email it writes</summary>
          <p className="whitespace-pre-line rounded-sm border border-line bg-white px-3 py-2.5 text-[14px] leading-relaxed">{message}</p>
          <p className="mt-1.5 text-[12.5px] text-muted">{mail ? 'Email it puts this in the reply to their email; change anything before you press Send.' : 'Copy it into your email or ServiceM8.'}</p>
        </details>
      </section>
    </div>
  );
}

function SizeBox({ value, max, onSet }: { value: number; max: number; onSet: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  const done = () => {
    const n = Number(v.replace(/\D/g, ''));
    if (n >= 300 && n <= max && n !== value) onSet(n);
    else setV(String(value));
  };
  return <input inputMode="numeric" className={`${field} h-11 font-mono`} value={v} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />;
}
