'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { onSavedChange, useSaved } from '@/lib/saved';

/* The quote button that stays in the bottom-left corner on every page, opposite the green WhatsApp button
   (28 Oct 2026, Raf: the button 'has to look better' and 'entice to make a quote'): solid blue with a small tape
   measure, 'Get my free quote' and '3 quick steps, free visit' under it. It opens the brief on Plan your project
   (/how-it-works#brief), which runs in three steps. One gentle pulse when the page opens, then it stays still
   (globals.css .hif-pulse; none for reduced motion).
   Once something is saved for the brief (the hearts), it shows how many. On narrow phones the tape makes way for
   the count, so it never reaches the WhatsApp button.
   While the page scrolls it folds down to its icon (and the count) and opens out again 650 ms after it stops,
   the same rhythm as the spirit level (globals.css .hif-*; one passive scroll listener, state only changes
   when it folds or opens). The words stay in the page for screen readers. Never folds for reduced motion. */

export function TapeIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {/* the case, its reel and the tape pulled out with a few marks and the hook at the end */}
      <rect x="1.8" y="5" width="13.4" height="13.4" rx="3.2" />
      <circle cx="8.5" cy="11.7" r="2.6" />
      <path d="M15.2 14.4h6.4v4h-6.4" />
      <path d="M17.4 14.4v1.6M19.6 14.4v1.6" strokeWidth="1.3" />
      <path d="M21.6 13v6.6" />
    </svg>
  );
}

export default function HowItWorksFloat() {
  const saved = useSaved();
  const n = saved.length;
  const [pop, setPop] = useState(0); // counts saves made on this page, so the badge pops on each one
  useEffect(() => onSavedChange((added) => added && setPop((k) => k + 1)), []);
  const [small, setSmall] = useState(false);
  const isSmall = useRef(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    let lastY = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - lastY) < 4) return;
      lastY = window.scrollY;
      if (!isSmall.current) {
        isSmall.current = true;
        setSmall(true);
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        isSmall.current = false;
        setSmall(false);
      }, 650);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <Link
      href="/how-it-works#brief"
      aria-label={n ? `Get my free quote: 3 quick steps, free visit. ${n} saved for your brief` : 'Get my free quote: 3 quick steps, free visit'}
      data-small={small || undefined}
      data-quote-float
      className="hif hif-pulse fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 z-40 flex h-[60px] items-center gap-2.5 rounded-full bg-accent pl-[15px] pr-5 text-on-accent shadow-[0_10px_30px_-6px_rgb(37_71_208/0.55)] transition-colors hover:bg-accent-hover md:bottom-6 md:left-6 md:h-14"
    >
      <TapeIcon className={`flex-none ${n ? 'max-[379px]:hidden' : ''}`} />
      <span className="hif-label" aria-hidden="true">
        <span className="block text-[16px] font-semibold leading-tight">Get my free quote</span>
        <span className="mt-0.5 block text-[12.5px] font-medium leading-tight opacity-[0.85]">3 quick steps, free visit</span>
      </span>
      {n ? (
        <span key={pop} aria-hidden="true" className={`${pop ? 'saved-pop' : ''} -mr-2 inline-flex h-7 items-center gap-1 rounded-full bg-on-accent px-2.5 font-mono text-[13px] text-accent`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </svg>
          {n}
        </span>
      ) : null}
    </Link>
  );
}
