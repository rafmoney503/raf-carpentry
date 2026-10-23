'use client';
/* Fitted wardrobe in the brief (Raf, 22 Oct 2026: one button, Fitted wardrobe, with how it's built inside it).
   WardrobeCard sits under 01 once Fitted wardrobe is ticked: Made to measure, IKEA PAX built in or Not sure yet, and
   the plan. WardrobeWindow is the planner itself, the same window for both ways of building, with a switch at the
   top: the wall and ceiling are the brief's Rough size, the drawing has every size, the steps change what's drawn.
   The brief keeps the plans and writes them into the message. Nothing here is saved anywhere. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { layout, newPlan, paxSummary, resolved, spaceProblem, type PaxPlan } from '@/lib/pax-brief';
import { mtoLayout, mtoResolved, mtoSpaceProblem, mtoSummary, newMto, type InsideKey, type MtoPlan } from '@/lib/wardrobe-brief';
import { PaxDrawing, PaxMini, PaxSteps, paxCards } from './pax-planner';
import { MtoDrawing, MtoMini, MtoSteps, mtoCards } from './mto-planner';
import { Legend, SizeCards, numBox } from './plan-parts';

export type Build = 'mto' | 'pax' | 'unsure';
export type WardrobeBrief = { build: Build | null; pax: PaxPlan | null; mto: MtoPlan | null };
type Size = { w: string; h: string; d: string };

const mmOf = (s: string) => parseInt(s || '0', 10) || 0;

/* Both plans as they stand for these sizes and what it's for (null until the sizes make sense). */
export function wardrobeNow(wb: WardrobeBrief, size: Size, uses: string[]) {
  const wall = mmOf(size.w);
  const ceiling = mmOf(size.h);
  return {
    wall,
    ceiling,
    pax: wb.pax && !spaceProblem(wall, ceiling) ? resolved(wb.pax, wall, uses) : null,
    mto: wb.mto && !mtoSpaceProblem(wall, ceiling) ? mtoResolved(wb.mto, wall, uses) : null,
  };
}

/* A plan for this way of building, made the first time the sizes make sense. */
export function withPlan(wb: WardrobeBrief, build: 'mto' | 'pax', size: Size): WardrobeBrief {
  const wall = mmOf(size.w);
  const ceiling = mmOf(size.h);
  if (build === 'pax' && !wb.pax && !spaceProblem(wall, ceiling)) return { ...wb, pax: newPlan(wall) };
  if (build === 'mto' && !wb.mto && !mtoSpaceProblem(wall, ceiling)) return { ...wb, mto: newMto(wall) };
  return wb;
}

export function WardrobeWindow({
  open,
  onClose,
  wb,
  setWb,
  size,
  setSize,
  uses,
  onInsidePicked,
}: {
  open: boolean;
  onClose: () => void;
  wb: WardrobeBrief;
  setWb: (fn: (w: WardrobeBrief) => WardrobeBrief) => void;
  size: Size;
  setSize: (fn: (s: Size) => Size) => void;
  uses: string[];
  onInsidePicked: (k: InsideKey) => void;
}) {
  const [sel, setSel] = useState(0);
  const [showInside, setShowInside] = useState(false);
  const [screen, setScreen] = useState({ phone: false, h: 800 });
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const read = () => setScreen({ phone: mq.matches, h: window.innerHeight });
    read();
    mq.addEventListener('change', read);
    window.addEventListener('resize', read);
    return () => {
      mq.removeEventListener('change', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  // Open: keep the page still behind it, focus the first empty size, Escape closes, Tab stays inside.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const empty = panel.current?.querySelector<HTMLInputElement>('input[data-pax-size]:placeholder-shown');
      (empty ?? panel.current?.querySelector<HTMLElement>('[data-pax-close]'))?.focus({ preventScroll: true });
    }, 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === 'Tab' && panel.current) {
        const f = Array.from(panel.current.querySelectorAll<HTMLElement>('button, input, [href]')).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (!f.length) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', key);
      html.style.overflow = before;
      (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const build: 'mto' | 'pax' = wb.build === 'pax' ? 'pax' : 'mto';
  const { wall, ceiling, pax, mto } = wardrobeNow(wb, size, uses);
  const bad = build === 'pax' ? spaceProblem(wall, ceiling) : mtoSpaceProblem(wall, ceiling);
  const setSpace = (k: 'w' | 'h', v: string) => {
    const clean = v.replace(/[^0-9]/g, '').slice(0, 5);
    const next = { ...size, [k]: clean };
    setSize((s) => ({ ...s, [k]: clean }));
    setWb((w) => withPlan(w, build, next));
  };
  const switchTo = (b: 'mto' | 'pax') => {
    setSel(0);
    setWb((w) => withPlan({ ...w, build: b }, b, size));
  };
  // Phone: a strip that stays at the top while the steps scroll. Bigger screens: the left column (sizes, drawing,
  // key) has to fit the window's scrolling part, or its bottom would be cut off.
  const maxH = screen.phone ? Math.round(Math.max(104, Math.min(172, screen.h * 0.22))) : Math.round(Math.max(220, Math.min(420, Math.min(screen.h * 0.94, 960) - 490)));
  const showIn = () => setShowInside(true);

  let drawing: React.ReactNode = null;
  let steps: React.ReactNode = null;
  let cards: [string, string][] = [];
  let problem = '';
  let warn = '';
  if (build === 'pax' && pax) {
    const g = layout(pax, wall, ceiling);
    const pick = Math.min(sel, Math.max(0, pax.units.length - 1));
    const change = (fn: (p: PaxPlan) => PaxPlan) => setWb((w) => ({ ...w, pax: fn(pax) }));
    drawing = <PaxDrawing plan={pax} wall={wall} ceiling={ceiling} sel={pick} onPick={setSel} showInside={showInside} maxH={maxH} />;
    steps = <PaxSteps now={pax} g={g} wall={wall} ceiling={ceiling} pick={pick} setSel={setSel} change={change} showInside={showIn} uses={uses} onInsidePicked={onInsidePicked} />;
    cards = paxCards(pax, g, wall, ceiling, pick);
    problem = g.problem;
    warn = g.warn;
  } else if (build === 'mto' && mto) {
    const g = mtoLayout(mto, wall, ceiling);
    const pick = Math.min(sel, Math.max(0, mto.widths.length - 1));
    const change = (fn: (p: MtoPlan) => MtoPlan) => setWb((w) => ({ ...w, mto: fn(mto) }));
    drawing = <MtoDrawing plan={mto} wall={wall} ceiling={ceiling} sel={pick} onPick={setSel} showInside={showInside} maxH={maxH} />;
    steps = <MtoSteps now={mto} g={g} wall={wall} ceiling={ceiling} pick={pick} setSel={setSel} change={change} showInside={showIn} uses={uses} onInsidePicked={onInsidePicked} />;
    cards = mtoCards(mto, g, wall, ceiling, pick);
    problem = g.problem;
    warn = g.warn;
  }
  const planned = Boolean(drawing);
  const status = planned ? problem || warn || 'It all fits. Rough sizes are fine: I measure properly on the free visit.' : bad || 'Type the wall width and the ceiling height to see it drawn.';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-ink/45 md:items-center md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pax-title"
        data-pax-window
        data-build={build}
        className="flex h-[100dvh] w-full flex-col bg-paper md:h-auto md:max-h-[min(94dvh,960px)] md:max-w-[1080px] md:rounded-sm md:border md:border-line-strong md:shadow-xl"
      >
        <header className="flex-none border-b border-line px-4 pb-3 pt-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[12px] text-accent">Fitted wardrobe</p>
              <h2 id="pax-title" className="font-display text-[21px] font-[650] leading-tight text-ink">{build === 'pax' ? 'Plan your PAX' : 'Plan your wardrobe'}</h2>
            </div>
            <button type="button" onClick={onClose} data-pax-close aria-label="Close and go back to the brief" className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" /></svg>
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-2 rounded-sm border border-line-strong bg-mount p-0.5" role="group" aria-label="How it's built">
            {(['mto', 'pax'] as const).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={build === b}
                data-pax={`build-${b}`}
                onClick={() => switchTo(b)}
                className="min-h-10 rounded-[2px] px-2 text-[14px] font-medium text-muted transition-colors hover:text-ink aria-pressed:bg-accent aria-pressed:text-on-accent"
              >
                {b === 'mto' ? 'Made to measure' : 'IKEA PAX built in'}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-pax-scroll>
          <div className="flex flex-col gap-5 px-4 pb-6 pt-4 md:grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] md:items-start md:gap-8 md:px-6 md:pt-5">
            {/* On a phone these become part of one column, so the drawing can stay at the top while the steps scroll under it. */}
            <div className="max-md:contents md:sticky md:top-0 md:self-start">
              <div>
                <p className="text-[14.5px] leading-snug text-muted">
                  {build === 'pax'
                    ? 'IKEA frames you buy, built in with my top boxes and fillers to the ceiling. Your wall and ceiling first.'
                    : 'MDF units made to your sizes, floor to ceiling. Your wall and ceiling first.'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="font-mono text-[12px] text-faint">Wall width, mm</span>
                    <input data-pax-size="w" className={`${numBox} mt-1`} inputMode="numeric" placeholder="2400" value={size.w} onChange={(e) => setSpace('w', e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[12px] text-faint">Ceiling height, mm</span>
                    <input data-pax-size="h" className={`${numBox} mt-1`} inputMode="numeric" placeholder="2400" value={size.h} onChange={(e) => setSpace('h', e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="z-10 -mx-4 border-b border-line bg-paper px-4 pb-2 pt-1 max-md:sticky max-md:top-0 md:mx-0 md:border-b-0 md:px-0">
                {planned ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[12px] text-faint">Your space, to scale<span className="max-sm:hidden">, in mm</span></p>
                      <button type="button" onClick={() => setShowInside((v) => !v)} aria-pressed={showInside} data-pax="inside-toggle" className="flex-none rounded-sm border border-line-strong bg-mount px-2.5 py-1.5 font-mono text-[12px] text-ink transition-colors hover:border-ink">
                        {showInside ? 'Show the doors' : 'Show the inside'}
                      </button>
                    </div>
                    <div className="mt-1">{drawing}</div>
                  </>
                ) : (
                  <div className="flex min-h-[140px] items-center justify-center rounded-sm border border-dashed border-line-strong bg-mount px-4 text-center text-[14.5px] leading-snug text-muted" role="status">
                    {bad || 'Type the wall width and the ceiling height to see it drawn.'}
                  </div>
                )}
              </div>

              {planned ? (
                <div>
                  <Legend ikea={build === 'pax'} />
                  <div className="md:hidden">
                    <SizeCards cards={cards} />
                  </div>
                </div>
              ) : null}
            </div>

            {planned ? (
              <div>
                <div className="mb-5 hidden md:block">
                  <SizeCards cards={cards} />
                </div>
                {steps}
                <p className="border-t border-line pt-4 text-[13.5px] leading-snug text-muted">
                  Rather leave it to the visit?{' '}
                  <button type="button" data-pax="remove-plan" onClick={() => { setWb((w) => ({ ...w, [build]: null })); onClose(); }} className="font-medium text-accent underline-offset-2 hover:underline">
                    Remove my plan
                  </button>{' '}
                  and it stays out of your message.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-none flex-col gap-2 border-t border-line bg-paper px-4 py-3 sm:flex-row sm:items-center md:px-6">
          <p className={`min-w-0 flex-1 text-[13.5px] leading-snug ${problem ? 'font-medium text-accent' : 'text-muted'}`} role="status" data-pax="status">
            {status}
          </p>
          <button type="button" data-pax="done" onClick={onClose} className="btn btn-primary w-full flex-none sm:w-auto">
            {planned ? 'Done, back to my brief' : 'Back to my brief'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- the card under 01 ---------- */

const BUILDS: { key: Build; title: string; sub: string; pic: React.ReactNode }[] = [
  {
    key: 'mto',
    title: 'Made to measure',
    sub: 'MDF units to your sizes, floor to ceiling. Standard or custom widths, my doors and drawers.',
    pic: <><rect x="4" y="2" width="40" height="34" /><path d="M4 7h40M4 32h40M17 7v25M31 7v25M14 18v4M20 18v4M34 18v4" /></>,
  },
  {
    key: 'pax',
    title: 'IKEA PAX built in',
    sub: 'IKEA frames you buy, built in with my top boxes and fillers to the ceiling.',
    pic: <><path d="M4 2h40v7H4z" strokeDasharray="2 1.5" /><rect x="7" y="9" width="16" height="27" /><rect x="25" y="9" width="16" height="27" /><path d="M4 9v27M44 9v27M21 20v4M27 20v4" /></>,
  },
  {
    key: 'unsure',
    title: 'Not sure yet',
    sub: 'I’ll suggest the better one for your room on the visit.',
    pic: <><rect x="4" y="2" width="40" height="34" strokeDasharray="3 2" /><path d="M20 14a4 4 0 1 1 5.5 3.7c-1.2.6-1.5 1.4-1.5 2.6M24 25v.5" /></>,
  },
];

/* With IKEA PAX built in, a box for the design code from IKEA's own PAX planner, for someone who has already
   designed it there (23 Oct 2026; the wardrobe planner has the same, src/app/wardrobe-planner/pax-send.tsx). */
export function WardrobeCard({
  wb,
  size,
  uses,
  onBuild,
  onOpen,
  code = '',
  onCode,
}: {
  wb: WardrobeBrief;
  size: Size;
  uses: string[];
  onBuild: (b: Build) => void;
  onOpen: () => void;
  code?: string;
  onCode?: (v: string) => void;
}) {
  const { wall, ceiling, pax, mto } = wardrobeNow(wb, size, uses);
  const plan = wb.build === 'pax' ? pax : wb.build === 'mto' ? mto : null;
  return (
    <div className="mt-4 rounded-sm border border-accent/40 bg-mount p-3" data-wardrobe-card>
      <p className="text-[15.5px] font-[620] text-ink">How should your wardrobe be built?</p>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-3" role="group" aria-label="How your wardrobe is built">
        {BUILDS.map((b) => (
          <button
            key={b.key}
            type="button"
            aria-pressed={wb.build === b.key}
            data-build-pick={b.key}
            onClick={() => onBuild(b.key)}
            className="flex items-start gap-3 rounded-sm border border-line-strong bg-paper p-2.5 text-left text-ink transition-colors hover:border-ink aria-pressed:border-accent aria-pressed:bg-accent/5 aria-pressed:ring-1 aria-pressed:ring-accent sm:flex-col sm:gap-1.5"
          >
            <svg width="48" height="38" viewBox="0 0 48 38" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" className="flex-none text-accent">
              {b.pic}
            </svg>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium leading-snug">{b.title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{b.sub}</span>
            </span>
          </button>
        ))}
      </div>
      {wb.build === 'mto' || wb.build === 'pax' ? (
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3" data-plan-row>
          {plan ? (
            wb.build === 'pax' ? <PaxMini plan={plan as PaxPlan} wall={wall} ceiling={ceiling} /> : <MtoMini plan={plan as MtoPlan} wall={wall} ceiling={ceiling} />
          ) : null}
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block font-mono text-[12px] text-accent">{plan ? 'Your plan' : wb.build === 'pax' ? 'Plan your PAX' : 'Plan your wardrobe'}</span>
            <span className="block text-[14px] font-medium text-ink" data-plan-summary>
              {plan
                ? wb.build === 'pax'
                  ? paxSummary(plan as PaxPlan, wall, ceiling)
                  : mtoSummary(plan as MtoPlan, wall, ceiling)
                : 'Optional. Your units in your space with every size, the doors and what goes inside.'}
            </span>
          </span>
          <button type="button" onClick={onOpen} data-pax="open" className="btn btn-ghost btn-sm flex-none">
            {plan ? 'Change it' : 'Plan it'}
          </button>
        </div>
      ) : null}
      {wb.build === 'pax' && onCode ? (
        <div className="mt-3 border-t border-line pt-3" data-ikea-code>
          <label htmlFor="brief-ikea-code" className="block text-[14px] font-medium leading-snug text-ink">
            Already designed it in IKEA’s PAX planner? <span className="font-normal text-muted">Add the design code.</span>
          </label>
          <input
            id="brief-ikea-code"
            value={code}
            onChange={(e) => onCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={400}
            placeholder="The code from IKEA"
            className="mt-2 h-11 w-full rounded-sm border border-line-strong bg-paper px-3 font-mono text-[16px] text-ink placeholder:font-sans placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-1.5 text-[12.5px] leading-snug text-faint">
            In IKEA’s planner press Finalise: the code is at the bottom of the page (a share link works too). Add screenshots of it with your photos in 10.
          </p>
        </div>
      ) : null}
      {wb.build === 'unsure' ? (
        <p className="mt-3 border-t border-line pt-3 text-[13.5px] leading-snug text-muted">
          Fine: I’ll suggest one on the visit.{' '}
          <button type="button" onClick={onOpen} data-pax="open" className="font-medium text-accent underline-offset-2 hover:underline">
            Plan it anyway
          </button>
        </p>
      ) : null}
    </div>
  );
}
