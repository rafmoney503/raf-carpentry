'use client';

import { useId } from 'react';

/* The moving drawings for the Learn guides (src/lib/learn.ts), one scene per step in the same order. Each scene acts
   out its step on a 7 s loop (src/app/learn/learn.css: the mv-lg-* moves): parts come in, a tool does its job, the
   result stays, then it starts again. Drawn like the rest of the site: pencil ink, the one blueprint blue for what
   matters in the step, on graph paper. With reduced motion, or paused off screen, each scene is its finished state
   (the base drawing), so it still makes sense standing still. 360 x 220, in the site's sketch style. */

type U = (name: string) => string;
type Scene = (p: { u: U }) => React.JSX.Element;

const cv = (o: Record<string, string | number>) => o as React.CSSProperties;
const move = (dx: number, dy = 0) => cv({ '--dx': `${dx}px`, '--dy': `${dy}px` });
const turnAt = (x: number, y: number) => cv({ transformOrigin: `${x}px ${y}px` });
const accent = 'text-accent';

function T({ x, y, children, anchor = 'middle', size = 10.5, weight = 500, className = '' }: { x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number; weight?: number; className?: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} stroke="none" fill="currentColor" className={className}>
      {children}
    </text>
  );
}

/* a wall seen from the front, with its skirting and the floor */
function Wall({ x = 16, w = 328, top = 14 }: { x?: number; w?: number; top?: number }) {
  return (
    <>
      <rect x={x} y={top} width={w} height={194 - top} fill="var(--color-mount)" strokeWidth="1.4" />
      <rect x={x} y={182} width={w} height={12} strokeWidth="1.2" />
      <path d="M6 194H354" />
    </>
  );
}

/* hidden studs behind plasterboard, dashed */
function Studs({ xs = [78, 158, 238], faint = false, cls = [] as string[] }: { xs?: number[]; faint?: boolean; cls?: string[] }) {
  return (
    <>
      {xs.map((x, i) => (
        <rect key={x} className={cls[i]} x={x - 6} y={14} width={12} height={168} strokeWidth="1.1" strokeDasharray="4 3" strokeOpacity={faint ? 0.38 : 0.6} />
      ))}
    </>
  );
}

/* a spirit level bar, its bubble in the middle */
function Level({ x, y, w, bubbleCls }: { x: number; y: number; w: number; bubbleCls?: string }) {
  const cx = x + w / 2;
  return (
    <>
      <rect x={x} y={y} width={w} height={11} rx="2" fill="var(--color-paper)" />
      <rect x={cx - 13} y={y + 2.5} width={26} height={6} rx="3" strokeWidth="1.1" />
      <path d={`M${cx - 4.5} ${y + 2.5}v6M${cx + 4.5} ${y + 2.5}v6`} strokeWidth="0.9" />
      <g className={accent}>
        <ellipse className={bubbleCls} cx={cx} cy={y + 5.5} rx="3.2" ry="2" fill="currentColor" fillOpacity="0.25" strokeWidth="1.1" />
      </g>
    </>
  );
}

function Tick({ x, y, cls }: { x: number; y: number; cls?: string }) {
  return (
    <g className={accent}>
      <path className={cls} d={`M${x} ${y}l4 4 8-9`} strokeWidth="2.2" />
    </g>
  );
}

function Screw({ x, y, cls }: { x: number; y: number; cls?: string }) {
  return (
    <g className={cls}>
      <circle cx={x} cy={y} r="3.6" fill="var(--color-paper)" strokeWidth="1.2" />
      <path d={`M${x - 2} ${y}h4M${x} ${y - 2}v4`} strokeWidth="0.9" />
    </g>
  );
}

/* ---------------- How to hang something heavy on any wall ---------------- */

function Fist({ x, y, cls }: { x: number; y: number; cls: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={cls}>
        <rect x="0" y="0" width="24" height="18" rx="6" fill="var(--color-paper)" />
        <path d="M7 1v7M12.5 1v7M18 1v7" strokeWidth="1.1" />
        <path d="M1 11c3.5 0 5.5 2 6.5 6" strokeWidth="1.1" />
      </g>
    </g>
  );
}

const WINDOW = 'M44 88L60 86 72 90 90 85 108 89 126 86 144 90 146 108 142 126 146 146 144 162 126 160 108 164 90 160 72 163 56 160 42 162 44 144 40 126 44 108Z';

const Knock: Scene = ({ u }) => {
  const id = u('win').slice(5, -1); // this drawing's own prefix, for the two clip paths
  return (
    <>
      <defs>
        <clipPath id={`${id}a`}>
          <path d={WINDOW} />
        </clipPath>
        <clipPath id={`${id}b`}>
          <path d={WINDOW} transform="translate(172 0)" />
        </clipPath>
      </defs>
      <Wall x={16} w={156} top={30} />
      <Wall x={188} w={156} top={30} />
      <T x={94} y={22} weight={600}>HOLLOW KNOCK</T>
      <T x={266} y={22} weight={600}>SOLID KNOCK</T>

      {/* plasterboard: the window opens on the studs behind */}
      <g className="mv-lg-open-35">
        <g clipPath={`url(#${id}a)`}>
          <rect x="30" y="80" width="130" height="90" fill="var(--color-raised)" stroke="none" />
          {[56, 120].map((sx) => (
            <g key={sx}>
              <rect x={sx} y="80" width="14" height="90" fill="var(--color-paper)" strokeWidth="1.2" />
              <path d={`M${sx + 4} 82c2 20-2 40 0 60s2 20 0 26M${sx + 9.5} 82c-2 24 2 44 0 64`} strokeWidth="0.7" strokeOpacity="0.55" />
            </g>
          ))}
        </g>
        <path d={WINDOW} strokeWidth="1.3" />
      </g>
      <g className="mv-lg-pop-45">
        <T x={94} y={176} size={9.5}>plasterboard on studs</T>
      </g>

      {/* brick or block */}
      <g className="mv-lg-open-50">
        <g clipPath={`url(#${id}b)`}>
          <rect x="200" y="80" width="140" height="90" fill={u('brick')} stroke="none" />
        </g>
        <path d={WINDOW} transform="translate(172 0)" strokeWidth="1.3" />
      </g>
      <g className="mv-lg-pop-60">
        <T x={266} y={176} size={9.5}>brick or block</T>
      </g>

      <Fist x={44} y={46} cls="mv-lg-knock-a" />
      <g className={accent}>
        <path className="mv-lg-show-5" d="M74 50q6 5 0 10" />
        <path className="mv-lg-show-5" d="M80 46q10 9 0 18" />
        <path className="mv-lg-show-10" d="M86 42q14 13 0 26" />
        <path className="mv-lg-show-10" d="M92 38q18 17 0 34" />
        <g className="mv-lg-pop-10">
          <T x={130} y={58} size={11} weight={600}>tok tok</T>
        </g>
      </g>

      <Fist x={216} y={46} cls="mv-lg-knock-b" />
      <g className={accent}>
        <path className="mv-lg-show-20" d="M246 51q4 4 0 8" />
        <path className="mv-lg-show-25" d="M251 49q6 6 0 12" />
        <g className="mv-lg-pop-25">
          <T x={292} y={58} size={11} weight={600}>thud</T>
        </g>
      </g>
    </>
  );
};

const FindStuds: Scene = ({ u }) => (
  <>
    <Wall />
    <Studs cls={['mv-lg-show-20', 'mv-lg-show-40', 'mv-lg-show-60']} />
    {/* where cables are allowed to run: keep clear */}
    <g className="mv-lg-show-70">
      <rect x="16" y="14" width="328" height="30" fill={u('zone')} stroke="none" />
      <rect x="16" y="44" width="30" height="138" fill={u('zone')} stroke="none" />
      <rect x="314" y="44" width="30" height="138" fill={u('zone')} stroke="none" />
      <rect x="286" y="44" width="28" height="138" fill={u('zone')} stroke="none" />
      <rect x="46" y="136" width="240" height="26" fill={u('zone')} stroke="none" />
    </g>
    <g className="mv-lg-pop-75">
      <rect x="66" y="20" width="228" height="17" rx="2" fill="var(--color-paper)" stroke="none" />
      <T x={180} y={32} size={10} weight={600}>CABLES RUN IN THESE LINES</T>
    </g>
    {/* a socket */}
    <rect x="290" y="140" width="22" height="18" rx="2" fill="var(--color-paper)" />
    <path d="M297 146v6M305 146v6" strokeWidth="1.2" />

    {/* pencil marks where the detector found each stud */}
    <g className={accent}>
      {[78, 158, 238].map((x, i) => (
        <path key={x} className={`mv-lg-pop-${20 + i * 20}`} d={`M${x} 70v10M${x} 116v10`} strokeWidth="2" />
      ))}
      <g className="mv-lg-pop-20">
        <T x={78} y={64} size={10} weight={600}>stud</T>
      </g>
    </g>

    {/* the detector slides along the wall */}
    <g className="mv-lg-sweep">
      <rect x="240" y="86" width="44" height="24" rx="6" fill="var(--color-paper)" />
      <rect x="246" y="91" width="20" height="8" rx="1.5" strokeWidth="1" />
      <path d="M262 86v-4M262 110v4" strokeWidth="1.2" />
      <circle cx="275" cy="95" r="3.2" strokeWidth="1" />
      <g className={accent}>
        <circle className="mv-lg-blink mv-hidden" cx="275" cy="95" r="3.2" fill="currentColor" />
      </g>
    </g>
  </>
);

const MarkLevel: Scene = () => (
  <>
    <Wall />
    {/* where the mirror will go */}
    <rect x="96" y="56" width="168" height="116" strokeWidth="1" strokeDasharray="5 4" strokeOpacity="0.35" />
    <g className="mv-lg-show-0">
      <T x={180} y={160} size={9.5} className="opacity-60">where it goes</T>
    </g>
    <g className={accent}>
      <path className="mv-lg-pop-5" d="M126 104l8 8M134 104l-8 8" strokeWidth="1.8" />
      <path className="mv-lg-pop-10" d="M226 104l8 8M234 104l-8 8" strokeWidth="1.8" />
    </g>
    <g className="mv-lg-in-15" style={move(0, -30)}>
      <g className="mv-lg-tilt mv-vb" style={turnAt(180, 90)}>
        <Level x={100} y={84} w={160} bubbleCls="mv-lg-bub-a" />
      </g>
    </g>
    <Tick x={274} y={86} cls="mv-lg-pop-55" />
    <g className="mv-lg-pop-55">
      <T x={290} y={104} anchor="start" size={10} weight={600} className={accent}>level</T>
    </g>
  </>
);

const Drill: Scene = ({ u }) => (
  <>
    {/* the wall from the side: plaster on brick */}
    <rect x="244" y="14" width="6" height="180" fill="var(--color-mount)" strokeWidth="1.1" />
    <rect x="250" y="14" width="56" height="180" fill={u('hatch')} strokeWidth="1.4" />
    <path d="M6 194H354" />
    <g className="mv-ol mv-lg-hole">
      <rect x="244" y="93" width="36" height="6" fill="currentColor" stroke="none" />
    </g>
    <g className="text-faint">
      {[[238, 90], [236, 101], [240, 106], [234, 95], [239, 86]].map(([x, y], i) => (
        <circle key={i} className="mv-lg-dust mv-hidden" cx={x} cy={y} r={1.6} fill="currentColor" stroke="none" style={cv({ '--mv-o': `${i * 0.07}s` })} />
      ))}
    </g>

    {/* the drill, pointing at the wall */}
    <g className="mv-lg-drill">
      <g className="mv-lg-buzz">
        <rect x="70" y="82" width="80" height="26" rx="8" fill="var(--color-paper)" />
        <path d="M84 90h18M84 95h18M84 100h18" strokeWidth="1" />
        <path d="M96 108l-8 40h32l6-40" fill="var(--color-paper)" />
        <path d="M118 112q-6 4-4 12" strokeWidth="1.2" />
        <rect x="80" y="148" width="52" height="12" rx="2" fill="var(--color-paper)" />
        <rect x="150" y="88" width="14" height="16" rx="2" fill="var(--color-paper)" />
        <path d="M164 96H230" strokeWidth="3" />
        <path d="M172 94l3 4M180 94l3 4M188 94l3 4M200 94l3 4M208 94l3 4M216 94l3 4M224 94l3 4" strokeWidth="0.8" />
        <g className={accent}>
          <rect x="188" y="91" width="6" height="10" rx="1" fill="currentColor" fillOpacity="0.3" strokeWidth="1.2" />
        </g>
      </g>
    </g>

    <g className={accent}>
      <path d="M191 89L168 48" strokeWidth="1" />
      <T x={18} y={42} anchor="start" size={10} weight={600}>tape: the plug’s length + a few mm</T>
    </g>
    <T x={18} y={176} anchor="start" size={10}>Brick: masonry bit, hammer on</T>
    <T x={18} y={188} anchor="start" size={10}>Stud: wood bit, hammer off</T>
  </>
);

/* one side section of the three fixings */
function Batten({ x }: { x: number }) {
  return (
    <>
      <rect x={x} y={64} width={14} height={72} fill="var(--color-paper)" strokeWidth="1.3" />
      <path d={`M${x + 5} 68c2 18-2 40 0 64M${x + 10} 70c-1 20 1 40 0 62`} strokeWidth="0.6" strokeOpacity="0.5" />
    </>
  );
}

const Fixings: Scene = ({ u }) => (
  <>
    <path d="M121 28V188M239 28V188" strokeWidth="0.8" strokeDasharray="3 4" strokeOpacity="0.4" />
    <T x={62} y={20} weight={600}>BRICK</T>
    <T x={180} y={20} weight={600}>STUD</T>
    <T x={298} y={20} weight={600}>PLASTERBOARD</T>

    {/* brick: plug flush, then the screw */}
    <rect x="78" y="30" width="38" height="146" fill={u('hatch')} strokeWidth="1.3" />
    <rect x="78" y="96" width="26" height="8" fill="var(--color-paper)" stroke="none" />
    <g className="mv-lg-in-5" style={move(-46)}>
      <g className={accent}>
        <rect x="78" y="96.5" width="24" height="7" rx="1" fill="currentColor" fillOpacity="0.25" strokeWidth="1.2" />
        <path d="M84 96.5v7M90 96.5v7M96 96.5v7" strokeWidth="0.8" />
      </g>
    </g>
    <g className="mv-lg-in-25" style={move(-16)}>
      <Batten x={64} />
    </g>
    <g className="mv-lg-in-40" style={move(-28)}>
      <path d="M56 94l6 3v6l-6 3z" fill="var(--color-paper)" strokeWidth="1.2" />
      <path d="M62 100H98" strokeWidth="2.2" />
      <path d="M68 98l2 4M74 98l2 4M80 98l2 4M86 98l2 4M92 98l2 4" strokeWidth="0.8" />
    </g>
    <T x={62} y={192} size={9.5}>plug, then screw</T>

    {/* a stud: straight into the timber */}
    <rect x="178" y="30" width="6" height="146" fill={u('hatch')} strokeWidth="1.1" />
    <rect x="184" y="30" width="40" height="146" fill="var(--color-paper)" strokeWidth="1.3" />
    <path d="M192 34c3 30-3 60 0 90s3 30 0 48M204 34c-3 34 3 64 0 94M216 34c2 40-2 80 0 138" strokeWidth="0.6" strokeOpacity="0.5" />
    <g className="mv-lg-in-10" style={move(-16)}>
      <Batten x={164} />
    </g>
    <g className="mv-lg-in-30" style={move(-30)}>
      <path d="M156 94l6 3v6l-6 3z" fill="var(--color-paper)" strokeWidth="1.2" />
      <path d="M162 100H214" strokeWidth="2.2" />
      <path d="M168 98l2 4M174 98l2 4M180 98l2 4M186 98l2 4M192 98l2 4M198 98l2 4M204 98l2 4M210 98l2 4" strokeWidth="0.8" />
    </g>
    <g className="mv-lg-pop-50">
      <g className={accent}>
        <path d="M184 112h30" strokeWidth="1" />
        <path d="M184 109v6M214 109v6" strokeWidth="1" />
        <T x={199} y={124} size={9.5} weight={600}>30 mm+</T>
      </g>
    </g>
    <T x={180} y={192} size={9.5}>into the stud</T>

    {/* plasterboard only: a spring toggle opens out behind */}
    <rect x="300" y="30" width="6" height="146" fill={u('hatch')} strokeWidth="1.1" />
    <path d="M348 30V176" strokeWidth="0.8" strokeOpacity="0.35" strokeDasharray="3 3" />
    <Batten x={286} />
    <g className="mv-lg-toggle">
      <path d="M274 94l6 3v6l-6 3z" fill="var(--color-paper)" strokeWidth="1.2" />
      <path d="M280 100H326" strokeWidth="2" />
      <g className="mv-lg-fold mv-hidden">
        <path d="M326 100l-12-6M326 100l-12 6" strokeWidth="2" />
      </g>
      <g className={`${accent} mv-lg-show-30`}>
        <path d="M309 83V117" strokeWidth="3" />
        <rect x="310" y="96" width="5" height="8" rx="1" fill="currentColor" fillOpacity="0.3" strokeWidth="1" />
      </g>
    </g>
    <g className="mv-lg-pop-60">
      <T x={330} y={74} size={9.5} weight={600} className={accent}>opens</T>
    </g>
    <T x={298} y={192} size={9.5}>no stud: a toggle</T>
  </>
);

const HangCheck: Scene = () => (
  <>
    <Wall />
    <Screw x={130} y={64} />
    <Screw x={230} y={64} />
    <g className="mv-lg-in-15" style={move(0, -36)}>
      <rect x="96" y="56" width="168" height="116" rx="2" fill="var(--color-paper)" />
      <rect x="104" y="64" width="152" height="100" rx="1" strokeWidth="1.1" />
      <path d="M124 150L156 80M140 152L168 92" strokeWidth="1" strokeOpacity="0.45" />
    </g>
    <g className="mv-lg-in-40" style={move(0, -18)}>
      <Level x={150} y={45} w={60} bubbleCls="mv-lg-bub-b" />
    </g>
    <Tick x={220} y={46} cls="mv-lg-pop-60" />
    <g className={accent}>
      <g className="mv-lg-pop-70">
        <path d="M280 104v30M274 128l6 7 6-7" strokeWidth="2" />
      </g>
      <g className="mv-lg-pop-75">
        <T x={290} y={116} anchor="start" size={10} weight={600}>pull</T>
        <T x={290} y={128} anchor="start" size={10} weight={600}>down</T>
      </g>
    </g>
  </>
);

/* ---------------- French cleat ---------------- */

const WALL_CLEAT = '246,130 268,130 268,108 246,86';
const CAB_CLEAT = '246,48 268,48 268,108 246,86';

function CleatWall({ u }: { u: U }) {
  return (
    <>
      <rect x="268" y="14" width="40" height="180" fill={u('hatch')} strokeWidth="1.4" />
      <path d="M6 194H354" />
      <polygon points={WALL_CLEAT} fill="var(--color-mount)" strokeWidth="1.5" />
      <g className={accent}>
        <path d="M246 86L268 108" strokeWidth="2.4" />
      </g>
    </>
  );
}

function Cabinet({ dashed = false }: { dashed?: boolean }) {
  const d = dashed ? { strokeDasharray: '5 4', strokeOpacity: 0.55 } : {};
  return (
    <>
      <rect x="120" y="40" width="126" height="136" fill={dashed ? 'none' : 'var(--color-paper)'} {...d} />
      <path d="M127 40v136M120 48h126M120 168h126M127 108h119M238 40v136" strokeWidth="1" {...d} />
      <polygon points={CAB_CLEAT} fill={dashed ? 'none' : 'var(--color-mount)'} strokeWidth="1.5" />
      <rect x="246" y="150" width="22" height="26" fill={dashed ? 'none' : 'var(--color-mount)'} strokeWidth="1.3" {...d} />
    </>
  );
}

const CleatWorks: Scene = ({ u }) => (
  <>
    <CleatWall u={u} />
    <g className="mv-lg-show-65">
      <rect x="120" y="40" width="126" height="136" strokeDasharray="5 4" strokeOpacity="0.5" />
      <rect x="246" y="150" width="22" height="26" strokeDasharray="5 4" strokeOpacity="0.5" />
      <T x={183} y={160} size={9.5} className="opacity-70">the cabinet</T>
    </g>
    <g className="mv-lg-hook">
      <polygon points={CAB_CLEAT} fill="var(--color-mount)" strokeWidth="1.5" />
      <g className={accent}>
        <path d="M246 86L268 108" strokeWidth="2.4" />
      </g>
    </g>
    <g className={accent}>
      <g className="mv-lg-pop-50">
        <path d="M257 18v20M251 32l6 7 6-7" strokeWidth="2" />
        <T x={228} y={24} anchor="end" size={10} weight={600}>weight</T>
      </g>
      <g className="mv-lg-pop-55">
        <T x={222} y={101} anchor="end" size={11} weight={700}>45°</T>
      </g>
    </g>
    <g className="mv-lg-pop-60">
      <path d="M200 66H244" strokeWidth="1" />
      <T x={196} y={69} anchor="end" size={10}>cabinet half</T>
      <path d="M200 118H244" strokeWidth="1" />
      <T x={196} y={121} anchor="end" size={10}>wall half</T>
    </g>
    <g className="mv-lg-pop-75">
      <T x={20} y={188} anchor="start" size={10} weight={600} className={accent}>the weight pulls it tight to the wall</T>
    </g>
  </>
);

const CutStrip: Scene = () => (
  <>
    {/* the strip from its end: 100 mm wide, 18 mm thick, cut through at 45° */}
    <g transform="translate(-16 0)">
      <g className="mv-lg-apart-l">
        <polygon points="100,118 167,118 193,144 100,144" fill="var(--color-mount)" strokeWidth="1.6" />
        <path d="M110 124c20 2 40-2 50 0M110 136c24-2 50 2 70 0" strokeWidth="0.6" strokeOpacity="0.5" />
      </g>
    </g>
    <g transform="translate(16 0)">
      <g className="mv-lg-apart-r">
        <polygon points="167,118 260,118 260,144 193,144" fill="var(--color-mount)" strokeWidth="1.6" />
        <path d="M184 124c20 2 50-2 70 0M200 136c20-2 40 2 54 0" strokeWidth="0.6" strokeOpacity="0.5" />
      </g>
    </g>
    <g className={accent}>
      <path className="mv-lg-cut mv-hidden" pathLength={1} d="M167 118L193 144" strokeWidth="2.4" strokeDasharray="1 1" />
      <g className="mv-lg-blade mv-hidden">
        <path d="M140 91L210 161" strokeWidth="5" strokeOpacity="0.5" />
        <T x={120} y={76} anchor="end" size={10} weight={600}>saw tilted to 45°</T>
      </g>
    </g>
    {/* sizes */}
    <path d="M72 118v26M68 118h8M68 144h8" strokeWidth="1" />
    <T x={64} y={134} anchor="end" size={10}>18 mm</T>
    <path d="M84 104H276M84 100v8M276 100v8" strokeWidth="1" />
    <T x={180} y={98} size={10}>about 100 mm</T>
    <g className="mv-lg-pop-60">
      <g className={accent}>
        <path d="M203 144a14 14 0 0 1 4-10" strokeWidth="1.2" />
        <T x={218} y={158} size={10.5} weight={700}>45°</T>
      </g>
    </g>
    <g className="mv-lg-pop-65">
      <T x={180} y={182} size={10}>two halves, each with a 45° edge</T>
    </g>
  </>
);

function Glue() {
  let d = 'M86 56';
  for (let x = 86; x < 234; x += 6) d += `l3 -3 3 3`;
  return <path className="mv-lg-draw-0 mv-lg-line" pathLength={1} d={d} strokeWidth="1.2" />;
}

const OnCabinet: Scene = () => (
  <>
    <T x={160} y={18} size={10} weight={600}>BACK OF THE CABINET</T>
    <rect x="70" y="26" width="180" height="164" rx="2" fill="var(--color-mount)" />
    <rect x="78" y="34" width="164" height="148" strokeWidth="1" strokeOpacity="0.5" />
    <g className={accent}>
      <Glue />
    </g>
    <g className="mv-lg-in-15" style={move(0, -24)}>
      <rect x="80" y="42" width="160" height="24" fill="var(--color-paper)" strokeWidth="1.5" />
    </g>
    {[100, 130, 160, 190, 220].map((x, i) => (
      <Screw key={x} x={x} y={52} cls={`mv-lg-pop-${30 + i * 5}`} />
    ))}
    <g className="mv-lg-in-55" style={move(0, 22)}>
      <rect x="80" y="164" width="160" height="18" fill="var(--color-paper)" strokeWidth="1.4" />
    </g>
    {[110, 160, 210].map((x, i) => (
      <Screw key={x} x={x} y={173} cls={`mv-lg-pop-${65 + i * 5}`} />
    ))}
    <g className="mv-lg-pop-70">
      <T x={160} y={158} size={9.5}>spacer, the same 18 mm</T>
    </g>

    {/* where the slope meets the cabinet, and the measurement A */}
    <g className="mv-lg-show-80">
      <path d="M80 60H240" strokeWidth="1.1" strokeDasharray="4 3" />
    </g>
    <g className={accent}>
      <path className="mv-lg-draw-80 mv-lg-line" pathLength={1} d="M58 26V60M54 26h8M54 60h8" strokeWidth="1.4" />
      <g className="mv-lg-pop-85">
        <T x={50} y={47} anchor="end" size={12} weight={700}>A</T>
      </g>
    </g>

    {/* the same from the side */}
    <rect x="266" y="36" width="80" height="112" rx="2" strokeWidth="0.9" strokeOpacity="0.5" />
    <T x={306} y={50} size={9}>FROM THE SIDE</T>
    <rect x="280" y="56" width="8" height="84" fill="var(--color-mount)" strokeWidth="1" />
    <polygon points="288,60 306,60 306,98 288,80" fill="var(--color-paper)" strokeWidth="1.3" />
    <rect x="288" y="122" width="18" height="18" fill="var(--color-paper)" strokeWidth="1.1" />
    <g className={accent}>
      <path d="M288 80L306 98" strokeWidth="2.2" />
      <T x={318} y={96} anchor="start" size={9} weight={600}>slope</T>
      <T x={318} y={106} anchor="start" size={9} weight={600}>down</T>
    </g>
  </>
);

const WallHalf: Scene = () => (
  <>
    <Wall />
    <Studs faint />
    <g className={`${accent} mv-lg-show-0`}>
      <path d="M56 40H304" strokeWidth="1.3" strokeDasharray="6 4" />
    </g>
    <g className="mv-lg-pop-10">
      <T x={180} y={34} size={10} weight={600}>top of the cabinet goes here</T>
    </g>
    <g className={accent}>
      <path className="mv-lg-draw-20 mv-lg-line" pathLength={1} d="M42 40V72M38 40h8M38 72h8" strokeWidth="1.4" />
      <g className="mv-lg-pop-25">
        <T x={34} y={60} anchor="end" size={12} weight={700}>A</T>
      </g>
    </g>
    <g className="mv-lg-in-30" style={move(0, -24)}>
      <rect x="60" y="72" width="240" height="24" fill="var(--color-paper)" strokeWidth="1.5" />
      <path d="M60 82H300" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.6" />
    </g>
    <g className="mv-lg-in-45" style={move(0, 20)}>
      <Level x={120} y={102} w={120} bubbleCls="mv-lg-bub-c" />
    </g>
    {[78, 158, 238].map((x, i) => (
      <Screw key={x} x={x} y={89} cls={`mv-lg-pop-${60 + i * 5}`} />
    ))}
    <g className="mv-lg-pop-75">
      <T x={180} y={140} size={10} weight={600}>a screw into every stud</T>
    </g>
    {/* the same from the side */}
    <rect x="262" y="118" width="76" height="58" rx="2" fill="var(--color-paper)" strokeWidth="0.9" strokeOpacity="0.5" />
    <rect x="318" y="122" width="14" height="50" fill="var(--color-mount)" strokeWidth="1" />
    <polygon points="300,168 318,168 318,150 300,132" fill="var(--color-paper)" strokeWidth="1.3" />
    <g className={accent}>
      <path d="M300 132L318 150" strokeWidth="2.2" />
      <T x={270} y={140} anchor="start" size={9} weight={600}>slope</T>
      <T x={270} y={150} anchor="start" size={9} weight={600}>up</T>
    </g>
  </>
);

const LiftOn: Scene = ({ u }) => (
  <>
    <CleatWall u={u} />
    <g className="mv-lg-lift">
      <Cabinet />
      <g className={accent}>
        <path d="M246 86L268 108" strokeWidth="2.4" />
      </g>
    </g>
    <g className={accent}>
      <g className="mv-lg-win-a mv-hidden">
        <path d="M90 120V84M84 92l6-8 6 8" strokeWidth="2" />
        <T x={90} y={136} size={10} weight={600}>lift</T>
      </g>
      <g className="mv-lg-win-b mv-hidden">
        <path d="M90 80v36M84 108l6 8 6-8" strokeWidth="2" />
        <T x={90} y={132} size={10} weight={600}>lower</T>
      </g>
      <g className="mv-lg-pop-50">
        <path d="M200 140h40M233 134l7 6-7 6" strokeWidth="2" />
        <T x={196} y={143} anchor="end" size={10} weight={600}>tight</T>
      </g>
    </g>
    <g className="mv-lg-pop-65">
      <T x={20} y={188} anchor="start" size={10}>then slide it sideways to line it up</T>
    </g>
  </>
);

export const SCENES: Record<string, Scene[]> = {
  'hang-heavy-things-on-a-wall': [Knock, FindStuds, MarkLevel, Drill, Fixings, HangCheck],
  'french-cleat': [CleatWorks, CutStrip, OnCabinet, WallHalf, LiftOn],
};

/* The drawing for one step: its own patterns (so two drawings on a page never share ids) and the scene. */
export default function GuideDrawing({ slug, step }: { slug: string; step: number }) {
  const uid = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const u: U = (name) => `url(#${uid}-${name})`;
  const Scene = SCENES[slug]?.[step];
  return (
    <svg viewBox="0 0 360 220" className="block h-full w-full font-mono" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--color-mount)" stroke="none" />
          <path d="M0 0V6" strokeWidth="0.9" strokeOpacity="0.5" />
        </pattern>
        <pattern id={`${uid}-brick`} width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="var(--color-mount)" stroke="none" />
          <path d="M0 12H24M0 24H24M12 0V12M0 12V24M24 12V24" strokeWidth="1" strokeOpacity="0.55" />
        </pattern>
        <pattern id={`${uid}-zone`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <path d="M0 0V7" strokeWidth="1.4" strokeOpacity="0.28" />
        </pattern>
      </defs>
      {Scene ? <Scene u={u} /> : null}
    </svg>
  );
}

export const sceneCount = (slug: string) => SCENES[slug]?.length ?? 0;
