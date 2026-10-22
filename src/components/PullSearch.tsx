'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import SiteSearch, { KIND_LABEL, loadSearchIndex } from './SiteSearch';
import { useSaved } from '@/lib/saved';
import type { RecentItem } from '@/lib/recent-designs';
import type { SearchEntry } from '@/lib/site-search';
import { QUOTE_HREF, whatsappUrl } from '@/lib/site';

/* Pull down to search, on touch screens (Raf, 22 Oct 2026, after the Claude app's sidebar: 'when pull down page search
   turn blue and pop-up whole search and things I might be interested'). At the very top of a page, a finger pulling
   down drags the page down a little and a round magnifier comes out from under the header; once it has come far
   enough its ring is full and it turns blue, and letting go opens the search full screen with the keyboard up.
   Under the Try words it shows what this visitor might want next, all real: pages they looked at on this site
   (kept in their browser, raf_seen), what they saved for their brief, jobs other visitors looked at or saved in the
   past week (/api/recent, as the Recently looked at card), the 3D designs by type and four quick links.
   The pull only starts at scroll 0, on a page's own content (not the header, a box being typed in, a 3D view or a
   sideways row being swiped), with one finger, when the page isn't zoomed or covered by a viewer; while it pulls,
   the browser's own pull-to-refresh and bounce are held back (a touchmove listener that can cancel is attached only
   while the page is at the top, so scrolling elsewhere stays passive). Cancel, Escape or Back closes the search;
   a result opens in place of the search's own history entry, so Back from it goes to the page underneath.
   Not on the pages that are full-screen tools (planner, calculator, game, spirit level). */

const TRIGGER = 58; // px the page moves before letting go opens search
const MAX_PULL = 120;
const NO_PULL = ['/wardrobe-planner', '/calculator', '/tools/timber-stack', '/tools/spirit-level'];
const SKIP_TARGETS = 'header, input, textarea, select, [contenteditable="true"], canvas, video, [data-no-pull], [role="dialog"], [aria-modal="true"]';

const SEEN = 'raf_seen';
const MAX_SEEN = 8;
type Seen = { p: string; t: string; at: number };
const NOT_SEEN = /^\/(?:$|d\/|review|editor|admin|job-kit|ms(?:\/|$)|privacy|planner\/)/;

function readSeen(): Seen[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN) || '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.p === 'string' && x.p.startsWith('/') && typeof x.t === 'string').slice(0, MAX_SEEN) : [];
  } catch {
    return [];
  }
}

function noteSeen(path: string) {
  if (NOT_SEEN.test(path)) return;
  const h1 = document.querySelector('main h1')?.textContent?.replace(/\s+/g, ' ').trim();
  const t = (h1 || document.title.replace(/\s*\|\s*Raf Carpentry.*$/i, '')).slice(0, 90);
  if (!t) return;
  try {
    localStorage.setItem(SEEN, JSON.stringify([{ p: path, t, at: Date.now() }, ...readSeen().filter((x) => x.p !== path)].slice(0, MAX_SEEN)));
  } catch {
    /* storage blocked: nothing remembered */
  }
}

let recentCache: { at: number; items: RecentItem[] } | null = null;

const damp = (d: number) => Math.min(MAX_PULL, d <= 0 ? 0 : d < 140 ? d * 0.5 : 70 + (d - 140) * 0.22);

/* Something under the finger that scrolls on its own and isn't at its top, or a sideways row: leave it alone. */
function innerScrolled(el: Element | null) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0) return true;
  }
  return false;
}

export default function PullSearch({ disabled = false }: { disabled?: boolean }) {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const off = disabled || NO_PULL.includes(pathname);
  const offRef = useRef(off);
  useEffect(() => {
    offRef.current = off || open;
  }, [off, open]);
  const ind = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const sentinel = useRef<HTMLSpanElement>(null);
  const pushed = useRef(false);
  const proxy = useRef<HTMLInputElement | null>(null);
  const g = useRef({ on: false, decided: 0, x0: 0, y0: 0, pull: 0, armed: false, top: 64, main: null as HTMLElement | null });

  // remember the pages looked at, for Jump back in
  useEffect(() => {
    const t = window.setTimeout(() => noteSeen(pathname), 600);
    return () => clearTimeout(t);
  }, [pathname]);

  const paint = useCallback((pull: number, armed: boolean, ease = false) => {
    const { main, top } = g.current;
    const tr = ease && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'transform 280ms cubic-bezier(.2,.8,.2,1), opacity 200ms' : 'none';
    if (main) {
      main.style.transition = tr;
      main.style.transform = pull ? `translate3d(0,${pull}px,0)` : 'translate3d(0,0,0)';
    }
    const el = ind.current;
    if (el) {
      const k = Math.min(1, pull / TRIGGER);
      el.style.transition = tr;
      el.style.opacity = String(Math.min(1, pull / 26));
      el.style.transform = `translate3d(0,${top + pull / 2 - 20}px,0) scale(${0.72 + 0.28 * k})`;
      if (ring.current) ring.current.style.strokeDashoffset = String(138.2 * (1 - k));
    }
    if (dot.current) dot.current.dataset.armed = armed ? '1' : '0';
  }, []);

  const settle = useCallback(() => {
    paint(0, false, true);
    window.setTimeout(() => {
      const m = g.current.main;
      if (m && !g.current.on) {
        m.style.transform = '';
        m.style.transition = '';
      }
    }, 320);
  }, [paint]);

  const close = useCallback(() => {
    setShown(false);
    setOpen(false);
    if (pushed.current && (history.state as { rafSearch?: boolean } | null)?.rafSearch) history.back();
    pushed.current = false;
  }, []);

  // a result or suggestion was picked: it opens in place of the search's history entry, so no Back here
  const picked = useCallback(() => {
    pushed.current = false;
    setShown(false);
    setOpen(false);
  }, []);

  const openSearch = useCallback(() => {
    // iPhones only bring the keyboard up for a focus made inside the touch itself: focus a stand-in box now, and the
    // real box takes the focus over when it appears (the keyboard stays up).
    const p = document.createElement('input');
    p.setAttribute('aria-hidden', 'true');
    p.tabIndex = -1;
    p.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
    document.body.appendChild(p);
    p.focus({ preventScroll: true });
    proxy.current = p;
    history.pushState({ ...(history.state ?? {}), rafSearch: true }, '');
    pushed.current = true;
    setOpen(true);
  }, []);

  // the gesture
  useEffect(() => {
    if (window.top !== window.self) return; // the Job Kit's heatmaps show pages in a frame
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const st = g.current;

    const start = (e: TouchEvent) => {
      st.on = false;
      if (offRef.current || e.touches.length !== 1 || window.scrollY > 0) return;
      if ((window.visualViewport?.scale ?? 1) > 1.01) return;
      if (document.documentElement.style.overflow === 'hidden' || document.body.style.overflow === 'hidden') return;
      const t = e.target as Element | null;
      if (!t || t.closest(SKIP_TARGETS) || innerScrolled(t)) return;
      st.main = document.querySelector('main');
      st.top = document.querySelector('header')?.getBoundingClientRect().bottom ?? 64;
      st.on = true;
      st.decided = 0;
      st.x0 = e.touches[0].clientX;
      st.y0 = e.touches[0].clientY;
      st.pull = 0;
      st.armed = false;
    };
    const move = (e: TouchEvent) => {
      if (!st.on) return;
      if (e.touches.length !== 1 || window.scrollY > 0) {
        if (st.decided === 1) settle();
        st.on = false;
        return;
      }
      const dx = e.touches[0].clientX - st.x0;
      const dy = e.touches[0].clientY - st.y0;
      if (st.decided === 0) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        if (dy > 0 && dy >= Math.abs(dx) && e.cancelable) st.decided = 1;
        else {
          st.on = false;
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      st.pull = damp(dy);
      const armed = st.armed ? st.pull >= TRIGGER - 8 : st.pull >= TRIGGER;
      if (armed && !st.armed) navigator.vibrate?.(8);
      st.armed = armed;
      paint(st.pull, armed);
    };
    const end = () => {
      if (!st.on) return;
      st.on = false;
      if (st.decided !== 1) return;
      if (st.armed && !offRef.current) openSearch();
      settle();
    };
    const cancel = () => {
      if (st.on && st.decided === 1) settle();
      st.on = false;
    };

    // a listener that can stop the page moving, only while the page is at its top
    let attached = false;
    const attach = (on: boolean) => {
      if (on === attached) return;
      attached = on;
      if (on) document.addEventListener('touchmove', move, { passive: false });
      else document.removeEventListener('touchmove', move);
    };
    const io = new IntersectionObserver(([en]) => attach(en.isIntersecting && en.intersectionRatio >= 1), { threshold: [0, 1] });
    if (sentinel.current) io.observe(sentinel.current);
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      io.disconnect();
      attach(false);
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', cancel);
    };
  }, [paint, settle, openSearch]);

  // the open search: slides in, holds the page still, Escape and Back close it, a new page closes it
  useEffect(() => {
    if (!open) return;
    proxy.current?.remove();
    proxy.current = null;
    const r = requestAnimationFrame(() => setShown(true));
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const pop = () => {
      pushed.current = false;
      setShown(false);
      setOpen(false);
    };
    document.addEventListener('keydown', key);
    window.addEventListener('popstate', pop);
    return () => {
      cancelAnimationFrame(r);
      html.style.overflow = prev;
      document.removeEventListener('keydown', key);
      window.removeEventListener('popstate', pop);
    };
  }, [open, close]);

  return (
    <>
      <span ref={sentinel} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-px w-px" />
      <div ref={ind} aria-hidden="true" className="pointer-events-none fixed left-1/2 top-0 z-40 -ml-5 hidden h-10 w-10 opacity-0 [@media(pointer:coarse)]:block">
        <div
          ref={dot}
          data-armed="0"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-mount text-ink shadow-[0_6px_18px_rgb(22_25_28/0.14)] transition-colors duration-150 data-[armed=1]:border-accent data-[armed=1]:bg-accent data-[armed=1]:text-on-accent"
        >
          <svg className="absolute -inset-[5px] h-12 w-12 -rotate-90" viewBox="0 0 48 48" fill="none">
            <circle ref={ring} cx="24" cy="24" r="22" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeDasharray="138.2" strokeDashoffset="138.2" />
          </svg>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5L21 21" />
          </svg>
        </div>
      </div>
      {open ? <SearchSheet shown={shown} onClose={close} onPick={picked} pathname={pathname} /> : null}
    </>
  );
}

function SearchSheet({ shown, onClose, onPick, pathname }: { shown: boolean; onClose: () => void; onPick: () => void; pathname: string }) {
  const box = useRef<HTMLDivElement>(null);
  // keep the sheet to the part of the screen the keyboard leaves
  useEffect(() => {
    const vv = window.visualViewport;
    const el = box.current;
    if (!vv || !el) return;
    const fit = () => {
      el.style.height = `${vv.height}px`;
      el.style.top = `${vv.offsetTop}px`;
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
    };
  }, []);

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label="Search the website"
      className={`fixed inset-x-0 top-0 z-[60] flex h-[100dvh] flex-col bg-paper transition duration-200 motion-reduce:transition-none ${shown ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'}`}
    >
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-[max(12px,env(safe-area-inset-top))]"
        onTouchMove={() => {
          // scrolling the suggestions puts the keyboard away, as on an iPhone
          const a = document.activeElement as HTMLElement | null;
          if (a?.tagName === 'INPUT') a.blur();
        }}
      >
        <div className="mx-auto max-w-[640px]">
          <SiteSearch
            layout="sheet"
            autoFocus
            replace
            onPick={onPick}
            after={
              <button type="button" onClick={onClose} className="h-12 flex-none px-2 text-[16px] font-medium text-accent">
                Cancel
              </button>
            }
            idle={<Suggestions pathname={pathname} onPick={onPick} />}
          />
        </div>
      </div>
    </div>
  );
}

function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">{children}</h2>
      {right}
    </div>
  );
}

function Suggestions({ pathname, onPick }: { pathname: string; onPick: () => void }) {
  const saved = useSaved();
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  // only drawn in the browser, once the search is open, so reading storage here is safe
  const [seen] = useState<Seen[]>(() => readSeen().filter((x) => x.p !== pathname).slice(0, 4));
  const [recent, setRecent] = useState<RecentItem[] | null>(recentCache?.items ?? null);

  useEffect(() => {
    loadSearchIndex().then(setIndex, () => setIndex([]));
    if (recentCache && Date.now() - recentCache.at < 5 * 60_000) return;
    let gone = false;
    fetch('/api/recent', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .catch(() => ({ items: [] }))
      .then((d: { items?: RecentItem[] }) => {
        const items = (d.items ?? []).slice(0, 6);
        recentCache = { at: Date.now(), items };
        if (!gone) setRecent(items);
      });
    return () => {
      gone = true;
    };
  }, [pathname]);

  const byHref = new Map((index ?? []).map((e) => [e.href, e]));
  const kinds = (index ?? []).filter((e) => e.k === 'design');
  const here = pathname.match(/^\/portfolio\/([a-z0-9-]+)/)?.[1];
  const others = (recent ?? []).filter((r) => r.slug !== here).slice(0, 5);

  return (
    <div className="mt-7 grid gap-7">
      {seen.length ? (
        <section>
          <Heading>Jump back in</Heading>
          <ul className="grid gap-1">
            {seen.map((s) => {
              const e = byHref.get(s.p);
              return (
                <li key={s.p}>
                  <Link href={s.p} replace onClick={onPick} className="group flex items-center gap-3 rounded-sm py-1.5 text-ink">
                    <span className="relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden border border-line bg-raised text-faint">
                      {e?.img ? (
                        <Image src={e.img} alt="" fill sizes="44px" className="object-cover" />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                          <path d="M7 3.5h7l4 4V20.5H7z" />
                          <path d="M10 11h5M10 14.5h5M10 18h3" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-[620] leading-snug group-hover:text-accent">{e?.title ?? s.t}</span>
                      <span className="block truncate font-mono text-[12.5px] text-faint">
                        {!e ? 'Page' : e.sub?.startsWith(KIND_LABEL[e.k]) ? e.sub : `${KIND_LABEL[e.k]}${e.sub ? ` · ${e.sub}` : ''}`}
                      </span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="flex-none text-faint">
                      <path d="M6 3.5L10.5 8 6 12.5" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {saved.length ? (
        <section>
          <Heading
            right={
              <Link href={`${QUOTE_HREF}#brief`} replace onClick={onPick} className="text-[14px] font-medium text-accent">
                Open your brief <span aria-hidden="true">→</span>
              </Link>
            }
          >
            Saved for your brief · {saved.length}
          </Heading>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {saved.slice(0, 6).map((s) => (
              <Link key={s.id} href={s.href} replace onClick={onPick} className="group w-[132px] flex-none text-ink">
                <span className="relative block aspect-square overflow-hidden border border-line bg-raised">
                  {s.image ? <Image src={s.image} alt="" fill sizes="132px" className="object-cover" /> : null}
                </span>
                <span className="mt-1.5 line-clamp-2 block text-[14px] font-[620] leading-snug group-hover:text-accent">{s.title}</span>
                {s.area ? <span className="block truncate font-mono text-[12px] text-faint">{s.area}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {others.length ? (
        <section>
          <Heading>Looked at lately</Heading>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {others.map((r) => (
              <Link key={r.slug} href={r.href} replace onClick={onPick} className="group w-[150px] flex-none text-ink">
                <span className="relative block aspect-square overflow-hidden border border-line bg-mount">
                  <Image src={r.poster} alt="" fill sizes="150px" className="object-cover" />
                  <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-ink/80 px-1.5 py-0.5 font-mono text-[11px] text-white">3D</span>
                </span>
                <span className="mt-1.5 flex items-baseline gap-1.5 font-mono text-[11px] leading-tight text-muted">
                  <span className="h-1.5 w-1.5 flex-none -translate-y-px rounded-full bg-accent" aria-hidden="true" />
                  <span className="line-clamp-2">{r.line}</span>
                </span>
                <span className="mt-1 line-clamp-2 block text-[14px] font-[620] leading-snug group-hover:text-accent">{r.title}</span>
                <span className="block truncate text-[13px] text-muted">{r.area}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {kinds.length ? (
        <section>
          <Heading>Designs in 3D, by type</Heading>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <Link key={k.href} href={k.href} replace onClick={onPick} className="inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong bg-mount px-3 text-[14.5px] text-ink transition-colors hover:border-accent">
                {k.title.replace(/ in 3D$/, '')}
                <span className="font-mono text-[12px] text-faint">{k.sub?.match(/\d+/)?.[0]}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <Heading>Quick links</Heading>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { href: QUOTE_HREF, title: 'Plan your project', sub: 'Your brief and a free quote' },
            { href: '/wardrobe-planner', title: 'Wardrobe planner', sub: 'Design yours in 3D' },
            { href: '/areas', title: 'Jobs near you', sub: 'Where I’ve worked' },
          ].map((l) => (
            <Link key={l.href} href={l.href} replace onClick={onPick} className="rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-ink transition-colors hover:border-accent">
              <span className="block text-[15px] font-[620] leading-snug">{l.title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted">{l.sub}</span>
            </Link>
          ))}
          <a href={whatsappUrl('Hi Raf, I was looking on your website and ')} target="_blank" rel="noopener" className="rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-ink transition-colors hover:border-whatsapp">
            <span className="flex items-center gap-1.5 text-[15px] font-[620] leading-snug">
              <span className="h-2 w-2 rounded-full bg-whatsapp" aria-hidden="true" />
              WhatsApp me
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted">Reply within 24 hours</span>
          </a>
        </div>
      </section>
    </div>
  );
}
