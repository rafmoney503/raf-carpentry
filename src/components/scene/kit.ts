/* The drawing kit shared by the two page-top scenes (loop.ts, cog.ts): SVG helpers, springs, the big circle as a
   path that can squeeze, wobble and grow teeth, and the three kinds of shape (a box that can be a square, a tile or a
   circle; two strokes that can be a plus, a cross or a tick; the yellow ball that squashes and stretches).
   Every stroke keeps 1.5 px whatever the scene is scaled to (non-scaling-stroke). */

export const NS = 'http://www.w3.org/2000/svg';
export const INK = '#15171A';
export const HL = '#FFE45C';
export const FAINT = 0.42;

export type Pt = [number, number];
export type Layout = 'tall' | 'strip';

export interface Scene {
  g: SVGGElement;
  w: number; // the scene's own size, for fitting it into its space
  h: number;
  cycle: number; // seconds before it starts again
  still: number; // the moment shown when people ask for less motion
  reset(): void;
  step(t: number, dt: number): void;
}

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const ease = (p: number) => {
  p = clamp01(p);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};
export const easeBack = (p: number) => {
  p = clamp01(p);
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
export const f = (n: number) => n.toFixed(2);

export class Spring {
  x = 0;
  v = 0;
  target = 0;
  constructor(
    public k: number,
    public c: number,
  ) {}
  step(dt: number) {
    const a = -this.k * (this.x - this.target) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
  }
}

const sq = (u: number) => Math.tanh(3 * Math.sin(u)) / Math.tanh(3);

/* The big circle: `wob` squashes it into an oval (turned by `wobAng`), `teeth` grows 12 cog teeth turned by `phase`. */
export function ringD(cx: number, cy: number, R: number, o: { wob?: number; wobAng?: number; teeth?: number; phase?: number }) {
  let d = '';
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = R * (1 + (o.wob ?? 0) * Math.cos(2 * (th - (o.wobAng ?? 0)))) + (o.teeth ?? 0) * sq(12 * th + (o.phase ?? 0));
    d += (i ? 'L' : 'M') + f(cx + r * Math.cos(th)) + ' ' + f(cy + r * Math.sin(th));
  }
  return d + 'Z';
}

export const ns = { 'vector-effect': 'non-scaling-stroke' };

type Pose = { x: number; y: number; rot?: number; sx?: number; sy?: number; op: number; extra?: string };
const poseT = (o: Pose) => `translate(${f(o.x)} ${f(o.y)})${o.extra ?? ''} rotate(${f(o.rot ?? 0)}) scale(${f(o.sx ?? 1)} ${f(o.sy ?? o.sx ?? 1)})`;

/* A square, a rounded tile or a circle, depending on rx. */
export class Box {
  g: SVGGElement;
  r: SVGRectElement;
  constructor(parent: Element) {
    this.g = el('g', {}, parent);
    this.r = el('rect', { 'stroke-width': 1.5, stroke: INK, fill: INK, ...ns }, this.g);
  }
  set(o: Pose & { w: number; h: number; rx?: number; fill?: number }) {
    const { w, h } = o;
    this.r.setAttribute('x', f(-w / 2));
    this.r.setAttribute('y', f(-h / 2));
    this.r.setAttribute('width', f(w));
    this.r.setAttribute('height', f(h));
    this.r.setAttribute('rx', f(Math.min(o.rx ?? 0, w / 2, h / 2)));
    this.r.setAttribute('stroke-opacity', f(o.op));
    this.r.setAttribute('fill-opacity', f(o.fill ?? 0));
    this.g.setAttribute('transform', poseT(o));
  }
}

/* Two strokes (4 points: a plus, a cross when turned, a tick) or one bent line (3 points: a dash, a bar). */
export class Strokes {
  g: SVGGElement;
  p: SVGPathElement;
  constructor(parent: Element) {
    this.g = el('g', {}, parent);
    this.p = el('path', { fill: 'none', stroke: INK, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...ns }, this.g);
  }
  set(o: Pose & { pts: Pt[]; sw?: number }) {
    const P = o.pts;
    const m = (p: Pt) => `${f(p[0])} ${f(p[1])}`;
    this.p.setAttribute('d', P.length > 3 ? `M${m(P[0])}L${m(P[1])}M${m(P[2])}L${m(P[3])}` : `M${m(P[0])}L${m(P[1])}L${m(P[2])}`);
    this.p.setAttribute('stroke-opacity', f(o.op));
    this.p.setAttribute('stroke-width', f(o.sw ?? 1.5));
    this.g.setAttribute('transform', poseT(o));
  }
}

export const lerpPts = (A: Pt[], B: Pt[], k: number): Pt[] => A.map((p, i) => [lerp(p[0], B[i][0], k), lerp(p[1], B[i][1], k)]);
export const scalePts = (A: Pt[], s: number): Pt[] => A.map((p) => [p[0] * s, p[1] * s]);
export const PLUS: Pt[] = [
  [-11, 0],
  [11, 0],
  [0, -11],
  [0, 11],
];
export const TICK: Pt[] = [
  [-9, 1],
  [-3, 7],
  [-3, 7],
  [10, -8],
];

/* The yellow ball, drawn from its bottom point: it squashes on landing and stretches when moving fast. */
export class Ball {
  g: SVGGElement;
  sq = new Spring(700, 20);
  st = 0;
  constructor(
    parent: Element,
    public R: number,
  ) {
    this.g = el('g', {}, parent);
    el('circle', { cx: 0, cy: -R, r: R, fill: HL, stroke: INK, 'stroke-width': 1.5, ...ns }, this.g);
  }
  draw(x: number, yBottom: number, airV: number, dt: number) {
    const target = airV ? Math.min(0.2, (Math.abs(airV) / 900) * 0.2) : 0;
    this.st += (target - this.st) * Math.min(1, dt * 20);
    const s = Math.max(-0.25, Math.min(0.42, this.sq.x));
    const sy = (1 - s) * (1 + this.st);
    const sx = (1 + 0.7 * s) / (1 + 0.5 * this.st);
    this.g.setAttribute('transform', `translate(${f(x)} ${f(yBottom)}) scale(${f(sx)} ${f(sy)})`);
  }
}
