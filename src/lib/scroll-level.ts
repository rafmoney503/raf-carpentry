/* The spirit level under the home page title (17 Oct 2026, Raf: 'when page scrolls level moves, when stop levels to 0
   giving green check mark on side', mockup 'rafcarpentry.com · scroll it' on the Rafal Solutions design canvas).

   Two tiny stores, so the level in the hero and the small copy in the navbar move together:
   - reading: the tilt and bubble, fed by ONE passive scroll listener that does its sums once per animation frame.
     It is only attached while a level is on the page, and never for people who ask for less motion (the level then
     just sits level with its tick).
   - dock: whether the hero level is on this page and has scrolled up under the header, so the navbar shows the small
     copy. The navbar only listens to this one, so other pages get no scroll listener at all. */

export type LevelReading = { deg: number; bubble: number; level: boolean };
export type LevelDock = { present: boolean; docked: boolean };

const LEVEL: LevelReading = { deg: 0, bubble: 0, level: true };
const UNDOCKED: LevelDock = { present: false, docked: false };

let reading: LevelReading = LEVEL;
let dock: LevelDock = UNDOCKED;
const readingListeners = new Set<() => void>();
const dockListeners = new Set<() => void>();

let lastY = 0;
let lastT = 0;
let frame = 0;
let settleTimer = 0;
let attached = false;

const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

function setReading(next: LevelReading) {
  reading = next;
  readingListeners.forEach((l) => l());
}

// Scroll speed tips the bar: scrolling down turns it clockwise (up to 2.4 degrees) and the bubble runs to the high
// side (up to 20 px). A quarter of a second after the page stops, it settles back to level.
function onFrame(now: number) {
  frame = 0;
  const y = window.scrollY;
  const dt = Math.max(16, now - lastT);
  const v = (y - lastY) / dt; // px per ms, positive when scrolling down
  lastY = y;
  lastT = now;
  if (Math.abs(v) < 0.005) return;
  setReading({ deg: clamp(v * 1.8, 2.4), bubble: clamp(-v * 16, 20), level: false });
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => setReading(LEVEL), 240);
}

function onScroll() {
  if (!frame) frame = requestAnimationFrame(onFrame);
}

function attach() {
  if (attached || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  attached = true;
  lastY = window.scrollY;
  lastT = performance.now();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function detach() {
  if (!attached) return;
  attached = false;
  window.removeEventListener('scroll', onScroll);
  cancelAnimationFrame(frame);
  frame = 0;
  window.clearTimeout(settleTimer);
  reading = LEVEL;
}

export function subscribeReading(listener: () => void) {
  readingListeners.add(listener);
  attach();
  return () => {
    readingListeners.delete(listener);
    if (!readingListeners.size) detach();
  };
}
export const getReading = () => reading;
export const getLevelReading = () => LEVEL;

export function subscribeDock(listener: () => void) {
  dockListeners.add(listener);
  return () => {
    dockListeners.delete(listener);
  };
}
export const getDock = () => dock;
export const getUndocked = () => UNDOCKED;

export function setDock(next: Partial<LevelDock>) {
  const merged = { ...dock, ...next };
  if (merged.present === dock.present && merged.docked === dock.docked) return;
  dock = merged;
  dockListeners.forEach((l) => l());
}
