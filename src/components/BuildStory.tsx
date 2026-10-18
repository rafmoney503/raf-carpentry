'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { BuildStoryScene } from '@/lib/build-story-scene';
import PlannerClip from '@/components/PlannerClip';
import { PLANNER_CLIP_SQUARE, PLANNER_IMAGE_SQUARE } from '@/lib/planner-picture';
import './build-story.css';

/* Home page, "Nothing gets cut until you've seen it": one wardrobe goes through Survey, Draw, Build and Fit in 3D while
   the page scrolls. The section stays pinned for about three screens of scrolling; the step it is on lights up on the
   left with a blue bar that fills as it plays. three.js (src/lib/build-story-scene.ts) loads only when the section is
   close, and draws only while it is on screen and something has moved.
   Without WebGL the SketchUp drawing from home.json stays in the box and the steps still follow the scroll. With
   reduced motion, or on a screen too short to pin (a phone on its side), it is a normal section showing the finished
   wardrobe and every step. The buttons sit under the pinned part on phones, clear of the floating buttons.
   A "Keep scrolling to see it built" tag sits under the steps (18 Oct 2026, Raf: under 04 Fit, bigger, and kept until
   Fit is reached), so a pinned page never looks stuck. It shows while Survey, Draw or Build is playing and fades once
   Fit starts (back again if they scroll up); its space is kept so nothing jumps. Never in the still layout.
   At Fit the tag's place becomes a small picture of the wardrobe planner that opens it (18 Oct 2026, Raf: 'show button
   Try it yourself and redirect to wardrobe planner page', then, as that doubled the button under it, 'in button Plan
   yours in 3D put try it yourself label and instead of black button put graphic miniature with redirect'): the
   planner's own 3D still with its door loop playing (only once Fit is reached), 'Free planner / Plan your wardrobe
   in 3D'. The two share one grid cell, so swapping them moves nothing. The ghost button beside Get a quote went the
   same way, so it was taken out (Raf: 'we have doubled the redirection ... maybe remove this button'); Get a quote
   stands alone, and the card shows in the still layout too so the planner is always one tap away. */

type Step = { title: string; description: string };
type Props = {
  heading: string;
  steps: Step[];
  fallback: { src: string; alt: string; caption: string };
  plannerHref: string;
  quoteHref: string;
  /** More links, shown under the story. */
  children?: ReactNode;
};

const CAPS = ['Survey: the alcove, measured', 'Draw: the 3D drawing, to sign off', 'Build: cut to the drawing', 'Fit: scribed and finished'];
const STILL = '(prefers-reduced-motion: reduce), (max-height: 560px)';
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/* The last three words in the accent colour, like the hero's title. */
function splitHeading(h: string): [string, string] {
  const w = h.trim().split(/\s+/);
  if (w.length < 6) return [h, ''];
  return [w.slice(0, -3).join(' '), w.slice(-3).join(' ')];
}

export default function BuildStory({ heading, steps, fallback, plannerHref, quoteHref, children }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stamp = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  const [ready, setReady] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const el = track.current, box = stage.current, cv = canvas.current, pinEl = pin.current;
    if (!el || !box || !cv || !pinEl) return;
    const mq = window.matchMedia(STILL);
    const n = Math.max(1, steps.length);
    let scene: BuildStoryScene | null = null;
    let loading = false, disposed = false, visible = false, raf = 0, last = 0;
    let isStill = mq.matches;
    let target = isStill ? 1 : 0, shown = target, drawn = -1;
    let curIdx = 0, curPhase = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let dirty = true;

    const bars = () => Array.from(list.current?.querySelectorAll<HTMLElement>('.bs-bar') ?? []);

    const progress = () => {
      if (isStill) return 1;
      const r = el.getBoundingClientRect();
      const head = parseFloat(getComputedStyle(pinEl).top) || 0;
      const span = Math.max(1, r.height - (window.innerHeight - head));
      return clamp((head - r.top) / span / 0.94);
    };

    const paint = (p: number) => {
      // the steps on the left
      const i = Math.min(n - 1, Math.floor(p * n * 0.9999));
      if (i !== curIdx) { curIdx = i; setIdx(i); }
      bars().forEach((b, k) => {
        const f = isStill ? 1 : k < i ? 1 : k > i ? 0 : clamp(p * n - k);
        b.style.transform = `scaleY(${f.toFixed(3)})`;
      });
      const ph = Math.min(3, Math.floor(p * 4 * 0.9999));
      if (ph !== curPhase) { curPhase = ph; setPhase(ph); }
      // the 3D, only when something moved
      if (scene && (dirty || Math.abs(p - drawn) > 0.00005 || Math.abs(mouse.tx - mouse.x) > 0.001 || Math.abs(mouse.ty - mouse.y) > 0.001)) {
        scene.frame(p, mouse.x, mouse.y);
        drawn = p;
        dirty = false;
      }
    };

    const manual = !!(window as unknown as { __bsManual?: boolean }).__bsManual;
    const step = (dt: number) => {
      target = progress();
      shown += (target - shown) * (1 - Math.exp(-dt * 6));
      if (Math.abs(target - shown) < 0.0005) shown = target;
      mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 4));
      mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 4));
      paint(shown);
    };
    const tick = (now: number) => {
      step(Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = visible && !isStill ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (!raf && !manual && visible && !isStill && !disposed) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };

    const layout = () => {
      const r = box.getBoundingClientRect();
      scene?.resize(r.width, r.height);
      dirty = true;
    };

    function load() {
      if (loading) return;
      loading = true;
      import('@/lib/build-story-scene')
        .then(({ createBuildStory }) => {
          if (disposed) return;
          scene = createBuildStory(cv!, box!, stamp.current);
          if (!scene) return;
          layout();
          shown = target = progress();
          scene.frame(shown, 0, 0);
          drawn = shown;
          dirty = false;
          setReady(true);
          wake();
        })
        .catch(() => {});
    }

    const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); near.disconnect(); } }, { rootMargin: '900px 0px' });
    const seen = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible) wake();
    });
    near.observe(el);
    seen.observe(el);
    const ro = new ResizeObserver(() => {
      layout();
      if (scene && !raf) { scene.frame(isStill ? 1 : shown, 0, 0); drawn = shown; }
    });
    ro.observe(box);

    const onMode = () => {
      isStill = mq.matches;
      setStill(isStill);
      shown = target = progress();
      dirty = true;
      paint(shown);
      wake();
    };
    mq.addEventListener('change', onMode);
    onMode();

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = box.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const leave = () => { mouse.tx = 0; mouse.ty = 0; };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerleave', leave);

    // frame by frame, for recording: with window.__bsManual set before the page loads, nothing moves by itself and
    // window.__bsTick(ms) advances the story by ms
    const w = window as unknown as { __bsTick?: (ms: number) => void; __bsReady?: () => boolean };
    w.__bsTick = (ms: number) => step(ms / 1000);
    w.__bsReady = () => !!scene;

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      near.disconnect(); seen.disconnect(); ro.disconnect();
      mq.removeEventListener('change', onMode);
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerleave', leave);
      delete w.__bsTick; delete w.__bsReady;
      scene?.dispose();
      scene = null;
    };
  }, [steps.length]);

  const [lead, accent] = splitHeading(heading);
  // the planner card shows at Fit, and always in the still layout (which shows the finished wardrobe)
  const atFit = still || idx === steps.length - 1;
  const ctas = (
    <>
      <Link className="btn btn-primary" href={quoteHref}>Get a quote</Link>
    </>
  );

  return (
    <section className={`bs${still ? ' bs-still' : ''}`} id="process" aria-labelledby="bs-title">
      <div className="bs-track" ref={track}>
        <div className="bs-pin" ref={pin}>
          <div className="wrap bs-grid">
            <div className="bs-copy">
              <h2 className="h2" id="bs-title">
                {lead}
                {accent ? <> <em>{accent}</em></> : null}
              </h2>
              <ol className="bs-steps" ref={list}>
                {steps.map((s, i) => (
                  <li key={s.title} className={`bs-step${i === idx ? ' on' : ''}`} aria-current={i === idx && !still ? 'step' : undefined}>
                    <span className="bs-bar" aria-hidden="true" />
                    <h3>
                      <small aria-hidden="true">{String(i + 1).padStart(2, '0')}</small>
                      {s.title}
                    </h3>
                    <div className="bs-more">
                      <div>
                        <p>{s.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="bs-next">
                <p className={`bs-hint${idx < steps.length - 1 ? ' on' : ''}`} aria-hidden="true">
                  <span>
                    Keep scrolling<span className="bs-hint-more"> to see it built</span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 1.5v8.5M2.5 6.8L6 10.2l3.5-3.4" />
                  </svg>
                </p>
                <Link className={`bs-try${atFit ? ' on' : ''}`} href={plannerHref}>
                  <span className="bs-try-pic">
                    <Image src={PLANNER_IMAGE_SQUARE} alt="" fill sizes="56px" />
                    {atFit ? <PlannerClip {...PLANNER_CLIP_SQUARE} /> : null}
                    <span className="bs-try-3d" aria-hidden="true">
                      3D
                    </span>
                  </span>
                  <span className="bs-try-words">
                    <span className="bs-try-kick">Free planner</span>
                    <span className="bs-try-title">Plan your wardrobe in 3D</span>
                  </span>
                  <svg width="18" height="18" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1.5 6h8.5M6.8 2.5L10.2 6 6.8 9.5" />
                  </svg>
                </Link>
              </div>
              <div className="bs-ctas">{ctas}</div>
            </div>
            <div className={`bs-stage mount${ready ? ' is-ready' : ''}`} ref={stage} aria-hidden="true">
              <Image className="bs-fallback" src={fallback.src} alt="" fill sizes="(max-width: 900px) 92vw, 640px" />
              <canvas ref={canvas} />
              <div className="bs-stamp" ref={stamp}>
                Signed off
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5l3.2 3.2L13 4.8" />
                </svg>
              </div>
              <p className="bs-cap">{ready ? CAPS[still ? 3 : phase] : fallback.caption}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="wrap bs-foot">
        <div className="bs-foot-ctas">{ctas}</div>
        {children}
      </div>
    </section>
  );
}
