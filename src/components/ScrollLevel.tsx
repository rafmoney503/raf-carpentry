'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getLevelReading, getReading, setDock, subscribeReading, type LevelReading } from '@/lib/scroll-level';
import './scroll-level.css';

/* The spirit level (src/lib/scroll-level.ts has the why): HeroLevel sits under the home page title, MiniLevel is the
   small copy the navbar shows once the hero one has scrolled up under the header. Both are pictures only
   (aria-hidden): the reading changes while scrolling and would be noise for a screen reader. */

function useReading() {
  return useSyncExternalStore(subscribeReading, getReading, getLevelReading);
}

function Bar({ r, mini = false }: { r: LevelReading; mini?: boolean }) {
  return (
    <span className="sl-bar" style={{ transform: `rotate(${r.deg.toFixed(2)}deg)` }}>
      {mini ? null : <span className="sl-hole" />}
      <span className="sl-vial">
        <span className="sl-mark" />
        <span className="sl-mark" />
        <span className="sl-bubble" style={{ transform: `translateX(${(mini ? r.bubble / 2 : r.bubble).toFixed(1)}px)` }} />
      </span>
      {mini ? null : <span className="sl-hole" />}
    </span>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span className={`sl-ok${on ? ' on' : ''}`}>
      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 5.2l2 2 4-4.4" />
      </svg>
    </span>
  );
}

export function HeroLevel({ className = '' }: { className?: string }) {
  const r = useReading();
  const ref = useRef<HTMLDivElement>(null);
  // Tell the navbar this page has a level, and whether it has gone up under the header (72 px on a computer).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setDock({ present: true });
    const io = new IntersectionObserver(
      ([entry]) => setDock({ docked: !entry.isIntersecting && entry.boundingClientRect.top < 80 }),
      { rootMargin: '-72px 0px 0px 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setDock({ present: false, docked: false });
    };
  }, []);
  return (
    <div ref={ref} className={`sl-row ${className}`} aria-hidden="true">
      <Bar r={r} />
      <span className={`sl-reading${r.level ? ' on' : ''}`}>{r.level ? '0.0°' : `${Math.abs(r.deg).toFixed(1)}°`}</span>
      <Tick on={r.level} />
    </div>
  );
}

export function MiniLevel() {
  const r = useReading();
  return (
    <span className="sl-dock" aria-hidden="true">
      <Bar r={r} mini />
      <Tick on={r.level} />
    </span>
  );
}
