'use client';

/* The bar along the bottom of the screen on phones (7 Nov 2026, Raf: the back arrow at the top 'is so far out of
   reach'; 'sticky bottom bar with 4 sections - existing floating tape, back arrow, top arrow - back to top, and
   WhatsApp icon'; then the two ends at the ends and Back and Top in the middle, grey until they can be used; then
   'icons tape and WhatsApp should be stable and next to them have small letters ... 3 step quote ... WhatsApp me ...
   can be in 2 lines', and the bar on Plan your project too).
   Get my free quote (the tape on a blue circle, '3 step / quote' beside it) at the left end and WhatsApp (green circle,
   'WhatsApp / me') at the right end, where the floating buttons were; ‹ Back and ↑ Top side by side in the middle,
   always in the middle of the screen (a grid of 1fr auto 1fr). Nothing opens or moves. Back is grey until there's a
   page on this site to go back to (the tab's trail, src/lib/back-trail.ts), Top until the page has scrolled.
   Phones only (under 768 px): computers keep the two floating buttons. quote: 'link' opens the brief on Plan your
   project (on a job page with the job, so the brief names it, as the header's Get a quote does); 'jump' (on Plan your
   project itself) scrolls to the brief; false (the pages with their own quote or order form, where only WhatsApp
   floated) leaves the left end empty. */

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

const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth') as ScrollBehavior;

const mid = 'flex h-14 w-[54px] max-[379px]:w-11 flex-none flex-col items-center justify-center gap-0.5 rounded-[2px] text-[11px] font-medium leading-none transition-[color,opacity] duration-200';
const on = 'text-ink active:bg-raised';
const off = 'pointer-events-none text-faint opacity-40';
const circle = 'relative flex size-12 max-[379px]:size-11 flex-none items-center justify-center rounded-full';
const label = 'text-[11.5px] max-[379px]:text-[11px] font-semibold leading-[1.15]';

export default function PhoneBar({ quote = 'link' }: { quote?: 'link' | 'jump' | false }) {
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

  // Back works once there's a page on this site to go back to
  const canBack = back.history;
  const job = pathname.startsWith('/portfolio/') ? pathname.split('/')[2] : '';
  const quoteHref = quote === 'jump' ? '#brief' : job ? `/how-it-works?job=${job}#brief` : '/how-it-works#brief';

  return (
    <nav aria-label="Quick links" data-phone-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden">
      <div className="mx-auto grid h-16 max-w-[560px] grid-cols-[1fr_auto_1fr] items-center px-2 max-[379px]:px-1.5">
        {quote ? (
          <Link
            href={quoteHref}
            onClick={(e) => {
              if (quote !== 'jump') return;
              const brief = document.getElementById('brief');
              if (!brief) return;
              e.preventDefault();
              brief.scrollIntoView({ behavior: smooth(), block: 'start' });
            }}
            aria-label={n ? `Get my free quote in 3 steps. ${n} saved for your brief` : 'Get my free quote in 3 steps'}
            data-bar-end="quote"
            className="flex items-center gap-2 justify-self-start rounded-full pr-1 text-accent max-[379px]:gap-1.5"
          >
            <span className={`${circle} bg-accent text-on-accent shadow-[0_6px_18px_-6px_rgb(37_71_208/0.6)]`}>
              <TapeIcon size={24} />
              {n ? (
                <span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-paper bg-on-accent px-1 font-mono text-[11px] leading-none text-accent">
                  {n}
                </span>
              ) : null}
            </span>
            <span aria-hidden="true" data-bar-label className={label}>
              3 step
              <br />
              quote
            </span>
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}

        <div className="flex items-center gap-1 max-[379px]:gap-0.5" data-bar-middle>
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
            onClick={() => window.scrollTo({ top: 0, behavior: smooth() })}
            aria-label="Back to the top"
            data-bar-top={down ? 'on' : 'off'}
            className={`${mid} ${down ? on : off}`}
          >
            <Arrow up />
            Top
          </button>
        </div>

        <a
          href={wa}
          target="_blank"
          rel="noopener"
          aria-label="Message Raf on WhatsApp"
          data-bar-end="wa"
          className="flex items-center gap-2 justify-self-end rounded-full pl-1 text-right text-ink max-[379px]:gap-1.5"
        >
          <span aria-hidden="true" data-bar-label className={label}>
            WhatsApp
            <br />
            me
          </span>
          <span className={`${circle} bg-whatsapp text-white`}>
            <SocialIcon network="whatsapp" size={24} />
          </span>
        </a>
      </div>
    </nav>
  );
}
