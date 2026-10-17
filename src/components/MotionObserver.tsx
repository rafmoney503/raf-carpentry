'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/* Moving parts only move while they are on screen. Every [data-motion] element gets data-on while part of it is in
   view, and the CSS pauses its animations the rest of the time, so a door drawing starts drawing when you reach it.
   The animations themselves are only declared for people who haven't asked their phone for less motion. */
export default function MotionObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-motion]'));
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.setAttribute('data-on', ''));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.toggleAttribute('data-on', entry.isIntersecting);
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
