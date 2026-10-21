/* IndexNow (21 Oct 2026, Raf: being found by ChatGPT through Bing). Once a day Vercel's cron calls /api/indexnow:
   it reads the live sitemap, fetches every page, makes a fingerprint of what a search engine reads there (title,
   description, the words, the pictures; never scripts or styles), and tells IndexNow (Bing, and through it the other
   engines that share it; not Google) about the pages that are new or changed since they were last sent, plus any that
   left the sitemap. What was sent is kept in Supabase (rafsite.indexnow, public.rafsite_indexnow, the same secret as
   the visit counter), so the first run sends every page and later runs only what changed. The key is public by
   design: IndexNow checks it at https://www.rafcarpentry.com/<key>.txt (public/). */
import { createHash } from 'node:crypto';
import { SITE_URL } from './seo';
import { statsRpc, statsSetUp } from './site-stats-server';

export const INDEXNOW_KEY = '3e2f3206d1dcdbffc8a6b82fa9f88746';
const HOST = new URL(SITE_URL).host;
/* Overrides for tests: where IndexNow is, and where the pages are fetched from (the URLs sent stay www). */
const endpoint = () => process.env.INDEXNOW_API || 'https://api.indexnow.org/indexnow';
const fetchBase = () => (process.env.INDEXNOW_FETCH_BASE || SITE_URL).replace(/\/$/, '');
const UA = 'RafCarpentry-IndexNow/1.0 (+https://www.rafcarpentry.com)';

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, ' ');

/** What a search engine reads on the page, without the parts that change on every build. */
export function pageFingerprint(html: string) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  const desc = /<meta[^>]+name="description"[^>]*content="([^"]*)"/i.exec(html)?.[1] ?? '';
  const pics = [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((m) => {
      const tag = m[0];
      const alt = /\balt="([^"]*)"/i.exec(tag)?.[1] ?? '';
      const src = /\bsrc="([^"]*)"/i.exec(tag)?.[1] ?? '';
      // next/image addresses carry the size asked for; the picture itself is the url= part.
      const file = /[?&]url=([^&"]+)/.exec(src)?.[1] ?? src;
      let name = file;
      try {
        name = decodeURIComponent(file);
      } catch {
        /* keep it as it is */
      }
      return `${name}|${alt}`;
    })
    .join('\n');
  const words = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [decode(title), decode(desc), decode(words), decode(pics)].map((s) => s.replace(/\s+/g, ' ').trim()).join('\n');
}

export const fingerprintHash = (html: string) => createHash('sha256').update(pageFingerprint(html)).digest('hex').slice(0, 24);

/** The page addresses in the live sitemap. */
export async function sitemapUrls(): Promise<string[]> {
  const res = await fetch(`${fetchBase()}/sitemap.xml`, { cache: 'no-store', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decode(m[1]).trim());
  return [...new Set(urls.filter((u) => new URL(u).host === HOST))];
}

/** Fetches each page (6 at a time) and fingerprints it; a page that doesn't answer 200 is left for the next run. */
async function fingerprints(urls: string[]) {
  const pages: Record<string, string> = {};
  const failed: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const u = urls[next++];
      const { pathname, search } = new URL(u);
      try {
        const res = await fetch(`${fetchBase()}${pathname}${search}`, { cache: 'no-store', redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
        if (res.status !== 200) {
          failed.push(`${pathname} (${res.status})`);
          continue;
        }
        pages[u] = fingerprintHash(await res.text());
      } catch {
        failed.push(`${pathname} (no answer)`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { pages, failed };
}

/** Tells IndexNow about the URLs (one request takes up to 10,000). 200 = taken, 202 = taken, key still being checked. */
export async function submitIndexNow(urlList: string[]) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': UA },
    body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urlList.slice(0, 10000) }),
  }).catch(() => null);
  return { status: res ? res.status : 0, ok: !!res && (res.status === 200 || res.status === 202), detail: res && !res.ok ? (await res.text().catch(() => '')).slice(0, 300) : '' };
}

type Diff = { changed: string[]; gone: string[]; known: number; last: { at: string; checked: number; sent: number; status: number; note: string } | null };

export type IndexNowRun = {
  checked: number;
  failed: string[];
  changed: string[];
  gone: string[];
  sent: number;
  status: number | null;
  note: string;
  dry: boolean;
  last: Diff['last'];
};

/** One run. `all` sends every page that answered; `dry` works it all out but sends and keeps nothing. */
export async function runIndexNow({ all = false, dry = false } = {}): Promise<IndexNowRun> {
  if (!statsSetUp()) throw new Error('not-set-up');
  const listed = await sitemapUrls();
  const { pages, failed } = await fingerprints(listed);
  const diff = await statsRpc<Diff>('rafsite_indexnow', { p_action: 'diff', p: { pages, listed } });
  const changed = all ? Object.keys(pages).sort() : diff.changed;
  const gone = diff.gone.filter((u) => {
    try {
      return new URL(u).host === HOST;
    } catch {
      return false;
    }
  });
  const out: IndexNowRun = { checked: Object.keys(pages).length, failed, changed, gone, sent: 0, status: null, note: '', dry, last: diff.last };
  if (dry) return out;
  if (changed.length + gone.length === 0) {
    out.note = 'nothing new';
  } else {
    const r = await submitIndexNow([...changed, ...gone]);
    out.status = r.status;
    if (r.ok) {
      out.sent = changed.length + gone.length;
      const sentPages = Object.fromEntries(changed.map((u) => [u, pages[u]]));
      await statsRpc('rafsite_indexnow', { p_action: 'mark', p: { pages: sentPages, gone: diff.gone } });
      out.note = r.status === 202 ? 'taken, key still being checked' : 'taken';
    } else {
      out.note = r.status ? `IndexNow said ${r.status}${r.detail ? `: ${r.detail}` : ''}` : 'IndexNow did not answer';
    }
  }
  if (failed.length) out.note += `; ${failed.length} page(s) didn't answer: ${failed.slice(0, 5).join(', ')}`;
  await statsRpc('rafsite_indexnow', { p_action: 'run', p: { checked: out.checked, sent: out.sent, status: out.status ?? 0, note: out.note } }).catch(() => null);
  return out;
}
