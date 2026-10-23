'use client';
import { useEffect, useRef, type RefObject } from 'react';

/* Scroll-linked effects on the home page (stacking cards, drawing-to-photo wipe, the CabinetOS tilt on phones).
   `fx(vh)` runs once per animation frame while the page scrolls, but only while the element is within half a
   screen of the window (an IntersectionObserver switches the passive scroll listener on and off), so nothing
   is measured for parts of the page nobody is looking at. It runs once more as the element goes out of range,
   so a fast scroll never leaves a card half done. Never runs for prefers-reduced-motion: the markup is drawn
   finished. fx writes CSS variables straight onto elements, so React doesn't re-render while scrolling. */
export function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* `watch` picks the element the observer watches (default: the element itself). A card in a row that scrolls
   sideways (Latest jobs on a phone) watches its row, as a card scrolled out of the row never shows as on screen. */
export function useScrollFx(ref: RefObject<HTMLElement | null>, fx: (vh: number) => void, watch?: (el: HTMLElement) => Element) {
  const fxRef = useRef(fx);
  const watchRef = useRef(watch);
  useEffect(() => {
    fxRef.current = fx;
    watchRef.current = watch;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    let raf = 0;
    let on = false;
    const run = () => {
      raf = 0;
      fxRef.current(window.innerHeight || document.documentElement.clientHeight);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !on) {
          on = true;
          window.addEventListener('scroll', onScroll, { passive: true });
          window.addEventListener('resize', onScroll, { passive: true });
        } else if (!e.isIntersecting && on) {
          on = false;
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onScroll);
        }
        run();
      },
      { rootMargin: '50% 0px' },
    );
    io.observe(watchRef.current ? watchRef.current(el) : el);
    run();
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref]);
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
