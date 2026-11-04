'use client';
/* eslint-disable @next/next/no-img-element -- the pictures here are the notebooks' first pages, fetched behind the PIN as blobs */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { attachName, cleanPages, looseNotebooks, notebooksFor, pagesElsewhere, pagesSlug, pagesWords, sizeWords, type Notebook } from '@/lib/goodnotes-match';
import type { CurrentJob } from '@/lib/servicem8';
import type { Marks } from './current';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { SecIcon } from './job-menu';
import { label } from './parts';

/* Goodnotes on the job card (26 Oct 2026, Raf: 'is there a way to connect goodnotes with jobkit so my notes go straight
   to client card', then 'go'). Goodnotes' Auto Backup puts each notebook in Raf's Dropbox as a PDF (OneDrive until
   4 Nov 2026, when info@'s Microsoft plan turned out to have none; connected once with Connect Dropbox); the job card
   shows the ones for this job (named with its number first, or linked here by hand) with the first page, opens the
   pages here (pdf.js, loaded only then), and puts the PDF on the ServiceM8 job with one tap. Server side:
   src/lib/goodnotes.ts and /api/job-kit/goodnotes; the matching: src/lib/goodnotes-match.ts.
   Pages of a notebook on a job (4 Nov 2026, Raf keeps one notebook for the year with a job on each page: 'yes we have
   to do page linking for job'): Link pages from a notebook opens its pages (opening at the last page, where a new
   job goes), the ones tapped are kept in the job's marks (gnPages: notebook path -> page numbers, in step with the
   computer), and the job card shows, opens and sends only those pages. */

const ROUTE = '/api/job-kit/goodnotes';
const KEY = 'raf_jobkit_goodnotes';
const THUMBS = 'raf-jobkit-thumbs-v1';
const FRESH = 90_000;

type Kept = { at: number; notebooks: Notebook[]; error?: string; detail?: string; account?: string };
type State = Kept & { busy: boolean; note?: string };

/* ---------- the list of notebooks, shared by every job card ---------- */

let state: State = { at: 0, notebooks: [], busy: false };
let loaded = false;
const subs = new Set<() => void>();
function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const k = JSON.parse(localStorage.getItem(KEY) || 'null') as Kept | null;
    if (k && Array.isArray(k.notebooks)) state = { ...k, busy: false };
  } catch {
    /* nothing kept */
  }
}
function set(s: Partial<State>) {
  state = { ...state, ...s };
  if (!s.busy) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: state.at, notebooks: state.notebooks, error: state.error, detail: state.detail, account: state.account }));
    } catch {
      /* kept for this visit */
    }
  }
  subs.forEach((f) => f());
}
const useNotebooks = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => {
      load();
      return state;
    },
    () => state,
  );

async function check(fresh = false) {
  load();
  if (state.busy) return;
  if (!fresh && state.at && Date.now() - state.at < FRESH && !state.error) return;
  set({ busy: true });
  const r = await post<{ notebooks: Notebook[]; at: number; account?: string }>(readPin(), { action: 'list', fresh }, ROUTE);
  if (r.ok) set({ busy: false, at: r.data.at, notebooks: r.data.notebooks, error: undefined, detail: undefined, account: r.data.account || state.account });
  else set({ busy: false, error: r.error, detail: r.detail, ...(['gn-not-connected', 'gn-expired'].includes(r.error) ? { notebooks: [], at: 0 } : {}) });
}

/* Back from Dropbox's 'allow' page (job-kit-app.tsx reads ?dropbox= and takes it off the address): a line to show in
   the Goodnotes box, and the notebooks checked again. */
export function dropboxBack(result: string) {
  load();
  const note =
    result === 'ok'
      ? `Dropbox connected: your Goodnotes backup shows here now.${readPin() ? '' : ' If this opened in a browser window, close it and go back to the Job Kit app: it’s connected there too.'}`
      : result === 'cancelled'
        ? 'Dropbox wasn’t connected (cancelled). Tap Connect Dropbox to try again.'
        : result === 'expired'
          ? 'That took too long or Dropbox turned it down. Tap Connect Dropbox again.'
          : gnProblem(result);
  set({ note });
  void check(true);
}

async function connectDropbox(again: boolean): Promise<string> {
  const r = await post<{ url: string }>(readPin(), { action: 'connect', again }, ROUTE);
  if (!r.ok) return gnProblem(r.error, r.detail);
  window.location.assign(r.data.url);
  return '';
}

function gnProblem(error?: string, detail?: string): string {
  switch (error) {
    case undefined:
      return '';
    case 'gn-not-connected':
      return 'Connect your Dropbox once, so the Job Kit can read Goodnotes’ backup of your notebooks. Easiest on the computer: the phone uses the same connection.';
    case 'gn-expired':
      return 'Dropbox wants you to connect again (the connection was removed or ran out).';
    case 'gn-scope':
      return 'The Dropbox app isn’t allowed to read files yet. In dropbox.com/developers/apps: Raf Job Kit, Permissions, tick files.metadata.read and files.content.read, Submit, then Connect Dropbox again.';
    case 'gn-store':
      return 'The Job Kit couldn’t reach its own store to read the Dropbox connection. Try again in a minute.';
    case 'gn-no-folder':
      return 'No Goodnotes backup in your Dropbox yet. On the iPad: Goodnotes, Settings, Cloud & Backup, Auto Backup, Storage Provider Dropbox, format PDF. The first backup can take a while. (If it is there, check the Dropbox app has Full Dropbox access, not App folder.)';
    case 'gn-no-work':
      return 'Goodnotes is backing up to Dropbox, but there’s no Clients folder in it yet. In Goodnotes make a folder called Clients and move your work notebooks into it: only those show here.';
    case 'gn-not-set-up':
      return `Dropbox isn’t set up yet: ${detail || 'DROPBOX_APP_KEY and DROPBOX_APP_SECRET'} missing in Vercel.`;
    case 'gn-gone':
      return 'That notebook isn’t in Dropbox any more (renamed, moved or deleted in Goodnotes). Refresh.';
    case 'gn-too-big': {
      const [size, max] = (detail ?? '').split('|').map(Number);
      const mb = (n: number) => `${Math.round(n / 1048576)} MB`;
      if (!size || !max) return 'Too big to send from here. Add it to the job in ServiceM8 itself.';
      return max > 100 * 1048576
        ? `This notebook is ${mb(size)}, more than the ${mb(max)} the Job Kit can pick pages out of. Start a new notebook in Goodnotes for the rest of the year, and link the pages from there.`
        : `This notebook is ${mb(size)}, more than the ${mb(max)} the Job Kit can send. Add it to the job in ServiceM8 itself.`;
    }
    case 'gn-too-big-here':
      return 'This notebook is over 4 MB and Dropbox’s link didn’t open here. Open it in Goodnotes or Dropbox.';
    case 'gn-pages-gone': {
      const [count, missing] = (detail ?? '').split('|');
      const ps = cleanPages((missing ?? '').split(','));
      return `The notebook has ${count || 'fewer'} page${count === '1' ? '' : 's'} now, so ${pagesWords(ps) === 'no pages' ? 'those pages aren’t' : `${pagesWords(ps)} ${ps.length === 1 ? 'isn’t' : 'aren’t'}`} there any more. Change pages.`;
    }
    case 'gn-bad-pdf':
      return 'That PDF couldn’t be read to pick its pages out. Open it in Goodnotes.';
    case 'gn-bad-pdf-here':
      return 'This PDF couldn’t be opened here.';
    case 'closed':
      return '';
    case 'gn-busy':
      return 'Dropbox didn’t answer. Try again in a minute.';
    case 'gn-error':
      return `Dropbox sent back an error${detail ? `: ${detail}` : '.'}`;
    case 'offline':
      return 'No signal: showing what was here last.';
    default:
      return problemText(error, detail);
  }
}

const ago = (iso: string) => {
  const t = Date.parse(iso);
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 36 * 60) return `${Math.round(m / 60)} h ago`;
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};

/* ---------- first page pictures ---------- */

const thumbUrls = new Map<string, string>();
const noThumb = new Set<string>();
const thumbKey = (n: Notebook) => `/__jk-gn/${encodeURIComponent(n.id)}?at=${encodeURIComponent(n.at)}`;

function Cover({ nb, onOpen }: { nb: Notebook; onOpen: () => void }) {
  const key = thumbKey(nb);
  const [url, setUrl] = useState(() => thumbUrls.get(key) ?? '');
  const [none, setNone] = useState(() => noThumb.has(key));
  useEffect(() => {
    if (url || none) return;
    let gone = false;
    void (async () => {
      let blob: Blob | null = null;
      try {
        const hit = await (await caches.open(THUMBS)).match(key);
        if (hit) blob = await hit.blob();
      } catch {
        /* no cache */
      }
      if (!blob) {
        const pin = readPin();
        try {
          const res = await fetch(ROUTE, { method: 'POST', headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'thumb', id: nb.id }), cache: 'no-store' });
          if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) {
            noThumb.add(key);
            if (!gone) setNone(true);
            return;
          }
          blob = await res.blob();
          try {
            await (await caches.open(THUMBS)).put(key, new Response(blob, { headers: { 'content-type': blob.type || 'image/jpeg' } }));
          } catch {
            /* fetched again next time */
          }
        } catch {
          if (!gone) setNone(true);
          return;
        }
      }
      const u = URL.createObjectURL(blob);
      thumbUrls.set(key, u);
      if (!gone) setUrl(u);
    })();
    return () => {
      gone = true;
    };
  }, [key, nb.id, url, none]);
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${nb.name}`} className="relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-sm border border-line-strong bg-paper" data-gn-cover>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current text-faint" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z" />
            <path d="M14 3.5V8h4.5M9 12.5h6M9 15.5h6M9 18h4" />
          </svg>
        </span>
      )}
    </button>
  );
}

/* ---------- the pages, drawn here with pdf.js ---------- */

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };
type PdfTask = { promise: Promise<PdfDoc>; destroy: () => Promise<void>; onProgress?: (p: { loaded: number; total: number }) => void }; // pdf.js 6: destroy is on the loading task
type PdfSource = { data: ArrayBuffer } | { url: string; disableAutoFetch: boolean; disableStream: boolean; rangeChunkSize: number };
type PdfLib = { getDocument: (o: PdfSource) => PdfTask };
type PdfPage = { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvas: HTMLCanvasElement; viewport: unknown }) => { promise: Promise<void> } };

let pdfjs: Promise<PdfLib> | null = null;
function loadPdfjs() {
  if (!pdfjs) {
    // the legacy build: the modern one needs JavaScript newer than an iPhone's Safari has (Map.getOrInsertComputed)
    pdfjs = import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => {
      m.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
      return m as unknown as PdfLib;
    });
    pdfjs.catch(() => {
      pdfjs = null;
    });
  }
  return pdfjs;
}

/* A document closing and the next one opening share pdf.js's worker: wait for the close to finish first, or a notebook
   already on this phone (opened straight away, no download) can catch the worker half shut ('couldn't be opened'). */
let closing: Promise<unknown> = Promise.resolve();
const closeTask = (t: PdfTask | null) => {
  if (t) closing = Promise.all([closing, t.destroy().catch(() => {})]);
};
async function openTask(lib: PdfLib, src: ArrayBuffer | string): Promise<PdfTask> {
  await closing;
  // a link: pdf.js asks Dropbox for just the parts of the file it needs (Range), so a year notebook of a few hundred MB
  // shows its pages without the phone downloading all of it
  return lib.getDocument(typeof src === 'string' ? { url: src, disableAutoFetch: true, disableStream: true, rangeChunkSize: 512 * 1024 } : { data: src });
}

/* A notebook opened in pdf.js: straight from Dropbox's link, fetching only what's drawn; if that doesn't work here,
   the job's pages picked out on the server (when `pick` is given), else the whole file (from Dropbox, else through the
   website up to 4 MB). `progress` hears about a whole download. `picked`: the PDF is just those pages, 1..n. */
type Opened = { task: PdfTask; doc: PdfDoc; picked?: boolean } | { error: string; detail?: string };
async function openNotebook(nb: Notebook, o: { progress?: (loaded: number, total: number) => void; gone?: () => boolean; pick?: number[] } = {}): Promise<Opened> {
  const lib = await loadPdfjs();
  const r = await post<{ url: string; size: number }>(readPin(), { action: 'open', id: nb.id }, ROUTE);
  if (!r.ok && r.error !== 'offline') return { error: r.error, detail: r.detail };
  const open = async (src: ArrayBuffer | string, picked = false): Promise<Opened | null> => {
    let task: PdfTask | null = null;
    try {
      task = await openTask(lib, src);
      // pdf.js downloading it all itself (a link that can't be read in parts): how far it's got
      if (typeof src === 'string' && o.progress) task.onProgress = ({ loaded, total }) => total && o.progress?.(loaded, total);
      const doc = await task.promise;
      return { task, doc, picked };
    } catch {
      closeTask(task);
      return null;
    }
  };
  if (r.ok && !o.gone?.()) {
    const got = await open(r.data.url); // no Range or no CORS from here: on to the next way
    if (got) return got;
  }
  if (o.gone?.()) return { error: 'closed' };
  if (o.pick?.length) {
    const bytes = await fetchPages(nb, o.pick);
    if (bytes instanceof ArrayBuffer) return (await open(bytes, true)) ?? { error: 'gn-bad-pdf-here' };
    if (bytes && bytes.error !== 'offline') return bytes;
  }
  if (o.gone?.()) return { error: 'closed' };
  const bytes = await fetchPdf(nb, o.progress, r.ok ? r.data.url : undefined);
  if (!(bytes instanceof ArrayBuffer)) return bytes;
  return (await open(bytes)) ?? { error: 'gn-bad-pdf-here' };
}

const mbWords = (n: number) => (n >= 10 * 1048576 ? `${Math.round(n / 1048576)}` : (n / 1048576).toFixed(1));
// only once it's clearly a big download (opening in parts fetches a little first, not worth a count)
const progressWords = (p: [number, number] | null) => (p && p[1] && p[0] >= 2 * 1048576 ? ` ${mbWords(p[0])} of ${mbWords(p[1])} MB` : '');

const pdfBytes = new Map<string, ArrayBuffer>(); // this visit's whole notebooks, by id and version

/* The whole notebook, counting as it comes so a big one shows how far it's got. */
async function readAll(res: Response, progress?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const total = Number(res.headers.get('content-length') || 0);
  if (!progress || !res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let at = 0;
  let last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    at += value.length;
    if (total && at - last > 1048576) {
      last = at;
      progress(at, total);
    }
  }
  const out = new Uint8Array(at);
  let k = 0;
  for (const p of parts.splice(0)) {
    out.set(p, k);
    k += p.length;
  }
  return out.buffer;
}

async function fetchPdf(nb: Notebook, progress?: (loaded: number, total: number) => void, link?: string): Promise<ArrayBuffer | { error: string; detail?: string }> {
  const key = `${nb.id}|${nb.at}`;
  const had = pdfBytes.get(key);
  if (had) return had.slice(0);
  let url = link;
  if (!url) {
    const r = await post<{ url: string; size: number }>(readPin(), { action: 'open', id: nb.id }, ROUTE);
    if (!r.ok) return { error: r.error, detail: r.detail };
    url = r.data.url;
  }
  let buf: ArrayBuffer | null = null;
  try {
    // straight from Dropbox (its 4-hour link), so a big notebook doesn't pass through the website
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) buf = await readAll(res, progress);
    else if (res.status === 404) return { error: 'gn-gone' };
  } catch {
    if (navigator.onLine === false) return { error: 'offline' };
  }
  if (!buf) {
    // the link didn't work from here: through the website instead (up to 4 MB)
    try {
      const res = await fetch(ROUTE, { method: 'POST', headers: { 'x-job-kit-pin': readPin(), 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pdf', id: nb.id }), cache: 'no-store' });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        return { error: e.error === 'gn-too-big' ? 'gn-too-big-here' : e.error || 'gn-busy' };
      }
      buf = await res.arrayBuffer();
    } catch {
      return { error: 'gn-busy' };
    }
  }
  pdfBytes.set(key, buf);
  return buf.slice(0);
}

function PageCanvas({ doc, n, width, label, onDrawn }: { doc: PdfDoc; n: number; width: number; label?: number; onDrawn?: (c: HTMLCanvasElement) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.414);
  const [drawn, setDrawn] = useState(false);
  const drawnFn = useRef(onDrawn);
  useEffect(() => {
    drawnFn.current = onDrawn;
  });
  useEffect(() => {
    let gone = false;
    void doc
      .getPage(n)
      .then((p) => {
        const v = p.getViewport({ scale: 1 });
        if (!gone) setRatio(v.height / v.width);
      })
      .catch(() => {}); // the notebook was closed meanwhile
    return () => {
      gone = true;
    };
  }, [doc, n]);
  useEffect(() => {
    const el = box.current;
    if (!el || drawn || !width) return;
    let gone = false;
    const seen = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        void (async () => {
          try {
            const p = await doc.getPage(n);
            const base = p.getViewport({ scale: 1 });
            const scale = (width / base.width) * Math.min(2, window.devicePixelRatio || 1);
            const vp = p.getViewport({ scale });
            const c = document.createElement('canvas');
            c.width = Math.round(vp.width);
            c.height = Math.round(vp.height);
            c.className = 'block h-auto w-full';
            await p.render({ canvas: c, viewport: vp }).promise;
            if (gone || !box.current) return;
            box.current.replaceChildren(c);
            setDrawn(true);
            drawnFn.current?.(c);
          } catch {
            /* closed or switched while drawing: nothing to show */
          }
        })();
      },
      { rootMargin: '600px' },
    );
    seen.observe(el);
    return () => {
      gone = true;
      seen.disconnect();
    };
  }, [doc, n, width, drawn]);
  const shown = label ?? n;
  return (
    <div className="relative bg-mount shadow-[0_6px_18px_-8px_rgb(0_0_0/0.6)]" style={{ aspectRatio: `1 / ${ratio}` }} data-gn-page={shown}>
      <div ref={box} />
      {!drawn ? <span className="absolute inset-0 grid place-items-center font-mono text-[12px] text-faint">Page {shown}</span> : null}
      {label !== undefined && drawn ? <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-ink/75 px-1.5 py-0.5 font-mono text-[11px] text-on-accent">p. {label}</span> : null}
    </div>
  );
}

/* Pages picked out on the server, so a job's pages open without the phone downloading the whole notebook (up to
   4 MB); undefined if that didn't work, and the whole notebook is fetched instead. */
async function fetchPages(nb: Notebook, pages: number[]): Promise<ArrayBuffer | { error: string; detail?: string } | undefined> {
  try {
    const res = await fetch(ROUTE, { method: 'POST', headers: { 'x-job-kit-pin': readPin(), 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pages', id: nb.id, pages }), cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') || '').includes('pdf')) return await res.arrayBuffer();
    const e = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    if (e.error === 'gn-pages-gone' || e.error === 'gn-gone' || e.error === 'wrong-pin') return { error: e.error, detail: e.detail };
  } catch {
    if (navigator.onLine === false) return { error: 'offline' };
  }
  return undefined;
}

const canvasBlob = (c: HTMLCanvasElement, q = 0.72) => new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q));
async function smallBlob(c: HTMLCanvasElement, w = 240): Promise<Blob | null> {
  const k = Math.min(1, w / c.width);
  const s = document.createElement('canvas');
  s.width = Math.max(1, Math.round(c.width * k));
  s.height = Math.max(1, Math.round(c.height * k));
  s.getContext('2d')?.drawImage(c, 0, 0, s.width, s.height);
  const b = await canvasBlob(s);
  s.width = 0;
  s.height = 0;
  return b;
}

/* ---------- pictures of linked pages for the job card: made here when the pages are drawn, kept on the device ---------- */

const coverKey = (path: string, page: number) => `/__jk-gnp/${encodeURIComponent(path)}/${page}`;
const coverUrls = new Map<string, string>();
const coverSubs = new Set<() => void>();
let coverRev = 0;
const bumpCovers = () => {
  coverRev++;
  coverSubs.forEach((f) => f());
};
async function keepCover(path: string, page: number, blob: Blob | null) {
  if (!blob) return;
  const key = coverKey(path, page);
  try {
    await (await caches.open(THUMBS)).put(key, new Response(blob, { headers: { 'content-type': blob.type || 'image/jpeg' } }));
  } catch {
    /* shown this visit only */
  }
  coverUrls.set(key, URL.createObjectURL(blob));
  bumpCovers();
}

function PageCover({ path, page, onOpen, name }: { path: string; page: number; onOpen: () => void; name: string }) {
  useSyncExternalStore(
    (f) => {
      coverSubs.add(f);
      return () => void coverSubs.delete(f);
    },
    () => coverRev,
    () => 0,
  );
  const key = coverKey(path, page);
  const url = coverUrls.get(key) ?? '';
  useEffect(() => {
    if (coverUrls.has(key)) return;
    let gone = false;
    void (async () => {
      try {
        const hit = await (await caches.open(THUMBS)).match(key);
        if (!hit || gone) return;
        coverUrls.set(key, URL.createObjectURL(await hit.blob()));
        bumpCovers();
      } catch {
        /* no picture yet: it's made the first time the page is drawn here */
      }
    })();
    return () => {
      gone = true;
    };
  }, [key]);
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${name}, page ${page}`} className="relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-sm border border-line-strong bg-paper" data-gn-cover>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current text-faint" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M6.5 3.5h11v17h-11z" />
            <path d="M9 8h6M9 11h6M9 14h4" />
          </svg>
        </span>
      )}
      <span className="absolute bottom-1 left-1 rounded-sm bg-ink/75 px-1 font-mono text-[10.5px] text-on-accent">p. {page}</span>
    </button>
  );
}

function Viewer({ nb, pages, onClose, onCover }: { nb: Notebook; pages?: number[]; onClose: () => void; onCover?: (page: number, c: HTMLCanvasElement) => void }) {
  const only = pages?.length ? pages : undefined;
  const [whole, setWhole] = useState(!only);
  // the PDF on screen, and the notebook page each of its pages is
  const [shown, setShown] = useState<{ doc: PdfDoc; labels: number[]; total?: number } | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const pagesKey = only ? only.join(',') : '';
  const [progress, setProgress] = useState<[number, number] | null>(null);
  useEffect(() => {
    let gone = false;
    let task: PdfTask | null = null;
    const end = () => closeTask(task);
    void (async () => {
      const want = !whole && pagesKey ? pagesKey.split(',').map(Number) : null;
      const r = await openNotebook(nb, { progress: (l, t) => !gone && setProgress([l, t]), gone: () => gone, pick: want ?? undefined });
      if ('task' in r) task = r.task;
      if (gone) return end();
      if (!('task' in r)) return setError(gnProblem(r.error, r.detail));
      const opened = r.doc;
      if (want && !r.picked) {
        // the whole notebook: show only the job's pages that are in it
        const there = want.filter((p) => p <= opened.numPages);
        setMissing(want.filter((p) => p > opened.numPages));
        setShown({ doc: opened, labels: there, total: opened.numPages });
      } else if (want) setShown({ doc: opened, labels: want });
      else setShown({ doc: opened, labels: Array.from({ length: opened.numPages }, (_, i) => i + 1), total: opened.numPages });
    })();
    return () => {
      gone = true;
      end();
    };
  }, [nb, whole, pagesKey]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = () => setWidth(Math.min(el.clientWidth - 24, 900));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  useEffect(() => {
    area.current?.scrollTo({ top: 0 });
  }, [whole]);
  const n = shown?.labels.length ?? 0;
  const sub = only && !whole ? pagesWords(only) : shown?.total ? `${shown.total} page${shown.total === 1 ? '' : 's'}` : '';
  return (
    <div role="dialog" aria-modal="true" aria-label={nb.name} className="fixed inset-0 z-50 flex flex-col bg-ink" data-gn-viewer data-gn-only={only && !whole ? only.join(',') : undefined}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] text-on-accent">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{nb.name}</span>
          <span className="block truncate font-mono text-[11.5px] text-on-accent/70">
            {sub ? `${sub} · ` : ''}changed {ago(nb.at)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {only ? (
            <button
              type="button"
              onClick={() => {
                setShown(null);
                setError('');
                setMissing([]);
                setProgress(null);
                setWhole((w) => !w);
              }}
              className="h-11 px-2 text-[13.5px] text-on-accent/85 underline"
              data-gn-whole-toggle
            >
              {whole ? 'Just this job' : 'Whole notebook'}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="h-11 px-2 text-[15px] font-semibold">
            Close
          </button>
        </span>
      </div>
      <div ref={area} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {error ? (
          <p className="mx-auto mt-16 max-w-sm px-3 text-center text-[15px] leading-relaxed text-on-accent" data-gn-viewer-problem>
            {error}
          </p>
        ) : !shown || !width ? (
          <p className="mt-16 text-center font-mono text-[13px] text-on-accent/70" data-gn-opening>
            Opening…{progressWords(progress)}
          </p>
        ) : (
          <div className="mx-auto grid gap-3 pt-1" style={{ width }}>
            {missing.length ? (
              <p className="rounded-sm border border-on-accent/30 px-3 py-2 text-[14px] leading-snug text-on-accent" data-gn-viewer-problem>
                The notebook has {shown.total} pages now, so {pagesWords(missing)} {missing.length === 1 ? 'isn’t' : 'aren’t'} there any more. Change pages on the job.
              </p>
            ) : null}
            {Array.from({ length: n }, (_, i) => {
              const label = shown.labels[i];
              // drawn from the picked-out PDF its pages are 1..n; from the whole notebook, the notebook's own numbers
              const page = shown.total ? label : i + 1;
              return (
                <PageCanvas
                  key={`${whole}-${i}`}
                  doc={shown.doc}
                  n={page}
                  width={width}
                  label={only ? label : undefined}
                  onDrawn={only && label === only[0] && onCover ? (c) => onCover(label, c) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- picking a job's pages out of a notebook ---------- */

const pickThumbs = new Map<string, string>(); // this visit's page pictures, by notebook version, page and width

function PickThumb({ doc, nb, n, width, ratio, picked, tag, onToggle }: { doc: PdfDoc; nb: Notebook; n: number; width: number; ratio: number; picked: boolean; tag: string; onToggle: () => void }) {
  const key = `${nb.id}|${nb.at}|${n}|${Math.round(width)}`;
  const [got, setGot] = useState<{ key: string; url: string } | null>(null);
  const url = pickThumbs.get(key) ?? (got?.key === key ? got.url : '');
  const el = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pickThumbs.has(key)) return;
    const b = el.current;
    if (!b || !width) return;
    let gone = false;
    const seen = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        void (async () => {
          try {
            const p = await doc.getPage(n);
            const base = p.getViewport({ scale: 1 });
            const vp = p.getViewport({ scale: (width / base.width) * Math.min(2, window.devicePixelRatio || 1) });
            const c = document.createElement('canvas');
            c.width = Math.round(vp.width);
            c.height = Math.round(vp.height);
            await p.render({ canvas: c, viewport: vp }).promise;
            // kept as a JPEG and the canvas let go, so a notebook of hundreds of pages doesn't fill an iPhone's memory
            const blob = await canvasBlob(c);
            c.width = 0;
            c.height = 0;
            if (!blob) return;
            const u = URL.createObjectURL(blob);
            pickThumbs.set(key, u);
            if (!gone) setGot({ key, url: u });
          } catch {
            /* stays as its number */
          }
        })();
      },
      { rootMargin: '900px' },
    );
    seen.observe(b);
    return () => {
      gone = true;
      seen.disconnect();
    };
  }, [doc, n, width, key]);
  return (
    <button ref={el} type="button" aria-pressed={picked} onClick={onToggle} className="group block w-full text-left" data-gn-pick-page={n}>
      <span
        className={`relative block overflow-hidden bg-mount ${picked ? 'outline outline-[3px] outline-offset-0 outline-accent' : 'outline outline-1 outline-on-accent/20'}`}
        style={{ aspectRatio: `1 / ${ratio}` }}
      >
        {url ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-top" /> : <span className="absolute inset-0 grid place-items-center font-mono text-[12px] text-faint">Page {n}</span>}
        {picked ? (
          <span aria-hidden className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-accent text-[15px] font-bold text-on-accent shadow">
            ✓
          </span>
        ) : null}
      </span>
      <span className={`mt-1 flex min-w-0 items-baseline gap-1.5 font-mono text-[12px] ${picked ? 'font-semibold text-on-accent' : 'text-on-accent/75'}`}>
        <span>{n}</span>
        {tag ? <span className="min-w-0 truncate text-[11px] font-normal text-on-accent/60" data-gn-tag>{tag}</span> : null}
      </span>
    </button>
  );
}

const SIZES = [
  { word: 'Small', w: 100 },
  { word: 'Medium', w: 160 },
  { word: 'Big', w: 420 },
];

function PagePicker({
  nb,
  initial,
  elsewhere,
  jobTitle,
  canWhole,
  onLink,
  onWhole,
  onClose,
}: {
  nb: Notebook;
  initial: number[];
  elsewhere: Map<number, string[]>; // page -> the other jobs it's linked to (their #number and name)
  jobTitle: string;
  canWhole: boolean;
  onLink: (pages: number[], cover: Blob | null) => void;
  onWhole: () => void;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<{ d: PdfDoc; ratio: number } | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<number[]>(initial);
  const [size, setSize] = useState(1);
  const [width, setWidth] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  useEffect(() => {
    let gone = false;
    let task: PdfTask | null = null;
    const end = () => closeTask(task);
    void (async () => {
      const r = await openNotebook(nb, { progress: (l, t) => !gone && setProgress([l, t]), gone: () => gone });
      if ('task' in r) task = r.task;
      if (gone) return end();
      if (!('task' in r)) return setError(gnProblem(r.error, r.detail));
      try {
        const v = (await r.doc.getPage(1)).getViewport({ scale: 1 });
        if (!gone) setDoc({ d: r.doc, ratio: v.height / v.width });
      } catch {
        if (!gone) setError('This PDF couldn’t be opened here.');
      }
    })();
    return () => {
      gone = true;
      end();
    };
  }, [nb]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = () => setWidth(Math.min(el.clientWidth - 24, 960));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  const gap = 12;
  const cols = width ? Math.max(1, Math.floor((width + gap) / (SIZES[size].w + gap))) : 1;
  const tw = width ? (width - gap * (cols - 1)) / cols : 0;
  // opens on the job's pages when it has some, else at the end, where a new job's page goes
  useLayoutEffect(() => {
    if (!doc || !tw || placed.current) return;
    const el = area.current;
    if (!el) return;
    placed.current = true;
    const first = initial[0];
    const target = first ? el.querySelector<HTMLElement>(`[data-gn-pick-page="${first}"]`) : null;
    if (target) el.scrollTop = Math.max(0, target.offsetTop - 12);
    else el.scrollTop = el.scrollHeight;
  }, [doc, tw, initial]);
  // a new size keeps the page at the top of the screen where it was
  const resize = (next: number) => {
    const el = area.current;
    let keep = 0;
    if (el) {
      const top = el.scrollTop;
      const ps = [...el.querySelectorAll<HTMLElement>('[data-gn-pick-page]')];
      keep = Number(ps.find((p) => p.offsetTop + p.offsetHeight > top)?.dataset.gnPickPage ?? 0);
    }
    setSize(next);
    requestAnimationFrame(() => {
      const t = keep && area.current?.querySelector<HTMLElement>(`[data-gn-pick-page="${keep}"]`);
      if (t && area.current) area.current.scrollTop = Math.max(0, t.offsetTop - 12);
    });
  };
  const toggle = (n: number) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : cleanPages([...p, n])));
  const changed = picked.join(',') !== cleanPages(initial).join(',');
  const link = async () => {
    const first = picked[0];
    const u = pickThumbs.get(`${nb.id}|${nb.at}|${first}|${Math.round(tw)}`) ?? [...pickThumbs.entries()].find(([k]) => k.startsWith(`${nb.id}|${nb.at}|${first}|`))?.[1];
    let blob: Blob | null = null;
    if (u) {
      try {
        blob = await (await fetch(u)).blob();
      } catch {
        /* the card shows the page number instead */
      }
    }
    onLink(picked, blob);
  };
  const total = doc?.d.numPages ?? 0;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Pages of ${nb.name}`} className="fixed inset-0 z-50 flex flex-col bg-ink text-on-accent" data-gn-picker>
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)]">
        <span className="min-w-0">
          <span className="block truncate text-[15.5px] font-semibold">{nb.name}</span>
          <span className="block font-mono text-[11.5px] leading-snug text-on-accent/70">
            {total ? `${total} page${total === 1 ? '' : 's'} · ` : ''}tap the pages for {jobTitle}
          </span>
        </span>
        <button type="button" onClick={onClose} className="h-10 shrink-0 px-1 text-[15px] font-semibold">
          Close
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1 px-4 pb-2" role="group" aria-label="Page size">
        {SIZES.map((z, i) => (
          <button
            key={z.word}
            type="button"
            aria-pressed={size === i}
            onClick={() => resize(i)}
            className={`h-8 rounded-sm px-2.5 font-mono text-[12px] ${size === i ? 'bg-on-accent text-ink' : 'text-on-accent/75 underline'}`}
            data-gn-size={z.word}
          >
            {z.word}
          </button>
        ))}
        {total > 6 ? (
          <span className="ml-auto flex gap-3 font-mono text-[12px]">
            <button type="button" className="h-8 text-on-accent/75 underline" onClick={() => area.current?.scrollTo({ top: 0 })}>
              First page
            </button>
            <button type="button" className="h-8 text-on-accent/75 underline" onClick={() => area.current?.scrollTo({ top: area.current.scrollHeight })}>
              Last page
            </button>
          </span>
        ) : null}
      </div>
      <div ref={area} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {error ? (
          <p className="mx-auto mt-16 max-w-sm px-3 text-center text-[15px] leading-relaxed">{error}</p>
        ) : !doc || !tw ? (
          <p className="mt-16 text-center font-mono text-[13px] text-on-accent/70" data-gn-opening>
            Opening the notebook…{progressWords(progress)}
          </p>
        ) : (
          <div className="mx-auto grid pt-1" style={{ width, gap, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} data-gn-grid>
            {Array.from({ length: total }, (_, i) => {
              const n = i + 1;
              const others = elsewhere.get(n);
              return <PickThumb key={n} doc={doc.d} nb={nb} n={n} width={tw} ratio={doc.ratio} picked={picked.includes(n)} tag={others?.length ? `on ${others.join(', ')}` : ''} onToggle={() => toggle(n)} />;
            })}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-on-accent/15 bg-ink px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3" data-gn-pick-bar>
        <p className="text-[14px] leading-snug" data-gn-picked>
          {picked.length ? (
            <>
              <span className="font-semibold">{pagesWords(picked).replace(/^p/, 'P')}</span> for {jobTitle}
            </>
          ) : (
            <span className="text-on-accent/75">Tap the pages for this job.</span>
          )}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            disabled={!picked.length || (!changed && initial.length > 0)}
            onClick={() => void link()}
            className="h-11 rounded-sm bg-accent px-4 text-[15px] font-semibold text-on-accent disabled:opacity-40"
            data-gn-link-pages
          >
            {initial.length ? 'Save pages' : picked.length > 1 ? `Link ${picked.length} pages` : 'Link this page'}
          </button>
          {picked.length ? (
            <button type="button" onClick={() => setPicked([])} className="h-11 text-[14px] text-on-accent/75 underline">
              Clear
            </button>
          ) : null}
          {canWhole ? (
            <button type="button" onClick={onWhole} className="h-11 text-[14px] text-on-accent/75 underline" data-gn-whole>
              Link the whole notebook instead
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- the box on the job card ---------- */

export function GoodnotesBox({ job, marks, onMark, jobLabel }: { job: CurrentJob; marks: Marks; onMark: (patch: Marks[string]) => void; jobLabel?: (uuid: string) => string }) {
  const s = useNotebooks();
  const mine = marks[job.uuid] ?? {};
  const linked = mine.gn ?? [];
  const sent = mine.gnSent ?? {};
  const pageLinks = mine.gnPages ?? {};
  const [open, setOpen] = useState<{ nb: Notebook; pages?: number[] } | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [choosing, setChoosing] = useState(false);
  const [allChoices, setAllChoices] = useState(false);
  const [picker, setPicker] = useState<Notebook | null>(null);
  const [confirmOff, setConfirmOff] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectProblem, setConnectProblem] = useState('');

  useEffect(() => {
    void check();
  }, [job.uuid]);
  useEffect(() => {
    if (!confirmOff) return;
    const t = setTimeout(() => setConfirmOff(''), 5000);
    return () => clearTimeout(t);
  }, [confirmOff]);

  const title = `#${job.number} ${job.name}`.trim();
  const books = notebooksFor(s.notebooks, job.number, linked).filter((n) => !pageLinks[n.path]);
  const linkedAnywhere = Object.values(marks).flatMap((m) => m?.gn ?? []);
  const loose = looseNotebooks(
    s.notebooks.filter((n) => !n.number),
    [],
    linkedAnywhere,
  );
  // the job's pages, notebook by notebook (a notebook gone from the Clients folder still shows, to be unlinked)
  const pageRows = Object.entries(pageLinks)
    .map(([path, ps]) => ({ path, pages: cleanPages(ps), nb: s.notebooks.find((n) => n.path === path) }))
    .filter((r) => r.pages.length)
    .sort((a, b) => ((a.nb?.at ?? '') < (b.nb?.at ?? '') ? 1 : -1));
  // any notebook in Clients can give pages: newest change first (this year's notebook is usually at the top)
  const choices = [...s.notebooks].filter((n) => !books.some((b) => b.path === n.path) && !pageLinks[n.path]).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const shownChoices = allChoices ? choices : choices.slice(0, 6);
  const gnPagesAll = Object.fromEntries(Object.entries(marks).map(([u, m]) => [u, m?.gnPages]));
  const sentKey = (path: string, pages?: number[]) => (pages?.length ? `${path}#${pagesSlug(pages)}` : path);

  const attach = async (nb: Notebook, pages?: number[]) => {
    const k = sentKey(nb.path, pages);
    setSending((x) => ({ ...x, [k]: true }));
    setProblem((x) => ({ ...x, [k]: '' }));
    setNote((x) => ({ ...x, [k]: '' }));
    const r = await post<{ uuid: string; at: string; same?: boolean }>(readPin(), { action: 'attach', id: nb.id, job: job.uuid, ...(pages?.length ? { pages } : {}) }, ROUTE);
    setSending((x) => ({ ...x, [k]: false }));
    if (!r.ok) return setProblem((x) => ({ ...x, [k]: gnProblem(r.error, r.detail) }));
    if (r.data.same && pages?.length) setNote((x) => ({ ...x, [k]: 'Nothing new on these pages: ServiceM8 already has them as they are.' }));
    onMark({ gnSent: { ...(marks[job.uuid]?.gnSent ?? {}), [k]: r.data.at || nb.at } });
  };
  const link = (nb: Notebook) => {
    const { [nb.path]: _gone, ...rest } = pageLinks;
    void _gone;
    onMark({ gn: [...new Set([...linked, nb.path])], gnPages: rest });
    setPicker(null);
    setChoosing(false);
  };
  const unlink = (nb: Notebook) => onMark({ gn: linked.filter((p) => p !== nb.path) });
  const linkPages = (nb: Notebook, pages: number[], cover: Blob | null) => {
    onMark({ gnPages: { ...pageLinks, [nb.path]: cleanPages(pages) }, gn: linked.filter((p) => p !== nb.path) });
    if (cover && pages.length) void keepCover(nb.path, cleanPages(pages)[0], cover);
    setPicker(null);
    setChoosing(false);
  };
  const unlinkPages = (path: string) => {
    if (confirmOff !== path) return setConfirmOff(path);
    const { [path]: _gone, ...rest } = pageLinks;
    void _gone;
    onMark({ gnPages: rest });
    setConfirmOff('');
  };

  const err = s.error ? gnProblem(s.error, s.detail) : '';
  const firstLoad = !s.at && s.busy;
  const count = books.length + pageRows.length;
  const ready = Boolean(s.at && !s.error);
  return (
    <section id="goodnotes" data-jsec="goodnotes" data-jsec-note={count ? String(count) : ''} className="mt-6 scroll-mt-[calc(env(safe-area-inset-top)-20px)] rounded-sm border border-line-strong bg-mount p-4" data-goodnotes>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[19px] font-[650]">
          <SecIcon k="goodnotes" />
          Goodnotes
        </h2>
        <button type="button" onClick={() => void check(true)} disabled={s.busy} className="h-9 shrink-0 px-1 font-mono text-[12.5px] text-accent underline disabled:no-underline disabled:opacity-60" data-gn-refresh>
          {s.busy ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      <p className="mt-1 text-[14px] leading-snug text-muted">
        {job.number ? `Notebooks in your Clients folder named ${job.number} first, and pages you link here.` : 'Notebooks in your Clients folder, and pages you link here.'}
        {s.at && !s.error ? ` Checked ${ago(new Date(s.at).toISOString())}.` : ''}
      </p>

      {err && (s.error !== 'offline' || !s.at) ? (
        <p role="alert" className="mt-3 rounded-sm border border-line-strong bg-paper px-3 py-2.5 text-[14.5px] leading-snug" data-gn-problem>
          {err}
        </p>
      ) : null}
      {s.error === 'offline' && s.at ? <p className="mt-2 font-mono text-[12.5px] text-faint">{err}</p> : null}
      {s.note ? (
        <div className="mt-3 flex items-start gap-2 rounded-sm border border-accent bg-paper px-3 py-2.5" data-gn-back>
          <p className="min-w-0 flex-1 text-[14.5px] leading-snug">{s.note}</p>
          <button type="button" onClick={() => set({ note: undefined })} aria-label="Hide" className="-my-1 h-8 w-8 shrink-0 text-[18px] leading-none text-muted">
            ×
          </button>
        </div>
      ) : null}
      {s.error === 'gn-not-connected' || s.error === 'gn-expired' || s.error === 'gn-scope' ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={connecting}
            onClick={async () => {
              setConnecting(true);
              setConnectProblem('');
              const msg = await connectDropbox(s.error !== 'gn-not-connected');
              if (msg) {
                setConnecting(false);
                setConnectProblem(msg);
              }
            }}
            className="btn btn-primary btn-sm disabled:opacity-60"
            data-gn-connect
          >
            {connecting ? 'Opening Dropbox…' : s.error === 'gn-not-connected' ? 'Connect Dropbox' : 'Connect Dropbox again'}
          </button>
          {connectProblem ? <p className="mt-1.5 text-[13.5px] leading-snug text-ink">{connectProblem}</p> : null}
        </div>
      ) : null}
      {firstLoad ? <p className="mt-3 font-mono text-[13px] text-faint">Checking Dropbox…</p> : null}

      {pageRows.length ? (
        <ul className="mt-3 grid gap-3" data-gn-page-list>
          {pageRows.map(({ path, pages, nb }) => {
            const k = sentKey(path, pages);
            const on = sent[k];
            const fresh = nb && on && on >= nb.at;
            const name = nb?.name ?? path.split('/').pop() ?? path;
            const folder = path.includes('/') ? path.split('/').slice(0, -1).join(' / ') : '';
            return (
              <li key={path} className="flex gap-3" data-gn-pages={path}>
                <PageCover path={path} page={pages[0]} name={name} onOpen={() => nb && setOpen({ nb, pages })} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[15.5px] font-semibold leading-snug">{pagesWords(pages).replace(/^p/, 'P')}</p>
                  <p className="mt-0.5 font-mono text-[12px] leading-snug text-faint">
                    of {name}
                    {nb ? ` · changed ${ago(nb.at)}` : ''}
                    {folder ? ` · ${folder}` : ''}
                  </p>
                  {nb ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button type="button" onClick={() => setOpen({ nb, pages })} className="btn btn-primary btn-sm" data-gn-open-pages>
                        Open
                      </button>
                      {fresh ? (
                        <span className="flex items-center gap-1 text-[13.5px] text-muted" data-gn-sent>
                          <span className="text-accent">✓</span> On the ServiceM8 job
                        </span>
                      ) : (
                        <button type="button" disabled={sending[k]} onClick={() => void attach(nb, pages)} className="h-9 text-left text-[14px] text-accent underline disabled:no-underline disabled:opacity-60" data-gn-attach-pages>
                          {sending[k] ? 'Putting them on…' : on ? 'Put the latest on ServiceM8' : pages.length > 1 ? 'Put these pages on the ServiceM8 job' : 'Put this page on the ServiceM8 job'}
                        </button>
                      )}
                      <button type="button" onClick={() => setPicker(nb)} className="h-9 text-[13.5px] text-muted underline" data-gn-change>
                        Change pages
                      </button>
                      <button type="button" onClick={() => unlinkPages(path)} className={`h-9 text-[13.5px] underline ${confirmOff === path ? 'font-semibold text-ink' : 'text-muted'}`} data-gn-unlink-pages>
                        {confirmOff === path ? 'Tap again to unlink' : 'Unlink'}
                      </button>
                    </div>
                  ) : ready ? (
                    <div className="mt-1.5">
                      <p className="text-[13.5px] leading-snug text-ink" data-gn-missing>
                        Not in your Clients folder any more: renamed or moved in Goodnotes? Link its pages again under the new name.
                      </p>
                      <button type="button" onClick={() => unlinkPages(path)} className={`h-9 text-[13.5px] underline ${confirmOff === path ? 'font-semibold text-ink' : 'text-muted'}`} data-gn-unlink-pages>
                        {confirmOff === path ? 'Tap again to unlink' : 'Unlink'}
                      </button>
                    </div>
                  ) : null}
                  {note[k] ? <p className="mt-1 text-[13.5px] leading-snug text-muted">{note[k]}</p> : null}
                  {problem[k] ? <p className="mt-1 text-[13.5px] leading-snug text-ink">{problem[k]}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {books.length ? (
        <ul className="mt-3 grid gap-3" data-gn-list>
          {books.map((nb) => {
            const on = sent[nb.path];
            const fresh = on && on >= nb.at;
            const byHand = linked.includes(nb.path) && nb.number !== String(Number(job.number));
            return (
              <li key={nb.id} className="flex gap-3" data-gn-book={nb.path}>
                <Cover nb={nb} onOpen={() => setOpen({ nb })} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[15.5px] font-semibold leading-snug">{nb.name}</p>
                  <p className="mt-0.5 font-mono text-[12px] leading-snug text-faint">
                    changed {ago(nb.at)} · {sizeWords(nb.size)}
                    {nb.path.includes('/') ? ` · ${nb.path.split('/').slice(0, -1).join(' / ')}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button type="button" onClick={() => setOpen({ nb })} className="btn btn-primary btn-sm" data-gn-open>
                      Open
                    </button>
                    {fresh ? (
                      <span className="flex items-center gap-1 text-[13.5px] text-muted" data-gn-sent>
                        <span className="text-accent">✓</span> On the ServiceM8 job
                      </span>
                    ) : (
                      <button type="button" disabled={sending[nb.path]} onClick={() => void attach(nb)} className="h-9 text-left text-[14px] text-accent underline disabled:no-underline disabled:opacity-60" data-gn-attach>
                        {sending[nb.path] ? 'Putting it on…' : on ? 'Changed since: put the new version on ServiceM8' : 'Put it on the ServiceM8 job'}
                      </button>
                    )}
                    {byHand ? (
                      <button type="button" onClick={() => unlink(nb)} className="h-9 text-[13.5px] text-muted underline">
                        Unlink
                      </button>
                    ) : null}
                  </div>
                  {problem[nb.path] ? <p className="mt-1 text-[13.5px] leading-snug text-ink">{problem[nb.path]}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!count && ready ? (
        <p className="mt-3 text-[14.5px] leading-snug" data-gn-none>
          Nothing for this job yet. Link its pages from a notebook below, or in Goodnotes’ Clients folder start a notebook’s name with <b className="font-semibold">{job.number || 'the job number'}</b>
          {job.number ? ` (e.g. “${job.number} ${job.name.split(' ').slice(-1)[0] || 'client'}”)` : ''}.
        </p>
      ) : null}

      {ready && choices.length ? (
        <div className="mt-3 border-t border-line pt-3">
          {!choosing ? (
            <button type="button" onClick={() => setChoosing(true)} className="h-9 text-[14px] text-accent underline" data-gn-pick>
              {pageRows.length ? 'Link pages from another notebook' : 'Link pages from a notebook'}
            </button>
          ) : (
            <>
              <p className={label}>Which notebook? Then tap this job’s pages</p>
              <ul className="mt-2 divide-y divide-line" data-gn-choices>
                {shownChoices.map((nb) => (
                  <li key={nb.id}>
                    <button type="button" onClick={() => setPicker(nb)} className="flex w-full items-center gap-3 py-2.5 text-left" data-gn-choice={nb.path}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{nb.name}</span>
                        <span className="block truncate font-mono text-[11.5px] text-faint">
                          changed {ago(nb.at)}
                          {nb.path.includes('/') ? ` · ${nb.path.split('/').slice(0, -1).join(' / ')}` : ''}
                          {nb.number ? ` · named for job ${nb.number}` : ''}
                        </span>
                      </span>
                      <span aria-hidden className="shrink-0 font-mono text-[13px] text-accent">
                        Pages →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex gap-4">
                {choices.length > shownChoices.length ? (
                  <button type="button" onClick={() => setAllChoices(true)} className="h-9 text-[14px] text-accent underline">
                    Show all {choices.length}
                  </button>
                ) : null}
                <button type="button" onClick={() => setChoosing(false)} className="h-9 text-[14px] text-muted underline">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {pageRows.length ? <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">Pages are linked by their number. If you add a page in the middle of a notebook, the pages after it move on one: check them with Open.</p> : null}
      {books.length ? <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">On the ServiceM8 job it’s “{attachName(books[0])}”, in the Job diary.</p> : null}
      {ready ? (
        <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint" data-gn-from>
          From Goodnotes’ backup in Dropbox{s.account ? ` (${s.account})` : ''}.
        </p>
      ) : null}
      {open ? (
        <Viewer
          nb={open.nb}
          pages={open.pages}
          onClose={() => setOpen(null)}
          onCover={(page, c) => {
            const nb = open.nb;
            void smallBlob(c).then((b) => keepCover(nb.path, page, b));
          }}
        />
      ) : null}
      {picker ? (
        <PagePicker
          nb={picker}
          initial={cleanPages(pageLinks[picker.path])}
          elsewhere={(() => {
            const m = pagesElsewhere(gnPagesAll, picker.path, job.uuid);
            return new Map([...m].map(([p, us]) => [p, us.map((u) => jobLabel?.(u) || 'another job')]));
          })()}
          jobTitle={title}
          canWhole={!picker.number && !linkedAnywhere.includes(picker.path) && loose.some((n) => n.path === picker.path)}
          onLink={(pages, cover) => linkPages(picker, pages, cover)}
          onWhole={() => link(picker)}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </section>
  );
}
