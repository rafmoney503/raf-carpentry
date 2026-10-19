/* New versions of the Job Kit (19 Oct 2026, Raf kept seeing the old version after a change went live, because a
   home-screen app or an open tab doesn't load the page again by itself). Each build carries its own id (JK_BUILD,
   set in next.config.ts); /api/job-kit/version answers the id of what's live now. When they differ the app says so
   and loads the new version when that's safe: straight away on Today with nothing being typed, or when the app
   comes back after a while away. Everything is saved as it's typed, and sending carries on after a reload. */

const BUILT = process.env.JK_BUILD || '';

export async function liveVersion(): Promise<string> {
  try {
    const r = await fetch('/api/job-kit/version', { cache: 'no-store' });
    if (!r.ok) return '';
    return ((await r.json()) as { v?: string }).v || '';
  } catch {
    return '';
  }
}

/* Checks on open (after a few seconds), when the app comes back, and every 5 minutes while it's on screen. */
export function watchVersion(onNew: (live: string) => void) {
  if (!BUILT) return () => {};
  let found = false;
  const check = async () => {
    if (found || document.visibilityState !== 'visible') return;
    const v = await liveVersion();
    if (v && v !== BUILT) {
      found = true;
      onNew(v);
    }
  };
  const first = setTimeout(() => void check(), 4000);
  const tick = setInterval(() => void check(), 5 * 60_000);
  const vis = () => void check();
  document.addEventListener('visibilitychange', vis);
  return () => {
    clearTimeout(first);
    clearInterval(tick);
    document.removeEventListener('visibilitychange', vis);
  };
}

/* Nothing being typed and no sheet open: a reload loses nothing. */
export function safeToReload() {
  const a = document.activeElement;
  if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement || (a instanceof HTMLElement && a.isContentEditable))
    return false;
  return !document.querySelector('[role="dialog"][aria-modal="true"]');
}

/* Load the live version. Done by itself only once per version in this tab, so a page that somehow still comes back
   old can't keep reloading; the Update button always does it. */
const TRIED = 'raf_jobkit_reloaded_for';
export function reloadFor(live: string, byItself: boolean) {
  try {
    if (byItself && sessionStorage.getItem(TRIED) === live) return false;
    sessionStorage.setItem(TRIED, live);
  } catch {
    if (byItself) return false;
  }
  location.reload();
  return true;
}
