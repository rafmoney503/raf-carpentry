'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NearJob } from '@/lib/areas';

/* Jobs near you (home page, under Latest jobs): the visitor types a postcode (or the first half, like N22) or
   taps Use my location, and sees the jobs nearest to them with rough miles. The postcode is looked up from their
   browser with postcodes.io (free, ONS data, the same service as the brief's address finder) and is not kept.
   Miles are measured to the rough middle of each job's area (content/pages/areas.json), never to a house. */

const API = 'https://api.postcodes.io';
const FULL = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/;
const OUT = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const NEAR_MILES = 3;
const FIRST_ROWS = 6;
const BAR_ROWS = 8; // `bars`: the busiest areas as bars, the rest as chips under them

type Origin = { lat: number; lng: number; label: string };
type Problem = 'format' | 'notfound' | 'network' | 'location';

const PROBLEM: Record<Problem, string> = {
  format: 'That doesn’t look like a UK postcode. Try the first half, like N22.',
  notfound: 'I can’t find that postcode. Check it, or try just the first half, like N22.',
  network: 'The postcode finder isn’t answering. Try again in a minute.',
  location: 'Your phone didn’t share where you are. Type your postcode instead.',
};

function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

const showMiles = (d: number) => (d < 0.3 ? 'here' : d < 10 ? `${d.toFixed(1)} mi` : `${Math.round(d)} mi`);

class LookupError extends Error {
  constructor(public kind: Problem) {
    super(kind);
  }
}

async function getJson(url: string) {
  let r: Response;
  try {
    r = await fetch(url);
  } catch {
    throw new LookupError('network');
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new LookupError('network');
  return r.json();
}

async function lookup(typed: string): Promise<Origin> {
  const t = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const full = t.match(FULL);
  if (full) {
    const j = await getJson(`${API}/postcodes/${full[1]}${full[2]}`);
    if (j?.result?.latitude != null) return { lat: j.result.latitude, lng: j.result.longitude, label: j.result.postcode };
  }
  const out = full ? full[1] : t;
  if (!OUT.test(out)) throw new LookupError('format');
  const j = await getJson(`${API}/outcodes/${out}`);
  if (j?.result?.latitude == null) throw new LookupError('notfound');
  return { lat: j.result.latitude, lng: j.result.longitude, label: j.result.outcode };
}

type Row = { area: string; jobs: NearJob[]; d: number };

/* areaLinks: area name -> its page slug (/areas/<slug>), for the areas that have one; others go to My Work's search.
   heading: h3 under Latest jobs on the home page, h2 on its own on /areas.
   bars (home page): Where the jobs are shows the busiest areas as blue bars that grow out one after another as
   they scroll into view (and again each time they come back after going right off screen); drawn full before
   the script runs and with reduced motion (home-motion.css .jn-bar). */
export default function JobsNear({ jobs, areaLinks = {}, heading = 'h3', bars = false }: { jobs: NearJob[]; areaLinks?: Record<string, string>; heading?: 'h2' | 'h3'; bars?: boolean }) {
  // An area's own page; else its one job; else My Work's search for it.
  const areaHref = (a: string) => {
    if (areaLinks[a]) return `/areas/${areaLinks[a]}`;
    const its = jobs.filter((j) => j.area === a);
    return its.length === 1 ? `/portfolio/${its[0].slug}` : `/portfolio?q=${encodeURIComponent(a)}`;
  };
  const H = heading;
  const [typed, setTyped] = useState('');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [all, setAll] = useState(false);

  // Areas with how many jobs, for the view before a postcode is typed.
  const areas = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) m.set(j.area, (m.get(j.area) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  const rows = useMemo<Row[]>(() => {
    if (!origin) return [];
    const m = new Map<string, Row>();
    for (const j of jobs) {
      const r = m.get(j.area) ?? { area: j.area, jobs: [], d: miles(origin, j) };
      r.jobs.push(j); // jobs come newest first, so jobs[0] is the area's newest
      m.set(j.area, r);
    }
    return [...m.values()].sort((a, b) => a.d - b.d);
  }, [origin, jobs]);

  const near = rows.filter((r) => r.d <= NEAR_MILES).reduce((n, r) => n + r.jobs.length, 0);

  const barsRef = useRef<HTMLUListElement>(null);
  const [grow, setGrow] = useState<'yes' | 'no' | undefined>(undefined);
  const listShown = !origin;
  useEffect(() => {
    const el = barsRef.current;
    if (!bars || !listShown || !el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let first = true;
    const io = new IntersectionObserver(
      ([e]) => {
        if (first) {
          first = false;
          if (e.intersectionRatio < 0.3) setGrow('no');
          return;
        }
        if (e.intersectionRatio >= 0.3) setGrow('yes');
        else if (!e.isIntersecting) setGrow('no');
      },
      { threshold: [0, 0.3] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [bars, listShown]);

  const find = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!typed.trim()) return setProblem('format');
    setBusy(true);
    setProblem(null);
    try {
      setOrigin(await lookup(typed));
      setAll(false);
    } catch (err) {
      setProblem(err instanceof LookupError ? err.kind : 'network');
    } finally {
      setBusy(false);
    }
  };

  const here = () => {
    if (!navigator.geolocation) return setProblem('location');
    setBusy(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let label = 'you';
        try {
          const j = await getJson(`${API}/postcodes?lon=${lng}&lat=${lat}&limit=1`);
          if (j?.result?.[0]?.outcode) label = j.result[0].outcode;
        } catch {
          /* the miles still work without the name */
        }
        setOrigin({ lat, lng, label });
        setTyped(label === 'you' ? '' : label);
        setAll(false);
        setBusy(false);
      },
      () => {
        setProblem('location');
        setBusy(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  if (!jobs.length) return null;
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  const nearest = rows[0];

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-6" id="near">
      <div className="md:col-span-5">
        <H className="font-display text-[30px] font-[680] leading-[1.05] tracking-[-0.02em] md:text-[34px]">Jobs near you</H>
        <p className="mt-2.5 max-w-[40ch] text-[16px] leading-relaxed text-muted">Type your postcode to see what I’ve built round the corner.</p>
        <form onSubmit={find} className="mt-5 flex max-w-[420px] gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Your postcode</span>
            <input
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value.toUpperCase().slice(0, 9));
                setProblem(null);
              }}
              placeholder="N22 or N22 5SN"
              autoComplete="postal-code"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="search"
              aria-invalid={problem === 'format' || problem === 'notfound' ? true : undefined}
              aria-describedby="near-note"
              className="h-[50px] w-full rounded-sm border-2 border-line-strong bg-white px-3.5 font-mono text-[17px] uppercase text-ink placeholder:normal-case placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </label>
          <button type="submit" disabled={busy} className="btn btn-primary h-[50px] px-5 disabled:opacity-70">
            {busy ? 'Finding' : 'Find'}
          </button>
        </form>
        <button type="button" onClick={here} disabled={busy} className="mt-2 inline-flex h-10 items-center gap-2 text-[15px] font-semibold text-accent hover:text-accent-hover disabled:opacity-70">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="5" />
            <circle cx="8" cy="8" r="1.6" fill="currentColor" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
          </svg>
          Use my location
        </button>
        <p id="near-note" className={`mt-2 text-[13.5px] leading-snug ${problem ? 'font-medium text-accent' : 'text-faint'}`} role={problem ? 'alert' : undefined}>
          {problem ? PROBLEM[problem] : 'Looked up with postcodes.io and not saved.'}
        </p>
      </div>

      <div className="md:col-span-7" aria-live="polite">
        {origin && nearest ? (
          <>
            <p className="rounded-sm bg-accent-soft px-3.5 py-3 text-[15.5px] leading-snug text-ink">
              {near ? (
                <>
                  <strong className="font-[650]">
                    {near} {near === 1 ? 'job' : 'jobs'} within {NEAR_MILES} miles
                  </strong>{' '}
                  of {origin.label}, the nearest in {nearest.area}.
                </>
              ) : (
                <>
                  <strong className="font-[650]">No jobs within {NEAR_MILES} miles</strong> of {origin.label} yet. The nearest is in {nearest.area}, {showMiles(nearest.d)} away.
                </>
              )}
            </p>
            <ul className="mt-4 grid gap-3 lg:grid-cols-2 lg:gap-x-6">
              {shown.map((r) => {
                const j = r.jobs[0];
                const more = r.jobs.length - 1;
                return (
                  <li key={r.area} className="flex items-center gap-3">
                    <Link href={`/portfolio/${j.slug}`} tabIndex={-1} aria-hidden="true" className="relative h-[58px] w-[58px] flex-none overflow-hidden border border-line bg-raised">
                      <Image src={j.img} alt="" fill sizes="58px" className="object-cover" />
                    </Link>
                    <span className="min-w-0 flex-1">
                      <Link href={`/portfolio/${j.slug}`} className="line-clamp-2 block text-[15px] font-[620] leading-snug text-ink hover:text-accent">
                        {j.title}
                      </Link>
                      <span className="mt-0.5 block font-mono text-[12px] text-faint">
                        {r.area}
                        {more ? (
                          <>
                            {' · '}
                            <Link href={areaHref(r.area)} className="text-accent hover:underline">
                              and {more} more there
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <span className="flex-none whitespace-nowrap font-mono text-[13px] text-accent">{showMiles(r.d)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {rows.length > FIRST_ROWS ? (
                <button type="button" onClick={() => setAll((v) => !v)} className="link-more text-[15px]">
                  {all ? 'Show fewer' : `Show all ${rows.length} areas`}
                </button>
              ) : null}
              <p className="font-mono text-[12.5px] text-faint">Miles are to the middle of each area, not the house.</p>
            </div>
          </>
        ) : (
          <>
            <p className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">Where the jobs are</p>
            {bars ? (
              <ul ref={barsRef} data-grow={grow} className="jn-bars mt-4 grid gap-2.5">
                {areas.slice(0, BAR_ROWS).map(([a, n], i) => (
                  <li key={a}>
                    <Link href={areaHref(a)} className="grid grid-cols-[112px_minmax(0,1fr)_24px] items-center gap-2.5 text-[15px] text-ink hover:text-accent md:grid-cols-[150px_minmax(0,1fr)_28px] md:gap-3.5">
                      <span className="truncate">{a}</span>
                      <span className="jn-bar" aria-hidden="true">
                        <i style={{ '--f': n / (areas[0]?.[1] || 1), '--i': i } as React.CSSProperties} />
                      </span>
                      <span className="text-right font-mono text-[13px] text-muted">
                        {n}
                        <span className="sr-only">{n === 1 ? ' job' : ' jobs'}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {!bars || areas.length > BAR_ROWS ? (
              <ul className={`flex flex-wrap gap-2 ${bars ? 'mt-5' : 'mt-3'}`}>
                {(bars ? areas.slice(BAR_ROWS) : areas).map(([a, n]) => (
                  <li key={a}>
                    <Link href={areaHref(a)} className={`inline-flex h-10 items-center gap-2 rounded-sm border px-3.5 text-[14.5px] text-ink transition-colors hover:border-ink ${areaLinks[a] ? 'border-accent/50 bg-mount' : 'border-line-strong'}`}>
                      {a}
                      <span className="font-mono text-[12px] text-faint">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
