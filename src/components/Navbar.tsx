'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PHONE_DISPLAY, PHONE_HREF, QUOTE_HREF } from '@/lib/site';
import type { MenuPanel } from '@/lib/menu-panels';
import MenuPanelView, { MenuTags } from './MenuPanel';

const links = [
  { href: '/services', label: 'Services' },
  { href: '/portfolio', label: 'My Work' },
  { href: '/designs', label: '3D designs' },
  { href: '/sketchup', label: 'SketchUp' },
  { href: '/cabinetos', label: 'CabinetOS' },
  { href: '/blog', label: 'Blog' },
  { href: '/tools', label: 'Tools' },
  { href: '/about', label: 'About' },
];


/* Each menu item has a panel (src/lib/menu-panels.ts): on a computer it drops down when the mouse rests on the
   item (after a short pause, so passing over the menu doesn't flash it) or when the item gets keyboard focus, and
   closes when the mouse leaves the menu and panel, on Escape, or on a new page. Touch screens never get it: a tap
   goes straight to the page. On the phone menu the same tags open under a + beside each item. */
export default function Navbar({ menu = {} }: { menu?: Record<string, MenuPanel> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shown, setShown] = useState<string | null>(null); // computer: the item whose panel is open
  const [expanded, setExpanded] = useState<string | null>(null); // phone menu: the item whose tags are open
  const openTimer = useRef(0);
  const closeTimer = useRef(0);
  const show = (href: string, now = false) => {
    if (!menu[href]) return;
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    if (now || shown) setShown(href);
    else openTimer.current = window.setTimeout(() => setShown(href), 180);
  };
  const hide = (delay = 250) => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setShown(null), delay);
  };
  const keep = () => window.clearTimeout(closeTimer.current);
  useEffect(() => {
    setShown(null);
    setOpen(false);
    setExpanded(null);
  }, [pathname]);
  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShown(null);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [shown]);
  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    [],
  );
  const panel = shown ? menu[shown] : undefined;
  // On a job page, Get a quote carries the job so the brief can name it.
  const jobSlug = pathname?.startsWith('/portfolio/') ? pathname.split('/')[2] : '';
  const quoteHref = jobSlug ? `${QUOTE_HREF}?job=${jobSlug}` : QUOTE_HREF;

  return (
    <header
      className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShown(null);
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-5 max-[379px]:gap-2 md:h-[72px] md:gap-8 md:px-10">
        <Link href="/" className="flex items-center gap-3 whitespace-nowrap text-[17px] font-semibold tracking-tight max-[379px]:gap-2 max-[379px]:text-[16px]">
          <span className="h-9 w-9 flex-none overflow-hidden rounded-full bg-[#f4f1ea] ring-1 ring-line-strong">
            <Image src="/images/r-logo-final.png" alt="" width={36} height={36} className="h-full w-full object-cover" />
          </span>
          {/* Very narrow phones (under 350 px) show the R only, so the header never runs off the side. */}
          <span className="max-[349px]:sr-only">Raf Carpentry</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href || pathname.startsWith(l.href + '/') ? 'page' : undefined}
              onPointerEnter={(e) => e.pointerType === 'mouse' && show(l.href)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
              onFocus={(e) => e.currentTarget.matches(':focus-visible') && show(l.href, true)}
              onClick={() => setShown(null)}
              className={`whitespace-nowrap rounded-sm px-2 py-2 text-[15px] transition-colors hover:text-ink aria-[current=page]:text-accent xl:px-3 ${shown === l.href ? 'text-ink shadow-[inset_0_-2px_0_var(--color-accent)]' : 'text-muted'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 max-[379px]:gap-2 lg:ml-0 lg:gap-5">
          <a href={PHONE_HREF} className="hidden whitespace-nowrap font-mono text-sm text-ink xl:inline">
            {PHONE_DISPLAY}
          </a>
          <Link
            href={quoteHref}
            className="btn btn-primary btn-sm max-[379px]:px-3.5"
            onClick={(e) => {
              // Already on the page: go back to its top.
              if (pathname === QUOTE_HREF) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                history.replaceState(history.state, '', window.location.pathname + window.location.search);
              }
            }}
          >
            Get a quote
          </Link>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-line-strong text-ink lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 7h14M3 13h14" />}
            </svg>
          </button>
        </div>
      </div>

      {panel ? (
        <div
          id="menu-panel"
          aria-label={panel.title}
          role="region"
          onPointerEnter={(e) => e.pointerType === 'mouse' && keep()}
          onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
          className="absolute inset-x-0 top-full hidden border-b border-line-strong bg-mount shadow-[0_24px_48px_rgb(22_25_28_/_0.12)] lg:block"
        >
          <MenuPanelView panel={panel} onPick={() => setShown(null)} />
        </div>
      ) : null}

      {open && (
        <nav aria-label="Mobile" className="max-h-[calc(100dvh-64px)] overflow-y-auto border-t border-line bg-paper px-5 pb-6 pt-2 lg:hidden">
          {[...links, { href: '/how-it-works', label: 'Plan your project' }, { href: '/contact', label: 'Contact' }].map((l) => {
            const p = menu[l.href];
            const isOpen = expanded === l.href;
            return (
              <div key={l.href} className="border-b border-line">
                <div className="flex items-center">
                  <Link href={l.href} onClick={() => setOpen(false)} className="block flex-1 py-3.5 text-[17px] text-ink">
                    {l.label}
                  </Link>
                  {p ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : l.href)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} what's on ${l.label}`}
                      className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-accent"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        {isOpen ? <path d="M3 8h10" /> : <path d="M3 8h10M8 3v10" />}
                      </svg>
                    </button>
                  ) : null}
                </div>
                {p && isOpen ? (
                  <div className="pb-4">
                    <MenuTags tags={p.tags} small onPick={() => setOpen(false)} />
                    {p.list?.length ? (
                      <ul className="mt-3 grid gap-1">
                        {p.list.map((x) => (
                          <li key={x.href}>
                            <Link href={x.href} onClick={() => setOpen(false)} className="block py-1.5 text-[15px] text-muted">
                              {x.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          <a href={PHONE_HREF} className="mt-5 block font-mono text-[15px] text-ink">
            {PHONE_DISPLAY}
          </a>
        </nav>
      )}
    </header>
  );
}
