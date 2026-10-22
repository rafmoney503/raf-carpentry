'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { RecentItem } from '@/lib/recent-designs';

/* A small card, bottom left above the Plan your project button, once per visit: one of the jobs someone really looked
   at or saved in the last 7 days, picked at random ("Looked at 40 minutes ago", "Saved for a brief yesterday"), with
   its 3D still and a link to it in 3D (/api/recent; Raf, 22 Oct 2026: 'a random pop up like here on the bottom ...
   it has to be discreet', made from real visits after he agreed it had to be true). Never the page they're on, never
   their own visit, nothing about who looked. It comes 20 s into the visit (at least 2.5 s after a new page), not while
   they're typing (a key in the last 8 s with a box focused), stays 9 s (longer while the pointer or focus is on it) and doesn't come back in that tab once shown
   or closed. When nothing real happened in the last 7 days it doesn't come at all. */

const SHOWN = 'raf_recent_shown';
const START = 'raf_recent_t0';
const store = {
  get(k: string) {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* private mode: once per page load instead */
    }
  },
};

let shownHere = false; // when sessionStorage is blocked
let lastKey = 0; // when they last typed (a box can have the focus without anyone typing in it)

export default function RecentDesign() {
  const pathname = usePathname() || '/';
  const [item, setItem] = useState<RecentItem | null>(null);
  const [open, setOpen] = useState(false);
  const hold = useRef(false);

  useEffect(() => {
    if (shownHere || store.get(SHOWN)) return;
    const now = Date.now();
    const t0 = Number(store.get(START)) || now;
    if (!store.get(START)) store.set(START, String(t0));
    let tries = 0;
    let timer = 0;
    let gone = false;
    const fire = async () => {
      if (gone || shownHere || store.get(SHOWN)) return;
      const typing = document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') && Date.now() - lastKey < 8000;
      if (document.visibilityState !== 'visible' || typing) {
        if (++tries <= 6) timer = window.setTimeout(fire, 10_000);
        return;
      }
      const res = await fetch('/api/recent', { cache: 'no-store' }).catch(() => null);
      const items: RecentItem[] = res?.ok ? ((await res.json().catch(() => ({}))) as { items?: RecentItem[] }).items ?? [] : [];
      const here = pathname.match(/^\/portfolio\/([a-z0-9-]+)/)?.[1];
      const list = items.filter((i) => i.slug !== here);
      if (gone) return; // a new page came meanwhile: it tries again there
      shownHere = true;
      store.set(SHOWN, '1');
      if (!list.length) return;
      setItem(list[Math.floor(Math.random() * list.length)]);
      window.setTimeout(() => setOpen(true), 30);
    };
    const key = () => (lastKey = Date.now());
    window.addEventListener('keydown', key, { passive: true });
    timer = window.setTimeout(fire, Math.max(2500, 20_000 - (now - t0)));
    return () => {
      gone = true;
      clearTimeout(timer);
      window.removeEventListener('keydown', key);
    };
  }, [pathname]);

  // stays 9 s, longer while the pointer or keyboard focus is on it
  useEffect(() => {
    if (!open) return;
    let t = 0;
    const tick = () => {
      t = window.setTimeout(() => (hold.current ? tick() : setOpen(false)), 9000);
    };
    tick();
    return () => clearTimeout(t);
  }, [open]);

  // gone from the page shortly after it fades
  useEffect(() => {
    if (open || !item) return;
    const t = window.setTimeout(() => setItem(null), 400);
    return () => clearTimeout(t);
  }, [open, item]);

  if (!item) return null;
  return (
    <aside
      aria-label="Recently looked at"
      className={`fixed bottom-[calc(max(16px,env(safe-area-inset-bottom))+68px)] left-4 z-40 w-[min(360px,calc(100vw-32px))] transition duration-300 motion-reduce:transition-none print:hidden md:bottom-[84px] md:left-6 ${open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
      onPointerEnter={() => (hold.current = true)}
      onPointerLeave={() => (hold.current = false)}
      onFocus={() => (hold.current = true)}
      onBlur={() => (hold.current = false)}
    >
      <div className="relative flex items-center rounded-[2px] border border-line-strong bg-mount shadow-[0_8px_28px_rgb(22_25_28/0.16)]">
        <Link href={item.href} onClick={() => setOpen(false)} className="group flex min-w-0 flex-1 items-center gap-3 py-2 pl-2 pr-10">
          <Image src={item.poster} alt="" width={52} height={52} sizes="52px" className="h-[52px] w-[52px] flex-none border border-line bg-paper object-cover" />
          <span className="min-w-0">
            <span className="flex items-baseline gap-1.5 font-mono text-[11px] leading-tight text-muted">
              <span className="h-1.5 w-1.5 flex-none -translate-y-px rounded-full bg-accent" aria-hidden="true" />
              <span>{item.line}</span>
            </span>
            <span className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink group-hover:text-accent">{item.title}</span>
            <span className="block truncate text-[13px] leading-snug text-muted">
              {item.area} · <span className="text-accent">see it in 3D</span>
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-[2px] text-faint transition-colors hover:bg-raised hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
