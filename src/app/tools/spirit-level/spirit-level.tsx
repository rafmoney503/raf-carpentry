'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  bubbleReach,
  closeness,
  edgeTilt,
  flatTilt,
  fmtDeg,
  isLevel,
  LEN_MAX,
  LEN_MIN,
  levelWords,
  nearestAxis,
  norm,
  readLength,
  screenAxis,
  toneGap,
  toScreen,
  upFromAngles,
  wrap180,
  type Axis,
  type Mode,
  type Vec,
} from '@/lib/level-math';
import { addReading, lastPlace, placesOf, setLastPlace, updateReading, useReadings, type Reading as Saved } from '@/lib/readings';
import './spirit-level.css';

/* The phone spirit level (Raf, 17 Oct 2026: 'phones have different buttons it is difficult to make it level so ...
   a tara button which set level to zero and then move left right as you like to find right angle').
   Start asks for the motion sensor (iPhone asks on a tap), then the level fills the screen. It works out by itself
   whether the phone is on its edge or lying flat. Set zero: read from this surface from now on. Flip check: two
   readings, end for end, give the phone's own error on that edge, taken off every reading and remembered on this
   phone. Hold freezes the reading. The sums are in src/lib/level-math.ts.
   Version 2 (22 Oct 2026, from the 'Digital tools for the Tools page' canvas, Version 2 page): the reading sits on a
   dark instrument panel; Tone beeps faster as it nears level and chirps at level; Speak says the mm out loud once the
   reading settles; Big numbers drops the vial for a reading you can see from a step away; a fifth length chip takes
   your own length; Save keeps the reading (from just before the tap, so the tap's wobble isn't in it) in Your readings
   (src/lib/readings.ts, /tools/readings), with a name and a place. */

type Phase = 'idle' | 'asking' | 'running' | 'denied' | 'nosensor';
type Tare = { mode: 'edge'; axis: Axis; t0: number } | { mode: 'flat'; x0: number; y0: number };
type Bias = { edge: Partial<Record<Axis, number>>; flat: { x: number; y: number } | null };
type Shown = {
  mode: Mode;
  deg: number; // the big number: edge tilt (signed), or lying flat the tilt either way
  x: number; // lying flat, on the screen: right side up positive
  y: number; // lying flat, on the screen: far end up positive
  turned: boolean; // on an edge the screen hasn't turned with the phone (rotation lock)
  faceDown: boolean;
  axis: Axis; // on an edge, which edge is down (for the flip check line)
};
type Flip = { mode: 'edge'; axis: Axis; first: number } | { mode: 'flat'; first: { x: number; y: number } };

const LENGTHS = [600, 900, 1200, 2400];
const BIAS_KEY = 'raf_level_bias';
const TONE_KEY = 'raf_level_beep'; // was Beep (once at level); Tone keeps the same on / off
const SPEAK_KEY = 'raf_level_speak';
const BIG_KEY = 'raf_level_big';
const LEN_KEY = 'raf_level_len';
const OWN_KEY = 'raf_level_own';
const TAU = 0.18; // seconds, smoothing
const SAVE_BACK = 250; // ms: Save keeps the reading from just before the tap

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

const levelOf = (s: Shown) => !s.faceDown && (s.mode === 'edge' ? isLevel(s.deg) : isLevel(s.x) && isLevel(s.y));
const offOf = (s: Shown) => Math.abs(s.deg);
// On screen a number keeps its mm on the same line.
const keep = (t: string) => t.replace(/(\d) (mm|m)\b/g, '$1\u00a0$2');
const wordsOf = (s: Shown, len: number, tare: Tare | null) => levelWords(s.mode, s.mode === 'edge' ? s.deg : s.x, s.y, len, !!tare && tare.mode === s.mode);

/* The same level runs in two places (25 Oct 2026, Raf: two spirit levels online is too much): its own page here, and
   inside the Workshop Tools app (src/app/tools/workshop/app/workshop-app.tsx), where `embed` is passed: no start card
   (the app's Spirit level tile starts it, with the start handed over by register, inside the tap so an iPhone can
   ask for motion), Done
   goes back to the app, and Your readings opens over the level instead of going to /tools/readings. */
export type LevelEmbed = {
  register: (start: () => void) => void;
  onClose?: () => void;
  onReadings?: () => void;
};

export default function SpiritLevel({ qrSvg, embed }: { qrSvg: string; embed?: LevelEmbed }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [shown, setShown] = useState<Shown | null>(null);
  const [held, setHeld] = useState<Shown | null>(null);
  const [tare, setTare] = useState<Tare | null>(null);
  const [bias, setBias] = useState<Bias>({ edge: {}, flat: null });
  const [len, setLen] = useState(600);
  const [own, setOwn] = useState<number | null>(null);
  const [tone, setTone] = useState(true);
  const [speak, setSpeak] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [big, setBig] = useState(false);
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState<'zero' | 'flip' | null>(null);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [note, setNote] = useState('');
  const [computer, setComputer] = useState(false);
  const [justSaved, setJustSaved] = useState<Saved | null>(null);

  const raw = useRef<Vec | null>(null);
  const filt = useRef<Vec | null>(null);
  const lastT = useRef(0);
  const samples = useRef<Vec[] | null>(null);
  const modeRef = useRef<Mode>('edge');
  const axisRef = useRef<Axis>('y+');
  const audio = useRef<AudioContext | null>(null);
  const armed = useRef(true);
  const lastTick = useRef(0);
  const sayCand = useRef({ text: '', since: 0 });
  const spoke = useRef({ text: '', at: 0 });
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  const recent = useRef<{ t: number; s: Shown }[]>([]);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const live = useRef({ tare, bias, tone, speak, len, held, busy });
  useEffect(() => {
    live.current = { tare, bias, tone, speak, len, held, busy };
  });

  // Settings kept on this phone
  useEffect(() => {
    setBias(readStore<Bias>(BIAS_KEY, { edge: {}, flat: null }));
    setTone(readStore<boolean>(TONE_KEY, true));
    setBig(readStore<boolean>(BIG_KEY, false));
    const o = readStore<number | null>(OWN_KEY, null);
    const okLen = (v: unknown): v is number => typeof v === 'number' && v >= LEN_MIN && v <= LEN_MAX;
    const ownLen = okLen(o) ? o : null;
    const l = readStore<number>(LEN_KEY, 600);
    if (LENGTHS.includes(l) || l === ownLen) setLen(l);
    else if (okLen(l)) {
      setLen(l);
      setOwn(l);
    }
    if (ownLen) setOwn(ownLen);
    const speech = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
    setCanSpeak(speech);
    setSpeak(speech && readStore<boolean>(SPEAK_KEY, false));
    // A computer: no touch screen, or a mouse as the main pointer. Phones and tablets get no QR code.
    setComputer(navigator.maxTouchPoints === 0 || window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    if (!speech) return;
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      voice.current = vs.find((v) => v.lang === 'en-GB' && v.localService) ?? vs.find((v) => v.lang?.startsWith('en-GB')) ?? null;
    };
    pick();
    window.speechSynthesis.addEventListener?.('voiceschanged', pick);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', pick);
      window.speechSynthesis.cancel();
    };
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

  const tick = useCallback(() => {
    const ctx = audio.current;
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.05);
    } catch {
      /* no sound */
    }
  }, []);

  const chirp = useCallback(() => {
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
  }, []);

  const sayNow = useCallback((text: string, quiet = false) => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.rate = 1.05;
      if (quiet) u.volume = 0;
      if (voice.current) u.voice = voice.current;
      synth.speak(u);
      if (!quiet) {
        spoke.current = { text, at: performance.now() };
        setSaid(text);
      }
    } catch {
      /* no voice */
    }
  }, []);

  // Works out what to show from the smoothed reading, once a frame; Tone and Speak follow it.
  useEffect(() => {
    if (phase !== 'running') return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const u = filt.current;
      if (!u) return;
      const { tare: tr, bias: bs, tone: tn, speak: sp, len: ln, held: hd, busy: by } = live.current;
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
        s = { mode, deg, x: 0, y: 0, turned: axis !== screenAxis(angle), faceDown: false, axis };
      } else {
        const f = flatTilt(u);
        const b = tr?.mode === 'flat' ? { x: tr.x0, y: tr.y0 } : bs.flat ?? { x: 0, y: 0 };
        const p = toScreen(f.x - b.x, f.y - b.y, angle);
        s = { mode, deg: Math.hypot(p.x, p.y), x: p.x, y: p.y, turned: false, faceDown: u.z < 0, axis: axisRef.current };
      }
      setShown(s);
      const now = performance.now();
      const rec = recent.current;
      rec.push({ t: now, s });
      while (rec.length && now - rec[0].t > 1500) rec.shift();
      if (hd || by || s.faceDown) return;
      // Tone: a chirp each time it comes level, ready again once it has moved 0.15 off; quicker beeps on the way in.
      const lv = levelOf(s);
      const off = offOf(s);
      if (lv && armed.current) {
        armed.current = false;
        if (tn) chirp();
      } else if (!lv && off > 0.15) armed.current = true;
      if (tn && !lv && armed.current) {
        const gap = toneGap(off);
        if (gap !== null && now - lastTick.current >= gap) {
          lastTick.current = now;
          tick();
        }
      }
      // Speak: once the words have stayed the same for a moment, and not the same words twice running.
      if (sp) {
        const say = wordsOf(s, ln, tr).say;
        const c = sayCand.current;
        if (c.text !== say) sayCand.current = { text: say, since: now };
        else if (now - c.since > 650 && say !== spoke.current.text && now - spoke.current.at > 1400) sayNow(say);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, chirp, tick, sayNow]);

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

  async function start() {
    // The sound, the voice and the motion permission all have to start inside the tap.
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC && !audio.current) audio.current = new AC();
      audio.current?.resume().catch(() => {});
    } catch {
      /* no sound */
    }
    if (speak) sayNow(' ', true);
    const DOE = typeof window !== 'undefined' ? (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent : undefined;
    if (!DOE) {
      setPhase('nosensor');
      return;
    }
    if (typeof DOE.requestPermission === 'function') {
      setPhase('asking');
      // Chrome on a computer has requestPermission too and says no: that's no sensor, not a refusal
      const no = () => setPhase(navigator.maxTouchPoints === 0 ? 'nosensor' : 'denied');
      try {
        const r = await DOE.requestPermission();
        if (r !== 'granted') {
          no();
          return;
        }
      } catch {
        no();
        return;
      }
    }
    filt.current = null;
    raw.current = null;
    recent.current = [];
    spoke.current = { text: '', at: 0 };
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
    embed?.onClose?.();
    window.removeEventListener('deviceorientation', onOrient);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* no voice */
    }
    setPhase('idle');
    setShown(null);
    setHeld(null);
    setFlip(null);
    setBusy(null);
    setJustSaved(null);
    setSaid('');
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
  const chooseOwn = (l: number) => {
    setOwn(l);
    writeStore(OWN_KEY, l);
    pickLen(l);
  };
  const toggleTone = () => {
    setTone(!tone);
    writeStore(TONE_KEY, !tone);
    audio.current?.resume().catch(() => {});
    if (!tone) armed.current = true;
  };
  const toggleSpeak = () => {
    const on = !speak;
    setSpeak(on);
    writeStore(SPEAK_KEY, on);
    if (on) {
      // Said inside the tap, which is what lets an iPhone talk from then on.
      sayNow('Speaking the readings');
      sayCand.current = { text: '', since: 0 };
    } else {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* no voice */
      }
      setSaid('');
    }
  };
  const toggleBig = () => {
    setBig(!big);
    writeStore(BIG_KEY, !big);
  };

  function save() {
    // The held reading, or the one from just before the tap.
    let snap = held;
    if (!snap) {
      const rec = recent.current;
      const target = performance.now() - SAVE_BACK;
      snap = rec.length ? rec[rec.length - 1].s : shown;
      for (let i = rec.length - 1; i >= 0; i--) {
        if (rec[i].t <= target) {
          snap = rec[i].s;
          break;
        }
      }
    }
    if (!snap || snap.faceDown) return;
    const w = wordsOf(snap, len, tare);
    const r = addReading({
      tool: 'level',
      value: fmtDeg(snap.deg),
      detail: w.detail,
      label: '',
      place: lastPlace(),
      mode: snap.mode,
      deg: Math.round(snap.deg * 100) / 100,
      len,
    });
    setJustSaved(r);
  }
  const closeSaved = useCallback(() => setJustSaved(null), []);

  const s = held ?? shown;
  const open = phase === 'running';
  // the app holds the newest start for its own tile's tap
  const register = embed?.register;
  useEffect(() => {
    register?.(start);
  });
  // in the app, Your readings closes the level first (no tone under the list); its Back starts the level again
  const onReadings = embed?.onReadings;
  const openReadings = onReadings
    ? () => {
        close();
        onReadings();
      }
    : undefined;

  return (
    <>
      {embed ? <EmbedNote phase={phase} qrSvg={qrSvg} onClose={close} /> : <StartCard phase={phase} onStart={start} computer={computer} qrSvg={qrSvg} />}
      {open ? (
        <div className="lv-app" role="dialog" aria-modal="true" aria-label="Spirit level">
          <div className="lv-top">
            <p className="lv-title">Spirit level</p>
            <ReadingsLink onOpen={openReadings} />
            <button type="button" className="lv-done" onClick={close}>
              Done
            </button>
          </div>
          {s ? (
            <Reading
              s={s}
              len={len}
              own={own}
              tare={tare}
              bias={bias}
              held={!!held}
              busy={busy}
              flip={flip}
              note={note}
              tone={tone}
              speak={speak}
              canSpeak={canSpeak}
              big={big}
              said={said}
              onLen={pickLen}
              onOwn={chooseOwn}
              onZero={setZero}
              onClearZero={() => setTare(null)}
              onClearBias={clearBias}
              onHold={() => setHeld(held ? null : shown)}
              onFlip={doFlip}
              onCancelFlip={() => {
                setFlip(null);
                setNote('');
              }}
              onTone={toggleTone}
              onSpeak={toggleSpeak}
              onBig={toggleBig}
              onSave={save}
            />
          ) : (
            <p className="lv-wait">Getting the first reading...</p>
          )}
          {justSaved ? <SaveSheet key={justSaved.id} r={justSaved} onDone={closeSaved} onReadings={openReadings} /> : null}
        </div>
      ) : null}
    </>
  );
}

function ReadingsLink({ onOpen }: { onOpen?: () => void }) {
  const list = useReadings();
  const inner = (
    <>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
      <span>{list.length}</span>
    </>
  );
  if (onOpen) {
    return (
      <button type="button" className="lv-saved" onClick={onOpen} aria-label={`Your readings: ${list.length} saved`}>
        {inner}
      </button>
    );
  }
  return (
    <Link href="/tools/readings" className="lv-saved" aria-label={`Your readings: ${list.length} saved`}>
      {inner}
    </Link>
  );
}

/* In the app there is no start card: while the phone is asked for motion, or when it says no, or on a computer,
   this small card says so over the app. */
function EmbedNote({ phase, qrSvg, onClose }: { phase: Phase; qrSvg: string; onClose: () => void }) {
  if (phase !== 'asking' && phase !== 'denied' && phase !== 'nosensor') return null;
  return (
    <div className="lv-embed" role="dialog" aria-modal="true" aria-label="Spirit level">
      <div className="lv-embed-card">
        <p className="lv-title">Spirit level</p>
        {phase === 'asking' ? (
          <p className="lv-hint">Your phone is asking to use motion. Tap Allow: nothing leaves your phone.</p>
        ) : phase === 'denied' ? (
          <p className="lv-msg" role="alert">
            Motion access was turned down, so the level can&apos;t read the phone. Close the app, open it again and tap Allow when your phone asks.
          </p>
        ) : (
          <>
            <p className="lv-msg" role="alert">
              This needs a phone or tablet: the level reads its motion sensor. Scan the code with your phone to open the app there.
            </p>
            <div className="lv-embed-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </>
        )}
        {phase !== 'asking' ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Back to the tools
          </button>
        ) : null}
      </div>
    </div>
  );
}

const ICONS = {
  level: 'M5 12.5l4.5 4.5L19 7',
  up: 'M12 19V5M6 11l6-6 6 6',
  angle: 'M4 20h16M4 20L18 6M11 20a7 7 0 0 0-2-5',
};

function Reading(p: {
  s: Shown;
  len: number;
  own: number | null;
  tare: Tare | null;
  bias: Bias;
  held: boolean;
  busy: 'zero' | 'flip' | null;
  flip: Flip | null;
  note: string;
  tone: boolean;
  speak: boolean;
  canSpeak: boolean;
  big: boolean;
  said: string;
  onLen: (l: number) => void;
  onOwn: (l: number) => void;
  onZero: () => void;
  onClearZero: () => void;
  onClearBias: () => void;
  onHold: () => void;
  onFlip: () => void;
  onCancelFlip: () => void;
  onTone: () => void;
  onSpeak: () => void;
  onBig: () => void;
  onSave: () => void;
}) {
  const { s, len, tare } = p;
  const fromZero = !!tare && tare.mode === s.mode;
  const words = wordsOf(s, len, tare);
  const level = levelOf(s);
  const biasNow = s.mode === 'edge' ? p.bias.edge[s.axis] : p.bias.flat ? Math.hypot(p.bias.flat.x, p.bias.flat.y) : undefined;
  const [editLen, setEditLen] = useState(false);

  let status: { text: string; clear?: () => void; tone: 'zero' | 'bias' | 'plain' };
  if (fromZero) status = { text: 'Reading from your zero', clear: p.onClearZero, tone: 'zero' };
  else if (biasNow !== undefined) status = { text: `Flip checked: ${Math.abs(biasNow).toFixed(1)}° phone error taken off`, clear: p.onClearBias, tone: 'bias' };
  else status = { text: 'Straight from the phone. Phones are often a little out: Set zero or Flip check.', tone: 'plain' };

  const lit = !p.tone ? 0 : level ? 5 : Math.max(1, Math.round(closeness(offOf(s)) * 5));
  const flipping = !!p.flip;
  const ownOn = p.own !== null && p.len === p.own;
  return (
    <div className="lv-body">
      <section className={`lv-panel${p.big ? ' lv-big' : ''}${s.mode === 'flat' ? ' lv-flat' : ''}`} aria-label="The reading">
        <span className="lv-corner tl" aria-hidden="true" />
        <span className="lv-corner tr" aria-hidden="true" />
        <span className="lv-corner bl" aria-hidden="true" />
        <span className="lv-corner br" aria-hidden="true" />
        <div className="lv-ph">
          <span>
            {s.mode === 'edge' ? 'On its edge' : 'Lying flat'}
            {fromZero ? ' · from your zero' : ''}
          </span>
          <span className={`lv-live${p.held ? ' held' : ''}`}>
            <span className="lv-dot" aria-hidden="true" />
            {p.held ? 'Held' : 'Live'}
          </span>
        </div>
        {p.big ? null : s.mode === 'edge' ? <EdgeVial deg={s.deg} /> : <FlatVial x={s.x} y={s.y} />}
        <p className={`lv-read${level ? ' on' : ''}`} aria-live="off">
          <span className="lv-num">{s.faceDown ? '–' : fmtDeg(s.deg)}</span>
          <span className={`lv-tick${level ? ' on' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 5.2l2 2 4-4.4" />
            </svg>
          </span>
        </p>
        <p className={`lv-dir${level ? ' on' : ''}`}>
          {s.faceDown ? null : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS[words.icon]} />
            </svg>
          )}
          <span>{s.faceDown ? 'Turn the phone face up' : keep(words.main)}</span>
        </p>
        <p className="lv-fix">{(!s.faceDown && keep(words.sub)) || ' '}</p>
        {p.speak && p.said ? (
          <p className="lv-said">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9z" />
              <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            </svg>
            Saying: {p.said}
          </p>
        ) : null}
        {s.turned && !fromZero ? <p className="lv-warn">The screen hasn&apos;t turned with the phone, so left and right are swapped round. Turn off rotation lock.</p> : null}
        {p.held ? <p className="lv-held">Held. Tap Hold again to go live.</p> : null}
      </section>

      <div className="lv-side">
        {editLen ? (
          <LengthForm
            start={p.own ?? p.len}
            onUse={(l) => {
              p.onOwn(l);
              setEditLen(false);
            }}
            onCancel={() => setEditLen(false)}
          />
        ) : (
          <div className="lv-lens" role="group" aria-label="Length of what you are levelling, in mm">
            <span className="lv-lab">Over</span>
            {LENGTHS.map((l) => (
              <button key={l} type="button" aria-pressed={p.len === l} className={`lv-chip${p.len === l ? ' on' : ''}`} onClick={() => p.onLen(l)}>
                {l}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={ownOn}
              aria-label={p.own === null ? 'Type your own length' : ownOn ? `${p.own} mm, your own length. Tap to change it` : `${p.own} mm, your own length`}
              className={`lv-chip lv-own${ownOn ? ' on' : ''}${p.own === null ? ' empty' : ''}`}
              onClick={() => (p.own !== null && !ownOn ? p.onLen(p.own) : setEditLen(true))}
            >
              {p.own !== null ? <span>{p.own}</span> : null}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16z" />
              </svg>
            </button>
          </div>
        )}

        <div className="lv-hands" role="group" aria-label="Hands free">
          <button type="button" className={`lv-tile${p.tone ? ' on' : ''}`} aria-pressed={p.tone} onClick={p.onTone}>
            <span className={`lv-bars${level ? ' ok' : ''}`} aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={i < lit ? 'lit' : ''} />
              ))}
            </span>
            <span className="lv-tile-t">Tone {p.tone ? 'on' : 'off'}</span>
          </button>
          <button type="button" className={`lv-tile${p.speak ? ' on' : ''}`} aria-pressed={p.speak} onClick={p.onSpeak} disabled={!p.canSpeak} title={p.canSpeak ? undefined : 'This browser can’t speak'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9z" />
              <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
            </svg>
            <span className="lv-tile-t">{p.canSpeak ? `Speak ${p.speak ? 'on' : 'off'}` : 'No voice'}</span>
          </button>
          <button type="button" className={`lv-tile${p.big ? ' on' : ''}`} aria-pressed={p.big} onClick={p.onBig}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
            <span className="lv-tile-t">Big numbers</span>
          </button>
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

        <div className="lv-dock">
          <button type="button" className="lv-zero" onClick={p.onZero} disabled={!!p.busy || flipping}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
            {p.busy === 'zero' ? 'Hold still...' : 'Set zero here'}
          </button>
          <div className="lv-row">
            <button type="button" className={`lv-btn${p.held ? ' on' : ''}`} aria-pressed={p.held} onClick={p.onHold} disabled={!!p.busy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              {p.held ? 'Held' : 'Hold'}
            </button>
            <button type="button" className={`lv-btn${flipping ? ' go' : ''}`} onClick={p.onFlip} disabled={!!p.busy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9h13l-3-3M20 15H7l3 3" />
              </svg>
              {p.busy === 'flip' ? 'Hold still...' : flipping ? 'Second reading' : 'Flip check'}
            </button>
            <button type="button" className="lv-btn" onClick={p.onSave} disabled={!!p.busy || s.faceDown}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3h12v18l-6-4-6 4z" />
              </svg>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LengthForm({ start, onUse, onCancel }: { start: number; onUse: (l: number) => void; onCancel: () => void }) {
  const [text, setText] = useState(String(start));
  const [bad, setBad] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const l = readLength(text);
    if (l === null) {
      setBad(true);
      return;
    }
    onUse(l);
  };
  return (
    <form className="lv-lenform" onSubmit={submit}>
      <label className="lv-lenbox">
        <span className="lv-lab">Your length</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          autoFocus
          value={text}
          aria-invalid={bad}
          aria-describedby="lv-len-help"
          onChange={(e) => {
            setText(e.target.value);
            setBad(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
        />
        <span className="lv-mm">mm</span>
      </label>
      <button type="submit" className="lv-use">
        Use
      </button>
      <button type="button" className="lv-link" onClick={onCancel}>
        Cancel
      </button>
      <p id="lv-len-help" className={`lv-lenhelp${bad ? ' bad' : ''}`}>
        {bad ? `A length in mm, ${LEN_MIN} to ${LEN_MAX}.` : 'The mm to pack are worked out over this length.'}
      </p>
    </form>
  );
}

/* After Save: the reading went into Your readings straight away. A name and a place can be added here; the place is
   used for the next Save too. Goes by itself after 6 s unless it's being used. */
function SaveSheet({ r, onDone, onReadings }: { r: Saved; onDone: () => void; onReadings?: () => void }) {
  const list = useReadings();
  const cur = list.find((x) => x.id === r.id) ?? r;
  const [label, setLabel] = useState(r.label);
  const [adding, setAdding] = useState(false);
  const [newPlace, setNewPlace] = useState('');
  const touched = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!touched.current) onDone();
    }, 6000);
    return () => window.clearTimeout(t);
  }, [onDone]);
  const places = placesOf(list).slice(0, 5);
  if (cur.place && !places.includes(cur.place)) places.unshift(cur.place);
  const pickPlace = (place: string) => {
    updateReading(r.id, { place });
    setLastPlace(place);
    setAdding(false);
    setNewPlace('');
  };
  const addPlace = (e: FormEvent) => {
    e.preventDefault();
    const pl = newPlace.trim();
    if (pl) pickPlace(pl);
  };
  return (
    <section
      className="lv-sheet"
      aria-label="Saved reading"
      onPointerDown={() => (touched.current = true)}
      onFocusCapture={() => (touched.current = true)}
    >
      <p className="lv-sheet-head" role="status">
        <span className="lv-sheet-tick" aria-hidden="true">
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 5.2l2 2 4-4.4" />
          </svg>
        </span>
        <span>
          <b>Saved {cur.value}</b>, {cur.detail}
        </span>
      </p>
      <label className="lv-sheet-field">
        <span>What is it? (optional)</span>
        <input
          type="text"
          value={label}
          maxLength={80}
          placeholder="e.g. Worktop, left run"
          enterKeyHint="done"
          onChange={(e) => {
            setLabel(e.target.value);
            updateReading(r.id, { label: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </label>
      <div className="lv-sheet-places" role="group" aria-label="Place">
        <span className="lv-sheet-lab">Place</span>
        <div className="lv-sheet-chips">
          {places.map((pl) => (
            <button key={pl} type="button" aria-pressed={cur.place === pl} className={`lv-pchip${cur.place === pl ? ' on' : ''}`} onClick={() => pickPlace(pl)}>
              {pl}
            </button>
          ))}
          <button type="button" aria-pressed={!cur.place} className={`lv-pchip${!cur.place ? ' on' : ''}`} onClick={() => pickPlace('')}>
            No place
          </button>
          {adding ? null : (
            <button type="button" className="lv-pchip add" onClick={() => setAdding(true)}>
              + New place
            </button>
          )}
        </div>
        {adding ? (
          <form className="lv-sheet-new" onSubmit={addPlace}>
            <input type="text" value={newPlace} maxLength={60} autoFocus placeholder="e.g. Kitchen, Crouch End" enterKeyHint="done" aria-label="New place" onChange={(e) => setNewPlace(e.target.value)} />
            <button type="submit" className="lv-use" disabled={!newPlace.trim()}>
              Add
            </button>
          </form>
        ) : null}
      </div>
      <div className="lv-sheet-foot">
        {onReadings ? (
          <button
            type="button"
            className="lv-link"
            onClick={() => {
              onDone();
              onReadings();
            }}
          >
            All readings ({list.length})
          </button>
        ) : (
          <Link href="/tools/readings" className="lv-link">
            All readings ({list.length})
          </Link>
        )}
        <button type="button" className="lv-use" onClick={onDone}>
          Done
        </button>
      </div>
    </section>
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
  const saved = useReadings();
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
        {saved.length ? (
          <Link href="/tools/readings" className="link-more lv-startsaved">
            Your saved readings ({saved.length}) <span aria-hidden="true">→</span>
          </Link>
        ) : null}
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
