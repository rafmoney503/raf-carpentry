'use client';
import { useSyncExternalStore } from 'react';
import { dayOf, type Chore } from '@/lib/chores';
import { deviceId } from './sync';
import { readPin } from './uploader';

/* The personal to do's list on this device, and the same list on the other one (26 Oct 2026). The chores live in
   localStorage (raf_jobkit_chores) so the list opens with no signal; each change waits in raf_jobkit_chores_pend
   until the store has it. The store is its own small table in the cabinetos Supabase project (jobkit.chores, through
   /api/job-kit/chores behind the PIN), apart from the jobs' sync so a phone still on an older Job Kit never sees a
   chore. Each round sends what changed here and gets the whole list back (a few dozen lines); the later change of a
   chore wins, a deleted chore is kept as a date so it can't come back from the other device. */

type Store = { list: Chore[]; gone: Record<string, number> };
type Pend = Record<string, number>; // id -> when it changed here
export type ChoreSync = 'idle' | 'syncing' | 'offline' | 'no-pin' | 'error';

const KEY = 'raf_jobkit_chores';
const PEND_KEY = 'raf_jobkit_chores_pend';
const EVENT = 'jk-chores';
const EMPTY: Store = { list: [], gone: {} };
const DONE_KEEP = 30 * 864e5; // a one-off ticked over 30 days ago goes
const GONE_KEEP = 120 * 864e5; // a deletion is remembered this long

/* JSON with its keys in order, so the same chore always reads the same. */
const keys = (_k: string, v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : v;

const isChore = (v: unknown): v is Chore => {
  const c = v as Chore;
  return Boolean(c) && typeof c === 'object' && typeof c.id === 'string' && typeof c.text === 'string' && typeof c.at === 'number' && (c.due === null || typeof c.due === 'string');
};

let raw: string | null | undefined;
let cache: Store = EMPTY;
let memOnly = false;

function readStore(): Store {
  if (memOnly) return cache;
  let r: string | null = null;
  try {
    r = localStorage.getItem(KEY);
  } catch {
    memOnly = true;
    return cache;
  }
  if (r === raw) return cache;
  raw = r;
  try {
    const v = JSON.parse(r || 'null') as Partial<Store> | null;
    cache = v && Array.isArray(v.list) ? { list: v.list.filter(isChore), gone: v.gone && typeof v.gone === 'object' ? v.gone : {} } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}
function writeStore(s: Store) {
  const r = JSON.stringify(s);
  try {
    localStorage.setItem(KEY, r);
    raw = r;
  } catch {
    memOnly = true;
  }
  cache = s;
  window.dispatchEvent(new Event(EVENT));
}
const readPend = (): Pend => {
  try {
    return (JSON.parse(localStorage.getItem(PEND_KEY) || '{}') as Pend) || {};
  } catch {
    return {};
  }
};
const writePend = (p: Pend) => {
  try {
    localStorage.setItem(PEND_KEY, JSON.stringify(p));
  } catch {
    /* blocked: it goes next time */
  }
  pendCount = Object.keys(p).length;
  fireState();
};

/* ---------- the list ---------- */

const listen = (fire: () => void) => {
  window.addEventListener(EVENT, fire);
  window.addEventListener('storage', fire);
  return () => {
    window.removeEventListener(EVENT, fire);
    window.removeEventListener('storage', fire);
  };
};
export const useChores = () => useSyncExternalStore(listen, () => readStore().list, () => EMPTY.list);
export const readChores = () => readStore().list;

/* A day ticking over while the app is open: the list's groups follow. */
export function useToday() {
  return useSyncExternalStore(
    (fire) => {
      const t = setInterval(fire, 60_000);
      document.addEventListener('visibilitychange', fire);
      return () => {
        clearInterval(t);
        document.removeEventListener('visibilitychange', fire);
      };
    },
    () => dayOf(new Date()),
    () => '',
  );
}

/* Each change is stamped on the store's clock (this device's clock plus how far it's out, learnt from each round),
   so a phone a few minutes fast can't win over a later change made on the computer. */
const SKEW_KEY = 'raf_jobkit_chores_skew';
let skew = 0;
try {
  skew = Number(localStorage.getItem(SKEW_KEY)) || 0;
} catch {
  /* no storage: learnt on the first round */
}
const stamp = () => Math.round(Date.now() + skew);

function mark(id: string, at: number) {
  const p = readPend();
  p[id] = at;
  writePend(p);
  choresSoon();
}

/* Every change goes through here (or dropChore), stamped now. */
export function putChore(change: Chore) {
  const c = { ...change, at: stamp() };
  const s = readStore();
  const list = s.list.some((x) => x.id === c.id) ? s.list.map((x) => (x.id === c.id ? c : x)) : [...s.list, c];
  const gone = { ...s.gone };
  delete gone[c.id];
  writeStore({ list, gone });
  mark(c.id, c.at);
}
export function dropChore(id: string) {
  const s = readStore();
  const at = stamp();
  writeStore({ list: s.list.filter((x) => x.id !== id), gone: { ...s.gone, [id]: at } });
  mark(id, at);
}
/* Undo: the chore as it was, as a new change so it wins on the other device too. */
export const putBack = (c: Chore) => putChore(c);

export const newChoreId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* Once a day: ticked one-offs from over a month ago go, and old deletions are forgotten. */
function tidy() {
  const s = readStore();
  const now = stamp();
  const old = s.list.filter((c) => !c.rep && c.done && now - c.done > DONE_KEEP);
  const gone = Object.fromEntries(Object.entries(s.gone).filter(([, at]) => now - at < GONE_KEEP));
  if (!old.length && Object.keys(gone).length === Object.keys(s.gone).length) return;
  for (const c of old) gone[c.id] = now;
  writeStore({ list: s.list.filter((c) => !old.includes(c)), gone });
  const p = readPend();
  for (const c of old) p[c.id] = now;
  writePend(p);
}

/* ---------- in step with the other device ---------- */

let state: ChoreSync = 'idle';
let pendCount = 0;
let lastAt = 0;
const stateSubs = new Set<() => void>();
const fireState = () => stateSubs.forEach((f) => f());
const setState = (s: ChoreSync) => {
  state = s;
  fireState();
};
let snap: { state: ChoreSync; waiting: number; at: number } = { state, waiting: 0, at: 0 };
export const useChoreSync = () =>
  useSyncExternalStore(
    (fire) => {
      stateSubs.add(fire);
      return () => void stateSubs.delete(fire);
    },
    () => {
      if (snap.state !== state || snap.waiting !== pendCount || snap.at !== lastAt) snap = { state, waiting: pendCount, at: lastAt };
      return snap;
    },
    () => snap,
  );

type Doc = { id: string; at: number; data: Chore | null };
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;

export function choresSoon(ms = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void round();
  }, ms);
}

async function round() {
  if (running) {
    again = true;
    return;
  }
  const pin = readPin();
  if (!pin) return setState('no-pin');
  if (navigator.onLine === false) return setState('offline');
  running = true;
  setState('syncing');
  try {
    const s = readStore();
    const pend = readPend();
    const sent: Doc[] = Object.entries(pend)
      .slice(0, 500)
      .map(([id, at]) => {
        const c = s.list.find((x) => x.id === id);
        return c ? { id, at: c.at, data: c } : { id, at: s.gone[id] ?? at, data: null };
      });
    let res: Response;
    const sentAt = Date.now();
    try {
      res = await fetch('/api/job-kit/chores', {
        method: 'POST',
        headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' },
        body: JSON.stringify({ device: deviceId(), docs: sent }),
        cache: 'no-store',
      });
    } catch {
      return setState('offline');
    }
    if (!res.ok) return setState(res.status === 401 ? 'no-pin' : 'error');
    const r = (await res.json()) as { docs?: Doc[]; now?: number };
    if (!Array.isArray(r.docs)) return setState('error');
    if (typeof r.now === 'number') {
      skew = Math.round(r.now - (sentAt + Date.now()) / 2);
      try {
        localStorage.setItem(SKEW_KEY, String(skew));
      } catch {
        /* kept in memory */
      }
    }
    take(r.docs, sent, pend);
    lastAt = Date.now();
    setState('idle');
  } finally {
    running = false;
    if (again) {
      again = false;
      choresSoon(300);
    }
  }
}

/* What the store has: the later change of each chore wins; what went up is no longer waiting unless it changed again
   while the round was out; anything here the store has never had goes up next. */
function take(docs: Doc[], sent: Doc[], pendSent: Pend) {
  const s = readStore();
  const list = new Map(s.list.map((c) => [c.id, c]));
  const gone = { ...s.gone };
  const server = new Map<string, Doc>();
  let changed = false;
  for (const d of docs) {
    if (!d || typeof d.id !== 'string' || typeof d.at !== 'number') continue;
    server.set(d.id, d);
    const here = list.get(d.id);
    const hereAt = here?.at ?? gone[d.id] ?? -1;
    if (d.at <= hereAt) continue;
    if (d.data && isChore(d.data)) {
      list.set(d.id, { ...d.data, id: d.id, at: d.at });
      delete gone[d.id];
      changed = true;
    } else if (!d.data && here) {
      list.delete(d.id);
      gone[d.id] = d.at;
      changed = true;
    }
  }
  if (changed) writeStore({ list: [...list.values()], gone });
  const pend = readPend();
  const same = (a: unknown, b: unknown) => JSON.stringify(a, keys) === JSON.stringify(b, keys);
  let restamp = false;
  for (const d of sent) {
    const sv = server.get(d.id);
    if (!sv || pend[d.id] !== pendSent[d.id]) continue;
    if (sv.at >= d.at) delete pend[d.id];
    else if (same({ ...sv.data, at: 0 }, d.data ? { ...d.data, at: 0 } : null) || (!sv.data && !d.data)) {
      // the store kept it with an earlier time (this clock was ahead): it's there, on the store's time
      delete pend[d.id];
      const here = list.get(d.id);
      if (here && here.at === d.at) {
        list.set(d.id, { ...here, at: sv.at });
        restamp = true;
      } else if (!here && gone[d.id] === d.at) {
        gone[d.id] = sv.at;
        restamp = true;
      }
    }
  }
  if (restamp) writeStore({ list: [...list.values()], gone });
  let more = false;
  for (const c of list.values()) {
    if (!server.has(c.id) && !(c.id in pend)) {
      pend[c.id] = c.at;
      more = true;
    }
  }
  writePend(pend);
  if (more) choresSoon(800);
}

/* Started once by the app, beside the jobs' sync. */
export function startChores() {
  tidy();
  pendCount = Object.keys(readPend()).length;
  choresSoon(600);
  const tick = setInterval(() => {
    if (document.visibilityState === 'visible') choresSoon(0);
  }, 60_000);
  const vis = () => {
    if (document.visibilityState === 'visible') tidy();
    choresSoon(document.visibilityState === 'visible' ? 300 : 0);
  };
  const online = () => choresSoon(0);
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('online', online);
  return () => {
    clearInterval(tick);
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('online', online);
  };
}
