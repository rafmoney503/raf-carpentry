'use client';

import { memo, useEffect, useRef } from 'react';
import { GAPS, PLAYS, REST, StepsEngine, type StepsPlay } from './steps/engine';

/* The steps logo, moving (steps/engine.ts): 'climb' in the top bar, 'mix' in the 'Start here' band, 'build' on the
   'Sketch my system' card. The page is sent the logo at rest, so it shows without JavaScript and stays still for
   people who ask for less motion. It only moves while it is on screen and the tab is open. `roomy` leaves space
   round the logo for the bigger moves; `tone` 'dark' is for the ink band (paper planks, ink ring round the ball). */

function StepsMark({ play, tone = 'light', roomy = false, className, delay = 0.8 }: { play: StepsPlay; tone?: 'light' | 'dark'; roomy?: boolean; className?: string; delay?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const engine = new StepsEngine(Array.from(svg.querySelectorAll('rect')), svg.querySelector('g')!);
    let alive = true;
    const loop = (): void => {
      if (!alive) return;
      void PLAYS[play](engine)
        .then(() => (GAPS[play] ? engine.wait(GAPS[play]) : undefined))
        .then(loop);
    };
    void engine.wait(delay).then(loop);

    let frame = 0;
    let last = 0;
    let onScreen = false;
    const tick = (now: number) => {
      engine.advance(Math.min(0.05, (now - last) / 1000));
      engine.render();
      last = now;
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || !onScreen || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(svg);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false;
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [play, delay]);

  const plank = tone === 'dark' ? 'var(--paper)' : 'var(--ink)';
  const ring = tone === 'dark' ? 'var(--ink)' : 'var(--paper)';
  return (
    <svg ref={ref} className={className} viewBox={roomy ? '-10 -30 120 125' : '0 0 100 100'} aria-hidden="true" style={{ overflow: 'visible' }}>
      {REST.map((p, i) => (
        <rect key={i} width={p.w} height={14} rx={2} transform={`translate(${p.x} ${p.y})`} style={{ fill: plank }} />
      ))}
      {/* room for the steps that come and go while it moves */}
      <rect width={0} height={14} rx={2} display="none" style={{ fill: plank }} />
      <rect width={0} height={14} rx={2} display="none" style={{ fill: plank }} />
      <g transform="translate(74 34.5)">
        <circle cy={-9.5} r={9.5} strokeWidth={3} style={{ fill: 'var(--hl)', stroke: ring }} />
      </g>
    </svg>
  );
}

export default memo(StepsMark);
