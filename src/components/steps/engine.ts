/* The steps logo as a little physics toy: three planks and the yellow ball, drawn into an SVG the page already has
   (StepsMark.tsx). Gravity is the same for every jump; the ball crouches before a jump, stretches in the air,
   squashes when it lands and bounces smaller each time, and the plank it lands on gives a little.
   Three plays:
   - climb: three climbs (it hops up a step while the stairs move down under it and a new top step grows in), then it
     rolls off the right end of the top step, drops down beside the steps, rolls back along the ground in front of the
     bottom step and hops up the steps one, two, three; then three climbs again (the top bar)
   - mix: it jumps high, the planks jumble into a random pile under it; next jump they snap back into steps
     (the 'Start here' band)
   - build: the planks are pulled out from under it one at a time, then slide back in as it jumps up each one
     (the 'Sketch my system' card)
   Units are the logo's own 100 x 100 box. */

const G = 900;
const R = 9.5;
const RING = 1.5;
const PH = 14;
const E2 = 0.18; // each bounce reaches this share of the last height
const ROW_Y = [72, 54, 36];
const REST_X = 74;
const REST_Y = ROW_Y[2] - RING;
const FLOOR_Y = 86 - RING;

export const REST = [
  { x: 10, y: 72, w: 80 },
  { x: 34, y: 54, w: 56 },
  { x: 58, y: 36, w: 32 },
];

type Plank = { x: number; y: number; w: number; rot: number; dip: number; dipV: number; op: number };
type Task = { fn: (dt: number) => boolean; res: () => void };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const shuffle = <T,>(a: T[]) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeIn = (u: number) => u * u * u;
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);

export class StepsEngine {
  planks: Plank[] = [];
  ball = { x: REST_X, y: REST_Y, vy: 0, air: false, on: null as Plank | null, sq: 0, sqV: 0, sqT: 0, st: 0 };
  private tasks: Task[] = [];

  constructor(
    private rects: SVGRectElement[],
    private ballEl: SVGGElement,
  ) {
    this.reset();
  }

  reset() {
    this.planks = REST.map((p) => ({ ...p, rot: 0, dip: 0, dipV: 0, op: 1 }));
    this.ball = { x: REST_X, y: REST_Y, vy: 0, air: false, on: this.planks[2], sq: 0, sqV: 0, sqT: 0, st: 0 };
    this.tasks = [];
  }

  /* nothing moving and nothing waiting */
  idle() {
    const b = this.ball;
    return this.tasks.length === 0 && !b.air && Math.abs(b.sq) < 0.002 && Math.abs(b.sqV) < 0.02 && this.planks.every((p) => Math.abs(p.dip) < 0.01 && Math.abs(p.dipV) < 0.05);
  }

  addTask(fn: (dt: number) => boolean) {
    return new Promise<void>((res) => this.tasks.push({ fn, res }));
  }
  wait(s: number) {
    let t = 0;
    return this.addTask((dt) => (t += dt) >= s);
  }
  tween(dur: number, fn: (u: number) => void) {
    let t = 0;
    return this.addTask((dt) => {
      t += dt;
      const u = Math.min(1, t / dur);
      fn(u);
      return u >= 1;
    });
  }

  advance(dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.004));
    for (let i = 0; i < n; i++) {
      const h = dt / n;
      for (const task of this.tasks.slice()) {
        if (task.fn(h)) {
          this.tasks.splice(this.tasks.indexOf(task), 1);
          task.res();
        }
      }
      const b = this.ball;
      b.sqV += (-900 * (b.sq - b.sqT) - 22 * b.sqV) * h;
      b.sq += b.sqV * h;
      const target = b.air ? Math.min(0.16, (Math.abs(b.vy) / 270) * 0.15) : 0;
      b.st += (target - b.st) * Math.min(1, h * 22);
      for (const p of this.planks) {
        p.dipV += (-1400 * p.dip - 30 * p.dipV) * h;
        p.dip += p.dipV * h;
      }
    }
  }

  render() {
    const b = this.ball;
    const sq = Math.max(-0.25, Math.min(0.42, b.sq));
    const sy = (1 - sq) * (1 + b.st);
    const sx = (1 + 0.7 * sq) / (1 + 0.55 * b.st);
    const dip = !b.air && b.on ? b.on.dip : 0;
    this.ballEl.setAttribute('transform', `translate(${b.x.toFixed(2)} ${(b.y + dip).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
    this.rects.forEach((r, i) => {
      const p = this.planks[i];
      if (!p || p.w < 0.3 || p.op < 0.01) {
        r.setAttribute('display', 'none');
        return;
      }
      r.removeAttribute('display');
      r.setAttribute('width', p.w.toFixed(2));
      r.setAttribute('opacity', p.op.toFixed(3));
      r.setAttribute('transform', `translate(${(p.x + p.w / 2).toFixed(2)} ${(p.y + PH / 2 + p.dip).toFixed(2)}) rotate(${p.rot.toFixed(2)}) translate(${(-p.w / 2).toFixed(2)} ${-PH / 2})`);
    });
  }

  private plankUnder(x: number, y: number) {
    let best: Plank | null = null;
    for (const p of this.planks) if (p.op > 0.5 && Math.abs(p.y - RING - y) < 0.6 && x >= p.x - 2 && x <= p.x + p.w + 2) best = p;
    return best;
  }

  /* One jump to (x1, y1) rising H above the higher end (H 0 is a plain fall). Resolves with the height it fell from. */
  jump(x1: number, y1: number, H: number, opts: { crouch?: number; onTakeoff?: (T: number) => void } = {}) {
    const b = this.ball;
    const crouch = opts.crouch ?? 0.22;
    const start = crouch > 0 ? ((b.sqT = crouch), this.wait(0.1)) : Promise.resolve();
    return start.then(() => {
      b.sqT = 0;
      const x0 = b.x;
      const y0 = b.y + (b.on && !b.air ? b.on.dip : 0);
      const apex = Math.min(y0, y1) - H;
      const tUp = Math.sqrt((2 * Math.max(0, y0 - apex)) / G);
      const tDown = Math.sqrt((2 * (y1 - apex)) / G);
      const T = tUp + tDown;
      const vy0 = -G * tUp;
      let t = 0;
      b.air = true;
      b.on = null;
      b.x = x0;
      b.y = y0;
      opts.onTakeoff?.(T);
      return this.addTask((dt) => {
        t += dt;
        const tt = Math.min(t, T);
        b.x = x0 + (x1 - x0) * (tt / T);
        b.y = y0 + vy0 * tt + 0.5 * G * tt * tt;
        b.vy = vy0 + G * tt;
        return t >= T;
      }).then(() => {
        b.x = x1;
        b.y = y1;
        b.air = false;
        b.vy = 0;
        const v = G * tDown;
        b.on = this.plankUnder(x1, y1);
        b.sqV += v * 0.03;
        if (b.on) b.on.dipV += v * 0.22;
        return y1 - apex;
      });
    });
  }

  /* Rolling over the corner at (cx, cy) with speed v: it turns round the corner under gravity, then drops straight down
     beside the face below it to the ground, and bounces smaller each time. */
  tipAndDrop(cx: number, cy: number, v: number, ground: number): Promise<void> {
    const b = this.ball;
    const r = R + RING;
    let phi = 0;
    let w = v / r;
    return this.addTask((dt) => {
      w += (G / r) * Math.sin(phi) * dt;
      phi = Math.min(Math.PI / 2, phi + w * dt);
      b.air = true;
      b.on = null;
      b.x = cx + r * Math.sin(phi);
      b.y = cy - r * Math.cos(phi) + R;
      b.vy = w * r * Math.sin(phi);
      return phi >= Math.PI / 2;
    })
      .then(() => {
        const v0 = w * r;
        const y0 = b.y;
        const T = (-v0 + Math.sqrt(v0 * v0 + 2 * G * (ground - y0))) / G;
        let t = 0;
        return this.addTask((dt) => {
          t += dt;
          const tt = Math.min(t, T);
          b.y = y0 + v0 * tt + 0.5 * G * tt * tt;
          b.vy = v0 + G * tt;
          return t >= T;
        }).then(() => {
          const hit = v0 + G * T;
          b.y = ground;
          b.air = false;
          b.vy = 0;
          b.on = null;
          b.sqV += hit * 0.03;
          return (hit * hit) / (2 * G);
        });
      })
      .then((fall) => {
        const bounce = (h: number): Promise<void> | void => {
          const next = h * E2;
          if (next < 1.3) return;
          return this.jump(b.x, ground, next, { crouch: 0 }).then(bounce);
        };
        return bounce(fall);
      });
  }

  /* A jump followed by its own smaller and smaller bounces. */
  settle(x1: number, y1: number, H: number, opts: { crouch?: number; onTakeoff?: (T: number) => void } = {}): Promise<void> {
    const bounce = (fall: number): Promise<void> | void => {
      const h = fall * E2;
      if (h < 1.3) return;
      return this.jump(x1, y1, h, { crouch: 0 }).then(bounce);
    };
    return this.jump(x1, y1, H, opts).then(bounce);
  }
}

export type StepsPlay = 'climb' | 'mix' | 'build';

function climbOnce(e: StepsEngine) {
  return e.jump(REST_X, REST_Y, rand(19, 24), {
    crouch: 0.2,
    onTakeoff: (T) => {
      const old = e.planks.slice();
      const fresh: Plank = { x: 90, y: ROW_Y[2], w: 0, rot: 0, dip: 0, dipV: 0, op: 1 };
      e.planks.push(fresh);
      const from = old.map((p) => ({ x: p.x, y: p.y, w: p.w }));
      e.wait(0.04).then(() =>
        e
          .tween(T * 0.7, (u) => {
            const k = easeInOut(u);
            old.forEach((p, i) => {
              p.y = from[i].y + 18 * k;
              p.x = from[i].x - 24 * k;
              p.w = from[i].w + 24 * k;
              if (i === 0) p.op = 1 - k;
            });
            fresh.w = 32 * easeOut(Math.max(0, (u - 0.35) / 0.65));
            fresh.x = 90 - fresh.w;
          })
          .then(() => {
            e.planks.shift();
          }),
      );
    },
  });
}

async function climbs3(e: StepsEngine) {
  for (let i = 0; i < 3; i++) {
    await climbOnce(e);
    await e.wait(rand(0.02, 0.1));
  }
}

async function climb(e: StepsEngine) {
  await climbs3(e);
  await tour(e);
}

async function tour(e: StepsEngine) {
  const b = e.ball;
  await e.wait(0.2);
  // it rolls right along the top step, picking up speed, tips over the corner and drops straight down beside the steps
  const x0 = b.x;
  await e.tween(0.38, (u) => {
    b.x = x0 + (90 - x0) * u * u;
  });
  await e.tipAndDrop(90, ROW_Y[2], 80, FLOOR_Y);
  await e.wait(0.05);
  // then rolls left along the ground, in front of the bottom step, and slows to a stop just past its end
  const x1 = b.x;
  await e.tween(1.25, (u) => {
    b.x = x1 + (-12 - x1) * (1 - Math.pow(1 - u, 2.2));
  });
  await e.wait(0.2);
  // and hops up the steps, one, two, three, landing near the front of each (every hop clears the step above by 5)
  await e.settle(15, ROW_Y[0] - RING, 10);
  await e.wait(0.1);
  await e.settle(39, ROW_Y[1] - RING, 10);
  await e.wait(0.1);
  await e.settle(63, ROW_Y[2] - RING, 10);
  await e.wait(0.3);
}

function mix(e: StepsEngine) {
  const b = e.ball;
  const W = [80, 56, 32];
  const moveTo = (layout: { x: number; row: number }[]) =>
    Promise.all(
      shuffle([0, 1, 2]).map((idx, i) =>
        e.wait(i * 0.045).then(() => {
          const p = e.planks[idx];
          const x0 = p.x;
          const y0 = p.y;
          const x1 = layout[idx].x;
          const y1 = ROW_Y[layout[idx].row];
          if (Math.abs(x0 - x1) < 0.01 && Math.abs(y0 - y1) < 0.01) return;
          const lift = 9 + Math.abs(y1 - y0) * 0.35 + (y1 < y0 ? 6 : 0);
          const spin = rand(6, 13) * (Math.random() < 0.5 ? -1 : 1);
          return e
            .tween(0.38, (u) => {
              const k = easeInOut(u);
              p.x = x0 + (x1 - x0) * k;
              p.y = y0 + (y1 - y0) * k - lift * 4 * u * (1 - u);
              p.rot = spin * Math.sin(Math.PI * u);
            })
            .then(() => {
              p.x = x1;
              p.y = y1;
              p.rot = 0;
              p.dipV += 45;
            });
        }),
      ),
    );
  let rows: number[];
  do rows = shuffle([0, 1, 2]);
  while (rows[0] === 0 && rows[1] === 1 && rows[2] === 2);
  const mixed = W.map((w, i) => ({ x: Math.max(4, Math.min(96 - w, 50 + rand(-10, 10) - w / 2)), row: rows[i] }));
  const top = rows.indexOf(2);
  const order = REST.map((p, i) => ({ x: p.x, row: i }));
  return e
    .settle(b.x, b.y, rand(10, 14))
    .then(() => e.wait(0.5))
    .then(() => e.settle(mixed[top].x + W[top] * rand(0.3, 0.7), REST_Y, 40, { onTakeoff: () => void e.wait(0.05).then(() => moveTo(mixed)) }))
    .then(() => e.wait(0.9))
    .then(() => e.settle(REST_X + rand(-2, 2), REST_Y, 40, { onTakeoff: () => void e.wait(0.05).then(() => moveTo(order)) }));
}

function build(e: StepsEngine) {
  const b = e.ball;
  const P = e.planks;
  // pulled out to the right, fast, like a tablecloth: the ball drops once the end has passed it
  const pullOut = (p: Plank, dropTo: number) => {
    const x0 = p.x;
    let dropped = false;
    return e
      .tween(0.26, (u) => {
        p.x = x0 + 30 * easeIn(u);
        p.op = 1 - Math.max(0, (u - 0.45) / 0.55);
        if (!dropped && p.x > b.x) {
          dropped = true;
          void e.settle(b.x, dropTo, 0, { crouch: 0 });
        }
      })
      .then(() => {
        p.op = 0;
      });
  };
  // slid in from the left while the ball jumps over its path and lands on it
  const slideIn = (p: Plank, x1: number, landY: number) => {
    p.x = x1 - 26;
    p.op = 0;
    return e.settle(b.x, landY, 10, {
      onTakeoff: () =>
        void e.wait(0.1).then(() =>
          e
            .tween(0.26, (u) => {
              p.x = x1 - 26 + 26 * easeOut(u);
              p.op = Math.min(1, u * 2.2);
            })
            .then(() => {
              p.x = x1;
              p.op = 1;
              p.dipV += 30;
            }),
        ),
    });
  };
  return e
    .wait(0.3)
    .then(() => pullOut(P[2], ROW_Y[1] - RING))
    .then(() => e.wait(0.55))
    .then(() => pullOut(P[1], ROW_Y[0] - RING))
    .then(() => e.wait(0.55))
    .then(() => pullOut(P[0], FLOOR_Y))
    .then(() => e.wait(0.8))
    .then(() => slideIn(P[0], 10, ROW_Y[0] - RING))
    .then(() => e.wait(0.15))
    .then(() => slideIn(P[1], 34, ROW_Y[1] - RING))
    .then(() => e.wait(0.15))
    .then(() => slideIn(P[2], 58, ROW_Y[2] - RING));
}

export const PLAYS: Record<StepsPlay, (e: StepsEngine) => Promise<unknown>> = { climb, mix, build };
/* Played once after the last round when a play is told to stop: the climb ends on its three climbs, so the ball comes
   to rest where the logo has it, on the top step. */
export const FINALE: Partial<Record<StepsPlay, (e: StepsEngine) => Promise<unknown>>> = { climb: climbs3 };
export const GAPS: Record<StepsPlay, number> = { climb: 0, mix: 2.2, build: 2 };
