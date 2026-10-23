'use client';
import Link from 'next/link';
import { LazyMotion, domAnimation, m, useAnimationFrame, useMotionValue } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/* The home page's "What customers say" cards as a slow ticker (Framer Motion): they drift left at 34 px a
   second and loop, stop while the mouse or a finger is on them or a link inside has focus, and can be dragged
   either way with a finger or the mouse (they carry on gently from where they were let go). Only moves while
   on screen. The second copy of the cards that makes the loop is hidden from screen readers and the keyboard.
   Reduced motion, or before the script runs: the cards sit in a row that scrolls sideways by hand. */
export type TickerReview = { name: string; area?: string; text: string; stars?: number; job?: string };

const SPEED = 34; // px a second
const RESUME = 1400; // ms after a finger lets go

function Star() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="flex-none">
      <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
    </svg>
  );
}

function Card({ r, copy }: { r: TickerReview; copy: boolean }) {
  const stars = Math.max(1, Math.min(5, r.stars ?? 5));
  return (
    <li className="tk-card" aria-hidden={copy || undefined}>
      <span className="tk-stars flex items-center gap-0.5 text-accent" aria-label={copy ? undefined : `${stars} out of 5 stars`}>
        {Array.from({ length: stars }, (_, k) => (
          <span key={k} style={{ '--i': k } as React.CSSProperties}>
            <Star />
          </span>
        ))}
      </span>
      <blockquote className="mt-4 text-[16px] leading-relaxed text-ink">&ldquo;{r.text.trim()}&rdquo;</blockquote>
      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-5">
        <span className="font-mono text-[13px] text-faint">{r.name}{r.area ? `, ${r.area}` : ''}</span>
        {r.job ? (
          <Link href={`/portfolio/${r.job}`} tabIndex={copy ? -1 : undefined} className="text-[14px] font-medium text-accent hover:underline">
            See the job <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default function ReviewTicker({ items }: { items: TickerReview[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const x = useMotionValue(0);
  const [live, setLive] = useState(false);
  const [seen, setSeen] = useState(false);
  const loop = useRef(0); // width of one copy of the cards, gap included
  const onScreen = useRef(false);
  const held = useRef(false); // mouse over, finger down or focus inside
  const drag = useRef<{ id: number; x0: number; v0: number; last: number; t: number; vel: number; moved: boolean } | null>(null);
  const fling = useRef(0); // px a second left over from a drag, fading back to the drift
  const resumeAt = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return;
    const w = wrap.current;
    if (!w) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setLive(true); // the observer answers straight away: from then on the ticker runs
        onScreen.current = e.isIntersecting;
        if (e.isIntersecting && e.intersectionRatio >= 0.25) setSeen(true);
        if (!e.isIntersecting) setSeen(false);
      },
      { threshold: [0, 0.25] },
    );
    io.observe(w);
    return () => io.disconnect();
  }, []);

  // One copy's width, gap included (the second copy is only there once it's live).
  useEffect(() => {
    const t = track.current;
    if (!live || !t) return;
    const measure = () => {
      const kids = t.children;
      if (kids.length < 2 || kids.length % 2) return;
      loop.current = (kids[kids.length / 2] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(t);
    return () => ro.disconnect();
  }, [live]);

  const wrapX = (v: number) => {
    const L = loop.current;
    if (!L) return v;
    while (v <= -L) v += L;
    while (v > 0) v -= L;
    return v;
  };

  useAnimationFrame((time, delta) => {
    if (!live || !onScreen.current || drag.current) return;
    const dt = Math.min(delta, 64) / 1000;
    if (held.current || time < resumeAt.current) {
      if (Math.abs(fling.current) < 1) return;
    }
    // A fling fades out over about a second; then the drift takes over again.
    fling.current *= Math.pow(0.04, dt);
    const drift = held.current || time < resumeAt.current ? 0 : -SPEED;
    x.set(wrapX(x.get() + (drift + fling.current) * dt));
  });

  const down = (e: React.PointerEvent) => {
    if (!live || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x0: e.clientX, v0: x.get(), last: e.clientX, t: performance.now(), vel: 0, moved: false };
    fling.current = 0;
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (!d.moved) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.vel = d.vel * 0.6 + ((e.clientX - d.last) / dt) * 1000 * 0.4;
    d.last = e.clientX;
    d.t = now;
    x.set(wrapX(d.v0 + dx));
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      fling.current = Math.max(-1600, Math.min(1600, d.vel));
      // A drag isn't a tap: don't open the link the drag ended on.
      const stop = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      window.addEventListener('click', stop, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
    }
    if (e.pointerType !== 'mouse') resumeAt.current = performance.now() + RESUME;
  };

  return (
    <div
      ref={wrap}
      className={`tk${live ? ' tk-live' : ''}${seen || !live ? ' tk-seen' : ''}`}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') held.current = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') held.current = false;
      }}
      onFocus={() => {
        held.current = true;
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) held.current = false;
      }}
    >
      <LazyMotion features={domAnimation}>
        <m.ul
          ref={track}
          className="tk-track"
          style={{ x }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {items.map((r, i) => (
            <Card key={`a${i}`} r={r} copy={false} />
          ))}
          {live ? items.map((r, i) => <Card key={`b${i}`} r={r} copy />) : null}
        </m.ul>
      </LazyMotion>
    </div>
  );
}
