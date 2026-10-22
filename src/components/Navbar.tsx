'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { PHONE_DISPLAY, PHONE_HREF, QUOTE_HREF } from '@/lib/site';
import type { MenuPanel } from '@/lib/menu-panels';
import MenuPanelView, { MenuFeatureRow, MenuTags } from './MenuPanel';
import { PLANNER_HREF, PLANNER_IMAGE_SQUARE } from '@/lib/planner-picture';
import SiteSearch from './SiteSearch';
import PullSearch from './PullSearch';
import { MiniLevel } from './ScrollLevel';
import { getDock, getUndocked, subscribeDock } from '@/lib/scroll-level';

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
   goes straight to the page. On the phone menu the same tags open under a + beside each item.
   Search (src/components/SiteSearch.tsx): the magnifier on a computer (or / or Ctrl+K) opens it under the header;
   on a phone it is the box at the top of the menu. */
export default function Navbar({ menu = {} }: { menu?: Record<string, MenuPanel> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shown, setShown] = useState<string | null>(null); // computer: the item whose panel is open
  const [expanded, setExpanded] = useState<string | null>(null); // phone menu: the item whose tags are open
  const [searching, setSearching] = useState(false); // computer: the search panel is open
  const [phoneSearch, setPhoneSearch] = useState(false); // phone menu: something is typed in its search box
  // The spirit level beside the logo (src/components/ScrollLevel.tsx). On the home page it docks once the big level
  // under the title has scrolled up under the header. Every other page (17 Oct 2026, Raf: 'can we have it on every
  // page') docks it once the page has scrolled 160 px: an invisible marker at the top of the page leaves the screen.
  // That is an IntersectionObserver, not a scroll listener; the level only listens to scrolling while it shows.
  const level = useSyncExternalStore(subscribeDock, getDock, getUndocked);
  const topMark = useRef<HTMLSpanElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = topMark.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const docked = level.present ? level.docked : scrolled;
  const openTimer = useRef(0);
  const closeTimer = useRef(0);
  const show = (href: string, now = false) => {
    if (!menu[href] || searching) return;
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
    setSearching(false);
    setPhoneSearch(false);
  }, [pathname]);
  useEffect(() => {
    if (!shown && !searching) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShown(null);
        setSearching(false);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [shown, searching]);
  // "/" or Ctrl+K (Cmd+K on a Mac) opens search on a computer, unless the visitor is typing somewhere.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const k = e.key.toLowerCase();
      if (((k === '/' && !typing) || (k === 'k' && (e.ctrlKey || e.metaKey))) && window.matchMedia('(min-width: 1024px)').matches) {
        e.preventDefault();
        setShown(null);
        setSearching(true);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
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
    <>
    <span ref={topMark} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-[160px] w-px" />
    {/* touch screens: pull down at the top of a page to search (src/components/PullSearch.tsx) */}
    <PullSearch disabled={open || searching} />
    <header
      className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShown(null);
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-5 max-[379px]:gap-2 md:h-[72px] md:gap-8 md:px-10 lg:gap-4 xl:gap-8">
        <Link href="/" className="flex items-center gap-3 whitespace-nowrap text-[17px] font-semibold tracking-tight max-[379px]:gap-2 max-[379px]:text-[16px]">
          <span className="h-9 w-9 flex-none overflow-hidden rounded-full bg-[#f4f1ea] ring-1 ring-line-strong">
            <Image src="/images/r-logo-final.png" alt="" width={36} height={36} className="h-full w-full object-cover" />
          </span>
          {/* Very narrow phones (under 350 px) show the R only, so the header never runs off the side. While the small
              spirit level is docked the name makes way for it at every width (the menu bar is full from 1024 px). */}
          <span className={docked ? 'sr-only' : 'max-[349px]:sr-only'}>Raf Carpentry</span>
        </Link>
        {docked ? <MiniLevel /> : null}

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

        <div className="ml-auto flex items-center gap-2.5 max-[379px]:gap-2 lg:ml-0 lg:gap-3 xl:gap-5">
          <button
            type="button"
            onClick={() => {
              setShown(null);
              setSearching((v) => !v);
            }}
            aria-label={searching ? 'Close search' : 'Search the website'}
            aria-expanded={searching}
            aria-controls="site-search"
            title="Search (/)"
            className={`hidden h-11 w-11 items-center justify-center rounded-sm border text-ink transition-colors lg:inline-flex ${searching ? 'border-ink bg-mount' : 'border-line-strong hover:border-ink'}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {searching ? <path d="M6 6l12 12M18 6L6 18" /> : <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>}
            </svg>
          </button>
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

      {searching ? (
        <>
          <div aria-hidden="true" onClick={() => setSearching(false)} className="absolute inset-x-0 top-full hidden h-[100dvh] bg-paper/60 lg:block" />
          <div id="site-search" className="absolute inset-x-0 top-full hidden border-b border-line-strong bg-mount shadow-[0_24px_48px_rgb(22_25_28_/_0.12)] lg:block">
            <div className="mx-auto max-w-[1280px] px-10 pb-8 pt-6">
              <SiteSearch layout="panel" autoFocus onPick={() => setSearching(false)} />
            </div>
          </div>
        </>
      ) : null}

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
          <div className="pb-2 pt-2">
            <SiteSearch layout="menu" onPick={() => setOpen(false)} onActive={setPhoneSearch} />
            {phoneSearch ? null : (
              <p className="mt-2 hidden font-mono text-[12px] text-faint [@media(pointer:coarse)]:block">Tip: pull down at the top of any page to search.</p>
            )}
          </div>
          {phoneSearch ? null : [
            ...links.flatMap((l) => (l.href === '/designs' ? [l, { href: '/wardrobe-planner', label: 'Wardrobe planner' }] : [l])),
            { href: '/how-it-works', label: 'Plan your project' },
            { href: '/contact', label: 'Contact' },
          ].map((l) => {
            const p = menu[l.href];
            const isOpen = expanded === l.href;
            return (
              <div key={l.href} className="border-b border-line">
                <div className="flex items-center">
                  <Link href={l.href} onClick={() => setOpen(false)} className="flex flex-1 items-center justify-between gap-3 py-3.5 text-[17px] text-ink">
                    {l.label}
                    {l.href === PLANNER_HREF ? (
                      <span className="relative -my-2 block h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-line-strong bg-paper">
                        <Image src={PLANNER_IMAGE_SQUARE} alt="" fill sizes="48px" className="object-cover" />
                      </span>
                    ) : null}
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
                    {p.feature ? <MenuFeatureRow feature={p.feature} onPick={() => setOpen(false)} /> : null}
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
          {phoneSearch ? null : (
            <a href={PHONE_HREF} className="mt-5 block font-mono text-[15px] text-ink">
              {PHONE_DISPLAY}
            </a>
          )}
        </nav>
      )}
    </header>
    </>
  );
}
