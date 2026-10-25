/* Workshop Games on a phone's home screen. Which phone it is and the browser's own Install prompt are the same as
   for Workshop Tools (one listener for the whole site, src/lib/workshop-tools/install.ts); the offline copy is the
   games' own worker (public/workshop-games-sw.js, scope /tools/games). */

export { canPrompt, isStandalone, justInstalled, onInstallChange, osOf, promptInstall, type Os } from '@/lib/workshop-tools/install';

export const APP_PATH = '/tools/games/app';
export const SCOPE = '/tools/games';

/* The worker keeps the app page and, once running, everything this page loaded (scripts, styles, fonts), so the
   next opening works with no signal. From the app itself it also clears out the scripts of older versions. */
export function keepGamesOffline() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const onApp = location.pathname.startsWith(APP_PATH);
  navigator.serviceWorker
    .register('/workshop-games-sw.js', { scope: SCOPE })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => {
          try {
            const x = new URL(u);
            return x.origin === location.origin && (x.pathname.startsWith('/_next/static/') || x.pathname.startsWith('/fonts/games/'));
          } catch {
            return false;
          }
        });
      reg.active?.postMessage({ type: 'keep', urls, prune: onApp });
    })
    .catch(() => {});
  navigator.storage?.persist?.().catch(() => {});
}
