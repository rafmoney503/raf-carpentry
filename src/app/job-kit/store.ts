import type { Kind, SectionId } from './plan';
import { SECTIONS } from './plan';

/* The Job Kit keeps its jobs on the phone in IndexedDB ("raf-job-kit"): jobs and items (small, with a
   240 px thumbnail each) and, in their own store, the photo and clip files themselves. A file is
   deleted from the phone as soon as the inbox has it, so only what is still waiting takes up space. */

export type Size = { what: string; w: string; h: string; d: string };
export type Notes = {
  spots: string;
  sizes: Size[];
  materials: string;
  hardware: string;
  tools: string[];
  toolsOther: string;
  tricky: string;
  wanted: string;
  okToShow: string;
  review: string;
};
export type Job = {
  id: string;
  what: string;
  area: string;
  month: string; // YYYY-MM
  kinds: string[];
  notes: Notes;
  createdAt: number;
  updatedAt: number;
  seq: number; // last number given to a file
  detailsSentAt?: number; // job.json last reached the inbox
  readyAt?: number; // "Send to Claude" pressed
};
export type Item = {
  id: string;
  jobId: string;
  section: SectionId;
  slot: string;
  slotLabel: string;
  kind: Kind;
  path: string; // inside the job folder, e.g. finished/014-after-1.jpg
  mime: string;
  bytes: number;
  w?: number;
  h?: number;
  duration?: number;
  takenAt: number;
  caption: string;
  thumb?: string; // small JPEG data URL
  createdAt: number;
  parts: number;
  sentParts: number;
  sent: boolean;
  lost?: boolean; // the phone dropped the file before it was sent
};

export const emptyNotes = (): Notes => ({
  spots: '',
  sizes: [{ what: 'The space', w: '', h: '', d: '' }],
  materials: '',
  hardware: '',
  tools: [],
  toolsOther: '',
  tricky: '',
  wanted: '',
  okToShow: '',
  review: '',
});

/* ---------- IndexedDB, no library ---------- */

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open('raf-job-kit', 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('jobs', { keyPath: 'id' });
        d.createObjectStore('items', { keyPath: 'id' }).createIndex('job', 'jobId');
        d.createObjectStore('files');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        opening = null;
        reject(req.error);
      };
    });
  }
  return opening;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve((req ? req.result : undefined) as T);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const allJobs = () => run<Job[]>('jobs', 'readonly', (s) => s.getAll());
export const allItems = () => run<Item[]>('items', 'readonly', (s) => s.getAll());
export const putJob = (j: Job) => run<void>('jobs', 'readwrite', (s) => s.put(j));
export const putItem = (i: Item) => run<void>('items', 'readwrite', (s) => s.put(i));
export const getItem = (id: string) => run<Item | undefined>('items', 'readonly', (s) => s.get(id));
export const delItem = (id: string) => run<void>('items', 'readwrite', (s) => s.delete(id));
export const delJob = (id: string) => run<void>('jobs', 'readwrite', (s) => s.delete(id));
export const getFile = (id: string) => run<Blob | undefined>('files', 'readonly', (s) => s.get(id));
export const putFile = (id: string, b: Blob) => run<void>('files', 'readwrite', (s) => s.put(b, id));
export const delFile = (id: string) => run<void>('files', 'readwrite', (s) => s.delete(id));

export const getJob = (id: string) => run<Job | undefined>('jobs', 'readonly', (s) => s.get(id));

/* ---------- names ---------- */

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');

export function newJobId(month: string, what: string, area: string) {
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return [month, slug(what), slug(area), rand].filter(Boolean).join('-');
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function extFor(mime: string, kind: Kind) {
  if (kind === 'photo') return '.jpg';
  if (/quicktime/.test(mime)) return '.mov';
  if (/webm/.test(mime)) return '.webm';
  return '.mp4';
}

export const monthName = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export const mb = (bytes: number) => (bytes >= 1_000_000_000 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1_000_000 ? `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

/* ---------- what goes to the inbox ---------- */

const sizeLine = (s: Size) => {
  const dims = [s.w, s.h, s.d].map((v) => v.trim());
  if (!dims.some(Boolean)) return '';
  return `- ${s.what.trim() || 'Size'}: ${dims.map((v) => v || '?').join(' x ')}`;
};

/* notes.txt, in the same shape as the template in each job folder on the Mac. */
export function notesTxt(job: Job, items: Item[]) {
  const n = job.notes;
  const live = items.filter((i) => !i.lost);
  const photos = live.filter((i) => i.kind === 'photo').length;
  const clips = live.filter((i) => i.kind === 'video').length;
  const tools = [...n.tools, n.toolsOther.trim()].filter(Boolean).join(', ');
  const sizes = n.sizes.map(sizeLine).filter(Boolean);
  return [
    `Job: ${job.what}`,
    `Area: ${job.area}`,
    `Finished: ${monthName(job.month)}`,
    `Kind of job: ${job.kinds.join(', ')}`,
    '',
    `Before photo spots: ${n.spots}`,
    '',
    'Sizes (W x H x D in mm):',
    ...(sizes.length ? sizes : ['- ']),
    '',
    `Materials: ${n.materials}`,
    `Hardware: ${n.hardware}`,
    `Tools that did the work: ${tools}`,
    '',
    `What was tricky: ${n.tricky}`,
    `What the client wanted: ${n.wanted}`,
    '',
    `OK to show photos: ${n.okToShow}`,
    `Google review: ${n.review}`,
    '',
    `From the Job Kit app: ${photos} photo${photos === 1 ? '' : 's'}, ${clips} clip${clips === 1 ? '' : 's'}.`,
    '',
  ].join('\n');
}

/* job.json: everything above plus every photo and clip with its slot, in checklist order. */
export function jobJson(job: Job, items: Item[], ready: boolean) {
  const order = (i: Item) => {
    const si = SECTIONS.findIndex((s) => s.id === i.section);
    const sl = SECTIONS[si]?.slots.findIndex((x) => x.id === i.slot) ?? -1;
    return si * 1000 + (sl < 0 ? 900 : sl * 10);
  };
  const list = items
    .filter((i) => !i.lost)
    .sort((a, b) => order(a) - order(b) || a.takenAt - b.takenAt)
    .map((i) => ({
      path: i.path,
      section: i.section,
      slot: i.slot,
      slotLabel: i.slotLabel,
      kind: i.kind,
      caption: i.caption || undefined,
      bytes: i.bytes,
      w: i.w,
      h: i.h,
      duration: i.duration ? Math.round(i.duration * 10) / 10 : undefined,
      takenAt: new Date(i.takenAt).toISOString(),
      parts: i.parts,
      sent: i.sent,
    }));
  return {
    v: 1,
    app: 'job-kit',
    id: job.id,
    what: job.what,
    area: job.area,
    month: job.month,
    kinds: job.kinds,
    notes: job.notes,
    ready,
    readyAt: job.readyAt ? new Date(job.readyAt).toISOString() : null,
    updatedAt: new Date(job.updatedAt).toISOString(),
    items: list,
  };
}
