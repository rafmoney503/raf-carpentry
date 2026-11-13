/* Mini Raf's show beside the name (phones and tablets; src/components/MiniRafStage.tsx draws it). Rafal, 13 Nov 2026:
   'walking beside the Rafcarpentry name and if scrolled down level pop up and he is still in same section ... after
   he kicks log new unit pop up ... seamless so after that ... he is dancing then go and make another unit, run and make
   another, crawl and make another do some jumping jacks make a wardrobe or media wall ... interactive', then (13 Nov
   2026) 'can it be played infinitely while someone is on site'. A show is about 39 s; when it ends the next one starts
   by itself with new pieces and colours, so it goes on for as long as the page is open (the button pauses it). Each
   show after the first starts with him walking on from the pieces he made last (legacy), so there is no join.
   Everything here is worked out from the time alone (frameAt), so the show can carry on from any moment: across pages,
   after a tap that skips a trick, or after a reload in the same tab. No DOM, no React: it can be tested on its own.
   The scene is 80 units high with the floor at 74, and x is measured from the scene's right edge (negative to the
   left), so nothing moves when the space beside the name gets wider or narrower. When Raf goes to make the next piece
   he walks (runs, crawls) on the spot and the floor, the pieces he has made and the next log move past him. */

import { MINI_RAF_COLOURS, type MiniRafUnit } from './mini-raf';

export type ShowKind = MiniRafUnit | 'media';

export const GROUND = 74;
export const RAF_X = -128; // where he stands
export const LOG_X = -92; // the log he kicks
export const PIECE_X = -40; // where the piece pops up
export const STEP = 120; // how far the floor moves between two pieces
export const KICK_POP = 1.12; // the piece pops up this long after the kick starts
// The pieces' own moves (pop, size, doors, drawers, books, lamp, TV) are the 7 s CSS keyframes of the page-by-page
// rounds (src/components/mini-raf.css), where the pop starts 2.7 s in. A piece starts its keyframes there.
export const CSS_POP = 2.7;
// A tap on a piece plays its trick again: its keyframes from just before the doors open.
export const CSS_TRICK = 3.85;

const WALK_V = 70; // units a second
const RUN_V = 140;
const CRAWL_V = 36;
const RAMP = 0.35; // speeding up and slowing down at each end of a stretch
const STRIDE = { walk: 30, run: 44, crawl: 16 };

const MM: Record<ShowKind, string> = { cupboard: '600', chest: '800', wardrobe: '1000', bookcase: '600', bedside: '450', tv: '1800', media: '2400' };
export const SHOW_HALF: Record<ShowKind, number> = { cupboard: 18, chest: 19, wardrobe: 19, bookcase: 18, bedside: 13, tv: 27, media: 37 };

export type ShowPiece = { id: string; kind: ShowKind; colour: string; mm: string; x: number; popT: number; finale: boolean };
export type LegacyPiece = { kind: ShowKind; colour: string; mm: string };
export type ActName = 'enter' | 'dance' | 'walk' | 'run' | 'crawl' | 'jacks' | 'rest';

type Scroll = { t0: number; t1: number; from: number; v: number; ramp: number };
type Seg =
  | { kind: 'enter'; t0: number; t1: number }
  | { kind: 'walk' | 'run'; t0: number; t1: number; scroll: number }
  | { kind: 'crawl'; t0: number; t1: number; scroll: number }
  | { kind: 'kick'; t0: number; t1: number; piece: number; logX: number; finale: boolean }
  | { kind: 'dance'; t0: number; t1: number; piece: number }
  | { kind: 'jacks'; t0: number; t1: number }
  | { kind: 'wave'; t0: number; t1: number };

export type Show = {
  n: number;
  replay: boolean;
  pieces: ShowPiece[];
  segs: Seg[];
  scrolls: Scroll[];
  acts: { name: ActName; t0: number }[];
  end: number;
};

/* The pieces of show n: the first three take turns at the start, then a bedside table and a media wall, or a TV unit
   and a wardrobe, every other show; the colours move on one a piece and one a show. */
export function showPieces(n: number): LegacyPiece[] {
  const trio: ShowKind[] = ['cupboard', 'chest', 'bookcase'];
  const r = ((n % 3) + 3) % 3;
  const kinds: ShowKind[] = [...trio.slice(r), ...trio.slice(0, r), n % 2 ? 'tv' : 'bedside', n % 2 ? 'wardrobe' : 'media'];
  return kinds.map((kind, k) => ({ kind, colour: MINI_RAF_COLOURS[(n + k) % MINI_RAF_COLOURS.length], mm: MM[kind] }));
}

/* Show n. A replay starts with him walking from the pieces he made last (legacy, oldest first: the last one is
   beside him) to a new log instead of walking in. They stand where they stood at the end of the show before. */
export const LEGACY_KEEP = 4; // pieces carried over: as many as the widest stage can show
export function buildShow(n: number, replay: boolean, legacy: LegacyPiece[] = []): Show {
  const kinds = showPieces(n);
  const segs: Seg[] = [];
  const scrolls: Scroll[] = [];
  const acts: { name: ActName; t0: number }[] = [];
  const pieces: ShowPiece[] = [];
  let t = 0;
  let off = 0;
  const scroll = (v: number, at: number) => {
    scrolls.push({ t0: at, t1: at + STEP / v + RAMP, from: off, v, ramp: RAMP });
    off += STEP;
    return scrolls.length - 1;
  };
  const go = (kind: 'walk' | 'run', v: number) => {
    const s = scroll(v, t);
    segs.push({ kind, t0: t, t1: scrolls[s].t1, scroll: s });
    t = scrolls[s].t1;
  };
  const kick = (k: number) => {
    const finale = k === kinds.length - 1;
    const len = finale ? 4 : 3.5;
    pieces.push({ id: `${n}-${k}`, ...kinds[k], x: PIECE_X + off, popT: t + KICK_POP, finale });
    segs.push({ kind: 'kick', t0: t, t1: t + len, piece: k, logX: LOG_X + off, finale });
    t += len;
  };
  const kept = legacy.slice(-LEGACY_KEEP);
  kept.forEach((l, i) => {
    const back = kept.length - 1 - i; // 0 = the one beside him
    pieces.push({ id: back ? `${n}-old-${back}` : `${n}-old`, ...l, x: PIECE_X - back * STEP, popT: -1000, finale: false });
  });

  acts.push({ name: replay ? 'walk' : 'enter', t0: 0 });
  if (replay) go('walk', WALK_V);
  else {
    segs.push({ kind: 'enter', t0: 0, t1: 1.6 });
    t = 1.6;
  }
  kick(0);
  acts.push({ name: 'dance', t0: t });
  segs.push({ kind: 'dance', t0: t, t1: t + 4.6, piece: 0 });
  t += 4.6;
  acts.push({ name: 'walk', t0: t });
  go('walk', WALK_V);
  kick(1);
  acts.push({ name: 'run', t0: t });
  go('run', RUN_V);
  kick(2);
  acts.push({ name: 'crawl', t0: t });
  {
    const s = scroll(CRAWL_V, t + 0.45);
    const t1 = scrolls[s].t1 + 0.45;
    segs.push({ kind: 'crawl', t0: t, t1, scroll: s });
    t = t1;
  }
  kick(3);
  acts.push({ name: 'jacks', t0: t });
  segs.push({ kind: 'jacks', t0: t, t1: t + 2.4 }); // four jumping jacks
  t += 2.4;
  go('walk', WALK_V);
  kick(4);
  acts.push({ name: 'rest', t0: t });
  segs.push({ kind: 'wave', t0: t, t1: t + 2.4 });
  t += 2.4;
  return { n, replay, pieces, segs, scrolls, acts, end: t };
}

/* ---- the sums */

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
/* 0 to 1 as v goes from a to b, eased */
const ramp = (v: number, a: number, b: number) => smooth((v - a) / (b - a));
/* Keyframes [time, value], eased between them, held outside them. */
function kf(u: number, pts: [number, number][]): number {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [b, vb] = pts[i];
    if (u <= b) {
      const [a, va] = pts[i - 1];
      return va + (vb - va) * smooth((u - a) / (b - a || 1));
    }
  }
  return pts[pts.length - 1][1];
}
/* A stretch that speeds up, keeps going and slows down: how far along it is, and how fast (0 to 1). */
function along(s: Scroll, t: number): { d: number; a: number } {
  const T = s.t1 - s.t0;
  const r = s.ramp;
  const u = clamp(t - s.t0, 0, T);
  if (u < r) return { d: (s.v * u * u) / (2 * r), a: u / r };
  if (u > T - r) return { d: STEP - (s.v * (T - u) * (T - u)) / (2 * r), a: (T - u) / r };
  return { d: (s.v * r) / 2 + s.v * (u - r), a: 1 };
}

export function offAt(show: Show, t: number): number {
  let off = 0;
  for (const s of show.scrolls) {
    if (t >= s.t1) off = s.from + STEP;
    else if (t > s.t0) return s.from + along(s, t).d;
    else break;
  }
  return off;
}

export type Pose = { x: number; y: number; lean: number; bob: number; legA: number; legB: number; armA: number; armB: number; upper: number; flip: number; alpha: number };
const STAND: Pose = { x: RAF_X, y: 0, lean: 0, bob: 0, legA: 0, legB: 0, armA: 0, armB: 0, upper: 0, flip: 1, alpha: 1 };

function gait(kind: 'walk' | 'run', d: number, a: number): Pose {
  const ph = (2 * Math.PI * d) / STRIDE[kind];
  const s = Math.sin(ph);
  const lift = 1 - Math.cos(2 * ph);
  if (kind === 'run')
    return { ...STAND, legA: 35 * a * s, legB: -35 * a * s, armA: -40 * a * s, armB: 40 * a * s, lean: 14 * smooth(a * 1.6), bob: -1 * a * lift };
  return { ...STAND, legA: 24 * a * s, legB: -24 * a * s, armA: -20 * a * s, armB: 20 * a * s, bob: -0.6 * a * lift };
}

function kickPose(u: number, finale: boolean): Pose {
  const cheerA: [number, number][] = finale ? [[1.2, 0], [1.5, 165], [2.6, 165], [2.9, 0]] : [];
  const cheerB: [number, number][] = [[1.2, 0], [1.5, -165], finale ? [2.6, -165] : [2.3, -165], finale ? [2.9, 0] : [2.6, 0]];
  let y = 0;
  if (u >= 1.25 && u < 1.7) y = -7 * Math.sin((Math.PI * (u - 1.25)) / 0.45);
  else if (u >= 1.7 && u < 1.95) y = -2 * Math.sin((Math.PI * (u - 1.7)) / 0.25);
  else if (finale && u >= 2.0 && u < 2.45) y = -7 * Math.sin((Math.PI * (u - 2.0)) / 0.45);
  return {
    ...STAND,
    y,
    legB: kf(u, [[0, 0], [0.12, 0], [0.32, 30], [0.46, -66], [0.62, -20], [0.8, 0]]),
    armA: kf(u, [[0, 0], [0.12, 0], [0.32, -10], [0.46, -35], [0.8, 0], ...cheerA]),
    armB: kf(u, [[0, 0], [0.12, 0], [0.32, 10], [0.46, 30], [0.8, 0], ...cheerB]),
    lean: kf(u, [[0, 0], [0.12, 0], [0.32, -4], [0.46, 5], [0.8, 0]]),
  };
}

function mix(a: Pose, b: Pose, w: number): Pose {
  const o = { ...a };
  for (const k of Object.keys(a) as (keyof Pose)[]) o[k] = a[k] + (b[k] - a[k]) * w;
  return o;
}

/* The dance, 4.6 s: hops with his arms going up in turn, a spin, a disco point, then both arms up. */
function dancePose(u: number): Pose {
  const w = (2 * Math.PI * u) / 0.8;
  const b = Math.abs(Math.sin((Math.PI * u) / 0.4));
  const parts: [number, number, () => Pose][] = [
    [0, 1.6, () => ({ ...STAND, y: -3 * b, armA: 95 + 55 * Math.sin(w), armB: -(95 - 55 * Math.sin(w)), legA: 12 * b, legB: -12 * b, lean: 8 * Math.sin(w) })],
    [1.6, 2.3, () => ({ ...STAND, y: -2 * b, armA: 90, armB: -90, flip: Math.cos((2 * Math.PI * (u - 1.6)) / 0.7) })],
    [2.3, 3.8, () => ({ ...STAND, bob: -1.5 * b, armA: 20, armB: -95 - 55 * Math.sin(w), lean: 6 * Math.sin(w), legA: 15 * Math.max(0, Math.sin(w)), legB: -15 * Math.max(0, -Math.sin(w)) })],
    [3.8, 4.6, () => ({ ...STAND, y: u > 4 && u < 4.3 ? -5 * Math.sin((Math.PI * (u - 4)) / 0.3) : 0, armA: 160, armB: -160 })],
  ];
  let i = parts.findIndex(([, b1]) => u < b1);
  if (i < 0) i = parts.length - 1;
  let p = parts[i][2]();
  // blend into the next part over its first 0.3 s
  if (i > 0 && u < parts[i][0] + 0.3) p = mix(parts[i - 1][2](), p, ramp(u, parts[i][0] - 0.01, parts[i][0] + 0.3));
  const env = ramp(u, 0, 0.45) * ramp(4.6 - u, 0, 0.4);
  return mix(STAND, p, env);
}

function jacksPose(u: number): Pose {
  const q = (u % 0.6) / 0.6;
  const s = Math.sin(Math.PI * q);
  // each jack starts and ends with his legs together, so only the arms' resting angle needs easing in and out
  const e = 20 * ramp(u, 0, 0.2) * ramp(2.4 - u, 0, 0.2);
  return { ...STAND, legA: 22 * s, legB: -22 * s, armA: e + 145 * s, armB: -(e + 145 * s), y: -4 * Math.abs(Math.sin(2 * Math.PI * q)) };
}

function wavePose(u: number): Pose {
  const wob = 20 * Math.sin((2 * Math.PI * u) / 0.55) * ramp(u, 0.35, 0.55) * ramp(2.0 - u, 0, 0.2);
  return { ...STAND, armB: kf(u, [[0, 0], [0.4, -150], [2.0, -150], [2.4, 0]]) + wob };
}

/* On hands and knees: the top half tips forward about the hip, the arms reach the floor and the knees go back. */
function crawlPose(wt: number, d: number, a: number): Pose {
  const ph = (2 * Math.PI * d) / STRIDE.crawl;
  const s = Math.sin(ph);
  return {
    ...STAND,
    upper: 80 * wt,
    armA: -80 * wt + 18 * a * s,
    armB: -80 * wt - 18 * a * s,
    legA: 35 * wt + 14 * a * s,
    legB: 35 * wt - 14 * a * s,
    bob: 3 * wt - 0.5 * a * (1 - Math.cos(2 * ph)),
  };
}

export type ShowFrame = {
  t: number;
  off: number;
  raf: Pose;
  log: { x: number; y: number; rot: number; scale: number } | null; // world units
  pieces: string[]; // ids on show
  squash: { id: string; sx: number; sy: number } | null; // the piece dancing along
  notes: { x: number; y: number; o: number }[];
  act: ActName;
  done: boolean;
};

const LOG_PATH: [number, number, number, number, number][] = [
  // p, dx (of the log-to-piece distance), dy, turn, size: the arc of the page-by-page rounds
  [0, 0, 0, 0, 1],
  [0.25, 14 / 60, -22, 160, 1],
  [0.5, 38 / 60, -36, 360, 0.95],
  [0.82, 1, -24, 520, 0.7],
  [1, 1, -24, 560, 0],
];
function logFlight(p: number, from: number, to: number) {
  let i = 1;
  while (i < LOG_PATH.length - 1 && p > LOG_PATH[i][0]) i++;
  const [pa, xa, ya, ra, sa] = LOG_PATH[i - 1];
  const [pb, xb, yb, rb, sb] = LOG_PATH[i];
  const w = clamp((p - pa) / (pb - pa));
  const dx = xa + (xb - xa) * w;
  return { x: from + (to - from) * dx, y: GROUND - 6.5 + ya + (yb - ya) * w, rot: ra + (rb - ra) * w, scale: sa + (sb - sa) * w };
}

export function actAt(show: Show, t: number): ActName {
  let name: ActName = show.acts[0].name;
  for (const a of show.acts) if (t >= a.t0) name = a.name;
  return name;
}

/* The next act's start after t (a tap on Raf skips to it), or null in the wave at the end (a tap there starts the
   next show). */
export function nextActStart(show: Show, t: number): number | null {
  for (const a of show.acts) if (a.t0 > t + 0.05) return a.t0;
  return null;
}

/* Everything on screen at time t, for a scene S units wide. */
export function frameAt(show: Show, t: number, S: number): ShowFrame {
  const off = offAt(show, t);
  let seg: Seg | null = null;
  for (const s of show.segs) if (t >= s.t0) seg = s;
  let raf: Pose = STAND;
  let squash: ShowFrame['squash'] = null;
  const notes: ShowFrame['notes'] = [];
  if (seg && t < seg.t1) {
    const u = t - seg.t0;
    if (seg.kind === 'enter') {
      // walked in from the left edge (or, on a wide scene, from a little way in, fading in)
      const from = Math.max(-S - 14, RAF_X - 140);
      const run: Scroll = { t0: 0, t1: 1.6, from: 0, v: STEP / (1.6 - 0.3), ramp: 0.3 };
      const { d, a } = along(run, u);
      const dist = RAF_X - from;
      raf = { ...gait('walk', (d * dist) / STEP, a), x: from + (d * dist) / STEP, alpha: from > -S - 14 ? ramp(u, 0, 0.3) : 1 };
    } else if (seg.kind === 'walk' || seg.kind === 'run') {
      const { d, a } = along(show.scrolls[seg.scroll], t);
      raf = gait(seg.kind, d, a);
    } else if (seg.kind === 'crawl') {
      const sc = show.scrolls[seg.scroll];
      const { d, a } = along(sc, t);
      const T = seg.t1 - seg.t0;
      const wt = kf(u, [[0, 0], [0.45, 1], [T - 0.45, 1], [T, 0]]);
      raf = crawlPose(wt, d, t > sc.t0 && t < sc.t1 ? a : 0);
    } else if (seg.kind === 'kick') raf = kickPose(u, seg.finale);
    else if (seg.kind === 'dance') {
      raf = dancePose(u);
      const env = ramp(u, 0, 0.45) * ramp(4.6 - u, 0, 0.4);
      const b = Math.abs(Math.sin((Math.PI * u) / 0.4)) * env;
      const p = show.pieces.find((x) => x.id === `${show.n}-${seg.piece}`);
      if (p) squash = { id: p.id, sx: 1 + 0.03 * b, sy: 1 - 0.05 * b };
      for (let j = 0; j < 4; j++) {
        const q = (u - 0.3 - 0.95 * j) / 1.3;
        if (q > 0 && q < 1) notes.push({ x: RAF_X + 8 + 6 * q + 3 * Math.sin(q * 6 + j), y: GROUND - 50 - 16 * q, o: Math.sin(Math.PI * q) });
      }
    } else if (seg.kind === 'jacks') raf = jacksPose(u);
    else if (seg.kind === 'wave') raf = wavePose(u);
  }
  // the log: the next piece's, lying where it was left until it is kicked, then flying into the piece
  let log: ShowFrame['log'] = null;
  const next = show.pieces.find((p) => p.popT > t);
  if (next) {
    const k = show.segs.find((s) => s.kind === 'kick' && `${show.n}-${s.piece}` === next.id) as Extract<Seg, { kind: 'kick' }> | undefined;
    if (k) {
      const launch = k.t0 + 0.42;
      if (t < launch) log = { x: k.logX, y: GROUND - 6.5, rot: 0, scale: 1 };
      else log = logFlight((t - launch) / (next.popT - launch), k.logX, next.x);
    }
  }
  const pieces = show.pieces.filter((p) => p.popT <= t && p.x - off + SHOW_HALF[p.kind] > -S - 4).map((p) => p.id);
  return { t, off, raf, log, pieces, squash, notes, act: actAt(show, t), done: t >= show.end };
}

/* ---- kept in the browser */

/* Which show to play next (so each visit gets different pieces): localStorage, or counted for this visit if blocked. */
const SHOW_KEY = 'raf_mini_raf_show';
let showMemory = -1;
export function nextShowIndex(): number {
  let last = showMemory;
  try {
    const text = window.localStorage.getItem(SHOW_KEY);
    const kept = text === null || text === '' ? NaN : Number(text);
    if (Number.isFinite(kept) && kept >= 0) last = Math.max(last, Math.floor(kept));
  } catch {
    /* storage blocked */
  }
  const next = (last + 1) % 3600;
  showMemory = next;
  try {
    window.localStorage.setItem(SHOW_KEY, String(next));
  } catch {
    /* storage blocked */
  }
  return next;
}

/* The pieces show n hands over to the next one: its last LEGACY_KEEP, oldest first. */
export function legacyOf(show: Show): LegacyPiece[] {
  return show.pieces
    .filter((p) => !p.id.includes('-old'))
    .slice(-LEGACY_KEEP)
    .map((p) => ({ kind: p.kind, colour: p.colour, mm: p.mm }));
}

/* How far this tab's show has got, so a page loaded afresh in the same tab carries on. sessionStorage: gone when the
   tab closes. */
export type ShowNow = { n: number; replay: boolean; legacy: LegacyPiece[]; t: number; paused: boolean };
const NOW_KEY = 'raf_mini_raf_now';
const KINDS: ShowKind[] = ['cupboard', 'chest', 'wardrobe', 'bookcase', 'bedside', 'tv', 'media'];
export function readShowNow(): ShowNow | null {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(NOW_KEY) || 'null');
    if (!v || typeof v !== 'object') return null;
    const n = Number(v.n);
    const t = Number(v.t);
    if (!Number.isInteger(n) || n < 0 || !Number.isFinite(t) || t < 0) return null;
    const good = (l: { kind?: unknown; colour?: unknown; mm?: unknown } | null): l is LegacyPiece =>
      !!l && KINDS.includes(l.kind as ShowKind) && typeof l.colour === 'string' && /^#[0-9a-f]{6}$/i.test(l.colour) && typeof l.mm === 'string' && /^\d{3,4}$/.test(l.mm);
    // a list now; one piece in a tab left open from before
    const list = (Array.isArray(v.legacy) ? v.legacy : [v.legacy]).filter(good).slice(-LEGACY_KEEP);
    const legacy = list.map((l: LegacyPiece) => ({ kind: l.kind, colour: l.colour, mm: l.mm }));
    return { n, replay: !!v.replay, legacy, t: Math.min(t, 600), paused: !!v.paused };
  } catch {
    return null;
  }
}
export function saveShowNow(now: ShowNow) {
  try {
    window.sessionStorage.setItem(NOW_KEY, JSON.stringify({ ...now, t: Math.round(now.t * 100) / 100 }));
  } catch {
    /* storage blocked */
  }
}
