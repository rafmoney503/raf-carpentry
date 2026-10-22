'use client';
import { useSyncExternalStore } from 'react';

/* Your readings (22 Oct 2026): every Save from the spirit level (and later the other site tools) is kept in this
   browser only (localStorage raf_readings, newest first, up to 200), with a name and a place the person can give it.
   /tools/readings lists them by place and sends them on WhatsApp or copies them; nothing is sent anywhere else.
   If the browser won't keep them (private mode, blocked storage) they last until the page is closed. Other tabs
   follow along through the storage event. The words for the message are in messageFor (no React, so tests run it). */

export type Reading = {
  id: string;
  tool: 'level';
  at: string; // ISO time it was saved
  value: string; // '0.3°'
  detail: string; // 'raise the left end 3.1 mm over 600'
  label: string; // what it is, '' until named
  place: string; // where, '' = no place
  mode?: 'edge' | 'flat';
  deg?: number;
  len?: number;
};

const KEY = 'raf_readings';
const PLACE_KEY = 'raf_readings_place';
const EVENT = 'raf:readings';
export const MAX_READINGS = 200;
const EMPTY: Reading[] = [];

let memory: Reading[] | null = null;
let memoryPlace: string | null = null;
let cacheRaw: string | null = null;
let cache: Reading[] = EMPTY;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function parse(raw: string): Reading[] {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return EMPTY;
    return list
      .filter((x) => x && typeof x.id === 'string' && typeof x.value === 'string' && typeof x.at === 'string')
      .map((x) => ({
        id: x.id,
        tool: 'level' as const,
        at: x.at,
        value: str(x.value, 40),
        detail: str(x.detail, 200),
        label: str(x.label, 80),
        place: str(x.place, 60),
        mode: x.mode === 'flat' ? ('flat' as const) : x.mode === 'edge' ? ('edge' as const) : undefined,
        deg: num(x.deg),
        len: num(x.len),
      }))
      .slice(0, MAX_READINGS);
  } catch {
    return EMPTY;
  }
}

function read(): Reading[] {
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

function write(list: Reading[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    memory = null;
  } catch {
    memory = list;
  }
  window.dispatchEvent(new Event(EVENT));
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

export function useReadings(): Reading[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function addReading(r: Omit<Reading, 'id' | 'at'>): Reading {
  const item: Reading = { ...r, id: newId(), at: new Date().toISOString(), label: r.label.slice(0, 80), place: r.place.slice(0, 60) };
  write([item, ...read()].slice(0, MAX_READINGS));
  return item;
}

export function updateReading(id: string, patch: Partial<Pick<Reading, 'label' | 'place'>>) {
  write(read().map((r) => (r.id === id ? { ...r, ...(patch.label !== undefined ? { label: patch.label.slice(0, 80) } : {}), ...(patch.place !== undefined ? { place: patch.place.slice(0, 60) } : {}) } : r)));
}

export function removeReadings(ids: string[]) {
  const gone = new Set(ids);
  write(read().filter((r) => !gone.has(r.id)));
}

/** The place the last reading went to, so the next Save goes there too. */
export function lastPlace(): string {
  if (memoryPlace !== null) return memoryPlace;
  try {
    return window.localStorage.getItem(PLACE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setLastPlace(p: string) {
  try {
    window.localStorage.setItem(PLACE_KEY, p);
    memoryPlace = null;
  } catch {
    memoryPlace = p;
  }
}

/* ---- No React below: the message and the groups (tests run these with node) ---- */

/** The places used, the most recently used first. */
export function placesOf(list: Reading[]): string[] {
  const seen: string[] = [];
  for (const r of list) {
    const p = r.place.trim();
    if (p && !seen.includes(p)) seen.push(p);
  }
  return seen;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayStr = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** 'Today 09:42', 'Yesterday 14:05', 'Tue 14:05' this week, else '12 Oct 14:05'. */
export function whenSaved(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (sameDay(d, now)) return `Today ${hm}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return `Yesterday ${hm}`;
  const ago = (now.getTime() - d.getTime()) / 86400000;
  if (ago > 0 && ago < 6) return `${DAYS[d.getDay()]} ${hm}`;
  return `${dayStr(d)}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''} ${hm}`;
}

/** '22 Oct', or '20 to 22 Oct' / '30 Sep to 2 Oct' when the readings were taken on different days. */
function dateSpan(list: Reading[]) {
  const ds = list.map((r) => new Date(r.at)).filter((d) => !Number.isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
  if (!ds.length) return '';
  const a = ds[0];
  const b = ds[ds.length - 1];
  if (sameDay(a, b)) return dayStr(a);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()} to ${dayStr(b)}`;
  return `${dayStr(a)} to ${dayStr(b)}`;
}

export function readingLine(r: Reading) {
  const what = r.detail ? `${r.value}, ${r.detail}` : r.value;
  return r.label.trim() ? `${r.label.trim()}: ${what}` : what;
}

export const MESSAGE_FOOT = 'Measured with the free spirit level from Raf Carpentry\nrafcarpentry.com/tools/spirit-level';

/** The text that goes on WhatsApp or is copied: oldest first under each place, so it reads in the order they were taken. */
export function messageFor(list: Reading[], place: string | null): string {
  if (!list.length) return '';
  const span = dateSpan(list);
  const inOrder = [...list].reverse();
  const places = placesOf(list);
  const single = place !== null ? place : places.length <= 1 && list.every((r) => r.place.trim() === (places[0] ?? '')) ? places[0] ?? '' : null;
  if (single !== null) {
    const head = single ? `${single} · ${span}` : `Site readings · ${span}`;
    return `${head}\n${inOrder.map(readingLine).join('\n')}\n\n${MESSAGE_FOOT}`;
  }
  const blocks: string[] = [];
  for (const p of [...places].reverse()) {
    blocks.push(`${p}\n${inOrder.filter((r) => r.place.trim() === p).map(readingLine).join('\n')}`);
  }
  const none = inOrder.filter((r) => !r.place.trim());
  if (none.length) blocks.push(`No place\n${none.map(readingLine).join('\n')}`);
  return `Site readings · ${span}\n\n${blocks.join('\n\n')}\n\n${MESSAGE_FOOT}`;
}
