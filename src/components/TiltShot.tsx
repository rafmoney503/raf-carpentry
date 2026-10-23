'use client';
import { LazyMotion, domAnimation, m, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useScrollFx } from '@/lib/use-scroll-fx';

/* A screenshot that leans in 3D (Framer Motion springs): towards the mouse on a computer, and (home page
   CabinetOS band only) with the scroll on a phone or tablet: tilted back while it's low on the screen, flat in
   the middle, tilted forward above. `mouseOnly` (CabinetOS page app screens, SketchUp page screenshots, which
   are tapped to open full size) leaves it still on touch screens. Up to `deg` degrees (6 by default), so the
   picture always reads. `as="span"` for use inside a button. Still for reduced motion. */
const SPRING = { stiffness: 140, damping: 18, mass: 0.6 };

export default function TiltShot({
  children,
  className = '',
  mouseOnly = false,
  deg = 6,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  mouseOnly?: boolean;
  deg?: number;
  as?: 'div' | 'span';
}) {
  const ref = useRef<HTMLElement>(null);
  const none = useRef<HTMLElement>(null);
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

  // Phones and tablets: lean with the scroll (not when mouseOnly: the hook then watches nothing).
  useScrollFx(mouseOnly ? none : ref, (vh) => {
    if (mouse || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const c = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
    rx.set(c * deg);
  });

  const still = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Tag = as === 'span' ? m.span : m.div;

  return (
    <LazyMotion features={domAnimation}>
      <Tag
        ref={ref as never}
        className={className}
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 1400 }}
        onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
          if (e.pointerType !== 'mouse' || still()) return;
          const r = e.currentTarget.getBoundingClientRect();
          rx.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * (deg * 5) / 6);
          ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * deg);
        }}
        onPointerLeave={(e: React.PointerEvent<HTMLElement>) => {
          if (e.pointerType !== 'mouse') return;
          rx.set(0);
          ry.set(0);
        }}
      >
        {children}
      </Tag>
    </LazyMotion>
  );
}
