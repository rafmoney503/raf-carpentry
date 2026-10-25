'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readPin } from './uploader';
import { post } from './sm8-post';
import { Icon } from './icons';
import { Band, Chips, dayLong, dur, Num, pageName, pct, PLACE_NOTE, problem, ShareRow, sourceName, whenWords } from './stats';
import { GOAL_LABEL, placeName, type Goal } from '@/lib/site-stats';
import { blogAdvice, cleanTitle, postRows, QUICK_SECONDS, quickLine, topicRows, type BlogPostMeta, type BlogReport, type PostRow } from '@/lib/blog-stats';

/* Blog stats in the Job Kit (Raf, 23 Oct 2026: "blog posts statistics, who read it, and what area, which blog post
   most popular, what should we focus on with more blog posts"). A band on Website stats (BlogBand) and its own screen
   (BlogStatsView): what to write next (src/lib/blog-stats.ts blogAdvice), every post with its reads, time, how far
   people read, how they found it, from where and whether they got in touch, the topics side by side, and the latest
   reads one by one. The last one is kept on the phone (raf_jobkit_blog) so it opens at once and with no signal.
   Quick opens (closed within QUICK_SECONDS) aren't reads: a line under the numbers says how many, posts with nothing
   but quick opens get their own short list, and in Who read them they show greyed with 'not counted'. */

const API = '/api/job-kit/stats';
const KEY = 'raf_jobkit_blog';
const DAYS = [7, 30, 90] as const;
type Saved = { days: number; blog: BlogReport | null; posts: BlogPostMeta[]; at: number };

function saved(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as Saved | null;
    return s && typeof s.at === 'number' ? s : null;
  } catch {
    return null;
  }
}
function keep(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked */
  }
}

/* Loads the blog's reads for `days` (the kept ones first). */
function useBlog(days: number) {
  const [data, setData] = useState<Saved | null>(() => saved());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError('');
    const r = await post<{ blog: BlogReport; posts: BlogPostMeta[]; at: number }>(readPin(), { action: 'blog', days: d }, API);
    setLoading(false);
    if (!r.ok) return setError(r.error);
    const s = { days: d, blog: r.data.blog, posts: r.data.posts, at: r.data.at };
    keep(s);
    setData(s);
  }, []);
  const first = useRef(days);
  useEffect(() => {
    void load(first.current);
  }, [load]);
  const fit = data && data.days === days ? data : null;
  return { data: fit, anyData: data, loading, error, load };
}

const SOURCE_WORDS = (k: string) => (k === 'direct' ? 'typed in or a saved link' : k === 'internal' ? 'from the site' : sourceName(k));
/* How a read began: 'From ChatGPT', 'From Google', 'After Five-door wardrobe, built in'. */
function arrived(came: string, title: (p: string) => string) {
  if (came.startsWith('src:')) {
    const k = came.slice(4);
    return k === 'direct' ? 'Typed in or a saved link' : k === 'internal' ? 'From the site' : `From ${sourceName(k)}`;
  }
  return came ? `After ${title(came)}` : 'From the site';
}
const shortDate = (d: string) =>
  d ? new Date(`${d}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.slice(0, 4) === new Date().getFullYear().toString() ? undefined : 'numeric' }) : '';

/* ---------- the band on Website stats ---------- */

export function BlogBand({ days, onOpen, onPage }: { days: number; onOpen: () => void; onPage: (path: string) => void }) {
  const { data, loading, load } = useBlog(days);
  const did = useRef(days);
  useEffect(() => {
    if (did.current !== days) {
      did.current = days;
      void load(days);
    }
  }, [days, load]);
  const rows = useMemo(() => postRows(data?.posts ?? [], data?.blog ?? null), [data]);
  const top = rows
    .filter((p) => p.s)
    .sort((a, b) => b.s!.reads - a.s!.reads || b.s!.engagedAvg - a.s!.engagedAvg)
    .slice(0, 3);
  const t = data?.blog?.totals;
  const next = useMemo(() => blogAdvice(rows, data?.blog ?? null).items[0], [rows, data]);
  return (
    <Band label="Blog" right={t ? `${t.reads} read${t.reads === 1 ? '' : 's'} in ${days} days` : loading ? 'checking…' : undefined}>
      {!data ? (
        <p className="py-2 font-mono text-[13px] text-faint">{loading ? 'Getting the blog’s reads…' : 'The blog’s reads didn’t load.'}</p>
      ) : (
        <>
          {t?.reads ? (
            <p className="text-[14.5px] leading-snug text-muted" data-blog-line>
              {t.posts} of {rows.length} posts read · {pct(t.finished, t.reads)} read to the end
              {t.entries ? ` · ${t.entries} found straight from Google, AI or a link` : ''}
            </p>
          ) : (
            <p className="py-1 text-[14.5px] text-muted">No posts read in these {days} days.</p>
          )}
          {top.length ? (
            <ul className="mt-1.5 divide-y divide-line" data-blog-top>
              {top.map((p) => (
                <li key={p.path}>
                  <button type="button" onClick={() => onPage(p.path)} className="flex w-full items-baseline gap-3 py-2 text-left">
                    <span className="min-w-0 flex-1 truncate text-[15px]">{p.title}</span>
                    <span className="shrink-0 font-mono text-[12.5px] text-muted">
                      {p.s!.reads} · {dur(p.s!.engagedAvg)}
                    </span>
                    <span aria-hidden className="shrink-0 text-accent">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {next ? (
            <p className="mt-2 rounded-sm border border-accent bg-accent-soft px-3 py-2 text-[14px] leading-snug" data-blog-next>
              <span className="font-semibold">Next:</span> {next.title}
            </p>
          ) : null}
        </>
      )}
      <button type="button" onClick={onOpen} className="btn btn-ghost btn-sm mt-3 h-auto min-h-11 w-full whitespace-normal py-2 leading-snug" data-open-blog>
        Blog stats: who read what, and what to write next →
      </button>
    </Band>
  );
}

/* ---------- the screen ---------- */

type Sort = 'reads' | 'time' | 'end' | 'found';

export function BlogStatsView({ onPage, startDays = 30 }: { onPage: (path: string) => void; startDays?: number }) {
  const [days, setDays] = useState<number>(() => saved()?.days ?? startDays);
  const { data, anyData, loading, error, load } = useBlog(days);
  const [sort, setSort] = useState<Sort>('reads');
  const [allReads, setAllReads] = useState(false);
  const [unread, setUnread] = useState(false);
  const r = data?.blog ?? null;
  const rows = useMemo(() => postRows(data?.posts ?? anyData?.posts ?? [], r), [data, anyData, r]);
  const advice = useMemo(() => blogAdvice(rows, r), [rows, r]);
  const topics = useMemo(() => topicRows(rows), [rows]);
  const read = useMemo(() => {
    const list = rows.filter((p) => p.s);
    const by: Record<Sort, (a: PostRow, b: PostRow) => number> = {
      reads: (a, b) => b.s!.reads - a.s!.reads || b.s!.engagedAvg - a.s!.engagedAvg,
      time: (a, b) => b.s!.engagedAvg - a.s!.engagedAvg || b.s!.reads - a.s!.reads,
      end: (a, b) => b.s!.finished / b.s!.reads - a.s!.finished / a.s!.reads || b.s!.scrollAvg - a.s!.scrollAvg,
      found: (a, b) => b.found - a.found || b.s!.reads - a.s!.reads,
    };
    return list.sort(by[sort]);
  }, [rows, sort]);
  const notRead = rows.filter((p) => !p.s && !p.quick);
  const quickOnly = rows.filter((p) => !p.s && p.quick).sort((a, b) => b.quick!.n - a.quick!.n);
  const quickNote = quickLine(r);
  const titleOf = useMemo(() => {
    const m = new Map(rows.map((p) => [p.path, p.title]));
    const names = r?.names ?? {};
    return (path: string) => m.get(path) ?? pageName(path, names[path]);
  }, [rows, r]);
  const t = r?.totals;
  const placesTotal = (r?.places ?? []).reduce((a, p) => a + p.n, 0);
  const latest = r?.latest ?? [];

  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="note" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Blog stats
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[13px] text-faint">
        <span>rafcarpentry.com/blog{data?.at ? `, ${new Date(data.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        <button type="button" onClick={() => void load(days)} className="h-9 text-accent underline" disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </p>
      <div className="mt-3">
        <Chips
          label="How many days"
          value={days}
          options={DAYS.map((d) => ({ v: d, t: `${d} days` }))}
          onPick={(d) => {
            setDays(d);
            void load(d);
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem(error)}
        </p>
      ) : null}

      {!r || !t ? (
        <p className="pt-10 text-center font-mono text-[14px] text-faint">{loading ? 'Getting the blog’s reads…' : ''}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" data-blog-nums>
            <Num v={String(t.reads)} label="Reads" sub={`${t.readers} reader${t.readers === 1 ? '' : 's'}`} />
            <Num v={String(t.posts)} label="Posts read" sub={`of ${rows.length}`} />
            <Num v={dur(t.engagedAvg)} label="Time on a post" sub="while reading" />
            <Num v={pct(t.finished, t.reads)} label="Read to the end" sub={`${t.finished} of ${t.reads}`} />
            <Num v={String(rows.reduce((a, p) => a + p.found, 0))} label="Found on Google or AI" sub="landed straight on a post" />
            <Num v={String(t.goals)} label="Got in touch after" sub="quote, WhatsApp, phone…" />
          </div>
          {quickNote ? (
            <p className="mt-2 text-[13.5px] leading-snug text-muted" data-quick-note>
              {quickNote}
            </p>
          ) : null}

          <section className="mt-6 rounded-sm border-2 border-accent bg-mount" data-advice>
            <h2 className="border-b border-accent/40 bg-accent-soft px-4 py-2.5 font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">What to write next</h2>
            <div className="px-4 py-3">
              {advice.early ? <p className="text-[13.5px] leading-snug text-muted">{advice.early}</p> : null}
              {advice.items.length ? (
                <ol className="mt-1 divide-y divide-line">
                  {advice.items.map((a, i) => (
                    <li key={a.kind} className="flex gap-3 py-3" data-advice-item={a.kind}>
                      <span className="font-display text-[22px] font-[680] leading-none text-accent">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-semibold leading-snug">{a.title}</span>
                        <span className="mt-1 block text-[14.5px] leading-snug text-muted">{a.why}</span>
                        {a.path ? (
                          <button type="button" onClick={() => onPage(a.path!)} className="mt-1 h-8 text-[14px] text-accent underline">
                            See how it’s read
                          </button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : t.reads ? (
                <p className="py-1 text-[14.5px] text-muted">Nothing stands out yet. Check again when more people have read the blog.</p>
              ) : null}
            </div>
          </section>

          <Band label="Posts" right={`${read.length} read`}>
            <Chips
              label="Order"
              value={sort}
              options={[
                { v: 'reads', t: 'Most read' },
                { v: 'time', t: 'Longest read' },
                { v: 'end', t: 'Read to the end' },
                { v: 'found', t: 'Found on Google / AI' },
              ]}
              onPick={setSort}
            />
            {read.length ? (
              <ul className="mt-2 divide-y divide-line" data-blog-posts>
                {read.map((p) => {
                  const s = p.s!;
                  const arrivals = s.from.filter((f) => f.from.startsWith('src:')).map((f) => `${SOURCE_WORDS(f.from.slice(4))} ${f.n}`);
                  const fromPages = s.from.filter((f) => !f.from.startsWith('src:')).reduce((a, f) => a + f.n, 0);
                  const places = s.places.filter((x) => x.city || x.district || x.country !== '?');
                  return (
                    <li key={p.path} data-blog-post={p.slug}>
                      <button type="button" onClick={() => onPage(p.path)} className="flex w-full items-center gap-3 py-3 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-[15.5px] font-semibold leading-snug">{p.title}</span>
                          <span className="mt-0.5 block font-mono text-[11.5px] text-faint">{[p.topic, p.format, shortDate(p.date)].filter(Boolean).join(' · ')}</span>
                          <span className="mt-1 block font-mono text-[12.5px] text-muted">
                            {s.reads} read{s.reads === 1 ? '' : 's'} · {dur(s.engagedAvg)} · read {Math.round(s.scrollAvg * 100)}%{s.finished ? ` · ${s.finished} to the end` : ''}
                            {p.quick ? ` · +${p.quick.n} quick open${p.quick.n === 1 ? '' : 's'}` : ''}
                          </span>
                          {arrivals.length || fromPages ? (
                            <span className="mt-0.5 block text-[13.5px] leading-snug">{[...arrivals, fromPages ? `from other pages ${fromPages}` : ''].filter(Boolean).join(' · ')}</span>
                          ) : null}
                          {places.length ? <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{places.map((x) => placeName(x)).join(' · ')}</span> : null}
                          {s.goals ? <span className="mt-1 inline-block rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-[11.5px] text-accent">{s.goals} got in touch after</span> : null}
                        </span>
                        <span aria-hidden className="text-[20px] text-accent">
                          →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">No posts read in these {days} days.</p>
            )}
            {quickOnly.length ? (
              <div className="mt-2 border-t border-line pt-3" data-quick-only>
                <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Opened, closed within {QUICK_SECONDS} seconds</p>
                <ul className="mt-1 divide-y divide-line">
                  {quickOnly.map((p) => {
                    const q = p.quick!;
                    const how = q.from.map((f) => (f.from.startsWith('src:') ? `${SOURCE_WORDS(f.from.slice(4))} ${f.n}` : `after ${titleOf(f.from)} ${f.n}`));
                    return (
                      <li key={p.path} data-quick-post={p.slug}>
                        <button type="button" onClick={() => onPage(p.path)} className="flex w-full items-center gap-3 py-2.5 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 block text-[15px] leading-snug text-muted">{p.title}</span>
                            <span className="mt-0.5 block font-mono text-[12px] text-faint">
                              {q.n} quick open{q.n === 1 ? '' : 's'}
                              {q.people && q.people !== q.n ? ` by ${q.people} ${q.people === 1 ? 'person' : 'people'}` : ''}
                              {how.length ? ` · ${how.join(' · ')}` : ''}
                            </span>
                          </span>
                          <span aria-hidden className="text-[20px] text-faint">
                            →
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-[13px] leading-relaxed text-faint">Not counted as reads, so they don’t steer what to write next.</p>
              </div>
            ) : null}
            {notRead.length ? (
              <>
                <button type="button" onClick={() => setUnread((v) => !v)} aria-expanded={unread} className="mt-1 h-10 text-[14px] font-semibold text-accent" data-unread-toggle>
                  {unread ? 'Hide' : 'Show'} the {notRead.length} not read in these {days} days
                </button>
                {unread ? (
                  <ul className="divide-y divide-line" data-unread>
                    {notRead.map((p) => (
                      <li key={p.path} className="py-2">
                        <a href={p.path} target="_blank" rel="noopener" className="block text-[14.5px] leading-snug text-ink underline decoration-line-strong">
                          {p.title}
                        </a>
                        <span className="font-mono text-[11.5px] text-faint">{[p.topic, p.format, shortDate(p.date)].filter(Boolean).join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
            <p className="mt-2 text-[13px] leading-relaxed text-faint">Tap a post for its heatmap: how far down they got, where the time went and what they tapped.</p>
          </Band>

          <Band label="By topic" right={`${topics.length} topics`}>
            <ul className="divide-y divide-line" data-topics>
              {topics.map((tp) => (
                <ShareRow
                  key={tp.topic}
                  label={tp.topic}
                  n={tp.reads}
                  of={Math.max(1, t.reads)}
                  note={`${tp.posts} post${tp.posts === 1 ? '' : 's'} · ${tp.posts ? (Math.round((tp.reads / tp.posts) * 10) / 10).toString() : '0'} a post${
                    tp.found ? ` · ${tp.found} from Google / AI` : ''
                  }${tp.time ? ` · ${dur(tp.time)} each` : ''}`}
                />
              ))}
            </ul>
            <p className="mt-2 text-[13px] leading-relaxed text-faint">
              A post’s topic is the job it tells the story of, or what its title is about. Reads a post is the fair way to compare a topic with 3 posts and one with 12.
            </p>
          </Band>

          <Band label="Who read them" right={latest.length ? 'newest first' : undefined}>
            {latest.length ? (
              <ul className="divide-y divide-line" data-blog-reads>
                {(allReads ? latest : latest.slice(0, 8)).map((x) => (
                  <li key={`${x.at}-${x.path}`} data-blog-read data-quick={x.quick ? '' : undefined} className={x.quick ? 'opacity-60' : undefined}>
                    <button type="button" onClick={() => onPage(x.path)} className="block w-full py-3 text-left">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[16px] font-semibold" data-place>
                          {placeName(x)}
                        </span>
                        <span className="shrink-0 font-mono text-[12.5px] text-muted">{whenWords(x.at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[14.5px] text-accent">{titleOf(x.path) || cleanTitle(x.title)}</span>
                      <span className="mt-0.5 block font-mono text-[12px] text-faint">
                        {x.device ?? 'screen not known'} · {arrived(x.came, titleOf)} ·{' '}
                        {x.quick
                          ? `closed within ${x.engaged >= 1000 ? dur(Math.round(x.engaged / 1000)) : 'a second'}, not counted`
                          : `${x.engaged >= 1000 ? dur(Math.round(x.engaged / 1000)) : 'under a second'}, read ${Math.round(x.scroll * 100)}%`}
                      </span>
                      <span className="mt-0.5 block text-[13.5px] text-muted">{x.next ? `Then: ${titleOf(x.next)}` : 'Then left the website'}</span>
                      {x.goals.length ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {x.goals.map((g) => (
                            <span key={g} className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-[11.5px] text-accent">
                              Tapped {GOAL_LABEL[g as Goal] ?? g}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">Nobody has read a post in these {days} days.</p>
            )}
            {latest.length > 8 ? (
              <button type="button" onClick={() => setAllReads((v) => !v)} className="mt-1 h-10 text-[14px] font-semibold text-accent">
                {allReads ? 'Show fewer' : `Show all ${latest.length}`}
              </button>
            ) : null}
          </Band>

          <Band label="Where readers are" right={placesTotal ? `${placesTotal} reads` : undefined}>
            {r.places.length ? (
              <ul className="divide-y divide-line" data-blog-places>
                {r.places.map((pl) => (
                  <ShareRow key={`${pl.country}-${pl.city ?? ''}`} label={placeName({ country: pl.country, city: pl.city }, { district: false })} n={pl.n} of={placesTotal} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">No reads yet.</p>
            )}
            <p className="mt-2 text-[13px] leading-relaxed text-faint">
              {r.placesFrom && r.placesFrom > r.since ? `Towns counted since ${dayLong(r.placesFrom)}. ` : ''}
              {PLACE_NOTE}
            </p>
          </Band>
          <p className="mt-4 text-[13px] leading-relaxed text-faint">
            A read is one person opening a post and staying at least {QUICK_SECONDS} seconds. Your own visits and robots aren’t counted.{' '}
            {t.index ? `The blog’s list page was opened ${t.index} time${t.index === 1 ? '' : 's'}.` : ''}
          </p>
        </>
      )}
    </div>
  );
}
