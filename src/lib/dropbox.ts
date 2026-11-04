import { forget, keep, kept, newState, seal, stateOk, unseal } from './social-store';

/* Dropbox for the Job Kit (4 Nov 2026). info@'s Microsoft plan (through GoDaddy) has no OneDrive ('Tenant does not
   have a SPO license'), so Goodnotes' Auto Backup goes to Raf's own Dropbox (iPad: Goodnotes → Settings → Cloud &
   Backup → Auto Backup → Dropbox, format PDF), which puts it in Goodnotes' app folder, /Apps/Goodnotes. Read through
   Raf's own Dropbox app 'Raf Job Kit' (dropbox.com/developers/apps: Scoped access, Full Dropbox, permissions
   files.metadata.read and files.content.read, redirect URI https://www.rafcarpentry.com/api/job-kit/goodnotes/dropbox/callback).
   Vercel: DROPBOX_APP_KEY, DROPBOX_APP_SECRET (sensitive). Connected once from a job's Goodnotes box (OAuth code flow
   with token_access_type offline): the refresh token is kept SEALED in jobkit.social under 'dropbox' (social-store.ts),
   so the phone and the computer both read it. Read only: nothing here writes to Dropbox. DROPBOX_API, DROPBOX_CONTENT
   and DROPBOX_AUTHORIZE change the addresses (tests); DROPBOX_REDIRECT_URI the callback. */

const APP_KEY = () => process.env.DROPBOX_APP_KEY ?? '';
const APP_SECRET = () => process.env.DROPBOX_APP_SECRET ?? '';
const API = () => (process.env.DROPBOX_API || 'https://api.dropboxapi.com').replace(/\/$/, '');
const CONTENT = () => (process.env.DROPBOX_CONTENT || 'https://content.dropboxapi.com').replace(/\/$/, '');
const AUTHORIZE = () => process.env.DROPBOX_AUTHORIZE || 'https://www.dropbox.com/oauth2/authorize';
const ROW = 'dropbox';
const TAG = 'dropbox';

export type DbxCode = 'dbx-not-set-up' | 'dbx-not-connected' | 'dbx-expired' | 'dbx-scope' | 'dbx-busy' | 'dbx-not-found' | 'dbx-store' | 'dbx-error';
export class DropboxError extends Error {
  constructor(
    public code: DbxCode,
    public status: number,
    public detail = '',
  ) {
    super(code);
  }
}

/* What's missing in Vercel, by name (never the values). */
export function dropboxMissing(): string[] {
  const out: string[] = [];
  if (!APP_KEY()) out.push('DROPBOX_APP_KEY');
  if (!APP_SECRET()) out.push('DROPBOX_APP_SECRET');
  if (!process.env.JOBKIT_SYNC_SECRET) out.push('JOBKIT_SYNC_SECRET');
  return out;
}
export const dropboxSetUp = () => dropboxMissing().length === 0;
const needSetUp = () => {
  const m = dropboxMissing();
  if (m.length) throw new DropboxError('dbx-not-set-up', 503, m.join(', '));
};

export const dropboxRedirectUri = (origin: string) => process.env.DROPBOX_REDIRECT_URI || `${origin.replace(/\/$/, '')}/api/job-kit/goodnotes/dropbox/callback`;

/* The Dropbox page that asks Raf to allow the app. No `scope`: it asks for what the app has ticked in its
   Permissions tab (asking for one it hasn't would fail the whole login). */
export function dropboxLoginUrl(origin: string, again = false) {
  needSetUp();
  const q = new URLSearchParams({
    client_id: APP_KEY(),
    response_type: 'code',
    redirect_uri: dropboxRedirectUri(origin),
    token_access_type: 'offline',
    state: newState(APP_SECRET(), TAG),
  });
  if (again) q.set('force_reapprove', 'true');
  return `${AUTHORIZE()}?${q}`;
}
export const dropboxStateOk = (state: string | null) => stateOk(state, APP_SECRET(), TAG);

type Saved = { token: string; account?: { id?: string; email?: string; name?: string }; connectedAt?: string };
type TokenAnswer = { access_token?: string; refresh_token?: string; expires_in?: number; account_id?: string; error?: string; error_description?: string };

async function tokenCall(form: Record<string, string>): Promise<TokenAnswer> {
  let res: Response;
  try {
    res = await fetch(`${API()}/oauth2/token`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${Buffer.from(`${APP_KEY()}:${APP_SECRET()}`).toString('base64')}` },
      body: new URLSearchParams(form),
    });
  } catch {
    throw new DropboxError('dbx-busy', 503, 'token');
  }
  const j = (await res.json().catch(() => ({}))) as TokenAnswer;
  if (res.ok && j.access_token) return j;
  const e = String(j.error ?? res.status);
  if (e === 'invalid_grant') throw new DropboxError('dbx-expired', 401, `${e}: ${j.error_description ?? ''}`.slice(0, 200));
  if (res.status === 429 || res.status >= 500) throw new DropboxError('dbx-busy', 503, e);
  throw new DropboxError('dbx-error', 502, `${e}${j.error_description ? `: ${j.error_description}` : ''}`.slice(0, 200));
}

let access: { token: string; until: number; account?: Saved['account'] } | null = null;

async function savedRow(): Promise<Saved | null> {
  try {
    return await kept<Saved>(ROW);
  } catch {
    throw new DropboxError('dbx-store', 503);
  }
}

/* A short-lived access token (Dropbox gives 4 hours), made from the kept refresh token and remembered here. */
async function accessToken(fresh = false): Promise<string> {
  needSetUp();
  if (!fresh && access && access.until > Date.now() + 60_000) return access.token;
  const saved = await savedRow();
  if (!saved?.token) throw new DropboxError('dbx-not-connected', 409);
  let refresh: string;
  try {
    refresh = unseal(saved.token);
  } catch {
    throw new DropboxError('dbx-expired', 401, 'sealed');
  }
  const j = await tokenCall({ grant_type: 'refresh_token', refresh_token: refresh });
  access = { token: j.access_token!, until: Date.now() + (j.expires_in ?? 14_400) * 1000, account: saved.account };
  return access.token;
}

/* The Dropbox account the Job Kit reads (for the line under the notebooks), once a token has been made. */
export const dropboxAccount = () => access?.account?.email || access?.account?.name || '';

/* Dropbox-API-Arg is a header, so anything past ASCII goes as \u escapes. */
const asciiJson = (v: unknown) => JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

async function call(host: 'api' | 'content', path: string, arg: unknown, retried = false): Promise<Response> {
  const token = await accessToken(retried);
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  let body: string | undefined;
  if (host === 'api') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(arg ?? null);
  } else {
    headers['dropbox-api-arg'] = asciiJson(arg);
  }
  let res: Response;
  try {
    res = await fetch(`${host === 'api' ? API() : CONTENT()}/2/${path}`, { method: 'POST', headers, body, cache: 'no-store', signal: AbortSignal.timeout(host === 'api' ? 20_000 : 40_000) });
  } catch {
    throw new DropboxError('dbx-busy', 503, path);
  }
  if (res.ok) return res;
  const t = (await res.text().catch(() => '')).slice(0, 300);
  if (res.status === 401) {
    if (/missing_scope/.test(t)) throw new DropboxError('dbx-scope', 403, t.slice(0, 200));
    if (!retried && /expired_access_token|invalid_access_token/.test(t)) {
      access = null;
      return call(host, path, arg, true);
    }
    throw new DropboxError('dbx-expired', 401, t.slice(0, 200));
  }
  if (res.status === 409) {
    let summary = t;
    try {
      summary = String((JSON.parse(t) as { error_summary?: string }).error_summary ?? t);
    } catch {
      /* plain text */
    }
    throw new DropboxError(/not_found/.test(summary) ? 'dbx-not-found' : 'dbx-error', /not_found/.test(summary) ? 404 : 502, summary.slice(0, 200));
  }
  if (res.status === 429 || res.status >= 500) throw new DropboxError('dbx-busy', 503, `${res.status}`);
  throw new DropboxError('dbx-error', 502, `${res.status} ${t}`.slice(0, 200));
}

export type DbxEntry = {
  '.tag': 'file' | 'folder' | 'deleted';
  name: string;
  id?: string;
  path_display?: string;
  path_lower?: string;
  size?: number;
  server_modified?: string;
  client_modified?: string;
  is_downloadable?: boolean;
};
type DbxPage = { entries?: DbxEntry[]; cursor?: string; has_more?: boolean };

/* Everything under a folder (recursive), page by page. */
export async function dropboxListAll(path: string, maxPages = 15): Promise<DbxEntry[]> {
  let page = (await (await call('api', 'files/list_folder', { path, recursive: true, limit: 2000, include_deleted: false, include_non_downloadable_files: false })).json()) as DbxPage;
  const out = [...(page.entries ?? [])];
  for (let i = 0; i < maxPages && page.has_more && page.cursor; i++) {
    page = (await (await call('api', 'files/list_folder/continue', { cursor: page.cursor })).json()) as DbxPage;
    out.push(...(page.entries ?? []));
  }
  return out;
}

/* Just a folder's own children (to find Goodnotes' app folder under /Apps). */
export async function dropboxChildren(path: string): Promise<DbxEntry[]> {
  const page = (await (await call('api', 'files/list_folder', { path, recursive: false, limit: 2000 })).json()) as DbxPage;
  return page.entries ?? [];
}

/* A small JPEG of the first page. Dropbox makes these for PDFs too, though it only documents images: when it won't,
   this throws and the card shows a plain page icon. */
export async function dropboxThumb(id: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  let res: Response;
  try {
    res = await call('content', 'files/get_thumbnail_v2', { resource: { '.tag': 'path', path: id }, format: 'jpeg', size: 'w256h256', mode: 'bestfit' });
  } catch (e) {
    // a PDF Dropbox won't draw (unsupported_extension, conversion_error, too big): no picture, nothing wrong
    if (e instanceof DropboxError && e.code === 'dbx-error' && /unsupported_extension|conversion_error|unsupported_image/.test(e.detail)) throw new DropboxError('dbx-not-found', 404, 'no thumbnail');
    throw e;
  }
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) throw new DropboxError('dbx-not-found', 404, 'no thumbnail');
  return { bytes, type: res.headers.get('content-type')?.startsWith('image/') ? res.headers.get('content-type')! : 'image/jpeg' };
}

/* A link the phone can fetch the file from itself for the next 4 hours, so a big notebook never passes through the
   website (its answers stop at 4.5 MB). */
export async function dropboxLink(id: string): Promise<{ url: string; name: string; size: number; at: string }> {
  const j = (await (await call('api', 'files/get_temporary_link', { path: id })).json()) as { link?: string; metadata?: DbxEntry };
  if (!j.link) throw new DropboxError('dbx-not-found', 404, 'no link');
  const m = j.metadata;
  return { url: j.link, name: m?.name ?? '', size: m?.size ?? 0, at: m?.server_modified ?? '' };
}

/* Back from Dropbox's page: the code becomes a refresh token, kept sealed with the account it's for. */
export async function connectDropbox(code: string, origin: string) {
  needSetUp();
  const j = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: dropboxRedirectUri(origin) });
  if (!j.refresh_token) throw new DropboxError('dbx-error', 502, 'no refresh token');
  let account: Saved['account'] = { id: j.account_id };
  try {
    const res = await fetch(`${API()}/2/users/get_current_account`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${j.access_token}`, 'content-type': 'application/json' },
      body: 'null',
    });
    if (res.ok) {
      const a = (await res.json()) as { account_id?: string; email?: string; name?: { display_name?: string } };
      account = { id: a.account_id ?? j.account_id, email: a.email, name: a.name?.display_name };
    }
  } catch {
    /* the account's name is only for the line under the notebooks */
  }
  try {
    await keep(ROW, { token: seal(j.refresh_token), account, connectedAt: new Date().toISOString() } satisfies Saved);
  } catch {
    throw new DropboxError('dbx-store', 503);
  }
  access = { token: j.access_token!, until: Date.now() + (j.expires_in ?? 14_400) * 1000, account };
}

export async function disconnectDropbox() {
  access = null;
  try {
    await forget(ROW);
  } catch {
    throw new DropboxError('dbx-store', 503);
  }
}
