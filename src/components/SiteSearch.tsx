'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { stem } from '@/lib/search';
import { whatsappUrl } from '@/lib/site';
import type { SearchEntry, SearchKind } from '@/lib/site-search';

/* Search everything from the menu: jobs, blog posts, services, 3D designs, pages, tips, tools, materials, questions
   and the brief's choices. The list (/search-index.json, src/lib/site-search.ts) loads the first time search
   opens and is searched here in the browser with the same word matching as My Work. 'panel' is the computer
   version under the header (three columns); 'menu' sits at the top of the phone menu (one column). */

let indexPromise: Promise<SearchEntry[]> | null = null;
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('/search-index.json')
      .then((r) => (r.ok ? (r.json() as Promise<SearchEntry[]>) : Promise.reject(new Error(String(r.status)))))
      .catch((e) => {
        indexPromise = null;
        throw e;
      });
  }
  return indexPromise;
}

const KIND_LABEL: Record<SearchKind, string> = {
  job: 'Job',
  post: 'Blog',
  service: 'Service',
  design: '3D designs',
  page: 'Page',
  tip: 'Workshop tip',
  tool: 'Tools I use',
  material: 'Materials',
  faq: 'Questions',
  brief: 'Plan your project',
};
// Order in the "Also" column: what most visitors want first.
const ALSO_ORDER: SearchKind[] = ['service', 'design', 'page', 'material', 'faq', 'tip', 'tool', 'brief'];

const SUGGEST = ['Wardrobe', 'Alcove', 'Boiler', 'Window seat', 'Birch ply', 'IKEA PAX', 'Finchley'];

type Hit = SearchEntry & { inTitle: boolean; inSub: boolean; tag?: string };

function run(index: SearchEntry[], query: string) {
  const stems = query.split(/\s+/).map(stem).filter(Boolean);
  if (!stems.length) return null;
  const has = (s: string) => stems.every((w) => s.includes(w));
  const hits: Hit[] = [];
  for (const e of index) {
    const title = e.title.toLowerCase();
    const hay = `${e.k === 'brief' ? '' : title} ${e.text}`;
    if (!has(hay)) continue;
    hits.push({ ...e, inTitle: e.k !== 'brief' && has(title), inSub: has((e.sub ?? '').toLowerCase()), tag: e.tags?.find((t) => has(t.toLowerCase())) });
  }
  const byTitle = (a: Hit, b: Hit) => Number(b.inTitle) - Number(a.inTitle);
  const jobs = hits.filter((h) => h.k === 'job').sort(byTitle);
  const posts = hits.filter((h) => h.k === 'post').sort(byTitle);
  const rank = (h: Hit) => ALSO_ORDER.indexOf(h.k) + (h.inTitle || h.tag ? 0 : 10);
  const also = hits.filter((h) => h.k !== 'job' && h.k !== 'post').sort((a, b) => rank(a) - rank(b));
  return { stems, jobs, posts, also, total: hits.length };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* The typed words in blue-grey wherever they start a word. */
function Hl({ text, stems }: { text: string; stems: string[] }) {
  if (!stems.length) return <>{text}</>;
  const re = new RegExp(`\\b(?:${stems.map(esc).join('|')})[a-z0-9]*`, 'gi');
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <mark key={at} className="rounded-[2px] bg-accent/15 px-0.5 text-inherit">
        {m[0]}
      </mark>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function Group({ title, count, children, className = '' }: { title: string; count: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">
        {title} · {count}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function SiteSearch({
  layout,
  onPick,
  onActive,
  autoFocus = false,
}: {
  layout: 'panel' | 'menu';
  onPick?: () => void;
  onActive?: (active: boolean) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const load = () => {
    setFailed(false);
    loadIndex().then(setIndex, () => setFailed(true));
  };
  useEffect(() => {
    load();
    if (autoFocus) input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => onActive?.(Boolean(query.trim())), [query, onActive]);

  const res = useMemo(() => (index ? run(index, query) : null), [index, query]);
  const panel = layout === 'panel';
  // Enter opens the best match: a page, service or 3D kind named by the words, then a job or post named by them, then the first result.
  const first = res
    ? [
        ...res.also.filter((h) => h.inTitle && (h.k === 'page' || h.k === 'service' || h.k === 'design')),
        ...res.jobs.filter((h) => h.inTitle),
        ...res.posts.filter((h) => h.inTitle),
        ...res.jobs,
        ...res.posts,
        ...res.also,
      ][0]
    : undefined;
  const pick = () => onPick?.();
  const q = query.trim();

  const jobList = (n: number) =>
    res!.jobs.slice(0, n).map((h) => (
      <Link key={h.href} href={h.href} onClick={pick} className="group flex items-center gap-3 rounded-sm py-1.5 text-ink">
        {h.img ? (
          <span className={`relative flex-none overflow-hidden border border-line bg-raised ${panel ? 'h-[72px] w-[72px]' : 'h-14 w-14'}`}>
            <Image src={h.img} alt="" fill sizes={panel ? '72px' : '56px'} className="object-cover" />
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="line-clamp-2 block text-[15.5px] font-[620] leading-snug group-hover:text-accent">
            <Hl text={h.title} stems={res!.stems} />
          </span>
          <span className="mt-0.5 block font-mono text-[12.5px] text-faint">
            <Hl text={h.sub ?? ''} stems={res!.stems} />
            {h.inTitle || h.inSub ? '' : ` · the write-up mentions “${q}”`}
          </span>
        </span>
      </Link>
    ));

  const postList = (n: number) => (
    <ul className="grid gap-2.5">
      {res!.posts.slice(0, n).map((h) => (
        <li key={h.href}>
          <Link href={h.href} onClick={pick} className="block text-[15.5px] leading-snug text-ink hover:text-accent">
            <Hl text={h.title} stems={res!.stems} />
          </Link>
        </li>
      ))}
    </ul>
  );

  const alsoList = (n: number) => (
    <div className="grid gap-2.5">
      {res!.also.slice(0, n).map((h) => (
        <Link key={h.href} href={h.href} onClick={pick} className="block rounded-sm border border-line-strong bg-paper px-3.5 py-2.5 text-ink transition-colors hover:border-accent">
          <span className="block font-mono text-[12px] text-accent">{KIND_LABEL[h.k]}</span>
          <span className="mt-0.5 block text-[15px] font-[620] leading-snug">
            <Hl text={h.title} stems={res!.stems} />
          </span>
          {h.tag ? (
            <span className="mt-0.5 block text-[14px] text-muted">
              # <Hl text={h.tag} stems={res!.stems} />
            </span>
          ) : h.sub && (h.k === 'service' || h.k === 'design' || h.k === 'page') ? (
            <span className="mt-0.5 block text-[14px] text-muted">{h.sub}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );

  return (
    <div role="search">
      <label className={`flex items-center gap-3 rounded-sm border-2 bg-white px-4 ${panel ? 'h-14 border-accent' : 'h-12 border-line-strong focus-within:border-accent'}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="flex-none text-faint">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5L21 21" />
        </svg>
        <span className="sr-only">Search the website</span>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 80))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && first) {
              e.preventDefault();
              router.push(first.href);
              pick();
            }
          }}
          placeholder={panel ? 'Search jobs, blog, services, tips...' : 'Search the website'}
          autoComplete="off"
          enterKeyHint="go"
          style={{ outline: 'none' }} /* the box's border shows focus instead of the page-wide ring */
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-faint [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none ${panel ? 'text-[19px]' : 'text-[16px]'}`}
        />
        {panel ? (
          <span className="hidden flex-none font-mono text-[12.5px] text-faint sm:inline" aria-live="polite">
            {res ? `${res.total} ${res.total === 1 ? 'result' : 'results'} · ` : ''}Esc to close
          </span>
        ) : q ? (
          <button type="button" onClick={() => { setQuery(''); input.current?.focus(); }} aria-label="Clear search" className="-mr-2 inline-flex h-10 w-10 flex-none items-center justify-center text-muted">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        ) : null}
      </label>

      {!q ? (
        <div className={`flex flex-wrap items-center gap-2 ${panel ? 'mt-4' : 'mt-3'}`}>
          <span className="mr-1 font-mono text-[12.5px] text-faint">Try</span>
          {SUGGEST.map((w) => (
            <button key={w} type="button" onClick={() => { setQuery(w); input.current?.focus(); }} className="h-9 rounded-sm border border-line-strong px-3 text-[14px] text-ink transition-colors hover:border-ink">
              {w}
            </button>
          ))}
        </div>
      ) : failed ? (
        <p className="mt-4 text-[15px] text-muted">
          Search didn’t load.{' '}
          <button type="button" onClick={load} className="font-medium text-accent hover:underline">Try again</button>
        </p>
      ) : !res ? (
        <p className="mt-4 font-mono text-[13px] text-faint">Loading...</p>
      ) : res.total === 0 ? (
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Nothing for “{q}”. Try a simpler word, or{' '}
          <a href={whatsappUrl(`Hi Raf, I was looking on your website for: ${q}`)} target="_blank" rel="noopener" className="font-medium text-accent hover:underline">ask me on WhatsApp</a>.
        </p>
      ) : panel ? (
        <div className="mt-6 grid grid-cols-[1.25fr_1fr_0.95fr] gap-10">
          <Group title="Jobs" count={res.jobs.length}>
            {res.jobs.length ? <div className="grid gap-2">{jobList(4)}</div> : <p className="text-[14.5px] text-faint">No jobs with that word.</p>}
            {res.jobs.length > 4 ? (
              <Link href={`/portfolio?q=${encodeURIComponent(q)}`} onClick={pick} className="link-more mt-3 text-[15px]">
                All {res.jobs.length} jobs <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </Group>
          <Group title="Blog" count={res.posts.length}>
            {res.posts.length ? postList(6) : <p className="text-[14.5px] text-faint">No posts with that word.</p>}
          </Group>
          <Group title="Also" count={res.also.length}>
            {res.also.length ? alsoList(4) : <p className="text-[14.5px] text-faint">Nothing else.</p>}
          </Group>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 pb-2">
          {res.jobs.length ? (
            <Group title="Jobs" count={res.jobs.length}>
              <div className="grid gap-1.5">{jobList(4)}</div>
              {res.jobs.length > 4 ? (
                <Link href={`/portfolio?q=${encodeURIComponent(q)}`} onClick={pick} className="link-more mt-2 text-[15px]">
                  All {res.jobs.length} jobs <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </Group>
          ) : null}
          {res.posts.length ? <Group title="Blog" count={res.posts.length}>{postList(4)}</Group> : null}
          {res.also.length ? <Group title="Also" count={res.also.length}>{alsoList(4)}</Group> : null}
        </div>
      )}
    </div>
  );
}
