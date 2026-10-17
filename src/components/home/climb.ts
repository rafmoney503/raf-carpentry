/* The climb from the top-bar logo (steps/engine.ts), kept as plain numbers so the 3D steps on the home page can draw it.
   Units are the logo's 100 x 100 box: three planks at rows 72, 54 and 36, all ending at x 90, and the ball resting on
   the top one at x 74. The ball jumps in place while the stairs move down under it and a new top step grows in; after
   three climbs it rolls off the right end, drops beside the steps, comes round to the front, rolls left past the bottom
   step and hops up one, two, three. `z` is in scene units (the 3D steps are 3 units deep). */

export type Plank = { x: number; y: number; w: number; op: number; dy: number };
export type BallState = { x: number; y: number; z: number; sq: number; sqv: number; sqT: number; show: boolean };

const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Task = { t: number; d: number; fn: (u: number) => void; res: () => void };

export function makeClimb(G = 760, freshAt = 0.64) {
  const planks: Plank[] = [
    { x: 10, y: 72, w: 80, op: 1, dy: 0 },
    { x: 34, y: 54, w: 56, op: 1, dy: 0 },
    { x: 58, y: 36, w: 32, op: 1, dy: 0 },
  ];
  const ball: BallState = { x: 74, y: 36, z: 0, sq: 0, sqv: 0, sqT: 0, show: true };
  const tasks: Task[] = [];
  let alive = true;
  const tween = (d: number, fn: (u: number) => void) => new Promise<void>((res) => tasks.push({ t: 0, d, fn, res }));
  const wait = (d: number) => tween(d, () => {});

  function advance(dt: number) {
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(0.008, left);
      left -= h;
      for (const k of tasks.slice()) {
        k.t += h;
        const u = Math.min(1, k.t / k.d);
        k.fn(u);
        if (u >= 1) {
          tasks.splice(tasks.indexOf(k), 1);
          k.res();
        }
      }
      ball.sqv += (-900 * (ball.sq - ball.sqT) - 22 * ball.sqv) * h;
      ball.sq += ball.sqv * h;
    }
  }

  async function jump(x1: number, y1: number, H: number, o: { crouch?: number; z?: number; onTakeoff?: (T: number) => void } = {}) {
    if (o.crouch) {
      ball.sqT = 0.2;
      await wait(o.crouch);
      ball.sqT = 0;
      ball.sqv -= 6;
    }
    const x0 = ball.x, y0 = ball.y, z0 = ball.z, z1 = o.z ?? z0;
    const apex = Math.min(y0, y1) - H;
    const v0 = Math.sqrt(2 * G * (y0 - apex));
    const tUp = v0 / G;
    const T = tUp + Math.sqrt((2 * (y1 - apex)) / G);
    o.onTakeoff?.(T);
    await tween(T, (u) => {
      const t = u * T;
      ball.x = x0 + (x1 - x0) * u;
      ball.z = z0 + (z1 - z0) * easeInOut(u);
      ball.y = t < tUp ? y0 - (v0 * t - 0.5 * G * t * t) : apex + 0.5 * G * (t - tUp) ** 2;
    });
    ball.sqv += Math.sqrt(2 * G * (y1 - apex)) * 0.03;
  }

  function climbOnce() {
    return jump(74, 36, rand(19, 24), {
      crouch: 0.2,
      onTakeoff: (T) => {
        const old = planks.slice();
        const fresh: Plank = { x: 90, y: 36, w: 0, op: 1, dy: 0 };
        planks.push(fresh);
        const from = old.map((p) => ({ x: p.x, y: p.y, w: p.w }));
        void wait(0.04)
          .then(() =>
            tween(T * 0.7, (u) => {
              const k = easeInOut(u);
              old.forEach((p, i) => {
                p.y = from[i].y + 18 * k;
                p.x = from[i].x - 24 * k;
                p.w = from[i].w + 24 * k;
                if (i === 0) p.op = 1 - k;
              });
              // in 3D the new step waits until the old one has moved clear, so they never cut into each other
              fresh.w = 32 * easeOut(Math.max(0, (u - freshAt) / (1 - freshAt)));
              fresh.x = 90 - fresh.w;
            }),
          )
          .then(() => {
            planks.shift();
          });
      },
    });
  }

  async function tour(rollTo: number) {
    await wait(0.25);
    const x0 = ball.x;
    await tween(0.42, (u) => {
      ball.x = x0 + (90 - x0) * u * u;
    });
    const tF = Math.sqrt((2 * (86 - 36)) / G);
    await tween(tF, (u) => {
      const t = u * tF;
      ball.x = 90 + 9.5 * easeOut(clamp01(t / (tF * 0.4)));
      ball.y = 36 + 0.5 * G * t * t;
    });
    ball.sqv += 7;
    await jump(99.5, 86, 7);
    await jump(99.5, 86, 2.2);
    await tween(0.45, (u) => {
      ball.z = 2.75 * easeInOut(u);
      ball.x = 99.5 - 3 * u;
    });
    const x1 = ball.x;
    await tween(1.45, (u) => {
      ball.x = x1 + (rollTo - x1) * (1 - Math.pow(1 - u, 2.2));
    });
    await wait(0.2);
    await jump(15, 72, 10, { crouch: 0.14, z: 0 });
    await wait(0.1);
    await jump(39, 54, 10, { crouch: 0.12 });
    await wait(0.1);
    await jump(63, 36, 10, { crouch: 0.12 });
    await wait(0.3);
  }

  async function intro() {
    planks.forEach((p) => {
      p.op = 0;
      p.dy = 26;
    });
    ball.y = -70;
    ball.show = false;
    await wait(0.15);
    planks.forEach((p, i) =>
      wait(i * 0.13).then(() =>
        tween(0.8, (u) => {
          const e = easeOut(u);
          p.op = e;
          p.dy = 26 * (1 - e);
        }),
      ),
    );
    await wait(0.75);
    ball.show = true;
    const tF = Math.sqrt((2 * (36 + 70)) / G);
    await tween(tF, (u) => {
      const t = u * tF;
      ball.y = -70 + 0.5 * G * t * t;
    });
    ball.sqv += 8;
    await jump(74, 36, 12);
    await jump(74, 36, 3.5);
    await wait(0.35);
  }

  async function play(rollTo: () => number) {
    await intro();
    while (alive) {
      for (let i = 0; i < 3 && alive; i++) {
        await climbOnce();
        await wait(rand(0.04, 0.14));
      }
      if (alive) await tour(rollTo());
    }
  }

  return {
    planks,
    ball,
    advance,
    play,
    stop: () => {
      alive = false;
    },
  };
}
