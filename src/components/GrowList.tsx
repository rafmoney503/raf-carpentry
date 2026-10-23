'use client';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/use-scroll-fx';

/* A list whose rows hold blue bars (.jn-bar in src/app/site-motion.css) that grow out as each row comes into
   view, and again after a row has gone right off screen. Used for 'Every place so far' on /areas. Rows on
   screen when the page opens keep their bars as they are; the bars are drawn full before the script runs and
   for reduced motion. data-grow goes straight onto each row, so React doesn't re-render while scrolling. */
export default function GrowList({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = ref.current;
    if (!ul || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    const first = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const li = e.target as HTMLElement;
          if (!first.has(li)) {
            first.add(li);
            if (!e.isIntersecting) li.dataset.grow = 'no';
            continue;
          }
          if (e.intersectionRatio >= 0.6) li.dataset.grow = 'yes';
          else if (!e.isIntersecting) li.dataset.grow = 'no';
        }
      },
      { threshold: [0, 0.6] },
    );
    for (const li of Array.from(ul.children)) io.observe(li);
    return () => io.disconnect();
  }, []);
  return (
    <ul ref={ref} className={className}>
      {children}
    </ul>
  );
}
