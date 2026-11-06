'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { goalOf, statPath, statsOff, type Tap } from '@/lib/site-stats';

/* The website's own visitor counter, for the Job Kit's Website stats screen. For each page view it notes how long the
   page was actually in use (on screen, touched in the last 15 seconds), how far down it was scrolled, where on the
   page the time went (twenty bands, by the middle of the screen), what was tapped (the element, so the Job Kit can
   find it again, and where on it) and the page before. It goes to /api/stats/hit when the page starts and again when
   it's left or hidden; the server adds a visitor code that changes every day.
   No cookies and nothing kept in the browser. Not counted: the Job Kit and other private pages, pages shown inside
   the Job Kit (an iframe), robots, anyone who opted out on /privacy (raf_stats_off, also set on Raf's phone by the
   Job Kit) and browsers sending Global Privacy Control. Words typed into boxes are never read.
   Since 6 Nov 2026: each Workshop Games screen counts as its own page (statPath: /tools/games/app#/stack is
   /tools/games/app/stack), a game's buttons are read inside the app's shadow root (so Share taps can be counted), and
   the first time one of the home-screen apps opens from a phone's home screen its visit is tagged as an install
   (homeTag). */

const PRIVATE = /^\/(job-kit|admin|editor|api|review\/send|pots)(\/|$)/;
const ROBOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender/i;
const ACTIVE_MS = 15_000;
const MAX_TAPS = 50;
const MAX_LABELLED = 80; // buttons and links still count after the 50: a game's own taps fill those quickly
const INTERACTIVE = 'a,button,[role="button"],input,select,textarea,label,summary,[data-stat]';

/* The apps that can be put on a home screen, with the tag their start address carries. The first time one is opened
   from the home screen on a phone its visit is tagged '<tag>-new' (an install; the phone keeps a note of the day),
   every time after that '<tag>'. iPhones keep a home-screen app's storage apart from Safari's, so a first open there
   really is the first. */
const HOME_APPS = [
  { scope: '/tools/games', tag: 'pwa-games', key: 'raf_games_home' },
  { scope: '/tools/workshop', tag: 'pwa', key: 'rc-tools-home' },
];
function homeTag(path: string, utm: string) {
  const app = HOME_APPS.find((a) => path === a.scope || path.startsWith(`${a.scope}/`));
  if (!app) return utm;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!standalone) return utm;
  try {
    if (localStorage.getItem(app.key)) return utm || app.tag;
    localStorage.setItem(app.key, new Date().toISOString().slice(0, 10));
  } catch {
    return utm || app.tag; // storage blocked: can't tell, so not an install
  }
  return `${app.tag}-new`;
}
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
  // a new Workshop Games screen (the address after #) is a new page view too
  const [hashTurn, setHashTurn] = useState(0);
  const firstSend = useRef(0);
  useEffect(() => {
    const on = () => setHashTurn((n) => n + 1);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

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
    const here = (v: View) => statPath(location.pathname, location.hash) === v.path;
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

    const words = (el: Element) =>
      clean(el.getAttribute('aria-label') || (el.matches('input,select,textarea') ? el.getAttribute('placeholder') || el.getAttribute('name') : (el as HTMLElement).innerText) || el.getAttribute('alt') || el.getAttribute('title'));
    const onTap = (e: MouseEvent) => {
      act();
      const v = view.current;
      const target = e.target as Element | null;
      if (!v || !here(v) || !target?.closest || v.taps.length >= MAX_LABELLED) return;
      const el = target.closest(INTERACTIVE) ?? target;
      // Workshop Tools and Games are drawn in a shadow root: the page only sees the app's box, so the words (and the
      // link) come from the button inside it; where it was stays on the box, which the Job Kit's heatmap can find
      const inner = e.composedPath?.()[0];
      const deep = inner instanceof Element && inner.getRootNode() instanceof ShadowRoot ? inner.closest(INTERACTIVE) : null;
      const r = el.getBoundingClientRect();
      const fx = r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0.5;
      const fy = r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0.5;
      const interactive = el !== target || target.matches(INTERACTIVE);
      const text = deep ? words(deep) : interactive ? words(el) : '';
      if (v.taps.length >= MAX_TAPS && !text) return;
      const href = (deep ?? el).closest('a')?.getAttribute('href') ?? '';
      v.taps.push({
        s: selector(el),
        fx: Math.round(fx * 1000) / 1000,
        fy: Math.round(fy * 1000) / 1000,
        x: Math.round((e.clientX / Math.max(1, window.innerWidth)) * 1000) / 1000,
        y: Math.round(e.clientY + window.scrollY),
        h: docHeight(),
        t: text,
        g: goalOf(href, text) || undefined,
        // a heart that saves a job (SaveButton's data-save): which job, for the recently looked at card
        sv: el.closest('[data-save]')?.getAttribute('data-save') || undefined,
        // the small card bottom left (RecentDesign.tsx): what it suggested ('app', 'post:<slug>' or 'recent')
        cd: el.closest('[data-card]')?.getAttribute('data-card') || undefined,
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
    const path = statPath(pathname, location.hash);
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
    if (first) utm = homeTag(path, utm);
    view.current = { id: uid(), path, title: '', prev, ref, utm, engaged: 0, dwell: Array(BANDS).fill(0), scroll: 0, docH: docHeight(), taps: [], sentAt: 0 };
    // after the title has changed for the new page (a timer of its own: a hash change that isn't a new view, like a jump
    // to #brief, re-runs this without clearing it)
    window.clearTimeout(firstSend.current);
    firstSend.current = window.setTimeout(() => send.current(), 1200);
  }, [pathname, hashTurn]);
  useEffect(() => () => window.clearTimeout(firstSend.current), []);

  return null;
}
