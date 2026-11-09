'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { graphPaper } from '@/app/how-it-works/sketches';
import type { LearnStep } from '@/lib/learn';
import GuideDrawing from './scenes';

/* A guide's steps, one at a time (9 Nov 2026, Raf: "moving graphic presentations"): the step's drawing acts it out
   on a 7 s loop (learn.css), with Back / Next, a number for each step, a swipe on the drawing, the arrow keys, Play
   all steps (one loop each, then the next), Watch again, and See all steps (every step with its drawing, one under
   another, for reading through or printing). #step-3 in the address opens on step 3. */

const LOOP = 7000;

export default function GuidePlayer({ slug, steps }: { slug: string; steps: LearnStep[] }) {
  const n = steps.length;
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0); // a new number replays the drawing
  const [auto, setAuto] = useState(false);
  const [all, setAll] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const show = (k: number, by: 'user' | 'auto' = 'user') => {
    const to = Math.max(0, Math.min(n - 1, k));
    setI(to);
    setRun((r) => r + 1);
    if (by === 'user') setAuto(false);
  };

  // #step-3 opens on step 3, on arrival and when a link on the page changes the address
  useEffect(() => {
    const fromHash = () => {
      const m = /^#step-(\d+)$/.exec(window.location.hash);
      if (!m) return;
      const k = Number(m[1]) - 1;
      if (k < 0 || k >= n) return;
      setI(k);
      setRun((r) => r + 1);
      setAuto(false);
      window.requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' }));
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [n]);

  // Play all steps: each step's drawing plays once, then the next one
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => {
      if (i < n - 1) show(i + 1, 'auto');
      else setAuto(false);
    }, LOOP);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, i, run, n]);

  const pick = (k: number) => {
    show(k);
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 64) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (all || (e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      show(i + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      show(i - 1);
    }
  };

  const s = steps[i];

  if (all) {
    return (
      <div data-guide-all>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-muted">All {n} steps</p>
          <button type="button" onClick={() => setAll(false)} className="font-mono text-[13px] text-accent underline underline-offset-4 hover:text-accent-hover">
            Back to one at a time
          </button>
        </div>
        <ol className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">
          {steps.map((st, k) => (
            <li key={st.title} id={`step-${k + 1}`} className="min-w-0 scroll-mt-24">
              <div className="mount">
                <div data-motion className="relative aspect-[36/22] overflow-hidden bg-paper text-ink" style={graphPaper}>
                  <GuideDrawing slug={slug} step={k} />
                </div>
              </div>
              <StepWords step={st} k={k} n={n} />
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10" onKeyDown={onKey} data-guide-player>
      <div ref={top} className="min-w-0 scroll-mt-20 lg:col-span-7">
        <div className="lg-mount">
          <div
            key={`${i}-${run}`}
            data-motion
            data-step={i + 1}
            className="relative aspect-[36/22] touch-pan-y select-none overflow-hidden bg-paper text-ink"
            style={graphPaper}
            onPointerDown={(e) => {
              swipe.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              const st = swipe.current;
              swipe.current = null;
              if (!st) return;
              const dx = e.clientX - st.x;
              if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(e.clientY - st.y) * 1.4) show(dx < 0 ? i + 1 : i - 1);
            }}
            onPointerCancel={() => {
              swipe.current = null;
            }}
          >
            <GuideDrawing slug={slug} step={i} />
            <span className="pointer-events-none absolute bottom-1.5 right-2.5 rounded-sm bg-paper/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent md:bottom-2.5 md:right-3.5 md:text-[12px]">
              Step {i + 1} of {n}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => show(i - 1)}
            disabled={i === 0}
            aria-label="Back a step"
            className="inline-flex h-11 flex-none items-center gap-1.5 rounded-sm border border-line-strong bg-mount px-3.5 text-[15px] font-medium text-ink transition-colors hover:border-ink disabled:opacity-35 disabled:hover:border-line-strong"
          >
            <span aria-hidden="true">‹</span>
            <span className="hidden sm:inline">Back</span>
          </button>
          <ol className="mx-auto grid min-w-0 max-w-[19rem] flex-1 auto-cols-fr grid-flow-col gap-1 sm:gap-1.5" aria-label="Steps">
            {steps.map((st, k) => (
              <li key={st.title}>
                <button
                  type="button"
                  onClick={() => show(k)}
                  aria-label={`Step ${k + 1}: ${st.title}`}
                  aria-current={k === i ? 'step' : undefined}
                  className={`h-11 w-full min-w-0 rounded-sm border font-mono text-[14px] transition-colors ${
                    k === i ? 'border-ink bg-ink text-on-accent' : k < i ? 'border-line-strong bg-mount text-accent hover:border-ink' : 'border-line-strong bg-mount text-muted hover:border-ink'
                  }`}
                >
                  {k + 1}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => (i === n - 1 ? show(0) : show(i + 1))}
            aria-label={i === n - 1 ? 'Start again from step 1' : 'Next step'}
            className="inline-flex h-11 flex-none items-center gap-1.5 rounded-sm bg-accent px-3.5 text-[15px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            data-next
          >
            <span className="hidden sm:inline">{i === n - 1 ? 'Start again' : 'Next'}</span>
            <span aria-hidden="true">{i === n - 1 ? '↺' : '›'}</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 font-mono text-[12.5px]">
          <button type="button" onClick={() => (auto ? setAuto(false) : (show(i === n - 1 ? 0 : i, 'auto'), setAuto(true)))} aria-pressed={auto} className="text-accent underline underline-offset-4 hover:text-accent-hover" data-play-all>
            {auto ? 'Stop playing' : 'Play all steps'}
          </button>
          <span className="flex gap-5">
            <button type="button" onClick={() => setRun((r) => r + 1)} className="text-muted underline underline-offset-4 hover:text-ink">
              Watch again
            </button>
            <button type="button" onClick={() => (setAuto(false), setAll(true))} className="text-muted underline underline-offset-4 hover:text-ink" data-see-all>
              See all steps
            </button>
          </span>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-5" aria-live="polite">
        <StepWords step={s} k={i} n={n} big />
        <ol className="mt-8 border-t border-line" aria-label="Every step">
          {steps.map((st, k) => (
            <li key={st.title} className="border-b border-line">
              <button
                type="button"
                onClick={() => pick(k)}
                aria-current={k === i ? 'step' : undefined}
                className={`flex w-full items-baseline gap-3 py-3 text-left text-[15.5px] transition-colors ${k === i ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
              >
                <span className={`w-6 flex-none font-mono text-[13px] ${k === i ? 'text-accent' : 'text-faint'}`}>{String(k + 1).padStart(2, '0')}</span>
                <span>{st.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StepWords({ step, k, n, big = false }: { step: LearnStep; k: number; n: number; big?: boolean }) {
  return (
    <div className={big ? '' : 'mt-4'} data-step-words>
      <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-accent">
        Step {k + 1} of {n}
      </p>
      <h3 className={`mt-1.5 font-display font-[650] leading-[1.12] tracking-[-0.015em] text-ink ${big ? 'text-[26px] md:text-[30px]' : 'text-[22px]'}`}>{step.title}</h3>
      <p className={`mt-3 max-w-[60ch] leading-relaxed text-muted ${big ? 'text-[17px]' : 'text-[16px]'}`}>{step.body}</p>
      {step.tip ? <p className="mt-3 max-w-[60ch] border-l-2 border-accent pl-3 text-[15.5px] leading-relaxed text-ink">{step.tip}</p> : null}
      {step.link ? (
        <Link href={step.link.href} className="link-more mt-3 inline-block text-[15px]">
          {step.link.label} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}
