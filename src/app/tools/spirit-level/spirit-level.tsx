'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bubbleReach,
  edgeTilt,
  edgeWords,
  flatTilt,
  flatWords,
  fmtDeg,
  isLevel,
  nearestAxis,
  norm,
  screenAxis,
  toScreen,
  upFromAngles,
  wrap180,
  type Axis,
  type Mode,
  type Vec,
} from '@/lib/level-math';
import './spirit-level.css';

/* The phone spirit level (Raf, 17 Oct 2026: 'phones have different buttons it is difficult to make it level so ...
   a tara button which set level to zero and then move left right as you like to find right angle').
   Start asks for the motion sensor (iPhone asks on a tap), then the level fills the screen. It works out by itself
   whether the phone is on its edge or lying flat. Set zero: read from this surface from now on. Flip check: two
   readings, end for end, give the phone's own error on that edge, taken off every reading and remembered on this
   phone. Hold freezes the reading, Beep sounds once each time it comes level. The sums are in src/lib/level-math.ts. */

type Phase = 'idle' | 'asking' | 'running' | 'denied' | 'nosensor';
type Tare = { mode: 'edge'; axis: Axis; t0: number } | { mode: 'flat'; x0: number; y0: number };
type Bias = { edge: Partial<Record<Axis, number>>; flat: { x: number; y: number } | null };
type Shown = {
  mode: Mode;
  deg: number; // the big number: edge tilt, or lying flat the tilt either way
  x: number; // lying flat, on the screen: right side up positive
  y: number; // lying flat, on the screen: far end up positive
  turned: boolean; // on an edge the screen hasn't turned with the phone (rotation lock)
  faceDown: boolean;
};
type Flip = { mode: 'edge'; axis: Axis; first: number } | { mode: 'flat'; first: { x: number; y: number } };

const LENGTHS = [600, 900, 1200, 2400];
const BIAS_KEY = 'raf_level_bias';
const BEEP_KEY = 'raf_level_beep';
const LEN_KEY = 'raf_level_len';
const TAU = 0.18; // seconds, smoothing

function readStore<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private window: works for this visit only */
  }
}

function screenAngle() {
  if (typeof window === 'undefined') return 0;
  const o = (screen as Screen & { orientation?: { angle?: number } }).orientation;
  const a = typeof o?.angle === 'number' ? o.angle : Number((window as unknown as { orientation?: number }).orientation ?? 0);
  return ((a % 360) + 360) % 360;
}

const EDGE_NAME: Record<Axis, string> = { 'y+': 'bottom edge', 'y-': 'top edge', 'x+': 'left edge', 'x-': 'right edge' };

export default function SpiritLevel({ qrSvg }: { qrSvg: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [shown, setShown] = useState<Shown | null>(null);
  const [held, setHeld] = useState<Shown | null>(null);
  const [tare, setTare] = useState<Tare | null>(null);
  const [bias, setBias] = useState<Bias>({ edge: {}, flat: null });
  const [len, setLen] = useState(600);
  const [beep, setBeep] = useState(true);
  const [busy, setBusy] = useState<'zero' | 'flip' | null>(null);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [note, setNote] = useState('');
  const [computer, setComputer] = useState(false);

  const raw = useRef<Vec | null>(null);
  const filt = useRef<Vec | null>(null);
  const lastT = useRef(0);
  const samples = useRef<Vec[] | null>(null);
  const modeRef = useRef<Mode>('edge');
  const axisRef = useRef<Axis>('y+');
  const audio = useRef<AudioContext | null>(null);
  const armed = useRef(true);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const live = useRef({ tare, bias, beep, held, busy });
  live.current = { tare, bias, beep, held, busy };

  // Settings kept on this phone
  useEffect(() => {
    setBias(readStore<Bias>(BIAS_KEY, { edge: {}, flat: null }));
    setBeep(readStore<boolean>(BEEP_KEY, true));
    const l = readStore<number>(LEN_KEY, 600);
    if (LENGTHS.includes(l)) setLen(l);
    // A computer: no touch screen, or a mouse as the main pointer. Phones and tablets get no QR code.
    setComputer(navigator.maxTouchPoints === 0 || window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);

  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    const u = upFromAngles(e.beta, e.gamma);
    raw.current = u;
    const now = performance.now();
    const f = filt.current;
    if (!f) filt.current = u;
    else {
      const dt = Math.min(0.5, (now - lastT.current) / 1000);
      const k = 1 - Math.exp(-dt / TAU);
      filt.current = norm({ x: f.x + (u.x - f.x) * k, y: f.y + (u.y - f.y) * k, z: f.z + (u.z - f.z) * k });
    }
    lastT.current = now;
    samples.current?.push(u);
  }, []);

  // Works out what to show from the smoothed reading, once a frame.
  useEffect(() => {
    if (phase !== 'running') return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const u = filt.current;
      if (!u) return;
      const { tare: tr, bias: bs, beep: bp, held: hd, busy: by } = live.current;
      const az = Math.abs(u.z);
      if (modeRef.current === 'edge' && az > 0.77) modeRef.current = 'flat';
      else if (modeRef.current === 'flat' && az < 0.64) modeRef.current = 'edge';
      const mode = modeRef.current;
      const angle = screenAngle();
      let s: Shown;
      if (mode === 'edge') {
        const axis = tr?.mode === 'edge' ? tr.axis : nearestAxis(u, axisRef.current);
        axisRef.current = axis;
        const t = edgeTilt(u, axis);
        const deg = tr?.mode === 'edge' ? wrap180(t - tr.t0) : t - (bs.edge[axis] ?? 0);
        s = { mode, deg, x: 0, y: 0, turned: axis !== screenAxis(angle), faceDown: false };
      } else {
        const f = flatTilt(u);
        const b = tr?.mode === 'flat' ? { x: tr.x0, y: tr.y0 } : bs.flat ?? { x: 0, y: 0 };
        const p = toScreen(f.x - b.x, f.y - b.y, angle);
        s = { mode, deg: Math.hypot(p.x, p.y), x: p.x, y: p.y, turned: false, faceDown: u.z < 0 };
      }
      setShown(s);
      // Beep once each time it comes level; ready again once it has moved 0.15 off.
      if (!hd && !by && !s.faceDown) {
        const lv = mode === 'edge' ? isLevel(s.deg) : isLevel(s.x) && isLevel(s.y);
        if (lv && armed.current) {
          armed.current = false;
          if (bp) chirp();
        } else if (!lv && s.deg > 0.15) armed.current = true;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Keep the screen on while the level is open
  useEffect(() => {
    if (phase !== 'running') return;
    const ask = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        if (nav.wakeLock && document.visibilityState === 'visible') wake.current = await nav.wakeLock.request('screen');
      } catch {
        /* not allowed: the phone may dim as usual */
      }
    };
    ask();
    const onVis = () => {
      if (document.visibilityState === 'visible') ask();
    };
    document.addEventListener('visibilitychange', onVis);
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      wake.current?.release().catch(() => {});
      wake.current = null;
      root.style.overflow = before;
    };
  }, [phase]);

  useEffect(() => () => window.removeEventListener('deviceorientation', onOrient), [onOrient]);

  function chirp() {
    const ctx = audio.current;
    try {
      (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(25);
    } catch {
      /* no vibration */
    }
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 1320;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.15);
    } catch {
      /* no sound */
    }
  }

  async function start() {
    // The sound and the motion permission both have to start inside the tap.
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC && !audio.current) audio.current = new AC();
      audio.current?.resume().catch(() => {});
    } catch {
      /* no sound */
    }
    const DOE = typeof window !== 'undefined' ? (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent : undefined;
    if (!DOE) {
      setPhase('nosensor');
      return;
    }
    if (typeof DOE.requestPermission === 'function') {
      setPhase('asking');
      try {
        const r = await DOE.requestPermission();
        if (r !== 'granted') {
          setPhase('denied');
          return;
        }
      } catch {
        setPhase('denied');
        return;
      }
    }
    filt.current = null;
    raw.current = null;
    window.addEventListener('deviceorientation', onOrient);
    setPhase('running');
    setNote('');
    // A computer has the event but never sends a reading.
    window.setTimeout(() => {
      if (!raw.current) {
        window.removeEventListener('deviceorientation', onOrient);
        setPhase('nosensor');
      }
    }, 1600);
  }

  function close() {
    window.removeEventListener('deviceorientation', onOrient);
    setPhase('idle');
    setShown(null);
    setHeld(null);
    setFlip(null);
    setBusy(null);
  }

  // Waits for the tap's wobble to pass, then averages the phone for a moment.
  function settle(): Promise<Vec | null> {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        samples.current = [];
        window.setTimeout(() => {
          const list = samples.current ?? [];
          samples.current = null;
          if (!list.length) return resolve(filt.current);
          const sum = list.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, z: a.z + v.z }), { x: 0, y: 0, z: 0 });
          resolve(norm(sum));
        }, 650);
      }, 350);
    });
  }

  async function setZero() {
    if (busy) return;
    setBusy('zero');
    setHeld(null);
    setFlip(null);
    const u = await settle();
    setBusy(null);
    if (!u) return;
    if (modeRef.current === 'edge') {
      const axis = nearestAxis(u);
      axisRef.current = axis;
      setTare({ mode: 'edge', axis, t0: edgeTilt(u, axis) });
    } else {
      const f = flatTilt(u);
      setTare({ mode: 'flat', x0: f.x, y0: f.y });
    }
    armed.current = false;
    setNote('');
  }

  async function doFlip() {
    if (busy) return;
    setBusy('flip');
    setHeld(null);
    const u = await settle();
    setBusy(null);
    if (!u) return;
    const mode = modeRef.current;
    if (!flip) {
      if (mode === 'edge') {
        const axis = nearestAxis(u);
        setFlip({ mode, axis, first: edgeTilt(u, axis) });
      } else setFlip({ mode, first: flatTilt(u) });
      setNote('');
      return;
    }
    if (flip.mode !== mode) {
      setNote(flip.mode === 'edge' ? 'The phone is lying flat now. Stand it on the same edge, turned end for end.' : 'The phone is on its edge now. Lay it flat again, turned round.');
      return;
    }
    if (flip.mode === 'edge') {
      const axis = nearestAxis(u);
      if (axis !== flip.axis) {
        setNote(`That's a different edge down. Keep the ${EDGE_NAME[flip.axis]} on the surface and turn the phone end for end.`);
        return;
      }
      const b = (flip.first + edgeTilt(u, axis)) / 2;
      const next: Bias = { ...bias, edge: { ...bias.edge, [axis]: b } };
      setBias(next);
      writeStore(BIAS_KEY, next);
      setNote(`Flip check done. On this edge your phone reads ${Math.abs(b).toFixed(1)}° out on its own. That's taken off now, and remembered on this phone.`);
    } else {
      const f = flatTilt(u);
      const b = { x: (flip.first.x + f.x) / 2, y: (flip.first.y + f.y) / 2 };
      const next: Bias = { ...bias, flat: b };
      setBias(next);
      writeStore(BIAS_KEY, next);
      setNote(`Flip check done. Lying flat your phone reads ${Math.hypot(b.x, b.y).toFixed(1)}° out on its own (often the camera bump). That's taken off now, and remembered on this phone.`);
    }
    setFlip(null);
    setTare(null);
    armed.current = false;
  }

  function clearBias() {
    const mode = modeRef.current;
    const next: Bias = mode === 'edge' ? { ...bias, edge: { ...bias.edge, [axisRef.current]: undefined } } : { ...bias, flat: null };
    setBias(next);
    writeStore(BIAS_KEY, next);
    setNote('');
  }

  const pickLen = (l: number) => {
    setLen(l);
    writeStore(LEN_KEY, l);
  };
  const toggleBeep = () => {
    setBeep(!beep);
    writeStore(BEEP_KEY, !beep);
    audio.current?.resume().catch(() => {});
  };

  const s = held ?? shown;
  const open = phase === 'running';

  return (
    <>
      <StartCard phase={phase} onStart={start} computer={computer} qrSvg={qrSvg} />
      {open ? (
        <div className="lv-app" role="dialog" aria-modal="true" aria-label="Spirit level">
          <div className="lv-top">
            <p className="lv-title">Spirit level</p>
            <p className="lv-mode">{s ? (s.mode === 'edge' ? 'On its edge' : 'Lying flat') : 'Starting'}</p>
            <button type="button" className="lv-done" onClick={close}>
              Done
            </button>
          </div>
          {s ? (
            <Reading
              s={s}
              len={len}
              tare={tare}
              bias={bias}
              axis={axisRef.current}
              held={!!held}
              busy={busy}
              flip={flip}
              note={note}
              beep={beep}
              onLen={pickLen}
              onZero={setZero}
              onClearZero={() => setTare(null)}
              onClearBias={clearBias}
              onHold={() => setHeld(held ? null : shown)}
              onFlip={doFlip}
              onCancelFlip={() => {
                setFlip(null);
                setNote('');
              }}
              onBeep={toggleBeep}
            />
          ) : (
            <p className="lv-wait">Getting the first reading...</p>
          )}
        </div>
      ) : null}
    </>
  );
}

function Reading(p: {
  s: Shown;
  len: number;
  tare: Tare | null;
  bias: Bias;
  axis: Axis;
  held: boolean;
  busy: 'zero' | 'flip' | null;
  flip: Flip | null;
  note: string;
  beep: boolean;
  onLen: (l: number) => void;
  onZero: () => void;
  onClearZero: () => void;
  onClearBias: () => void;
  onHold: () => void;
  onFlip: () => void;
  onCancelFlip: () => void;
  onBeep: () => void;
}) {
  const { s, len, tare } = p;
  const fromZero = !!tare && tare.mode === s.mode;
  const words = s.mode === 'edge' ? edgeWords(s.deg, len, fromZero) : flatWords(s.x, s.y, len, fromZero);
  const level = !s.faceDown && (s.mode === 'edge' ? isLevel(s.deg) : isLevel(s.x) && isLevel(s.y));
  const biasNow = s.mode === 'edge' ? p.bias.edge[p.axis] : p.bias.flat ? Math.hypot(p.bias.flat.x, p.bias.flat.y) : undefined;

  let status: { text: string; clear?: () => void; tone: 'zero' | 'bias' | 'plain' };
  if (fromZero) status = { text: 'Reading from your zero', clear: p.onClearZero, tone: 'zero' };
  else if (biasNow !== undefined) status = { text: `Flip checked: ${Math.abs(biasNow).toFixed(1)}° phone error taken off`, clear: p.onClearBias, tone: 'bias' };
  else status = { text: 'Straight from the phone. Phones are often a little out: Set zero or Flip check.', tone: 'plain' };

  const flipping = !!p.flip;
  return (
    <div className="lv-body">
      <div className="lv-view">
        {s.mode === 'edge' ? <EdgeVial deg={s.deg} /> : <FlatVial x={s.x} y={s.y} />}
        <p className={`lv-read${level && !s.faceDown ? ' on' : ''}`} aria-live="off">
          <span className="lv-num">{s.faceDown ? '–' : fmtDeg(s.deg)}</span>
          <span className={`lv-tick${level ? ' on' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 5.2l2 2 4-4.4" />
            </svg>
          </span>
        </p>
        <p className={`lv-dir${level ? ' on' : ''}`}>{s.faceDown ? 'Turn the phone face up' : words.dir}</p>
        <p className="lv-fix">{(!s.faceDown && words.fix) || ' '}</p>
        {s.turned && !fromZero ? <p className="lv-warn">The screen hasn&apos;t turned with the phone, so left and right are swapped round. Turn off rotation lock.</p> : null}
        {p.held ? <p className="lv-held">Held. Tap Hold again to go live.</p> : null}
      </div>

      <div className="lv-side">
        <div className="lv-lens" role="group" aria-label="Length of what you are levelling, in mm">
          <span className="lv-lab">Over</span>
          {LENGTHS.map((l) => (
            <button key={l} type="button" aria-pressed={p.len === l} className={`lv-chip${p.len === l ? ' on' : ''}`} onClick={() => p.onLen(l)}>
              {l}
            </button>
          ))}
        </div>

        <div className={`lv-status ${status.tone}`}>
          <span className="lv-dot" aria-hidden="true" />
          <span className="lv-status-text">{status.text}</span>
          {status.clear ? (
            <button type="button" className="lv-link" onClick={status.clear}>
              Clear
            </button>
          ) : null}
        </div>

        {flipping ? (
          <div className="lv-flip">
            <p>
              <b>First reading saved.</b>{' '}
              {p.flip?.mode === 'edge'
                ? 'Turn the phone end for end on the same spot, same edge down. The screen will face away: lean over and tap Second reading.'
                : 'Spin the phone round half a turn on the same spot, still face up, then tap Second reading.'}
            </p>
            <button type="button" className="lv-link" onClick={p.onCancelFlip}>
              Cancel
            </button>
          </div>
        ) : null}
        {p.note ? <p className="lv-note">{p.note}</p> : null}

        <button type="button" className="lv-zero" onClick={p.onZero} disabled={!!p.busy || flipping}>
          {p.busy === 'zero' ? 'Hold still...' : 'Set zero here'}
        </button>
        <div className="lv-row">
          <button type="button" className={`lv-btn${p.held ? ' on' : ''}`} aria-pressed={p.held} onClick={p.onHold} disabled={!!p.busy}>
            Hold
          </button>
          <button type="button" className={`lv-btn${flipping ? ' go' : ''}`} onClick={p.onFlip} disabled={!!p.busy}>
            {p.busy === 'flip' ? 'Hold still...' : flipping ? 'Second reading' : 'Flip check'}
          </button>
          <button type="button" className="lv-btn" aria-pressed={p.beep} onClick={p.onBeep}>
            {p.beep ? 'Beep on' : 'Beep off'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EdgeVial({ deg }: { deg: number }) {
  const r = bubbleReach(deg);
  return (
    <div className="lv-bar" aria-hidden="true">
      <span className="lv-hole" />
      <span className="lv-vial">
        <span className="lv-mark" />
        <span className="lv-mark" />
        <span className="lv-bubble" style={{ transform: `translateX(calc(${(Math.sign(deg) * r).toFixed(3)} * var(--lv-reach)))` }} />
      </span>
      <span className="lv-hole" />
    </div>
  );
}

function FlatVial({ x, y }: { x: number; y: number }) {
  const m = Math.hypot(x, y);
  const k = m > 0 ? bubbleReach(m) / m : 0;
  return (
    <div className="lv-eye" aria-hidden="true">
      <span className="lv-ring r1" />
      <span className="lv-ring r2" />
      <span className="lv-cross" />
      <span className="lv-ball" style={{ transform: `translate(calc(${(x * k).toFixed(3)} * var(--lv-reach)), calc(${(-y * k).toFixed(3)} * var(--lv-reach)))` }} />
    </div>
  );
}

function StartCard({ phase, onStart, computer, qrSvg }: { phase: Phase; onStart: () => void; computer: boolean; qrSvg: string }) {
  const noSensor = phase === 'nosensor';
  return (
    <div className="lv-start">
      <div className="lv-start-main">
        <div className="lv-bar lv-demo" aria-hidden="true">
          <span className="lv-hole" />
          <span className="lv-vial">
            <span className="lv-mark" />
            <span className="lv-mark" />
            <span className="lv-bubble" />
          </span>
          <span className="lv-hole" />
        </div>
        <button type="button" className="btn btn-primary lv-go" onClick={onStart} disabled={phase === 'asking'}>
          {phase === 'asking' ? 'Waiting for your phone...' : 'Start the level'}
        </button>
        {phase === 'denied' ? (
          <p className="lv-msg" role="alert">
            Motion access was turned down, so the level can&apos;t read the phone. Close this tab, open the page again and tap Allow when your phone asks.
          </p>
        ) : noSensor ? (
          <p className="lv-msg" role="alert">
            This device has no motion sensor, so the level needs a phone or tablet. Scan the code with your phone to open it there.
          </p>
        ) : (
          <p className="lv-hint">Your phone may ask to use motion. Tap Allow: nothing leaves your phone.</p>
        )}
      </div>
      {computer || noSensor ? (
        <div className="lv-qr">
          <div className="lv-qr-code" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p>
            <b>On a computer?</b>{' '}Scan this with your phone&apos;s camera to open the level there.
          </p>
        </div>
      ) : null}
    </div>
  );
}
