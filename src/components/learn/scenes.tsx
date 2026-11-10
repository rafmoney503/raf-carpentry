'use client';

import { useId } from 'react';

/* The moving drawings for the Learn guides (src/lib/learn.ts), one scene per step in the same order. Each scene acts
   out its step on a 7 s loop, in two or three beats, each with its own line of words along the top: parts come in,
   a tool does its job, the result stays, then it starts again. Pencil ink on graph paper, the materials in their own
   quiet colours (brick, timber, plywood, steel: learn.css), and the site's blue for whatever the step is about.

   Timing is in the class names (% of the loop: see scripts/learn/css.mjs, which writes learn.css from the classes
   used here, so run it after changing a scene and write every class out in full). With reduced motion, or paused off
   screen, each scene is its finished state, so it still makes sense standing still. 360 x 220. */

type Scene = (p: { u: (name: string) => string; k: (name: string) => string }) => React.JSX.Element;
type Css = React.CSSProperties;

const cv = (o: Record<string, string | number>) => o as Css;
const move = (dx: number, dy = 0) => cv({ '--dx': `${dx}px`, '--dy': `${dy}px` });
const turnAt = (x: number, y: number, r?: number) => cv({ transformOrigin: `${x}px ${y}px`, ...(r === undefined ? {} : { '--r': `${r}deg` }) });
const r1 = (v: number) => Math.round(v * 10) / 10;

const BLUE = 'var(--color-accent)';
const PAPER = 'var(--color-paper)';
const MOUNT = 'var(--color-mount)';

function T({ x, y, children, anchor = 'middle', size = 9.5, weight = 500, faint = false }: { x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number; weight?: number; faint?: boolean }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} stroke="none" fill="currentColor" fillOpacity={faint ? 0.62 : 1}>
      {children}
    </text>
  );
}

/* the beat's line of words, top left */
function Cap({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <g className={cls}>
      <T x={14} y={19} anchor="start" size={10.5} weight={650}>
        {children}
      </T>
    </g>
  );
}

/* a wall seen from the front, with its skirting and the floor */
function Wall({ x = 14, w = 332, top = 30 }: { x?: number; w?: number; top?: number }) {
  return (
    <>
      <rect x={x} y={top} width={w} height={182 - top} fill="var(--lg-plaster)" strokeWidth="1.4" />
      <rect x={x} y={182} width={w} height={12} fill={MOUNT} strokeWidth="1.2" />
      <path d={`M${x - 8} 194H${x + w + 8}`} />
    </>
  );
}

/* a timber stud behind the plasterboard */
function Stud({ x, top = 30, cls }: { x: number; top?: number; cls?: string }) {
  return (
    <g className={cls}>
      <rect x={x - 7} y={top} width={14} height={182 - top} fill="var(--lg-timber)" fillOpacity="0.6" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.65" />
    </g>
  );
}

/* a spirit level, its bubble in the middle */
function Level({ x, y, w, bubbleCls, bubbleStyle }: { x: number; y: number; w: number; bubbleCls?: string; bubbleStyle?: Css }) {
  const cx = x + w / 2;
  const cy = y + 6.5;
  return (
    <>
      <rect x={x} y={y} width={w} height={13} rx="2" fill={MOUNT} />
      <rect x={x} y={y} width={9} height={13} rx="2" fill={BLUE} strokeWidth="1.2" />
      <rect x={x + w - 9} y={y} width={9} height={13} rx="2" fill={BLUE} strokeWidth="1.2" />
      <rect x={cx - 15} y={cy - 3.6} width={30} height={7.2} rx="3.6" fill="var(--lg-glass)" strokeWidth="1.1" />
      <path d={`M${cx - 5} ${cy - 3.6}v7.2M${cx + 5} ${cy - 3.6}v7.2`} strokeWidth="0.9" />
      <g className={bubbleCls} style={bubbleStyle}>
        <ellipse cx={cx} cy={cy} rx="3.6" ry="2.3" fill={MOUNT} stroke={BLUE} strokeWidth="1.3" />
      </g>
    </>
  );
}

/* done: a blue disc with a tick */
function Tick({ x, y, cls }: { x: number; y: number; cls?: string }) {
  return (
    <g className={cls}>
      <circle cx={x} cy={y} r="8" fill={BLUE} stroke="none" />
      <path d={`M${x - 3.8} ${y + 0.4}l2.7 2.8 5-6.2`} stroke="var(--color-on-accent)" strokeWidth="1.9" />
    </g>
  );
}

/* a screw head seen from the front */
function Head({ x, y, cls }: { x: number; y: number; cls?: string }) {
  return (
    <g className={cls}>
      <circle cx={x} cy={y} r="3.8" fill="var(--lg-steel)" strokeWidth="1.2" />
      <path d={`M${x - 2.1} ${y}h4.2M${x} ${y - 2.1}v4.2`} strokeWidth="0.9" />
    </g>
  );
}

/* a screw seen from the side, its head at x, pointing right */
function Screw({ x, y, len, flat = false }: { x: number; y: number; len: number; flat?: boolean }) {
  const end = x + len;
  const threads: string[] = [];
  for (let t = x + 11; t < end - 6; t += 4.5) threads.push(`M${r1(t)} ${y - 2.4}l1.8 4.8`);
  return (
    <>
      <path d={flat ? `M${x + 4} ${y - 2.4}H${end}V${y + 2.4}H${x + 4}Z` : `M${x + 4} ${y - 2.4}H${end - 6}L${end} ${y}L${end - 6} ${y + 2.4}H${x + 4}Z`} fill="var(--lg-steel)" strokeWidth="1.1" />
      <path d={threads.join('')} strokeWidth="0.8" />
      <rect x={x} y={y - 6} width={4.5} height={12} rx="1.6" fill="var(--lg-steel)" strokeWidth="1.2" />
    </>
  );
}

function Arrow({ x1, y1, x2, y2, both = false, w = 2 }: { x1: number; y1: number; x2: number; y2: number; both?: boolean; w?: number }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = (x: number, y: number, t: number) => `M${r1(x - 6 * Math.cos(t - 0.55))} ${r1(y - 6 * Math.sin(t - 0.55))}L${x} ${y}L${r1(x - 6 * Math.cos(t + 0.55))} ${r1(y - 6 * Math.sin(t + 0.55))}`;
  return <path d={`M${x1} ${y1}L${x2} ${y2}${head(x2, y2, a)}${both ? head(x1, y1, a + Math.PI) : ''}`} strokeWidth={w} />;
}

/* a size, between two ticks */
function HDim({ x1, x2, y, label, below = false }: { x1: number; x2: number; y: number; label: string; below?: boolean }) {
  return (
    <>
      <path d={`M${x1} ${y}H${x2}M${x1} ${y - 4}v8M${x2} ${y - 4}v8`} strokeWidth="1.1" />
      <T x={(x1 + x2) / 2} y={below ? y + 12 : y - 5} size={9}>
        {label}
      </T>
    </>
  );
}
function VDim({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return <path d={`M${x} ${y1}V${y2}M${x - 4} ${y1}h8M${x - 4} ${y2}h8`} strokeWidth="1.3" />;
}

/* a wall cupboard seen from the front */
function Cupboard({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const m = x + w / 2;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill="var(--lg-ply)" />
      <path d={`M${m} ${y}V${y + h}`} strokeWidth="1.2" />
      <rect x={x + 8} y={y + 8} width={w / 2 - 14} height={h - 16} strokeWidth="0.9" strokeOpacity="0.5" />
      <rect x={m + 6} y={y + 8} width={w / 2 - 14} height={h - 16} strokeWidth="0.9" strokeOpacity="0.5" />
      <circle cx={m - 6} cy={y + h / 2 + 8} r="2" fill="var(--lg-steel)" strokeWidth="1" />
      <circle cx={m + 6} cy={y + h / 2 + 8} r="2" fill="var(--lg-steel)" strokeWidth="1" />
    </>
  );
}

/* ---------------- How to hang something heavy on any wall ---------------- */

/* knuckles on the wall, the arm coming up from below */
function Fist({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-4 8L10 52H30L12 2Z" fill={PAPER} strokeWidth="1.4" />
      <rect x="-13" y="-11" width="27" height="22" rx="7" fill={PAPER} />
      <path d="M-5.5 -10v9M1 -10v9M7.5 -10v9" strokeWidth="1.1" />
      <path d="M-12 2.5c4 0 7 2 8 6" strokeWidth="1.1" />
    </g>
  );
}

const Knock: Scene = ({ u, k }) => (
  <>
    <defs>
      <clipPath id={k('wa')}>
        <circle cx="94" cy="110" r="38" />
      </clipPath>
      <clipPath id={k('wb')}>
        <circle cx="266" cy="110" r="38" />
      </clipPath>
    </defs>
    <Cap cls="mv-lg-win-0-40">Knock where it’s going, and listen</Cap>
    <Cap cls="mv-lg-show-44">A dull knock: brick, block or a stud</Cap>
    <Wall x={14} w={160} top={44} />
    <Wall x={186} w={160} top={44} />

    {/* hollow: the wall opens on the studs and the gap behind the board */}
    <g className="mv-lg-pop-30">
      <g clipPath={u('wa')}>
        <rect x="50" y="66" width="90" height="90" fill="var(--lg-cavity)" stroke="none" />
        {[62, 110].map((sx) => (
          <g key={sx}>
            <rect x={sx} y="66" width="15" height="90" fill="var(--lg-timber)" strokeWidth="1.2" />
            <path d={`M${sx + 4.5} 68c2 20-2 40 0 60s2 20 0 26M${sx + 10} 68c-2 24 2 44 0 64s1 16 0 22`} stroke="var(--lg-grain)" strokeWidth="0.8" />
          </g>
        ))}
      </g>
      <circle cx="94" cy="110" r="38" strokeWidth="1.5" />
    </g>
    <g className="text-accent">
      <circle className="mv-lg-ping-7" cx="94" cy="110" r="20" strokeWidth="1.8" />
      <circle className="mv-lg-ping-11" cx="94" cy="110" r="32" strokeWidth="1.8" />
      <g className="mv-lg-pop-14">
        <T x={94} y={61} size={11} weight={700}>
          HOLLOW
        </T>
      </g>
    </g>
    <g className="mv-lg-show-34">
      <T x={94} y={172} size={9}>
        plasterboard on studs
      </T>
    </g>
    <g className="mv-lg-off-26">
      <g className="mv-lg-go-22-30" style={move(-46, -40)}>
        <g className="mv-lg-tap-6">
          <Fist x={140} y={150} />
        </g>
      </g>
    </g>

    {/* solid: brick or block all the way through */}
    <g className="mv-lg-pop-70">
      <g clipPath={u('wb')}>
        <rect x="222" y="66" width="90" height="90" fill={u('brick')} stroke="none" />
      </g>
      <circle cx="266" cy="110" r="38" strokeWidth="1.5" />
    </g>
    <g className="text-accent">
      <circle className="mv-lg-ping-49" cx="266" cy="110" r="9" strokeWidth="1.8" />
      <circle className="mv-lg-ping-53" cx="266" cy="110" r="13" strokeWidth="1.8" />
      <g className="mv-lg-pop-56">
        <T x={266} y={61} size={11} weight={700}>
          DULL, SOLID
        </T>
      </g>
    </g>
    <g className="mv-lg-show-74">
      <T x={266} y={172} size={9}>
        brick or block
      </T>
    </g>
    <g className="mv-lg-win-42-66">
      <g className="mv-lg-go-62-70" style={move(-46, -40)}>
        <g className="mv-lg-tap-48">
          <Fist x={312} y={150} />
        </g>
      </g>
    </g>
  </>
);

const FindStuds: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-54">Slide a detector along. Mark each stud</Cap>
    <Cap cls="mv-lg-show-58">Cables run in the blue zones: never drill there</Cap>
    <Wall />
    <Stud x={110} cls="mv-lg-show-17" />
    <Stud x={200} cls="mv-lg-show-32" />
    <Stud x={290} cls="mv-lg-show-46" />

    {/* where cables are allowed to run: up, down and sideways from the socket, by the ceiling, in the corners */}
    <g className="mv-lg-show-60 text-accent">
      {[
        [41, 30, 22, 152],
        [14, 143, 332, 14],
        [14, 30, 332, 13],
        [14, 30, 13, 152],
        [333, 30, 13, 152],
      ].map(([x, y, w, h]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={w} height={h} fill={BLUE} fillOpacity="0.09" stroke="none" />
          <rect x={x} y={y} width={w} height={h} fill={u('zone')} stroke="none" />
        </g>
      ))}
    </g>
    <g className="text-accent">
      <path className="mv-lg-line mv-lg-draw-64-74" pathLength={1} d="M52 143V36H333" strokeWidth="1.3" />
      <path className="mv-lg-line mv-lg-draw-68-78" pathLength={1} d="M63 150H340" strokeWidth="1.3" />
      <g className="mv-lg-pop-76">
        <rect x="120" y="120" width="70" height="14" fill="var(--lg-plaster)" stroke="none" />
        <T x={155} y={130.5} size={9} weight={650}>
          cables here
        </T>
      </g>
      <g className="mv-lg-show-76">
        <T x={278} y={54} anchor="end" size={8.5}>
          150 mm
        </T>
      </g>
    </g>
    <rect x="41" y="143" width="22" height="14" rx="2" fill={MOUNT} strokeWidth="1.3" />
    <path d="M47 148v4M57 148v4" strokeWidth="1.3" />

    {/* a pencil mark over each stud, and how far apart they are */}
    <g className="text-accent">
      <path className="mv-lg-pop-17" d="M105 62h10l-5 8z" fill="currentColor" strokeWidth="1" />
      <path className="mv-lg-pop-32" d="M195 62h10l-5 8z" fill="currentColor" strokeWidth="1" />
      <path className="mv-lg-pop-46" d="M285 62h10l-5 8z" fill="currentColor" strokeWidth="1" />
    </g>
    <g className="mv-lg-show-50">
      <HDim x1={110} x2={200} y={86} label="400 or 600 mm" />
    </g>

    {/* the detector, its light on over each stud */}
    <g className="mv-lg-slide-5-50" style={move(-278)}>
      <rect x="304" y="86" width="28" height="46" rx="6" fill="var(--lg-tool)" />
      <rect x="309" y="92" width="18" height="12" rx="1.5" fill="var(--lg-glass)" strokeWidth="1" />
      <path d="M312 98h12" stroke={BLUE} strokeWidth="1.2" />
      <circle cx="318" cy="116" r="3.6" fill={PAPER} strokeWidth="1" />
      <path d="M318 132v5" strokeWidth="1.2" />
      <g className="text-accent">
        <circle className="mv-lg-win-16-20" cx="318" cy="116" r="3.6" fill="currentColor" stroke="none" />
        <circle className="mv-lg-win-31-35" cx="318" cy="116" r="3.6" fill="currentColor" stroke="none" />
        <circle className="mv-lg-win-45-49" cx="318" cy="116" r="3.6" fill="currentColor" stroke="none" />
        <circle className="mv-lg-ping-16" cx="318" cy="116" r="13" strokeWidth="1.6" />
        <circle className="mv-lg-ping-31" cx="318" cy="116" r="13" strokeWidth="1.6" />
        <circle className="mv-lg-ping-45" cx="318" cy="116" r="13" strokeWidth="1.6" />
      </g>
    </g>
  </>
);

const MarkLevel: Scene = () => (
  <>
    <Cap cls="mv-lg-win-0-21">Mark where the fixings go</Cap>
    <Cap cls="mv-lg-win-24-42">Lay a spirit level across the marks</Cap>
    <Cap cls="mv-lg-show-45">Move a mark until the bubble sits in the middle</Cap>
    <Wall />
    <rect x="100" y="66" width="160" height="86" strokeWidth="1.1" strokeDasharray="5 4" strokeOpacity="0.45" />
    <T x={180} y={136} size={9} faint>
      where it’s going
    </T>

    {/* the two marks: the right one starts low */}
    <g className="text-accent">
      <path className="mv-lg-pop-6" d="M124 88h12M130 82v12" strokeWidth="2" />
      <g className="mv-lg-go-45-60" style={move(0, 8)}>
        <path className="mv-lg-pop-14" d="M224 88h12M230 82v12" strokeWidth="2" />
      </g>
      <g className="mv-lg-win-41-58">
        <Arrow x1={248} y1={108} x2={248} y2={92} />
      </g>
    </g>
    <g className="mv-lg-off-20">
      <g className="mv-lg-go-9-13" style={move(-100, -8)}>
        <g transform="translate(231 95)">
          <path d="M0 0L8 -3 3 -8Z" fill="var(--color-ink)" strokeWidth="1" />
          <path d="M8 -3L3 -8 27 -32 32 -27Z" fill="var(--lg-plug)" strokeWidth="1.2" />
          <path d="M27 -32L32 -27 36 -31 31 -36Z" fill="var(--lg-steel)" strokeWidth="1.2" />
        </g>
      </g>
    </g>

    {/* the level arrives tilted with the marks, then comes level as the mark moves up */}
    <g className="mv-lg-show-24">
      <g className="mv-lg-go-24-34" style={move(0, -44)}>
        <g className="mv-lg-turn-45-60 mv-vb" style={turnAt(130, 91, 4.57)}>
          <Level x={100} y={91} w={160} bubbleCls="mv-lg-go-45-60" bubbleStyle={move(-9)} />
        </g>
      </g>
    </g>
    <Tick x={280} y={97} cls="mv-lg-pop-64" />
  </>
);

function PlugGuide({ cls }: { cls: string }) {
  return (
    <g className={cls}>
      <rect x="168" y="66" width="34" height="9" rx="2.5" fill="var(--lg-plug)" strokeWidth="1.2" />
      <path d="M176 66v9M184 66v9M192 66v9" strokeWidth="0.8" strokeOpacity="0.6" />
      <g className="text-accent">
        <path d="M162 60V98M202 60V98" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M162 56H202M162 53v6M202 53v6" strokeWidth="1.2" />
        <T x={182} y={47} size={9} weight={650}>
          plug + a few mm
        </T>
      </g>
    </g>
  );
}

const Drill: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-19">Tape on the bit: the plug’s length + a few mm</Cap>
    <Cap cls="mv-lg-win-22-60">Drill straight in. Stop when the tape touches</Cap>
    <Cap cls="mv-lg-show-64">Then hoover the dust out of the hole</Cap>

    {/* the wall, cut through */}
    <rect x="250" y="26" width="76" height="188" fill={u('brickcut')} strokeWidth="1.4" />
    <rect x="246" y="26" width="4" height="188" fill="var(--lg-plaster)" strokeWidth="1.1" />
    <g data-hole className="mv-lg-growx-28-55 mv-ol">
      <rect x="246" y="100.3" width="40" height="7.4" fill={PAPER} strokeWidth="1.2" />
    </g>

    <PlugGuide cls="mv-lg-win-2-17" />
    <PlugGuide cls="mv-lg-show-80" />

    {[
      ['mv-lg-puff-30', -13, 9],
      ['mv-lg-puff-35', -9, -10],
      ['mv-lg-puff-40', -15, 3],
      ['mv-lg-puff-45', -8, 11],
      ['mv-lg-puff-50', -12, -7],
    ].map(([c, dx, dy]) => (
      <circle key={c} className={c as string} style={move(dx as number, dy as number)} cx="243" cy="104" r="1.5" fill="currentColor" stroke="none" />
    ))}

    <g className="mv-lg-drill">
      <g className="mv-lg-buzz-28-55">
        <path d="M142 102.2H197L202 104 197 105.8H142Z" fill="var(--lg-steel)" strokeWidth="1.1" />
        <path d="M170 102.2l3 3.6M176 102.2l3 3.6M182 102.2l3 3.6M188 102.2l3 3.6M194 102.2l2.5 3.6" strokeWidth="0.9" />
        <rect x="159" y="99.2" width="6.5" height="9.6" rx="1" fill={BLUE} strokeWidth="1.1" />
        <path d="M128 94L142 99.5V108.5L128 114Z" fill="var(--lg-steel)" />
        <path d="M78 119H101L96 163H71Z" fill="var(--lg-tool)" />
        <rect x="62" y="161" width="44" height="15" rx="3" fill="var(--lg-tool)" />
        <rect x="60" y="88" width="68" height="32" rx="7" fill="var(--lg-tool)" />
        <path d="M70 97h13M70 102h13M70 107h13" stroke={PAPER} strokeWidth="1.2" />
        <rect x="94" y="109" width="26" height="4" rx="1" fill={BLUE} stroke="none" />
        <path d="M101 125q7 3 4.5 11" strokeWidth="1.4" />
      </g>
    </g>

    <g className="text-accent">
      <circle className="mv-lg-ping-55" cx="246" cy="104" r="11" strokeWidth="1.8" />
      <g className="mv-lg-win-56-64">
        <T x={240} y={80} anchor="end" weight={700}>
          tape touches: stop
        </T>
      </g>
    </g>

    <T x={14} y={196} anchor="start" size={9}>
      Brick or block: masonry bit, hammer on
    </T>
    <T x={14} y={208} anchor="start" size={9}>
      A stud: wood bit, hammer off
    </T>
  </>
);

const Fixings: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-37">Brick or block: a plug, then the screw</Cap>
    <Cap cls="mv-lg-win-40-62">A stud: screw straight into the wood</Cap>
    <Cap cls="mv-lg-show-65">No stud: a metal toggle opens behind the board</Cap>

    {/* brick or block */}
    <rect x="60" y="38" width="58" height="122" fill={u('brickcut')} strokeWidth="1.4" />
    <rect x="60" y="96" width="38" height="8" fill={PAPER} strokeWidth="1.1" />
    <g className="mv-lg-go-4-14" style={move(-50)}>
      <rect x="61" y="96" width="35" height="8" rx="2.5" fill="var(--lg-plug)" strokeWidth="1.2" />
      <path d="M70 96v8M78 96v8M86 96v8" strokeWidth="0.8" strokeOpacity="0.6" />
    </g>
    <rect className="mv-lg-show-16" x="53" y="70" width="7" height="60" fill={BLUE} fillOpacity="0.22" stroke={BLUE} strokeWidth="1.3" />
    <g className="mv-lg-show-19">
      <g className="mv-lg-slide-20-34" style={move(-36)}>
        <Screw x={48.5} y={100} len={45} />
      </g>
    </g>
    <path className="mv-lg-pop-35 text-accent" d="M68 92l3.5-4 3.5 4M82 92l3.5-4 3.5 4M68 108l3.5 4 3.5-4M82 108l3.5 4 3.5-4" strokeWidth="1.6" />
    <T x={66} y={174} weight={650}>
      Brick or block
    </T>
    <T x={66} y={185} size={8.5} faint>
      plug, then screw
    </T>

    {/* a timber stud behind the plasterboard */}
    <rect x="181" y="38" width="49" height="122" fill="var(--lg-timber)" strokeWidth="1.4" />
    <path d="M194 40c3 24-3 44 0 66s3 34 0 52M208 40c-3 30 3 50 0 74s-2 30 0 44M220 40c2 20-2 46 0 70s2 30 0 48" stroke="var(--lg-grain)" strokeWidth="0.8" />
    <rect x="172" y="38" width="9" height="122" fill="var(--lg-board)" strokeWidth="1.2" />
    <rect className="mv-lg-show-40" x="165" y="70" width="7" height="60" fill={BLUE} fillOpacity="0.22" stroke={BLUE} strokeWidth="1.3" />
    <g className="mv-lg-show-41">
      <g className="mv-lg-slide-42-58" style={move(-48)}>
        <Screw x={160.5} y={100} len={55} />
      </g>
    </g>
    <g className="mv-lg-show-60 text-accent">
      <path d="M181 114H215M181 110v8M215 110v8" strokeWidth="1.3" />
      <T x={198} y={128} size={9} weight={650}>
        30 mm +
      </T>
    </g>
    <T x={178} y={174} weight={650}>
      Timber stud
    </T>
    <T x={178} y={185} size={8.5} faint>
      into the wood
    </T>

    {/* plasterboard with nothing behind it */}
    <rect x="293" y="38" width="49" height="122" fill="var(--lg-cavity)" fillOpacity="0.45" stroke="none" />
    <rect x="284" y="38" width="9" height="58" fill="var(--lg-board)" strokeWidth="1.2" />
    <rect x="284" y="104" width="9" height="56" fill="var(--lg-board)" strokeWidth="1.2" />
    <T x={320} y={56} size={8.5} faint>
      hollow
    </T>
    <g className="mv-lg-show-64">
      <rect x="277" y="70" width="7" height="26" fill={BLUE} fillOpacity="0.22" stroke={BLUE} strokeWidth="1.3" />
      <rect x="277" y="104" width="7" height="26" fill={BLUE} fillOpacity="0.22" stroke={BLUE} strokeWidth="1.3" />
    </g>
    <g className="mv-lg-toggle">
      <Screw x={272.5} y={100} len={36} flat />
      <g className="mv-lg-rot-78-82 mv-vb" style={turnAt(295, 100, -84)}>
        <rect x="293.4" y="80" width="3.4" height="20" rx="1.7" fill="var(--lg-steel)" strokeWidth="1.1" />
      </g>
      <g className="mv-lg-rot-78-82 mv-vb" style={turnAt(295, 100, 84)}>
        <rect x="293.4" y="100" width="3.4" height="20" rx="1.7" fill="var(--lg-steel)" strokeWidth="1.1" />
      </g>
      <circle cx="295" cy="100" r="2" fill="var(--color-ink)" stroke="none" />
    </g>
    <g className="text-accent">
      <circle className="mv-lg-ping-81" cx="296" cy="100" r="14" strokeWidth="1.7" />
      <g className="mv-lg-win-84-96">
        <Arrow x1={268} y1={144} x2={250} y2={144} />
      </g>
    </g>
    <T x={290} y={174} weight={650}>
      No stud behind
    </T>
    <T x={290} y={185} size={8.5} faint>
      metal spring toggle
    </T>
  </>
);

const HangCheck: Scene = () => (
  <>
    <Cap cls="mv-lg-win-0-25">Hang it on its fixings</Cap>
    <Cap cls="mv-lg-win-28-55">Level on top: check before you let go</Cap>
    <Cap cls="mv-lg-show-58">Then a firm pull down. Nothing should move</Cap>
    <Wall />
    <Head x={130} y={76} />
    <Head x={230} y={76} />
    <g className="text-accent">
      <circle className="mv-lg-ping-1" cx="130" cy="76" r="11" strokeWidth="1.6" />
      <circle className="mv-lg-ping-3" cx="230" cy="76" r="11" strokeWidth="1.6" />
    </g>
    <g className="mv-lg-tug-62">
      <g className="mv-lg-show-9">
        <g className="mv-lg-go-9-23" style={move(0, -27)}>
          <Cupboard x={100} y={62} w={160} h={90} />
        </g>
      </g>
      <g className="mv-lg-show-28">
        <g className="mv-lg-go-28-38" style={move(0, -17)}>
          <Level x={125} y={49} w={110} bubbleCls="mv-lg-go-38-47" bubbleStyle={move(7)} />
        </g>
      </g>
    </g>
    <Tick x={252} y={50} cls="mv-lg-pop-49" />
    <g className="text-accent">
      <g className="mv-lg-win-58-88">
        <Arrow x1={180} y1={156} x2={180} y2={177} w={2.6} />
        <path d="M166 158v9M194 158v9" strokeWidth="1.4" strokeOpacity="0.6" />
      </g>
      <g className="mv-lg-pop-80">
        <T x={304} y={126} weight={700}>
          solid
        </T>
      </g>
    </g>
    <Tick x={304} y={104} cls="mv-lg-pop-78" />
  </>
);

/* ---------------- How to hang a cabinet or mirror with a French cleat ---------------- */

const CleatWorks: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-40">Two halves, cut at 45°, hook together</Cap>
    <Cap cls="mv-lg-show-43">The weight pulls the cabinet tight to the wall</Cap>
    <rect x="250" y="26" width="70" height="188" fill={u('brickcut')} strokeWidth="1.4" />

    {/* the wall half, screwed to the wall */}
    <path d="M220 150H250V120L220 90Z" fill={u('plyv')} />
    <path d="M226 130H282" stroke="var(--color-ink)" strokeWidth="3.2" />
    <path d="M226 130H282" stroke="var(--lg-steel)" strokeWidth="1.6" />

    {/* the cabinet, seen from the side, with its half and a spacer on the back */}
    <g className="mv-lg-go-12-38" style={move(0, -34)}>
      <rect x="96" y="62" width="124" height="128" fill="var(--lg-ply)" />
      <rect x="96" y="70" width="116" height="112" fill={PAPER} strokeWidth="1.1" />
      <rect x="90" y="62" width="6" height="128" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
      <path d="M220 66H250V120L220 90Z" fill={u('plyv')} />
      <rect x="220" y="168" width="30" height="22" fill={u('plyv')} />
      <path d="M208 78H242" stroke="var(--color-ink)" strokeWidth="3.2" />
      <path d="M208 78H242" stroke="var(--lg-steel)" strokeWidth="1.6" />
    </g>

    <g className="text-accent">
      <path className="mv-lg-show-38" d="M220 90L250 120" strokeWidth="3" />
      <circle className="mv-lg-ping-38" cx="235" cy="105" r="13" strokeWidth="1.8" />
      <g className="mv-lg-pop-52">
        <Arrow x1={150} y1={96} x2={150} y2={126} w={2.6} />
        <T x={160} y={115} anchor="start" weight={700}>
          weight
        </T>
      </g>
      <g className="mv-lg-pop-64">
        <Arrow x1={146} y1={166} x2={206} y2={166} w={2.6} />
        <T x={176} y={158} weight={700}>
          pulls it in
        </T>
      </g>
    </g>
    <g className="mv-lg-show-44">
      <path d="M190 84H232" strokeWidth="1" />
      <circle cx="233" cy="84" r="1.8" fill="currentColor" stroke="none" />
      <T x={186} y={87} anchor="end" size={9}>
        cabinet half
      </T>
      <path d="M176 143H232" strokeWidth="1" />
      <circle cx="233" cy="143" r="1.8" fill="currentColor" stroke="none" />
      <T x={172} y={146} anchor="end" size={9}>
        wall half
      </T>
    </g>
  </>
);

const CutStrip: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-43">One strip of 18 mm plywood, cut down its length</Cap>
    <Cap cls="mv-lg-win-46-64">…with the saw tilted to 45°</Cap>
    <Cap cls="mv-lg-show-67">Two halves, each with a sloping edge</Cap>

    {/* the strip, and the cut along it */}
    <path d="M40 50L50 40H310L300 50Z" fill="var(--lg-ply)" />
    <rect x="40" y="50" width="260" height="8" fill={u('plyh')} />
    <path d="M300 50L310 40V48L300 58Z" fill="var(--lg-ply-dark)" />
    <path className="mv-lg-line mv-lg-trace-8-40 text-accent" pathLength={1} d="M46 45H304" strokeWidth="1.8" />
    <g className="mv-lg-off-42">
      <g className="mv-lg-slide-8-40" style={move(-258)}>
        <path d="M296 45a8 8 0 0 1 16 0Z" fill="var(--lg-steel)" strokeWidth="1.2" />
        <rect x="290" y="27" width="28" height="11" rx="3" fill="var(--lg-tool)" strokeWidth="1.2" />
      </g>
    </g>

    {/* the same strip seen from its end */}
    <g className="mv-lg-show-43">
      <T x={72} y={106} anchor="start" size={9} faint>
        seen from the end
      </T>
    </g>
    <g className="mv-lg-win-43-56">
      <rect x="80" y="120" width="200" height="36" fill={u('plyh')} />
    </g>
    <g className="mv-lg-show-56">
      <g className="mv-lg-go-66-78" style={move(8)}>
        <path d="M72 120H190L154 156H72Z" fill={u('plyh')} />
      </g>
      <g className="mv-lg-go-66-78" style={move(-8)}>
        <path d="M206 120H288V156H170Z" fill={u('plyh')} />
      </g>
    </g>
    <g className="mv-lg-win-44-64">
      <VDim x={66} y1={120} y2={156} />
      <T x={58} y={141} anchor="end" size={9}>
        18 mm
      </T>
      <HDim x1={80} x2={280} y={170} label="about 100 mm" below />
    </g>
    <g className="mv-lg-win-45-64">
      <g className="mv-lg-go-46-56" style={move(72, -72)}>
        <path d="M146 172L216 102" stroke="var(--color-ink)" strokeWidth="5" />
        <path d="M146 172L216 102" stroke="var(--lg-steel)" strokeWidth="3" />
        <circle cx="181" cy="137" r="4" fill="var(--lg-tool)" strokeWidth="1" />
      </g>
    </g>
    <g className="text-accent">
      <g className="mv-lg-win-56-66">
        <path d="M224 120A26 26 0 0 0 216.4 101.6" strokeWidth="1.4" />
        <T x={240} y={110} size={11} weight={700}>
          45°
        </T>
      </g>
      <g className="mv-lg-show-80">
        <path d="M190 120L154 156M206 120L170 156" strokeWidth="3" />
      </g>
    </g>
    <g className="mv-lg-pop-84">
      <T x={126} y={174} size={9}>
        one for the wall
      </T>
      <T x={236} y={174} size={9}>
        one for the cabinet
      </T>
    </g>
  </>
);

const OnCabinet: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-50">Glue and screw one half near the top, slope down</Cap>
    <Cap cls="mv-lg-win-53-75">A spacer at the bottom keeps it hanging straight</Cap>
    <Cap cls="mv-lg-show-78">Measure from the top down to the slope</Cap>

    {/* the back of the cabinet */}
    <rect x="60" y="40" width="180" height="150" fill="var(--lg-ply)" />
    <T x={150} y={122} size={9} faint>
      the back of the cabinet
    </T>
    <path className="mv-lg-line mv-lg-draw-4-16 text-accent" pathLength={1} d="M74 62q6-6 12 0t12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0" strokeWidth="1.8" />
    <g className="mv-lg-in-18" style={move(0, -22)}>
      <rect x="68" y="50" width="164" height="24" fill="var(--lg-ply-dark)" />
      <path d="M68 67H232" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.6" />
    </g>
    <Head x={86} y={59} cls="mv-lg-pop-34" />
    <Head x={128} y={59} cls="mv-lg-pop-38" />
    <Head x={172} y={59} cls="mv-lg-pop-42" />
    <Head x={214} y={59} cls="mv-lg-pop-46" />
    <g className="mv-lg-in-54" style={move(0, 22)}>
      <rect x="68" y="164" width="164" height="18" fill="var(--lg-ply-dark)" />
    </g>
    <Head x={100} y={173} cls="mv-lg-pop-68" />
    <Head x={200} y={173} cls="mv-lg-pop-71" />
    <g className="mv-lg-show-78 text-accent">
      <VDim x={48} y1={40} y2={67} />
    </g>

    {/* the same from the side */}
    <T x={306} y={34} size={8.5} faint>
      from the side
    </T>
    <rect x="270" y="40" width="26" height="150" fill="var(--lg-ply)" strokeWidth="1.3" />
    <g className="mv-lg-show-22">
      <path d="M296 50H314V109L296 91Z" fill={u('plyv')} strokeWidth="1.3" />
      <path className="text-accent" d="M296 91L314 109" strokeWidth="2.6" />
    </g>
    <rect className="mv-lg-show-58" x="296" y="164" width="18" height="18" fill={u('plyv')} strokeWidth="1.3" />
    <g className="text-accent">
      <g className="mv-lg-show-78">
        <VDim x={328} y1={40} y2={91} />
        <path d="M314 91H324" strokeWidth="1" strokeDasharray="2.5 2.5" />
      </g>
      <g className="mv-lg-pop-82">
        <T x={322} y={128} size={9} weight={700}>
          measure
        </T>
        <T x={322} y={139} size={9} weight={700}>
          this
        </T>
      </g>
    </g>
  </>
);

const WallHalf: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-28">Mark the cabinet’s top, then your number down</Cap>
    <Cap cls="mv-lg-win-31-59">The wall half on that line, slope up, level</Cap>
    <Cap cls="mv-lg-show-62">A screw into every stud it crosses</Cap>
    <Wall />
    <Stud x={110} />
    <Stud x={200} />
    <Stud x={290} />

    <path className="mv-lg-line mv-lg-draw-4-14" pathLength={1} d="M24 62H336" strokeWidth="1.2" strokeOpacity="0.75" />
    <g className="mv-lg-show-12">
      <T x={155} y={56} size={9}>
        cabinet top
      </T>
    </g>
    <g className="mv-lg-show-18 text-accent">
      <VDim x={30} y1={62} y2={96} />
      <T x={38} y={83} anchor="start" size={9} weight={700}>
        your number
      </T>
    </g>

    <g className="mv-lg-in-31" style={move(46)}>
      <rect x="84" y="96" width="232" height="24" fill="var(--lg-ply-dark)" />
      <path d="M84 103H316" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.6" />
    </g>
    <g className="mv-lg-show-44">
      <g className="mv-lg-go-44-52" style={move(0, -18)}>
        <Level x={150} y={83} w={120} bubbleCls="mv-lg-go-52-59" bubbleStyle={move(-7)} />
      </g>
    </g>
    <Tick x={288} y={86} cls="mv-lg-pop-59" />
    <Head x={110} y={109} cls="mv-lg-pop-63" />
    <Head x={200} y={109} cls="mv-lg-pop-69" />
    <Head x={290} y={109} cls="mv-lg-pop-75" />
    <g className="text-accent">
      <circle className="mv-lg-ping-63" cx="110" cy="109" r="11" strokeWidth="1.6" />
      <circle className="mv-lg-ping-69" cx="200" cy="109" r="11" strokeWidth="1.6" />
      <circle className="mv-lg-ping-75" cx="290" cy="109" r="11" strokeWidth="1.6" />
    </g>

    {/* the wall half from the side: slope at the top, facing the wall */}
    <rect x="210" y="130" width="70" height="46" fill={PAPER} strokeWidth="1" strokeOpacity="0.5" />
    <T x={232} y={150} size={8.5} faint>
      from
    </T>
    <T x={232} y={160} size={8.5} faint>
      the side
    </T>
    <rect x="270" y="134" width="6" height="38" fill={u('brickcut')} strokeWidth="1" />
    <path d="M256 168H270V152L256 138Z" fill={u('plyv')} strokeWidth="1.2" />
    <path className="text-accent" d="M256 138L270 152" strokeWidth="2.4" />
  </>
);

const LiftOn: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-38">Lift it above the wall half, then lower it</Cap>
    <Cap cls="mv-lg-win-41-64">Slide it sideways to line it up</Cap>
    <Cap cls="mv-lg-show-67">Check it’s level. It lifts off the same way</Cap>

    {/* from the side: straight down the wall onto the wall half */}
    <rect x="138" y="28" width="26" height="176" fill={u('brickcut')} strokeWidth="1.4" />
    <path d="M116 142H138V120L116 98Z" fill={u('plyv')} />
    <g className="mv-lg-go-8-30" style={move(0, -38)}>
      <rect x="44" y="72" width="72" height="106" fill="var(--lg-ply)" />
      <rect x="44" y="79" width="65" height="92" fill={PAPER} strokeWidth="1.1" />
      <rect x="39" y="72" width="5" height="106" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
      <path d="M116 76H138V120L116 98Z" fill={u('plyv')} />
      <rect x="116" y="160" width="22" height="18" fill={u('plyv')} />
    </g>
    <g className="text-accent">
      <g className="mv-lg-win-5-30">
        <Arrow x1={24} y1={66} x2={24} y2={112} w={2.6} />
      </g>
      <path className="mv-lg-show-30" d="M116 98L138 120" strokeWidth="2.8" />
      <circle className="mv-lg-ping-30" cx="127" cy="109" r="12" strokeWidth="1.8" />
    </g>
    <path d="M176 30V204" strokeWidth="1" strokeOpacity="0.3" />

    {/* from the front: along the cleat until it lines up */}
    <rect x="188" y="30" width="158" height="152" fill="var(--lg-plaster)" strokeWidth="1.4" />
    <rect x="188" y="182" width="158" height="12" fill={MOUNT} strokeWidth="1.2" />
    <path d="M182 194H352" />
    <g className="mv-lg-show-40 text-accent">
      <path d="M266 36V70" strokeWidth="1.3" strokeDasharray="3 3" />
      <path d="M261 36h10l-5 7z" fill="currentColor" strokeWidth="1" />
    </g>
    <g className="mv-lg-show-34">
      <g className="mv-lg-wig-43-62" style={move(15)}>
        <Cupboard x={222} y={76} w={88} h={76} />
        <g className="mv-lg-show-67">
          <Level x={231} y={63} w={70} bubbleCls="mv-lg-go-67-75" bubbleStyle={move(6)} />
        </g>
      </g>
    </g>
    <g className="mv-lg-win-41-64 text-accent">
      <Arrow x1={238} y1={166} x2={294} y2={166} both w={2.4} />
    </g>
    <Tick x={326} y={70} cls="mv-lg-pop-78" />
  </>
);

/* ---------------- How a fitted wardrobe is built ---------------- */

/* a level stood upright, its left face at x and its foot at y */
function Plumb({ x, y, h, bubbleCls, bubbleStyle }: { x: number; y: number; h: number; bubbleCls?: string; bubbleStyle?: Css }) {
  const cy = y - h / 2;
  return (
    <>
      <rect x={x} y={y - h} width={13} height={h} rx="2" fill={MOUNT} />
      <rect x={x} y={y - h} width={13} height={9} rx="2" fill={BLUE} strokeWidth="1.2" />
      <rect x={x} y={y - 9} width={13} height={9} rx="2" fill={BLUE} strokeWidth="1.2" />
      <rect x={x + 1.6} y={cy - 3.4} width={9.8} height={6.8} rx="3.2" fill="var(--lg-glass)" strokeWidth="1" />
      <g className={bubbleCls} style={bubbleStyle}>
        <ellipse cx={x + 6.5} cy={cy} rx="2" ry="2.2" fill={MOUNT} stroke={BLUE} strokeWidth="1.2" />
      </g>
    </>
  );
}

const FloorLevel: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-30">Lay a long level on the floor</Cap>
    <Cap cls="mv-lg-win-33-60">Lift the low end until the bubble is in the middle</Cap>
    <Cap cls="mv-lg-show-63">That gap is what the base frame has to make up</Cap>

    {/* the side walls, and a floor that falls away to the right */}
    <rect x="14" y="34" width="16" height="148" fill={u('brickcut')} strokeWidth="1.3" />
    <rect x="330" y="34" width="16" height="160" fill={u('brickcut')} strokeWidth="1.3" />
    <path d="M14 182H30L330 194H346V212H14Z" fill="var(--lg-timber)" strokeWidth="1.4" />
    <path d="M40 196c40 3 80 2 120 5s90 4 170 6" stroke="var(--lg-grain)" strokeWidth="0.8" />
    <path d="M30 182H330" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />

    <g className="mv-lg-show-5">
      <g className="mv-lg-turn-36-54 mv-vb" style={turnAt(60, 183.2, 2.29)}>
        <g className="mv-lg-go-5-16" style={move(0, -34)}>
          <Level x={60} y={170.2} w={220} bubbleCls="mv-lg-go-36-54" bubbleStyle={move(-10)} />
        </g>
      </g>
    </g>
    <g className="text-accent">
      <g className="mv-lg-win-33-54">
        <Arrow x1={296} y1={178} x2={296} y2={158} w={2.4} />
      </g>
      <g className="mv-lg-pop-57">
        <VDim x={290} y1={183.4} y2={191.8} />
        <T x={298} y={176} anchor="start" size={10} weight={700}>
          8 mm
        </T>
      </g>
      <g className="mv-lg-pop-74">
        <T x={236} y={150} weight={700}>
          low end: 8 mm to make up
        </T>
      </g>
      <g className="mv-lg-show-64">
        <path d="M55 152h10l-5 8z" fill="currentColor" strokeWidth="1" />
        <T x={36} y={146} anchor="start" size={9} weight={650}>
          highest point
        </T>
      </g>
    </g>
    <Tick x={150} y={147} cls="mv-lg-pop-56" />
  </>
);

const fl = (x: number) => r1(182 + (x - 30) * 0.04);
const BaseFrame: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-27">Build a base frame, 50 to 100 mm high</Cap>
    <Cap cls="mv-lg-win-30-60">Level it with spacers under the low side</Cap>
    <Cap cls="mv-lg-show-63">Fix it down. The units stand on it, level</Cap>

    <rect x="14" y="34" width="16" height="148" fill={u('brickcut')} strokeWidth="1.3" />
    <rect x="330" y="34" width="16" height="160" fill={u('brickcut')} strokeWidth="1.3" />
    <path d="M14 182H30L330 194H346V212H14Z" fill="var(--lg-timber)" strokeWidth="1.4" />
    <path d="M30 182H330" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
    <T x={180} y={207} size={9} weight={650}>
      base frame: 50 to 100 mm high
    </T>

    {/* the spacers that hold it level: thicker towards the low side */}
    {[
      ['mv-lg-pop-40', 118],
      ['mv-lg-pop-44', 180],
      ['mv-lg-pop-48', 242],
      ['mv-lg-pop-52', 296],
    ].map(([c, x]) => (
      <g key={x} className={c as string}>
        <path d={`M${x} 182.8H${(x as number) + 14}V${fl((x as number) + 14)}L${x} ${fl(x as number)}Z`} fill={MOUNT} stroke="none" />
        <path d={`M${x} 182.8H${(x as number) + 14}V${fl((x as number) + 14)}L${x} ${fl(x as number)}Z`} fill={BLUE} fillOpacity="0.45" stroke={BLUE} strokeWidth="1.2" />
      </g>
    ))}

    <g className="mv-lg-turn-30-46 mv-vb" style={turnAt(50, 182.8, 2.29)}>
      <g className="mv-lg-in-4" style={move(0, -26)}>
        <rect x="50" y="166.8" width="260" height="16" fill="var(--lg-ply-dark)" />
        <path d="M58 166.8v16M115 166.8v16M123 166.8v16M176 166.8v16M184 166.8v16M237 166.8v16M245 166.8v16M302 166.8v16" strokeWidth="1" strokeOpacity="0.55" />
      </g>
      <g className="mv-lg-win-14-60">
        <g className="mv-lg-go-14-24" style={move(0, -22)}>
          <Level x={120} y={153.8} w={120} bubbleCls="mv-lg-go-30-46" bubbleStyle={move(-9)} />
        </g>
      </g>
    </g>
    <Tick x={262} y={158} cls="mv-lg-win-48-60" />
    <g className="mv-lg-win-52-61 text-accent">
      <T x={180} y={140} weight={700}>
        spacers under the low side
      </T>
    </g>

    <g className="mv-lg-in-64" style={move(0, -18)}>
      <rect x="50" y="44" width="260" height="122.8" fill="var(--lg-ply)" />
      {[57, 143.7, 230.3].map((x) => (
        <rect key={x} x={x} y="51" width="72.7" height="108.8" fill={PAPER} strokeWidth="1.1" />
      ))}
    </g>
    <Tick x={180} y={105} cls="mv-lg-pop-82" />
  </>
);

const WallPlumb: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-28">Stand the level upright against each wall</Cap>
    <Cap cls="mv-lg-win-31-58">Plumb it. The gap shows how far the wall leans</Cap>
    <Cap cls="mv-lg-show-61">Measure the width in three places. Use the smallest</Cap>

    {/* the left wall leans back at the top; the right one is straight */}
    <path d="M14 30H44L56 194H14Z" fill={u('brickcut')} strokeWidth="1.4" />
    <rect x="320" y="30" width="26" height="164" fill={u('brickcut')} strokeWidth="1.4" />
    <path d="M8 194H352" />

    <g className="mv-lg-off-58">
      <g className="mv-lg-show-4">
        <g className="mv-lg-turn-34-50 mv-vb" style={turnAt(56, 190, -4.2)}>
          <g className="mv-lg-go-4-14" style={move(44)}>
            <Plumb x={56} y={190} h={150} bubbleCls="mv-lg-go-34-50" bubbleStyle={move(-2.6)} />
          </g>
        </g>
      </g>
      <g className="text-accent">
        <g className="mv-lg-pop-51">
          <path d="M45 44H56M45 40v8" strokeWidth="1.4" />
          <T x={78} y={48} anchor="start" size={10} weight={700}>
            11 mm out at the top
          </T>
        </g>
      </g>
      <Tick x={90} y={115} cls="mv-lg-pop-51" />
    </g>

    <g className="mv-lg-show-63">
      <HDim x1={47} x2={320} y={70} label="2,412" />
    </g>
    <g className="mv-lg-show-69">
      <HDim x1={50.6} x2={320} y={120} label="2,405" />
    </g>
    <g className="mv-lg-show-75 text-accent">
      <path d="M54.2 170H320M54.2 166v8M320 166v8" strokeWidth="1.8" />
    </g>
    <g className="mv-lg-pop-79 text-accent">
      <T x={187} y={163} size={10.5} weight={700}>
        2,398 mm: build to this one
      </T>
    </g>
  </>
);

const SquareUnit: Scene = () => (
  <>
    <Cap cls="mv-lg-win-0-40">Sides onto the bottom, then the top</Cap>
    <Cap cls="mv-lg-win-43-70">Measure corner to corner, both ways</Cap>
    <Cap cls="mv-lg-show-73">The same both ways: it’s square. Fix the back</Cap>

    {/* the unit lying on its side: bottom on the left, top on the right */}
    <rect className="mv-lg-show-75" x="70" y="50" width="220" height="130" fill="var(--lg-ply)" fillOpacity="0.75" stroke="none" />
    <rect x="70" y="50" width="8" height="130" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
    <g className="mv-lg-in-6" style={move(0, -22)}>
      <rect x="78" y="50" width="204" height="8" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
    </g>
    <g className="mv-lg-in-14" style={move(0, 22)}>
      <rect x="78" y="172" width="204" height="8" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
    </g>
    <g className="mv-lg-in-24" style={move(26)}>
      <rect x="282" y="50" width="8" height="130" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
    </g>
    <g className="mv-lg-win-4-40">
      <T x={58} y={118} anchor="end" size={9}>
        bottom
      </T>
      <T x={180} y={45} size={9}>
        side
      </T>
      <T x={180} y={193} size={9}>
        side
      </T>
      <T x={302} y={118} anchor="start" size={9}>
        top
      </T>
    </g>

    <g className="text-accent">
      <path className="mv-lg-line mv-lg-draw-45-55" pathLength={1} d="M78 58L282 172" strokeWidth="1.8" />
      <path className="mv-lg-line mv-lg-draw-58-68" pathLength={1} d="M282 58L78 172" strokeWidth="1.8" />
      <g className="mv-lg-pop-55">
        <rect x="104" y="80" width="44" height="14" fill={PAPER} stroke="none" />
        <T x={126} y={90.5} size={10} weight={700}>
          2,216
        </T>
      </g>
      <g className="mv-lg-pop-68">
        <rect x="212" y="80" width="44" height="14" fill={PAPER} stroke="none" />
        <T x={234} y={90.5} size={10} weight={700}>
          2,216
        </T>
      </g>
    </g>
    <Tick x={180} y={115} cls="mv-lg-pop-72" />
    <Head x={82} y={66} cls="mv-lg-pop-80" />
    <Head x={278} y={66} cls="mv-lg-pop-83" />
    <Head x={278} y={164} cls="mv-lg-pop-86" />
    <Head x={82} y={164} cls="mv-lg-pop-89" />
    <g className="mv-lg-pop-80">
      <T x={180} y={197} size={9.5} weight={650}>
        18 mm back, screwed on
      </T>
    </g>
  </>
);

const SidePanels: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-30">Hold the side panel against the wall, plumb</Cap>
    <Cap cls="mv-lg-win-33-66">Run a compass down the wall. The pencil copies it</Cap>
    <Cap cls="mv-lg-show-69">Cut on the line. It fits the wall with no gap</Cap>

    {/* a wall that wanders, and the unit standing square beside it */}
    <path d="M50 30C53 44 57 58 56 70C55 84 51 96 52 110C53 124 59 138 60 150C61 164 59 180 58 194H14V30Z" fill={u('brickcut')} strokeWidth="1.4" />
    <path d="M8 194H352" />
    <rect x="100" y="40" width="232" height="140" fill="var(--lg-ply)" />
    <rect x="108" y="48" width="216" height="124" fill={PAPER} strokeWidth="1.1" />
    <path d="M108 78H324" strokeWidth="1.2" />
    <rect x="104" y="180" width="224" height="14" fill="var(--lg-ply-dark)" strokeWidth="1.2" />
    <T x={216} y={120} size={9} faint>
      the unit, square and level
    </T>

    {/* the panel as it comes: wider than the gap, over the front of the unit */}
    <g className="mv-lg-win-4-68">
      <g className="mv-lg-in-4" style={move(34)}>
        <rect x="66" y="40" width="50" height="154" fill="var(--lg-ply-dark)" />
      </g>
    </g>
    <g className="mv-lg-off-68 text-accent">
      <path className="mv-lg-line mv-lg-trace-36-62" pathLength={1} d="M68.5 40C70.5 50 72.5 60 72 70C71 84 67 96 68 110C69 124 75 138 76 150C77 164 75 180 74 194" strokeWidth="1.9" />
    </g>
    <g className="mv-lg-win-33-64">
      <g className="mv-lg-slide-36-62" style={move(0, -150)}>
        <path d="M58 192L66 158L74 192" strokeWidth="1.8" />
        <circle cx="66" cy="157" r="3.4" fill="var(--lg-steel)" strokeWidth="1.2" />
        <path d="M74 192v-9" stroke={BLUE} strokeWidth="2.6" />
      </g>
    </g>

    {/* cut on the line, pushed across */}
    <g className="mv-lg-show-68">
      <g className="mv-lg-go-74-86" style={move(16)}>
        <path d="M52.5 40C54.5 50 56.5 60 56 70C55 84 51 96 52 110C53 124 59 138 60 150C61 164 59 180 58 194H100V40Z" fill="var(--lg-ply-dark)" />
      </g>
    </g>
    <g className="text-accent">
      <g className="mv-lg-win-70-86">
        <Arrow x1={96} y1={206} x2={70} y2={206} w={2.4} />
      </g>
    </g>
    <Tick x={78} y={112} cls="mv-lg-pop-88" />
  </>
);

const TopPlinth: Scene = ({ u }) => (
  <>
    <Cap cls="mv-lg-win-0-36">A plinth along the bottom, scribed to the floor</Cap>
    <Cap cls="mv-lg-win-39-66">A top panel fills the gap up to the ceiling</Cap>
    <Cap cls="mv-lg-show-69">Wall to wall, floor to ceiling: it looks built in</Cap>

    <rect x="14" y="30" width="20" height="164" fill={u('brickcut')} strokeWidth="1.3" />
    <rect x="326" y="30" width="20" height="164" fill={u('brickcut')} strokeWidth="1.3" />
    <path d="M14 30H34Q180 37 326 30H346" strokeWidth="1.4" />
    <path d="M8 194H352" />

    {/* three units and the side panels already in */}
    <rect x="34" y="31" width="14" height="163" fill="var(--lg-ply-dark)" strokeWidth="1.2" />
    <rect x="312" y="31" width="14" height="163" fill="var(--lg-ply-dark)" strokeWidth="1.2" />
    <rect x="48" y="48" width="264" height="130" fill="var(--lg-ply)" />
    {[54, 140, 226].map((x) => (
      <rect key={x} x={x} y="54" width="80" height="118" fill={PAPER} strokeWidth="1.1" />
    ))}

    <g className="mv-lg-in-6" style={move(0, 12)}>
      <rect x="48" y="178" width="264" height="16" fill={MOUNT} stroke="none" />
      <rect x="48" y="178" width="264" height="16" fill={BLUE} fillOpacity="0.22" stroke={BLUE} strokeWidth="1.4" />
    </g>
    <g className="mv-lg-pop-22 text-accent">
      <T x={180} y={189.5} size={9} weight={700}>
        plinth
      </T>
    </g>
    <g className="mv-lg-in-40" style={move(0, 12)}>
      <path d="M48 48V30.7Q180 37 312 30.7V48Z" fill={MOUNT} stroke="none" />
      <path d="M48 48V30.7Q180 37 312 30.7V48Z" fill={BLUE} fillOpacity="0.22" stroke={BLUE} strokeWidth="1.4" />
    </g>
    <g className="mv-lg-pop-56 text-accent">
      <T x={180} y={45} size={9} weight={700}>
        top panel
      </T>
    </g>
    <Tick x={180} y={113} cls="mv-lg-pop-78" />
  </>
);

/* one unit seen from the front, open: sides, top, bottom and its plinth */
function OpenUnit() {
  return (
    <>
      <rect x="100" y="34" width="160" height="148" fill="var(--lg-ply)" />
      <rect x="107" y="41" width="146" height="134" fill={PAPER} strokeWidth="1.1" />
      <rect x="104" y="182" width="152" height="12" fill="var(--lg-ply-dark)" strokeWidth="1.2" />
      <path d="M60 194H300" />
    </>
  );
}

const Shelves: Scene = () => (
  <>
    <Cap cls="mv-lg-win-0-30">Mark the same height on both sides</Cap>
    <Cap cls="mv-lg-win-33-60">Four pins in the holes. The shelf sits on them</Cap>
    <Cap cls="mv-lg-show-63">Top shelf at about 2 m: rail under, luggage above</Cap>
    <OpenUnit />
    {[113, 247].map((x) => (
      <g key={x}>
        {[82, 92, 102, 112, 122, 132, 142, 152, 162].map((y) => (
          <circle key={y} cx={x} cy={y} r="1.1" strokeWidth="0.8" strokeOpacity="0.55" />
        ))}
      </g>
    ))}

    <g className="mv-lg-win-3-30 text-accent">
      <path className="mv-lg-line mv-lg-draw-4-16" pathLength={1} d="M107 122H253" strokeWidth="1.2" />
    </g>
    <g className="text-accent">
      <circle className="mv-lg-ping-16" cx="113" cy="122" r="9" strokeWidth="1.6" />
      <circle className="mv-lg-ping-19" cx="247" cy="122" r="9" strokeWidth="1.6" />
    </g>
    <rect className="mv-lg-pop-18" x="107.5" y="120.5" width="8" height="3.2" rx="1" fill="var(--lg-steel)" strokeWidth="1" />
    <rect className="mv-lg-pop-21" x="244.5" y="120.5" width="8" height="3.2" rx="1" fill="var(--lg-steel)" strokeWidth="1" />
    <g className="mv-lg-in-34" style={move(0, -18)}>
      <rect x="108" y="113.5" width="144" height="7" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
    </g>
    <rect className="mv-lg-pop-44" x="107.5" y="150.5" width="8" height="3.2" rx="1" fill="var(--lg-steel)" strokeWidth="1" />
    <rect className="mv-lg-pop-46" x="244.5" y="150.5" width="8" height="3.2" rx="1" fill="var(--lg-steel)" strokeWidth="1" />
    <g className="mv-lg-in-49" style={move(0, -18)}>
      <rect x="108" y="143.5" width="144" height="7" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
    </g>

    <g className="mv-lg-in-64" style={move(0, 14)}>
      <rect x="108" y="61" width="144" height="7" fill={MOUNT} stroke="none" />
      <rect x="108" y="61" width="144" height="7" fill={BLUE} fillOpacity="0.25" stroke={BLUE} strokeWidth="1.4" />
    </g>
    <g className="mv-lg-show-76 text-accent">
      <VDim x={278} y1={61} y2={194} />
      <T x={286} y={124} anchor="start" size={9} weight={700}>
        about
      </T>
      <T x={286} y={135} anchor="start" size={9} weight={700}>
        2,000 mm
      </T>
    </g>
    <g className="mv-lg-pop-84">
      <rect x="150" y="45" width="46" height="15" rx="2.5" fill="var(--lg-cavity)" strokeWidth="1.2" />
      <path d="M166 45v-2.5h14V45" strokeWidth="1.2" />
    </g>
  </>
);

function Coat({ x, len, fill, cls }: { x: number; len: number; fill: string; cls: string }) {
  return (
    <g className={cls}>
      <path d={`M${x} 78v-3.4a2 2 0 1 1 2 2`} strokeWidth="1.1" />
      <path d={`M${x - 11} 85L${x} 78L${x + 11} 85L${x + 13} ${85 + len}H${x - 13}Z`} fill={fill} strokeWidth="1.2" />
    </g>
  );
}

const Rail: Scene = () => (
  <>
    <Cap cls="mv-lg-win-0-30">A bracket on each side, just under the shelf</Cap>
    <Cap cls="mv-lg-win-33-60">Cut the rail a touch short of the gap. Drop it in</Cap>
    <Cap cls="mv-lg-show-63">Long coats need about 1.4 m under the rail</Cap>
    <OpenUnit />
    <rect x="108" y="61" width="144" height="7" fill="var(--lg-ply-dark)" strokeWidth="1.3" />

    <path className="mv-lg-pop-8" d="M107.5 70.5h7v8h-7" fill="var(--lg-steel)" strokeWidth="1.2" />
    <path className="mv-lg-pop-16" d="M252.5 70.5h-7v8h7" fill="var(--lg-steel)" strokeWidth="1.2" />
    <g className="text-accent">
      <circle className="mv-lg-ping-9" cx="111" cy="74" r="10" strokeWidth="1.6" />
      <circle className="mv-lg-ping-17" cx="249" cy="74" r="10" strokeWidth="1.6" />
    </g>

    <g className="mv-lg-win-33-60 text-accent">
      <HDim x1={107} x2={253} y={104} label="the gap, less 3 mm" below />
    </g>
    <g className="mv-lg-in-40" style={move(0, 26)}>
      <rect x="110" y="72.5" width="140" height="4" rx="2" fill="var(--lg-steel)" strokeWidth="1.1" />
    </g>

    <Coat x={138} len={84} fill="var(--lg-cavity)" cls="mv-lg-pop-65" />
    <Coat x={166} len={90} fill="var(--lg-steel)" cls="mv-lg-pop-69" />
    <Coat x={194} len={80} fill="var(--lg-timber)" cls="mv-lg-pop-73" />
    <Coat x={222} len={88} fill="var(--lg-cavity)" cls="mv-lg-pop-77" />
    <g className="mv-lg-show-80 text-accent">
      <VDim x={278} y1={76} y2={175} />
      <T x={286} y={122} anchor="start" size={9} weight={700}>
        about
      </T>
      <T x={286} y={133} anchor="start" size={9} weight={700}>
        1,400 mm
      </T>
    </g>
  </>
);

const Drawers: Scene = () => (
  <>
    <Cap cls="mv-lg-win-0-32">Runners on both sides, level, at the same height</Cap>
    <Cap cls="mv-lg-win-35-66">Slide each drawer box onto its runners</Cap>
    <Cap cls="mv-lg-show-69">Fronts on with even gaps. A dust shelf on top</Cap>

    {/* the inside of one side panel: the front of the unit is on the left */}
    <rect x="70" y="30" width="250" height="164" fill="var(--lg-ply)" strokeWidth="1.4" />
    <rect x="304" y="30" width="8" height="152" fill="var(--lg-ply-dark)" strokeWidth="1.2" />
    <rect x="70" y="174" width="234" height="8" fill="var(--lg-ply-dark)" strokeWidth="1.2" />
    <rect x="82" y="182" width="7" height="12" fill="var(--lg-ply-dark)" strokeWidth="1.2" />
    <path d="M30 194H340" />
    <T x={340} y={208} anchor="end" size={8.5} faint>
      seen from the side
    </T>
    <T x={50} y={118} anchor="end" size={8.5} faint>
      front
    </T>

    {[158, 118, 78].map((y, i) => (
      <g key={y} className={['mv-lg-growx-4-12 mv-ol', 'mv-lg-growx-12-20 mv-ol', 'mv-lg-growx-20-28 mv-ol'][i]}>
        <rect x="82" y={y} width="214" height="4.4" rx="1" fill="var(--lg-steel)" strokeWidth="1.1" />
      </g>
    ))}
    <g className="mv-lg-win-22-33">
      <Level x={144} y={64.6} w={90} />
    </g>
    <g className="mv-lg-win-28-36">
      <Tick x={250} y={70} />
    </g>

    {[
      ['mv-lg-show-36', 'mv-lg-go-37-45', 134],
      ['mv-lg-show-45', 'mv-lg-go-46-54', 94],
      ['mv-lg-show-54', 'mv-lg-go-55-63', 54],
    ].map(([a, b, y]) => (
      <g key={y} className={a as string}>
        <g className={b as string} style={move(-150)}>
          <rect x="72" y={y as number} width="222" height="32" fill="var(--lg-ply-dark)" strokeWidth="1.3" />
          <path d={`M72 ${(y as number) + 27}H294`} strokeWidth="0.9" strokeOpacity="0.55" />
        </g>
      </g>
    ))}
    {[
      ['mv-lg-pop-70', 131],
      ['mv-lg-pop-74', 91],
      ['mv-lg-pop-78', 51],
    ].map(([c, y]) => (
      <g key={y} className={c as string}>
        <rect x="62" y={y as number} width="8" height="36" fill={MOUNT} stroke="none" />
        <rect x="62" y={y as number} width="8" height="36" fill={BLUE} fillOpacity="0.25" stroke={BLUE} strokeWidth="1.4" />
      </g>
    ))}
    <g className="mv-lg-in-84" style={move(0, -12)}>
      <rect x="74" y="40" width="230" height="7" fill={MOUNT} stroke="none" />
      <rect x="74" y="40" width="230" height="7" fill={BLUE} fillOpacity="0.25" stroke={BLUE} strokeWidth="1.4" />
    </g>
  </>
);

const Doors: Scene = () => (
  <>
    <Cap cls="mv-lg-win-0-36">Hinge holes: 35 mm, centred 21 mm from the edge</Cap>
    <Cap cls="mv-lg-win-39-66">Clip the doors onto their plates</Cap>
    <Cap cls="mv-lg-show-69">Turn the hinge screws until the gaps are even</Cap>

    {/* the back of a door, close up */}
    <T x={75} y={44} size={8.5} faint>
      the back of the door
    </T>
    <path d="M130 52H20V182H130" fill="var(--lg-ply)" />
    <path d="M130 52V182" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.5" />
    <g className="mv-lg-pop-8">
      <circle cx="46" cy="112" r="22" fill={PAPER} />
      <path d="M42 112h8M46 108v8" strokeWidth="1" />
    </g>
    <g className="text-accent">
      <circle className="mv-lg-ping-8" cx="46" cy="112" r="24" strokeWidth="1.7" />
      <g className="mv-lg-show-14">
        <HDim x1={20} x2={46} y={76} label="21 mm" />
        <path d="M46 80V108" strokeWidth="1" strokeDasharray="2.5 2.5" />
      </g>
      <g className="mv-lg-show-20">
        <path d="M24 146H68M24 142v8M68 142v8" strokeWidth="1.1" />
        <T x={46} y={160} size={9}>
          35 mm
        </T>
      </g>
    </g>
    <g className="mv-lg-pop-28">
      <rect x="8" y="106" width="34" height="12" rx="2" fill="var(--lg-steel)" strokeWidth="1.2" />
      <circle cx="46" cy="112" r="15" fill="var(--lg-steel)" strokeWidth="1.2" />
      <circle cx="40" cy="104" r="1.6" fill="var(--color-ink)" stroke="none" />
      <circle cx="40" cy="120" r="1.6" fill="var(--color-ink)" stroke="none" />
    </g>
    <path d="M150 30V204" strokeWidth="1" strokeOpacity="0.3" />

    {/* the unit from the front */}
    <rect x="176" y="40" width="160" height="150" fill="var(--lg-ply)" />
    <rect x="183" y="47" width="146" height="136" fill={PAPER} strokeWidth="1.1" />
    <path d="M183 72H329" strokeWidth="1.2" />
    <path d="M186 79H326" stroke="var(--lg-steel)" strokeWidth="2.4" />
    <path d="M166 190H346" />
    <g className="mv-lg-growx-41-51 mv-ol">
      <rect x="178" y="42" width="77" height="146" fill="var(--lg-board)" />
      <circle cx="248" cy="118" r="2.2" fill="var(--lg-steel)" strokeWidth="1" />
    </g>
    <g className="mv-lg-turn-72-84 mv-vb" style={turnAt(334, 42, -1.7)}>
      <g className="mv-lg-growx-54-64 mv-or">
        <rect x="257" y="42" width="77" height="146" fill="var(--lg-board)" />
        <circle cx="264" cy="118" r="2.2" fill="var(--lg-steel)" strokeWidth="1" />
      </g>
    </g>
    <g className="text-accent">
      <circle className="mv-lg-ping-72" cx="326" cy="58" r="10" strokeWidth="1.6" />
      <circle className="mv-lg-ping-77" cx="326" cy="172" r="10" strokeWidth="1.6" />
      <path className="mv-lg-show-86" d="M256 44V186" strokeWidth="2.2" />
      <g className="mv-lg-pop-88">
        <T x={256} y={204} size={9.5} weight={700}>
          even gap
        </T>
      </g>
    </g>
    <Tick x={296} y={112} cls="mv-lg-pop-88" />
  </>
);

export const SCENES: Record<string, Scene[]> = {
  'hang-heavy-things-on-a-wall': [Knock, FindStuds, MarkLevel, Drill, Fixings, HangCheck],
  'french-cleat': [CleatWorks, CutStrip, OnCabinet, WallHalf, LiftOn],
  'build-a-fitted-wardrobe': [FloorLevel, BaseFrame, WallPlumb, SquareUnit, SidePanels, TopPlinth, Shelves, Rail, Drawers, Doors],
};

/* The drawing for one step: its own patterns (so two drawings on a page never share ids), the scene, and the
   loop's clock along the bottom edge. */
export default function GuideDrawing({ slug, step }: { slug: string; step: number }) {
  const uid = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const k = (name: string) => `${uid}-${name}`;
  const u = (name: string) => `url(#${uid}-${name})`;
  const Scene = SCENES[slug]?.[step];
  return (
    <svg viewBox="0 0 360 220" className="lg-art block h-full w-full font-mono" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        {/* brick from the front, and cut through */}
        <pattern id={k('brick')} width="26" height="18" patternUnits="userSpaceOnUse">
          <rect width="26" height="18" fill="var(--lg-brick)" stroke="none" />
          <path d="M0 0H26M0 9H26M13 0V9M0 9V18M26 9V18" stroke="var(--lg-mortar)" strokeWidth="1.6" strokeLinecap="butt" />
        </pattern>
        <pattern id={k('brickcut')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="var(--lg-brick)" stroke="none" />
          <path d="M0 0V7" strokeWidth="1" strokeOpacity="0.4" />
        </pattern>
        {/* plywood on edge: the plies, upright or lying flat */}
        <pattern id={k('plyv')} width="4.4" height="8" patternUnits="userSpaceOnUse">
          <rect width="4.4" height="8" fill="var(--lg-ply)" stroke="none" />
          <path d="M0 0V8" stroke="var(--lg-grain)" strokeWidth="0.9" strokeOpacity="0.75" />
        </pattern>
        <pattern id={k('plyh')} width="8" height="6" patternUnits="userSpaceOnUse">
          <rect width="8" height="6" fill="var(--lg-ply)" stroke="none" />
          <path d="M0 0H8" stroke="var(--lg-grain)" strokeWidth="0.9" strokeOpacity="0.75" />
        </pattern>
        <pattern id={k('zone')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <path d="M0 0V7" stroke={BLUE} strokeWidth="1.4" strokeOpacity="0.3" />
        </pattern>
      </defs>
      {Scene ? <Scene u={u} k={k} /> : null}
      <rect className="mv-lg-bar mv-ol" x="0" y="217" width="360" height="3" fill={BLUE} stroke="none" />
    </svg>
  );
}

export const sceneCount = (slug: string) => SCENES[slug]?.length ?? 0;
