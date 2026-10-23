'use client';
import { LazyMotion, domAnimation, m, useSpring } from 'framer-motion';

/* Wraps a button so it leans towards the mouse when the pointer comes near (Framer Motion springs), up to
   14 px across and 10 px up or down, and springs back when the pointer leaves. A 20 px margin round the
   button catches the pointer just before it arrives. Mouse only: taps and reduced motion leave it still. */
const SPRING = { stiffness: 220, damping: 16, mass: 0.5 };

export default function Magnetic({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  return (
    <LazyMotion features={domAnimation}>
      <span
        className={`magnet ${className}`}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          const r = e.currentTarget.getBoundingClientRect();
          x.set(Math.max(-14, Math.min(14, (e.clientX - (r.left + r.width / 2)) * 0.22)));
          y.set(Math.max(-10, Math.min(10, (e.clientY - (r.top + r.height / 2)) * 0.3)));
        }}
        onPointerLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        <m.span className="magnet-in" style={{ x, y }}>
          {children}
        </m.span>
      </span>
    </LazyMotion>
  );
}
