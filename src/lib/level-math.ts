/* The sums behind the phone spirit level (src/app/tools/spirit-level). No imports, so a test can run it with node.

   Phone axes, as the browser gives them: x to the right of the screen held upright, y to its top, z out of the
   screen. From the browser's beta and gamma we get which way is up in those axes (alpha, the compass heading,
   doesn't come into it). Then:
   - On its edge: one edge of the phone is down. The tilt is how far "up" leans away from the phone's own up axis
     for that edge, round the screen. Positive = the right-hand end (as you look at the screen) is higher. Leaning
     the phone towards you or away doesn't change it.
   - Lying flat: the tilt each way, as angles. Positive x = the right side higher, positive y = the far end higher.
   The phone's own error (buttons, case, camera bump) is different for each edge and for lying flat, so a flip
   check result is kept per edge. Set zero is kept with the edge it was set on, so a reading from your zero still
   works when the phone is turned well past 45 degrees to find an angle.
   Also here: the words under the reading (levelWords, also what Speak says and what Save keeps), and the Tone sums. */

export type Vec = { x: number; y: number; z: number };
/** Which way the phone's own up points when that edge is down: x+ means the left long edge is down (x points up). */
export type Axis = 'x+' | 'x-' | 'y+' | 'y-';
export type Mode = 'edge' | 'flat';

const RAD = Math.PI / 180;
const toDeg = (r: number) => r / RAD;

export function norm(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Up, in the phone's axes, from DeviceOrientationEvent beta and gamma (degrees). */
export function upFromAngles(beta: number, gamma: number): Vec {
  const b = beta * RAD;
  const g = gamma * RAD;
  return { x: -Math.sin(g) * Math.cos(b), y: Math.sin(b), z: Math.cos(g) * Math.cos(b) };
}

/** Any angle to between -180 and 180. */
export function wrap180(d: number) {
  let a = ((d + 180) % 360 + 360) % 360 - 180;
  if (a === -180) a = 180;
  return a;
}

const AXES: Record<Axis, [number, number]> = { 'x+': [1, 0], 'x-': [-1, 0], 'y+': [0, 1], 'y-': [0, -1] };
const CENTRE: Record<Axis, number> = { 'y+': 0, 'x+': 90, 'y-': 180, 'x-': -90 };

/** The edge that is down. Keeps the current one until up has moved 10 degrees past the halfway point, so it doesn't flicker at 45. */
export function nearestAxis(u: Vec, current?: Axis, hold = 10): Axis {
  const phi = toDeg(Math.atan2(u.x, u.y)); // 0 = +y up, 90 = +x up
  if (current && Math.abs(wrap180(phi - CENTRE[current])) < 45 + hold) return current;
  let best: Axis = 'y+';
  let bestD = 999;
  for (const a of Object.keys(CENTRE) as Axis[]) {
    const d = Math.abs(wrap180(phi - CENTRE[a]));
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Tilt on an edge, in degrees: positive when the right-hand end (looking at the screen) is higher. */
export function edgeTilt(u: Vec, axis: Axis) {
  const [ax, ay] = AXES[axis];
  const dot = ax * u.x + ay * u.y;
  const cross = ax * u.y - ay * u.x;
  return toDeg(Math.atan2(-cross, dot));
}

/** Tilt lying flat, in the phone's axes: x positive = its right side higher, y positive = its top end higher. */
export function flatTilt(u: Vec) {
  const z = Math.abs(u.z) < 1e-6 ? 1e-6 : u.z;
  return { x: toDeg(Math.atan2(u.x, z)), y: toDeg(Math.atan2(u.y, z)) };
}

/** The screen's own up, as a phone axis, for a screen turned by `angle` degrees (screen.orientation.angle). */
export function screenAxis(angle: number): Axis {
  const a = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return a === 90 ? 'x+' : a === 180 ? 'y-' : a === 270 ? 'x-' : 'y+';
}

/** A tilt in the phone's axes turned into the screen's (right, up) for a screen turned by `angle` degrees. */
export function toScreen(x: number, y: number, angle: number) {
  const a = angle * RAD;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** How many mm one end is out over `len` mm at `d` degrees. */
export function mmOver(len: number, d: number) {
  return len * Math.tan(Math.min(Math.abs(d), 89.9) * RAD);
}

export const LEVEL = 0.05; // shows as 0.0
export const isLevel = (d: number) => Math.abs(d) < LEVEL;

export function fmtDeg(d: number) {
  return isLevel(d) ? '0.0°' : `${Math.abs(d).toFixed(1)}°`;
}

export function fmtMm(v: number) {
  if (v < 10) return `${v.toFixed(1)} mm`;
  if (v < 10000) return `${Math.round(v)} mm`;
  return `${(v / 1000).toFixed(1)} m`;
}

/** mm for the voice: one decimal under 3 mm (where it matters), whole mm above, so a wobble doesn't keep changing the words. */
export function sayMm(v: number) {
  if (v < 3) return String(Number(v.toFixed(1)));
  return String(Math.round(v));
}

export type LevelWords = {
  /** The big line under the reading: what to do. */
  main: string;
  /** The small line under it. */
  sub: string;
  icon: 'level' | 'up' | 'angle';
  /** For a saved reading: what the line says, in lower case, with the length. */
  detail: string;
  /** For Speak: short, so it can be said again as the reading changes. */
  say: string;
};

/** The words under the reading. On an edge `a` is the tilt (positive = right end high); lying flat `a` and `b` are the
 *  tilts on the screen (a positive = right side up, b positive = far end up). `fromZero` = reading from a zero the user set. */
export function levelWords(mode: Mode, a: number, b: number, len: number, fromZero: boolean): LevelWords {
  const within = `under ${mmOver(len, LEVEL).toFixed(1)} mm out over ${len}`;
  if (mode === 'edge') {
    const d = a;
    if (isLevel(d)) {
      const main = fromZero ? 'Level with your zero' : 'Level';
      return { main, sub: within, icon: 'level', detail: `${fromZero ? 'level with the zero' : 'level'} over ${len}`, say: main };
    }
    const high = d > 0 ? 'right' : 'left';
    const low = d > 0 ? 'left' : 'right';
    const mmv = mmOver(len, d);
    const mm = fmtMm(mmv);
    const perM = `${fmtMm(mmOver(1000, d))} per metre`;
    if (Math.abs(d) > 20) {
      const main = fromZero ? `${cap(high)} end up from your zero` : `${cap(high)} end high`;
      return { main, sub: `Rises ${mm} over ${len}`, icon: 'angle', detail: `${fromZero ? 'from the zero, ' : ''}${high} end up, rises ${mm} over ${len}`, say: `${Math.abs(d).toFixed(1)} degrees` };
    }
    if (fromZero) {
      return { main: `${mm} higher at the ${high} end`, sub: `over ${len} · ${perM}`, icon: 'up', detail: `from the zero, ${mm} higher at the ${high} end over ${len}`, say: `${cap(high)} end up, ${sayMm(mmv)} mil` };
    }
    return { main: `Raise the ${low} end ${mm}`, sub: `over ${len} · ${perM}`, icon: 'up', detail: `raise the ${low} end ${mm} over ${len}`, say: `Raise the ${low} end, ${sayMm(mmv)} mil` };
  }
  const x = a;
  const y = b;
  const lx = isLevel(x);
  const ly = isLevel(y);
  const lead = fromZero ? 'lying flat, from the zero' : 'lying flat';
  if (lx && ly) {
    const main = fromZero ? 'Level with your zero' : 'Level both ways';
    return { main, sub: within, icon: 'level', detail: `${lead}, level both ways over ${len}`, say: main };
  }
  const fixes: string[] = [];
  const said: string[] = [];
  if (!lx) {
    const v = mmOver(len, x);
    const side = x > 0 ? 'left side' : 'right side';
    fixes.push(`the ${side} ${fmtMm(v)}`);
    said.push(`the ${side} ${sayMm(v)} mil`);
  }
  if (!ly) {
    const v = mmOver(len, y);
    const end = y > 0 ? 'near end' : 'far end';
    fixes.push(`the ${end} ${fmtMm(v)}`);
    said.push(`the ${end} ${sayMm(v)} mil`);
  }
  const main = `Raise ${fixes.join(' and ')}`;
  return { main, sub: `over ${len}`, icon: 'up', detail: `${lead}, raise ${fixes.join(' and ')} over ${len}`, say: `Raise ${said.join(', and ')}` };
}

/* Tone: beeps start within TONE_RANGE degrees of level and come faster as it gets nearer, like a parking sensor;
   at level one higher chirp (as Beep did), then quiet until it has moved 0.15 off. */
export const TONE_RANGE = 2;

/** 0 far off to 1 at level, for the five bars on the Tone button. */
export function closeness(d: number, range = TONE_RANGE) {
  return Math.max(0, Math.min(1, 1 - Math.abs(d) / range));
}

/** Milliseconds between beeps at `d` degrees off, or null when it's too far off to beep. */
export function toneGap(d: number) {
  const a = Math.abs(d);
  if (a >= TONE_RANGE || isLevel(a)) return null;
  return Math.round(110 + 590 * Math.sqrt(a / TONE_RANGE));
}

/* Your own length (the pencil chip): 50 mm to 10 m. */
export const LEN_MIN = 50;
export const LEN_MAX = 10000;

/** A typed length in mm ('1830', '1,830', '1830 mm'), or null when it isn't one between LEN_MIN and LEN_MAX. */
export function readLength(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/,/g, '').replace(/\s*mm$/, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Math.round(Number(t));
  return v >= LEN_MIN && v <= LEN_MAX ? v : null;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Where the bubble sits, 0 to 1 of the way to the end, for a tilt: quick near level so small tilts show, slower further out. */
export function bubbleReach(d: number, full = 4) {
  return Math.sqrt(Math.min(Math.abs(d), full) / full);
}
