'use client';

import { useEffect, useRef } from 'react';

/* The shapes at the top of each page. They wander quickly around where the CSS puts them; every ten seconds or so
   they line up, links draw between them and they turn solid ink, the yellow ball runs along the chain, then the links
   break and the shapes scatter back to wandering.
   The CSS positions are the resting layout, so with no JavaScript, or for people who ask for less motion, the shapes
   simply sit still. The loop only runs while the page top is on screen and the tab is open. */

type Kind = 'circle' | 'plus' | 'dash' | 'ball' | 'square' | 'ring';

type Shape = {
  el: HTMLElement;
  kind: Kind;
  hx: number; // home centre, from the CSS layout
  hy: number;
  w: number;
  h: number;
  ax: number; // wander size and speed
  ay: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
};

const T = { wander: 4.5, gather: 1.1, link: 0.7, carry: 1.8, hold: 0.5, unlink: 0.45, release: 1.2 };
const ORDER = ['wander', 'gather', 'link', 'carry', 'hold', 'unlink', 'release'] as const;
type Phase = (typeof ORDER)[number];
const CYCLE = ORDER.reduce((sum, k) => sum + T[k], 0);
const FIRST_WANDER = 2.2;
const NODES: Kind[] = ['circle', 'plus', 'dash', 'square'];
const SVG_NS = 'http://www.w3.org/2000/svg';

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

function phaseAt(t: number): { name: Phase; p: number } {
  let u = (t + T.wander - FIRST_WANDER) % CYCLE;
  for (const name of ORDER) {
    if (u < T[name]) return { name, p: u / T[name] };
    u -= T[name];
  }
  return { name: 'wander', p: 0 };
}

function spin(kind: Kind, t: number) {
  switch (kind) {
    case 'plus':
      return 60 * t;
    case 'square':
      return 15 + 30 * Math.sin((2 * Math.PI * t) / 3.2);
    case 'dash':
      return 12 * Math.sin((2 * Math.PI * t) / 2.8);
    case 'ring':
      return 12 * t;
    default:
      return 0;
  }
}

// The nearest angle at which the shape sits square in the chain. The dash stands upright as a tick, so it doesn't
// read as one more link.
function upright(kind: Kind, r: number) {
  if (kind === 'dash') return Math.round((r - 90) / 180) * 180 + 90;
  const step = kind === 'plus' || kind === 'square' ? 90 : 360;
  return Math.round(r / step) * step;
}

export default function DriftChain() {
  const box = useRef<HTMLDivElement>(null);
  const links = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = box.current;
    const svg = links.current;
    if (!root || !svg) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const shapes: Shape[] = Array.from(root.querySelectorAll<HTMLElement>('[data-k]')).map((el, i) => ({
      el,
      kind: el.dataset.k as Kind,
      hx: 0,
      hy: 0,
      w: 0,
      h: 0,
      ax: 0,
      ay: 0,
      px: 2.6 + ((i * 0.7) % 1.6),
      py: 2.2 + ((i * 0.9) % 1.4),
      fx: i * 1.3,
      fy: i * 2.1,
    }));
    const ball = shapes.find((s) => s.kind === 'ball');
    let nodes: Shape[] = [];
    let slots: number[] = []; // x of: ball start, each node, ball end
    let cy = 0;
    let target = 16;
    let spacing = 40;
    let lines: SVGLineElement[] = [];

    const measure = () => {
      const desktop = window.matchMedia('(min-width: 1100px)').matches;
      const W = root.clientWidth;
      for (const s of shapes) {
        s.w = s.el.offsetWidth;
        s.h = s.el.offsetHeight;
        s.hx = s.el.offsetLeft + s.w / 2;
        s.hy = s.el.offsetTop + s.h / 2;
        s.ax = desktop ? 26 : 12;
        s.ay = desktop ? 20 : 6;
      }
      const head = root.parentElement;
      const rr = root.getBoundingClientRect();
      const title = head?.querySelector('.page-title')?.getBoundingClientRect();
      const lead = head?.querySelector('.lead')?.getBoundingClientRect();
      const kicker = head?.querySelector('.kicker')?.getBoundingClientRect();
      const inner = head?.querySelector<HTMLElement>('.page-head-in');
      let x0 = W * 0.3;
      let x1 = W - 16;
      cy = kicker ? (kicker.top - rr.top) / 2 : 24;
      target = 16;
      if (desktop && title && lead && inner) {
        const ir = inner.getBoundingClientRect();
        const padR = parseFloat(getComputedStyle(inner).paddingRight) || 0;
        x0 = Math.max(title.right, lead.right) - rr.left + 56;
        x1 = ir.right - padR - rr.left - 24;
        cy = title.top + title.height / 2 - rr.top;
        target = 22;
      }
      nodes = shapes.filter((s) => NODES.includes(s.kind) && s.w > 0).sort((a, b) => a.hx - b.hx);
      const count = nodes.length + 2;
      spacing = (x1 - x0) / (count - 1);
      slots = Array.from({ length: count }, (_, i) => x0 + i * spacing);

      // links between neighbouring nodes, edge to edge
      svg.replaceChildren();
      lines = [];
      for (let i = 1; i < nodes.length; i++) {
        const a = slots[i] + target / 2 + 4;
        const b = slots[i + 1] - target / 2 - 4;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(a));
        line.setAttribute('x2', String(b));
        line.setAttribute('y1', String(cy));
        line.setAttribute('y2', String(cy));
        const len = Math.max(0, b - a);
        line.style.strokeDasharray = String(len);
        line.style.strokeDashoffset = String(len);
        line.style.opacity = '0';
        line.dataset.len = String(len);
        svg.appendChild(line);
        lines.push(line);
      }
    };

    const draw = (t: number) => {
      const { name, p } = phaseAt(t);
      const k = name === 'wander' ? 0 : name === 'gather' ? ease(p) : name === 'release' ? 1 - ease(p) : 1;
      root.classList.toggle('linked', name === 'link' || name === 'carry' || name === 'hold' || (name === 'gather' && p > 0.92));

      // where the ball is on the chain
      const first = slots[0] ?? 0;
      const last = slots[slots.length - 1] ?? 0;
      const ballX = name === 'carry' ? lerp(first, last, ease(p)) : name === 'hold' || name === 'unlink' || name === 'release' ? last : first;

      for (const s of shapes) {
        const wx = s.ax * Math.sin((2 * Math.PI * t) / s.px + s.fx);
        const wy = s.ay * Math.sin((2 * Math.PI * t) / s.py + s.fy);
        const wr = spin(s.kind, t);
        let x = wx;
        let y = wy;
        let r = wr;
        let sx = 1;
        let sy = 1;
        const ni = nodes.indexOf(s);
        if (ni >= 0) {
          const cx = slots[ni + 1] - s.hx;
          const cyy = cy - s.hy;
          x = lerp(wx, cx, k);
          y = lerp(wy, cyy, k);
          r = lerp(wr, upright(s.kind, wr), k);
          const size = target / Math.max(s.w, s.h);
          sx = lerp(1, s.kind === 'dash' ? target / s.w : size, k);
          sy = s.kind === 'dash' ? 1 : sx;
          if (name === 'carry') {
            const near = clamp01(1 - Math.abs(ballX - slots[ni + 1]) / (spacing * 0.45));
            sx *= 1 + 0.3 * near;
            sy *= 1 + 0.3 * near;
          }
          if (s.kind === 'circle' || s.kind === 'square') s.el.style.borderWidth = `${1.5 / sx}px`;
        } else if (s === ball) {
          x = lerp(wx, ballX - s.hx, k);
          y = lerp(wy, cy - s.hy, k);
        }
        s.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      }

      lines.forEach((line, i) => {
        let shown = 0;
        if (name === 'link') shown = ease(clamp01(p * lines.length - i));
        else if (name === 'carry' || name === 'hold') shown = 1;
        else if (name === 'unlink') shown = 1 - ease(p);
        const len = Number(line.dataset.len);
        line.style.strokeDashoffset = String(len * (1 - shown));
        line.style.opacity = shown > 0.001 ? '1' : '0';
      });
    };

    let t = 0;
    let last = 0;
    let frame = 0;
    let onScreen = false;
    const tick = (now: number) => {
      t += Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(t);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || !onScreen || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(root);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="drift" ref={box} aria-hidden="true">
      <svg className="drift-links" ref={links} />
      <i className="d-circle" data-k="circle" />
      <i className="d-plus" data-k="plus" />
      <i className="d-dash" data-k="dash" />
      <i className="d-square" data-k="square" />
      <i className="d-ring" data-k="ring" />
      <i className="d-ball" data-k="ball" />
    </div>
  );
}
