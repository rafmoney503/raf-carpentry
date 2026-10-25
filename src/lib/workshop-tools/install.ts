/* Workshop Tools on a phone's home screen: which kind of phone this is, whether it is already open from the
   home screen, the browser's own Install prompt (Android and computers with Chrome or Edge), and the offline
   copy (public/workshop-tools-sw.js). Used by the app (/tools/workshop/app) and its page (/tools/workshop). */

export const APP_PATH = '/tools/workshop/app';
export const SCOPE = '/tools/workshop';

export type Os = 'ios' | 'ios-other' | 'android' | 'desktop' | '';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: PromptEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const tell = () => subs.forEach((f) => f());

// Listening as soon as this file loads: Chrome may offer the prompt before the page has finished drawing.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // our own Install button instead of the browser's bar
    deferred = e as PromptEvent;
    tell();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    tell();
  });
}

export function onInstallChange(fn: () => void) {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

export const canPrompt = () => !!deferred;
export const justInstalled = () => installed;

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'none'> {
  const e = deferred;
  if (!e) return 'none';
  deferred = null;
  tell();
  try {
    await e.prompt();
    const r = await e.userChoice;
    return r.outcome;
  } catch {
    return 'none';
  }
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
}

export function osOf(): Os {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/* The offline copy. The worker keeps the app page and, once it is running, everything this page has loaded
   (scripts, styles, fonts), so the next opening works with no signal. */
export function keepOffline() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const onApp = location.pathname.startsWith(APP_PATH);
  navigator.serviceWorker
    .register('/workshop-tools-sw.js', { scope: SCOPE })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => {
          try {
            const x = new URL(u);
            return x.origin === location.origin && (x.pathname.startsWith('/_next/static/') || x.pathname.startsWith('/fonts/workshop/'));
          } catch {
            return false;
          }
        });
      // From the app itself the worker also clears out the scripts of older versions.
      reg.active?.postMessage({ type: 'keep', urls, prune: onApp });
    })
    .catch(() => {});
  navigator.storage?.persist?.().catch(() => {});
}

/* Pro (saved jobs, £19.99 a year) is shown on previews and locally, but not to the public until card payments
   are connected: on www.rafcarpentry.com saving jobs is simply free. ?pro=test shows it on the live site (that
   tab only). */
export function proOnSale(): boolean {
  if (typeof window === 'undefined') return true;
  const live = /(^|\.)rafcarpentry\.com$/.test(location.hostname);
  if (!live) return true;
  try {
    if (new URLSearchParams(location.search).get('pro') === 'test') sessionStorage.setItem('rc-tools-pro-test', '1');
    return sessionStorage.getItem('rc-tools-pro-test') === '1';
  } catch {
    return false;
  }
}
