import { allItems, allJobs, delFile, getFile, getItem, getJob, jobJson, notesTxt, putItem, putJob, type Item } from './store';

/* Sends what the phone is holding to the inbox, one file at a time, oldest first. Clips go in 3 MB pieces
   (a Vercel function takes up to 4.5 MB), so a lost signal only costs the piece that was on its way.
   When nothing is waiting, the job details (job.json and notes.txt) follow. It stops when there is
   no signal or no PIN and starts again by itself (signal back, app opened, new photo). */

export const CHUNK = 3 * 1024 * 1024;

export type SendState = 'idle' | 'sending' | 'offline' | 'no-pin' | 'not-set-up' | 'wrong-pin' | 'inbox-key' | 'inbox-missing' | 'busy' | 'error';
export type Status = { state: SendState; itemId?: string; progress?: number };

/* ---------- the PIN, kept on this phone ---------- */

const PIN_KEY = 'raf_jobkit_pin';

export function readPin(): string {
  try {
    return localStorage.getItem(PIN_KEY) || '';
  } catch {
    return memPin;
  }
}
let memPin = '';
export function savePin(pin: string) {
  memPin = pin.trim();
  try {
    if (memPin) localStorage.setItem(PIN_KEY, memPin);
    else localStorage.removeItem(PIN_KEY);
  } catch {
    /* private mode: kept until the app closes */
  }
  wake();
}

/* ---------- listeners ---------- */

let status: Status = { state: 'idle' };
const statusSubs = new Set<(s: Status) => void>();
const changeSubs = new Set<() => void>();

export function onStatus(fn: (s: Status) => void) {
  statusSubs.add(fn);
  fn(status);
  return () => void statusSubs.delete(fn);
}
export function onChange(fn: () => void) {
  changeSubs.add(fn);
  return () => void changeSubs.delete(fn);
}
const set = (s: Status) => {
  status = s;
  statusSubs.forEach((f) => f(s));
};
const changed = () => changeSubs.forEach((f) => f());

/* ---------- the loop ---------- */

let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export function wake(delay = 0) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void loop();
  }, delay);
}

type Result = { ok: true } | { ok: false; why: SendState | 'network' | 'bad'; wait?: number };

async function why(res: Response): Promise<Result> {
  let code = '';
  let wait: number | undefined;
  try {
    const j = (await res.json()) as { error?: string; retryAfter?: number };
    code = j.error || '';
    wait = j.retryAfter;
  } catch {
    /* not JSON: Vercel's own error page */
  }
  if (res.status === 401) return { ok: false, why: 'wrong-pin' };
  if (res.status === 503 && code === 'not-set-up') return { ok: false, why: 'not-set-up' };
  if (res.status === 429) return { ok: false, why: 'busy', wait: wait || Number(res.headers.get('retry-after')) || 60 };
  if (code === 'inbox-key' || code === 'inbox-missing') return { ok: false, why: code };
  if (res.status === 400 || res.status === 413) return { ok: false, why: 'bad' };
  return { ok: false, why: 'error' };
}

async function post(url: string, pin: string, body: BodyInit, type: string, keepalive = false): Promise<Result> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'x-job-kit-pin': pin, 'content-type': type }, body, keepalive, cache: 'no-store' });
  } catch {
    return { ok: false, why: 'network' };
  }
  return res.ok ? { ok: true } : why(res);
}

async function sendItem(start: Item, pin: string): Promise<Result> {
  const file = await getFile(start.id);
  if (!file) {
    // The phone let go of the file before it was sent (cleared storage). Mark it so the queue moves on.
    await putItem({ ...start, lost: true });
    changed();
    return { ok: true };
  }
  const parts = Math.max(1, Math.ceil(file.size / CHUNK));
  let item = start;
  for (let p = item.sentParts + 1; p <= parts; p++) {
    set({ state: 'sending', itemId: item.id, progress: (p - 1) / parts });
    const q = new URLSearchParams({ job: item.jobId, path: item.path, part: String(p), parts: String(parts) });
    const r = await post(`/api/job-kit/upload?${q}`, pin, file.slice((p - 1) * CHUNK, Math.min(file.size, p * CHUNK)), 'application/octet-stream');
    if (!r.ok) return r;
    const fresh = await getItem(item.id);
    if (!fresh) return { ok: true }; // deleted while it was being sent
    item = { ...fresh, parts, sentParts: p };
    await putItem(item);
  }
  await putItem({ ...item, sent: true });
  await delFile(item.id);
  changed();
  return { ok: true };
}

/* job.json and notes.txt for one job. */
export async function sendDetails(jobId: string, pin = readPin(), keepalive = false): Promise<Result> {
  const job = await getJob(jobId);
  if (!job) return { ok: true };
  const items = (await allItems()).filter((i) => i.jobId === jobId);
  const started = Date.now();
  const body = JSON.stringify({ job: jobJson(job, items, Boolean(job.readyAt)), notesTxt: notesTxt(job, items) });
  if (keepalive && body.length > 60_000) return { ok: false, why: 'error' };
  const r = await post('/api/job-kit/job', pin, body, 'application/json', keepalive);
  if (r.ok) {
    const now = await getJob(jobId);
    if (now) await putJob({ ...now, detailsSentAt: started });
    changed();
  }
  return r;
}

const needsDetails = (j: { updatedAt: number; detailsSentAt?: number }) => j.updatedAt > (j.detailsSentAt || 0);
/* Details wait until the typing has stopped for a bit (each send is a save in the inbox), unless Send was pressed. */
const QUIET = 15_000;
const due = (j: { updatedAt: number; detailsSentAt?: number; readyAt?: number }) =>
  Date.now() - j.updatedAt > QUIET || (j.readyAt || 0) > (j.detailsSentAt || 0);

async function loop() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    for (;;) {
      again = false;
      const pin = readPin();
      if (!pin) return set({ state: 'no-pin' });
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return set({ state: 'offline' });

      const waiting = (await allItems()).filter((i) => !i.sent && !i.lost).sort((a, b) => a.createdAt - b.createdAt);
      let r: Result = { ok: true };
      if (waiting.length) {
        r = await sendItem(waiting[0], pin);
        if (!r.ok && r.why === 'bad') {
          // The inbox refused this file outright: set it aside so the rest still go.
          await putItem({ ...waiting[0], lost: true });
          changed();
          continue;
        }
      } else {
        const pending = (await allJobs()).filter(needsDetails);
        const jobs = pending.filter(due);
        if (!jobs.length) {
          if (again) continue;
          if (pending.length) wake(QUIET);
          return set({ state: 'idle' });
        }
        for (const j of jobs) {
          r = await sendDetails(j.id, pin);
          if (!r.ok) break;
        }
      }
      if (r.ok) continue;

      // Something stopped it: say what, and try again later where that can help.
      if (r.why === 'network') {
        set({ state: 'offline' });
        wake(20_000);
      } else if (r.why === 'busy') {
        set({ state: 'busy' });
        wake((r.wait || 60) * 1000);
      } else if (r.why === 'not-set-up') {
        set({ state: 'not-set-up' });
        wake(300_000);
      } else if (r.why === 'inbox-key' || r.why === 'inbox-missing') {
        set({ state: r.why });
        wake(120_000);
      } else if (r.why === 'wrong-pin') {
        set({ state: 'wrong-pin' });
      } else {
        set({ state: 'error' });
        wake(30_000);
      }
      return;
    }
  } finally {
    running = false;
    if (again) wake(0);
  }
}

/* The app's "Check" button. */
export async function checkSetup(pin: string): Promise<SendState | 'ok'> {
  try {
    const res = await fetch('/api/job-kit/check', { method: 'POST', headers: { 'x-job-kit-pin': pin }, cache: 'no-store' });
    if (res.ok) return 'ok';
    const r = await why(res);
    return r.ok ? 'ok' : r.why === 'network' || r.why === 'bad' ? 'error' : r.why;
  } catch {
    return 'offline';
  }
}
