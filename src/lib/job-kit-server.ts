import { createHash, timingSafeEqual } from 'crypto';

/* Server side of the Job Kit (/job-kit, Raf's phone app for photos, clips and notes from a job).
   Everything the phone sends goes into a private GitHub repo (JOBKIT_REPO, default rafmoney503/raf-job-inbox),
   one branch per job (job/<id>), as plain files under a folder named after the job. Claude reads that repo
   with git, so a job can be processed without Raf's Mac. The phone can only send files in; nothing here
   reads them back out, so the PIN only guards against junk uploads.

   Vercel settings: JOBKIT_GITHUB_TOKEN (fine-grained token, only that repo, Contents: read and write)
   and JOBKIT_PIN (what Raf types in the app once). Optional: JOBKIT_REPO, JOBKIT_GITHUB_API (tests). */

const API = (process.env.JOBKIT_GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
const REPO = process.env.JOBKIT_REPO || 'rafmoney503/raf-job-inbox';

/* Files arrive in pieces small enough for a Vercel function (4.5 MB request limit). */
export const MAX_PART = 4_200_000;

export const isSetUp = () => Boolean(process.env.JOBKIT_GITHUB_TOKEN && process.env.JOBKIT_PIN);

export function pinOk(given: string | null): boolean {
  const want = process.env.JOBKIT_PIN;
  if (!want || !given) return false;
  const a = createHash('sha256').update(given.trim()).digest();
  const b = createHash('sha256').update(want.trim()).digest();
  return timingSafeEqual(a, b);
}

/* A job id the app makes: "2026-10-alcove-wardrobes-east-finchley-k3f9". */
export const jobIdOk = (id: string | null): id is string => !!id && /^[a-z0-9][a-z0-9-]{4,90}$/.test(id);

/* A file inside the job folder: "finished/014-after-1.jpg", "clips/021-reveal.mov.part02of05", "job.json". */
export const filePathOk = (p: string | null): p is string =>
  !!p && /^([a-z0-9][a-z0-9_-]{0,40}\/)?[a-z0-9][a-z0-9._-]{0,100}$/.test(p) && !p.includes('..');

export class InboxError extends Error {
  constructor(public code: 'inbox-key' | 'inbox-missing' | 'busy' | 'inbox-error', public status: number, public retryAfter?: number) {
    super(code);
  }
}

async function gh(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${process.env.JOBKIT_GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'raf-job-kit',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  return res;
}

async function fail(res: Response): Promise<never> {
  const text = await res.text().catch(() => '');
  if (res.status === 401) throw new InboxError('inbox-key', 502);
  if (res.status === 429 || (res.status === 403 && /rate limit|abuse|secondary/i.test(text))) {
    const after = Number(res.headers.get('retry-after')) || 60;
    throw new InboxError('busy', 429, after);
  }
  if (res.status === 403 || res.status === 404) throw new InboxError('inbox-missing', 502);
  throw new InboxError('inbox-error', 502);
}

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');
const branchOf = (job: string) => `job/${job}`;

/* Branches this server instance has already seen, so most uploads need one GitHub call, not two. */
const known = new Set<string>();

async function ensureBranch(job: string) {
  const branch = branchOf(job);
  if (known.has(branch)) return branch;
  const have = await gh(`/repos/${REPO}/git/ref/heads/${enc(branch)}`);
  if (have.ok) {
    known.add(branch);
    return branch;
  }
  if (have.status !== 404) await fail(have);
  const repo = await gh(`/repos/${REPO}`);
  if (!repo.ok) await fail(repo);
  const main = ((await repo.json()) as { default_branch?: string }).default_branch || 'main';
  const head = await gh(`/repos/${REPO}/git/ref/heads/${enc(main)}`);
  if (!head.ok) await fail(head); // an empty repo has no branch: Raf ticks "Add a README" when making it
  const sha = ((await head.json()) as { object: { sha: string } }).object.sha;
  const made = await gh(`/repos/${REPO}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }) });
  if (!made.ok && made.status !== 422) await fail(made); // 422: made a moment ago by another upload
  known.add(branch);
  return branch;
}

async function existing(path: string, branch: string): Promise<{ sha: string; size: number } | null> {
  const res = await gh(`/repos/${REPO}/contents/${enc(path)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) await fail(res);
  const j = (await res.json()) as { sha: string; size: number };
  return { sha: j.sha, size: j.size };
}

/* Saves one file on the job's branch. Sending the same piece twice (the phone lost the answer) is fine:
   a file that is already there with the same size counts as sent; a changed one (job.json) is replaced. */
export async function saveFile(job: string, file: string, bytes: Buffer, message: string) {
  const branch = await ensureBranch(job);
  const path = `${job}/${file}`;
  const body = (sha?: string) => JSON.stringify({ message, content: bytes.toString('base64'), branch, ...(sha ? { sha } : {}) });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await gh(`/repos/${REPO}/contents/${enc(path)}`, { method: 'PUT', body: body() });
    if (res.ok) return;
    if (res.status >= 500) {
      // GitHub hiccup: try again here rather than make the phone wait.
      await new Promise((r) => setTimeout(r, 500 + attempt * 800));
      continue;
    }
    if (res.status === 422 || res.status === 409) {
      // 422: already there (needs its sha to replace). 409: the branch moved under us; try again.
      const old = await existing(path, branch);
      if (old && old.size === bytes.length && !file.endsWith('.json') && !file.endsWith('.txt')) return;
      if (old) {
        const again = await gh(`/repos/${REPO}/contents/${enc(path)}`, { method: 'PUT', body: body(old.sha) });
        if (again.ok) return;
        if (again.status !== 409 && again.status !== 422) await fail(again);
      }
      await new Promise((r) => setTimeout(r, 400 + attempt * 600));
      continue;
    }
    await fail(res);
  }
  throw new InboxError('inbox-error', 502);
}

/* For the app's "Check" button: is the inbox there and can the key write to it? */
export async function checkInbox() {
  const res = await gh(`/repos/${REPO}`);
  if (!res.ok) await fail(res);
  const j = (await res.json()) as { private?: boolean; permissions?: { push?: boolean } };
  return { private: j.private !== false, canWrite: j.permissions?.push !== false };
}

/* Shared answers for the routes. */
export function answer(e: unknown) {
  if (e instanceof InboxError) {
    return Response.json({ error: e.code, retryAfter: e.retryAfter }, { status: e.status, headers: e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : undefined });
  }
  console.error('job-kit', e);
  return Response.json({ error: 'inbox-error' }, { status: 502 });
}

/* Setup and PIN checks every route starts with. A wrong PIN waits a moment, so guessing is slow. */
export async function guard(req: Request): Promise<Response | null> {
  if (!isSetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  if (!pinOk(req.headers.get('x-job-kit-pin'))) {
    await new Promise((r) => setTimeout(r, 700));
    return Response.json({ error: 'wrong-pin' }, { status: 401 });
  }
  return null;
}
