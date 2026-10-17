'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/* Moving parts only move while they are on screen. Every [data-motion] element gets data-on while part of it is in
   view, and the CSS pauses its animations the rest of the time, so a door drawing starts drawing when you reach it.
   Pieces marked [data-reveal] rise into place the first time they come on screen ([data-in], kept after that). They
   are only hidden while this script is running (html.js), and never for people who ask for less motion. */
export default function MotionObserver() {
  const pathname = usePathname();

  useEffect(() => {
    (window as Window & { __mo?: boolean }).__mo = true;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-motion]'));
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-in])'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.setAttribute('data-on', ''));
      reveals.forEach((el) => el.setAttribute('data-in', ''));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.toggleAttribute('data-on', entry.isIntersecting);
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    els.forEach((el) => io.observe(el));
    const rv = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-in', '');
          rv.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    reveals.forEach((el) => rv.observe(el));
    return () => {
      io.disconnect();
      rv.disconnect();
    };
  }, [pathname]);

  return null;
}
