import { Ball, Box, INK, PLUS, Spring, Strokes, clamp01, ease, el, f, lerp, lerpPts, ns, ringD, scalePts, type Layout, type Pt, type Scene } from './kit';

/* Scene B, 'the cog': four faint shapes orbit the big circle, faster when close and stretched by their speed, while
   the yellow ball runs round its rim the other way and knocks each one as it passes (a knock briefly turns the square
   round, the circle square, the plus into a cross and the dash into a tick). Every 9.2 s they line up: the ball drops
   into the middle as the axle, the circle grows teeth and turns as a cog, links run through it and the shapes turn
   with it. Then they let go and orbit again. 'tall' fits beside a page title on a computer, 'strip' is for phones. */

type Geo = {
  w: number;
  h: number;
  C: { x: number; y: number };
  R: number;
  a: number[];
  b: number[];
  inner: number;
  outer: number;
  k: number;
  ballR: number;
  teeth: number;
  bump: number;
};

const GEO: Record<Layout, Geo> = {
  tall: { w: 460, h: 340, C: { x: 240, y: 170 }, R: 60, a: [118, 142, 166, 190], b: [75.5, 90.9, 106.2, 121.6], inner: 126, outer: 196, k: 1, ballR: 8, teeth: 6.5, bump: 70 },
  strip: { w: 360, h: 120, C: { x: 180, y: 60 }, R: 30, a: [72, 100, 128, 156], b: [44, 47, 50, 53], inner: 62, outer: 124, k: 0.72, ballR: 6, teeth: 4, bump: 40 },
};

const CYCLE = 9.2;
const KINDS = ['square', 'plus', 'circle', 'dash'] as const;
const SPEED = [118, 142, 166, 190].map((a) => 1.35 * Math.pow(118 / a, 1.5));
const START = [0.4, 2.2, 4.1, 5.4];

export function makeCog(parent: Element, layout: Layout): Scene {
  const G = GEO[layout];
  const { C, R, k: K } = G;
  const g = el('g', {}, parent);
  const links = [0, 1, 2, 3].map(() => el('line', { stroke: INK, 'stroke-width': 1.5, opacity: 0, ...ns }, g));
  const ring = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.5, ...ns }, g);
  const hub = el('circle', { cx: C.x, cy: C.y, r: 4 * K, fill: INK, opacity: 0 }, g);
  const SL = [C.x - G.outer, C.x - G.inner, C.x + G.inner, C.x + G.outer];

  type O = { kind: (typeof KINDS)[number]; a: number; b: number; w: number; th: number; view: Box | Strokes; kick: Spring; spinS: Spring; flash: number; side: boolean | null };
  const orbits: O[] = KINDS.map((kind, i) => ({
    kind,
    a: G.a[i],
    b: G.b[i],
    w: SPEED[i],
    th: START[i],
    view: kind === 'square' || kind === 'circle' ? new Box(g) : new Strokes(g),
    kick: new Spring(260, 9),
    spinS: new Spring(120, 7),
    flash: 0,
    side: null,
  }));
  const ball = new Ball(g, G.ballR);
  let ballBump = new Spring(500, 14);
  let beta = 0.8;
  let cogAng = 0;
  let dashPos = 0;
  let prevU = 0;
  let slotOf: number[] | null = null;

  const PL = scalePts(PLUS, K * 0.9);
  const DASH: Pt[] = scalePts([[-18, 0], [0, 0], [18, 0]], K);
  const DTICK: Pt[] = scalePts([[-9, -2], [-3, 6], [12, -10]], K);

  function reset() {
    orbits.forEach((o, i) => {
      o.th = START[i];
      o.kick = new Spring(260, 9);
      o.spinS = new Spring(120, 7);
      o.flash = 0;
      o.side = null;
    });
    ballBump = new Spring(500, 14);
    ball.sq = new Spring(700, 20);
    beta = 0.8;
    cogAng = 0;
    dashPos = 0;
    prevU = 0;
    slotOf = null;
  }

  function step(t: number, dt: number) {
    const u = t % CYCLE;
    const m = u < 5.4 ? 0 : u < 6.4 ? ease((u - 5.4) / 1.0) : u < 8.1 ? 1 : u < 9.1 ? 1 - ease((u - 8.1) / 1.0) : 0;
    if (prevU < 5.4 && u >= 5.4) {
      // each shape takes the slot on its own side, so nobody crosses
      const xs = orbits.map((o, i) => ({ i, x: o.a * Math.cos(o.th) })).sort((p, q) => p.x - q.x);
      slotOf = [];
      xs.forEach((p, j) => (slotOf![p.i] = SL[j]));
    }
    prevU = u;
    const free = 1 - m;
    beta -= 2.3 * dt * free;
    cogAng += dt * 1.3 * m;
    dashPos += dt * (10 + 30 * free);
    ballBump.step(dt);
    ball.sq.step(dt);

    const teeth = G.teeth * m;
    ring.setAttribute('d', ringD(C.x, C.y, R - teeth * 0.4, { teeth, phase: cogAng * 12 }));
    const gap = 6 * (1 - m);
    ring.setAttribute('stroke-dasharray', `${f(12 - gap)} ${f(Math.max(0.001, gap))}`);
    ring.setAttribute('stroke-dashoffset', f(-dashPos));
    ring.setAttribute('stroke-opacity', f(lerp(0.34, 1, m)));
    hub.setAttribute('opacity', f(m));

    const rim = R + ballBump.x * K;
    ball.draw(lerp(C.x + rim * Math.cos(beta), C.x, m), lerp(C.y + rim * Math.sin(beta), C.y, m) + G.ballR, 0, dt);

    orbits.forEach((o, i) => {
      o.th += o.w * dt * free;
      o.kick.step(dt);
      o.spinS.step(dt);
      o.flash = Math.max(0, o.flash - dt * 1.6);
      // the ball passing this shape's direction knocks it
      const polar = Math.atan2(o.b * Math.sin(o.th), o.a * Math.cos(o.th));
      const diff = Math.atan2(Math.sin(beta - polar), Math.cos(beta - polar));
      const side = diff > 0;
      if (o.side !== null && side !== o.side && Math.abs(diff) < 0.5 && free > 0.9) {
        o.kick.v += 4.5;
        o.spinS.v += 9;
        o.flash = 1;
        ballBump.v += G.bump;
      }
      o.side = side;
      const rr = 1 + o.kick.x * 0.12;
      const ox = C.x + o.a * rr * Math.cos(o.th);
      const oy = C.y + o.b * rr * Math.sin(o.th);
      const depth = (Math.sin(o.th) + 1) / 2;
      const x = slotOf ? lerp(ox, slotOf[i], m) : ox;
      const y = slotOf ? lerp(oy, C.y, m) : oy;
      // stretched along the way it moves
      const tx = -o.a * Math.sin(o.th) * o.w;
      const ty = o.b * Math.cos(o.th) * o.w;
      const st = Math.min(0.45, Math.hypot(tx, ty) / (260 * K)) * free;
      const ang = (Math.atan2(ty, tx) * 180) / Math.PI;
      const extra = ` rotate(${f(ang)}) scale(${f(1 + st)} ${f(1 / Math.sqrt(1 + st))}) rotate(${f(-ang)})`;
      const sc = lerp(0.82 + 0.25 * depth, 1, m);
      const op = lerp(0.3 + 0.3 * depth, 1, Math.max(m, o.flash * 0.8));
      const rot = o.spinS.x * 10 + (i % 2 ? 1 : -1) * cogAng * 57.3 * 1.8 * m; // turning with the cog
      const fl = o.flash;
      if (o.kind === 'square') (o.view as Box).set({ x, y, w: 20 * K, h: 20 * K, rx: 10 * K * fl, rot: 15 + rot, op, sx: sc, extra });
      else if (o.kind === 'circle') (o.view as Box).set({ x, y, w: 26 * K, h: 26 * K, rx: 13 * K * (1 - fl), rot, op, sx: sc, extra });
      else if (o.kind === 'plus') (o.view as Strokes).set({ x, y, pts: PL, rot: 45 * fl + rot, op, sx: sc, extra });
      else (o.view as Strokes).set({ x, y, pts: lerpPts(DASH, DTICK, fl), rot, op, sx: sc, extra });
    });

    // links through the cog while it turns
    const lk = clamp01((u - 6.2) / 0.5) * (1 - clamp01((u - 8.0) / 0.3));
    const segs = [
      [SL[0] + 16 * K, SL[1] - 16 * K],
      [SL[1] + 16 * K, C.x - R - 8 * K],
      [C.x + R + 8 * K, SL[2] - 16 * K],
      [SL[2] + 16 * K, SL[3] - 16 * K],
    ];
    links.forEach((l, j) => {
      const shown = slotOf ? ease(clamp01(lk * 4 - j)) : 0;
      l.setAttribute('x1', f(segs[j][0]));
      l.setAttribute('x2', f(lerp(segs[j][0], segs[j][1], shown)));
      l.setAttribute('y1', f(C.y));
      l.setAttribute('y2', f(C.y));
      l.setAttribute('opacity', shown > 0.01 ? '1' : '0');
    });
  }

  reset();
  step(0, 0);
  return { g, w: G.w, h: G.h, cycle: CYCLE, still: 7.2, reset, step };
}
