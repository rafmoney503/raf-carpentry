'use client';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/use-scroll-fx';

/* A number in the home page's facts strip ("22", "100+") that counts up from 0 as the strip scrolls into view,
   and again each time it comes back after going right off screen. The page is sent with the real number, so it
   reads right before the script runs, for screen readers (the moving copy is aria-hidden) and with reduced motion.
   A strip already on screen when the page opens keeps its numbers as they are. */
const DURATION = 1400;
const ease = (t: number) => 1 - Math.pow(1 - t, 4);

export default function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    const m = value.match(/^(\d+)(.*)$/);
    if (!el || !m || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    const target = Number(m[1]);
    const rest = m[2];
    let raf = 0;
    let first = true;
    const show = (n: number) => {
      el.textContent = `${Math.round(n)}${rest}`;
    };
    const run = () => {
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / DURATION);
        show(target * ease(p));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (first) {
          first = false;
          if (e.intersectionRatio < 0.6) show(0);
          return;
        }
        if (e.intersectionRatio >= 0.6 && el.textContent !== value) run();
        else if (!e.isIntersecting) {
          cancelAnimationFrame(raf);
          show(0);
        }
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <>
      <span ref={ref} className="count" aria-hidden="true">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
