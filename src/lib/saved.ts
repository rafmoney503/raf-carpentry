'use client';
import { useSyncExternalStore } from 'react';

/* "Save for my brief": the hearts on 3D designs and jobs. What a visitor saves is kept in their own browser only
   (localStorage raf_saved; the list itself is never sent anywhere, though the visit counter notes the tap on a heart and
   which job it saved, as it notes any tap) and shows in Plan your project, where each one goes into the
   brief message with its link. If the browser won't keep it (private mode, blocked storage) it lasts until the
   page is closed. Other tabs follow along through the storage event, so a design saved in a tab opened from the
   brief shows up in the brief straight away. */

export type SavedItem = {
  id: string; // 'job:<slug>' or 'design:<code>'
  title: string;
  area: string;
  href: string; // path on the site, e.g. /portfolio/<slug>
  image?: string; // a still or photo for the brief
};

const KEY = 'raf_saved';
const EVENT = 'raf:saved';
export const MAX_SAVED = 12;
const EMPTY: SavedItem[] = [];

let memory: SavedItem[] | null = null; // used when localStorage throws
let cacheRaw: string | null = null;
let cache: SavedItem[] = EMPTY;

function parse(raw: string): SavedItem[] {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return EMPTY;
    return list
      .filter((x) => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.href === 'string' && x.href.startsWith('/'))
      .map((x) => ({ id: x.id, title: x.title, area: typeof x.area === 'string' ? x.area : '', href: x.href, image: typeof x.image === 'string' ? x.image : undefined }))
      .slice(0, MAX_SAVED);
  } catch {
    return EMPTY;
  }
}

function read(): SavedItem[] {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache;
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  cache = raw ? parse(raw) : EMPTY;
  return cache;
}

function write(list: SavedItem[], added = false) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    memory = null;
  } catch {
    memory = list;
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { added } }));
}

/* Called with true each time something is saved in this tab (the Plan your project button pops). */
export function onSavedChange(cb: (added: boolean) => void) {
  const h = (e: Event) => cb(Boolean((e as CustomEvent<{ added?: boolean }>).detail?.added));
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useSaved(): SavedItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/* Save, or unsave if it's already there. Newest first; the oldest drops off past MAX_SAVED. */
export function toggleSaved(item: SavedItem) {
  const list = read();
  if (list.some((x) => x.id === item.id)) write(list.filter((x) => x.id !== item.id));
  else write([item, ...list].slice(0, MAX_SAVED), true);
}

export function removeSaved(id: string) {
  write(read().filter((x) => x.id !== id));
}

export const SITE_URL = 'https://www.rafcarpentry.com';
export const savedUrl = (s: SavedItem) => `${SITE_URL}${s.href}`;
