'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onSavedChange, useSaved } from '@/lib/saved';

/* "Plan your project" button (the /how-it-works page) that stays in the bottom-left corner on every
   page, opposite the green WhatsApp button, so customers can always find what to send and what to expect.
   Once something is saved for the brief (the hearts), it shows how many and goes straight to the brief.
   Under 380 px the list icon makes way for the count, so it never reaches the WhatsApp button. */
export default function HowItWorksFloat() {
  const saved = useSaved();
  const n = saved.length;
  const [pop, setPop] = useState(0); // counts saves made on this page, so the badge pops on each one
  useEffect(() => onSavedChange((added) => added && setPop((k) => k + 1)), []);
  return (
    <Link
      href={n ? '/how-it-works#brief' : '/how-it-works'}
      aria-label={n ? `Plan your project, ${n} saved for your brief` : undefined}
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 z-40 flex h-14 items-center gap-2.5 rounded-full border border-line-strong bg-mount/95 pl-4 pr-5 text-[15px] font-semibold text-ink shadow-[0_8px_28px_rgb(22_25_28/0.18)] backdrop-blur-sm transition-colors hover:border-accent hover:text-accent md:bottom-6 md:left-6 md:h-12"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`flex-none text-accent ${n ? 'max-[379px]:hidden' : ''}`}>
        <circle cx="4" cy="5" r="1.6" fill="currentColor" />
        <circle cx="4" cy="10" r="1.6" fill="currentColor" />
        <circle cx="4" cy="15" r="1.6" fill="currentColor" />
        <path d="M8.5 5h8M8.5 10h8M8.5 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      Plan your project
      {n ? (
        <span key={pop} aria-hidden="true" className={`${pop ? 'saved-pop' : ''} -mr-2 inline-flex h-7 items-center gap-1 rounded-full bg-accent px-2.5 font-mono text-[13px] text-on-accent`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </svg>
          {n}
        </span>
      ) : null}
    </Link>
  );
}
