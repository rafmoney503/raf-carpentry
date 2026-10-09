'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { QUOTE_HREF } from '@/lib/site';

/* Timber Stack: a board slides in from the right; tap (or Space) to drop it on the stack. Whatever
   hangs over the board below is cut off and falls away, so the next board is only as wide as what
   was left. Line one up to within 6 mm and it counts as perfect; three perfects in a row and the
   board grows back 20 mm. Miss the stack completely and the game is over.
   Units are millimetres across a 1,000 mm play area; the first board is 600 mm. Canvas, no library.
   Best score is kept in this browser only (localStorage), sound can be switched off. */

const WORLD = 1000; // mm across the play area
const START_W = 600; // mm, the first board
const PERFECT = 6; // mm either way that still counts as lined up
const GROW = 20; // mm a board grows back after three perfects in a row
const PER_SPECIES = 6; // boards of one timber before the next
// Timber colours for the canvas (face, grain lines, end grain). Canvas needs real colours, not CSS tokens.
const SPECIES = [
  { base: '#dcc194', grain: '#b08a55', end: '#c4a26c' }, // birch ply
  { base: '#c99a62', grain: '#9c703d', end: '#b3844e' }, // oak
  { base: '#77503a', grain: '#4d311f', end: '#62412d' }, // walnut
  { base: '#e3c58c', grain: '#c19752', end: '#d0ad6c' }, // pine
  { base: '#9a5a40', grain: '#6c3826', end: '#844a33' }, // sapele
];

type Board = { x: number; w: number; sp: number; seed: number };
type Moving = Board & { dir: number };
type Piece = Board & { y: number; vx: number; vy: number; rot: number; vr: number };
type Dust = { x: number; y: number; vx: number; vy: number; life: number; c: string };
type Pop = { text: string; x: number; y: number; life: number };
type Phase = 'ready' | 'playing' | 'over';

const BEST_KEY = 'raf_timber_best';
const MUTE_KEY = 'raf_timber_mute';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Little workshop sounds, made on the fly (no sound files): a knock when a board lands,
   a short saw rasp when one is cut, a higher tap for a perfect one. */
function makeSounds() {
  let ctx: AudioContext | null = null;
  const ac = () => {
    if (!ctx) {
      const A = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!A) return null;
      ctx = new A();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };
  const noise = (c: AudioContext, secs: number) => {
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * secs), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s;
  };
  return {
    wake: () => { ac(); },
    knock(pitch = 1) {
      const c = ac(); if (!c) return;
      const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(210 * pitch, t); o.frequency.exponentialRampToValueAtTime(95 * pitch, t + 0.09);
      g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.13);
    },
    saw() {
      const c = ac(); if (!c) return;
      const t = c.currentTime, n = noise(c, 0.16), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t); f.frequency.linearRampToValueAtTime(2600, t + 0.15); f.Q.value = 0.9;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      n.connect(f).connect(g).connect(c.destination); n.start(t); n.stop(t + 0.17);
    },
    ping(step: number) {
      const c = ac(); if (!c) return;
      const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 660 * Math.pow(2, Math.min(step, 8) / 12);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.2);
    },
    thud() {
      const c = ac(); if (!c) return;
      const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.36);
    },
  };
}

export default function TimberStackGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  const monoRef = useRef<HTMLParagraphElement>(null);
  const api = useRef<{ start: () => void; drop: () => void; setMuted: (m: boolean) => void } | null>(null);

  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [muted, setMuted] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let storedBest = 0, storedMute = false;
    try {
      storedBest = Number(localStorage.getItem(BEST_KEY)) || 0;
      storedMute = localStorage.getItem(MUTE_KEY) === '1';
    } catch { /* private mode: no saved best */ }
    // read once from the browser: the best score and the sound setting saved last time
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBest(storedBest); setMuted(storedMute);

    const css = getComputedStyle(document.documentElement);
    const col = (v: string, f: string) => css.getPropertyValue(v).trim() || f;
    const C = {
      paper: col('--color-paper', '#f1f2ef'), ink: col('--color-ink', '#16191c'), accent: col('--color-accent', '#2547d0'),
      muted: col('--color-muted', '#4f555b'), mount: col('--color-mount', '#fbfbf9'),
    };
    const monoFont = monoRef.current ? getComputedStyle(monoRef.current).fontFamily : 'ui-monospace, monospace';
    const displayFont = getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'system-ui, sans-serif';

    const sounds = makeSounds();
    let soundOff = storedMute;

    const g = {
      phase: 'ready' as Phase, stack: [] as Board[], cur: null as Moving | null,
      pieces: [] as Piece[], dust: [] as Dust[], pops: [] as Pop[],
      speed: 380, combo: 0, score: 0, best: storedBest,
      w: 1, h: 1, s: 1, bp: 28, camY: 0, zoom: 1,
    };
    const yTop = (level: number) => -(level + 1) * g.bp; // the bench top is y = 0, boards stack upwards

    function spawn() {
      const last = g.stack[g.stack.length - 1];
      const n = g.stack.length;
      g.cur = { x: WORLD - last.w * 0.1, w: last.w, sp: Math.floor(n / PER_SPECIES) % SPECIES.length, seed: n * 7919 + 13, dir: -1 };
    }
    function reset() {
      g.stack = [{ x: (WORLD - START_W) / 2, w: START_W, sp: 0, seed: 1 }];
      g.pieces = []; g.dust = []; g.pops = [];
      g.speed = 380; g.combo = 0; g.score = 0; g.zoom = 1;
      g.camY = g.h * 0.8;
      spawn();
    }

    function drop() {
      if (g.phase !== 'playing' || !g.cur) return;
      const cur = g.cur, top = g.stack[g.stack.length - 1];
      const level = g.stack.length;
      const left = Math.max(cur.x, top.x), right = Math.min(cur.x + cur.w, top.x + top.w);
      const overlap = right - left;
      if (overlap <= 0) {
        // missed the stack: the whole board falls, game over
        g.pieces.push({ ...cur, y: yTop(level), vx: cur.dir * 120, vy: -60, rot: 0, vr: cur.dir * 2.4 });
        g.cur = null;
        g.phase = 'over';
        if (!soundOff) sounds.thud();
        const isBest = g.score > g.best;
        if (g.score > g.best) { g.best = g.score; try { localStorage.setItem(BEST_KEY, String(g.best)); } catch { /* ignore */ } }
        setBest(g.best); setNewBest(isBest); setPhase('over');
        return;
      }
      let x = left, w = overlap;
      if (Math.abs(cur.x - top.x) <= PERFECT) {
        // lined up: snap it square, and after three in a row the board grows back a little
        x = top.x; w = top.w; g.combo++;
        if (g.combo >= 3 && w < START_W) {
          const add = Math.min(GROW, START_W - w);
          w += add; x = Math.max(0, Math.min(WORLD - w, x - add / 2));
        }
        g.pops.push({ text: g.combo > 1 ? `Perfect ×${g.combo}` : 'Perfect', x: (x + w / 2) * g.s, y: yTop(level) - 8, life: 1 });
        if (!soundOff) sounds.ping(g.combo);
      } else {
        // cut off what hangs over, and let it fall
        g.combo = 0;
        const offLeft = cur.x < top.x;
        const px = offLeft ? cur.x : right, pw = offLeft ? top.x - cur.x : cur.x + cur.w - right;
        g.pieces.push({ x: px, w: pw, sp: cur.sp, seed: cur.seed, y: yTop(level), vx: offLeft ? -90 : 90, vy: -40, rot: 0, vr: (offLeft ? -1 : 1) * (1.5 + Math.random()) });
        const cutX = (offLeft ? top.x : right) * g.s;
        for (let i = 0; i < 16; i++) {
          g.dust.push({ x: cutX, y: yTop(level) + Math.random() * g.bp, vx: (Math.random() - 0.5) * 120 + (offLeft ? -30 : 30), vy: -Math.random() * 110, life: 0.5 + Math.random() * 0.4, c: SPECIES[cur.sp].end });
        }
        if (!soundOff) { sounds.saw(); sounds.knock(0.9); }
        navigator.vibrate?.(12);
      }
      g.stack.push({ x, w, sp: cur.sp, seed: cur.seed });
      g.score++;
      g.speed = Math.min(1150, 380 + g.score * 16);
      setScore(g.score);
      spawn();
    }

    function start() {
      sounds.wake();
      reset();
      g.phase = 'playing';
      setScore(0); setNewBest(false); setNote(''); setPhase('playing');
      requestAnimationFrame(() => dropRef.current?.focus({ preventScroll: true }));
    }
    api.current = { start, drop, setMuted: (m) => { soundOff = m; } };

    // size the canvas to its box, sharp on retina screens
    let dpr = 1;
    function resize() {
      const r = wrap!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      g.w = Math.max(1, r.width); g.h = Math.max(1, r.height);
      canvas!.width = Math.round(g.w * dpr); canvas!.height = Math.round(g.h * dpr);
      g.s = g.w / WORLD;
      g.bp = Math.round(Math.min(34, Math.max(22, g.h / 17)));
      if (!g.stack.length) reset();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    function drawBoard(X: number, Y: number, W: number, sp: number, seed: number) {
      const S = SPECIES[sp], H = g.bp;
      ctx!.fillStyle = S.base; ctx!.fillRect(X, Y, W, H);
      const r = rng(seed);
      ctx!.strokeStyle = S.grain; ctx!.lineWidth = 1; ctx!.globalAlpha = 0.5;
      for (let k = 0; k < 3; k++) {
        const yy = Y + H * (0.24 + 0.26 * k) + (r() - 0.5) * H * 0.12, amp = 0.5 + r() * 1.3, ph = r() * 6.28, f = 0.012 + r() * 0.02;
        ctx!.beginPath();
        for (let px = 0; px <= W; px += 5) ctx!.lineTo(X + px, yy + Math.sin(((X + px) / g.s) * f + ph) * amp);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
      const e = Math.min(3, W / 2);
      ctx!.fillStyle = S.end; ctx!.fillRect(X, Y, e, H); ctx!.fillRect(X + W - e, Y, e, H);
      ctx!.fillStyle = 'rgba(255,255,255,0.28)'; ctx!.fillRect(X, Y, W, 1.5);
      ctx!.fillStyle = 'rgba(22,25,28,0.22)'; ctx!.fillRect(X, Y + H - 1, W, 1);
    }

    function drawBench() {
      // a trestle, drawn like the line drawings on the rest of the site
      const s = g.s, top = 0, x0 = 140 * s, x1 = 860 * s;
      ctx!.strokeStyle = C.ink; ctx!.globalAlpha = 0.55; ctx!.lineWidth = 1.5; ctx!.lineCap = 'round';
      ctx!.strokeRect(x0, top, x1 - x0, 10);
      const legH = g.h * 1.2;
      ctx!.beginPath();
      for (const lx of [x0 + 40 * s, x1 - 40 * s]) {
        ctx!.moveTo(lx - 30 * s, top + 10); ctx!.lineTo(lx - 75 * s, top + legH);
        ctx!.moveTo(lx + 30 * s, top + 10); ctx!.lineTo(lx + 75 * s, top + legH);
        ctx!.moveTo(lx - 50 * s, top + 70); ctx!.lineTo(lx + 50 * s, top + 70);
      }
      ctx!.stroke();
      ctx!.globalAlpha = 1;
    }

    function draw() {
      const { w, h } = g;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = C.paper; ctx!.fillRect(0, 0, w, h);
      // graph paper that scrolls with the stack: a line every 16 px, a darker one every 80 px
      const step = 16;
      ctx!.lineWidth = 1;
      const line = (k: number) => (((k % 5) + 5) % 5 === 0 ? 'rgba(37,71,208,0.11)' : 'rgba(37,71,208,0.05)');
      for (let k = -Math.ceil(w / 2 / step); k * step <= w / 2; k++) {
        const x = Math.round(w / 2 + k * step) + 0.5;
        ctx!.strokeStyle = line(k); ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, h); ctx!.stroke();
      }
      for (let k = Math.floor(-g.camY / step) - 1; g.camY + k * step < h + step; k++) {
        const y = Math.round(g.camY + k * step) + 0.5;
        ctx!.strokeStyle = line(k); ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke();
      }

      ctx!.save();
      ctx!.translate(w / 2, g.camY); ctx!.scale(g.zoom, g.zoom); ctx!.translate(-w / 2, 0);
      drawBench();
      g.stack.forEach((b, i) => drawBoard(b.x * g.s, yTop(i), b.w * g.s, b.sp, b.seed));
      for (const p of g.pieces) {
        const W = p.w * g.s;
        ctx!.save();
        ctx!.translate(p.x * g.s + W / 2, p.y + g.bp / 2); ctx!.rotate(p.rot);
        drawBoard(-W / 2, -g.bp / 2, W, p.sp, p.seed);
        ctx!.restore();
      }
      if (g.cur) {
        const c = g.cur, X = c.x * g.s, W = c.w * g.s, Y = yTop(g.stack.length);
        drawBoard(X, Y, W, c.sp, c.seed);
        // dimension line with the board's width, like on a drawing
        const dy = Y - 12;
        ctx!.strokeStyle = C.accent; ctx!.globalAlpha = 0.8; ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(X, dy); ctx!.lineTo(X + W, dy);
        ctx!.moveTo(X, dy - 5); ctx!.lineTo(X, dy + 5); ctx!.moveTo(X + W, dy - 5); ctx!.lineTo(X + W, dy + 5);
        ctx!.stroke();
        ctx!.globalAlpha = 1;
        const label = `${Math.round(c.w)} mm`;
        ctx!.font = `12px ${monoFont}`; ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle';
        const tw = ctx!.measureText(label).width + 10, cx = X + W / 2;
        ctx!.fillStyle = C.paper; ctx!.fillRect(cx - tw / 2, dy - 8, tw, 16);
        ctx!.fillStyle = C.accent; ctx!.fillText(label, cx, dy + 0.5);
      }
      for (const d of g.dust) {
        ctx!.globalAlpha = Math.max(0, Math.min(1, d.life * 2));
        ctx!.fillStyle = d.c; ctx!.fillRect(d.x, d.y, 2, 2);
      }
      ctx!.globalAlpha = 1;
      for (const p of g.pops) {
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.font = `650 ${Math.round(g.bp * 0.7)}px ${displayFont}`; ctx!.textAlign = 'center'; ctx!.textBaseline = 'bottom';
        ctx!.fillStyle = C.accent; ctx!.fillText(p.text, p.x, p.y - (1 - p.life) * 30);
      }
      ctx!.globalAlpha = 1;
      ctx!.restore();
    }

    function update(dt: number) {
      const c = g.cur;
      if (c && g.phase !== 'over') {
        c.x += c.dir * g.speed * dt * (g.phase === 'ready' ? 0.6 : 1);
        // it travels right past the stack on both sides, so a late or early tap can miss
        const L = -c.w * 0.6, R = WORLD - c.w * 0.4;
        if (c.dir < 0 && c.x < L) { c.x = L; c.dir = 1; }
        else if (c.dir > 0 && c.x > R) { c.x = R; c.dir = -1; }
      }
      // camera: keep the board in play a little above the middle; at the end, step back to show the whole stack
      const n = g.stack.length;
      let target = Math.max(g.h * 0.8, g.h * 0.44 + (n + 1) * g.bp);
      let zoomTarget = 1;
      if (g.phase === 'over') {
        // step back so the whole stack shows above the score card
        target = Math.min(g.h * 0.5, g.h - 330); // the card takes about 310 px at the bottom
        zoomTarget = Math.min(1, (target - 90) / ((n + 1) * g.bp + 10));
      }
      const k = 1 - Math.exp(-dt * 5);
      g.camY += (target - g.camY) * k;
      g.zoom += (zoomTarget - g.zoom) * (1 - Math.exp(-dt * 3));
      for (const p of g.pieces) { p.vy += 2200 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      g.pieces = g.pieces.filter((p) => p.y < g.h * 3);
      for (const d of g.dust) { d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
      g.dust = g.dust.filter((d) => d.life > 0);
      for (const p of g.pops) p.life -= dt * 1.3;
      g.pops = g.pops.filter((p) => p.life > 0);
    }

    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); api.current = null; };
  }, []);

  const toggleSound = () => {
    const m = !muted;
    setMuted(m);
    api.current?.setMuted(m);
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
  };

  const share = async () => {
    const url = 'https://www.rafcarpentry.com/tools/timber-stack';
    const text = `I stacked ${score} ${score === 1 ? 'board' : 'boards'} in Timber Stack. Can you beat it?`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Timber Stack', text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNote('Copied. Paste it to a friend.');
    } catch { /* closed the share sheet */ }
  };

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative h-[clamp(420px,calc(100svh-250px),680px)] select-none overflow-hidden rounded-sm border border-line-strong bg-paper"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

        {/* the whole play area is the drop button: tap, click, Space or Enter */}
        <button
          ref={dropRef}
          type="button"
          aria-label="Drop the board"
          className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          style={{ touchAction: phase === 'playing' ? 'none' : 'auto', pointerEvents: phase === 'playing' ? 'auto' : 'none' }}
          tabIndex={phase === 'playing' ? 0 : -1}
          onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); api.current?.drop(); } }}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); api.current?.drop(); } }}
          onClick={(e) => { if (e.detail === 0) api.current?.drop(); }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-sm border border-line bg-mount/90 text-muted transition-colors hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8v4h3l4 3V5L6 8H3z" />
              {muted ? <path d="M13.5 7.5l5 5M18.5 7.5l-5 5" /> : <path d="M13.5 7a4 4 0 0 1 0 6M15.8 4.8a7 7 0 0 1 0 10.4" />}
            </svg>
          </button>
          <div className="text-center" aria-hidden={phase !== 'playing'}>
            <p className="font-display text-[44px] font-[680] leading-none tracking-[-0.03em] text-ink">{score}</p>
            <p ref={monoRef} className="mt-1 font-mono text-[12px] text-muted">{score === 1 ? 'board' : 'boards'}</p>
          </div>
          <p className="min-w-10 pt-2 text-right font-mono text-[13px] text-muted">Best {best}</p>
        </div>

        {phase === 'ready' ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-paper/40 p-5">
            <div className="w-full max-w-[340px] rounded-sm border border-line-strong bg-mount p-6 text-center shadow-[0_22px_40px_-28px_rgb(22_25_28/0.55)]">
              <p className="font-mono text-[13px] text-accent">Free game</p>
              <p className="mt-2 font-display text-[28px] font-[650] leading-tight tracking-[-0.02em]">Timber Stack</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">Tap to drop each board on the stack. Whatever hangs over gets cut off, so the next board is narrower.</p>
              <button type="button" onClick={() => api.current?.start()} className="btn btn-primary mt-6 w-full">Start</button>
            </div>
          </div>
        ) : null}

        {phase === 'over' ? (
          <div className="absolute inset-0 z-30 grid place-items-end justify-items-center p-3 [animation:fadeInUp_0.5s_0.6s_both] sm:p-5" role="dialog" aria-label="Game over" aria-live="polite">
            <div className="w-full max-w-[340px] rounded-sm border border-line-strong bg-mount p-5 text-center shadow-[0_22px_40px_-28px_rgb(22_25_28/0.55)]">
              <p className="font-mono text-[13px] text-accent">{newBest ? 'New best' : 'Off the stack'}</p>
              <p className="mt-2 font-display text-[28px] font-[650] leading-tight tracking-[-0.02em]">
                {score} {score === 1 ? 'board' : 'boards'} high
              </p>
              <p className="mt-1 font-mono text-[13px] text-muted">Best {best}</p>
              <div className="mt-5 grid gap-2.5">
                <button type="button" autoFocus onClick={() => api.current?.start()} className="btn btn-primary w-full">Play again</button>
                <button type="button" onClick={share} className="btn btn-ghost w-full">Share score</button>
              </div>
              {note ? <p className="mt-3 text-[14px] text-muted">{note}</p> : null}
              <Link href={QUOTE_HREF} className="link-more mt-4 justify-center text-[15px]">
                Get a quote for real woodwork <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
