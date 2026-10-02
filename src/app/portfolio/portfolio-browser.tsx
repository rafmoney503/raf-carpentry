'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Container, SectionHeading } from '@/components/ui';

export type JobCard = {
  slug: string;
  title: string;
  area: string;
  month: string;
  summary: string;
  cover: { src: string; alt: string };
  tags: string[];
  meta: string;
  searchText: string;
};
export type ArchiveCard = { title: string; description: string; category: string; image: string };

/* Turn a typed word into something that matches plurals and near spellings:
   "wardrobe" finds "wardrobes", "shelves" finds "shelving", "cupboard" finds "cupboards". */
function stem(word: string) {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (w.startsWith('shel')) return 'shel';
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ves')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function matches(text: string, query: string) {
  const words = query.split(/\s+/).map(stem).filter(Boolean);
  if (words.length === 0) return true;
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export default function PortfolioBrowser({ jobs, archive, chips }: { jobs: JobCard[]; archive: ArchiveCard[]; chips: string[] }) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // Read ?q= on load and keep it in the address bar, so a filtered list can be shared.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url.toString());
  }, [query]);

  const shownJobs = useMemo(() => jobs.filter((j) => matches(j.searchText, query)), [jobs, query]);
  const shownArchive = useMemo(
    () => archive.filter((a) => matches(`${a.title} ${a.description} ${a.category}`, query)),
    [archive, query],
  );
  const active = query.trim().toLowerCase();
  const total = shownJobs.length + shownArchive.length;

  return (
    <>
      <Container className="pb-10 md:pb-14">
        <div role="search">
          <label htmlFor="job-search" className="sr-only">Search my jobs</label>
          <div className="relative max-w-[720px]">
            <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <circle cx="7.8" cy="7.8" r="5.6" />
              <path d="M12 12l4 4" />
            </svg>
            <input
              ref={input}
              id="job-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: wardrobe, MDF, IKEA, Finchley..."
              autoComplete="off"
              className="h-13 w-full rounded-sm border border-line-strong bg-mount pl-12 pr-12 text-[16px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  input.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" /></svg>
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick filters">
            {chips.map((c) => {
              const on = active === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setQuery(on ? '' : c)}
                  className="h-10 rounded-sm border border-line-strong px-4 text-[14.5px] font-medium text-ink transition-colors hover:border-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
                >
                  {c}
                </button>
              );
            })}
          </div>

          <p className="mt-5 font-mono text-[13px] text-faint" aria-live="polite">
            {query.trim()
              ? total === 0
                ? `Nothing matches "${query.trim()}".`
                : `${total} ${total === 1 ? 'job matches' : 'jobs match'} "${query.trim()}"`
              : `${jobs.length + archive.length} jobs`}
          </p>
        </div>
      </Container>

      <Container className="pb-20 md:pb-28">
        {shownJobs.length > 0 ? (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {shownJobs.map((p, i) => (
              <li key={p.slug}>
                <Link href={`/portfolio/${p.slug}`} className="group block">
                  <div className="mount transition-colors group-hover:border-accent">
                    <div className="relative aspect-[3/4] overflow-hidden bg-raised">
                      <Image
                        src={p.cover.src}
                        alt={p.cover.alt}
                        fill
                        priority={i < 2}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                    </div>
                  </div>
                  <p className="mt-5 font-mono text-[13px] text-faint">
                    {p.area}, {p.month}
                  </p>
                  <h2 className="mt-1.5 text-[21px] font-[620] leading-tight transition-colors group-hover:text-accent">{p.title}</h2>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{p.summary}</p>
                  <p className="mt-3 font-mono text-[13px] text-ink">{p.meta}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : total === 0 ? (
          <div className="border-t border-line pt-8">
            <p className="text-[17px] text-muted">
              No jobs match that yet. Try{' '}
              {['wardrobe', 'MDF', 'IKEA'].map((w, i) => (
                <span key={w}>
                  <button type="button" onClick={() => setQuery(w)} className="font-medium text-accent hover:underline">{w}</button>
                  {i < 2 ? ', ' : ''}
                </span>
              ))}
              , or{' '}
              <button type="button" onClick={() => setQuery('')} className="font-medium text-accent hover:underline">show everything</button>.
            </p>
          </div>
        ) : null}
      </Container>

      {shownArchive.length > 0 ? (
        <section className="border-t border-line">
          <Container className="py-16 md:py-24">
            <SectionHeading>Earlier work</SectionHeading>
            <p className="mt-4 max-w-[56ch] text-muted">Jobs from before I started photographing every build.</p>
            <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {shownArchive.map((x) => (
                <li key={x.title}>
                  <div className="mount p-1.5">
                    <div className="relative aspect-[4/5] overflow-hidden bg-raised">
                      <Image src={x.image} alt={x.title} fill sizes="(max-width: 768px) 50vw, 300px" className="object-cover" />
                    </div>
                  </div>
                  <p className="mt-4 font-mono text-[12.5px] text-faint">{x.category}</p>
                  <h3 className="mt-1 text-[17px] font-[620] leading-snug">{x.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{x.description}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </>
  );
}
