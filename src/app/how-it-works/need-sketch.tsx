/* Small line drawings for "What I need from you", drawn like the rest of the site: pencil ink
   with the one blueprint-blue accent, on a square of graph paper. They are decorative (the text
   says the same thing), so screen readers skip them. Which drawing goes with which item is the
   "sketch" field in content/pages/how-it-works.json (a dropdown in TinaCMS). */

export const SKETCHES = ['photos', 'sizes', 'uses', 'look', 'details', 'budget'] as const;
export type SketchName = (typeof SKETCHES)[number];

const accent = 'text-accent';
const label = { stroke: 'none', fill: 'currentColor', fontSize: 7.5, fontWeight: 600 } as const;

function Photos() {
  return (
    <>
      {/* phone, with the wall on its screen: radiator, socket and floor */}
      <rect x="25" y="9" width="30" height="62" rx="5" />
      <rect x="28.5" y="15" width="23" height="46" rx="1" strokeWidth="1" />
      <path d="M28.5 53h23" strokeWidth="1" />
      <rect x="31" y="43" width="11" height="7.5" rx="0.6" strokeWidth="1.1" />
      <path d="M33.7 43v7.5M36.5 43v7.5M39.3 43v7.5" strokeWidth="0.9" />
      <rect x="45" y="45.5" width="4.2" height="4.2" rx="0.6" strokeWidth="1.1" />
      <rect x="34" y="23" width="12" height="11" rx="0.6" strokeWidth="1.1" />
      <path d="M40 23v11M34 28.5h12" strokeWidth="0.9" />
      <circle cx="40" cy="66" r="2" />
      <g className={accent}>
        <path d="M30.5 20.5v-3h3M46.5 17.5h3v3M30.5 55.5v3h3M46.5 58.5h3v-3" />
      </g>
    </>
  );
}

function Sizes() {
  return (
    <>
      {/* a unit drawn as a box, with width and height dimension lines */}
      <rect x="20" y="20" width="38" height="46" rx="0.6" />
      <path d="M58 20l8-7v46l-8 7M20 20l8-7h38" />
      <path d="M20 36h38M20 51h38" strokeWidth="1" />
      <g className={accent}>
        <path d="M20 70v6M58 70v6M20 73h14M44 73h14" strokeWidth="1.2" />
        <path d="M9 20h6M9 66h6M12 20v17M12 49v17" strokeWidth="1.2" />
        <text x="39" y="75.6" textAnchor="middle" {...label}>W</text>
        <text x="12" y="45.6" textAnchor="middle" {...label}>H</text>
      </g>
    </>
  );
}

function Uses() {
  return (
    <>
      {/* open wardrobe: coats on a rail, folded clothes, books and shoes */}
      <rect x="16" y="12" width="48" height="56" rx="1" />
      <path d="M16 63h48M40 12v51" />
      <path d="M40 27h24M40 43h24" strokeWidth="1.2" />
      <path d="M23.5 21v2.5M19.5 27.5l4-4 4 4M32 21v2.5M28.5 27.5l3.5-4 3.5 4" strokeWidth="1.1" />
      <rect x="19.5" y="27.5" width="8" height="27" rx="1" strokeWidth="1.1" />
      <rect x="28.5" y="27.5" width="7" height="19" rx="1" strokeWidth="1.1" />
      <rect x="44" y="22.5" width="11" height="4.5" rx="0.6" strokeWidth="1.1" />
      <rect x="45" y="18" width="9" height="4.5" rx="0.6" strokeWidth="1.1" />
      <path d="M44 43V32M47.5 43V30M51 43V33.5M55.5 43l3-10" strokeWidth="1.6" />
      <path d="M43 60.5v-3.8h3l2 2h4.6a1.6 1.6 0 0 1 1.6 1.6v.2zM53.5 60.5v-3.8h3l2 2h2.8" strokeWidth="1.1" />
      <g className={accent}>
        <path d="M19 21h18" />
      </g>
    </>
  );
}

function Look() {
  return (
    <>
      {/* two pinned pictures, an alcove unit and a wardrobe, and a heart */}
      <g transform="rotate(-7 30 40)">
        <rect x="13" y="20" width="32" height="38" rx="1" />
        <rect x="16" y="23" width="26" height="25" strokeWidth="1" />
        <path d="M21 48V34a8 8 0 0 1 16 0v14M21 39h16M21 43.5h16" strokeWidth="1.1" />
      </g>
      <g transform="rotate(6 52 44)">
        <rect x="35" y="23" width="32" height="40" rx="1" fill="var(--color-paper)" />
        <rect x="38" y="26" width="26" height="27" strokeWidth="1" />
        <rect x="44" y="29.5" width="14" height="21" strokeWidth="1.1" />
        <path d="M51 29.5v21" strokeWidth="1.1" />
        <circle cx="49.6" cy="40" r="0.6" strokeWidth="1" />
        <circle cx="52.4" cy="40" r="0.6" strokeWidth="1" />
      </g>
      <g className={accent}>
        <path d="M63 21.5l-5.2-4.8a3.1 3.1 0 0 1 5.2-3.3 3.1 3.1 0 0 1 5.2 3.3z" fill="currentColor" fillOpacity="0.14" />
      </g>
    </>
  );
}

function Details() {
  return (
    <>
      {/* a house with its door and windows, and a parking sign */}
      <path d="M8 66h64" />
      <path d="M12 66V37l17-14 17 14v29" />
      <path d="M24 66V54a5 5 0 0 1 10 0v12" strokeWidth="1.2" />
      <rect x="16" y="40" width="7" height="7" rx="0.5" strokeWidth="1.1" />
      <rect x="35" y="40" width="7" height="7" rx="0.5" strokeWidth="1.1" />
      <circle cx="31.6" cy="60" r="0.6" strokeWidth="1" />
      <path d="M61 66V40" />
      <g className={accent}>
        <rect x="53" y="24" width="16" height="16" rx="2" />
        <text x="61" y="35.6" textAnchor="middle" {...label} fontSize="11">P</text>
      </g>
    </>
  );
}

function Budget() {
  return (
    <>
      {/* a calendar with one day ringed, and a pound coin */}
      <rect x="11" y="17" width="42" height="42" rx="2" />
      <path d="M11 27h42M22 13v8M42 13v8" />
      {[18, 25, 32, 39, 46].map((x) =>
        [35, 42, 49].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" stroke="none" />),
      )}
      <g className={accent}>
        <circle cx="39" cy="42" r="4.6" />
      </g>
      <circle cx="57" cy="58" r="12" fill="var(--color-paper)" />
      <circle cx="57" cy="58" r="9" strokeWidth="1" />
      <text x="57" y="62.2" textAnchor="middle" {...label} fontSize="12">£</text>
    </>
  );
}

const DRAWINGS: Record<SketchName, () => React.JSX.Element> = {
  photos: Photos,
  sizes: Sizes,
  uses: Uses,
  look: Look,
  details: Details,
  budget: Budget,
};

export function isSketch(name: string | undefined): name is SketchName {
  return Boolean(name && (SKETCHES as readonly string[]).includes(name));
}

/* Graph-paper square: faint 8 px grid lines. */
const paper: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgb(37 71 208 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(37 71 208 / 0.07) 1px, transparent 1px)',
  backgroundSize: '8px 8px',
  backgroundPosition: '-1px -1px',
};

export default function NeedSketch({ name, number }: { name?: string; number: string }) {
  const Drawing = isSketch(name) ? DRAWINGS[name] : null;
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-line bg-paper text-ink" style={paper} aria-hidden="true">
      {Drawing ? (
        <svg viewBox="0 0 80 80" className="h-full w-full font-mono" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <Drawing />
        </svg>
      ) : (
        <span className="absolute inset-0 grid place-items-center font-mono text-[18px] text-accent">{number}</span>
      )}
    </div>
  );
}
