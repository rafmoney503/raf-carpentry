'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CALC_START, calcView, pressKey, type CalcKey, type CalcOp, type CalcState } from '@/lib/basic-calc';

/* The simple calculator, full screen (7 Nov 2026, Raf: mockup C2 on the 'Basic calculator mockups' canvas, and C3
   "for night mode"). Day look when the phone is in light mode, night look in dark mode; the moon / sun button
   switches it and the choice is kept on the device (localStorage raf_calc_theme). Styles: basic-calculator.css. */

const THEME_KEY = 'raf_calc_theme';
type Theme = 'auto' | 'day' | 'night';
const BG = { day: '#f1f2ef', night: '#121518' } as const;

const DIGITS: CalcKey[] = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'back'];
const OPS: { key: CalcOp; name: string }[] = [
  { key: '÷', name: 'Divide' },
  { key: '×', name: 'Times' },
  { key: '−', name: 'Minus' },
  { key: '+', name: 'Plus' },
];
const KEYBOARD: Record<string, CalcKey> = {
  '+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷', Enter: '=', '=': '=', Backspace: 'back',
  Escape: 'C', Delete: 'C', c: 'C', C: 'C', '.': '.', ',': '.',
};

// the device's choice (localStorage, or this visit only when storage is blocked), shared by every tab
let memTheme: Theme = 'auto';
const themeListeners = new Set<() => void>();
function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'day' || t === 'night' ? t : 'auto';
  } catch {
    return memTheme;
  }
}
function saveTheme(t: Theme) {
  memTheme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* kept for this visit only */
  }
  themeListeners.forEach((f) => f());
}
function onTheme(cb: () => void) {
  themeListeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    themeListeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}
// the phone's own light or dark setting
const DARK = '(prefers-color-scheme: dark)';
function onSystem(cb: () => void) {
  const mq = window.matchMedia(DARK);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const never = () => () => {};

export default function BasicCalculator() {
  const [s, setS] = useState<CalcState>(CALC_START);
  const theme = useSyncExternalStore(onTheme, readTheme, () => 'auto' as Theme);
  const systemNight = useSyncExternalStore(onSystem, () => window.matchMedia(DARK).matches, () => false);
  // false on the server and the first paint, so the page follows the phone's setting until the script runs
  const ready = useSyncExternalStore(never, () => true, () => false);
  const [down, setDown] = useState<CalcKey | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const view = calcView(s);
  const look: 'day' | 'night' = theme === 'auto' ? (systemNight ? 'night' : 'day') : theme;

  const press = useCallback((k: CalcKey) => setS((cur) => pressKey(cur, k)), []);

  // the page behind (iPhone's bounce) and the browser bar in the same colour; no page scroll while it's open
  useEffect(() => {
    if (!ready) return;
    const html = document.documentElement;
    const before = { bg: html.style.backgroundColor, overflow: document.body.style.overflow };
    html.style.backgroundColor = BG[look];
    document.body.style.overflow = 'hidden';
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const was = metas.map((m) => m.content);
    metas.forEach((m) => {
      m.content = theme === 'auto' ? (m.media.includes('dark') ? BG.night : BG.day) : BG[look];
    });
    return () => {
      html.style.backgroundColor = before.bg;
      document.body.style.overflow = before.overflow;
      metas.forEach((m, i) => (m.content = was[i]));
    };
  }, [ready, look, theme]);

  // the big number as big as the display allows
  const fit = useCallback(() => {
    const display = displayRef.current;
    const wrap = wrapRef.current;
    const num = numRef.current;
    if (!display || !wrap || !num) return;
    const max = Math.max(40, Math.min(148, Math.round(display.clientHeight * 0.5)));
    const room = wrap.clientWidth * 0.98;
    // Bricolage changes its letters with the size (optical sizing), so measure again at the new size
    let size = max;
    for (let i = 0; i < 4; i++) {
      num.style.fontSize = `${size}px`;
      const w = num.getBoundingClientRect().width;
      if (w <= room || size <= 26) break;
      size = Math.max(26, Math.min(size - 1, Math.floor((size * room) / w)));
    }
  }, []);
  useLayoutEffect(fit, [view.big, fit]);
  useEffect(() => {
    const ro = new ResizeObserver(fit);
    if (displayRef.current) ro.observe(displayRef.current);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [fit]);

  // typing on a computer
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k: CalcKey | undefined = /^[0-9]$/.test(e.key) ? (e.key as CalcKey) : KEYBOARD[e.key];
      if (!k) return;
      e.preventDefault();
      // a key clicked earlier keeps its focus ring otherwise, which means nothing once typing
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.closest('.bc-pad')) focused.blur();
      press(k);
      setDown(k);
      clearTimeout(t);
      t = setTimeout(() => setDown(null), 130);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [press]);

  const toggle = () => saveTheme(look === 'night' ? 'day' : 'night');

  return (
    // onTouchStart lets an iPhone show the pressed look (:active) on the keys
    <div className="bc" data-look={ready ? look : 'auto'} onTouchStart={() => {}}>
      <div className="bc-app">
        <header className="bc-top">
          <Link href="/tools" className="bc-back">
            ‹ Tools
          </Link>
          <h1 className="bc-title">Calculator</h1>
          <button type="button" className="bc-mode" onClick={toggle} aria-label={look === 'night' ? 'Day look' : 'Night look'} title={look === 'night' ? 'Day look' : 'Night look'}>
            {look === 'night' ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />
              </svg>
            )}
          </button>
        </header>

        <div className="bc-display" ref={displayRef} aria-live="polite" aria-atomic="true">
          <p className="bc-sum">{view.line || ' '}</p>
          <div className="bc-num-wrap" ref={wrapRef}>
            <span className="bc-num" ref={numRef} data-err={view.err || undefined}>
              {view.big}
            </span>
          </div>
          <div className="bc-rule" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="bc-pad">
          <div className="bc-digits">
            {DIGITS.map((k) => (
              <button
                key={k}
                type="button"
                className="bc-key"
                data-down={down === k || undefined}
                onClick={() => press(k)}
                aria-label={k === 'back' ? 'Delete' : k === '.' ? 'Point' : undefined}
              >
                {k === 'back' ? (
                  <svg viewBox="0 0 32 24" width="34" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                    <path d="M10.5 3H28a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 28 21H10.5L2.5 12Z" />
                    <path d="m15.5 8.5 7 7M22.5 8.5l-7 7" />
                  </svg>
                ) : (
                  k
                )}
              </button>
            ))}
          </div>
          <div className="bc-ops">
            <button type="button" className="bc-op bc-clear" data-down={down === 'C' || undefined} onClick={() => press('C')} aria-label="Clear">
              C
            </button>
            {OPS.map((o) => (
              <button
                key={o.key}
                type="button"
                className="bc-op"
                data-down={down === o.key || undefined}
                aria-pressed={view.lit === o.key}
                onClick={() => press(o.key)}
                aria-label={o.name}
              >
                {o.key}
              </button>
            ))}
            <button type="button" className="bc-op bc-eq" data-down={down === '=' || undefined} onClick={() => press('=')} aria-label="Equals">
              =
            </button>
          </div>
        </div>
        <p className="bc-hint">Keyboard: 0 to 9, + − * /, Enter, Backspace, Esc</p>
      </div>
    </div>
  );
}
