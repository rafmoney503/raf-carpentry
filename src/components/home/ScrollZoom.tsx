'use client';

import { useEffect, useRef } from 'react';

/* A photo that settles as it scrolls into view: it starts a little zoomed in and eases back to its frame. */
export default function ScrollZoom({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const inner = box?.firstElementChild as HTMLElement | null;
    if (!box || !inner || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const tick = () => {
      const r = box.getBoundingClientRect();
      const q = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
      const e = 1 - Math.pow(1 - q, 3);
      inner.style.transform = `scale(${(1.16 - 0.16 * e).toFixed(4)}) translateY(${((0.5 - q) * 4).toFixed(2)}%)`;
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !frame) frame = requestAnimationFrame(tick);
      else if (!e.isIntersecting && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    io.observe(box);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
