'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { goalOf, statsOff, type Tap } from '@/lib/site-stats';

/* The website's own visitor counter, for the Job Kit's Website stats screen. For each page view it notes how long the
   page was actually in use (on screen, touched in the last 15 seconds), how far down it was scrolled, where on the
   page the time went (twenty bands, by the middle of the screen), what was tapped (the element, so the Job Kit can
   find it again, and where on it) and the page before. It goes to /api/stats/hit when the page starts and again when
   it's left or hidden; the server adds a visitor code that changes every day.
   No cookies and nothing kept in the browser. Not counted: the Job Kit and other private pages, pages shown inside
   the Job Kit (an iframe), robots, anyone who opted out on /privacy (raf_stats_off, also set on Raf's phone by the
   Job Kit) and browsers sending Global Privacy Control. Words typed into boxes are never read. */

const PRIVATE = /^\/(job-kit|admin|editor|api|review\/send)(\/|$)/;
const ROBOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender/i;
const ACTIVE_MS = 15_000;
const MAX_TAPS = 50;
const BANDS = 20;

type View = {
  id: string;
  path: string;
  title: string;
  prev: string;
  ref: string;
  utm: string;
  engaged: number;
  dwell: number[];
  scroll: number;
  docH: number;
  taps: Tap[];
  sentAt: number; // engaged ms at the last send
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

const docHeight = () => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, 1);

/* A CSS path back to the nearest element with a plain id (or the body), so the Job Kit can find it again. */
function selector(el: Element): string {
  const parts: string[] = [];
  let e: Element | null = el;
  while (e && e !== document.body && e !== document.documentElement && parts.length < 30) {
    if (e.id && /^[A-Za-z][\w-]*$/.test(e.id)) {
      parts.unshift('#' + e.id);
      return parts.join('>');
    }
    let i = 1;
    for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName) i++;
    parts.unshift(`${e.tagName.toLowerCase()}:nth-of-type(${i})`);
    e = e.parentElement;
  }
  return ['body', ...parts].join('>');
}

const clean = (s: string | null | undefined, max = 40) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default function SiteStats() {
  const pathname = usePathname() || '/';
  const view = useRef<View | null>(null);
  const lastPath = useRef('');
  const send = useRef<(final?: boolean) => void>(() => {});

  // listeners for the whole visit
  useEffect(() => {
    const w = window as unknown as { __statsTest?: boolean };
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const robot = ROBOT.test(navigator.userAgent) && !w.__statsTest;
    const off = () => robot || statsOff() || nav.globalPrivacyControl === true || window.top !== window.self;
    if (off()) return;

    let lastAct = Date.now();
    const act = () => {
      lastAct = Date.now();
    };
    // only while the page on screen is still this view's page (when the page changes, the new one is already showing
    // as the last word on the old one goes)
    const here = (v: View) => (location.pathname.replace(/\/+$/, '') || '/') === v.path;
    const measure = () => {
      const v = view.current;
      if (!v || !here(v)) return;
      v.docH = docHeight();
      v.scroll = Math.max(v.scroll, Math.min(1, (window.scrollY + window.innerHeight) / v.docH));
    };
    const onScroll = () => {
      act();
      measure();
    };

    send.current = () => {
      const v = view.current;
      if (!v || off()) return;
      if (here(v)) {
        measure();
        v.title = clean(document.title, 140);
      }
      v.sentAt = v.engaged;
      const body = JSON.stringify({
        id: v.id,
        path: v.path,
        title: v.title,
        prev: v.prev,
        ref: v.ref,
        utm: v.utm,
        vw: window.innerWidth,
        vh: window.innerHeight,
        docH: v.docH,
        engaged: v.engaged,
        scroll: Math.round(v.scroll * 1000) / 1000,
        dwell: v.dwell,
        clicks: v.taps,
      });
      try {
        // text/plain keeps it a simple request; the server reads the JSON from the text
        if (navigator.sendBeacon?.('/api/stats/hit', new Blob([body], { type: 'text/plain' }))) return;
      } catch {
        /* fall through to fetch */
      }
      void fetch('/api/stats/hit', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    };

    // a second at a time: time in use, and where on the page it went
    const tick = window.setInterval(() => {
      const v = view.current;
      if (!v || !here(v) || document.visibilityState !== 'visible' || Date.now() - lastAct > ACTIVE_MS) return;
      v.engaged += 1000;
      const mid = (window.scrollY + window.innerHeight / 2) / Math.max(1, v.docH);
      v.dwell[Math.min(BANDS - 1, Math.max(0, Math.floor(mid * BANDS)))] += 1000;
      if (v.engaged - v.sentAt >= 30_000) send.current(); // now and then, in case the last one never arrives
    }, 1000);

    const onTap = (e: MouseEvent) => {
      act();
      const v = view.current;
      const target = e.target as Element | null;
      if (!v || !here(v) || !target?.closest || v.taps.length >= MAX_TAPS) return;
      const el = target.closest('a,button,[role="button"],input,select,textarea,label,summary,[data-stat]') ?? target;
      const r = el.getBoundingClientRect();
      const fx = r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0.5;
      const fy = r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0.5;
      const interactive = el !== target || target.matches('a,button,[role="button"],input,select,textarea,label,summary,[data-stat]');
      const box = el as HTMLElement;
      const text = interactive
        ? clean(el.getAttribute('aria-label') || (el.matches('input,select,textarea') ? el.getAttribute('placeholder') || el.getAttribute('name') : box.innerText) || el.getAttribute('alt') || el.getAttribute('title'))
        : '';
      const href = el.closest('a')?.getAttribute('href') ?? '';
      v.taps.push({
        s: selector(el),
        fx: Math.round(fx * 1000) / 1000,
        fy: Math.round(fy * 1000) / 1000,
        x: Math.round((e.clientX / Math.max(1, window.innerWidth)) * 1000) / 1000,
        y: Math.round(e.clientY + window.scrollY),
        h: docHeight(),
        t: text,
        g: goalOf(href, text) || undefined,
      });
      if (goalOf(href, text)) send.current(); // a way to get in touch: don't risk losing it if the page changes
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') send.current(true);
    };
    const onPageHide = () => send.current(true);

    window.addEventListener('scroll', onScroll, { passive: true });
    for (const t of ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'wheel'] as const) window.addEventListener(t, act, { passive: true });
    document.addEventListener('click', onTap, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('scroll', onScroll);
      for (const t of ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'wheel'] as const) window.removeEventListener(t, act);
      document.removeEventListener('click', onTap, { capture: true });
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      send.current = () => {};
    };
  }, []);

  // a new page view each time the page changes
  useEffect(() => {
    const path = pathname.replace(/\/+$/, '') || '/';
    if (path === lastPath.current) return;
    if (view.current) send.current(true);
    const first = !lastPath.current;
    let prev = lastPath.current;
    let ref = '';
    if (first && document.referrer) {
      try {
        const r = new URL(document.referrer);
        if (r.host === location.host) prev = r.pathname.replace(/\/+$/, '') || '/';
        else ref = r.origin + r.pathname;
      } catch {
        /* no referrer */
      }
    }
    lastPath.current = path;
    if (PRIVATE.test(path)) {
      view.current = null;
      return;
    }
    let utm = '';
    try {
      utm = clean(new URLSearchParams(location.search).get('utm_source'), 40);
    } catch {
      /* none */
    }
    view.current = { id: uid(), path, title: '', prev, ref, utm, engaged: 0, dwell: Array(BANDS).fill(0), scroll: 0, docH: docHeight(), taps: [], sentAt: 0 };
    // after the title has changed for the new page
    const t = window.setTimeout(() => send.current(), 1200);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
