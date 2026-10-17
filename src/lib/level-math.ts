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
   works when the phone is turned well past 45 degrees to find an angle. */

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

/** The two lines under the reading, on an edge. `fromZero` = reading from a zero the user set. */
export function edgeWords(d: number, len: number, fromZero: boolean) {
  if (isLevel(d)) return { dir: fromZero ? 'Level with your zero' : 'Level', fix: '' };
  const high = d > 0 ? 'right' : 'left';
  const low = d > 0 ? 'left' : 'right';
  const mm = fmtMm(mmOver(len, d));
  if (fromZero) return { dir: `${cap(high)} end up from your zero`, fix: Math.abs(d) <= 20 ? `${mm} higher at the ${high} over ${len}` : `Rises ${mm} over ${len}` };
  return { dir: `${cap(high)} end high`, fix: Math.abs(d) <= 20 ? `Raise the ${low} end ${mm} over ${len}` : `Rises ${mm} over ${len}` };
}

/** The two lines under the reading, lying flat. x, y on the screen: x positive = right side up, y positive = far end up. */
export function flatWords(x: number, y: number, len: number, fromZero: boolean) {
  const lx = isLevel(x);
  const ly = isLevel(y);
  if (lx && ly) return { dir: fromZero ? 'Level with your zero' : 'Level both ways', fix: '' };
  const highs: string[] = [];
  const fixes: string[] = [];
  if (!lx) {
    highs.push(x > 0 ? 'right side high' : 'left side high');
    fixes.push(`the ${x > 0 ? 'left side' : 'right side'} ${fmtMm(mmOver(len, x))}`);
  }
  if (!ly) {
    highs.push(y > 0 ? 'far end high' : 'near end high');
    fixes.push(`the ${y > 0 ? 'near end' : 'far end'} ${fmtMm(mmOver(len, y))}`);
  }
  const dir = cap(highs.join(', ')) + (fromZero ? ' from your zero' : '');
  return { dir, fix: `Raise ${fixes.join(' and ')} over ${len}` };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Where the bubble sits, 0 to 1 of the way to the end, for a tilt: quick near level so small tilts show, slower further out. */
export function bubbleReach(d: number, full = 4) {
  return Math.sqrt(Math.min(Math.abs(d), full) / full);
}
