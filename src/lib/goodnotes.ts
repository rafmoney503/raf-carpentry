import { driveGraph, OutlookError } from './outlook';
import { numberOf, type Notebook } from './goodnotes-match';

/* Goodnotes notebooks from the mailbox's OneDrive (26 Oct 2026). Goodnotes' Auto Backup (iPad: Settings → Cloud &
   Backup → Auto Backup → OneDrive, signed in as info@rafcarpentry.com, format PDF) copies every notebook to a folder
   named Goodnotes (GOODNOTES_FOLDER to change it), keeping Goodnotes' own folders under it. Read app-only through
   Microsoft Graph with the 'Raf Job Kit' app's Files.Read.All (Entra: API permissions → Microsoft Graph → Application
   permissions → Files.Read.All, then Grant admin consent). Nothing here writes to OneDrive. */

const FOLDER = () => (process.env.GOODNOTES_FOLDER || 'Goodnotes').replace(/^\/+|\/+$/g, '');
const MAX_FOLDERS = 60;
const MAX_DEPTH = 4;

export type GnCode = 'gn-secret' | 'gn-consent' | 'gn-no-drive' | 'gn-no-folder' | 'gn-not-set-up' | 'gn-busy' | 'gn-error' | 'gn-gone' | 'gn-too-big';
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
  if (!(e instanceof OutlookError)) return new GnError('gn-error', 502, String(e).slice(0, 200));
  const d = e.detail ?? '';
  if (e.code === 'outlook-not-set-up') return new GnError('gn-not-set-up', 503, d);
  if (e.code === 'outlook-consent') return new GnError('gn-consent', 403, d);
  if (e.code === 'outlook-secret' || e.code === 'outlook-app') return new GnError('gn-secret', 502, d);
  if (e.code === 'outlook-mailbox' || /mysite|ResourceNotFound/i.test(d)) return new GnError('gn-no-drive', 404, d);
  if (e.code === 'outlook-busy') return new GnError('gn-busy', 503, d);
  if (/itemNotFound/i.test(d) || e.code === 'outlook-gone') return new GnError(where === 'folder' ? 'gn-no-folder' : 'gn-gone', 404, d);
  return new GnError('gn-error', 502, d);
}

type GItem = { id: string; name: string; size?: number; lastModifiedDateTime?: string; file?: { mimeType?: string }; folder?: { childCount?: number } };
type GList = { value?: GItem[]; '@odata.nextLink'?: string };

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');
const SELECT = '$select=id,name,size,lastModifiedDateTime,file,folder&$top=200';

async function children(path: string): Promise<GItem[]> {
  const out: GItem[] = [];
  let page = await driveGraph<GList>(`/root:/${enc(path)}:/children?${SELECT}`);
  out.push(...(page.value ?? []));
  for (let i = 0; i < 5 && page['@odata.nextLink']; i++) {
    const next = page['@odata.nextLink'].replace(/^.*?\/drive(?=\/)/, '');
    page = await driveGraph<GList>(next);
    out.push(...(page.value ?? []));
  }
  return out;
}

let kept: { at: number; list: Notebook[] } | null = null;

/* Every PDF under the backup folder, a few folders deep. Kept a minute, so opening jobs one after another doesn't ask
   Microsoft each time. */
export async function notebooks(fresh = false): Promise<Notebook[]> {
  if (!fresh && kept && Date.now() - kept.at < 60_000) return kept.list;
  const root = FOLDER();
  const list: Notebook[] = [];
  const queue: { path: string; rel: string; depth: number }[] = [{ path: root, rel: '', depth: 0 }];
  let folders = 0;
  try {
    while (queue.length && folders < MAX_FOLDERS) {
      const f = queue.shift()!;
      folders++;
      for (const it of await children(f.path)) {
        const rel = f.rel ? `${f.rel}/${it.name}` : it.name;
        if (it.folder) {
          if (f.depth < MAX_DEPTH) queue.push({ path: `${f.path}/${it.name}`, rel, depth: f.depth + 1 });
        } else if (/\.pdf$/i.test(it.name) || it.file?.mimeType === 'application/pdf') {
          const name = it.name.replace(/\.pdf$/i, '');
          list.push({ id: it.id, name, path: rel.replace(/\.pdf$/i, ''), size: it.size ?? 0, at: it.lastModifiedDateTime ?? '', number: numberOf(name) });
        }
      }
    }
  } catch (e) {
    throw asGn(e);
  }
  kept = { at: Date.now(), list };
  return list;
}

const okId = (id: string) => /^[A-Za-z0-9!_.-]{6,120}$/.test(id);

/* A small picture of the first page (OneDrive makes it). */
export async function notebookThumb(id: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  if (!okId(id)) throw new GnError('gn-gone', 404);
  try {
    const res = await driveGraph<Response>(`/items/${encodeURIComponent(id)}/thumbnails/0/medium/content`, true);
    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength) throw new GnError('gn-gone', 404, 'no thumbnail');
    return { bytes, type: res.headers.get('content-type') || 'image/jpeg' };
  } catch (e) {
    throw asGn(e, 'item');
  }
}

/* A short-lived address the phone can fetch the PDF from itself (OneDrive's pre-signed download link, about an
   hour), so a big notebook never has to pass through this server's 4.5 MB answer limit. */
export async function notebookLink(id: string): Promise<{ url: string; name: string; size: number; at: string }> {
  if (!okId(id)) throw new GnError('gn-gone', 404);
  try {
    const it = await driveGraph<GItem & { '@microsoft.graph.downloadUrl'?: string }>(`/items/${encodeURIComponent(id)}?$select=id,name,size,lastModifiedDateTime,@microsoft.graph.downloadUrl`);
    const url = it['@microsoft.graph.downloadUrl'];
    if (!url) throw new GnError('gn-gone', 404, 'no download link');
    return { url, name: it.name.replace(/\.pdf$/i, ''), size: it.size ?? 0, at: it.lastModifiedDateTime ?? '' };
  } catch (e) {
    throw asGn(e, 'item');
  }
}

/* The PDF itself, for putting it on the ServiceM8 job (server to server). */
export async function notebookFile(id: string, maxBytes = 40 * 1048576): Promise<{ blob: Blob; name: string; at: string }> {
  const link = await notebookLink(id);
  if (link.size > maxBytes) throw new GnError('gn-too-big', 413, `${link.size}`);
  let res: Response;
  try {
    res = await fetch(link.url, { cache: 'no-store', signal: AbortSignal.timeout(40_000) });
  } catch {
    throw new GnError('gn-busy', 503, 'download');
  }
  if (!res.ok) throw new GnError(res.status === 404 ? 'gn-gone' : 'gn-busy', res.status === 404 ? 404 : 503, `${res.status}`);
  const blob = new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
  return { blob, name: link.name, at: link.at };
}
