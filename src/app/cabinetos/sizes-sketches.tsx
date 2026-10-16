import { graphPaper, hatch } from '@/app/how-it-works/sketches';
import type { CosPart } from '@/lib/cabinetos-sizes';

/* Drawings for "How CabinetOS works out the sizes" on the CabinetOS page, in the site's drafting-paper style:
   pencil-grey board, the part a rule is about in blue, blue dimension lines. Strokes keep the same width at
   any size (non-scaling), so the same drawing works on a phone and a big screen. The rule drawings are not to
   scale (boards and gaps drawn bigger); the wardrobe and the parts in the list are to scale. Decorative: the
   text beside each says the same. */

export const SIZE_SKETCHES = ['box', 'plinth', 'back', 'shelf', 'doors', 'edging'] as const;
export type SizeSketchName = (typeof SIZE_SKETCHES)[number];
export const isSizeSketch = (v: unknown): v is SizeSketchName => typeof v === 'string' && (SIZE_SKETCHES as readonly string[]).includes(v);

const svgClass = 'block h-full w-full font-mono [&_*]:[vector-effect:non-scaling-stroke]';
const soft = { fill: 'currentColor', fillOpacity: 0.14 } as const;
/* The rule drawings move (16 Oct 2026, src/app/motion.css): the box closes, the box sits down on its plinth,
   the back goes in, the shelf slides in, the doors open, the tape runs round the edges. Transforms only (the
   strokes here don't scale, so dash drawing is not used). `o(s)` starts a part s seconds later. */
const o = (s: number) => ({ '--mv-o': `${s}s` }) as React.CSSProperties;
const mv = (dx: number, dy: number, s = 0) => ({ '--mv-dx': `${dx}px`, '--mv-dy': `${dy}px`, '--mv-o': `${s}s` }) as React.CSSProperties;

/* Text with a paper-coloured halo, so it reads over the grid and the hatching. */
function Label({
  x,
  y,
  children,
  size = 5.5,
  anchor = 'middle',
  rotate = false,
  className = '',
  weight = 600,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  rotate?: boolean;
  className?: string;
  weight?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      fill="currentColor"
      strokeWidth={3}
      strokeLinejoin="round"
      className={`stroke-paper [paint-order:stroke] ${className}`}
      transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}
    >
      {children}
    </text>
  );
}

function DimH({ x1, x2, y, label, size = 5.5, below = false }: { x1: number; x2: number; y: number; label: string; size?: number; below?: boolean }) {
  const k = size * 0.45;
  return (
    <g className="text-accent">
      <path d={`M${x1} ${y - k}v${2 * k}M${x2} ${y - k}v${2 * k}M${x1} ${y}H${x2}`} strokeWidth={1} />
      <Label x={(x1 + x2) / 2} y={below ? y + size * 1.15 : y - size * 0.35} size={size}>
        {label}
      </Label>
    </g>
  );
}

function DimV({ x, y1, y2, label, size = 5.5, right = false }: { x: number; y1: number; y2: number; label: string; size?: number; right?: boolean }) {
  const k = size * 0.45;
  const lx = right ? x + size * 1.1 : x - size * 0.35;
  return (
    <g className="text-accent">
      <path d={`M${x - k} ${y1}h${2 * k}M${x - k} ${y2}h${2 * k}M${x} ${y1}V${y2}`} strokeWidth={1} />
      <Label x={lx} y={(y1 + y2) / 2} size={size} rotate>
        {label}
      </Label>
    </g>
  );
}

/* A board cut in section: outline and hatching. */
function Board({ x, y, w, h, step = 2.2 }: { x: number; y: number; w: number; h: number; step?: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} className="fill-paper" />
      <path d={hatch(x, x + w, y, y + h, step)} strokeWidth={0.75} />
    </>
  );
}

/* A small leader: a number off to one side with a line to the gap it measures. */
function Callout({ x, y, tx, ty, label, anchor = 'middle' }: { x: number; y: number; tx: number; ty: number; label: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <g className="text-accent">
      <path d={`M${tx} ${ty}L${x} ${y}`} strokeWidth={1} />
      <circle cx={x} cy={y} r={0.9} fill="currentColor" stroke="none" />
      <Label x={tx + (anchor === 'end' ? -1 : anchor === 'start' ? 1 : 0)} y={ty + (anchor === 'middle' ? -1.5 : 2)} anchor={anchor}>
        {label}
      </Label>
    </g>
  );
}

function Tiny({ x, y, children, anchor = 'middle' }: { x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <Label x={x} y={y} size={4.6} anchor={anchor} weight={500} className="text-faint">
      {children}
    </Label>
  );
}

type Sums = { side: string; inner: string; box: string; shelfW: string; shelfD: string; doorW: string; doorH: string; width: string };

/* ---------- The six rules (viewBox 120 x 80) ---------- */

function Box({ s }: { s: Sums }) {
  return (
    <>
      {/* the top and bottom lifted off a little: they run the full width, the sides (blue) fit between them */}
      <g className="mv-settle" style={mv(0, 2.5)}>
        <Board x={28} y={13} w={60} h={5} />
      </g>
      <g className="mv-settle" style={mv(0, -2.5)}>
        <Board x={28} y={63} w={60} h={5} />
      </g>
      <g className="text-accent">
        <rect x={28} y={20.5} width={5} height={40} {...soft} />
        <rect x={83} y={20.5} width={5} height={40} {...soft} />
      </g>
      <Tiny x={24} y={17.2} anchor="end">top</Tiny>
      <Tiny x={24} y={42} anchor="end">side</Tiny>
      <Tiny x={24} y={67.2} anchor="end">bottom</Tiny>
      <DimH x1={28} x2={88} y={6.5} label={s.width} />
      <DimV x={96} y1={20.5} y2={60.5} label={s.side} right />
    </>
  );
}

function Plinth({ s }: { s: Sums }) {
  return (
    <>
      {/* the box on its plinth (blue), standing on the floor */}
      <g className="mv-close" style={mv(0, -7)}>
        <rect x={34} y={8} width={56} height={50} className="fill-paper" />
        <path d="M62 8v50M59.5 30v8M64.5 30v8" strokeWidth={1} />
      </g>
      <g className="text-accent mv-beat" style={o(2.6)}>
        <rect x={34} y={58} width={56} height={9} {...soft} />
        <Label x={62} y={64.4} size={4.8}>
          plinth
        </Label>
      </g>
      <path d="M16 67H108" strokeWidth={1.2} />
      <path d={hatch(16, 108, 67, 71, 3)} strokeWidth={0.6} className="text-faint" />
      <DimV x={25} y1={8} y2={58} label={s.box} />
      <g className="text-accent">
        <path d="M95 58h3.5M95 67h3.5M96.75 58V67" strokeWidth={1} />
        <Label x={100.5} y={64.5} anchor="start">
          100
        </Label>
      </g>
    </>
  );
}

function Back({ s }: { s: Sums }) {
  return (
    <>
      {/* seen from behind: the box's board edges round the outside, the back (blue) inside them */}
      <Board x={30} y={10} w={60} h={5} />
      <Board x={30} y={61} w={60} h={5} />
      <Board x={30} y={15} w={5} h={46} step={2.6} />
      <Board x={85} y={15} w={5} h={46} step={2.6} />
      <g className="text-accent mv-pop">
        <rect x={35} y={15} width={50} height={46} {...soft} />
        <Label x={60} y={40}>
          back
        </Label>
      </g>
      <Tiny x={6} y={7.5} anchor="start">
        from behind
      </Tiny>
      <DimH x1={35} x2={85} y={73.5} label={s.inner} />
      <DimV x={97} y1={15} y2={61} label={s.side} right />
    </>
  );
}

function Shelf({ s }: { s: Sums }) {
  return (
    <>
      {/* seen from above: the two sides, the back between them, the shelf (blue) short of each */}
      <Board x={26} y={12} w={5} h={60} step={2.6} />
      <Board x={89} y={12} w={5} h={60} step={2.6} />
      <Board x={31} y={12} w={58} h={5} />
      <path d="M26 72H94" strokeWidth={1} strokeDasharray="2 2" className="text-faint" />
      <g className="text-accent mv-close" style={mv(0, 14)}>
        <rect x={34} y={17} width={52} height={50} {...soft} />
        <Label x={60} y={40.5}>
          {s.shelfW}
        </Label>
        <Label x={60} y={48.5} size={4.8}>
          {`× ${s.shelfD}`}
        </Label>
      </g>
      <Tiny x={6} y={7.5} anchor="start">
        from above
      </Tiny>
      <Tiny x={60} y={9.2}>
        back
      </Tiny>
      <Tiny x={60} y={78.5}>
        front
      </Tiny>
      <g className="mv-pop" style={o(2.6)}>
        <Callout x={32.5} y={30} tx={18} ty={30} label="2" anchor="end" />
      </g>
      <g className="mv-pop" style={o(2.8)}>
        <Callout x={87.5} y={30} tx={102} ty={30} label="2" anchor="start" />
      </g>
      <g className="mv-pop" style={o(3)}>
        <Callout x={78} y={69.5} tx={102} ty={62} label="2" anchor="start" />
      </g>
    </>
  );
}

function Doors({ s }: { s: Sums }) {
  return (
    <>
      {/* the box (dashed, behind) and a pair of doors (blue) covering its front, with the gaps */}
      <rect x={30} y={10} width={60} height={56} strokeWidth={1} strokeDasharray="2 2" className="text-faint" />
      <g className="mv-swing-door mv-ol">
        <rect className="text-accent" x={31.6} y={13.5} width={27.4} height={52.5} {...soft} strokeWidth={1.4} />
        <path d="M56 34v9" strokeWidth={1.4} />
      </g>
      <g className="mv-swing-door mv-or">
        <rect className="text-accent" x={61} y={13.5} width={27.4} height={52.5} {...soft} strokeWidth={1.4} />
        <path d="M64 34v9" strokeWidth={1.4} />
      </g>
      <g className="mv-away">
        <Callout x={40} y={11.8} tx={22} ty={6.5} label="3" anchor="end" />
        <Callout x={60} y={22} tx={60} ty={5.5} label="4" />
        <Callout x={89.2} y={46} tx={101} ty={46} label="2" anchor="start" />
      </g>
      <DimV x={22} y1={13.5} y2={66} label={s.doorH} />
      <DimH x1={31.6} x2={59} y={74} label={s.doorW} />
    </>
  );
}

function Edging() {
  return (
    <>
      {/* a shelf with tape on its front edge, a door with tape all round */}
      <rect x={10} y={24} width={52} height={30} className="fill-paper" />
      <Tiny x={36} y={41}>
        shelf
      </Tiny>
      <g className="text-accent">
        <path className="mv-grow-x mv-ol" d="M10 54H62" strokeWidth={3.5} />
        <Label x={36} y={63.5} size={5}>
          front edge
        </Label>
      </g>
      <rect x={76} y={9} width={30} height={56} className="fill-paper" />
      <Tiny x={91} y={39}>
        door
      </Tiny>
      <g className="text-accent">
        <path className="mv-grow-x mv-ol" style={o(0.7)} d="M76 9H106" strokeWidth={3.5} />
        <path className="mv-grow-y mv-ot" style={o(1)} d="M106 9V65" strokeWidth={3.5} />
        <path className="mv-grow-x mv-or" style={o(1.3)} d="M106 65H76" strokeWidth={3.5} />
        <path className="mv-grow-y mv-ob" style={o(1.6)} d="M76 65V9" strokeWidth={3.5} />
        <Label x={91} y={74.5} size={5}>
          all four
        </Label>
      </g>
    </>
  );
}

export function RuleSketch({ name, sums, delay = 0 }: { name: SizeSketchName; sums: Sums; delay?: number }) {
  const body =
    name === 'box' ? (
      <Box s={sums} />
    ) : name === 'plinth' ? (
      <Plinth s={sums} />
    ) : name === 'back' ? (
      <Back s={sums} />
    ) : name === 'shelf' ? (
      <Shelf s={sums} />
    ) : name === 'doors' ? (
      <Doors s={sums} />
    ) : (
      <Edging />
    );
  return (
    <div
      className="relative aspect-[3/2] w-full overflow-hidden border-b border-line bg-paper text-ink"
      style={{ ...graphPaper, '--mv-d': `${delay}s` } as React.CSSProperties}
      data-motion=""
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 80" className={svgClass} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {body}
      </svg>
    </div>
  );
}

/* ---------- The wardrobe in the example, to scale: front and side ---------- */

export function WardrobeDrawing({ w, h, d, plinth, doors, alt }: { w: number; h: number; d: number; plinth: number; doors: number; alt: string }) {
  const k = 0.1; // 1 mm = 0.1 units
  const top = 16;
  const fx = 50;
  const W = w * k;
  const H = h * k;
  const P = plinth * k;
  const D = d * k;
  const sx = fx + W + 28;
  const floor = top + H;
  const doorW = W / doors;
  return (
    <svg viewBox={`0 0 ${sx + D + 12} ${floor + 34}`} role="img" aria-label={alt} className={`${svgClass} text-ink`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {/* front: doors over the box, plinth below */}
      <rect x={fx} y={top} width={W} height={H - P} className="fill-paper" />
      {Array.from({ length: doors }, (_, i) => (
        <rect key={i} x={fx + i * doorW} y={top} width={doorW} height={H - P} className="fill-paper" />
      ))}
      {doors === 2 ? <path d={`M${fx + doorW - 4} ${top + 84}v22M${fx + doorW + 4} ${top + 84}v22`} strokeWidth={2} /> : <path d={`M${fx + W - 6} ${top + 84}v22`} strokeWidth={2} />}
      <rect x={fx} y={floor - P} width={W} height={P} className="fill-paper" />
      {/* side: the box, the doors' edge at the front, the plinth */}
      <rect x={sx} y={top} width={D} height={H - P} className="fill-paper" />
      <rect x={sx} y={floor - P} width={D} height={P} className="fill-paper" />
      <path d={`M${sx + 1.8} ${top}V${floor - P}M${sx + D - 1.8} ${top}V${floor - P}`} strokeWidth={0.75} strokeDasharray="3 3" className="text-faint" />
      {/* floor */}
      <path d={`M${fx - 20} ${floor}H${sx + D + 10}`} strokeWidth={1.2} />
      <path d={hatch(fx - 20, sx + D + 10, floor, floor + 4, 4)} strokeWidth={0.6} className="text-faint" />
      <DimV x={fx - 12} y1={top} y2={floor} label={String(h)} size={9.5} />
      <DimH x1={fx} x2={fx + W} y={floor + 18} label={String(w)} size={9.5} />
      <DimH x1={sx} x2={sx + D} y={floor + 18} label={String(d)} size={9.5} />
      <Label x={fx + W / 2} y={top - 6} size={7.5} weight={500} className="text-faint">
        Front
      </Label>
      <Label x={sx + D / 2} y={top - 6} size={7.5} weight={500} className="text-faint">
        Side
      </Label>
    </svg>
  );
}

/* ---------- One part of the cut list, to scale, lying flat ---------- */

/* Drawn with its longer side across. Edges with tape are blue: L1/L2 run along the length, W1/W2 along the
   width; the first of each pair is drawn at the bottom or left (the front edge, as it lies on the bench). */
export function PartShape({ part }: { part: CosPart }) {
  const across = Math.max(part.length, part.width);
  const down = Math.min(part.length, part.width);
  const turned = part.width > part.length;
  const e = part.edges;
  const bottom = turned ? e.W1 : e.L1;
  const topE = turned ? e.W2 : e.L2;
  const left = turned ? e.L1 : e.W1;
  const right = turned ? e.L2 : e.W2;
  const edge = (x1: number, y1: number, x2: number, y2: number) => <path d={`M${x1} ${y1}L${x2} ${y2}`} strokeWidth={3.5} className="text-accent" />;
  return (
    <svg
      viewBox={`0 0 ${across} ${down}`}
      preserveAspectRatio="none"
      className="block h-auto overflow-visible text-ink [&_*]:[vector-effect:non-scaling-stroke]"
      style={{ width: `calc(${across}px * var(--s))`, aspectRatio: `${across} / ${down}` }}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect x={0} y={0} width={across} height={down} strokeWidth={1.2} className={part.hardware ? 'fill-raised-2' : 'fill-mount'} rx={part.hardware ? down / 2 : 0} />
      {bottom ? edge(0, down, across, down) : null}
      {topE ? edge(0, 0, across, 0) : null}
      {left ? edge(0, 0, 0, down) : null}
      {right ? edge(across, 0, across, down) : null}
    </svg>
  );
}
