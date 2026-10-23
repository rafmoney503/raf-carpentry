'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readPin } from './uploader';
import { post } from './sm8-post';
import { Icon } from './icons';
import { BlogBand } from './blog-stats-view';
import { GOAL_LABEL, SOURCE_LABEL, placeName, statsOff, type Device, type Goal, type StatsPage, type StatsReport, type Tap, type Visit } from '@/lib/site-stats';

/* The Job Kit's Website stats screen: the website's own visitor counter (src/components/SiteStats.tsx), read through
   /api/job-kit/stats behind the PIN. The overview (numbers, visits by day, where people come from, the ways to get in
   touch they tapped, pages, the usual routes through the site) and one page in detail, with the real page shown at
   phone, tablet or computer size and three layers over it: Taps (a heatmap of what was tapped), How far (how many
   got down to each part) and Time (where on the page the time went). Drag the page (or use the map beside it) to
   scroll it. The last overview is kept on the phone (raf_jobkit_stats) so the Today screen can show a line.
   Since 22 Oct 2026 (Raf: 'can I have this data in jobkit telling from which area someone looked at something'): Latest
   visits (each visit: roughly where from, when, phone or computer, where it came from, the pages in order with the time
   on each, what they tapped), Where they are (towns, with the London postcode areas) and, on a page, who looked at it
   from where. The place is the connection's (Vercel's lookup), so it's rough: see PLACE_NOTE. */

const API = '/api/job-kit/stats';
const KEY = 'raf_jobkit_stats';
const DAYS = [7, 30, 90] as const;

/** Who asked for the wardrobe planner's cut list (/api/cutlist-request; rafsite_cutlist 'list'). */
type CutlistInfo = {
  days: number;
  total: number;
  all: number;
  /** Emailed by CabinetOS in the days asked for (since 22 Oct 2026; older reports don't have it). */
  sent?: number;
  recent: { id: number; at: string; email: string; summary: string; country: string | null; host: string | null; sent_at: string | null; parts?: number | null; boards?: number | null }[];
};
type Saved = { days: number; report: StatsReport | null; at: number; cutlist?: CutlistInfo | null };

export function savedStats(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as Saved | null;
    if (s && typeof s.at === 'number') return s;
  } catch {
    /* none kept */
  }
  return { days: 7, report: null, at: 0 };
}
function keep(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked */
  }
}

/* The line under 'Website stats' on the Today screen. */
export function statsLine(s: Saved = savedStats()) {
  const r = s.report;
  if (!r) return 'Visitors, pages and heatmaps of rafcarpentry.com';
  const t = r.totals;
  if (!t.visits) return `No visitors counted in the last ${r.days} days yet`;
  const asked = s.cutlist?.total ? ` · ${s.cutlist.total} asked for a cut list` : '';
  return `${t.visitors} visitor${t.visitors === 1 ? '' : 's'} in the last ${r.days} days, ${pct(t.phone, t.visits)} on a phone${asked}`;
}

export const problem = (e: string) =>
  e === 'stats-not-set-up'
    ? 'The stats aren’t connected yet: RAFSTATS_URL, RAFSTATS_KEY and RAFSTATS_SECRET are missing in Vercel.'
    : e === 'stats-key'
      ? 'The stats database turned the key down. Check RAFSTATS_KEY and RAFSTATS_SECRET in Vercel.'
      : e === 'offline'
        ? 'No signal. These are the last numbers on this phone.'
        : e === 'wrong-pin'
          ? 'Wrong PIN. Check it in Settings.'
          : e === 'no-pin'
            ? 'Add your PIN first (Settings).'
            : 'The stats didn’t load. Try Refresh in a minute.';

/* ---------- small helpers ---------- */

export function pct(n: number, of: number) {
  if (!of) return '0%';
  const p = (n / of) * 100;
  return `${p > 0 && p < 1 ? '<1' : Math.round(p)}%`;
}
export function dur(s: number) {
  if (!s) return '0 s';
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return r ? `${m} min ${r} s` : `${m} min`;
}
const dayShort = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const dayLong = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

export function pageName(path: string, title?: string | null) {
  if (!path) return 'Left the website';
  if (path === '/') return 'Home';
  const t = (title || '').replace(/\s*[|·]\s*Raf Carpentry.*$/i, '').replace(/^Raf Carpentry\s*[|·]\s*/i, '').trim();
  if (t) return t;
  const last = path.split('/').filter(Boolean).pop() || path;
  return last.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
export const sourceName = (k: string) => SOURCE_LABEL[k] ?? k;

export function Chips<T extends string | number>({ value, options, onPick, label }: { value: T; options: { v: T; t: string }[]; onPick: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={o.v === value}
          onClick={() => onPick(o.v)}
          className={`h-9 rounded-sm border px-3 font-mono text-[13px] ${o.v === value ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-mount text-ink'}`}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function Band({ label, right, children }: { label: string; right?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-sm border border-line-strong bg-mount">
      <div className="flex h-11 items-center gap-2.5 border-b border-line-strong bg-raised px-4">
        <h2 className="flex-1 font-mono text-[13px] font-semibold uppercase tracking-[0.08em]">{label}</h2>
        {right ? <span className="truncate font-mono text-[12.5px] text-muted">{right}</span> : null}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/* The planner's 'Get the cut list for this design' (rafcarpentry.com/wardrobe-planner, Send step): people who left
   their email for the cut list of the design they made. Raf sends it once the cut list is for sale. */
function CutlistBand({ info, days }: { info: CutlistInfo | null; days: number }) {
  const [all, setAll] = useState(false);
  if (!info) return null;
  const list = all ? info.recent : info.recent.slice(0, 5);
  const line = (summary: string, key: string) => (summary.split('\n').find((l) => l.startsWith(`${key}:`)) ?? '').slice(key.length + 1).trim();
  return (
    <Band label="Cut list button (planner)" right={`${info.total} in ${days} days${typeof info.sent === 'number' ? `, ${info.sent} emailed` : ''}`}>
      {info.recent.length ? (
        <ul className="divide-y divide-line" data-cutlist-list>
          {list.map((c) => {
            const when = new Date(c.at);
            const preview = c.host && !/^(www\.)?rafcarpentry\.com$/i.test(c.host);
            return (
              <li key={c.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <a href={`mailto:${c.email}?subject=${encodeURIComponent('The cut list for your wardrobe design')}`} className="min-w-0 truncate text-[15px] font-semibold text-accent">
                    {c.email}
                  </a>
                  <span className="shrink-0 font-mono text-[12.5px] text-muted">
                    {when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}
                    {c.country ? ` · ${c.country === 'GB' ? 'UK' : c.country}` : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
                  {[line(c.summary, 'Space'), line(c.summary, 'Doors')].filter(Boolean).join(' · ')}
                  {preview ? <span className="ml-1 font-mono text-[12px] text-faint">(from a preview)</span> : null}
                </p>
                <p className={`mt-0.5 text-[13px] font-semibold ${c.sent_at ? 'text-[#15803d]' : 'text-[#a35a00]'}`} data-cutlist-sent={c.sent_at ? '1' : '0'}>
                  {c.sent_at
                    ? `Emailed${c.parts ? `: ${c.parts} parts, ${c.boards} ${c.boards === 1 ? 'board' : 'boards'}` : ''}`
                    : 'Not emailed: send it yourself'}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-[14.5px] text-muted">Nobody has asked for a cut list yet.</p>
      )}
      {info.recent.length > 5 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 h-10 text-[14px] font-semibold text-accent">
          {all ? 'Show fewer' : `Show all ${info.recent.length}`}
        </button>
      ) : null}
      <p className="mt-2 text-[13px] leading-relaxed text-faint">
        They designed a wardrobe in the planner and tapped Get the cut list. CabinetOS emails it straight away with the spreadsheet
        and a link to open it in CabinetOS; nothing is charged. One that says Not emailed didn&apos;t go (CabinetOS was down or
        it was asked before 22 Oct): tap the email to send it yourself. {info.all} asked in all.
      </p>
    </Band>
  );
}

export function Num({ v, label, sub }: { v: string; label: string; sub?: string }) {
  return (
    <div className="rounded-sm border border-line bg-paper px-3 py-2.5">
      <p className="font-display text-[28px] font-[680] leading-none tracking-[-0.02em]">{v}</p>
      <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{label}</p>
      {sub ? <p className="mt-0.5 font-mono text-[11.5px] text-faint">{sub}</p> : null}
    </div>
  );
}

/* a row with a bar for its share: label left, number right */
export function ShareRow({ label, n, of, note, onClick }: { label: string; n: number; of: number; note?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[15px]">{label}</span>
        <span className="shrink-0 font-mono text-[13px] text-muted">
          {n} · {pct(n, of)}
          {onClick ? <span aria-hidden className="ml-2 text-accent">→</span> : null}
        </span>
      </span>
      <span aria-hidden className="mt-1.5 block h-[6px] rounded-sm bg-raised">
        <span className="block h-full rounded-sm bg-accent" style={{ width: `${of ? Math.max(2, (n / of) * 100) : 0}%` }} />
      </span>
      {note ? <span className="mt-1 block font-mono text-[11.5px] text-faint">{note}</span> : null}
    </>
  );
  return onClick ? (
    <li>
      <button type="button" onClick={onClick} className="block w-full py-2 text-left">
        {inner}
      </button>
    </li>
  ) : (
    <li className="py-2">{inner}</li>
  );
}

/* 'Today 18:20', 'Yesterday 21:05', 'Mon 20 Oct, 14:02' (London time) */
export function whenWords(iso: string, now = new Date()) {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  if (day(d) === day(now)) return `Today ${time}`;
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return `Yesterday ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })}, ${time}`;
}
/* where a visit came from, as words after 'from' */
const fromWords = (src: string) => (src === 'direct' ? 'typed in or a saved link' : src === 'internal' ? 'back on the site later' : `from ${sourceName(src)}`);

export const PLACE_NOTE =
  'Roughly where, from their internet connection: home broadband usually shows the right town and postcode area; phones on 4G or 5G often show the network’s nearest hub (often just London), so treat it as a hint, not an address. Nobody’s name or street is ever known.';

/* The newest visits, one by one: where from, when, how, the pages in order, what they tapped. */
function LatestVisits({ list, names, onPage }: { list: Visit[]; names: Record<string, string>; onPage: (path: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, 8);
  return (
    <Band label="Latest visits" right={list.length ? 'newest first' : undefined}>
      {list.length ? (
        <ul className="divide-y divide-line" data-latest>
          {shown.map((v) => {
            const more = v.pages.length - 5;
            return (
              <li key={`${v.at}-${v.pages[0]?.p}`} className="py-3" data-visit>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-[16px] font-semibold" data-place>
                    {placeName(v)}
                  </p>
                  <span className="shrink-0 font-mono text-[12.5px] text-muted">{whenWords(v.at)}</span>
                </div>
                <p className="mt-0.5 font-mono text-[12px] text-faint">
                  {v.device ?? 'screen not known'} · {fromWords(v.src)}
                  {v.engaged ? ` · ${dur(Math.round(v.engaged / 1000))} in use` : ''}
                </p>
                <ol className="mt-1.5 grid grid-cols-[minmax(0,1fr)]">
                  {v.pages.slice(0, 5).map((pg, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => onPage(pg.p)} className="flex w-full items-baseline gap-2.5 py-1.5 text-left">
                        <span className="w-4 shrink-0 font-mono text-[11.5px] text-faint">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[14.5px]">{names[pg.p] ?? pageName(pg.p, pg.t)}</span>
                        {pg.e >= 1000 ? <span className="shrink-0 font-mono text-[12px] text-muted">{dur(Math.round(pg.e / 1000))}</span> : null}
                        <span aria-hidden className="shrink-0 text-accent">
                          →
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                {more > 0 ? <p className="pl-[26px] font-mono text-[12px] text-faint">and {more} more page{more === 1 ? '' : 's'}</p> : null}
                {v.goals.length || v.saves ? (
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    {v.goals.map((g) => (
                      <span key={g} className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-[11.5px] text-accent">
                        Tapped {GOAL_LABEL[g] ?? g}
                      </span>
                    ))}
                    {v.saves ? (
                      <span className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-[11.5px] text-muted">
                        Saved {v.saves} for a brief
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-[14.5px] text-muted">No visits yet.</p>
      )}
      {list.length > 8 ? (
        <button type="button" onClick={() => setAll((x) => !x)} className="mt-1 h-10 text-[14px] font-semibold text-accent">
          {all ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      ) : null}
      <p className="mt-2 text-[13px] leading-relaxed text-faint">Tap a page for its heatmap. {PLACE_NOTE}</p>
    </Band>
  );
}

/* Towns and cities the visits came from, with the postcode areas inside each. */
function PlacesBand({ r }: { r: StatsReport }) {
  const places = r.places ?? [];
  const known = places.filter((p) => p.city || p.districts.length);
  const total = places.reduce((a, p) => a + p.visits, 0);
  return (
    <Band label="Where they are" right={total ? `${total} visit${total === 1 ? '' : 's'}` : undefined}>
      {known.length ? (
        <ul className="divide-y divide-line" data-places>
          {places.map((p) => (
            <ShareRow
              key={`${p.country}-${p.city ?? ''}`}
              label={placeName({ country: p.country, city: p.city }, { district: false })}
              n={p.visits}
              of={total}
              note={p.districts.length ? p.districts.map((d) => `${d.d} ${d.n}`).join(' · ') : undefined}
            />
          ))}
        </ul>
      ) : (
        <p className="py-2 text-[14.5px] text-muted">Towns are counted from 22 October 2026: the next visits show up here.</p>
      )}
      <p className="mt-2 text-[13px] leading-relaxed text-faint">
        {r.placesFrom && r.placesFrom > r.since ? `Towns counted since ${dayLong(r.placesFrom)}; visits before that show only the country. ` : ''}
        {PLACE_NOTE}
      </p>
    </Band>
  );
}

/* ---------- the overview ---------- */

export function StatsView({ onPage, onBlog }: { onPage: (path: string) => void; onBlog?: () => void }) {
  // this screen only opens in the phone's browser (after the app is ready), so the kept numbers can be read at once
  const [saved, setSaved] = useState<Saved>(() => savedStats());
  const [days, setDays] = useState(() => savedStats().days || 7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<'views' | 'time' | 'left'>('views');
  const [active, setActive] = useState<string | null>(null);
  const [mine] = useState(() => statsOff());

  const fetchReport = useCallback(async (d: number) => {
    const r = await post<{ report: StatsReport; at: number; cutlist?: CutlistInfo | null }>(readPin(), { action: 'report', days: d }, API);
    setLoading(false);
    if (!r.ok) return setError(r.error);
    const s = { days: d, report: r.data.report, at: r.data.at, cutlist: r.data.cutlist ?? null };
    keep(s);
    setSaved(s);
  }, []);
  const load = (d: number) => {
    setLoading(true);
    setError('');
    void fetchReport(d);
  };
  const firstDays = useRef(days);
  useEffect(() => {
    void fetchReport(firstDays.current);
  }, [fetchReport]);

  const r = saved.days === days ? saved.report : null;
  const names = useMemo(() => Object.fromEntries((r?.pages ?? []).map((p) => [p.path, pageName(p.path, p.title)])), [r]);
  const pages = useMemo(() => {
    const list = [...(r?.pages ?? [])];
    if (sort === 'time') list.sort((a, b) => b.engagedAvg - a.engagedAvg || b.views - a.views);
    if (sort === 'left') list.sort((a, b) => b.exits / Math.max(1, b.views) - a.exits / Math.max(1, a.views) || b.views - a.views);
    return list;
  }, [r, sort]);
  const t = r?.totals;
  const maxDay = Math.max(1, ...(r?.daily ?? []).map((d) => d.visitors));
  const shownDay = r?.daily.find((d) => d.day === (active ?? r.today)) ?? r?.daily[r.daily.length - 1];
  const goals = Object.entries(r?.goals ?? {}) as [Goal, number][];
  const goalsTotal = goals.reduce((a, [, n]) => a + n, 0);

  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="stats" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Website stats
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[13px] text-faint">
        <span>rafcarpentry.com{saved.at ? `, ${new Date(saved.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        <button type="button" onClick={() => load(days)} className="h-9 text-accent underline" disabled={loading}>
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
            load(d);
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem(error)}
        </p>
      ) : null}
      {!r ? (
        <p className="pt-10 text-center font-mono text-[14px] text-faint">{loading ? 'Getting the numbers…' : ''}</p>
      ) : (
        <>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
            {r.first
              ? `Counting since ${dayLong(r.first)}. `
              : 'Nothing counted yet: the first visitors show up here within a minute of their visit. '}
            Your own visits and robots aren’t counted.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Num v={String(t!.visitors)} label="Visitors" sub="a person a day" />
            <Num v={String(t!.views)} label="Pages viewed" sub={t!.visits ? `${(t!.views / t!.visits).toFixed(1)} a visit` : undefined} />
            <Num v={dur(t!.engagedAvg)} label="Time on the site" sub="a visit, while in use" />
            <Num v={pct(t!.onePage, t!.visits)} label="Left after one page" sub={`${t!.onePage} of ${t!.visits} visits`} />
          </div>
          {t!.visits ? (
            <div className="mt-3">
              <div aria-hidden className="flex h-[10px] gap-[2px] overflow-hidden rounded-sm">
                <span className="bg-accent" style={{ flex: t!.phone || 0.0001 }} />
                <span className="bg-ink/40" style={{ flex: t!.tablet || 0.0001 }} />
                <span className="bg-ink" style={{ flex: t!.computer || 0.0001 }} />
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-4 font-mono text-[12.5px] text-muted">
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent" />
                  Phone {t!.phone} ({pct(t!.phone, t!.visits)})
                </span>
                {t!.tablet ? (
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-ink/40" />
                    Tablet {t!.tablet}
                  </span>
                ) : null}
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-ink" />
                  Computer {t!.computer} ({pct(t!.computer, t!.visits)})
                </span>
              </p>
            </div>
          ) : null}

          <Band label="Visitors by day" right={`most ${maxDay}`}>
            {shownDay ? (
              <p className="font-mono text-[13px]" aria-live="polite">
                {dayShort(shownDay.day)}: <b>{shownDay.visitors}</b> visitor{shownDay.visitors === 1 ? '' : 's'}, {shownDay.views} page{shownDay.views === 1 ? '' : 's'}
              </p>
            ) : null}
            <div className="mt-2 flex h-28 items-end gap-[2px] border-b border-line-strong" role="list" aria-label="Visitors each day">
              {r.daily.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  role="listitem"
                  aria-label={`${dayShort(d.day)}: ${d.visitors} visitors`}
                  onClick={() => setActive(d.day)}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(d.day)}
                  className="group relative flex h-full flex-1 items-end"
                >
                  <span
                    className={`block w-full rounded-t-[2px] ${d.day === shownDay?.day ? 'bg-ink' : 'bg-accent'}`}
                    style={{ height: d.visitors ? `${Math.max(4, (d.visitors / maxDay) * 100)}%` : '1px', opacity: d.visitors ? 1 : 0.3 }}
                  />
                </button>
              ))}
            </div>
            <p className="mt-1 flex justify-between font-mono text-[11.5px] text-faint">
              <span>{dayShort(r.since)}</span>
              <span>Today</span>
            </p>
          </Band>

          {r.latest ? <LatestVisits list={r.latest} names={names} onPage={onPage} /> : null}

          <Band label="Where they come from" right={`${t!.visits} visits`}>
            {r.sources.length ? (
              <ul className="divide-y divide-line">
                {r.sources.map((s) => (
                  <ShareRow key={s.kind} label={sourceName(s.kind)} n={s.visits} of={t!.visits} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">No visits yet.</p>
            )}
            {r.countries.length > 1 ? (
              <p className="mt-2 font-mono text-[12px] text-faint">
                From: {r.countries.map((c) => `${c.country === 'GB' ? 'UK' : c.country === '?' ? 'unknown' : c.country} ${c.visits}`).join(' · ')}
              </p>
            ) : null}
          </Band>

          {r.places ? <PlacesBand r={r} /> : null}

          <Band label="Ways to get in touch tapped" right={goalsTotal ? `${goalsTotal} taps` : undefined}>
            {goals.length ? (
              <ul className="divide-y divide-line">
                {goals
                  .sort((a, b) => b[1] - a[1])
                  .map(([g, n]) => (
                    <ShareRow key={g} label={GOAL_LABEL[g] ?? g} n={n} of={goalsTotal} />
                  ))}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">Nobody has tapped Get a quote, phone, WhatsApp or email yet in these days.</p>
            )}
            <p className="mt-2 text-[13px] leading-relaxed text-faint">Taps on the buttons, not finished enquiries: those arrive in ServiceM8 and the Inbox.</p>
          </Band>

          <CutlistBand info={saved.days === days ? (saved.cutlist ?? null) : null} days={days} />

          {onBlog ? <BlogBand days={days} onOpen={onBlog} onPage={onPage} /> : null}

          <Band label="Pages" right={`${r.pages.length} pages`}>
            <Chips
              label="Order"
              value={sort}
              options={[
                { v: 'views', t: 'Most seen' },
                { v: 'time', t: 'Longest read' },
                { v: 'left', t: 'Most left from' },
              ]}
              onPick={setSort}
            />
            {pages.length ? (
              <ul className="mt-2 divide-y divide-line">
                {pages.map((p) => (
                  <li key={p.path}>
                    <button type="button" onClick={() => onPage(p.path)} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{pageName(p.path, p.title)}</span>
                        {p.path !== '/' ? <span className="block truncate font-mono text-[11.5px] text-faint">{p.path}</span> : null}
                        <span className="mt-1 block font-mono text-[12.5px] text-muted">
                          {p.views} view{p.views === 1 ? '' : 's'} · {dur(p.engagedAvg)} · read {Math.round(p.scrollAvg * 100)}% · {pct(p.exits, p.views)} left here
                          {p.goals ? ` · ${p.goals} get in touch` : ''}
                        </span>
                      </span>
                      <span aria-hidden className="text-[20px] text-accent">
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">No pages viewed yet.</p>
            )}
            <p className="mt-2 text-[13px] leading-relaxed text-faint">Tap a page for its heatmap: what was tapped, how far down people got and where they spent their time.</p>
          </Band>

          <Band label="Routes through the site" right="most common">
            {r.journeys.length ? (
              <ol className="divide-y divide-line">
                {r.journeys.map((j, i) => (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span className="min-w-0 flex-1 text-[14.5px] leading-snug">
                      {j.paths.map((p, k) => (
                        <span key={k}>
                          {k ? <span className="mx-1 text-accent">→</span> : null}
                          {names[p] ?? pageName(p)}
                        </span>
                      ))}
                      {j.more ? <span className="text-faint"> → …</span> : null}
                      <span className="ml-1 font-mono text-[12px] text-faint">→ left</span>
                    </span>
                    <span className="shrink-0 font-mono text-[13px] text-muted">{j.visits}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">No visits yet.</p>
            )}
          </Band>
        </>
      )}

      <div className="mt-6 rounded-sm border border-line-strong bg-mount px-4 py-3.5 text-[14.5px] leading-relaxed">
        <p className="font-semibold">Your own visits</p>
        <p className="mt-1 text-muted">
          {mine ? 'Not counted from here. ' : ''}To stop counting the website in Safari (and on your computer), open rafcarpentry.com/privacy there and tap
          Don’t count my visits. The pages shown in these heatmaps are never counted.
        </p>
        <a href="/privacy#stats" target="_blank" rel="noopener" className="mt-2 inline-block text-accent underline">
          Open the privacy page
        </a>
      </div>
    </div>
  );
}

/* ---------- one page ---------- */

const SCREEN: Record<Device, { w: number; h: number; t: string }> = {
  phone: { w: 390, h: 844, t: 'Phone' },
  tablet: { w: 820, h: 1180, t: 'Tablet' },
  computer: { w: 1280, h: 800, t: 'Computer' },
};
type Layer = 'taps' | 'far' | 'time';

export function StatsPageView({ path }: { path: string }) {
  // the page names and the number of days from the overview last seen on this phone
  const [{ names, days }] = useState(() => {
    const s = savedStats();
    return { names: Object.fromEntries((s.report?.pages ?? []).map((p) => [p.path, pageName(p.path, p.title)])) as Record<string, string>, days: s.days || 7 };
  });
  const [device, setDevice] = useState<Device | null>(null);
  const [page, setPage] = useState<StatsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layer, setLayer] = useState<Layer>('taps');

  // first without a size, to open on the one most people used; then for the size picked
  useEffect(() => {
    let live = true;
    void post<{ page: StatsPage }>(readPin(), { action: 'page', path, device, days }, API).then((r) => {
      if (!live) return;
      setLoading(false);
      if (!r.ok) return setError(r.error);
      const pg = r.data.page;
      if (!device) {
        const c = pg.devices ?? {};
        setLoading(true);
        setDevice((c.computer ?? 0) > (c.phone ?? 0) && (c.computer ?? 0) >= (c.tablet ?? 0) ? 'computer' : (c.tablet ?? 0) > (c.phone ?? 0) ? 'tablet' : 'phone');
        return;
      }
      setPage(pg);
    });
    return () => {
      live = false;
    };
  }, [path, device, days]);
  const pickDevice = (d: Device) => {
    if (d === device) return;
    setLoading(true);
    setError('');
    setDevice(d);
  };

  const counts = page?.devices ?? {};
  const devices = (['phone', 'tablet', 'computer'] as Device[]).filter((d) => d !== 'tablet' || (counts.tablet ?? 0) > 0 || device === 'tablet');
  const name = names[path] ?? pageName(path, page?.title);
  const nextTotal = (page?.next ?? []).reduce((a, n) => a + n.n, 0);
  const fromTotal = (page?.from ?? []).reduce((a, n) => a + n.n, 0);

  return (
    <div className="pt-7">
      <p className="kicker">Website stats, last {days} days</p>
      <h1 className="mt-1 font-display text-[30px] font-[680] leading-[1.05] tracking-[-0.025em] [overflow-wrap:anywhere]">{name}</h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[12.5px] text-faint">
        <span className="[overflow-wrap:anywhere]">{path}</span>
        <a href={path} target="_blank" rel="noopener" className="h-9 leading-9 text-accent underline">
          Open the page
        </a>
      </p>
      <div className="mt-3">
        <Chips
          label="Screen size"
          value={device ?? 'phone'}
          options={devices.map((d) => ({ v: d, t: `${SCREEN[d].t}${counts[d] !== undefined ? ` ${counts[d]}` : ''}` }))}
          onPick={pickDevice}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem(error)}
        </p>
      ) : null}
      {!page || !device ? (
        <p className="pt-10 text-center font-mono text-[14px] text-faint">{loading ? 'Getting the page…' : ''}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Num v={String(page.views)} label={`Views on a ${SCREEN[device].t.toLowerCase()}`} sub={`${page.visitors} visitor${page.visitors === 1 ? '' : 's'}`} />
            <Num v={dur(page.engagedAvg)} label="Time on the page" sub="while in use" />
            <Num v={`${Math.round(page.scrollAvg * 100)}%`} label="Read down the page" sub="on average" />
            <Num v={pct(page.exits, page.views)} label="Left the site here" sub={`${page.exits} of ${page.views}`} />
          </div>

          <Band label="On the page" right={`${page.clicks.length} tap${page.clicks.length === 1 ? '' : 's'}`}>
            <Chips
              label="Layer"
              value={layer}
              options={[
                { v: 'taps', t: 'Taps' },
                { v: 'far', t: 'How far' },
                { v: 'time', t: 'Time' },
              ]}
              onPick={setLayer}
            />
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              {layer === 'taps'
                ? 'Where people tapped or clicked: hotter is more.'
                : layer === 'far'
                  ? 'The darker, the fewer got that far down. The lines mark where three in four, half and one in four stopped.'
                  : 'Where on the page the time went, while they were using it.'}{' '}
              Drag the page to scroll it.
            </p>
          </Band>
          <PageFrame key={`${path}-${device}`} path={path} device={device} layer={layer} page={page} />

          <Band label="Most tapped" right={page.top.length ? undefined : 'nothing yet'}>
            {page.top.length ? (
              <ul className="divide-y divide-line">
                {page.top.map((x) => (
                  <li key={x.t} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-[15px]">
                      {x.t}
                      {x.g ? <span className="ml-2 rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-[11.5px] text-accent">{GOAL_LABEL[x.g]}</span> : null}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] text-muted">{x.n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">No taps on this page at this size yet.</p>
            )}
          </Band>

          <Band label="Came from">
            {page.from.length ? (
              <ul className="divide-y divide-line">
                {page.from.map((f) => (
                  <ShareRow key={f.from} label={f.from.startsWith('src:') ? `${sourceName(f.from.slice(4))} (first page)` : names[f.from] ?? pageName(f.from)} n={f.n} of={fromTotal} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">No visits at this size yet.</p>
            )}
          </Band>

          <Band label="Went next">
            {page.next.length ? (
              <ul className="divide-y divide-line">
                {page.next.map((n) => (
                  <ShareRow key={n.path || 'left'} label={n.path ? names[n.path] ?? pageName(n.path) : 'Left the website'} n={n.n} of={nextTotal} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[14.5px] text-muted">No visits at this size yet.</p>
            )}
          </Band>

          {page.places ? (
            <Band label="Who looked at it" right="every screen size">
              {page.places.length ? (
                <ul className="divide-y divide-line" data-page-places>
                  {page.places.map((p, i) => (
                    <ShareRow key={i} label={placeName(p)} n={p.n} of={page.places!.reduce((a, x) => a + x.n, 0)} />
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-[14.5px] text-muted">Nobody yet in these days.</p>
              )}
              {page.recent?.length ? (
                <>
                  <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Latest views</p>
                  <ul className="mt-1 divide-y divide-line" data-page-recent>
                    {page.recent.map((v, i) => (
                      <li key={i} className="py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-[15px] font-semibold">{placeName(v)}</span>
                          <span className="shrink-0 font-mono text-[12.5px] text-muted">{whenWords(v.at)}</span>
                        </div>
                        <p className="mt-0.5 font-mono text-[12px] text-faint">
                          {v.device ?? 'screen not known'}
                          {v.engaged >= 1000 ? ` · ${dur(Math.round(v.engaged / 1000))}` : ''}
                          {v.scroll ? ` · read ${Math.round(v.scroll * 100)}%` : ''}
                          {' · '}
                          {v.src === 'internal' ? `after ${v.prev ? names[v.prev] ?? pageName(v.prev) : 'another page'}` : fromWords(v.src)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p className="mt-2 text-[13px] leading-relaxed text-faint">{PLACE_NOTE}</p>
            </Band>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ---------- the page with the layer over it ---------- */

/* light amber to deep red, by how many taps overlap (one hue family, light to dark) */
const HEAT = (() => {
  const stops: [number, number, number, number][] = [
    [0, 255, 224, 130],
    [0.45, 247, 151, 45],
    [1, 196, 32, 20],
  ];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, r0, g0, b0] = stops[k];
    const [t1, r1, g1, b1] = stops[k + 1];
    const u = (t - t0) / (t1 - t0);
    lut[i * 3] = r0 + (r1 - r0) * u;
    lut[i * 3 + 1] = g0 + (g1 - g0) * u;
    lut[i * 3 + 2] = b0 + (b1 - b0) * u;
  }
  return lut;
})();

function PageFrame({ path, device, layer, page }: { path: string; device: Device; layer: Layer; page: StatsPage }) {
  const outer = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const els = useRef(new Map<string, Element | null>());
  const [box, setBox] = useState(0);
  const [winH, setWinH] = useState(800);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState({ y: 0, docH: 1 });
  const [hidden, setHidden] = useState(0);
  const { w, h } = SCREEN[device];
  // never bigger than the real thing: a phone page stays phone sized on a computer
  const frameW = box ? Math.min(box - 30, w) : 0;
  const k = frameW > 0 ? frameW / w : 0;
  const dispH = k ? Math.round(Math.min(h * k, winH * 0.72)) : 0;
  const vh = k ? dispH / k : h; // the page's own window height inside the frame

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox(el.clientWidth));
    ro.observe(el);
    setBox(el.clientWidth);
    const onWin = () => setWinH(window.innerHeight);
    onWin();
    window.addEventListener('resize', onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
    };
  }, []);

  const win = () => frame.current?.contentWindow ?? null;
  const doc = () => {
    try {
      return frame.current?.contentDocument ?? null;
    } catch {
      return null;
    }
  };

  const draw = useCallback(() => {
    const cv = canvas.current;
    const d = doc();
    const wn = win();
    // the page in the frame is gone when the screen closes mid-load
    if (!cv || !d?.documentElement || !wn || !k) return;
    const W = Math.round(frameW);
    const H = Math.round(dispH);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const sy = wn.scrollY;
    const docH = Math.max(1, d.documentElement.scrollHeight);
    setView((v) => (v.y === sy && v.docH === docH ? v : { y: sy, docH }));
    const band = (i: number, n: number) => [((i / n) * docH - sy) * k, (((i + 1) / n) * docH - sy) * k] as const;

    if (layer === 'taps') {
      const pts: [number, number][] = [];
      let lost = 0;
      const bySel = new Map<string, Tap[]>();
      for (const t of page.clicks) {
        const list = bySel.get(t.s);
        if (list) list.push(t);
        else bySel.set(t.s, [t]);
      }
      for (const [sel, taps] of bySel) {
        if (!els.current.has(sel)) {
          let found: Element | null = null;
          try {
            found = d.querySelector(sel);
          } catch {
            found = null;
          }
          els.current.set(sel, found);
        }
        const el = els.current.get(sel);
        const r = el?.getBoundingClientRect();
        const ok = !!r && r.width > 0 && r.height > 0;
        for (const t of taps) {
          let x: number;
          let y: number;
          if (ok) {
            x = r!.left + t.fx * r!.width;
            y = r!.top + t.fy * r!.height;
          } else {
            lost++;
            x = t.x * w;
            y = (t.h ? t.y / t.h : 0) * docH - sy;
          }
          if (y < -60 || y > vh + 60) continue;
          pts.push([x * k, y * k]);
        }
      }
      setHidden(lost);
      if (!pts.length) return;
      const R = Math.max(12, 30 * Math.min(1, k));
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const a = off.getContext('2d');
      if (!a) return;
      for (const [x, y] of pts) {
        const g = a.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, 'rgba(0,0,0,0.42)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        a.fillStyle = g;
        a.fillRect(x - R, y - R, R * 2, R * 2);
      }
      const img = a.getImageData(0, 0, W, H);
      const px = img.data;
      for (let i = 0; i < px.length; i += 4) {
        const al = px[i + 3];
        if (!al) continue;
        const c = al * 3;
        px[i] = HEAT[c];
        px[i + 1] = HEAT[c + 1];
        px[i + 2] = HEAT[c + 2];
        px[i + 3] = Math.min(235, 70 + al * 1.4);
      }
      ctx.putImageData(img, 0, 0);
      return;
    }

    if (layer === 'far') {
      const reach = page.reach ?? [];
      if (!reach.length) return;
      for (let i = 0; i < 20; i++) {
        const [y0, y1] = band(i, 20);
        if (y1 < 0 || y0 > H) continue;
        const gone = 1 - (reach[i + 1] ?? 0);
        ctx.fillStyle = `rgba(22,25,28,${(gone * 0.62).toFixed(3)})`;
        ctx.fillRect(0, y0, W, y1 - y0 + 0.5);
      }
      for (const [share, label] of [
        [0.75, 'Three in four got this far'],
        [0.5, 'Half got this far'],
        [0.25, 'One in four got this far'],
      ] as const) {
        const i = reach.findIndex((x) => x < share);
        if (i <= 0) continue;
        const y = (((i - 1) / 20) * docH - sy) * k;
        if (y < 0 || y > H) continue;
        ctx.strokeStyle = '#2547d0';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 12px ui-monospace, monospace';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = '#2547d0';
        ctx.fillRect(6, y - 22, tw + 12, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, 12, y - 8);
      }
      return;
    }

    // time
    const dw = page.dwell ?? [];
    const total = dw.reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...dw);
    if (!total) return;
    for (let i = 0; i < 20; i++) {
      const [y0, y1] = band(i, 20);
      if (y1 < 0 || y0 > H) continue;
      const t = dw[i] / max;
      ctx.fillStyle = `rgba(232,96,28,${(0.03 + 0.34 * t).toFixed(3)})`;
      ctx.fillRect(0, y0, W, y1 - y0 + 0.5);
      const share = dw[i] / total;
      if (share >= 0.03 && y1 - y0 > 18) {
        const label = `${Math.round(share * 100)}% of the time`;
        ctx.font = '600 12px ui-monospace, monospace';
        const tw = ctx.measureText(label).width;
        const ly = Math.min(Math.max(y0 + 6, 4), H - 24);
        ctx.fillStyle = 'rgba(22,25,28,0.86)';
        ctx.fillRect(W - tw - 18, ly, tw + 12, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, W - tw - 12, ly + 14);
      }
    }
  }, [frameW, dispH, k, layer, page, vh, w]);

  // redraw on scroll inside the frame, on resize and when the layer changes
  const raf = useRef(0);
  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  }, [draw]);
  useEffect(() => {
    schedule();
  }, [schedule, ready]);
  useEffect(() => {
    if (!ready) return;
    const wn = win();
    if (!wn) return;
    wn.addEventListener('scroll', schedule, { passive: true });
    wn.addEventListener('resize', schedule);
    // pictures and the 3D load after the page: measure again a few times
    const ts = [600, 1500, 3500].map((t) => setTimeout(() => {
      els.current.clear();
      schedule();
    }, t));
    return () => {
      wn.removeEventListener('scroll', schedule);
      wn.removeEventListener('resize', schedule);
      ts.forEach(clearTimeout);
    };
  }, [ready, schedule]);

  const scrollTo = (y: number) => {
    const wn = win();
    if (!wn) return;
    wn.scrollTo({ top: Math.max(0, y), behavior: 'instant' as ScrollBehavior });
  };
  // drag the page to scroll it (it can't be tapped: taps would follow links)
  const drag = useRef<{ y: number; top: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    const wn = win();
    if (!wn) return;
    drag.current = { y: e.clientY, top: wn.scrollY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !k) return;
    scrollTo(drag.current.top - (e.clientY - drag.current.y) / k);
  };
  const onUp = () => {
    drag.current = null;
  };
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const wheel = (e: WheelEvent) => {
      const wn = win();
      if (!wn || !k) return;
      e.preventDefault();
      scrollTo(wn.scrollY + e.deltaY / k);
    };
    cv.addEventListener('wheel', wheel, { passive: false });
    return () => cv.removeEventListener('wheel', wheel);
  });

  // the map beside the page: the whole page top to bottom, the part on show, tap or drag to go there
  const mapH = dispH;
  const mapDrag = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    scrollTo(f * view.docH - vh / 2);
  };
  const mapBands = layer === 'far' ? (page.reach ?? []).slice(1).map((r) => 1 - r) : layer === 'time' ? page.dwell.map((x) => x / Math.max(1, ...page.dwell)) : tapBands(page.clicks);

  return (
    <div ref={outer} className="relative left-1/2 mt-3 w-[min(1100px,calc(100vw-32px))] -translate-x-1/2">
      <div className="flex justify-center gap-2">
        <div className="relative shrink-0 overflow-hidden rounded-sm border border-line-strong bg-paper" style={{ width: frameW || '100%', height: dispH || 300 }}>
          {k ? (
            <iframe
              ref={frame}
              title={`${path} as on a ${device}`}
              src={path}
              onLoad={() => {
                els.current.clear();
                setReady(true);
                schedule();
              }}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-paper"
              style={{ width: w, height: vh, transform: `scale(${k})` }}
            />
          ) : null}
          <canvas
            ref={canvas}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="absolute inset-0 h-full w-full cursor-grab touch-none"
          />
          {!ready ? <p className="absolute inset-x-0 top-1/3 text-center font-mono text-[13px] text-faint">Opening the page…</p> : null}
        </div>
        <div
          role="slider"
          aria-label="Where on the page"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((view.y / Math.max(1, view.docH - vh)) * 100)}
          tabIndex={0}
          onKeyDown={(e) => {
            const wn = win();
            if (!wn) return;
            if (e.key === 'ArrowDown' || e.key === 'PageDown') scrollTo(wn.scrollY + vh * 0.8);
            if (e.key === 'ArrowUp' || e.key === 'PageUp') scrollTo(wn.scrollY - vh * 0.8);
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            mapDrag(e);
          }}
          onPointerMove={(e) => e.buttons && mapDrag(e)}
          className="relative w-[22px] shrink-0 touch-none overflow-hidden rounded-sm border border-line-strong bg-mount"
          style={{ height: mapH || 300 }}
        >
          {mapBands.map((v, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute inset-x-0"
              style={{
                top: `${(i / mapBands.length) * 100}%`,
                height: `${100 / mapBands.length + 0.2}%`,
                background: layer === 'far' ? `rgba(22,25,28,${(v * 0.62).toFixed(3)})` : `rgba(232,96,28,${(0.04 + 0.6 * v).toFixed(3)})`,
              }}
            />
          ))}
          <span
            aria-hidden
            className="absolute inset-x-0 border-2 border-accent"
            style={{ top: `${(view.y / view.docH) * 100}%`, height: `${Math.max(4, (vh / view.docH) * 100)}%` }}
          />
        </div>
      </div>
      {layer === 'taps' ? (
        <div className="mx-auto mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-faint" style={{ maxWidth: frameW + 30 || undefined }}>
          <span className="flex items-center gap-1.5">
            Fewer
            <span aria-hidden className="inline-block h-2.5 w-24 rounded-sm" style={{ background: 'linear-gradient(90deg, rgb(255,224,130), rgb(247,151,45), rgb(196,32,20))' }} />
            More taps
          </span>
          {hidden ? <span>{hidden} on parts not shown at this size (put where they were on the page)</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function tapBands(taps: Tap[]) {
  const n = Array(20).fill(0) as number[];
  for (const t of taps) n[Math.min(19, Math.max(0, Math.floor((t.h ? t.y / t.h : 0) * 20)))]++;
  const max = Math.max(1, ...n);
  return n.map((x) => x / max);
}
