'use client';
import { useSyncExternalStore } from 'react';
import { isCost, type Cost, type CostData, type CostEntry, type JobSet, type Snap } from '@/lib/job-costs';
import { deviceId } from './sync';
import { readPin } from './uploader';

/* What each job made, on this device and the other one (11 Nov 2026): the costs put on jobs, Raf's days and 'that's
   all the costs', and a snapshot of each finished job (src/lib/job-costs.ts says what each doc is). Kept in
   localStorage (raf_jobkit_costs) so it opens with no signal; each change waits in raf_jobkit_costs_pend until the
   store has it. The store is Supabase jobkit.costs through /api/job-kit/costs behind the PIN. Like the personal to
   do (chores-store.ts), the later change of a doc wins and a removed one is kept as a date, but a round only brings
   back what changed after this device's place in the store (raf_jobkit_costs_rev), as the list grows with every
   receipt. A receipt photo waits on the device that took it (IndexedDB raf-job-kit-receipts) until it's on the job
   in ServiceM8. */

export type Doc = { id: string; at: number; data: CostData };
type Store = { docs: Record<string, Doc>; gone: Record<string, number>; rev: number };
type Pend = Record<string, number>;
export type CostSync = 'idle' | 'syncing' | 'offline' | 'no-pin' | 'error' | 'not-set-up';

const KEY = 'raf_jobkit_costs';
const PEND_KEY = 'raf_jobkit_costs_pend';
const SKEW_KEY = 'raf_jobkit_costs_skew';
const THUMBS_KEY = 'raf_jobkit_receipt_thumbs';
const EVENT = 'jk-costs';
const EMPTY: Store = { docs: {}, gone: {}, rev: 0 };
const GONE_KEEP = 120 * 864e5;

const okDoc = (d: unknown): d is Doc => {
  const x = d as Doc;
  return Boolean(x) && typeof x.id === 'string' && typeof x.at === 'number' && Boolean(x.data) && typeof x.data === 'object' && typeof (x.data as { kind?: unknown }).kind === 'string';
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
    cache =
      v && v.docs && typeof v.docs === 'object'
        ? { docs: Object.fromEntries(Object.entries(v.docs).filter(([, d]) => okDoc(d))), gone: v.gone && typeof v.gone === 'object' ? v.gone : {}, rev: typeof v.rev === 'number' ? v.rev : 0 }
        : EMPTY;
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
  views = null;
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
    /* it goes next time */
  }
  pendCount = Object.keys(p).length;
  fireState();
};

/* ---------- what the screens read ---------- */

export type CostsView = { costs: CostEntry[]; sets: Record<string, JobSet>; snaps: Record<string, Snap>; skips: Set<string>; mails: Set<string> };
let views: CostsView | null = null;
function viewOf(s: Store): CostsView {
  if (views) return views;
  const costs: CostEntry[] = [];
  const sets: Record<string, JobSet> = {};
  const snaps: Record<string, Snap> = {};
  const skips = new Set<string>();
  const mails = new Set<string>();
  for (const d of Object.values(s.docs)) {
    const x = d.data;
    if (isCost(x)) {
      costs.push({ id: d.id, at: d.at, data: x });
      if (x.mail) mails.add(x.mail);
    } else if (x.kind === 'set') sets[x.job] = x;
    else if (x.kind === 'snap') snaps[x.job] = x;
    else if (x.kind === 'skip') skips.add(x.mail);
  }
  costs.sort((a, b) => b.data.date.localeCompare(a.data.date) || b.data.made - a.data.made);
  views = { costs, sets, snaps, skips, mails };
  return views;
}
const listen = (fire: () => void) => {
  window.addEventListener(EVENT, fire);
  window.addEventListener('storage', fire);
  return () => {
    window.removeEventListener(EVENT, fire);
    window.removeEventListener('storage', fire);
  };
};
const EMPTY_VIEW: CostsView = { costs: [], sets: {}, snaps: {}, skips: new Set(), mails: new Set() };
export const useCosts = () => useSyncExternalStore(listen, () => viewOf(readStore()), () => EMPTY_VIEW);
export const readCosts = () => viewOf(readStore());

/* ---------- changes ---------- */

let skew = 0;
try {
  skew = Number(localStorage.getItem(SKEW_KEY)) || 0;
} catch {
  /* learnt on the first round */
}
const stamp = () => Math.round(Date.now() + skew);

function mark(id: string, at: number) {
  const p = readPend();
  p[id] = at;
  writePend(p);
  costsSoon();
}
export function putDoc(id: string, data: CostData) {
  const at = stamp();
  const s = readStore();
  const gone = { ...s.gone };
  delete gone[id];
  writeStore({ ...s, docs: { ...s.docs, [id]: { id, at, data } }, gone });
  mark(id, at);
}
export function dropDoc(id: string) {
  const s = readStore();
  if (!s.docs[id]) return;
  const at = stamp();
  const docs = { ...s.docs };
  delete docs[id];
  writeStore({ ...s, docs, gone: { ...s.gone, [id]: at } });
  mark(id, at);
  void dropBlob(id);
}
export const newCostId = () => `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const putCost = (id: string, c: Cost) => putDoc(id, c);
export const setJob = (job: string, patch: Partial<Omit<JobSet, 'kind' | 'job'>>) => {
  const was = readCosts().sets[job];
  putDoc(`j-${job}`, { ...(was ?? { kind: 'set', job }), ...patch, kind: 'set', job });
};
/* A finished job as ServiceM8 sent it: written only when something in it changed. */
export const putSnap = (s: Snap) => putDoc(`s-${s.job}`, { ...s, at: stamp() });

/* ---------- receipt photos waiting on this device ---------- */

const DB = 'raf-job-kit-receipts';
function db(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (st: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    const t = d.transaction('files', mode);
    const req = run(t.objectStore('files'));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = () => resolve(undefined);
  });
}
export const keepBlob = (id: string, file: { blob: Blob; name: string; type: string }) => tx('readwrite', (st) => void st.put(file, id));
export const blobOf = (id: string) => tx<{ blob: Blob; name: string; type: string }>('readonly', (st) => st.get(id));
export const dropBlob = (id: string) => tx('readwrite', (st) => void st.delete(id));

/* A small picture of a receipt taken here, for this device's lists. */
export function keepThumb(id: string, url: string) {
  try {
    const all = JSON.parse(localStorage.getItem(THUMBS_KEY) || '{}') as Record<string, string>;
    delete all[id];
    const next = Object.fromEntries([[id, url], ...Object.entries(all)].slice(0, 40));
    localStorage.setItem(THUMBS_KEY, JSON.stringify(next));
  } catch {
    /* no room: the list shows the shop's initial */
  }
}
export function thumbOf(id: string): string {
  try {
    return (JSON.parse(localStorage.getItem(THUMBS_KEY) || '{}') as Record<string, string>)[id] ?? '';
  } catch {
    return '';
  }
}

/* The photo or PDF onto its job in ServiceM8. '' when it's there (or there's nothing to send), else why not. */
export async function sendPhoto(id: string): Promise<string> {
  const d = readCosts().costs.find((c) => c.id === id);
  if (!d || !d.data.photoWaiting) return '';
  const job = d.data.where === 'job' ? d.data.jobs[0]?.job : '';
  if (!job) {
    putCost(id, { ...d.data, photoWaiting: false }); // on no job: the receipt stays where it is
    await dropBlob(id);
    return '';
  }
  const pin = readPin();
  if (!pin) return 'no-pin';
  const name = `Receipt - ${d.data.shop}, ${d.data.date}`;
  let res: Response;
  if (d.data.mail && d.data.mailAtt) {
    // the email's own file, from info@ (either device can send it)
    try {
      res = await fetch('/api/job-kit/receipt', {
        method: 'POST',
        headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'attach-mail', id: d.data.mail, att: d.data.mailAtt, job, key: id, name }),
        cache: 'no-store',
      });
    } catch {
      return 'offline';
    }
  } else {
    const file = await blobOf(id);
    if (!file) return ''; // on the other device: it goes from there
    const fd = new FormData();
    fd.set('action', 'attach');
    fd.set('file', file.blob, file.name);
    fd.set('job', job);
    fd.set('key', id);
    fd.set('name', name);
    try {
      res = await fetch('/api/job-kit/receipt', { method: 'POST', headers: { 'x-job-kit-pin': pin }, body: fd, cache: 'no-store' });
    } catch {
      return 'offline';
    }
  }
  if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error || 'error';
  const r = (await res.json()) as { uuid?: string };
  const now = readCosts().costs.find((c) => c.id === id);
  if (now) putCost(id, { ...now.data, photoWaiting: false, photo: { job, uuid: r.uuid ?? '' } });
  await dropBlob(id);
  return '';
}
let sendingPhotos = false;
async function sendWaiting() {
  if (sendingPhotos || navigator.onLine === false) return;
  sendingPhotos = true;
  try {
    for (const c of readCosts().costs.filter((x) => x.data.photoWaiting)) {
      if (!(c.data.mail && c.data.mailAtt) && !(await blobOf(c.id))) continue; // on the other device
      const err = await sendPhoto(c.id);
      if (err) break;
    }
  } finally {
    sendingPhotos = false;
  }
}

/* ---------- in step with the other device ---------- */

let state: CostSync = 'idle';
let pendCount = 0;
let lastAt = 0;
const stateSubs = new Set<() => void>();
const fireState = () => stateSubs.forEach((f) => f());
const setState = (s: CostSync) => {
  state = s;
  fireState();
};
let snap: { state: CostSync; waiting: number; at: number } = { state, waiting: 0, at: 0 };
export const useCostSync = () =>
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

type Wire = { id: string; at: number; data: CostData | null };
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;

export function costsSoon(ms = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void round();
  }, ms);
}

async function round(): Promise<void> {
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
    let more = true;
    let guard = 0;
    while (more && guard++ < 10) {
      const s = readStore();
      const pend = readPend();
      const sent: Wire[] = Object.entries(pend)
        .slice(0, 200)
        .map(([id, at]) => (s.docs[id] ? { id, at: s.docs[id].at, data: s.docs[id].data } : { id, at: s.gone[id] ?? at, data: null }));
      const sentAt = Date.now();
      let res: Response;
      try {
        res = await fetch('/api/job-kit/costs', {
          method: 'POST',
          headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' },
          body: JSON.stringify({ device: deviceId(), since: s.rev, docs: sent }),
          cache: 'no-store',
        });
      } catch {
        return setState('offline');
      }
      if (!res.ok) return setState(res.status === 401 ? 'no-pin' : res.status === 503 ? 'not-set-up' : 'error');
      const r = (await res.json()) as { docs?: Wire[]; rev?: number; more?: boolean; now?: number };
      if (!Array.isArray(r.docs)) return setState('error');
      if (typeof r.now === 'number') {
        skew = Math.round(r.now - (sentAt + Date.now()) / 2);
        try {
          localStorage.setItem(SKEW_KEY, String(skew));
        } catch {
          /* kept in memory */
        }
      }
      take(r.docs, typeof r.rev === 'number' ? r.rev : s.rev, sent, pend);
      more = Boolean(r.more) || Object.keys(readPend()).length > 0 && sent.length === 200;
    }
    lastAt = Date.now();
    setState('idle');
    void sendWaiting();
  } finally {
    running = false;
    if (again) {
      again = false;
      costsSoon(300);
    }
  }
}

/* What came back: the later change of each doc wins; what went up stops waiting unless it changed again while the
   round was out. A doc sent back at an earlier time than this device stamped it (this clock was ahead) is the same
   doc: it stops waiting too. */
function take(docs: Wire[], rev: number, sent: Wire[], pendSent: Pend) {
  const s = readStore();
  const all = { ...s.docs };
  const gone = { ...s.gone };
  const back = new Map<string, Wire>();
  for (const d of docs) {
    if (!d || typeof d.id !== 'string' || typeof d.at !== 'number') continue;
    back.set(d.id, d);
    const hereAt = all[d.id]?.at ?? gone[d.id] ?? -1;
    if (d.at <= hereAt) continue;
    if (d.data && okDoc({ id: d.id, at: d.at, data: d.data })) {
      all[d.id] = { id: d.id, at: d.at, data: d.data };
      delete gone[d.id];
    } else if (!d.data) {
      delete all[d.id];
      gone[d.id] = d.at;
    }
  }
  const pend = readPend();
  for (const d of sent) {
    if (pend[d.id] !== pendSent[d.id]) continue; // changed again meanwhile
    const sv = back.get(d.id);
    if (!sv || sv.at >= d.at) delete pend[d.id];
    else if (JSON.stringify(sv.data) === JSON.stringify(d.data)) {
      // kept on the store's earlier time: the same doc, so take that time
      delete pend[d.id];
      if (d.data && all[d.id]?.at === d.at) all[d.id] = { ...all[d.id], at: sv.at };
      else if (!d.data && gone[d.id] === d.at) gone[d.id] = sv.at;
    }
  }
  const now = stamp();
  for (const [id, at] of Object.entries(gone)) if (now - at > GONE_KEEP) delete gone[id];
  writeStore({ docs: all, gone, rev: Math.max(s.rev, rev) });
  writePend(pend);
}

/* Started once by the app, beside the jobs' sync. */
export function startCosts() {
  pendCount = Object.keys(readPend()).length;
  costsSoon(900);
  const tick = setInterval(() => {
    if (document.visibilityState === 'visible') costsSoon(0);
  }, 60_000);
  const vis = () => costsSoon(document.visibilityState === 'visible' ? 300 : 0);
  const online = () => costsSoon(0);
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('online', online);
  return () => {
    clearInterval(tick);
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('online', online);
  };
}
