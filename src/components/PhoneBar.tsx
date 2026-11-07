'use client';

/* The bar along the bottom of the screen on phones (7 Nov 2026, Raf: the back arrow at the top 'is so far out of
   reach'; 'sticky bottom bar with 4 sections - existing floating tape, back arrow, top arrow - back to top, and
   WhatsApp icon'). Everything a thumb needs in one row, where the thumb is:
   ‹ Back · ↑ Top · Get my free quote · WhatsApp.
   Phones only (under 768 px): computers keep the two floating buttons. With quote false (the pages with their own
   quote or order form, where only WhatsApp floated) the quote button makes way for a wider WhatsApp me.
   Back is the back link at the top of the page (src/components/BackBar.tsx) in reach of the thumb; Top is faint
   until the page has scrolled 400 px, Back on the pages with nowhere to go back to (the home page). On a job page
   the quote carries the job, so the brief names it, as the header's Get a quote does. */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SocialIcon from './SocialIcon';
import { TapeIcon } from './HowItWorksFloat';
import { useBack, hidden as noBack } from './BackBar';
import { useSaved } from '@/lib/saved';
import { whatsappText, whatsappUrl } from '@/lib/site';

function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {up ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M15 5l-7 7 7 7" />}
    </svg>
  );
}

const small = 'flex h-14 w-[52px] flex-none flex-col items-center justify-center gap-0.5 rounded-[2px] text-[11px] font-medium leading-none text-muted transition-colors active:bg-raised';

export default function PhoneBar({ quote = true }: { quote?: boolean }) {
  const pathname = usePathname() || '/';
  const back = useBack();
  const n = useSaved().length;
  const [wa, setWa] = useState(() => whatsappUrl(whatsappText(pathname)));
  useEffect(() => {
    const title = document.querySelector('main h1')?.textContent?.trim() ?? '';
    setWa(whatsappUrl(whatsappText(pathname, title)));
  }, [pathname]);
  // Top is faint until there's somewhere to go up to
  const [down, setDown] = useState(false);
  useEffect(() => {
    const on = () => setDown(window.scrollY > 400);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [pathname]);
  const canBack = !noBack(pathname);
  const job = pathname.startsWith('/portfolio/') ? pathname.split('/')[2] : '';
  const quoteHref = job ? `/how-it-works?job=${job}#brief` : '/how-it-works#brief';

  return (
    <nav aria-label="Quick links" data-phone-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden">
      <div className="mx-auto flex h-16 max-w-[560px] items-center gap-1 px-2">
        {canBack ? (
          <Link
            href={back.href}
            onClick={(e) => {
              if (!back.history || window.history.length < 2) return;
              e.preventDefault();
              window.history.back();
            }}
            aria-label={back.label}
            className={`${small} text-ink`}
          >
            <Arrow />
            Back
          </Link>
        ) : (
          <span aria-hidden="true" className={`${small} opacity-35`}>
            <Arrow />
            Back
          </span>
        )}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
          aria-label="Back to the top"
          className={`${small} ${down ? 'text-ink' : 'opacity-35'}`}
        >
          <Arrow up />
          Top
        </button>
        {quote ? (
          <Link
            href={quoteHref}
            aria-label={n ? `Get my free quote. ${n} saved for your brief` : 'Get my free quote'}
            className="mx-1 flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-3 text-[15px] font-semibold text-on-accent shadow-[0_6px_18px_-6px_rgb(37_71_208/0.6)] active:bg-accent-hover"
          >
            <TapeIcon size={22} className="flex-none" />
            <span className="truncate" aria-hidden="true">
              <span className="max-[379px]:hidden">Get my free quote</span>
              <span className="min-[380px]:hidden">Free quote</span>
            </span>
            {n ? (
              <span aria-hidden="true" className="-mr-1 inline-flex h-6 flex-none items-center rounded-full bg-on-accent px-2 font-mono text-[12px] text-accent">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="mr-1">
                  <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
                </svg>
                {n}
              </span>
            ) : null}
          </Link>
        ) : null}
        <a
          href={wa}
          target="_blank"
          rel="noopener"
          aria-label="Message Raf on WhatsApp"
          className={`flex h-12 flex-none items-center justify-center gap-2 rounded-full bg-whatsapp text-white active:bg-whatsapp-hover ${quote ? 'w-12' : 'ml-auto px-5 text-[15px] font-semibold'}`}
        >
          <SocialIcon network="whatsapp" size={24} />
          {quote ? null : <span aria-hidden="true">WhatsApp me</span>}
        </a>
      </div>
    </nav>
  );
}
