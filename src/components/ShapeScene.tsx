'use client';

import { useEffect, useRef } from 'react';
import { el, type Layout, type Scene } from './scene/kit';
import { makeLoop } from './scene/loop';
import { makeCog } from './scene/cog';

/* The moving shapes with the big circle (scene/loop.ts: shapes go through it and come out finished; scene/cog.ts: they
   orbit it and it turns into a cog). place 'head': at the top of a page, beside the title on a computer (the space
   right of the title and lead is measured) and as a short wide strip under the lead on phones and tablets.
   place 'band': its own space on the home page. mode 'both' plays one turn of each in turn, crossfading, and tells the
   page which one is showing (onScene) so its words can change with it.
   It only runs while it is on screen and the tab is open; people who ask for less motion see one still moment. */

export type SceneName = 'loop' | 'cog';

const FADE = 0.6;

export default function ShapeScene({ mode, place, onScene }: { mode: SceneName | 'both'; place: 'head' | 'band'; onScene?: (s: SceneName) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const report = useRef(onScene);

  useEffect(() => {
    report.current = onScene;
  }, [onScene]);

  useEffect(() => {
    const root = box.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    const names: SceneName[] = mode === 'both' ? ['loop', 'cog'] : [mode];
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let layout: Layout | null = null;
    let holder: SVGGElement | null = null;
    let scenes: Scene[] = [];
    let active = 0;
    let t = 0;
    let fade = -1; // seconds into a crossfade, or -1
    let nextT = 0;

    const showStill = () => {
      const s = scenes[active];
      s.reset();
      for (let u = 0; u < s.still; u += 1 / 120) s.step(u, 1 / 120);
    };

    const build = (l: Layout) => {
      svg.replaceChildren();
      holder = el('g', {}, svg);
      scenes = names.map((n) => (n === 'loop' ? makeLoop : makeCog)(holder!, l));
      scenes.forEach((s, i) => s.g.setAttribute('opacity', i === active ? '1' : '0'));
      t = 0;
      fade = -1;
      if (still) showStill();
    };

    const measure = () => {
      const W = root.clientWidth;
      const H = root.clientHeight;
      if (!W || !H) return;
      let l: Layout = place === 'band' ? 'tall' : 'strip';
      let x0 = 0;
      let x1 = W;
      if (place === 'head' && window.matchMedia('(min-width: 1100px)').matches) {
        // beside the title: from just after the longer of the title and the lead to the inside of the page edge
        l = 'tall';
        const head = root.parentElement;
        const rr = root.getBoundingClientRect();
        const title = head?.querySelector('.page-title')?.getBoundingClientRect();
        const lead = head?.querySelector('.lead')?.getBoundingClientRect();
        if (title && lead) x0 = Math.max(title.right, lead.right) - rr.left + 40;
        x1 = W - (head ? parseFloat(getComputedStyle(head).paddingRight) || 0 : 0);
      }
      if (l !== layout) {
        layout = l;
        build(l);
      }
      const s0 = scenes[0];
      const cap = place === 'band' ? 1.25 : l === 'tall' ? 1.1 : 1.35;
      const s = Math.max(0, Math.min(cap, (x1 - x0) / s0.w, H / s0.h));
      const tx = x0 + (x1 - x0 - s0.w * s) / 2;
      const ty = (H - s0.h * s) / 2;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      holder?.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(4)})`);
    };

    const advance = (dt: number) => {
      const n = Math.max(1, Math.ceil(dt / 0.005));
      for (let i = 0; i < n; i++) {
        const h = dt / n;
        t += h;
        scenes[active].step(t, h);
        if (names.length < 2) continue;
        const nx = (active + 1) % scenes.length;
        if (fade < 0 && t >= scenes[active].cycle) {
          // one turn done: bring in the other scene from its start
          scenes[nx].reset();
          nextT = 0;
          fade = 0;
          report.current?.(names[nx]);
        }
        if (fade >= 0) {
          nextT += h;
          fade += h;
          scenes[nx].step(nextT, h);
          const p = Math.min(1, fade / FADE);
          scenes[active].g.setAttribute('opacity', (1 - p).toFixed(3));
          scenes[nx].g.setAttribute('opacity', p.toFixed(3));
          if (p >= 1) {
            active = nx;
            t = nextT;
            fade = -1;
          }
        }
      }
    };

    let frame = 0;
    let last = 0;
    let onScreen = false;
    const tick = (now: number) => {
      advance(Math.min(0.05, (now - last) / 1000));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (still || frame || !onScreen || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    measure();
    report.current?.(names[active]);
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(root);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode, place]);

  return (
    <div className={`scene scene-${place}`} ref={box} aria-hidden="true">
      <svg ref={svgRef} />
    </div>
  );
}
