'use client';
import { LazyMotion, domAnimation, m, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useScrollFx } from '@/lib/use-scroll-fx';

/* The CabinetOS screen on the home page leans in 3D (Framer Motion springs): towards the mouse on a computer,
   and with the scroll on a phone or tablet (tilted back while it's low on the screen, flat in the middle,
   tilted forward above). Up to 6 degrees, so the picture always reads. Still for reduced motion. */
const SPRING = { stiffness: 140, damping: 18, mass: 0.6 };

export default function TiltShot({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(0, SPRING);
  const ry = useSpring(0, SPRING);
  const [mouse, setMouse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setMouse(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Phones and tablets: lean with the scroll.
  useScrollFx(ref, (vh) => {
    if (mouse || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const c = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
    rx.set(c * 6);
  });

  const still = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        ref={ref}
        className={className}
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 1400 }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' || still()) return;
          const r = e.currentTarget.getBoundingClientRect();
          rx.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * 5);
          ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * 6);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return;
          rx.set(0);
          ry.set(0);
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
