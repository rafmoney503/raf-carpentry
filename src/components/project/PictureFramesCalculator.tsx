'use client';

import { useState, type CSSProperties } from 'react';
import { FRAMES, frames, framesAppHref, framesBriefHref, framesText, mm1, mmc, readMm, type FramesInput } from '@/lib/picture-frames-calc';
import { AppLink, Choice, CountAuto, MmField, RatherCard, Step } from './calc-parts';
import './panelling-calc.css';

/* "Work out your own wall" on a picture-frame panelling job page (8 Nov 2026, Raf: "add calculators to relevant
   jobs in jobkit new job form as you created in the wall panelling job", then "Go"): the picture frames from the
   Workshop Tools app, started with the job's sizes. The wall drawn to scale with the frames below and above the dado
   rail, the questions beside it, then what to cut and what to buy (the lengths laid out cut by cut), Get a quote,
   the list to WhatsApp, and the same sizes opened in the app. The sums are in src/lib/picture-frames-calc.ts,
   checked against the app by scripts/picture-frames-calc/check.mjs. */

type Start = Partial<FramesInput> & { w: number; ceiling: number };
type Key = 'w' | 'ceiling' | 'skirting' | 'railTop' | 'railH' | 'mould' | 'around' | 'between';

const show = (v: number) => mm1(v);

export default function PictureFramesCalculator({ start, job, page, note }: { start: Start; job: string; page: string; note?: string }) {
  const first: FramesInput = {
    w: start.w,
    ceiling: start.ceiling,
    skirting: start.skirting ?? 100,
    railTop: start.railTop ?? 1000,
    railH: start.railH ?? 45,
    mould: start.mould ?? 22,
    around: start.around ?? 100,
    between: start.between ?? 100,
    frames: start.frames ?? 0,
    upper: start.upper ?? true,
  };
  const keys: Key[] = ['w', 'ceiling', 'skirting', 'railTop', 'railH', 'mould', 'around', 'between'];
  const [inp, setInp] = useState<FramesInput>(first);
  const [text, setText] = useState<Record<Key, string>>(() => Object.fromEntries(keys.map((k) => [k, show(first[k])])) as Record<Key, string>);

  const f = frames(inp);
  const ok = !f.error;
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
  const framesNow = f.n || f.autoN || inp.frames || 1;
  const setFrames = (n: number) => setInp((cur) => ({ ...cur, frames: Math.min(FRAMES.maxFrames, Math.max(0, n)) }));
  const badBox = keys.some((k) => readMm(text[k]) === null);
  const field = (k: Key, id: string, label: string, step: number, min = 0) => (
    <MmField id={id} label={label} text={text[k]} onText={typed(k)} step={step} onStep={stepped(k)} read={readMm} min={min} />
  );

  // the drawing, in mm from the floor up
  const vw = Math.max(1, inp.w);
  const vh = Math.max(1, inp.ceiling);
  const y = (fromFloor: number) => vh - fromFloor;
  const mid = ok ? Math.floor((f.n - 1) / 2) : 0;
  const frameAt = (x: number, bot: number, h: number, key: string) => (
    <g key={key}>
      <rect x={x} y={y(bot + h)} width={f.fw} height={h} className="pf-mould" />
      <rect x={x + inp.mould} y={y(bot + h - inp.mould)} width={Math.max(0, f.fw - 2 * inp.mould)} height={Math.max(0, h - 2 * inp.mould)} className="pg-wallfill pf-inner" />
    </g>
  );
  const labelOk = (h: number) => ok && f.fw / vw >= 0.1 && h / vh >= 0.12;

  // what to cut
  const tops = f.n * 2 * (inp.upper ? 2 : 1);
  const lowSides = f.n * 2;
  const upSides = inp.upper ? f.n * 2 : 0;

  return (
    <div className="pg grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12" data-frames-calc>
      {/* the answer and the wall, to scale */}
      <div className="lg:sticky lg:top-[88px] lg:col-span-7 lg:self-start">
        <div className="pg-card overflow-hidden rounded-sm border border-line bg-mount shadow-[0_1px_3px_rgb(22_25_28/0.08)]">
          <div className="pg-ans px-5 pb-4 pt-4 md:px-6 md:pb-5 md:pt-5" aria-live="polite" data-frames-answer>
            <span className="pg-tk tl" aria-hidden="true" />
            <span className="pg-tk tr" aria-hidden="true" />
            <span className="pg-tk bl" aria-hidden="true" />
            <span className="pg-tk br" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[#f6f7f4]/65">
              <span>Picture frames · {mmc(inp.w)} wide</span>
              <span>{inp.upper ? 'above and below the rail' : 'below the rail'}</span>
            </div>
            {ok ? (
              <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="flex flex-wrap gap-x-6 gap-y-2" data-frames-sizes>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--pg-blue)]">Below the rail</p>
                    <p className="mt-1 font-display text-[clamp(26px,7cqw,38px)] font-[680] leading-none tracking-[-0.02em]">
                      {mm1(f.fw)} <span className="text-[#f6f7f4]/55">×</span> {mm1(f.lh)}
                    </p>
                  </div>
                  {inp.upper ? (
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--pg-blue)]">Above it</p>
                      <p className="mt-1 font-display text-[clamp(26px,7cqw,38px)] font-[680] leading-none tracking-[-0.02em]">
                        {mm1(f.fw)} <span className="text-[#f6f7f4]/55">×</span> {mm1(f.uh)}
                      </p>
                    </div>
                  ) : null}
                </div>
                <dl className="grid grid-cols-3 gap-x-5 gap-y-1 text-right font-mono">
                  {[
                    [String(f.frames), f.frames === 1 ? 'frame' : 'frames'],
                    [String(f.lengths.length), 'moulding'],
                    [String(f.railLengths), 'rail'],
                  ].map(([v, k]) => (
                    <div key={k} className="flex flex-col-reverse">
                      <dt className="mt-1 text-[10.5px] uppercase tracking-[0.06em] text-[#f6f7f4]/60">{k}</dt>
                      <dd className="font-display text-[22px] font-[650] leading-none">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="mt-2 text-[15px] leading-snug text-[#ffd9a8]" data-frames-error>
                {f.error}
              </p>
            )}
          </div>

          <div className="px-3.5 pb-3.5 pt-5 md:px-5 md:pb-5">
            <div className="pg-wall pf-wall" style={{ '--pg-ratio': String(vw / vh) } as CSSProperties}>
              <div className="pg-draw">
                <svg className="pg-svg" viewBox={`0 0 ${vw} ${vh}`} role="img" aria-label={ok ? `The wall to scale, ${mmc(f.W)} wide and ${mmc(inp.ceiling)} to the ceiling, with ${f.n} frames below the dado rail${inp.upper ? ` and ${f.n} above it` : ''}` : 'The wall to scale'}>
                  <rect x="0" y="0" width={vw} height={vh} className="pg-wallfill" />
                  {inp.skirting > 0 ? <rect x="0" y={y(inp.skirting)} width={vw} height={inp.skirting} className="pg-skirt" /> : null}
                  {ok ? <rect x="0" y={y(inp.railTop)} width={vw} height={Math.max(1, inp.railH)} className="pg-bat" /> : null}
                  {ok && f.railPieces.length > 1
                    ? f.railPieces.slice(0, -1).map((_, i) => {
                        const at = f.railPieces.slice(0, i + 1).reduce((s, p) => s + p, 0);
                        return <line key={i} x1={at} x2={at} y1={y(inp.railTop)} y2={y(f.railBot)} className="pg-join" />;
                      })
                    : null}
                  {ok ? f.xs.map((x, i) => frameAt(x, f.lowBot, f.lh, `l${i}`)) : null}
                  {ok && inp.upper ? f.xs.map((x, i) => frameAt(x, f.upBot, f.uh, `u${i}`)) : null}
                  <line x1="0" x2={vw} y1={0} y2={0} className="pf-ceil" />
                  <line x1="0" x2={vw} y1={vh} y2={vh} className="pg-floor" />
                </svg>
                {labelOk(f.lh) ? (
                  <span className="pg-label" style={{ left: `${((f.xs[mid] + f.fw / 2) / vw) * 100}%`, top: `${(y(f.lowBot + f.lh / 2) / vh) * 100}%` }} aria-hidden="true">
                    {mm1(f.fw)}
                    <br />× {mm1(f.lh)}
                  </span>
                ) : null}
                {inp.upper && labelOk(f.uh) ? (
                  <span className="pg-label" style={{ left: `${((f.xs[mid] + f.fw / 2) / vw) * 100}%`, top: `${(y(f.upBot + f.uh / 2) / vh) * 100}%` }} aria-hidden="true">
                    {mm1(f.fw)}
                    <br />× {mm1(f.uh)}
                  </span>
                ) : null}
              </div>
              <div className="pg-dimh" aria-hidden="true">
                <span className="pg-tick" />
                <span className="pg-line" />
                <span className="pg-num">{mmc(inp.ceiling)}</span>
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
                {mmc(inp.w)} × {mmc(inp.ceiling)} · {ok ? `${f.n} across` : '–'}
              </span>
              <span>{ok ? `rail ${mm1(f.railBot)} to ${mm1(inp.railTop)} from the floor` : ''}</span>
            </div>
            {ok ? (
              <div className="mt-3" data-frames-marks>
                <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">Frames, left edge from the left end</p>
                <ol className="mt-1.5 flex flex-wrap gap-1.5">
                  {f.xs.map((x, i) => (
                    <li key={i} className="rounded-sm border border-line bg-paper px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
                      {mmc(x)}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 font-mono text-[12px] text-muted">
                  Bottoms at {mm1(f.lowBot)}
                  {inp.upper ? ` and ${mm1(f.upBot)}` : ''} from the floor
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-5">
        {/* phones and tablets: the answer stays in sight under the menu while the sizes are changed */}
        <p
          className="sticky top-[65px] z-10 -mx-1 mb-5 flex min-h-10 flex-wrap items-center justify-between gap-x-3 rounded-sm bg-ink px-3 py-2 font-mono text-[12.5px] text-[#f6f7f4] shadow-[0_6px_16px_-10px_rgb(22_25_28/0.7)] md:top-[73px] lg:hidden"
          aria-hidden="true"
          data-frames-strip
        >
          {ok ? (
            <>
              <span>
                <span className="text-[var(--pg-blue)]">Frames</span> {mm1(f.fw)} × {mm1(f.lh)}
                {inp.upper ? ` · ${mm1(f.uh)}` : ''}
              </span>
              <span className="text-[#f6f7f4]/70">
                {f.n} across · {f.lengths.length} lengths
              </span>
            </>
          ) : (
            <span className="text-[#ffd9a8]">Check the sizes</span>
          )}
        </p>

        <div className="flex flex-col gap-6">
          <Step n="01" title="The wall">
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              {field('w', 'pf-w', 'Wall width', 10, 1)}
              {field('ceiling', 'pf-ch', 'Floor to ceiling', 10, 1)}
            </div>
          </Step>
          <Step n="02" title="Skirting and dado rail">
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              {field('skirting', 'pf-sk', 'Skirting', 5)}
              {field('railH', 'pf-rh', 'Rail height', 5)}
              <div className="min-[380px]:col-span-2">{field('railTop', 'pf-rt', 'Top of the rail, from the floor', 10, 1)}</div>
            </div>
          </Step>
          <Step n="03" title="Frames">
            <CountAuto id="pf-n" label="Frames across" unit="frame" shown={ok || f.n ? framesNow : null} auto={inp.frames === 0} autoSub={`about ${FRAMES.target} wide`} onSet={setFrames} max={FRAMES.maxFrames} dataAttr="data-frames-n" />
            <div className="mt-3 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              {field('around', 'pf-ga', 'Gap round them', 5)}
              {field('between', 'pf-gb', 'Gap between', 5)}
              <div className="min-[380px]:col-span-2">{field('mould', 'pf-mw', 'Moulding width', 1, 5)}</div>
            </div>
          </Step>
          <Step n="04" title="Above the rail">
            <Choice
              options={[
                { v: true, label: 'Frames', sub: 'up to the ceiling' },
                { v: false, label: 'Plain wall', sub: 'frames below only' },
              ]}
              value={inp.upper}
              onPick={(upper) => setInp((cur) => ({ ...cur, upper }))}
            />
          </Step>
          {badBox ? <p className="-mt-2 font-mono text-[12.5px] text-accent">Type each size in mm, like 4200</p> : null}
        </div>

        {/* what to cut and what to buy */}
        {ok ? (
          <section className="mt-9" aria-labelledby="pf-list">
            <h3 id="pf-list" className="font-display text-[26px] font-[680] tracking-[-0.015em]">
              What to cut
            </h3>
            <div className="mt-3 rounded-sm border border-line bg-mount px-3.5 pb-3 pt-1 shadow-[0_1px_3px_rgb(22_25_28/0.08)] md:px-5" data-frames-list>
              {[
                { count: tops, len: f.fw, what: 'Tops and bottoms', sub: 'Each cut to its long point, mitred at 45°' },
                { count: lowSides, len: f.lh, what: 'Sides below the rail', sub: '' },
                ...(inp.upper ? [{ count: upSides, len: f.uh, what: 'Sides above the rail', sub: '' }] : []),
              ].map((l) => (
                <div key={l.what} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2.5 border-t border-line py-2 first:border-t-0">
                  <span className="font-display text-[18px] font-[680] leading-tight">
                    {l.count} × {mmc(l.len)}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-medium leading-snug">{l.what}</span>
                    {l.sub ? <span className="text-[13px] leading-snug text-faint">{l.sub}</span> : null}
                  </span>
                </div>
              ))}

              <p className="mb-1 mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-accent">To buy</p>
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2.5 border-t border-line py-2" data-frames-buy>
                <span className="font-display text-[18px] font-[680] leading-tight">{f.lengths.length}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium leading-snug">Lengths of {mmc(FRAMES.stock)} moulding</span>
                  <span className="text-[13px] leading-snug text-faint">
                    {(f.total / 1000).toFixed(1)} m round the frames, laid out cut by cut: a moulding&apos;s width spare for each mitre and {FRAMES.kerf} mm for each saw cut.
                    {f.lengths.length > f.lengthsByMetre ? ` By the metre plus ${FRAMES.waste}% it looks like ${f.lengthsByMetre}, but the cuts take ${f.lengths.length}.` : ''}
                  </span>
                </span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5" aria-label="Each length and the pieces cut from it" data-frames-lengths>
                {f.lengths.map((l, i) => (
                  <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2">
                    <span className="font-mono text-[11px] text-faint">{i + 1}</span>
                    <span className="pg-len" title={`${l.pieces.map((p) => `${p.side === 'top' ? 'top or bottom' : p.row === 'lower' ? 'side, below' : 'side, above'} ${mm1(p.len)}`).join(', ')}, ${mm1(l.left)} left`}>
                      {l.pieces.map((p, k) => (
                        <span key={k} className="pg-cut" data-kind={p.side === 'top' ? 'rail' : 'upright'} style={{ width: `${((p.len + inp.mould) / FRAMES.stock) * 100}%` }} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11.5px] text-faint">
                <span>
                  <span className="mr-1 inline-block size-2.5 rounded-[1px] bg-[#c6b28a] align-[-1px]" aria-hidden="true" />
                  top or bottom
                </span>
                <span>
                  <span className="mr-1 inline-block size-2.5 rounded-[1px] bg-[var(--pg-batten)] align-[-1px]" aria-hidden="true" />
                  side
                </span>
                <span>hatched: offcut</span>
              </p>
              <div className="mt-3 grid grid-cols-[112px_minmax(0,1fr)] gap-2.5 border-t border-line py-2" data-frames-rail>
                <span className="font-display text-[18px] font-[680] leading-tight">{f.railLengths}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium leading-snug">
                    Lengths of {mmc(FRAMES.railStock)} dado rail
                  </span>
                  <span className="text-[13px] leading-snug text-faint">{f.railPieces.length > 1 ? `Cut as ${f.railPieces.map(mmc).join(' + ')} along the wall` : `One piece, cut to ${mmc(f.W)}`}</span>
                </span>
              </div>
            </div>
          </section>
        ) : null}

        <RatherCard line="I panel walls across London. Send me your sizes and I'll quote, free." briefHref={framesBriefHref(f, job)} text={ok ? framesText(f, page) : ''} fallback={`Picture frames: ${mmc(inp.w)} wide`} />
        <AppLink href={framesAppHref(inp)} data="data-frames-app" />
        <p className="mt-3.5 text-[13.5px] leading-relaxed text-faint">
          {note ?? 'The sums are for a plain wall. Round a door, a window or a radiator, size those frames to keep the same gaps, and measure the wall at the top and the bottom: it’s rarely the same.'}
        </p>
      </div>
    </div>
  );
}
