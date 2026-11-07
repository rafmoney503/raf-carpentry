'use client';

/* The back link at the top of every page under the menu (7 Nov 2026, Raf: "sometimes we are missing a back button
   navigating between pages"). One place, the same on every page:
   - came from another page on this site: "‹ Back to Fitted wardrobes", which goes back in the browser, so they land
     where they were on that page;
   - arrived straight from outside: "‹ Services", the page above this one (Home for the top pages).
   The trail is in src/lib/back-trail.ts. LayoutShell calls useBackTrail() on every page, the apps without a menu
   included, so a trip through them is on the trail too. */

import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nameOf, nameVisit, noteVisit, pathKey, upOf, type Stop } from '@/lib/back-trail';

type Snap = { path: string; prev: Stop | null };

let snap: Snap | null = null;
let started = false;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const publish = (s: Snap) => {
  snap = s;
  listeners.forEach((fn) => fn());
};

/* Notes each page shown on the tab's trail (LayoutShell, every page). */
export function useBackTrail() {
  const pathname = usePathname();
  useEffect(() => {
    const p = pathKey(pathname || '/');
    const t = noteVisit(p, !started);
    started = true;
    publish({ path: p, prev: t.length >= 2 ? t[t.length - 2] : null });
    // its name for the next page's "Back to ...", once its heading is drawn
    const name = () => nameVisit(p, document.querySelector('main h1')?.textContent);
    const frame = requestAnimationFrame(name);
    const late = window.setTimeout(name, 1500);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(late);
    };
  }, [pathname]);
}

/* Where back goes from this page, and what it's called. Before the page has run in the browser (and on the
   server) it's the page above, so the first paint has a working link. */
function useBack() {
  const pathname = usePathname();
  const s = useSyncExternalStore(subscribe, () => snap, () => null);
  const p = pathKey(pathname || '/');
  const prev = s && s.path === p ? s.prev : null;
  if (prev) {
    const n = prev.n || nameOf(prev.p);
    return { p, href: prev.p, label: n ? `Back to ${n}` : 'Back', history: true };
  }
  const up = upOf(p);
  return { p, href: up.href, label: up.name, history: false };
}

const back = (history: boolean) => (e: React.MouseEvent<HTMLAnchorElement>) => {
  if (!history || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (window.history.length < 2) return; // nothing to go back to: follow the link instead
  e.preventDefault();
  window.history.back();
};

/* Pages that have their own way back, or none at all: the home page, the planner (its own header has it),
   the private pages for one customer, Raf's own tools. */
function hidden(p: string) {
  return (
    p === '/' ||
    p === '/wardrobe-planner' ||
    p === '/cost' ||
    p.startsWith('/d/') ||
    p.startsWith('/ideas/') ||
    p.startsWith('/review') ||
    p.startsWith('/editor') ||
    p.startsWith('/drawings/thanks')
  );
}

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </svg>
  );
}

export default function BackBar() {
  const { p, href, label, history } = useBack();
  if (hidden(p)) return null;
  return (
    <div className="mx-auto -mb-4 w-full max-w-[1280px] px-5 pt-2 md:-mb-8 md:px-10 md:pt-4" data-back-bar>
      <Link
        href={href}
        onClick={back(history)}
        data-back={history ? 'history' : 'up'}
        className="-ml-2 inline-flex h-10 max-w-full items-center gap-1 rounded-[2px] px-2 font-mono text-[13px] text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        <Chevron className="flex-none" />
        <span className="truncate">{label}</span>
      </Link>
    </div>
  );
}

/* The same back, as an icon, for a page with a header of its own (the wardrobe planner). */
export function BackIcon({ className = '' }: { className?: string }) {
  const { href, label, history } = useBack();
  return (
    <Link href={href} onClick={back(history)} aria-label={label} title={label} data-back={history ? 'history' : 'up'} className={className}>
      <Chevron />
    </Link>
  );
}
