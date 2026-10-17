'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONTACT_ITEM, MENU, tagHref, type MenuItem } from '@/lib/menu';
import TapeSearch from './TapeSearch';
import BounceCta from './BounceCta';

/* The menu, the same way rafcarpentry.com works.
   Computer (mouse): resting on a menu item for a moment drops a panel under the header with what the page is and its
   sections as # tags. Moving to another item swaps the panel; leaving the menu and the panel closes it; Escape, a
   click or a new page close it too. Keyboard focus opens it. Touch screens never get the panel: a tap goes to the page.
   Phone: the Menu button opens the list; the + beside each item opens its # tags under it. */

const OPEN_DELAY = 160;
const CLOSE_DELAY = 260;

/* The logo plays one move made of all three ideas: the mark tips and the yellow corner rolls off as a ball (level),
   the ball rolls once round the square (rail), then the whole mark turns into the ball, bounces and comes back as rs
   (drift). It plays shortly after the page opens, when a mouse rests on it, and every 30 seconds while the tab is
   open. People who ask their phone for less motion never see it move. */
const LOGO_MOVE_MS = 4800;
const LOGO_FIRST_MS = 1400;
const LOGO_EVERY_MS = 30000;

export default function Header() {
  const pathname = usePathname();
  const [panel, setPanel] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false); // phone menu
  const [expanded, setExpanded] = useState<string | null>(null); // phone: which item's tags are open
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const [logoMove, setLogoMove] = useState(false);
  const logoTimer = useRef<number | undefined>(undefined);
  const logoPlaying = useRef(false);

  const playLogo = useCallback(() => {
    if (logoPlaying.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    logoPlaying.current = true;
    setLogoMove(true);
    logoTimer.current = window.setTimeout(() => {
      logoPlaying.current = false;
      setLogoMove(false);
    }, LOGO_MOVE_MS + 80);
  }, []);

  useEffect(() => {
    const first = window.setTimeout(playLogo, LOGO_FIRST_MS);
    const every = window.setInterval(() => {
      if (document.visibilityState === 'visible') playLogo();
    }, LOGO_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.clearTimeout(logoTimer.current);
    };
  }, [playLogo]);

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };
  const closeAll = useCallback(() => {
    clearTimers();
    setPanel(null);
    setOpen(false);
  }, []);

  // A new page closes everything.
  useEffect(() => {
    closeAll();
    setExpanded(null);
  }, [pathname, closeAll]);

  useEffect(() => {
    if (!panel && !open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeAll();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, open, closeAll]);

  const hoverIn = (item: MenuItem) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimers();
    if (panel) setPanel(item);
    else openTimer.current = window.setTimeout(() => setPanel(item), OPEN_DELAY);
  };
  const hoverOut = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setPanel(null), CLOSE_DELAY);
  };
  const keep = () => window.clearTimeout(closeTimer.current);

  const isHere = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="site-head">
      <div className="wrap">
        <div className="head-row">
          <Link
            href="/"
            className="logo"
            aria-label="Rafal Solutions home"
            onPointerEnter={(e) => e.pointerType === 'mouse' && playLogo()}
            onFocus={(e) => e.currentTarget.matches(':focus-visible') && playLogo()}
          >
            <span className={`logo-mark${logoMove ? ' move' : ''}`} aria-hidden="true">
              <span className="logo-letters">rs</span>
              <span className="logo-ball" />
            </span>
            <span className="logo-name">Rafal Solutions</span>
          </Link>

          <nav className="nav" aria-label="Main" onPointerLeave={hoverOut} onPointerEnter={keep}>
            {MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${isHere(item.href) ? ' here' : ''}${panel?.href === item.href ? ' open' : ''}`}
                aria-current={isHere(item.href) ? 'page' : undefined}
                onPointerEnter={hoverIn(item)}
                onFocus={(e) => {
                  if (e.currentTarget.matches(':focus-visible')) {
                    clearTimers();
                    setPanel(item);
                  }
                }}
                onClick={() => setPanel(null)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="head-actions">
            <TapeSearch
              onOpen={() => {
                clearTimers();
                setPanel(null);
                setOpen(false);
              }}
            />
            <BounceCta onPointerEnter={() => setPanel(null)} />
            <button type="button" className="menu-btn" aria-label={open ? 'Close the menu' : 'Menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((v) => !v)}>
              <span className="menu-word">{open ? 'Close' : 'Menu'}</span>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Computer: the panel under the header */}
      {panel ? (
        <>
          <div className="panel-shade" aria-hidden="true" onClick={() => setPanel(null)} />
          <div className="menu-panel" onPointerEnter={keep} onPointerLeave={hoverOut}>
            <div className="wrap panel-row">
              <div className="panel-info">
                <p className="kicker">{panel.kicker}</p>
                <p className="panel-title">{panel.title}</p>
                <p className="body small" style={{ fontSize: 15 }}>
                  {panel.line}
                </p>
                <Link href={panel.href} className="link-more" onClick={() => setPanel(null)}>
                  Open the page <span aria-hidden="true">→</span>
                </Link>
              </div>
              <div className="panel-tags" aria-label={`Sections on ${panel.label}`}>
                <p className="kicker">On this page</p>
                <div className="tags">
                  {panel.tags.map((t) => (
                    <Link key={t.id} href={tagHref(panel, t)} className="tag" onClick={() => setPanel(null)}>
                      <span aria-hidden="true">#</span>
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Phone: the menu list, each item with a + for its sections */}
      {open ? (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Main">
          <div className="wrap">
            {[...MENU, CONTACT_ITEM].map((item) => {
              const tagsOpen = expanded === item.href;
              return (
                <div key={item.href} className="mm-item">
                  <div className="mm-row">
                    <Link href={item.href} className={`mm-link${isHere(item.href) ? ' here' : ''}`} aria-current={isHere(item.href) ? 'page' : undefined} onClick={() => setOpen(false)}>
                      {item.label}
                    </Link>
                    <button
                      type="button"
                      className="mm-plus"
                      aria-expanded={tagsOpen}
                      aria-controls={`mm-${item.href.slice(1)}`}
                      aria-label={`${tagsOpen ? 'Hide' : 'Show'} the sections on ${item.label}`}
                      onClick={() => setExpanded(tagsOpen ? null : item.href)}
                    >
                      <span aria-hidden="true">{tagsOpen ? '−' : '+'}</span>
                    </button>
                  </div>
                  {tagsOpen ? (
                    <div id={`mm-${item.href.slice(1)}`} className="tags mm-tags">
                      {item.tags.map((t) => (
                        <Link key={t.id} href={tagHref(item, t)} className="tag" onClick={() => setOpen(false)}>
                          <span aria-hidden="true">#</span>
                          {t.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Link href="/contact" className="btn" style={{ marginTop: 18, width: '100%' }} onClick={() => setOpen(false)}>
              Tell me the problem
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
