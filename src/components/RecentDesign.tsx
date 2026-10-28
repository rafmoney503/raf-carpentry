'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { RecentItem } from '@/lib/recent-designs';
import type { CardIndex } from '@/lib/suggest-card';
import { APP_ICON, APP_PAGE } from '@/lib/workshop-tools/site';

/* A small card, bottom left above the Plan your project button, once per visit.

   What it shows depends on the page (25 Oct 2026, Raf: 'suggest new visitor to check workshop tool or blog
   discretely'; the list is /card-index.json, src/lib/suggest-card.ts):
   - on pages carpenters and DIYers read (tools, tips, CabinetOS, SketchUp, the trade blog posts): the free Workshop
     Tools app, once per browser, and never to someone who has already looked at its page;
   - on a job page the blog post that tells that job's story, on the wardrobe pages, area pages and PAX posts a PAX
     guide: the first one they haven't read (the last pages kept for search, raf_seen) or been shown before;
   - anywhere else, or when there's nothing left to suggest: one of the jobs someone really looked at or saved in the
     last 7 days, picked at random ("Looked at 40 minutes ago", "Saved for a brief yesterday"), with its 3D still and a
     link to it in 3D (/api/recent; Raf, 22 Oct 2026: 'a random pop up like here on the bottom ... it has to be
     discreet', made from real visits after he agreed it had to be true). Never the page they're on, never their own
     visit, nothing about who looked; with nothing real in the last 7 days, no card at all. The place on it is where the
     job was built ('Built in Finchley'), never where the person who looked was.

   It comes 20 s into the visit (at least 2.5 s after a new page), not while they're typing (a key in the last 8 s with
   a box focused), stays 9 s (longer while the pointer or focus is on it) and doesn't come back in that tab once shown
   or closed. A tap on it is counted by the visit counter as `cd` (SiteStats: data-card), apart from the ways to get
   in touch. */

const SHOWN = 'raf_recent_shown';
const START = 'raf_recent_t0';
const OFFERED = 'raf_card_shown'; // suggestions shown in this browser (hrefs), so none is offered twice
const SEEN = 'raf_seen'; // the last pages looked at (PullSearch.tsx)

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

function readList(key: string): unknown[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function offered(href: string) {
  try {
    const now = readList(OFFERED).filter((x): x is string => typeof x === 'string' && x !== href);
    localStorage.setItem(OFFERED, JSON.stringify([href, ...now].slice(0, 30)));
  } catch {
    /* storage blocked: it may be offered again on another visit */
  }
}

type Card = {
  href: string;
  img: string;
  /** the app's icon rather than a photo */
  icon?: boolean;
  line: string;
  title: string;
  sub: string;
  more: string;
  label: string;
  stat: string;
};

let shownHere = false; // when sessionStorage is blocked
let lastKey = 0; // when they last typed (a box can have the focus without anyone typing in it)
let index: Promise<CardIndex | null> | null = null;

const getIndex = () =>
  (index ??= fetch('/card-index.json')
    .then((r) => (r.ok ? (r.json() as Promise<CardIndex>) : null))
    .catch(() => null)
    .then((i) => {
      if (!i) index = null; // try again on the next visit
      return i;
    }));

/* A suggestion for this page, or null for the recently looked at card. */
async function suggestion(pathname: string): Promise<Card | null> {
  const idx = await getIndex();
  if (!idx) return null;
  const done = new Set<string>(readList(OFFERED).filter((x): x is string => typeof x === 'string'));
  for (const s of readList(SEEN)) if (s && typeof (s as { p?: unknown }).p === 'string') done.add((s as { p: string }).p);

  if (idx.trade.includes(pathname)) {
    if (!done.has(APP_PAGE)) {
      return {
        href: APP_PAGE,
        img: APP_ICON,
        icon: true,
        line: 'Free for carpenters',
        title: 'Workshop Tools: ten setting-out tools on your phone',
        sub: 'Works with no signal',
        more: 'get the app',
        label: 'A free app',
        stat: 'app',
      };
    }
    return null;
  }

  const job = pathname.match(/^\/portfolio\/([a-z0-9-]+)/)?.[1];
  for (const slug of idx.pages[pathname] ?? []) {
    const href = `/blog/${slug}`;
    const post = idx.posts[slug];
    if (!post?.img || href === pathname || done.has(href)) continue;
    const own = Boolean(job) && post.k === 'job';
    return {
      href,
      img: post.img,
      line: own ? 'How this one was built' : post.k === 'guide' ? 'Wardrobe guide' : 'From the blog',
      title: post.t,
      sub: own ? `Step by step, with photos · ${post.m} min` : `${post.m} min read`,
      more: 'read it',
      label: 'From the blog',
      stat: `post:${slug}`,
    };
  }
  return null;
}

const fromRecent = (i: RecentItem): Card => ({
  href: i.href,
  img: i.poster,
  line: i.line,
  title: i.title,
  sub: `Built in ${i.area}`,
  more: 'see it in 3D',
  label: 'Recently looked at',
  stat: 'recent',
});

export default function RecentDesign() {
  const pathname = usePathname() || '/';
  const [item, setItem] = useState<Card | null>(null);
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
      let card = await suggestion(pathname);
      if (!card) {
        const res = await fetch('/api/recent', { cache: 'no-store' }).catch(() => null);
        const items: RecentItem[] = res?.ok ? ((await res.json().catch(() => ({}))) as { items?: RecentItem[] }).items ?? [] : [];
        const here = pathname.match(/^\/portfolio\/([a-z0-9-]+)/)?.[1];
        const list = items.filter((i) => i.slug !== here);
        card = list.length ? fromRecent(list[Math.floor(Math.random() * list.length)]) : null;
      }
      if (gone) return; // a new page came meanwhile: it tries again there
      shownHere = true;
      store.set(SHOWN, '1');
      if (!card) return;
      if (card.stat !== 'recent') offered(card.href);
      setItem(card);
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
      aria-label={item.label}
      data-card-kind={item.stat === 'app' ? 'app' : item.stat === 'recent' ? 'recent' : 'post'}
      className={`fixed bottom-[calc(max(16px,env(safe-area-inset-bottom))+72px)] left-4 z-40 w-[min(360px,calc(100vw-32px))] transition duration-300 motion-reduce:transition-none print:hidden md:bottom-[92px] md:left-6 ${open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
      onPointerEnter={() => (hold.current = true)}
      onPointerLeave={() => (hold.current = false)}
      onFocus={() => (hold.current = true)}
      onBlur={() => (hold.current = false)}
    >
      <div className="relative flex items-center rounded-[2px] border border-line-strong bg-mount shadow-[0_8px_28px_rgb(22_25_28/0.16)]">
        <Link href={item.href} data-card={item.stat} onClick={() => setOpen(false)} className="group flex min-w-0 flex-1 items-center gap-3 py-2 pl-2 pr-10">
          <Image
            src={item.img}
            alt=""
            width={52}
            height={52}
            sizes="52px"
            className={`h-[52px] w-[52px] flex-none border border-line object-cover ${item.icon ? 'rounded-[10px] bg-ink' : 'bg-paper'}`}
          />
          <span className="min-w-0">
            <span className="flex items-baseline gap-1.5 font-mono text-[11px] leading-tight text-muted">
              <span className="h-1.5 w-1.5 flex-none -translate-y-px rounded-full bg-accent" aria-hidden="true" />
              <span>{item.line}</span>
            </span>
            <span className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink group-hover:text-accent">{item.title}</span>
            <span className="block truncate text-[13px] leading-snug text-muted">
              {item.sub} · <span className="text-accent">{item.more}</span>
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
