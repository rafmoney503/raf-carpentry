'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { openSketch } from '../OpenSketch';
import type { Hit } from '@/lib/search';

/* What picking a search result does, the same from the sheet and from the phone menu: a page or section opens, an
   outside site opens in a new tab, 'Sketch my system' opens the planner with the words in it, and 'Send to Rafal'
   takes the words to the contact form. */
export function useRunHit() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (h: Hit, words: string) => {
      if (h.kind === 'sketch') return openSketch({ pain: words });
      if (h.kind === 'send') {
        try {
          sessionStorage.setItem('contact-prefill', words);
        } catch {
          /* private mode: the form simply starts empty */
        }
        if (pathname === '/contact') {
          window.dispatchEvent(new CustomEvent('fill-contact', { detail: words }));
          document.getElementById('form')?.scrollIntoView({ behavior: 'smooth' });
        } else router.push('/contact#form');
        return;
      }
      if (!h.href) return;
      if (h.external) window.open(h.href, '_blank', 'noopener');
      else router.push(h.href);
    },
    [router, pathname],
  );
}
