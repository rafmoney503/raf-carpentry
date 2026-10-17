'use client';

import { memo, useEffect, useRef } from 'react';
import { FINALE, GAPS, PLAYS, REST, StepsEngine, type StepsPlay } from './steps/engine';

/* The steps logo, moving (steps/engine.ts): 'climb' in the top bar, 'mix' in the 'Start here' band, 'build' on the
   'Sketch my system' card. The page is sent the logo at rest, so it shows without JavaScript and stays still for
   people who ask for less motion. It only moves while it is on screen and the tab is open.
   `rounds`: play that many times, then the play's finale (the climb ends back at rest on the top step) and stop;
   left out, it plays for as long as it is on screen. `replayEvent`: a window event that starts it again once it has
   stopped. When it is resting nothing is drawn. `roomy` leaves space round the logo for the bigger moves; `tone`
   'dark' is for the ink band (paper planks, ink ring round the ball). */

function StepsMark({
  play,
  tone = 'light',
  roomy = false,
  className,
  delay = 0.8,
  rounds,
  replayEvent,
}: {
  play: StepsPlay;
  tone?: 'light' | 'dark';
  roomy?: boolean;
  className?: string;
  delay?: number;
  rounds?: number;
  replayEvent?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const engine = new StepsEngine(Array.from(svg.querySelectorAll('rect')), svg.querySelector('g')!);
    let alive = true;
    let running = false;

    let frame = 0;
    let last = 0;
    let onScreen = false;
    let restFor = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      engine.advance(dt);
      engine.render();
      // once it has stopped and settled, stop drawing until it is asked to go again
      restFor = !running && engine.idle() ? restFor + dt : 0;
      if (restFor > 0.5) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || !onScreen || document.hidden) return;
      last = performance.now();
      restFor = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const run = () => {
      if (running || !alive) return;
      running = true;
      start();
      let left = rounds;
      const next = (): void => {
        if (!alive) return;
        if (left !== undefined && left <= 0) {
          const finale = FINALE[play];
          void (finale ? finale(engine) : Promise.resolve()).then(() => {
            running = false;
          });
          return;
        }
        void PLAYS[play](engine)
          .then(() => (GAPS[play] ? engine.wait(GAPS[play]) : undefined))
          .then(() => {
            if (left !== undefined) left -= 1;
            next();
          });
      };
      next();
    };
    running = true; // the first run waits for the delay
    void engine.wait(delay).then(() => {
      running = false;
      run();
    });

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(svg);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    if (replayEvent) window.addEventListener(replayEvent, run);
    return () => {
      alive = false;
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (replayEvent) window.removeEventListener(replayEvent, run);
    };
  }, [play, delay, rounds, replayEvent]);

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
