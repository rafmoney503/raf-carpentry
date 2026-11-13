'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import { LogShape, NoteShape, PIECES, PUFFS } from './MiniRaf';
import {
  buildShow,
  CSS_POP,
  CSS_TRICK,
  frameAt,
  GROUND,
  legacyOf,
  nextActStart,
  nextShowIndex,
  RAF_X,
  readShowNow,
  saveShowNow,
  SHOW_HALF,
  type ShowFrame,
  type ShowNow,
} from '@/lib/mini-raf-show';

/* Mini Raf's show beside the name, on phones and tablets (Rafal, 13 Nov 2026; the timeline and the why are in
   src/lib/mini-raf-show.ts). The Navbar gives it the room between the name and the buttons; it plays there when that
   room is at least STAGE_MIN wide, under 1024 px (computers keep the page-by-page round in the name's place), and
   never for anyone who asked for less motion. When a show ends the next starts by itself, so it plays for as long as
   the page is open. It carries on from page to page (the Navbar stays put, and the time is kept for the tab), stops
   while the tab is hidden, and has a small button to pause it (WCAG 2.2.2: anything that moves for over 5 s).
   Taps: Raf skips to his next trick (in the wave at the end, to the next show); a piece plays its trick again (doors,
   drawers, books, the lamp, the TV). Raf, the log and the floor are moved here each frame; each piece's own moves are
   the page-by-page round's CSS keyframes, started from the moment it popped up. */

const STAGE_MIN = 104; // px: the scene (at least 76) and the button
const STAGE_MAX = 248;
const BUTTON = 28; // the 24 px button and the gap before it
const TICK = 15; // the floor's marks: a stretch (STEP, 120) is a whole number of them, so a new show starts on the same marks

export function stageFits(el: HTMLElement | null): boolean {
  if (!el || typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.matchMedia('(min-width: 1024px)').matches) return false;
  return el.clientWidth >= STAGE_MIN;
}

/* This tab's show (kept across pages here, and across reloads in sessionStorage) */
let now: ShowNow | null = null;
function current(): ShowNow {
  if (!now) now = readShowNow() ?? { n: nextShowIndex(), replay: false, legacy: [], t: 0, paused: false };
  return now;
}

export default function MiniRafStage({ stageRef, onActive }: { stageRef: RefObject<HTMLDivElement | null>; onActive: (on: boolean) => void }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wide = window.matchMedia('(min-width: 1024px)');
    const check = () => setBox(stageFits(el) ? { w: Math.min(STAGE_MAX, el.clientWidth), h: el.clientHeight || 40 } : null);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    reduce.addEventListener('change', check);
    wide.addEventListener('change', check);
    return () => {
      ro.disconnect();
      reduce.removeEventListener('change', check);
      wide.removeEventListener('change', check);
    };
  }, [stageRef]);
  const on = box !== null;
  useEffect(() => {
    onActive(on);
  }, [on, onActive]);
  return box ? <Stage w={box.w} h={box.h} /> : null;
}

const INK = '#16191c';
const BLUE = '#2547d0';

/* Raf: the same figure as the rounds' (src/components/MiniRaf.tsx), but every joint a group moved each frame: his
   place and turn (pos), the shadow, the lean about his feet, the bob, each leg about its hip, the top half about the
   hip (to go down on all fours) and each arm about its shoulder. The see-through box is for tapping him. */
function LegShape() {
  return (
    <>
      <rect x="-2.2" y="0" width="4.4" height="17.5" rx="2" fill="#2a2f35" />
      <rect x="-2.4" y="15.8" width="7" height="3.4" rx="1.5" fill={INK} />
    </>
  );
}

type Shown = { id: string; at: number; tap: number };

function shownAt(show: ReturnType<typeof buildShow>, ids: string[], t: number, before: Shown[] = []): Shown[] {
  return ids.map((id) => {
    const kept = before.find((p) => p.id === id);
    if (kept) return kept;
    const p = show.pieces.find((x) => x.id === id)!;
    // its keyframes from the moment it popped up (a piece popped long ago: at their end)
    return { id, at: -Math.min(7, CSS_POP + Math.max(0, t - p.popT)), tap: 0 };
  });
}

function Stage({ w, h }: { w: number; h: number }) {
  const sceneW = Math.max(60, w - BUTTON);
  const S = (sceneW * 80) / h;
  const [seed, setSeed] = useState<ShowNow>(() => ({ ...current() }));
  const show = useMemo(() => buildShow(seed.n, seed.replay, seed.legacy), [seed]);
  const [shown, setShown] = useState<Shown[]>(() => shownAt(show, frameAt(show, seed.t, S).pieces, seed.t));
  const [paused, setPaused] = useState(seed.paused);
  const [hidden, setHidden] = useState(false);

  const pos = useRef<SVGGElement>(null);
  const shadow = useRef<SVGGElement>(null);
  const lean = useRef<SVGGElement>(null);
  const bob = useRef<SVGGElement>(null);
  const legA = useRef<SVGGElement>(null);
  const legB = useRef<SVGGElement>(null);
  const upper = useRef<SVGGElement>(null);
  const armA = useRef<SVGGElement>(null);
  const armB = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const floor = useRef<SVGGElement>(null);
  const log = useRef<SVGGElement>(null);
  const notes = useRef<SVGGElement>(null);
  const bounce = useRef(new Map<string, SVGGElement>());
  const bounced = useRef<string | null>(null);
  const ids = useRef(shown.map((p) => p.id).join());

  // Put everything where the frame says. Attributes, not React: this runs every frame.
  const apply = useCallback(
    (f: ShowFrame) => {
      const r = f.raf;
      const set = (el: SVGElement | null, v: string) => el && el.setAttribute('transform', v);
      set(world.current, `translate(${(-f.off).toFixed(2)} 0)`);
      set(floor.current, `translate(${(-(f.off % TICK)).toFixed(2)} 0)`);
      set(pos.current, `translate(${r.x.toFixed(2)} ${(GROUND + r.y).toFixed(2)}) scale(${r.flip.toFixed(3)} 1)`);
      pos.current?.setAttribute('opacity', r.alpha.toFixed(2));
      set(shadow.current, `translate(${r.x.toFixed(2)} ${GROUND}) scale(${(1 + r.y / 30).toFixed(3)} 1)`);
      shadow.current?.setAttribute('opacity', r.alpha.toFixed(2));
      set(lean.current, `rotate(${r.lean.toFixed(2)})`);
      set(bob.current, `translate(0 ${r.bob.toFixed(2)})`);
      set(legA.current, `translate(-1.5 -20) rotate(${r.legA.toFixed(2)})`);
      set(legB.current, `translate(1.5 -20) rotate(${r.legB.toFixed(2)})`);
      set(upper.current, `translate(0 -20) rotate(${r.upper.toFixed(2)}) translate(0 20)`);
      set(armA.current, `translate(-1 -35) rotate(${r.armA.toFixed(2)})`);
      set(armB.current, `translate(1 -35) rotate(${r.armB.toFixed(2)})`);
      const l = log.current;
      if (l) {
        if (f.log) {
          l.setAttribute('transform', `translate(${f.log.x.toFixed(2)} ${f.log.y.toFixed(2)}) rotate(${f.log.rot.toFixed(1)}) scale(${f.log.scale.toFixed(3)})`);
          l.removeAttribute('display');
        } else l.setAttribute('display', 'none');
      }
      const ns = notes.current?.children;
      if (ns)
        for (let i = 0; i < ns.length; i++) {
          const n = f.notes[i];
          ns[i].setAttribute('opacity', n ? n.o.toFixed(2) : '0');
          if (n) ns[i].setAttribute('transform', `translate(${n.x.toFixed(2)} ${n.y.toFixed(2)})`);
        }
      const sq = f.squash;
      if (bounced.current && bounced.current !== sq?.id) bounce.current.get(bounced.current)?.setAttribute('transform', 'scale(1 1)');
      if (sq) bounce.current.get(sq.id)?.setAttribute('transform', `scale(${sq.sx.toFixed(3)} ${sq.sy.toFixed(3)})`);
      bounced.current = sq ? sq.id : null;
      svg.current?.setAttribute('data-mraf-act', f.act);
    },
    [],
  );
  // ... and the pieces on show, when that changes (one popped up, one went off the left)
  const sync = useCallback(
    (f: ShowFrame) => {
      const key = f.pieces.join();
      if (key === ids.current) return;
      ids.current = key;
      setShown((before) => shownAt(show, f.pieces, f.t, before));
    },
    [show],
  );

  // The next show: new pieces and colours, walking on from the ones just made.
  const replay = useCallback(() => {
    const next: ShowNow = { n: nextShowIndex(), replay: true, legacy: legacyOf(show), t: 0, paused: false };
    now = next;
    saveShowNow(next);
    const s2 = buildShow(next.n, true, next.legacy);
    const first = frameAt(s2, 0, S).pieces;
    ids.current = first.join();
    setShown(shownAt(s2, first, 0));
    setSeed({ ...next });
    setPaused(false);
  }, [show, S]);

  // The clock: runs while not paused and the tab is shown (frames stop by themselves when it is hidden; a long gap
  // counts as one frame, so he carries on where he was). At the end of a show it hands over to the next. A layout
  // effect, so the first frame of a show (the floor back at its start) is set before the new pieces are painted.
  useLayoutEffect(() => {
    const n = current();
    apply(frameAt(show, Math.min(n.t, show.end), S));
    if (paused) return;
    let id = 0;
    let last = 0;
    let saved = 0;
    const tick = (ts: number) => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      n.t += dt;
      const f = frameAt(show, n.t, S);
      apply(f);
      sync(f);
      if (ts - saved > 1000) {
        saveShowNow(n);
        saved = ts;
      }
      if (f.done) return replay();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [show, S, paused, apply, sync, replay]);

  useEffect(() => {
    const vis = () => setHidden(document.hidden);
    const away = () => saveShowNow(current());
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', away);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', away);
    };
  }, []);

  const togglePause = () => {
    const n = current();
    n.paused = !paused;
    saveShowNow(n);
    setPaused(n.paused);
  };

  const onTap = (e: MouseEvent<SVGSVGElement>) => {
    const el = (e.target as Element).closest('[data-tap]');
    if (!el) return;
    const n = current();
    if (paused) {
      // a tap while paused carries on first
      n.paused = false;
      saveShowNow(n);
      setPaused(false);
      return;
    }
    const what = el.getAttribute('data-tap');
    if (what === 'raf') {
      const t2 = nextActStart(show, n.t);
      if (t2 === null) return replay();
      n.t = t2;
    } else if (what) setShown((list) => list.map((p) => (p.id === what ? { ...p, at: -CSS_TRICK, tap: p.tap + 1 } : p)));
  };

  // For the checks (scratchpad tests): where the show is, and jumping to a moment of it.
  useEffect(() => {
    const w = window as unknown as { __miniRafShow?: unknown };
    w.__miniRafShow = {
      now: () => ({ ...current(), end: show.end, acts: show.acts }),
      seek: (t: number) => {
        current().t = t;
        const f = frameAt(show, t, S);
        apply(f);
        sync(f);
      },
    };
    return () => {
      delete w.__miniRafShow;
    };
  }, [show, S, apply, sync]);

  const ticks = useMemo(() => {
    const xs: number[] = [];
    for (let x = Math.floor(-S / TICK) * TICK - TICK; x <= TICK; x += TICK) xs.push(x);
    return xs;
  }, [S]);
  const pieces = shown.map((s) => ({ s, p: show.pieces.find((x) => x.id === s.id)! })).filter((x) => x.p);

  return (
    <div className="flex h-full items-center" style={{ width: w }}>
      <svg
        ref={svg}
        width={sceneW}
        height={h}
        viewBox={`${(-S).toFixed(2)} 0 ${S.toFixed(2)} 80`}
        className="mraf mraf-show flex-none"
        aria-hidden="true"
        focusable="false"
        data-mraf-show={seed.n}
        data-paused={paused || hidden ? '' : undefined}
        onClick={onTap}
      >
        <defs>
          <linearGradient id="mraf-stage-fade" gradientUnits="userSpaceOnUse" x1={-S} y1="0" x2={-S + Math.min(48, S * 0.22)} y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="mraf-stage-mask" maskUnits="userSpaceOnUse" x={-S} y="0" width={S} height="80">
            <rect x={-S} y="0" width={S} height="80" fill="url(#mraf-stage-fade)" />
          </mask>
        </defs>
        <line x1={-S} y1="74.5" x2="0" y2="74.5" stroke="#c7cac3" strokeWidth="0.8" />
        <g mask="url(#mraf-stage-mask)">
          <g ref={floor}>
            {ticks.map((x) => (
              <line key={x} x1={x} y1="74.5" x2={x - 3} y2="77.5" stroke="#c7cac3" strokeWidth="0.8" strokeLinecap="round" />
            ))}
          </g>
          <g ref={world}>
            {pieces.map(({ s, p }) => {
              const Piece = PIECES[p.kind];
              const half = Math.max(24, SHOW_HALF[p.kind] + 4);
              return (
                <g
                  key={`${s.id}:${s.tap}`}
                  transform={`translate(${p.x} ${GROUND})`}
                  className="mraf-piece"
                  data-tap={s.id}
                  data-mraf-piece={p.kind}
                  style={{ '--mraf-at': `${s.at.toFixed(2)}s` } as CSSProperties}
                >
                  <g
                    ref={(el) => {
                      if (el) bounce.current.set(s.id, el);
                      else bounce.current.delete(s.id);
                    }}
                  >
                    <rect x={-half} y="-66" width={half * 2} height="68" fill="transparent" />
                    <g className="mraf-pop">
                      <Piece c={p.colour} mm={p.mm} />
                    </g>
                  </g>
                  <g transform="translate(0 -28)">
                    {PUFFS.map(([cls, r, fill]) => (
                      <circle key={cls} className={cls} r={r} fill={fill} opacity="0" />
                    ))}
                  </g>
                </g>
              );
            })}
            <g ref={log} display="none">
              <LogShape />
            </g>
          </g>
        </g>
        <g ref={notes}>
          {[0, 1, 2, 3].map((i) => (
            <g key={i} opacity="0">
              <NoteShape />
            </g>
          ))}
        </g>

    <>
      <g ref={shadow} transform={`translate(${RAF_X} 74)`}>
        <ellipse cx="1" cy="0.6" rx="9" ry="1.6" fill={INK} opacity="0.12" />
      </g>
      <g ref={pos} transform={`translate(${RAF_X} 74)`} data-tap="raf">
        <rect x="-24" y="-62" width="48" height="66" fill="transparent" />
        <g ref={lean}>
          <g ref={bob}>
            <g ref={legA} transform="translate(-1.5 -20)">
              <LegShape />
            </g>
            <g ref={legB} transform="translate(1.5 -20)">
              <LegShape />
            </g>
            <g ref={upper}>
              <g ref={armA} transform="translate(-1 -35)">
                <rect x="-1.8" y="0" width="3.6" height="13" rx="1.8" fill="#1b38ad" />
                <circle cx="0" cy="13.4" r="2" fill="#f0c6a0" />
              </g>
              <rect x="-7" y="-38" width="14" height="20" rx="4" fill={BLUE} stroke={INK} strokeWidth="1.2" />
              <rect x="-7" y="-23.5" width="14" height="3" fill="#8a5a2b" />
              <rect x="-5.5" y="-23.2" width="3.5" height="3.5" rx="0.8" fill="#f2c230" stroke={INK} strokeWidth="0.6" />
              <path d="M-5.5 -43.5 L-1.5 -50.5" stroke="#f2c230" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="0.5" cy="-45" r="7" fill="#f0c6a0" stroke={INK} strokeWidth="1.2" />
              <circle cx="3.6" cy="-45.6" r="0.9" fill={INK} />
              <path d="M2.4 -42.2 Q4 -40.9 5.6 -42.6" stroke={INK} strokeWidth="0.8" fill="none" strokeLinecap="round" />
              <path d="M-6.6 -46.5 A7.2 7.2 0 0 1 7.6 -46.5 Z" fill={INK} />
              <rect x="4" y="-47.6" width="7" height="2" rx="1" fill={INK} />
              <g ref={armB} transform="translate(1 -35)">
                <rect x="-1.8" y="0" width="3.6" height="13" rx="1.8" fill={BLUE} stroke={INK} strokeWidth="0.9" />
                <circle cx="0" cy="13.4" r="2" fill="#f0c6a0" stroke={INK} strokeWidth="0.6" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </>
      </svg>
      <button
        type="button"
        onClick={togglePause}
        aria-label={paused ? 'Play the little animation' : 'Pause the little animation'}
        title={paused ? 'Play' : 'Pause'}
        data-mraf-button={paused ? 'play' : 'pause'}
        className="ml-1 grid h-6 w-6 flex-none place-items-center rounded-full border border-line-strong bg-mount text-muted transition-colors hover:border-ink hover:text-ink"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
          {paused ? (
            <path d="M3 1.8 L8.4 5 L3 8.2 Z" />
          ) : (
            <>
              <rect x="2.2" y="1.8" width="2" height="6.4" rx="0.5" />
              <rect x="5.8" y="1.8" width="2" height="6.4" rx="0.5" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
