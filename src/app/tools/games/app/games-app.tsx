'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BOARDS } from '@/lib/workshop-games/boards.generated';
import { DcRoot, type DCLogic, type DcApp } from '@/lib/workshop-tools/dc-runtime';
import { canPrompt, isStandalone, justInstalled, keepGamesOffline, onInstallChange, osOf, promptInstall } from '@/lib/workshop-games/install';
import { playKey, readScore, scoreUrl, scoreWords } from '@/lib/workshop-games/site';
import './games-app.css';

/* Workshop Games, full screen (no menu, footer or floating buttons: LayoutShell). Each screen is a board from the
   'Workshop Games mockups' design canvas (scripts/workshop-games/*.dc.html, built into boards.generated.js) drawn
   with the Workshop Tools runtime. The address after # picks the screen (#/stack, #/stack/levels ...), so the
   phone's Back goes back a screen. This page hands the boards what only it knows: sharing a score, how this phone
   adds apps to its home screen, one sound player for every screen, and the offline copy.

   Each screen was designed at 390 x 844 (build.mjs explains the three ways it meets a real screen); this works
   out --fit (and --h for the screens that scroll) from the room there is. */

type Board = DcApp & { mode: 'fill' | 'contain' | 'scroll' };
type Inst = DCLogic & Record<string, unknown>;
const ALL = BOARDS as unknown as Record<string, Board>;

const screenOf = (hash: string) => {
  const s = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  return ALL[s] ? s : 'home';
};

// One sound player for the whole app: iPhones allow only a few, and every screen made its own on its first tap.
let audio: unknown = null;

function copy(text: string): boolean {
  try {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    if (ok) return true;
  } catch {}
  navigator.clipboard?.writeText(text).catch(() => {});
  return !!navigator.clipboard;
}

export default function GamesApp() {
  const [screen, setScreen] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [cramped, setCramped] = useState(false);
  // a scrolling screen can say it is taller than the 844 it was drawn at (the home screen with six games)
  const [screenH, setScreenH] = useState<number | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((text: string) => {
    setToast((t) => ({ text, n: (t?.n || 0) + 1 }));
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const url = new URL(location.href);
    try {
      // a challenge link opens its level or board; ?levels=all opens every level (for trying them out)
      const pick = playKey(url.searchParams.get('play'));
      if (pick) localStorage.setItem(pick.key, pick.value);
      const lv = url.searchParams.get('levels');
      if (lv === 'all') localStorage.setItem('raf_games_open_all', '1');
      if (lv === 'none') localStorage.removeItem('raf_games_open_all');
      // the old Timber Stack page's best score carries over, and its players start on the free stack they know
      const old = Number(localStorage.getItem('raf_timber_best')) || 0;
      if (old > (Number(localStorage.getItem('raf_games_stack_best')) || 0)) localStorage.setItem('raf_games_stack_best', String(old));
      if (old && localStorage.getItem('raf_games_level_stack') == null) localStorage.setItem('raf_games_level_stack', '0');
      if (localStorage.getItem('raf_timber_mute') === '1' && localStorage.getItem('raf_games_sound') == null) localStorage.setItem('raf_games_sound', '0');
    } catch {}
    if (url.searchParams.has('play') || url.searchParams.has('levels')) {
      url.searchParams.delete('play');
      url.searchParams.delete('levels');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
    const read = () => {
      setScreen(screenOf(location.hash));
      setScreenH(null);
      appRef.current?.scrollTo(0, 0);
    };
    read();
    window.addEventListener('hashchange', read);
    keepGamesOffline();
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const mode = screen ? ALL[screen].mode : 'fill';

  // the room there is, inside the phone's safe areas
  useLayoutEffect(() => {
    const el = appRef.current;
    if (!el || !screen) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (!w || !h) return;
      // contain: the whole screen fits; scroll and fill: the width fits (fill only scales below 390, see --fs)
      const f = mode === 'contain' ? Math.max(0.5, Math.min(1.3, w / 390, h / 844)) : Math.min(1, w / 390);
      setFit(Math.round(f * 1000) / 1000);
      // a phone on its side: the games are played upright (the home and level screens just scroll)
      setCramped(mode !== 'scroll' && h < 480 && w > h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [screen, mode]);

  const setup = useCallback(
    (inst: Inst) => {
      // the shared sound player (each board keeps its own in _c, the home screen in _ac)
      for (const k of ['_c', '_ac']) {
        Object.defineProperty(inst, k, { configurable: true, get: () => audio, set: (v) => { audio = v; } });
      }
      inst.setScreenHeight = (h: number) => setScreenH(h >= 600 && h <= 2000 ? h : null);
      inst.shareScore = (p: Record<string, unknown>) => {
        const s = readScore(p);
        if (!s) return;
        const url = scoreUrl(s);
        const { message } = scoreWords(s);
        // straight from the tap, or the phone won't open its share sheet
        if (navigator.share) {
          navigator.share({ text: message, url }).catch((e: Error) => {
            if (e?.name !== 'AbortError' && copy(`${message}\n${url}`)) say('Copied. Paste it into WhatsApp or a text.');
          });
          return;
        }
        if (copy(`${message}\n${url}`)) say('Copied. Paste it into WhatsApp or a text.');
        else say(url);
      };
      // the home screen's 'Keep it on your phone' card
      const sync = () => inst.setState({ instStandalone: isStandalone(), instOs: osOf(), instCan: canPrompt() });
      inst.installPrompt = async () => {
        const r = await promptInstall();
        if (r === 'accepted') say('Installed. Open it from your home screen.');
        sync();
      };
      sync();
      const off = onInstallChange(() => {
        sync();
        if (justInstalled()) inst.setState({ instCan: false });
      });
      return off;
    },
    [say],
  );

  // --fit: how much a contain or scroll screen is scaled; --fs: a game on a phone narrower than 390 (see build.mjs)
  const vars = { '--fit': String(fit), '--fs': String(Math.min(1, fit)), '--h': `${Math.round((screenH || 844) * fit)}px` } as React.CSSProperties;

  return (
    <div ref={appRef} className="wg-app" data-mode={mode}>
      {screen ? (
        <div className="wg-screen" style={vars}>
          <DcRoot key={screen} app={ALL[screen]} className="wg-host" setup={setup} />
        </div>
      ) : (
        <div className="wg-wait" aria-hidden="true">
          <span>Workshop Games</span>
        </div>
      )}
      {cramped ? (
        <div className="wg-turn" role="alert">
          <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="15" y="6" width="18" height="32" rx="3.5" />
            <path d="M22 33h4" />
            <path d="M38 22a14 14 0 0 1-6 13" />
            <path d="M32 35l0.5-5M32 35l4.5 2" />
          </svg>
          <p>Turn your phone upright to play</p>
          <a href="#/">Back to the games</a>
        </div>
      ) : null}
      {toast ? (
        <div key={toast.n} className="wg-toast" role="status">
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
