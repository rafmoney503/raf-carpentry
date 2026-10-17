import { Ball, Box, FAINT, HL, INK, PLUS, Spring, Strokes, TICK, clamp01, ease, easeBack, el, f, lerp, lerpPts, ns, ringD, scalePts, type Layout, type Pt, type Scene } from './kit';

/* Scene A, 'through the loop': the big circle is the machine. Four rough, faint shapes fly into it one at a time; it
   squeezes, spins faster and sends each one out finished into a line (the plus becomes a tick, the hollow circle a
   solid tile, the tilted square a solid block, the loose dash an upright bar). Links draw, the ball rolls out of the
   circle and runs along the chain, then it hops back in and the shapes drift back out rough. 8.8 s a turn.
   'tall' fits beside a page title on a computer, 'strip' is the short wide version for phones. */

type Geo = {
  w: number;
  h: number;
  C: { x: number; y: number };
  R: number;
  homes: { x: number; y: number }[];
  slots: number[];
  SY: number;
  ballEnd: number;
  k: number; // shape size
  ballR: number;
  hop: number;
  wander: number;
};

const GEO: Record<Layout, Geo> = {
  tall: { w: 460, h: 340, C: { x: 130, y: 170 }, R: 60, homes: [{ x: 28, y: 86 }, { x: 78, y: 40 }, { x: 32, y: 262 }, { x: 92, y: 300 }], slots: [240, 295, 350, 405], SY: 170, ballEnd: 439, k: 1, ballR: 8, hop: 70, wander: 1 },
  strip: { w: 360, h: 120, C: { x: 112, y: 60 }, R: 36, homes: [{ x: 24, y: 30 }, { x: 60, y: 16 }, { x: 22, y: 92 }, { x: 64, y: 104 }], slots: [196, 232, 268, 304], SY: 60, ballEnd: 330, k: 0.72, ballR: 6, hop: 40, wander: 0.55 },
};

const CYCLE = 8.8;
const RING_FAINT = 0.26;

export function makeLoop(parent: Element, layout: Layout): Scene {
  const G = GEO[layout];
  const { C, R, k: K } = G;
  const g = el('g', {}, parent);
  const ringFill = el('path', { fill: HL, 'fill-opacity': 0, stroke: 'none' }, g);
  const ring = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.5, 'stroke-dasharray': '6 6', ...ns }, g);
  const links = [0, 1, 2].map(() => el('line', { stroke: INK, 'stroke-width': 1.5, opacity: 0, ...ns }, g));

  type S = { kind: 'box' | 'plus' | 'dash'; home: { x: number; y: number }; ph: number; rough: { w: number; rx: number; rot: number }; fin: { w: number; rx: number }; view: Box | Strokes; slot: number; start: number };
  const spec: Omit<S, 'view' | 'slot' | 'start' | 'home'>[] = [
    { kind: 'box', ph: 0, rough: { w: 20, rx: 0, rot: 15 }, fin: { w: 22, rx: 2 } },
    { kind: 'box', ph: 1.7, rough: { w: 30, rx: 15, rot: 0 }, fin: { w: 24, rx: 6 } },
    { kind: 'plus', ph: 3.1, rough: { w: 0, rx: 0, rot: 20 }, fin: { w: 0, rx: 0 } },
    { kind: 'dash', ph: 4.4, rough: { w: 0, rx: 0, rot: -18 }, fin: { w: 0, rx: 0 } },
  ];
  const shapes: S[] = spec.map((s, i) => ({ ...s, home: G.homes[i], view: s.kind === 'box' ? new Box(g) : new Strokes(g), slot: G.slots[i], start: 1.4 + i * 0.75 }));
  const ball = new Ball(g, G.ballR);
  let squeeze = new Spring(260, 9);
  let wob = new Spring(220, 6);
  let dashPos = 0;
  let prevU = 0;
  let landed = true;

  const PL = scalePts(PLUS, K);
  const TK = scalePts(TICK, K);
  const DASH: Pt[] = scalePts([[-20, 0], [0, 0], [20, 0]], K);
  const BAR: Pt[] = scalePts([[0, -11], [0, 0], [0, 11]], K);

  function reset() {
    squeeze = new Spring(260, 9);
    wob = new Spring(220, 6);
    ball.sq = new Spring(700, 20);
    dashPos = 0;
    prevU = 0;
    landed = true;
  }

  function step(t: number, dt: number) {
    const u = t % CYCLE;
    dashPos += dt * (u > 1.3 && u < 4.9 ? 140 : 10);
    for (const s of shapes) {
      if (prevU < s.start + 0.4 && u >= s.start + 0.4) squeeze.v -= 2.2; // a shape arrives: the circle squeezes
      if (prevU < s.start + 0.65 && u >= s.start + 0.65) wob.v += 2.4; // and wobbles as it lets go
    }
    prevU = u;
    squeeze.step(dt);
    wob.step(dt);
    ball.sq.step(dt);

    const Rnow = R * (1 + squeeze.x * 0.9);
    const bowl = Rnow - G.ballR - 3;
    const d = ringD(C.x, C.y, Rnow, { wob: wob.x * 0.08, wobAng: t * 2 });
    ring.setAttribute('d', d);
    ringFill.setAttribute('d', d);
    ring.setAttribute('stroke-dashoffset', f(-dashPos));
    const working = clamp01((u - 1.3) / 0.3) * (1 - clamp01((u - 4.8) / 0.4));
    ring.setAttribute('stroke-opacity', f(lerp(RING_FAINT, 1, working)));
    ringFill.setAttribute('fill-opacity', f(Math.min(0.35, Math.max(0, -squeeze.x) * 2.5)));

    // the ball: rests in the bottom of the circle, rides up the side while it works, runs the chain, hops back
    const inBowl = (a: number): [number, number] => [C.x + bowl * Math.sin(a), C.y + bowl * Math.cos(a) + G.ballR];
    let bx: number, by: number;
    let airV = 0;
    if (u < 1.4) [bx, by] = inBowl(0.18 * Math.sin(t * 2.4));
    else if (u < 4.7) [bx, by] = inBowl(lerp(0, 1.05, ease((u - 1.4) / 0.4)) * (1 - ease((u - 4.3) / 0.4)) + 0.08 * Math.sin(t * 11));
    else if (u < 5.2) [bx, by] = inBowl(lerp(0, Math.PI / 2, ease((u - 4.7) / 0.5)));
    else if (u < 6.6) {
      bx = lerp(C.x + bowl, G.ballEnd, ease((u - 5.2) / 1.4));
      by = G.SY + G.ballR;
    } else if (u < 7.4) {
      bx = G.ballEnd;
      by = G.SY + G.ballR;
    } else {
      // one jump under gravity, back into the circle
      const T = 0.62;
      const tt = clamp01((u - 7.4) / T) * T;
      const x0 = G.ballEnd;
      const y0 = G.SY + G.ballR;
      const x1 = C.x;
      const y1 = C.y + bowl + G.ballR;
      const apex = Math.min(y0, y1) - G.hop;
      const grav = (2 * (y0 - apex + (y1 - apex) + 2 * Math.sqrt((y0 - apex) * (y1 - apex)))) / (T * T);
      const vy0 = -grav * Math.sqrt((2 * (y0 - apex)) / grav);
      if (tt < T) {
        bx = lerp(x0, x1, tt / T);
        by = y0 + vy0 * tt + 0.5 * grav * tt * tt;
        airV = vy0 + grav * tt;
        landed = false;
      } else {
        if (!landed) ball.sq.v += 6;
        landed = true;
        [bx, by] = inBowl(0.18 * Math.sin(t * 2.4));
      }
    }
    ball.draw(bx, by, airV, dt);

    // links between the finished shapes
    const lk = u < 4.7 ? 0 : u < 5.2 ? (u - 4.7) / 0.5 : u < 7.0 ? 1 : u < 7.4 ? 1 - (u - 7.0) / 0.4 : 0;
    links.forEach((l, i) => {
      const shown = ease(clamp01(lk * 3 - i));
      const a = G.slots[i] + 15 * K;
      const b = G.slots[i + 1] - 15 * K;
      l.setAttribute('x1', f(a));
      l.setAttribute('x2', f(lerp(a, b, shown)));
      l.setAttribute('y1', f(G.SY));
      l.setAttribute('y2', f(G.SY));
      l.setAttribute('opacity', shown > 0.01 ? '1' : '0');
    });

    for (const s of shapes) {
      const wx = s.home.x + 10 * G.wander * Math.sin(t * 1.3 + s.ph);
      const wy = s.home.y + 7 * G.wander * Math.sin(t * 1.7 + s.ph * 1.3);
      let x = wx;
      let y = wy;
      let m = 0; // 0 rough, 1 finished
      let op = FAINT;
      let sc = 1;
      let spin = 0;
      const s0 = s.start;
      if (u < s0) {
        // drifting, rough
      } else if (u < s0 + 0.4) {
        const p = ease((u - s0) / 0.4);
        const cx = (wx + C.x) / 2;
        const cy = Math.min(wy, C.y) - 40 * K;
        x = (1 - p) * (1 - p) * wx + 2 * (1 - p) * p * cx + p * p * C.x;
        y = (1 - p) * (1 - p) * wy + 2 * (1 - p) * p * cy + p * p * C.y;
        sc = lerp(1, 0.75, p);
        op = lerp(FAINT, 1, p);
      } else if (u < s0 + 0.65) {
        const q = ease((u - s0 - 0.4) / 0.25);
        x = C.x;
        y = C.y;
        m = q;
        spin = 360 * q;
        sc = 0.75;
        op = 1;
      } else if (u < s0 + 1.05) {
        const q = easeBack((u - s0 - 0.65) / 0.4);
        x = lerp(C.x, s.slot, q);
        y = C.y;
        m = 1;
        sc = lerp(0.75, 1, clamp01(q));
        op = 1;
      } else if (u < 7.4) {
        x = s.slot;
        y = G.SY;
        m = 1;
        op = 1;
        if (u > 5.2 && u < 6.6) sc = 1 + 0.3 * clamp01(1 - Math.abs(bx - s.slot) / (26 * K));
      } else {
        const r = ease((u - 7.4) / 1.2);
        x = lerp(s.slot, wx, r);
        y = lerp(G.SY, wy, r);
        m = 1 - r;
        spin = -360 * r;
        op = lerp(1, FAINT, r);
      }
      const wrot = 8 * Math.sin(t * 1.1 + s.ph);
      if (s.view instanceof Box) {
        const w = lerp(s.rough.w, s.fin.w, m) * K;
        s.view.set({ x, y, w, h: w, rx: lerp(s.rough.rx, s.fin.rx, m) * K, rot: lerp(s.rough.rot + wrot, 0, m) + spin, fill: m, op, sx: sc });
      } else if (s.kind === 'plus') {
        s.view.set({ x, y, pts: lerpPts(PL, TK, m), rot: lerp(s.rough.rot + wrot * 3, 0, m) + spin, op, sw: lerp(1.5, 2, m), sx: sc });
      } else {
        s.view.set({ x, y, pts: lerpPts(DASH, BAR, m), rot: lerp(s.rough.rot + wrot, 0, m) + spin, op, sw: lerp(1.5, 2, m), sx: sc });
      }
    }
  }

  reset();
  step(0, 0);
  return { g, w: G.w, h: G.h, cycle: CYCLE, still: 6.9, reset, step };
}
