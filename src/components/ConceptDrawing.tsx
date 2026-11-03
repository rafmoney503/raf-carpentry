import type { ReactNode } from 'react';
import type { Box, Handles, Option, Section, Style } from '@/lib/concept-plan';

/* A Design with Claude option drawn to scale (src/lib/concept-plan.ts), from the front with the doors on or with the
   doors off to show the inside. Used by the Job Kit (src/app/job-kit/concepts.tsx) and the customer's page
   (/ideas/<code>). One svg in mm (y up from the floor), the run's walls and floor round it, the width under it. */

const INK = '#23262a';
const CARCASS = '#d9d5cc';
const INSIDE = '#f1ede5';
const INSIDE_LINE = '#a8a399';
const BIRCH = '#cdbb9f';
const BIRCH_LINE = '#8c7b63';
const OAK = '#c9a574';
const OAK_LINE = '#8a6a3d';
const METAL = '#2e3236';
const DIM = '#2f5d8a';

type Props = { option: Option; width: number; height: number; view: 'front' | 'inside'; colour: string; uid: string; label?: string; className?: string };

export function ConceptDrawing({ option, width: W, height: H, view, colour, uid, label, className }: Props) {
  const out: ReactNode[] = [];
  let k = 0;
  const Y = (mm: number) => H - mm;
  const hatch = `url(#cd-hat-${uid})`;
  const tg = `url(#cd-tg-${uid})`;
  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none', sw = 0, rx = 0) =>
    out.push(<rect key={k++} x={x} y={Y(y + h)} width={Math.max(0, w)} height={Math.max(0, h)} rx={rx} fill={fill} stroke={stroke} strokeWidth={sw} />);
  const top = H + 200;
  // walls and floor
  rect(-70, 0, 70, top, hatch, INK, 8);
  rect(W, 0, 70, top, hatch, INK, 8);
  let x0 = 0;
  const bayX = option.bays.map((b) => {
    const at = x0;
    x0 += b.width;
    return at;
  });
  option.bays.forEach((b, i) => {
    const x = bayX[i];
    rect(x, 0, b.width, b.height, CARCASS);
    if (b.height < H || b.boxedAbove) rect(x, b.height, b.width, top - b.height, hatch, INK, 8);
  });
  option.bays.forEach((b, i) => {
    const x = bayX[i];
    const boxes = option.boxes.filter((bx) => bx.bay === i);
    for (const s of b.sections) {
      if (view === 'front' && s.front !== 'open') drawFront(x, b.width, s, option.style, option.handles, colour, rect, out, () => k++, Y, i === option.bays.length - 1);
      else drawInside(x, b.width, s, boxes, rect, out, () => k++, Y, colour, view === 'front', tg, hatch);
    }
    rect(x, b.height - 20, b.width, 20, colour, INK, 6);
  });
  // floor
  out.push(<line key={k++} x1={-70} y1={Y(0)} x2={W + 70} y2={Y(0)} stroke={INK} strokeWidth={16} />);
  // the width under it, each bay's width just under the line, the whole size under that
  const fs = Math.max(90, Math.min(150, W / 30));
  const dy = Y(0) + 70;
  out.push(<line key={k++} x1={0} y1={dy} x2={W} y2={dy} stroke={DIM} strokeWidth={7} />);
  [...bayX, W].forEach((x) => out.push(<line key={k++} x1={x} y1={dy - 35} x2={x} y2={dy + 35} stroke={DIM} strokeWidth={7} />));
  const many = option.bays.length > 1;
  option.bays.forEach((b, i) => {
    if (many && b.width >= fs * 4.2) {
      out.push(
        <text key={k++} x={bayX[i] + b.width / 2} y={dy + 45 + fs * 0.8} textAnchor="middle" fontSize={fs * 0.82} fill={DIM} fontFamily="ui-monospace, monospace">
          {b.width.toLocaleString('en-GB')}
        </text>,
      );
    }
  });
  const totalY = dy + (many ? 95 + fs * 1.8 : 45 + fs);
  out.push(
    <text key={k++} x={W / 2} y={totalY} textAnchor="middle" fontSize={fs} fill={DIM} fontFamily="ui-monospace, monospace">
      {`${W.toLocaleString('en-GB')} × ${H.toLocaleString('en-GB')} mm`}
    </text>,
  );
  const vbH = totalY + fs * 0.35 + 30 + (top - H);
  return (
    <svg viewBox={`-80 ${-(top - H)} ${W + 160} ${vbH}`} role="img" aria-label={label ?? `${option.name}, ${view === 'front' ? 'doors closed' : 'inside'}`} className={className} style={{ display: 'block', width: '100%', height: 'auto' }}>
      <defs>
        <pattern id={`cd-hat-${uid}`} patternUnits="userSpaceOnUse" width={70} height={70} patternTransform="rotate(45)">
          <rect width={70} height={70} fill="#ece8e0" />
          <rect width={9} height={70} fill="#a9a397" />
        </pattern>
        <pattern id={`cd-tg-${uid}`} patternUnits="userSpaceOnUse" width={96} height={100}>
          <rect width={96} height={100} fill="#e9e4d9" />
          <rect x={91} width={5} height={100} fill="#cfc8ba" />
        </pattern>
      </defs>
      {out}
    </svg>
  );
}

type RectFn = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, sw?: number, rx?: number) => void;

/* Where a handle sits on a front from..to: near the top of a low cupboard, near the bottom of a high one, else at
   about 1,000 from the floor. */
const gripAt = (from: number, to: number) => (to <= 1100 ? to - 160 : from >= 900 ? from + 200 : Math.min(to - 200, Math.max(from + 200, 1000)));

function handle(kind: Handles, x: number, y: number, vertical: boolean, rect: RectFn, out: ReactNode[], key: () => number, Y: (n: number) => number) {
  if (kind === 'push') return;
  if (kind === 'knob') {
    out.push(<circle key={key()} cx={x} cy={Y(y)} r={22} fill={METAL} />);
    return;
  }
  if (kind === 'edge') {
    if (vertical) rect(x - 8, y - 60, 16, 120, METAL, 'none', 0, 4);
    else rect(x - 60, y - 8, 120, 16, METAL, 'none', 0, 4);
    return;
  }
  if (vertical) rect(x - 8, y - 120, 16, 240, METAL, 'none', 0, 8);
  else rect(x - 110, y - 8, 220, 16, METAL, 'none', 0, 8);
}

function door(x: number, y0: number, w: number, h: number, style: Style, colour: string, rect: RectFn) {
  rect(x + 6, y0 + 4, w - 12, h - 8, colour, INK, 8, 2);
  if (style === 'shaker' && w > 220 && h > 220) rect(x + 66, y0 + 64, w - 132, h - 128, 'none', '#5e6458', 6, 2);
}

function drawFront(x: number, w: number, s: Section, style: Style, kind: Handles, colour: string, rect: RectFn, out: ReactNode[], key: () => number, Y: (n: number) => number, last: boolean) {
  const h = s.to - s.from;
  const g = gripAt(s.from, s.to);
  if (s.front === 'doors') {
    door(x, s.from, w / 2, h, style, colour, rect);
    door(x + w / 2, s.from, w / 2, h, style, colour, rect);
    handle(kind, x + w / 2 - (kind === 'knob' ? 90 : kind === 'edge' ? 6 : 74), g, true, rect, out, key, Y);
    handle(kind, x + w / 2 + (kind === 'knob' ? 90 : kind === 'edge' ? 6 : 74), g, true, rect, out, key, Y);
  } else if (s.front === 'door') {
    door(x, s.from, w, h, style, colour, rect);
    const right = (s.hinge ?? (last ? 'right' : 'left')) === 'left';
    handle(kind, right ? x + w - (kind === 'knob' ? 90 : kind === 'edge' ? 6 : 74) : x + (kind === 'knob' ? 90 : kind === 'edge' ? 6 : 74), g, true, rect, out, key, Y);
  } else if (s.front === 'drawers') {
    const n = Math.max(1, s.drawers ?? 3);
    const each = h / n;
    for (let i = 0; i < n; i++) {
      const y0 = s.from + i * each;
      door(x, y0, w, each, style, colour, rect);
      handle(kind, x + w / 2, y0 + each - Math.min(90, each / 3), false, rect, out, key, Y);
    }
  }
}

function drawInside(x: number, w: number, s: Section, boxes: Box[], rect: RectFn, out: ReactNode[], key: () => number, Y: (n: number) => number, colour: string, front: boolean, tg: string, hatch: string) {
  const open = s.front === 'open';
  const base = open && s.worktop ? 30 : 0;
  if (open && s.worktop) rect(x, s.from, w, 30, OAK, OAK_LINE, 6);
  // the back: boarded look for open shelves, plain inside a cupboard
  if (open) rect(x + 18, s.from + base, w - 36, s.to - s.from - base, tg);
  else rect(x + 18, s.from + 6, w - 36, s.to - s.from - 12, INSIDE, INSIDE_LINE, 6);
  for (const b of boxes) {
    const lo = Math.max(b.from, s.from + base);
    const hi = Math.min(b.to, s.to);
    if (hi - lo > 10) rect(x + 18, lo, w - 36, hi - lo, hatch, '#6e6a62', 5);
  }
  if (open) {
    rect(x, s.from + base, 18, s.to - s.from - base, colour, INK, 6);
    rect(x + w - 18, s.from + base, 18, s.to - s.from - base, colour, INK, 6);
  }
  for (const y of s.shelves) rect(x + 18, y, w - 36, 22, open ? colour : BIRCH, open ? INK : BIRCH_LINE, 5);
  if (s.front === 'drawers' && !front) {
    const n = Math.max(1, s.drawers ?? 3);
    const each = (s.to - s.from) / n;
    for (let i = 0; i < n; i++) rect(x + 40, s.from + i * each + 20, w - 80, each - 50, '#e6dac6', BIRCH_LINE, 5, 3);
  }
  if (s.rail) {
    rect(x + 40, s.rail - 10, w - 80, 20, METAL, 'none', 0, 8);
  }
  if (s.hooks) {
    const y = Math.min(s.to - 120, s.from + 1300);
    rect(x + 60, y, w - 120, 18, BIRCH_LINE, 'none', 0, 6);
    const n = Math.max(2, Math.floor((w - 160) / 140));
    for (let i = 0; i <= n; i++) rect(x + 80 + ((w - 176) / n) * i, y - 50, 12, 50, BIRCH_LINE);
  }
  // a few jars on open shelves from the front, so it reads as a pantry or dresser
  if (open && front) {
    const surfaces = [s.from + base, ...s.shelves.map((y) => y + 22)];
    surfaces.forEach((sy, j) => {
      const above = [...s.shelves, s.to].filter((y) => y > sy).sort((a, b) => a - b)[0] ?? s.to;
      const room = above - sy;
      if (room < 140) return;
      const jh = Math.min(room - 50, j === 0 ? 220 : 150);
      const count = Math.floor((w - 120) / 120);
      for (let i = 0; i < count; i++) {
        if ((i + j) % 3 === 2) continue;
        const jx = x + 50 + i * 120 + (j % 2) * 30;
        const h = jh - ((i * 37 + j * 23) % 60);
        rect(jx, sy, 80, h, '#dce4e1', '#7e8c87', 5, 12);
        rect(jx + 8, sy + h, 64, 20, OAK_LINE);
      }
    });
  }
}
