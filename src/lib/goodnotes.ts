import { dropboxChildren, DropboxError, dropboxLink, dropboxListAll, dropboxThumb, type DbxEntry } from './dropbox';
import { numberOf, type Notebook } from './goodnotes-match';

/* Goodnotes notebooks for the Job Kit's job cards (26 Oct 2026; read from Dropbox since 4 Nov 2026, as info@'s
   Microsoft plan has no OneDrive). Goodnotes' Auto Backup (iPad: Settings → Cloud & Backup → Auto Backup → Dropbox,
   format PDF, Increase Auto Backup frequency) copies every notebook into its own Dropbox app folder, /Apps/Goodnotes
   (GOODNOTES_FOLDER to change it; an /Apps folder whose name starts with Goodnotes, e.g. 'GoodNotes 5', is found by
   itself), keeping Goodnotes' own folders. Read through src/lib/dropbox.ts. Nothing here writes to Dropbox. */

const FOLDER = () => (process.env.GOODNOTES_FOLDER || '/Apps/Goodnotes').replace(/\/+$/, '').replace(/^(?!\/)/, '/');
/* Only notebooks in this Goodnotes folder are work (26 Oct 2026, Raf: 'only the ones I use for work'): everything else
   Goodnotes backs up is left alone and never shown. Found at any level under the backup folder. */
const WORK = () => (process.env.GOODNOTES_WORK_FOLDER || 'Clients').trim().toLowerCase();
const MAX_DEPTH = 6; // folders inside Clients

export type GnCode =
  | 'gn-not-set-up'
  | 'gn-not-connected'
  | 'gn-expired'
  | 'gn-scope'
  | 'gn-store'
  | 'gn-no-folder'
  | 'gn-no-work'
  | 'gn-busy'
  | 'gn-error'
  | 'gn-gone'
  | 'gn-too-big'
  | 'gn-pages-gone'
  | 'gn-bad-pdf';
export class GnError extends Error {
  constructor(
    public code: GnCode,
    public status: number,
    public detail = '',
  ) {
    super(code);
  }
}

function asGn(e: unknown, where: 'folder' | 'item' = 'folder'): GnError {
  if (e instanceof GnError) return e;
  if (!(e instanceof DropboxError)) return new GnError('gn-error', 502, String(e).slice(0, 200));
  const d = e.detail ?? '';
  switch (e.code) {
    case 'dbx-not-set-up':
      return new GnError('gn-not-set-up', 503, d);
    case 'dbx-not-connected':
      return new GnError('gn-not-connected', 409, d);
    case 'dbx-expired':
      return new GnError('gn-expired', 401, d);
    case 'dbx-scope':
      return new GnError('gn-scope', 403, d);
    case 'dbx-store':
      return new GnError('gn-store', 503, d);
    case 'dbx-busy':
      return new GnError('gn-busy', 503, d);
    case 'dbx-not-found':
      return new GnError(where === 'folder' ? 'gn-no-folder' : 'gn-gone', 404, d);
    default:
      return new GnError('gn-error', 502, d);
  }
}

/* Everything in the backup folder; if it isn't there and no folder was set, Goodnotes' app folder under /Apps by name
   ('Goodnotes', 'GoodNotes 5'...). */
async function backup(): Promise<{ root: string; entries: DbxEntry[] }> {
  const root = FOLDER();
  try {
    return { root, entries: await dropboxListAll(root) };
  } catch (e) {
    if (!(e instanceof DropboxError) || e.code !== 'dbx-not-found' || process.env.GOODNOTES_FOLDER) throw e;
  }
  let apps: DbxEntry[] = [];
  try {
    apps = await dropboxChildren('/Apps');
  } catch (e) {
    if (e instanceof DropboxError && e.code === 'dbx-not-found') throw new DropboxError('dbx-not-found', 404, '/Apps');
    throw e;
  }
  const own = apps.filter((a) => a['.tag'] !== 'file' && /^goodnotes/i.test(a.name.trim()));
  for (const a of own) {
    const path = a.path_display || `/Apps/${a.name}`;
    try {
      return { root: path, entries: await dropboxListAll(path) };
    } catch (e) {
      if (!(e instanceof DropboxError) || e.code !== 'dbx-not-found') throw e;
    }
  }
  throw new DropboxError('dbx-not-found', 404, root);
}

let kept: { at: number; list: Notebook[] } | null = null;

/* Every PDF in the work folder (Clients) of the backup, its path starting at Clients ('Clients/2026/2026 Jobs'). Kept
   a minute, so opening jobs one after another doesn't ask Dropbox each time. */
export async function notebooks(fresh = false): Promise<Notebook[]> {
  if (!fresh && kept && Date.now() - kept.at < 60_000) return kept.list;
  let found = false;
  const list: Notebook[] = [];
  try {
    const { root, entries } = await backup();
    const rootParts = root.split('/').length;
    for (const it of entries) {
      const full = it.path_display || it.path_lower || '';
      const parts = full.split('/').slice(rootParts);
      if (!parts.length) continue;
      const folders = it['.tag'] === 'folder' ? parts : parts.slice(0, -1);
      const w = folders.findIndex((f) => f.trim().toLowerCase() === WORK());
      if (w < 0) continue;
      found = true;
      if (it['.tag'] !== 'file' || !it.id || it.is_downloadable === false || !/\.pdf$/i.test(it.name)) continue;
      if (parts.length - 1 - w > MAX_DEPTH) continue;
      const name = it.name.replace(/\.pdf$/i, '');
      list.push({ id: it.id, name, path: parts.slice(w).join('/').replace(/\.pdf$/i, ''), size: it.size ?? 0, at: it.server_modified ?? it.client_modified ?? '', number: numberOf(name) });
    }
  } catch (e) {
    throw asGn(e);
  }
  if (!found) throw new GnError('gn-no-work', 404, WORK());
  kept = { at: Date.now(), list };
  return list;
}

const okId = (id: string) => /^id:[A-Za-z0-9_-]{4,80}$/.test(id);

/* A small picture of the first page. */
export async function notebookThumb(id: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  if (!okId(id)) throw new GnError('gn-gone', 404);
  try {
    return await dropboxThumb(id);
  } catch (e) {
    throw asGn(e, 'item');
  }
}

/* A link the phone fetches the PDF from itself (Dropbox's, 4 hours), so a big notebook never has to pass through this
   server's 4.5 MB answer limit. */
export async function notebookLink(id: string): Promise<{ url: string; name: string; size: number; at: string }> {
  if (!okId(id)) throw new GnError('gn-gone', 404);
  try {
    const l = await dropboxLink(id);
    return { ...l, name: l.name.replace(/\.pdf$/i, '') };
  } catch (e) {
    throw asGn(e, 'item');
  }
}

/* The notebook's bytes, straight from Dropbox's link (server to server). */
async function download(id: string, maxBytes: number): Promise<{ bytes: ArrayBuffer; name: string; at: string }> {
  const link = await notebookLink(id);
  if (link.size > maxBytes) throw new GnError('gn-too-big', 413, `${link.size}|${maxBytes}`);
  let res: Response;
  try {
    res = await fetch(link.url, { cache: 'no-store', signal: AbortSignal.timeout(50_000) });
  } catch {
    throw new GnError('gn-busy', 503, 'download');
  }
  if (!res.ok) throw new GnError(res.status === 404 || res.status === 410 ? 'gn-gone' : 'gn-busy', res.status === 404 || res.status === 410 ? 404 : 503, `${res.status}`);
  try {
    return { bytes: await res.arrayBuffer(), name: link.name, at: link.at };
  } catch {
    throw new GnError('gn-busy', 503, 'download');
  }
}

/* The PDF itself, for putting a whole notebook on the ServiceM8 job. */
export async function notebookFile(id: string, maxBytes = 40 * 1048576): Promise<{ blob: Blob; name: string; at: string }> {
  const f = await download(id, maxBytes);
  return { blob: new Blob([f.bytes], { type: 'application/pdf' }), name: f.name, at: f.at };
}

/* Some pages of a notebook as a PDF of their own (4 Nov 2026: one notebook for the year, a job on each page), for the
   ServiceM8 job. `hash` is of the pages picked out, so the same pages sent twice can be one attachment even though the
   notebook changed elsewhere. A year notebook gets big (Raf's 2026 one was 166 MB in November, 2025's 383 MB): pdf-lib
   reads 400 MB in about a second with 1.3 GB of memory at most, inside a Vercel function's 2 GB, so up to 450 MB; the
   bytes go straight to pdf-lib with no copy between. */
export const PAGES_MAX = 450 * 1048576;
export async function notebookPages(id: string, pages: number[], maxBytes = PAGES_MAX): Promise<{ blob: Blob; name: string; at: string; count: number; hash: string }> {
  const f = await download(id, maxBytes);
  const { PDFDocument } = await import('pdf-lib');
  let src: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    src = await PDFDocument.load(f.bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new GnError('gn-bad-pdf', 422);
  }
  const count = src.getPageCount();
  const missing = pages.filter((p) => p > count);
  if (missing.length) throw new GnError('gn-pages-gone', 404, `${count}|${missing.join(',')}`);
  const out = await PDFDocument.create({ updateMetadata: false });
  for (const p of await out.copyPages(src, pages.map((p) => p - 1))) out.addPage(p);
  const bytes = await out.save();
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), name: f.name, at: f.at, count, hash };
}
