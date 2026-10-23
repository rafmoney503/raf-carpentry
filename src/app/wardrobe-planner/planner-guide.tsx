'use client';
import { useEffect, useRef } from 'react';
import { graphPaper, hatch } from '../how-it-works/sketches';

/* Quick guide for the wardrobe planner (16 Oct 2026, Raf: 'create simple visual guide for wardrobe planner next to
   planner for user to learn before start designing'). On the first visit it covers the steps panel, beside the 3D
   view (on phones and tablets, under 900 px, the 3D view too, so it can be read); Guide in the header brings it back.
   Five line drawings in the site's sketch style, one per step, then four tips for the 3D view.
   The drawings are decorative (the words say the same), so screen readers skip them. */

const A = 'wpg-a';
const label = {
  stroke: 'none',
  fill: 'currentColor',
  fontSize: 7,
  fontWeight: 600,
} as const;
// A label over a dimension line: a paper-coloured outline cuts the line behind it, as on a drawing.
const knock = { stroke: 'var(--color-paper)', strokeWidth: 3, paintOrder: 'stroke' } as const;

/* Each drawing moves (16 Oct 2026, Raf: 'instead of pictures put some movable gifs'): CSS animations in planner.css
   (.ga-*), only for people who haven't asked their phone or computer for less motion. Without the animation each
   drawing shows its finished state, so nothing is lost. */

function Space() {
  return (
    <>
      {/* a wall between two side walls: the wardrobe on its plinth, top infill to the ceiling; a tape measures the
          width wall to wall, then the height floor to ceiling */}
      <path d="M4 10h98M4 68h98" strokeWidth="1" />
      <path d={hatch(6, 14, 10, 68, 5) + hatch(92, 100, 10, 68, 5)} strokeWidth="0.7" />
      <path d="M14 10v58M92 10v58" />
      <rect x="17" y="16" width="72" height="46" />
      <path d="M17 10v6M89 10v6M41 16v46M65 16v46" strokeWidth="1" />
      <path d="M19 62v6M87 62v6" strokeWidth="1" />
      <path d="M37 39v8M45 39v8M61 39v8M69 39v8" strokeWidth="1.3" />
      <g className={A}>
        <path className="ga-wblade" d="M14 74H92" pathLength={1} strokeWidth="1.2" />
        <path className="ga-wmark" d="M14 71v6M92 71v6" strokeWidth="1.2" />
        <text className="ga-wmark" x="53" y="76.5" textAnchor="middle" {...label} {...knock}>
          W
        </text>
        <path className="ga-hblade" d="M108.5 68V10" pathLength={1} strokeWidth="1.2" />
        <path className="ga-hmark" d="M105 10h7M105 68h7" strokeWidth="1.2" />
        <text className="ga-hmark" x="108.5" y="41.5" textAnchor="middle" {...label} {...knock}>
          H
        </text>
      </g>
      <g className="ga-wcase">
        <rect x="14" y="70" width="8" height="8" rx="1.6" fill="var(--color-mount)" strokeWidth="1.1" />
        <circle cx="18" cy="74" r="1.6" strokeWidth="0.9" />
      </g>
      <g className="ga-hcase">
        <rect x="104.5" y="60" width="8" height="8" rx="1.6" fill="var(--color-mount)" strokeWidth="1.1" />
        <circle cx="108.5" cy="64" r="1.6" strokeWidth="0.9" />
      </g>
    </>
  );
}

const UNITS = [
  { x: 7.5, w: 41, mid: 28, size: '900' },
  { x: 43.5, w: 33, mid: 60, size: '600' },
  { x: 71.5, w: 41, mid: 92, size: '900' },
];

function Units() {
  return (
    <>
      {/* three units: long hanging, shelves, a rail over drawers; a tap picks each in turn, as in the planner */}
      <path d="M4 66h112" strokeWidth="1" />
      <rect x="10" y="10" width="100" height="52" />
      <path d="M46 10v52M74 10v52M12 62v4M108 62v4" strokeWidth="1.2" />
      <path d="M13 17h30M77 17h30" strokeWidth="1.2" />
      <path d="M19 17v2.5M15 23.5l4-4 4 4M28 17v2.5M24 23.5l4-4 4 4M37 17v2.5M33 23.5l4-4 4 4" strokeWidth="1" />
      <path d="M15 23.5v30h8v-30M24 23.5v25h8v-25M33 23.5v32h8v-32" strokeWidth="1" />
      <path d="M46 23h28M46 35h28M46 47h28" strokeWidth="1" />
      <path d="M50 23v-4.5h10V23M51 18.5v-4h8v4M62 35v-5h9v5M50 47v-6h7v6M59 47v-4h10v4" strokeWidth="0.9" />
      <path d="M84 17v2.5M80 23.5l4-4 4 4M94 17v2.5M90 23.5l4-4 4 4" strokeWidth="1" />
      <path d="M80 23.5v15h8v-15M90 23.5v12h8v-12" strokeWidth="1" />
      <path d="M74 42h36M74 48.7h36M74 55.3h36" strokeWidth="1" />
      <path d="M89 45.3h6M89 52h6M89 58.7h6" strokeWidth="1.3" />
      <g className={A}>
        <path d="M10 70.5h100M10 68.5v4M46 68.5v4M74 68.5v4M110 68.5v4" strokeWidth="1" />
        {UNITS.map((u, i) => (
          <g key={i}>
            <rect className={`ga-usel ga-u${i + 1}`} x={u.x} y="7" width={u.w} height="57.5" strokeWidth="1.1" strokeDasharray="3 2" />
            <circle className={`ga-utap ga-u${i + 1}`} cx={u.mid} cy="36" r="5" fill="currentColor" fillOpacity="0.18" strokeWidth="1" />
            <text className={`ga-ulab ga-u${i + 1}`} x={u.mid} y="78.5" textAnchor="middle" {...label}>
              {u.size}
            </text>
          </g>
        ))}
      </g>
    </>
  );
}

function Doors() {
  return (
    <>
      {/* a pair of flat doors under top cupboards; they swing open on their hinges to show the rail and shelves,
          then close; the dashed lines point to the hinges, as on a drawing */}
      <g transform="translate(0 5)">
        <path d="M14 66h92" strokeWidth="1" />
        <path d="M28 30h30M37 30v2.5M33.5 36l3.5-3.5 3.5 3.5M47 30v2.5M43.5 36l3.5-3.5 3.5 3.5" strokeWidth="1" />
        <path d="M33.5 36v20h7V36M43.5 36v16h7V36" strokeWidth="1" />
        <path d="M62 36h30M62 47h30M65 36v-4.5h9V36M78 47v-5h10v5M66 47v-3.5h8V47" strokeWidth="1" />
        <rect x="26" y="8" width="68" height="54" />
        <path d="M26 24h68M60 8v16M28 62v4M92 62v4" strokeWidth="1.2" />
        <g className="ga-door ga-door-l">
          <rect className="ga-face" x="26" y="24" width="34" height="38" fill="var(--color-mount)" vectorEffect="non-scaling-stroke" />
          <path d="M57 38v9" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        </g>
        <g className="ga-door ga-door-r">
          <rect className="ga-face" x="60" y="24" width="34" height="38" fill="var(--color-mount)" vectorEffect="non-scaling-stroke" />
          <path d="M63 38v9" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        </g>
        <g className={`${A} ga-swing`}>
          <path d="M60 24L26 43L60 62M60 24L94 43L60 62" strokeWidth="1" strokeDasharray="3 2" />
        </g>
      </g>
    </>
  );
}

const SWATCHES = ['#E6E0D3', '#8C9C82', '#A5A59D', '#34465E', '#3F5546'];

function Colour() {
  return (
    <g style={Object.fromEntries(SWATCHES.map((c, i) => [`--ga-c${i}`, c])) as React.CSSProperties}>
      {/* the wardrobe takes each colour as the chip under it is picked */}
      <path d="M18 58h84" strokeWidth="1" />
      <rect className="ga-body" x="30" y="6" width="60" height="48" fill={SWATCHES[1]} />
      <path d="M60 6v48M32 54v4M88 54v4" strokeWidth="1.2" />
      <path d="M57.5 26v8M62.5 26v8" strokeWidth="1.6" />
      {SWATCHES.map((c, i) => (
        <rect key={c} x={31 + i * 12} y="63" width="10" height="10" fill={c} strokeWidth="1" />
      ))}
      <g className={A}>
        <rect className="ga-pick" x="41" y="61" width="14" height="14" strokeWidth="1.2" />
      </g>
    </g>
  );
}

function Send() {
  return (
    <>
      {/* a phone: the details are typed, Send is pressed, the design flies off and a reply bubble comes back with a
          clock going round its 24 hours */}
      <rect x="14" y="6" width="34" height="68" rx="5" />
      <rect x="17.5" y="12" width="27" height="54" rx="1" strokeWidth="1" />
      <circle cx="31" cy="70" r="1.6" strokeWidth="1" />
      <rect x="21" y="16" width="19" height="21" strokeWidth="1" />
      <path d="M30.5 16v21M28 24v4M33 24v4" strokeWidth="0.9" />
      <path className="ga-type1" d="M21 43h19" pathLength={1} strokeWidth="1" />
      <path className="ga-type2" d="M21 48.5h19" pathLength={1} strokeWidth="1" />
      <g className="ga-bubble">
        <path d="M72 30h34a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H82l-6 5v-5h-4a3 3 0 0 1-3-3V33a3 3 0 0 1 3-3z" fill="var(--color-mount)" />
        <circle cx="83" cy="44" r="7.5" strokeWidth="1.1" />
        <path className="ga-hand" d="M83 39.5V44l3 2" strokeWidth="1.1" />
        <text x="99" y="46.5" textAnchor="middle" {...label} fontSize="7.5">
          24h
        </text>
      </g>
      <g className={A}>
        <rect className="ga-press" x="21" y="55" width="19" height="6" fill="currentColor" stroke="none" />
        <path className="ga-arrow" d="M52 40c5-9 10-12 15-12" pathLength={1} strokeWidth="1.2" />
        <path className="ga-head" d="M63.5 25l3.8 3-3.4 3.5" strokeWidth="1.2" />
      </g>
    </>
  );
}

const STEPS = [
  {
    title: 'Space',
    Drawing: Space,
    text: "Measure your wall from side to side and from the floor to the ceiling. Say if there's a wall at each end, or if it stands on its own.",
  },
  {
    title: 'Units',
    Drawing: Units,
    text: 'Standard widths, your own sizes, or an equal split that fills the wall. Then choose what goes inside each one: hanging, shelves or drawers.',
  },
  {
    title: 'Doors',
    Drawing: Doors,
    text: "Hinged or sliding, flat, shaker or mirror, and the handles you like. Add top cupboards if there's room above.",
  },
  {
    title: 'Colour',
    Drawing: Colour,
    text: 'See it in your colour. I build it in MDF, ready for your decorator to paint.',
  },
  {
    title: 'Send',
    Drawing: Send,
    text: 'Add your name and a mobile or email, then press Send to Raf. I reply within 24 hours.',
  },
];

/* Small icons for the 3D view tips, 24 x 24. */
const TIPS: { text: string; icon: React.ReactNode }[] = [
  {
    text: 'Drag to turn it. Pinch or scroll to zoom.',
    icon: (
      <>
        <rect x="8" y="3" width="8" height="12" />
        <path d="M12 3v12" strokeWidth="1.1" />
        <path className={A} d="M4 17.5c4.5 3.5 11.5 3.5 16 0M5.1 20.3L4 17.5l3 .4M17 17.9l3-.4-1.1 2.8" strokeWidth="1.3" />
      </>
    ),
  },
  {
    text: 'Tap a door to open it.',
    icon: (
      <>
        <rect x="6" y="3" width="12" height="18" />
        <path d="M6 3l7 3v16.5L6 21z" fill="var(--color-mount)" />
        <circle className={A} cx="11.2" cy="13" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    text: 'Tap a unit to change its size and inside.',
    icon: (
      <>
        <path d="M3 6h18v13H3zM9 6v13M15 6v13" />
        <rect className={A} x="7.5" y="4" width="9" height="17" strokeDasharray="2 1.5" strokeWidth="1.2" />
      </>
    ),
  },
  {
    text: 'Drawing shows every size.',
    icon: (
      <>
        <path d="M4 18h16" />
        <path className={A} d="M3 7v8M21 7v8M3 11h18M6.5 8.5L3 11l3.5 2.5M17.5 8.5L21 11l-3.5 2.5" strokeWidth="1.2" />
      </>
    ),
  },
];

export function GuideIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4" />
      <circle cx="8" cy="11.6" r="0.4" fill="currentColor" />
    </svg>
  );
}

/* Two PAX frames with a code tag (the link to the IKEA PAX sheet), and the arrow beside it. */
export function PaxIcon() {
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true">
      <rect x="2.5" y="4.5" width="9" height="17" />
      <rect x="11.5" y="4.5" width="9" height="17" />
      <path d="M9.5 12v3M13.5 12v3" />
      <path d="M16.5 2.5h7v5h-7z" fill="var(--color-mount)" />
      <path d="M18 5h4" />
    </svg>
  );
}

export function Chevron() {
  return (
    <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function PlannerGuide({ open, first, onClose, onPax }: { open: boolean; first: boolean; onClose: () => void; onPax: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Opened from the Guide button: start at the top and move focus to the title, so a keyboard or screen reader
  // user lands in it. On the first visit nothing is focused (the page has only just opened).
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo(0, 0);
    if (!first) titleRef.current?.focus({ preventScroll: true });
  }, [open, first]);

  return (
    <section
      id="wp-guide"
      className="guide"
      hidden={!open}
      aria-labelledby="wp-guide-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="guide-scroll" ref={scrollRef}>
        <div>
          <p className="guide-kicker">Quick guide</p>
          <h2 id="wp-guide-title" ref={titleRef} tabIndex={-1}>
            Five steps to your wardrobe
          </h2>
          <p className="lede">Rough sizes are fine: I measure properly on the free visit, and nothing is cut until you sign off the 3D drawing.</p>
          {/* Someone who has already designed it in IKEA's PAX planner doesn't need the steps (pax-send.tsx) */}
          <button type="button" className="paxlink guide-pax" onClick={onPax}>
            <PaxIcon />
            <span>
              <b>Got an IKEA PAX design?</b>
              <small>Skip the steps: send me the design code and I&rsquo;ll build it in</small>
            </span>
            <Chevron />
          </button>
        </div>

        <ol className="guide-steps">
          {STEPS.map(({ title, text, Drawing }, i) => (
            <li key={title} className="guide-step">
              <div className="guide-pic" style={graphPaper} aria-hidden="true">
                <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Drawing />
                </svg>
              </div>
              <div>
                <h3>
                  <i>{i + 1}</i>
                  {title}
                </h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="grp">
          <h3>In the 3D view</h3>
          <ul className="guide-tips">
            {TIPS.map(({ text, icon }) => (
              <li key={text}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {icon}
                </svg>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="foot">
        <button type="button" className="wbtn primary wide" onClick={onClose}>
          {first ? 'Start designing' : 'Back to my design'}
        </button>
      </div>
    </section>
  );
}
