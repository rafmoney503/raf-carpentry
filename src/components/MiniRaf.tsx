import { miniRafVariant, type MiniRafAct } from '@/lib/mini-raf';
import './mini-raf.css';

/* Mini Raf beside the logo: he comes in (walking, running or dancing), kicks a log, sawdust puffs and a piece of
   fitted furniture pops up with its size, its doors or drawers open and shut, then it all fades and the name comes
   back. On a computer the Navbar plays one round on each page in the name's place and takes it away after
   (src/lib/mini-raf.ts has the rounds, the moves are in mini-raf.css). On phones and tablets the pieces and a jointed
   Raf (the jointed Raf is drawn there) are drawn by the show beside the name instead (src/components/MiniRafStage.tsx). A picture only: the
   link keeps 'Raf Carpentry' for screen readers. Drawn in a 240 x 80 box; the parts that move turn about their
   group's 0 0. */

const INK = '#16191c';
const BLUE = '#2547d0';
const MOUNT = '#fbfbf9';
const INSIDE = '#e6e7e2';

function Dim({ y, w, mm }: { y: number; w: number; mm: string }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <g className="mraf-dim">
        <line x1={-w} y1="0" x2={w} y2="0" stroke={BLUE} strokeWidth="1" />
        <line x1={-w} y1="-2.5" x2={-w} y2="2.5" stroke={BLUE} strokeWidth="1" />
        <line x1={w} y1="-2.5" x2={w} y2="2.5" stroke={BLUE} strokeWidth="1" />
        <text x="0" y="-2.5" textAnchor="middle" fontSize="9" fontWeight="600" fill={BLUE} style={{ fontFamily: 'var(--font-mono)' }}>
          {mm}
        </text>
      </g>
    </g>
  );
}

function Spark({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="mraf-spark" d="M0 -5L1.3 -1.3L5 0L1.3 1.3L0 5L-1.3 1.3L-5 0L-1.3 -1.3Z" fill={BLUE} />
    </g>
  );
}

/* A door hinged on its left (side 1) or right (side -1) edge, `w` wide, from `top` down to `bottom`. */
function Door({ x, side, w, top, bottom, c, pull }: { x: number; side: 1 | -1; w: number; top: number; bottom: number; c: string; pull: [number, number] }) {
  const px = side === 1 ? w - 2.4 : -(w - 2.4);
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="mraf-door">
        <rect x={side === 1 ? 0 : -w} y={top} width={w} height={bottom - top} fill={c} stroke={INK} strokeWidth="1.1" />
        <line x1={px} y1={pull[0]} x2={px} y2={pull[1]} stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Cupboard({ c, mm }: { c: string; mm: string }) {
  return (
    <>
      <rect x="-17" y="-36" width="34" height="33" fill={MOUNT} stroke={INK} strokeWidth="1.3" />
      <rect x="-15.5" y="-34.5" width="31" height="30" fill={INSIDE} />
      <line x1="-15.5" y1="-24.5" x2="15.5" y2="-24.5" stroke="#9aa09a" strokeWidth="1" />
      <line x1="-15.5" y1="-14.5" x2="15.5" y2="-14.5" stroke="#9aa09a" strokeWidth="1" />
      <rect x="-12" y="-32" width="2.5" height="7.5" fill={BLUE} />
      <rect x="-9" y="-31" width="2.5" height="6.5" fill="#b9824e" />
      <rect x="5" y="-22" width="5" height="7.5" rx="1.2" fill="#e7c08a" />
      <Door x={-16.5} side={1} w={16} top={-35} bottom={-3.5} c={c} pull={[-22, -16]} />
      <Door x={16.5} side={-1} w={16} top={-35} bottom={-3.5} c={c} pull={[-22, -16]} />
      <rect x="-15" y="-3" width="30" height="3" fill={INK} />
      <Dim y={-42} w={17} mm={mm} />
      <Spark x={20} y={-38} />
    </>
  );
}

function Drawer({ y, cls, c }: { y: number; cls: string; c: string }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <g className={cls}>
        <rect x="-16.5" y="-4.5" width="33" height="9" fill={c} stroke={INK} strokeWidth="1.1" />
        <circle cx="0" cy="0" r="1.4" fill={INK} />
      </g>
    </g>
  );
}

function Chest({ c, mm }: { c: string; mm: string }) {
  return (
    <>
      <rect x="-18" y="-34" width="36" height="31" fill={MOUNT} stroke={INK} strokeWidth="1.3" />
      <Drawer y={-28.5} cls="mraf-dr1" c={c} />
      <Drawer y={-18.5} cls="mraf-dr2" c={c} />
      <Drawer y={-8.5} cls="mraf-dr3" c={c} />
      <rect x="-16" y="-3" width="32" height="3" fill={INK} />
      <Dim y={-40} w={18} mm={mm} />
      <Spark x={21} y={-36} />
    </>
  );
}

function Wardrobe({ c, mm }: { c: string; mm: string }) {
  return (
    <>
      <rect x="-18" y="-55" width="36" height="52" fill={MOUNT} stroke={INK} strokeWidth="1.3" />
      <rect x="-16.5" y="-53.5" width="33" height="49" fill={INSIDE} />
      <line x1="-16.5" y1="-49" x2="16.5" y2="-49" stroke="#9aa09a" strokeWidth="1.4" />
      <path d="M-11.5 -49 V-47 M-4 -49 V-47 M3.5 -49 V-47 M11 -49 V-47" stroke="#4f555b" strokeWidth="0.8" />
      <path d="M-14.5 -47 H-8.5 L-8 -33 H-15 Z" fill={BLUE} />
      <path d="M-7 -47 H-1 L-0.5 -36 H-7.5 Z" fill="#b9824e" />
      <path d="M0.5 -47 H6.5 L7.5 -27 H-0.5 Z" fill="#f2c230" />
      <path d="M8 -47 H14 L14.5 -35 H7.5 Z" fill="#7d8f76" />
      <rect x="-12" y="-7.5" width="5" height="2.5" rx="1" fill={INK} />
      <rect x="-6" y="-7.5" width="5" height="2.5" rx="1" fill={INK} />
      <Door x={-17.5} side={1} w={17} top={-54} bottom={-3.5} c={c} pull={[-33, -25]} />
      <Door x={17.5} side={-1} w={17} top={-54} bottom={-3.5} c={c} pull={[-33, -25]} />
      <rect x="-16" y="-3" width="32" height="3" fill={INK} />
      <Dim y={-61} w={18} mm={mm} />
      <Spark x={22} y={-57} />
    </>
  );
}

function Bookcase({ c, mm }: { c: string; mm: string }) {
  return (
    <>
      <rect x="-17" y="-51" width="34" height="48" fill={MOUNT} stroke={INK} strokeWidth="1.3" />
      <rect x="-15.5" y="-49.5" width="31" height="45" fill={c} opacity="0.35" />
      <rect x="-15.5" y="-40" width="31" height="1.6" fill={INK} />
      <rect x="-15.5" y="-28" width="31" height="1.6" fill={INK} />
      <rect x="-15.5" y="-16" width="31" height="1.6" fill={INK} />
      <g transform="translate(0 -40)">
        <g className="mraf-bk1">
          <rect x="-13" y="-8" width="2.6" height="8" fill={BLUE} />
          <rect x="-10" y="-7" width="2.6" height="7" fill="#b9824e" />
          <rect x="-7" y="-8.5" width="2.2" height="8.5" fill="#7d8f76" />
          <rect x="5" y="-5" width="7" height="5" rx="1" fill="#e7c08a" />
        </g>
      </g>
      <g transform="translate(0 -28)">
        <g className="mraf-bk2">
          <rect x="1" y="-9" width="2.6" height="9" fill="#f2c230" />
          <rect x="4" y="-8" width="2.6" height="8" fill={INK} />
          <rect x="7" y="-9.5" width="2.6" height="9.5" fill={BLUE} />
          <rect x="10" y="-7.5" width="2.6" height="7.5" fill="#b9824e" />
        </g>
      </g>
      <g transform="translate(0 -16)">
        <g className="mraf-bk3">
          <rect x="-12" y="-4" width="5" height="4" fill="#b9824e" />
          <circle cx="-9.5" cy="-6.5" r="3" fill="#7d8f76" />
          <rect x="3" y="-8" width="2.6" height="8" fill="#7d8f76" />
          <rect x="6" y="-9" width="2.6" height="9" fill={BLUE} />
          <rect x="9" y="-8" width="2.6" height="8" fill="#e7c08a" />
        </g>
      </g>
      <g transform="translate(0 -4.5)">
        <g className="mraf-bk4">
          <rect x="-12" y="-7" width="10" height="7" fill="#c9a47a" stroke={INK} strokeWidth="0.6" />
          <rect x="4" y="-8" width="2.6" height="8" fill="#b9824e" />
          <rect x="7" y="-9" width="2.6" height="9" fill="#f2c230" />
        </g>
      </g>
      <rect x="-15" y="-3" width="30" height="3" fill={INK} />
      <Dim y={-57} w={17} mm={mm} />
      <Spark x={20} y={-53} />
    </>
  );
}

function Bedside({ c, mm }: { c: string; mm: string }) {
  return (
    <>
      <g transform="translate(4 -36)">
        <circle className="mraf-glow" cx="0" cy="0" r="11" fill="#f2c230" />
      </g>
      <rect x="-12" y="-25" width="24" height="22" fill={MOUNT} stroke={INK} strokeWidth="1.3" />
      <rect x="-10.5" y="-23.5" width="21" height="7" fill={c} stroke={INK} strokeWidth="1" />
      <circle cx="0" cy="-20" r="1.2" fill={INK} />
      <rect x="-10.5" y="-15" width="21" height="10.5" fill={c} stroke={INK} strokeWidth="1" />
      <circle cx="7" cy="-9.75" r="1.2" fill={INK} />
      <rect x="-11" y="-3" width="22" height="3" fill={INK} />
      <rect x="-9" y="-27" width="8" height="2" fill={BLUE} />
      <ellipse cx="4" cy="-25.8" rx="3.2" ry="1" fill={INK} />
      <line x1="4" y1="-26" x2="4" y2="-34" stroke={INK} strokeWidth="1.2" />
      <path d="M-0.5 -34 L8.5 -34 L6.8 -41 L1.2 -41 Z" fill="#f2c230" stroke={INK} strokeWidth="1" />
      <Dim y={-47} w={12} mm={mm} />
      <Spark x={16} y={-42} />
    </>
  );
}

function TvUnit({ c, mm }: { c: string; mm: string }) {
  return (
    <>
      <rect x="-26" y="-21" width="52" height="18" fill={MOUNT} stroke={INK} strokeWidth="1.3" />
      <rect x="-24.8" y="-19.8" width="16" height="15.6" fill={c} stroke={INK} strokeWidth="1" />
      <rect x="-8" y="-19.8" width="16" height="15.6" fill={c} stroke={INK} strokeWidth="1" />
      <rect x="8.8" y="-19.8" width="16" height="15.6" fill={c} stroke={INK} strokeWidth="1" />
      <circle cx="-11.3" cy="-12" r="1.2" fill={INK} />
      <circle cx="5" cy="-12" r="1.2" fill={INK} />
      <circle cx="11.8" cy="-12" r="1.2" fill={INK} />
      <rect x="-24" y="-3" width="48" height="3" fill={INK} />
      <g transform="translate(0 -21)">
        <g className="mraf-tv">
          <rect x="-4" y="-3" width="8" height="3" fill={INK} />
          <rect x="-17" y="-24" width="34" height="21" rx="1.5" fill={INK} />
          <rect className="mraf-screen" x="-15.5" y="-22.5" width="31" height="18" fill="#2a2f35" />
        </g>
      </g>
      <Dim y={-50} w={26} mm={mm} />
      <Spark x={28} y={-28} />
    </>
  );
}

/* A media wall, 2400 wide: the TV in the middle over an electric fire, open shelves each side with their books and a
   strip light, cupboards along the bottom (the show's last piece, every other show). */
function MediaWall({ c, mm }: { c: string; mm: string }) {
  return (
    <>
      <rect x="-36" y="-58" width="72" height="55" fill={MOUNT} stroke={INK} strokeWidth="1.3" />
      <rect x="-34.5" y="-56.5" width="16" height="40" fill={c} opacity="0.35" />
      <rect x="18.5" y="-56.5" width="16" height="40" fill={c} opacity="0.35" />
      <rect x="-34.5" y="-56.5" width="16" height="1.6" fill="#f2c230" />
      <rect x="18.5" y="-56.5" width="16" height="1.6" fill="#f2c230" />
      <rect x="-34.5" y="-43" width="16" height="1.5" fill={INK} />
      <rect x="-34.5" y="-30" width="16" height="1.5" fill={INK} />
      <rect x="18.5" y="-43" width="16" height="1.5" fill={INK} />
      <rect x="18.5" y="-30" width="16" height="1.5" fill={INK} />
      <g transform="translate(-26.5 -43)">
        <g className="mraf-bk1">
          <rect x="-6" y="-8" width="2.4" height="8" fill={BLUE} />
          <rect x="-3.2" y="-7" width="2.4" height="7" fill="#b9824e" />
          <rect x="2" y="-5" width="5" height="5" rx="1" fill="#e7c08a" />
        </g>
      </g>
      <g transform="translate(26.5 -43)">
        <g className="mraf-bk2">
          <circle cx="-3" cy="-3.5" r="3.3" fill="#7d8f76" />
          <rect x="1" y="-9" width="2.4" height="9" fill="#f2c230" />
          <rect x="3.8" y="-8" width="2.4" height="8" fill={INK} />
        </g>
      </g>
      <g transform="translate(-26.5 -30)">
        <g className="mraf-bk3">
          <rect x="-6" y="-4" width="6" height="4" fill="#b9824e" />
          <rect x="1.5" y="-8.5" width="2.4" height="8.5" fill="#7d8f76" />
          <rect x="4.3" y="-7.5" width="2.4" height="7.5" fill={BLUE} />
        </g>
      </g>
      <g transform="translate(26.5 -30)">
        <g className="mraf-bk4">
          <rect x="-6" y="-7" width="8" height="7" fill="#c9a47a" stroke={INK} strokeWidth="0.6" />
          <rect x="3" y="-8" width="2.4" height="8" fill="#b9824e" />
        </g>
      </g>
      <rect x="-17" y="-56.5" width="34" height="40" fill={c} />
      <g transform="translate(0 -21.5)">
        <ellipse className="mraf-glow" cx="0" cy="0" rx="15" ry="6" fill="#f2c230" />
      </g>
      <g transform="translate(0 -29)">
        <g className="mraf-tv">
          <rect x="-14" y="-20" width="28" height="17" rx="1.2" fill={INK} />
          <rect className="mraf-screen" x="-12.8" y="-18.8" width="25.6" height="14.6" fill="#2a2f35" />
        </g>
      </g>
      <rect x="-14" y="-24.5" width="28" height="6" fill={INK} />
      <g transform="translate(0 -19)">
        <g className="mraf-bk4">
          <path d="M-10 0 Q-8 -4.5 -6.5 -1.5 Q-5 -5.5 -3 -1 Q-1 -4.8 0.8 -1.2 Q3 -5.5 4.6 -1.2 Q6.5 -4.4 8 -1.5 Q9 -3.4 10 0 Z" fill="#e8742c" />
        </g>
      </g>
      <rect x="-34.5" y="-16" width="69" height="12.5" fill={INSIDE} />
      <Door x={-34.5} side={1} w={17} top={-16} bottom={-3.5} c={c} pull={[-12, -7.5]} />
      <Door x={-0.5} side={-1} w={17} top={-16} bottom={-3.5} c={c} pull={[-12, -7.5]} />
      <Door x={0.5} side={1} w={17} top={-16} bottom={-3.5} c={c} pull={[-12, -7.5]} />
      <Door x={34.5} side={-1} w={17} top={-16} bottom={-3.5} c={c} pull={[-12, -7.5]} />
      <rect x="-34" y="-3" width="68" height="3" fill={INK} />
      <Dim y={-64} w={36} mm={mm} />
      <Spark x={40} y={-58} />
      <Spark x={-40} y={-50} />
    </>
  );
}

/* Every piece, by name (the show beside the name uses them too: src/components/MiniRafStage.tsx). */
export const PIECES = { cupboard: Cupboard, chest: Chest, wardrobe: Wardrobe, bookcase: Bookcase, bedside: Bedside, tv: TvUnit, media: MediaWall };

/* The log he kicks, 36 x 13 about its middle. */
export function LogShape() {
  return (
    <>
      <rect x="-18" y="-6.5" width="36" height="13" rx="6.5" fill="#b9824e" stroke={INK} strokeWidth="1.3" />
      <path d="M-8 -2.5 H6 M-3 2.5 H12" stroke="#8a5a2b" strokeWidth="1" strokeLinecap="round" fill="none" />
      <ellipse cx="-17" cy="0" rx="4.2" ry="6.5" fill="#e7c08a" stroke={INK} strokeWidth="1.3" />
      <ellipse cx="-17" cy="0" rx="2.1" ry="3.4" fill="none" stroke="#b9824e" strokeWidth="0.9" />
    </>
  );
}

function Log() {
  return (
    <g transform="translate(114 67.5)">
      <g className="mraf-log">
        <LogShape />
      </g>
    </g>
  );
}

function Leg({ x, cls }: { x: number; cls: string }) {
  return (
    <g transform={`translate(${x} -20)`}>
      <g className={cls}>
        <rect x="-2.2" y="0" width="4.4" height="17.5" rx="2" fill="#2a2f35" />
        <rect x="-2.4" y="15.8" width="7" height="3.4" rx="1.5" fill={INK} />
      </g>
    </g>
  );
}

/* Raf in his blue top, cap and tool belt (a yellow tape on it, a pencil behind his ear). */
function Raf({ act }: { act: MiniRafAct }) {
  return (
    <g className={`mraf-walk-${act}`}>
      <g transform="translate(0 74)">
        <ellipse cx="1" cy="0.6" rx="9" ry="1.6" fill={INK} opacity="0.12" />
        <g className={`mraf-lean-${act}`}>
          <g className={`mraf-jump-${act}`}>
            <g className={`mraf-bob-${act}`}>
              <Leg x={-1.5} cls={`mraf-leg-a-${act}`} />
              <g transform="translate(-1 -35)">
                <g className={`mraf-arm-a-${act}`}>
                  <rect x="-1.8" y="0" width="3.6" height="13" rx="1.8" fill="#1b38ad" />
                  <circle cx="0" cy="13.4" r="2" fill="#f0c6a0" />
                </g>
              </g>
              <Leg x={1.5} cls={`mraf-leg-b-${act}`} />
              <rect x="-7" y="-38" width="14" height="20" rx="4" fill={BLUE} stroke={INK} strokeWidth="1.2" />
              <rect x="-7" y="-23.5" width="14" height="3" fill="#8a5a2b" />
              <rect x="-5.5" y="-23.2" width="3.5" height="3.5" rx="0.8" fill="#f2c230" stroke={INK} strokeWidth="0.6" />
              <path d="M-5.5 -43.5 L-1.5 -50.5" stroke="#f2c230" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="0.5" cy="-45" r="7" fill="#f0c6a0" stroke={INK} strokeWidth="1.2" />
              <circle cx="3.6" cy="-45.6" r="0.9" fill={INK} />
              <path d="M2.4 -42.2 Q4 -40.9 5.6 -42.6" stroke={INK} strokeWidth="0.8" fill="none" strokeLinecap="round" />
              <path d="M-6.6 -46.5 A7.2 7.2 0 0 1 7.6 -46.5 Z" fill={INK} />
              <rect x="4" y="-47.6" width="7" height="2" rx="1" fill={INK} />
              <g transform="translate(1 -35)">
                <g className={`mraf-arm-b-${act}`}>
                  <rect x="-1.8" y="0" width="3.6" height="13" rx="1.8" fill={BLUE} stroke={INK} strokeWidth="0.9" />
                  <circle cx="0" cy="13.4" r="2" fill="#f0c6a0" stroke={INK} strokeWidth="0.6" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

/* A musical note, for the dance. */
export function NoteShape() {
  return (
    <>
      <ellipse cx="0" cy="0" rx="2.4" ry="1.8" transform="rotate(-20)" fill={BLUE} />
      <path d="M2 -0.6 V-9 Q5 -7.5 6 -5" stroke={BLUE} strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </>
  );
}

export const PUFFS: [string, number, string][] = [
  ['mraf-p1', 3, '#e7c08a'],
  ['mraf-p2', 2.5, '#d9dbd5'],
  ['mraf-p3', 3, '#e7c08a'],
  ['mraf-p4', 2.5, '#d9dbd5'],
  ['mraf-p5', 3, '#e7c08a'],
  ['mraf-p6', 2.5, '#d9dbd5'],
];

export default function MiniRaf({ round, className = '' }: { round: number; className?: string }) {
  const v = miniRafVariant(round);
  const Unit = PIECES[v.unit];
  return (
    <svg viewBox="0 0 240 80" className={`mraf ${className}`} aria-hidden="true" focusable="false" data-mini-raf={v.unit} data-mini-raf-act={v.act}>
      <g className="mraf-scene">
        <g transform="translate(174 74)">
          <g className="mraf-pop">
            <Unit c={v.colour} mm={v.mm} />
          </g>
        </g>
        <line x1="4" y1="74.5" x2="236" y2="74.5" stroke="#c7cac3" strokeWidth="0.8" strokeLinecap="round" />
        <Log />
        <Raf act={v.act} />
        <g transform="translate(174 46)">
          {PUFFS.map(([cls, r, fill]) => (
            <circle key={cls} className={cls} r={r} fill={fill} opacity="0" />
          ))}
        </g>
      </g>
    </svg>
  );
}
