'use client';
import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '@/lib/use-scroll-fx';

/* Two sage wardrobe doors over the home page's photo of the day (home-motion.css .hd-*): they swing open on
   their hinges and the photo eases back from a slight zoom. The first opening is a CSS animation, so it plays
   with the page even before the script runs. If the photo is off screen when the page opens (a phone, where it
   sits under the buttons), the doors stay shut until it scrolls into view, and they close again once it has
   gone right off screen, so they open each time it comes back, like the moving drawings do.
   Pictures only (aria-hidden), never in the way of the link; none at all for prefers-reduced-motion. */
type DoorState = 'load' | 'shut' | 'open';

export default function HeroDoors() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DoorState>('load');
  const now = useRef<DoorState>('load');

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    let first = true;
    let timer = 0;
    const set = (s: DoorState) => {
      now.current = s;
      setState(s);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (first) {
          first = false;
          if (e.intersectionRatio < 0.3) set('shut');
          return;
        }
        if (!e.isIntersecting) {
          window.clearTimeout(timer);
          set('shut');
        } else if (e.intersectionRatio >= 0.3 && now.current === 'shut') {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => set('open'), 220);
        }
      },
      { threshold: [0, 0.3] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className={`hd${state === 'load' ? '' : ` hd-${state}`}`} aria-hidden="true">
      <span className="hd-door hd-l">
        <i />
      </span>
      <span className="hd-door hd-r">
        <i />
      </span>
    </div>
  );
}
