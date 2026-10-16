import { graphPaper } from '@/app/how-it-works/sketches';

/* The line drawings for the services that have no job photos yet (door fitting, flooring, stud walls), drawn here
   so they can move (16 Oct 2026, Raf: 'all static designs on website to make it more interactive'; motion in
   src/app/motion.css): the door swings open and shut, the floorboards are laid and the blue one goes in, the
   stud wall is framed, noggined and boarded. Same drawings as scripts/service-drawings.mjs, which still makes the
   JPEGs for sharing pictures. Shown in place of those JPEGs on /services and the service pages (serviceDrawingFor).
   Decorative: the words beside them say the same. */

export const SERVICE_DRAWINGS = ['door-fitting', 'flooring', 'stud-walls'] as const;
export type ServiceDrawingName = (typeof SERVICE_DRAWINGS)[number];

/* '/images/services/flooring.jpg' -> 'flooring' when there is a moving version of that picture */
export function serviceDrawingFor(image: string | undefined | null): ServiceDrawingName | null {
  const m = image?.match(/^\/images\/services\/([a-z-]+)\.jpg$/);
  return m && (SERVICE_DRAWINGS as readonly string[]).includes(m[1]) ? (m[1] as ServiceDrawingName) : null;
}

const o = (s: number) => ({ '--mv-o': `${s}s` }) as React.CSSProperties;

function Door() {
  return (
    <>
      <path d="M70 262H330" />
      <path d="M126 262V38H274V262" />
      <path d="M140 262V52H260V262" strokeWidth="1.6" />
      <g className="mv-swing-door mv-ol">
        <rect x="146" y="58" width="108" height="202" className="fill-mount" />
        <g strokeWidth="1.5">
          <rect x="158" y="72" width="36" height="76" />
          <rect x="206" y="72" width="36" height="76" />
          <rect x="158" y="166" width="36" height="80" />
          <rect x="206" y="166" width="36" height="80" />
        </g>
        <circle cx="246" cy="158" r="4.5" strokeWidth="1.8" />
      </g>
      <g className="text-accent">
        <path d="M143 84v18M143 214v18" strokeWidth="4" />
        <path d="M146 18v12M254 18v12" strokeWidth="1.8" />
        <path className="mv-draw" style={o(4.2)} pathLength={1} d="M191 24H146M209 24H254" strokeWidth="1.8" />
        <text x="200" y="28.5" fill="currentColor" stroke="none" fontSize="13" fontWeight="600" textAnchor="middle">
          W
        </text>
      </g>
    </>
  );
}

/* Floor in perspective: boards run to the back wall, joints staggered, one board in blue. */
const N = 11;
const yB = 118;
const yF = 272;
const xB0 = 70;
const xB1 = 330;
const xF0 = 14;
const xF1 = 386;
const at = (i: number, y: number) => {
  const t = (y - yB) / (yF - yB);
  const xb = xB0 + (i * (xB1 - xB0)) / N;
  const xf = xF0 + (i * (xF1 - xF0)) / N;
  return +(xb + t * (xf - xb)).toFixed(1);
};
const BLUE_BOARD = 7;
const yBlue = 200;

function Flooring() {
  const joints: string[] = [];
  for (let i = 0; i < N; i++) {
    if (i === BLUE_BOARD) continue;
    const y = yB + 18 + ((i * 47) % 120);
    joints.push(`M${at(i, y)} ${y}L${at(i + 1, y)} ${y}`);
  }
  return (
    <>
      <path d={`M${xB0} 40V${yB}M${xB1} 40V${yB}`} />
      <path d={`M${xB0} ${yB - 14}H${xB1}`} strokeWidth="1.6" />
      <path d={`M${xB0} ${yB}H${xB1}`} />
      <path d={`M${xB0} ${yB}L${xF0} ${yF}M${xB1} ${yB}L${xF1} ${yF}`} />
      <g strokeWidth="1.2">
        {Array.from({ length: N + 1 }, (_, i) => (
          <path key={i} className="mv-draw" style={o(i * 0.07)} pathLength={1} d={`M${at(i, yB)} ${yB}L${at(i, yF)} ${yF}`} />
        ))}
        <path className="mv-show" style={o(0.4)} d={joints.join('')} />
      </g>
      <path
        className="mv-lay text-accent"
        style={o(1.1)}
        d={`M${at(BLUE_BOARD, yBlue)} ${yBlue}L${at(BLUE_BOARD, yF)} ${yF}L${at(BLUE_BOARD + 1, yF)} ${yF}L${at(BLUE_BOARD + 1, yBlue)} ${yBlue}Z`}
        strokeWidth="2.4"
        fill="currentColor"
        fillOpacity="0.08"
      />
    </>
  );
}

const STUDS = [84, 132, 180, 228, 276, 316];

function StudWall() {
  const screws: [number, number][] = [];
  for (const x of [233, 281, 321]) for (let y = 70; y < 246; y += 22) screws.push([x, y]);
  return (
    <>
      <path d="M40 40H360M40 262H360" />
      <rect x="84" y="44" width="242" height="10" className="fill-mount" />
      <rect x="84" y="250" width="242" height="10" className="fill-mount" />
      <g strokeWidth="1.8">
        {STUDS.map((x, i) => (
          <rect key={x} className="fill-mount mv-grow-y mv-ob" style={o(i * 0.12)} x={x} y="54" width="10" height="196" />
        ))}
      </g>
      <g className="text-accent" strokeWidth="1.8">
        {STUDS.slice(0, -1).map((x, i) => (
          <rect key={x} className="fill-mount mv-pop" style={o(0.9 + i * 0.1)} x={x + 10} y={i % 2 ? 160 : 146} width={STUDS[i + 1] - x - 10} height="9" />
        ))}
      </g>
      <g className="mv-board">
        <rect x="228" y="54" width="98" height="196" className="fill-mount" strokeWidth="1.8" />
        <g className="mv-screws">
          {screws.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" stroke="none" />
          ))}
        </g>
      </g>
    </>
  );
}

export default function ServiceDrawing({ name, className = '' }: { name: ServiceDrawingName; className?: string }) {
  return (
    <div className={`absolute inset-0 bg-paper text-ink ${className}`} style={graphPaper} data-motion="" aria-hidden="true">
      <svg viewBox="0 0 400 300" className="block h-full w-full font-mono" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {name === 'door-fitting' ? <Door /> : name === 'flooring' ? <Flooring /> : <StudWall />}
      </svg>
    </div>
  );
}
