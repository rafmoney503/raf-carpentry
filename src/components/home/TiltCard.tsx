'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/* A card that tips a little towards a mouse pointer, with its edge lit yellow where the pointer is. The pictures
   inside sit slightly forward (translateZ in the CSS), so the tilt has depth. Touch screens and people who ask for
   less motion get a still card; the edge light still follows a finger. */
export default function TiltCard({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const s = { rx: 0, ry: 0, tx: 0, ty: 0, l: 0, tl: 0 };
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const k = 1 - Math.exp(-Math.min(0.05, (now - last) / 1000) * 8);
      last = now;
      s.rx += (s.tx - s.rx) * k;
      s.ry += (s.ty - s.ry) * k;
      s.l += (s.tl - s.l) * k;
      el.style.transform = still ? '' : `perspective(1100px) rotateX(${s.rx.toFixed(3)}deg) rotateY(${s.ry.toFixed(3)}deg)`;
      el.style.setProperty('--spot', s.l.toFixed(3));
      if (Math.abs(s.tx - s.rx) + Math.abs(s.ty - s.ry) + Math.abs(s.tl - s.l) < 0.002) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      if (e.pointerType === 'mouse') {
        s.tx = (0.5 - y) * 5;
        s.ty = (x - 0.5) * 6;
      }
      s.tl = 1;
      kick();
    };
    const leave = () => {
      s.tx = 0;
      s.ty = 0;
      s.tl = 0;
      kick();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <Link ref={ref} href={href} className={`card card-link tilt ${className ?? ''}`} data-reveal>
      {children}
    </Link>
  );
}
