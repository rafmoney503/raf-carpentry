'use client';
/* eslint-disable @next/next/no-img-element -- the pictures here are the notebooks' first pages, fetched behind the PIN as blobs */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { attachName, looseNotebooks, notebooksFor, sizeWords, type Notebook } from '@/lib/goodnotes-match';
import type { CurrentJob } from '@/lib/servicem8';
import type { Marks } from './current';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { label } from './parts';

/* Goodnotes on the job card (26 Oct 2026, Raf: 'is there a way to connect goodnotes with jobkit so my notes go straight
   to client card', then 'go'). Goodnotes' Auto Backup puts each notebook in info@'s OneDrive as a PDF; the job card
   shows the ones for this job (named with its number first, or linked here by hand) with the first page, opens the
   pages here (pdf.js, loaded only then), and puts the PDF on the ServiceM8 job with one tap. Server side:
   src/lib/goodnotes.ts and /api/job-kit/goodnotes; the matching: src/lib/goodnotes-match.ts. */

const ROUTE = '/api/job-kit/goodnotes';
const KEY = 'raf_jobkit_goodnotes';
const THUMBS = 'raf-jobkit-thumbs-v1';
const FRESH = 90_000;

type Kept = { at: number; notebooks: Notebook[]; error?: string; detail?: string };
type State = Kept & { busy: boolean };

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
      localStorage.setItem(KEY, JSON.stringify({ at: state.at, notebooks: state.notebooks, error: state.error, detail: state.detail }));
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
  const r = await post<{ notebooks: Notebook[]; at: number }>(readPin(), { action: 'list', fresh }, ROUTE);
  if (r.ok) set({ busy: false, at: r.data.at, notebooks: r.data.notebooks, error: undefined, detail: undefined });
  else set({ busy: false, error: r.error, detail: r.detail });
}

function gnProblem(error?: string, detail?: string): string {
  switch (error) {
    case undefined:
      return '';
    case 'gn-consent':
      return 'The Job Kit can’t read OneDrive yet. In Entra: Raf Job Kit, API permissions, Add a permission, Microsoft Graph, Application permissions, Files.Read.All, then Grant admin consent.';
    case 'gn-no-drive':
      return 'info@rafcarpentry.com has no OneDrive yet. Open onedrive.com signed in as info@ once to set it up, or check the Microsoft 365 plan includes OneDrive.';
    case 'gn-no-folder':
      return 'No Goodnotes folder in OneDrive yet. On the iPad: Goodnotes, Settings, Cloud & Backup, Auto Backup, OneDrive (signed in as info@), format PDF, and Increase Auto Backup frequency.';
    case 'gn-no-work':
      return 'Goodnotes is backing up, but there’s no Clients folder yet. In Goodnotes make a folder called Clients and move your work notebooks into it: only those show here.';
    case 'gn-secret':
      return problemText('outlook-secret', detail);
    case 'gn-not-set-up':
      return problemText('outlook-not-set-up', detail);
    case 'gn-gone':
      return 'That notebook isn’t in OneDrive any more (renamed, moved or deleted in Goodnotes). Refresh.';
    case 'gn-too-big':
      return 'Over 40 MB, too big to send from here. Add it to the job in ServiceM8 itself.';
    case 'gn-too-big-here':
      return 'This notebook is over 4 MB and OneDrive’s link didn’t open here. Open it in Goodnotes or OneDrive.';
    case 'gn-busy':
      return 'Microsoft didn’t answer. Try again in a minute.';
    case 'gn-error':
      return `Microsoft sent back an error${detail ? `: ${detail}` : '.'}`;
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
type PdfTask = { promise: Promise<PdfDoc>; destroy: () => Promise<void> }; // pdf.js 6: destroy is on the loading task
type PdfPage = { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvas: HTMLCanvasElement; viewport: unknown }) => { promise: Promise<void> } };

let pdfjs: Promise<{ getDocument: (o: { data: ArrayBuffer }) => PdfTask }> | null = null;
function loadPdfjs() {
  if (!pdfjs) {
    // the legacy build: the modern one needs JavaScript newer than an iPhone's Safari has (Map.getOrInsertComputed)
    pdfjs = import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => {
      m.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
      return m as unknown as { getDocument: (o: { data: ArrayBuffer }) => PdfTask };
    });
    pdfjs.catch(() => {
      pdfjs = null;
    });
  }
  return pdfjs;
}

const pdfBytes = new Map<string, ArrayBuffer>(); // this visit's notebooks, by id and version

async function fetchPdf(nb: Notebook): Promise<ArrayBuffer | { error: string; detail?: string }> {
  const key = `${nb.id}|${nb.at}`;
  const had = pdfBytes.get(key);
  if (had) return had.slice(0);
  const r = await post<{ url: string; size: number }>(readPin(), { action: 'open', id: nb.id }, ROUTE);
  if (!r.ok) return { error: r.error, detail: r.detail };
  let buf: ArrayBuffer | null = null;
  try {
    // straight from OneDrive (its pre-signed link), so a big notebook doesn't pass through the website
    const res = await fetch(r.data.url, { cache: 'no-store' });
    if (res.ok) buf = await res.arrayBuffer();
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

function PageCanvas({ doc, n, width }: { doc: PdfDoc; n: number; width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.414);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    let gone = false;
    void doc.getPage(n).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (!gone) setRatio(v.height / v.width);
    });
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
  return (
    <div className="relative bg-mount shadow-[0_6px_18px_-8px_rgb(0_0_0/0.6)]" style={{ aspectRatio: `1 / ${ratio}` }} data-gn-page={n}>
      <div ref={box} />
      {!drawn ? <span className="absolute inset-0 grid place-items-center font-mono text-[12px] text-faint">Page {n}</span> : null}
    </div>
  );
}

function Viewer({ nb, onClose }: { nb: Notebook; onClose: () => void }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let gone = false;
    let task: PdfTask | null = null;
    const end = () => void task?.destroy().catch(() => {});
    void (async () => {
      const bytes = await fetchPdf(nb);
      if (gone) return;
      if (!(bytes instanceof ArrayBuffer)) return setError(gnProblem(bytes.error, bytes.detail));
      try {
        const lib = await loadPdfjs();
        if (gone) return;
        task = lib.getDocument({ data: bytes });
        const opened = await task.promise;
        if (gone) return end();
        setDoc(opened);
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
  return (
    <div role="dialog" aria-modal="true" aria-label={nb.name} className="fixed inset-0 z-50 flex flex-col bg-ink" data-gn-viewer>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] text-on-accent">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{nb.name}</span>
          <span className="block font-mono text-[11.5px] text-on-accent/70">{doc ? `${doc.numPages} page${doc.numPages === 1 ? '' : 's'} · ` : ''}changed {ago(nb.at)}</span>
        </span>
        <button type="button" onClick={onClose} className="h-11 shrink-0 px-2 text-[15px] font-semibold">
          Close
        </button>
      </div>
      <div ref={area} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {error ? (
          <p className="mx-auto mt-16 max-w-sm px-3 text-center text-[15px] leading-relaxed text-on-accent">{error}</p>
        ) : !doc || !width ? (
          <p className="mt-16 text-center font-mono text-[13px] text-on-accent/70">Opening…</p>
        ) : (
          <div className="mx-auto grid gap-3 pt-1" style={{ width }}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PageCanvas key={i} doc={doc} n={i + 1} width={width} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- the box on the job card ---------- */

export function GoodnotesBox({ job, marks, onMark }: { job: CurrentJob; marks: Marks; onMark: (patch: Marks[string]) => void }) {
  const s = useNotebooks();
  const mine = marks[job.uuid] ?? {};
  const linked = mine.gn ?? [];
  const sent = mine.gnSent ?? {};
  const [open, setOpen] = useState<Notebook | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const [allLoose, setAllLoose] = useState(false);

  useEffect(() => {
    void check();
  }, [job.uuid]);

  const books = notebooksFor(s.notebooks, job.number, linked);
  const linkedAnywhere = Object.values(marks).flatMap((m) => m?.gn ?? []);
  const loose = looseNotebooks(
    s.notebooks.filter((n) => !n.number),
    [],
    linkedAnywhere,
  );
  const shown = allLoose ? loose : loose.slice(0, 5);

  const attach = async (nb: Notebook) => {
    setSending((x) => ({ ...x, [nb.path]: true }));
    setProblem((x) => ({ ...x, [nb.path]: '' }));
    const r = await post<{ uuid: string; at: string }>(readPin(), { action: 'attach', id: nb.id, job: job.uuid }, ROUTE);
    setSending((x) => ({ ...x, [nb.path]: false }));
    if (!r.ok) return setProblem((x) => ({ ...x, [nb.path]: gnProblem(r.error, r.detail) }));
    onMark({ gnSent: { ...(marks[job.uuid]?.gnSent ?? {}), [nb.path]: r.data.at || nb.at } });
  };
  const link = (nb: Notebook) => {
    onMark({ gn: [...new Set([...linked, nb.path])] });
    setPicking(false);
  };
  const unlink = (nb: Notebook) => onMark({ gn: linked.filter((p) => p !== nb.path) });

  const err = s.error ? gnProblem(s.error, s.detail) : '';
  const firstLoad = !s.at && s.busy;
  return (
    <section id="goodnotes" className="mt-6 scroll-mt-[calc(env(safe-area-inset-top)-20px)] rounded-sm border border-line-strong bg-mount p-4" data-goodnotes>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-[650]">Goodnotes</h2>
        <button type="button" onClick={() => void check(true)} disabled={s.busy} className="h-9 shrink-0 px-1 font-mono text-[12.5px] text-accent underline disabled:no-underline disabled:opacity-60" data-gn-refresh>
          {s.busy ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      <p className="mt-1 text-[14px] leading-snug text-muted">
        {job.number ? `Notebooks in your Clients folder named ${job.number} first.` : 'Notebooks in your Clients folder.'}
        {s.at && !s.error ? ` Checked ${ago(new Date(s.at).toISOString())}.` : ''}
      </p>

      {err && (s.error !== 'offline' || !s.at) ? (
        <p role="alert" className="mt-3 rounded-sm border border-line-strong bg-paper px-3 py-2.5 text-[14.5px] leading-snug" data-gn-problem>
          {err}
        </p>
      ) : null}
      {s.error === 'offline' && s.at ? <p className="mt-2 font-mono text-[12.5px] text-faint">{err}</p> : null}
      {firstLoad ? <p className="mt-3 font-mono text-[13px] text-faint">Checking OneDrive…</p> : null}

      {books.length ? (
        <ul className="mt-3 grid gap-3" data-gn-list>
          {books.map((nb) => {
            const on = sent[nb.path];
            const fresh = on && on >= nb.at;
            const byHand = linked.includes(nb.path) && nb.number !== String(Number(job.number));
            return (
              <li key={nb.id} className="flex gap-3" data-gn-book={nb.path}>
                <Cover nb={nb} onOpen={() => setOpen(nb)} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[15.5px] font-semibold leading-snug">{nb.name}</p>
                  <p className="mt-0.5 font-mono text-[12px] leading-snug text-faint">
                    changed {ago(nb.at)} · {sizeWords(nb.size)}
                    {nb.path.includes('/') ? ` · ${nb.path.split('/').slice(0, -1).join(' / ')}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button type="button" onClick={() => setOpen(nb)} className="btn btn-primary btn-sm" data-gn-open>
                      Open
                    </button>
                    {fresh ? (
                      <span className="flex items-center gap-1 text-[13.5px] text-muted" data-gn-sent>
                        <span className="text-accent">✓</span> On the ServiceM8 job
                      </span>
                    ) : (
                      <button type="button" disabled={sending[nb.path]} onClick={() => void attach(nb)} className="h-9 text-[14px] text-accent underline disabled:no-underline disabled:opacity-60" data-gn-attach>
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
      ) : s.at && !s.error ? (
        <p className="mt-3 text-[14.5px] leading-snug" data-gn-none>
          No notebook for this job yet. In Goodnotes’ Clients folder, start a notebook’s name with <b className="font-semibold">{job.number || 'the job number'}</b>
          {job.number ? ` (e.g. “${job.number} ${job.name.split(' ').slice(-1)[0] || 'client'}”)` : ''} and it shows here a minute or two after you write.
        </p>
      ) : null}

      {s.at && !s.error && loose.length ? (
        <div className="mt-3 border-t border-line pt-3">
          {!picking ? (
            <button type="button" onClick={() => setPicking(true)} className="h-9 text-[14px] text-accent underline" data-gn-pick>
              Link a notebook without a number ({loose.length})
            </button>
          ) : (
            <>
              <p className={label}>Notebooks without a job number</p>
              <ul className="mt-2 divide-y divide-line" data-gn-loose>
                {shown.map((nb) => (
                  <li key={nb.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{nb.name}</span>
                      <span className="block font-mono text-[11.5px] text-faint">changed {ago(nb.at)}</span>
                    </span>
                    <button type="button" onClick={() => link(nb)} className="btn btn-ghost btn-sm shrink-0" data-gn-link>
                      Link
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex gap-4">
                {loose.length > shown.length ? (
                  <button type="button" onClick={() => setAllLoose(true)} className="h-9 text-[14px] text-accent underline">
                    Show all {loose.length}
                  </button>
                ) : null}
                <button type="button" onClick={() => setPicking(false)} className="h-9 text-[14px] text-muted underline">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {books.length ? <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">On the ServiceM8 job it’s “{attachName(books[0])}”, in the Job diary.</p> : null}
      {open ? <Viewer nb={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}
