/* Small line drawings for "What I need from you" and "What you get from me", drawn like the rest
   of the site: pencil ink with the one blueprint-blue accent, on a square of graph paper. They are
   decorative (the text says the same thing), so screen readers skip them. Which drawing goes with
   which item is the "sketch" field in content/pages/how-it-works.json (a dropdown in TinaCMS). */

export const SKETCHES = [
  // What I need from you
  'photos', 'sizes', 'uses', 'look', 'details', 'budget',
  // What you get from me
  'reply', 'visit', 'drawing', 'board', 'fitted',
] as const;
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

function Reply() {
  return (
    <>
      {/* a message bubble and a clock marked 24h */}
      <path d="M16 12h34a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H28l-9 8v-8h-3a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" />
      <path d="M18 23h28M18 30h22M18 37h13" strokeWidth="1.1" />
      <g className={accent}>
        <circle cx="57" cy="55" r="14" fill="var(--color-paper)" />
        <path d="M57 43v2.5M57 64.5V67M45 55h2.5M66.5 55H69" strokeWidth="1.2" />
        <text x="57" y="58" textAnchor="middle" {...label} fontSize="8.5">24h</text>
      </g>
    </>
  );
}

function Visit() {
  return (
    <>
      {/* the quote sheet, ticked, and a tape measure pulled out across it */}
      <rect x="34" y="9" width="31" height="40" rx="1" />
      <path d="M39 17h18M39 23h21M39 29h14" strokeWidth="1.1" />
      <rect x="11" y="39" width="26" height="26" rx="6" fill="var(--color-paper)" />
      <circle cx="24" cy="52" r="6" strokeWidth="1.2" />
      <circle cx="24" cy="52" r="1.3" strokeWidth="1" />
      <g className={accent}>
        <path d="M43 39.5l3.5 3.5 7-7" />
        <rect x="37" y="57" width="31" height="6" rx="0.5" fill="var(--color-paper)" strokeWidth="1.3" />
        <path d="M41 57v3M45 57v2M49 57v3M53 57v2M57 57v3M61 57v2M65 57v3" strokeWidth="1" />
        <path d="M68 54.5v11" strokeWidth="1.6" />
      </g>
    </>
  );
}

function Drawing3D() {
  return (
    <>
      {/* a 3D drawing of a wardrobe on a sheet, signed and ticked at the bottom */}
      <rect x="10" y="7" width="60" height="67" rx="1" />
      <path d="M40 13l16 8-16 8-16-8z" strokeWidth="1.3" />
      <path d="M24 21v24l16 8V29M56 21v24l-16 8" strokeWidth="1.3" />
      <path d="M32 25v24" strokeWidth="1" />
      <circle cx="30.4" cy="38" r="0.6" strokeWidth="1" />
      <circle cx="33.6" cy="39.6" r="0.6" strokeWidth="1" />
      <path d="M16 67h26" strokeWidth="1" />
      <g className={accent}>
        <path d="M18 64c2.5-5 4.5 2.5 7-1s3.5 2.5 6.5-.5 3 1.5 5 0" strokeWidth="1.3" />
        <path d="M50 63.5l3.5 3.5 7-7" />
      </g>
    </>
  );
}

/* The cut edge of the board, hatched like a section on a drawing. */
function hatch(x0: number, x1: number, y0: number, y1: number, step: number) {
  const h = y1 - y0;
  const out: string[] = [];
  for (let x = x0 - h + step; x < x1; x += step) {
    const sx = Math.max(x, x0);
    const sy = y1 - (sx - x);
    const ex = Math.min(x + h, x1);
    const ey = y1 - (ex - x);
    out.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
  }
  return out.join('');
}

function Board() {
  return (
    <>
      {/* a thick board with its cut edge hatched and an 18 mm dimension */}
      <path d="M22 44h40l12-14H34z" />
      <rect x="22" y="44" width="40" height="12" />
      <path d="M62 56l12-14V30" />
      <path d={hatch(22, 62, 44, 56, 4.5)} strokeWidth="0.8" />
      <g className={accent}>
        <path d="M11 44h8M11 56h8" strokeWidth="1" />
        <path d="M15 44v12M13.2 46l1.8-2 1.8 2M13.2 54l1.8 2 1.8-2" strokeWidth="1.2" />
        <text x="15" y="66" textAnchor="middle" {...label} fontSize="8">18</text>
        <text x="15" y="73.5" textAnchor="middle" {...label} fontSize="7" fontWeight="500">mm</text>
      </g>
    </>
  );
}

function Fitted() {
  return (
    <>
      {/* a wardrobe between floor and ceiling, its side scribed to a wall that is not straight */}
      <path d="M8 10h64M8 70h64" />
      <path d="M13 10c3 8-2 14 1 22s-3 16 0 22 2 10 0 16" strokeWidth="1.2" />
      <path d="M17.2 13H62v57M17.4 66H62" />
      <path d="M40 13v53" strokeWidth="1.1" />
      <circle cx="37.5" cy="40" r="0.8" strokeWidth="1.1" />
      <circle cx="42.5" cy="40" r="0.8" strokeWidth="1.1" />
      <g className={accent}>
        <path d="M16.3 13c2.4 5.6-1.6 12.5 1.2 19s-3 16 0 22 2 10 0 16" />
        {/* room left clean */}
        <path d="M71 48.5c0 4.2 1.8 6 6 6-4.2 0-6 1.8-6 6 0-4.2-1.8-6-6-6 4.2 0 6-1.8 6-6z" strokeWidth="1.1" fill="currentColor" fillOpacity="0.14" />
      </g>
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
  reply: Reply,
  visit: Visit,
  drawing: Drawing3D,
  board: Board,
  fitted: Fitted,
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

/* `fallback` shows in the square when an item has no drawing chosen (the number, or a tick). */
export default function Sketch({ name, fallback }: { name?: string; fallback: React.ReactNode }) {
  const Drawing = isSketch(name) ? DRAWINGS[name] : null;
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-line bg-paper text-ink" style={paper} aria-hidden="true">
      {Drawing ? (
        <svg viewBox="0 0 80 80" className="h-full w-full font-mono" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <Drawing />
        </svg>
      ) : (
        <span className="absolute inset-0 grid place-items-center font-mono text-[18px] text-accent">{fallback}</span>
      )}
    </div>
  );
}
