'use client';

/* The bar along the bottom of the screen on phones (7 Nov 2026, Raf: the back arrow at the top 'is so far out of
   reach'; 'sticky bottom bar with 4 sections - existing floating tape, back arrow, top arrow - back to top, and
   WhatsApp icon'; then 'the icons of WhatsApp and tape should be on each end of the sticky bar ... The tape should
   only open and close for short time to read the message like 3 seconds same with WhatsApp, the back and top icons
   should be positioned in the middle ... if inactive should be greyed out ... if page changed then back active and
   page scrolled top active').
   Get my free quote (the tape, blue) at the left end and WhatsApp (green) at the right end, where the floating
   buttons were; ‹ Back and ↑ Top together in the middle. The two ends are round icons; on each new page the quote
   opens out to its words for 3 seconds, then WhatsApp for 3 seconds, then both are icons again (not for reduced
   motion; the words are always there for screen readers). Back is grey until there's a page on this site to go
   back to (the tab's trail, src/lib/back-trail.ts), Top until the page has scrolled.
   Phones only (under 768 px): computers keep the two floating buttons. With quote false (the pages with their own
   quote or order form, where only WhatsApp floated) there's no quote button. On a job page the quote carries the
   job, so the brief names it, as the header's Get a quote does. */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SocialIcon from './SocialIcon';
import { TapeIcon } from './HowItWorksFloat';
import { useBack } from './BackBar';
import { useSaved } from '@/lib/saved';
import { whatsappText, whatsappUrl } from '@/lib/site';

function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {up ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M15 5l-7 7 7 7" />}
    </svg>
  );
}

// when each end opens and closes after a page is shown (ms)
const OPEN_AT = 700;
const OPEN_FOR = 3000;
const GAP = 450;

const mid = 'flex h-14 w-[54px] max-[379px]:w-12 flex-none flex-col items-center justify-center gap-0.5 rounded-[2px] text-[11px] font-medium leading-none transition-[color,opacity] duration-200';
const on = 'text-ink active:bg-raised';
const off = 'pointer-events-none text-faint opacity-40';

export default function PhoneBar({ quote = true }: { quote?: boolean }) {
  const pathname = usePathname() || '/';
  const back = useBack();
  const n = useSaved().length;
  const [wa, setWa] = useState(() => whatsappUrl(whatsappText(pathname)));
  useEffect(() => {
    const title = document.querySelector('main h1')?.textContent?.trim() ?? '';
    setWa(whatsappUrl(whatsappText(pathname, title)));
  }, [pathname]);

  // Top is grey until the page has scrolled
  const [down, setDown] = useState(false);
  useEffect(() => {
    const check = () => setDown(window.scrollY > 200);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [pathname]);

  // On each page: the quote's words for 3 s, then WhatsApp's for 3 s
  const [open, setOpen] = useState<'quote' | 'wa' | null>(null);
  useEffect(() => {
    setOpen(null);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const steps: [number, 'quote' | 'wa' | null][] = quote
      ? [[OPEN_AT, 'quote'], [OPEN_AT + OPEN_FOR, null], [OPEN_AT + OPEN_FOR + GAP, 'wa'], [OPEN_AT + 2 * OPEN_FOR + GAP, null]]
      : [[OPEN_AT, 'wa'], [OPEN_AT + OPEN_FOR, null]];
    const timers = steps.map(([t, s]) => window.setTimeout(() => setOpen(s), t));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [pathname, quote]);

  // Back works once there's a page on this site to go back to
  const canBack = back.history;
  const job = pathname.startsWith('/portfolio/') ? pathname.split('/')[2] : '';
  const quoteHref = job ? `/how-it-works?job=${job}#brief` : '/how-it-works#brief';

  return (
    <nav aria-label="Quick links" data-phone-bar data-open={open || undefined} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden">
      <div className="mx-auto flex h-16 max-w-[560px] items-center px-2">
        {quote ? (
          <Link
            href={quoteHref}
            aria-label={n ? `Get my free quote. ${n} saved for your brief` : 'Get my free quote'}
            data-bar-end="quote"
            data-open={open === 'quote' || undefined}
            className="pb-end relative flex h-12 flex-none items-center rounded-full bg-accent px-3 text-[15px] font-semibold text-on-accent shadow-[0_6px_18px_-6px_rgb(37_71_208/0.6)] active:bg-accent-hover"
          >
            <TapeIcon size={24} className="flex-none" />
            <span className="pb-label" aria-hidden="true">
              <span className="max-[379px]:hidden">Get my free quote</span>
              <span className="min-[380px]:hidden">Free quote</span>
            </span>
            {n ? (
              <span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-paper bg-on-accent px-1 font-mono text-[11px] leading-none text-accent">
                {n}
              </span>
            ) : null}
          </Link>
        ) : (
          <span aria-hidden="true" className="w-12 flex-none" />
        )}

        <span aria-hidden="true" className="min-w-1 flex-1" />
        <div className="flex flex-none items-center gap-1" data-bar-middle>
          {canBack ? (
            <Link
              href={back.href}
              onClick={(e) => {
                if (window.history.length < 2) return;
                e.preventDefault();
                window.history.back();
              }}
              aria-label={back.label}
              data-bar-back="on"
              className={`${mid} ${on}`}
            >
              <Arrow />
              Back
            </Link>
          ) : (
            <span aria-hidden="true" data-bar-back="off" className={`${mid} ${off}`}>
              <Arrow />
              Back
            </span>
          )}
          <button
            type="button"
            disabled={!down}
            onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
            aria-label="Back to the top"
            data-bar-top={down ? 'on' : 'off'}
            className={`${mid} ${down ? on : off}`}
          >
            <Arrow up />
            Top
          </button>
        </div>
        <span aria-hidden="true" className="min-w-1 flex-1" />

        <a
          href={wa}
          target="_blank"
          rel="noopener"
          aria-label="Message Raf on WhatsApp"
          data-bar-end="wa"
          data-open={open === 'wa' || undefined}
          className="pb-end flex h-12 flex-none items-center rounded-full bg-whatsapp px-3 text-[15px] font-semibold text-white active:bg-whatsapp-hover"
        >
          <SocialIcon network="whatsapp" size={24} className="flex-none" />
          <span className="pb-label" aria-hidden="true">
            <span className="max-[379px]:hidden">WhatsApp me</span>
            <span className="min-[380px]:hidden">WhatsApp</span>
          </span>
        </a>
      </div>
    </nav>
  );
}
