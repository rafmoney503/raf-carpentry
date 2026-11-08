'use client';

import { useState, type CSSProperties } from 'react';
import { GRID, grid, gridAppHref, gridBriefHref, gridText, mm1, mmc, readMm, type GridFrom, type GridInput } from '@/lib/panelling-calc';
import { AppLink, Choice, CountAuto, MmField, RatherCard, Step } from './calc-parts';
import './panelling-calc.css';

/* "Work out your own wall" on a panelling job page (8 Nov 2026, Raf: "Add to this job wall panelling calculator
   nicely somewhere in this job page"): the batten grid from the Workshop Tools app, started with the job's own
   sizes. The wall drawn to scale with the answer over it, the questions beside it, then what to cut and what to
   buy (the lengths laid out cut by cut), Get a quote, the list to WhatsApp, and the same sizes opened in the app.
   The sums are in src/lib/panelling-calc.ts, checked against the app by scripts/panelling-calc/check.mjs. */

type Start = { w: number; h: number; batten: number; panels?: number; rows?: number; from?: GridFrom; skirting?: number; gap?: number };

/** the text a box shows for a size: 4105, 603.7 */
const show = (v: number) => mm1(v);

export default function PanellingCalculator({ start, job, page, note }: { start: Start; job: string; page: string; note?: string }) {
  const first: GridInput = {
    w: start.w,
    h: start.h,
    batten: start.batten,
    panels: start.panels ?? 0,
    rows: start.rows ?? 1,
    from: start.from ?? 'floor',
    skirting: start.skirting ?? 100,
    gap: start.gap ?? 0,
  };
  const [inp, setInp] = useState<GridInput>(first);
  const [text, setText] = useState({ w: show(first.w), h: show(first.h), batten: show(first.batten), skirting: show(first.skirting), gap: show(first.gap) });
  type Key = keyof typeof text;

  const g = grid(inp);
  const ok = !g.error;
  const fromSk = inp.from === 'skirting';
  const typed = (k: Key) => (t: string) => {
    setText((cur) => ({ ...cur, [k]: t }));
    const v = readMm(t);
    if (v !== null) setInp((cur) => ({ ...cur, [k]: v }));
  };
  const stepped = (k: Key) => (by: number) => {
    const v = Math.max(0, Math.round((inp[k] + by) * 10) / 10);
    setInp((cur) => ({ ...cur, [k]: v }));
    setText((cur) => ({ ...cur, [k]: show(v) }));
  };
  const panelsNow = g.n || g.autoN || inp.panels || 1;
  const setPanels = (n: number) => setInp((cur) => ({ ...cur, panels: Math.min(GRID.maxPanels, Math.max(0, n)) }));
  const badBox = (Object.keys(text) as Key[]).filter((k) => (fromSk || (k !== 'skirting' && k !== 'gap')) && readMm(text[k]) === null).length > 0;

  // the drawing, in mm from the floor up; a little of the wall above the panelling, fading out
  const above = Math.max(80, Math.round(inp.h * 0.14));
  const vw = Math.max(1, inp.w);
  const vh = Math.max(1, inp.h + above);
  const y = (fromFloor: number) => vh - fromFloor; // svg y from a height off the floor
  const mid = ok ? Math.floor((g.n - 1) / 2) : 0;
  const label = ok && g.openW / g.W >= 0.075 && g.openH / vh >= 0.28;

  // what to cut: rail pieces by length, then the uprights
  const railLines: { len: number; count: number }[] = [];
  if (ok)
    for (const p of g.railPieces) {
      const at = railLines.find((l) => Math.abs(l.len - p) < 0.05);
      if (at) at.count += g.rails;
      else railLines.push({ len: p, count: g.rails });
    }
  const centres = ok ? g.ups.map((x) => x + g.B / 2) : [];
  const joinWords = ok
    ? g.joins
        .map((j) => {
          const k = centres.findIndex((c) => Math.abs(c - j) < 1e-6);
          return k >= 0 ? `upright ${k + 1}` : `${mm1(j)} from the left`;
        })
        .join(' and ')
    : '';
  const railNote = !ok
    ? ''
    : g.joins.length === 0
      ? `${g.rails === 2 ? 'Top and bottom' : `${g.rails} rails`}, one piece each`
      : `${g.rails} rails, each in ${g.railPieces.length} pieces joined over ${joinWords}${g.joinOffUpright ? ': the openings are wider than a length, so that join sits between uprights' : ''}`;

  return (
    <div className="pg grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12" data-panel-calc>
      {/* the answer and the wall, to scale */}
      <div className="lg:sticky lg:top-[88px] lg:col-span-7 lg:self-start">
        <div className="pg-card overflow-hidden rounded-sm border border-line bg-mount shadow-[0_1px_3px_rgb(22_25_28/0.08)]">
          <div className="pg-ans px-5 pb-4 pt-4 md:px-6 md:pb-5 md:pt-5" aria-live="polite" data-panel-answer>
            <span className="pg-tk tl" aria-hidden="true" />
            <span className="pg-tk tr" aria-hidden="true" />
            <span className="pg-tk bl" aria-hidden="true" />
            <span className="pg-tk br" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[#f6f7f4]/65">
              <span>Batten grid · {mmc(inp.w)} wide</span>
              <span>{inp.rows === 1 ? '1 row' : `${inp.rows} rows`}</span>
            </div>
            {ok ? (
              <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--pg-blue)]">Each opening</p>
                  <p className="mt-1 font-display text-[clamp(30px,8.5cqw,46px)] font-[680] leading-none tracking-[-0.02em]" data-panel-openings>
                    {mm1(g.openW)} <span className="text-[#f6f7f4]/55">×</span> {mm1(g.openH)}
                    <span className="ml-1.5 font-mono text-[13px] font-normal tracking-normal text-[#f6f7f4]/60">mm</span>
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-x-5 gap-y-1 text-right font-mono">
                  {[
                    [String(g.n), g.n === 1 ? 'panel' : 'panels'],
                    [String(g.uprights), 'uprights'],
                    [String(g.lengths.length), 'lengths'],
                  ].map(([v, k]) => (
                    <div key={k} className="flex flex-col-reverse">
                      <dt className="mt-1 text-[10.5px] uppercase tracking-[0.06em] text-[#f6f7f4]/60">{k}</dt>
                      <dd className="font-display text-[22px] font-[650] leading-none">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="mt-2 text-[15px] leading-snug text-[#ffd9a8]" data-panel-error>
                {g.error}
              </p>
            )}
          </div>

          <div className="px-3.5 pb-3.5 pt-5 md:px-5 md:pb-5">
            <div className="pg-wall" style={{ '--pg-ratio': String(vw / vh) } as CSSProperties}>
              <div className="pg-draw">
                <svg className="pg-svg" viewBox={`0 0 ${vw} ${vh}`} role="img" aria-label={ok ? `The wall to scale, ${mmc(g.W)} wide, with ${g.n} panels across and ${g.uprights} uprights, the top at ${mmc(g.H)} from the floor` : 'The wall to scale'}>
                  <defs>
                    <linearGradient id="pg-fade" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0" stopColor="var(--pg-wall)" />
                      <stop offset="1" stopColor="var(--color-mount)" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y={y(inp.h)} width={vw} height={inp.h} className="pg-wallfill" />
                  <rect x="0" y="0" width={vw} height={above} className="pg-above" />
                  {ok && fromSk && inp.skirting > 0 ? <rect x="0" y={y(inp.skirting)} width={vw} height={inp.skirting} className="pg-skirt" /> : null}
                  {ok
                    ? g.ups.map((x, i) => <rect key={`u${i}`} x={x} y={y(g.H)} width={g.B} height={g.G} className="pg-bat" />)
                    : null}
                  {ok
                    ? Array.from({ length: g.rails }, (_, r) => {
                        const at = g.base + r * (g.openH + g.B);
                        return (
                          <g key={`r${r}`}>
                            <rect x="0" y={y(at + g.B)} width={g.W} height={g.B} className="pg-bat" />
                            {g.joins.map((j) => (
                              <line key={j} x1={j} x2={j} y1={y(at + g.B)} y2={y(at)} className="pg-join" />
                            ))}
                          </g>
                        );
                      })
                    : null}
                  <line x1="0" x2={vw} y1={vh} y2={vh} className="pg-floor" />
                </svg>
                {label ? (
                  <span
                    className="pg-label"
                    style={{ left: `${((g.ups[mid] + g.B + g.openW / 2) / vw) * 100}%`, top: `${(y(g.base + g.B + g.openH / 2) / vh) * 100}%` }}
                    aria-hidden="true"
                  >
                    {mm1(g.openW)}
                    <br />× {mm1(g.openH)}
                  </span>
                ) : null}
              </div>
              <div className="pg-dimh" aria-hidden="true">
                <span className="pg-sp" style={{ height: `${(above / vh) * 100}%` }} />
                <span className="pg-tick" />
                <span className="pg-line" />
                <span className="pg-num">{mmc(inp.h)}</span>
                <span className="pg-line" />
                <span className="pg-tick" />
              </div>
              <div className="pg-dimw" aria-hidden="true">
                <span className="pg-tick" />
                <span className="pg-line" />
                <span className="pg-num">{mmc(inp.w)}</span>
                <span className="pg-line" />
                <span className="pg-tick" />
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-3 font-mono text-[12px] text-muted">
              <span>
                {mmc(inp.w)} × {mmc(inp.h)} · {ok ? `${g.n} ${g.n === 1 ? 'panel' : 'panels'}` : '–'}
              </span>
              <span>
                {!ok ? '' : !fromSk ? 'bottom rail on the floor' : inp.gap > 0 ? `${mm1(inp.gap)} above the skirting` : 'bottom rail on the skirting'}
              </span>
            </div>
            {ok ? (
              <div className="mt-3" data-panel-marks>
                <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">Uprights, left edge from the left end</p>
                <ol className="mt-1.5 flex flex-wrap gap-1.5">
                  {g.ups.map((x, i) => (
                    <li key={i} className="rounded-sm border border-line bg-paper px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
                      {mmc(x)}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-5">
        {/* phones and tablets: the answer stays in sight under the menu while the sizes are changed (the drawing is
            above, out of view by then); a computer has the drawing beside the questions */}
        <p
          className="sticky top-[65px] z-10 -mx-1 mb-5 flex min-h-10 flex-wrap items-center justify-between gap-x-3 rounded-sm bg-ink px-3 py-2 font-mono text-[12.5px] text-[#f6f7f4] shadow-[0_6px_16px_-10px_rgb(22_25_28/0.7)] md:top-[73px] lg:hidden"
          aria-hidden="true"
          data-panel-strip
        >
          {ok ? (
            <>
              <span>
                <span className="text-[var(--pg-blue)]">Openings</span> {mm1(g.openW)} × {mm1(g.openH)}
              </span>
              <span className="text-[#f6f7f4]/70">
                {g.n} {g.n === 1 ? 'panel' : 'panels'} · {g.lengths.length} lengths
              </span>
            </>
          ) : (
            <span className="text-[#ffd9a8]">Check the sizes</span>
          )}
        </p>
        {/* the questions */}
        <div className="flex flex-col gap-6">
          <Step n="01" title="The wall">
            <MmField id="pg-w" label="Wall width" text={text.w} onText={typed('w')} step={10} onStep={stepped('w')} read={readMm} min={1} />
          </Step>
          <Step n="02" title="Height">
            <Choice
              options={[
                { v: 'floor' as GridFrom, label: 'From the floor', sub: 'bottom rail on the floor' },
                { v: 'skirting' as GridFrom, label: 'Above the skirting', sub: 'with a gap, or 0' },
              ]}
              value={inp.from}
              onPick={(from) => setInp((cur) => ({ ...cur, from }))}
            />
            <div className={`mt-3 grid grid-cols-1 gap-3 ${fromSk ? 'min-[380px]:grid-cols-2' : ''}`}>
              {fromSk ? (
                <>
                  <MmField id="pg-sk" label="Skirting" text={text.skirting} onText={typed('skirting')} step={5} onStep={stepped('skirting')} read={readMm} />
                  <MmField id="pg-gap" label="Gap above it" text={text.gap} onText={typed('gap')} step={5} onStep={stepped('gap')} read={readMm} />
                </>
              ) : null}
              <div className={fromSk ? 'min-[380px]:col-span-2' : ''}>
                <MmField id="pg-h" label={fromSk ? 'Top of the panelling, from the floor' : 'Height of the panelling'} text={text.h} onText={typed('h')} step={10} onStep={stepped('h')} read={readMm} min={1} />
              </div>
            </div>
          </Step>
          <Step n="03" title="Battens">
            <MmField id="pg-b" label="Batten width" text={text.batten} onText={typed('batten')} step={1} onStep={stepped('batten')} read={readMm} min={10} />
          </Step>
          <Step n="04" title="Panels">
            <CountAuto id="pg-n" label="Panels across" unit="panel" shown={ok || g.n ? panelsNow : null} auto={inp.panels === 0} autoSub={`about ${GRID.target} wide`} onSet={setPanels} max={GRID.maxPanels} dataAttr="data-panel-n" />
            <p className="mb-2.5 mt-4 text-[14px] font-medium">Rows</p>
            <Choice options={[1, 2, 3, 4].map((r) => ({ v: r, label: String(r) }))} value={inp.rows} onPick={(rows) => setInp((cur) => ({ ...cur, rows }))} cols={4} mono />
          </Step>
          {badBox ? <p className="-mt-2 font-mono text-[12.5px] text-accent">Type each size in mm, like 4105</p> : null}
        </div>

        {/* what to cut and what to buy */}
        {ok ? (
          <section className="mt-9" aria-labelledby="pg-list">
            <h3 id="pg-list" className="font-display text-[26px] font-[680] tracking-[-0.015em]">
              What to cut
            </h3>
            <div className="mt-3 rounded-sm border border-line bg-mount px-3.5 pb-3 pt-1 shadow-[0_1px_3px_rgb(22_25_28/0.08)] md:px-5" data-panel-list>
              {railLines.map((l, i) => (
                <div key={`r${i}`} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2.5 border-t border-line py-2 first:border-t-0">
                  <span className="font-display text-[18px] font-[680] leading-tight">
                    {l.count} × {mmc(l.len)}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-medium leading-snug">Rail{l.count === 1 ? '' : 's'}{g.joins.length ? ' (pieces)' : ''}</span>
                    {i === 0 ? <span className="text-[13px] leading-snug text-faint">{railNote}</span> : null}
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2.5 border-t border-line py-2">
                <span className="font-display text-[18px] font-[680] leading-tight">
                  {g.uprights} × {mmc(g.openH)}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium leading-snug">Uprights</span>
                  <span className="text-[13px] leading-snug text-faint">{g.rows === 1 ? 'Between the top and bottom rails' : `${g.n + 1} in each of ${g.rows} rows, between the rails`}</span>
                </span>
              </div>

              <p className="mb-1 mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-accent">To buy</p>
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2.5 border-t border-line py-2" data-panel-buy>
                <span className="font-display text-[18px] font-[680] leading-tight">{g.lengths.length}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium leading-snug">Lengths of {mmc(GRID.stock)}</span>
                  <span className="text-[13px] leading-snug text-faint">
                    {(g.total / 1000).toFixed(1)} m of batten, laid out cut by cut with {GRID.kerf} mm for each saw cut.
                    {g.lengths.length > g.lengthsByMetre ? ` By the metre plus ${GRID.waste}% it looks like ${g.lengthsByMetre}, but the cuts take ${g.lengths.length}.` : ''}
                  </span>
                </span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5" aria-label="Each length and the pieces cut from it" data-panel-lengths>
                {g.lengths.map((l, i) => (
                  <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2">
                    <span className="font-mono text-[11px] text-faint">{i + 1}</span>
                    <span className="pg-len" title={`${l.pieces.map((p) => `${p.kind === 'rail' ? 'rail' : 'upright'} ${mm1(p.len)}`).join(', ')}, ${mm1(l.left)} left`}>
                      {l.pieces.map((p, k) => (
                        <span key={k} className="pg-cut" data-kind={p.kind} style={{ width: `${(p.len / GRID.stock) * 100}%` }} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11.5px] text-faint">
                <span>
                  <span className="mr-1 inline-block size-2.5 rounded-[1px] bg-[#c6b28a] align-[-1px]" aria-hidden="true" />
                  rail
                </span>
                <span>
                  <span className="mr-1 inline-block size-2.5 rounded-[1px] bg-[var(--pg-batten)] align-[-1px]" aria-hidden="true" />
                  upright
                </span>
                <span>hatched: offcut</span>
              </p>
            </div>
          </section>
        ) : null}

        <RatherCard line="I panel walls across London. Send me your sizes and I'll quote, free." briefHref={gridBriefHref(g, job)} text={ok ? gridText(g, page) : ''} fallback={`Batten grid: ${mmc(inp.w)} wide`} />
        <AppLink href={gridAppHref(inp)} data="data-panel-app" />
        <p className="mt-3.5 text-[13.5px] leading-relaxed text-faint">
          {note ?? 'Measure the wall at the top and at the bottom: it’s rarely the same. The sums are for a flat, square wall; a slope or a step is cut to fit on site.'}
        </p>
      </div>
    </div>
  );
}
