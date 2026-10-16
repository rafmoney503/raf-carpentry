import { graphPaper, hatch } from '@/app/how-it-works/sketches';

/* Line drawings for the "Without / With" comparison on the CabinetOS page, in pairs: the pencil-and-paper way
   (in pencil grey, a bit rough) and the app way (crisp, with the blue accent). Same graph-paper square as the
   drawings on Plan your project. Decorative: the text beside each says the same thing. */

export const COMPARE_SKETCHES = ['sums', 'board', 'size', 'sheet'] as const;
export type CompareSketchName = (typeof COMPARE_SKETCHES)[number];

const accent = 'text-accent';
const txt = { stroke: 'none', fill: 'currentColor', fontSize: 7.5, fontWeight: 600 } as const;
/* Parts and labels are filled with the paper colour so the hatching and grid stop at their edges. */
const solid = 'fill-paper';

/* They move (16 Oct 2026, Raf: 'all static designs on website to make it more interactive'; src/app/motion.css):
   the old way is fiddly (a sum crossed out and done again, parts dotted about and the waste hatched in, a size
   crossed out, a scrawled sheet and a mug ring), the app way is quick and neat (the list fills, the parts drop
   into place, the size goes on clean, the labels come out). `o(s)` starts a part s seconds later. */
const o = (s: number) => ({ '--mv-o': `${s}s` }) as React.CSSProperties;

/* ---------- Without ---------- */

function SumsWithout() {
  return (
    <>
      {/* a notepad of sums, one crossed out and done again, and the pencil */}
      <g transform="rotate(-5 40 40)">
        <rect x="16" y="10" width="44" height="58" rx="1" className={solid} />
        <path d="M23 10V6.5M31 10V6.5M39 10V6.5M47 10V6.5M55 10V6.5" strokeWidth="1.2" />
        <text x="53" y="24" textAnchor="end" {...txt} fontWeight="500">2100</text>
        <text x="53" y="33" textAnchor="end" {...txt} fontWeight="500">- 36</text>
        <path d="M30 36.5h25" strokeWidth="1" />
        <text x="53" y="45.5" textAnchor="end" {...txt} fontWeight="500">2046</text>
        <path className="mv-draw" style={o(0.3)} pathLength={1} d="M33 43.5l22-2.5" strokeWidth="1.3" />
        <text className="mv-pop" style={o(0.9)} x="53" y="55" textAnchor="end" {...txt} fontWeight="500">2064</text>
        <path className="mv-draw" style={o(1.2)} pathLength={1} d="M22 61c2-1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" strokeWidth="1" />
      </g>
      <g className="mv-wiggle" style={o(0.3)}>
        <g transform="rotate(-38 60 62)">
          <rect x="44" y="59" width="26" height="5.5" rx="0.6" className={solid} />
          <path d="M70 59l6 2.75-6 2.75M48.5 59v5.5" strokeWidth="1.1" />
        </g>
      </g>
    </>
  );
}

function BoardWithout() {
  return (
    <>
      {/* a full board with a few parts dotted about, then the big offcuts (hatched) left over */}
      <rect x="8" y="22" width="64" height="34" />
      <path className="mv-draw" style={o(1.1)} pathLength={1} d={hatch(8, 72, 22, 56, 4.5)} strokeWidth="0.7" />
      <rect className={`${solid} mv-pop`} x="10.5" y="24.5" width="21" height="13" strokeWidth="1.2" />
      <rect className={`${solid} mv-pop`} style={o(0.25)} x="35" y="24.5" width="11" height="18" strokeWidth="1.2" />
      <rect className={`${solid} mv-pop`} style={o(0.5)} x="10.5" y="41" width="13" height="12.5" strokeWidth="1.2" />
      <rect className={`${solid} mv-pop`} style={o(0.75)} x="51" y="30" width="15" height="11" strokeWidth="1.2" />
    </>
  );
}

function SizeWithout() {
  return (
    <>
      {/* a cabinet whose size was worked out twice: 600 crossed out, 598? written under it */}
      <rect x="23" y="10" width="34" height="44" />
      <path d="M23 32h34" strokeWidth="1" />
      <path d="M23 59v8M57 59v8M23 63h7M50 63h7" strokeWidth="1.1" />
      <text x="40" y="65.6" textAnchor="middle" {...txt}>600</text>
      <path className="mv-draw" style={o(0.2)} pathLength={1} d="M31.5 66.5l17-5" strokeWidth="1.3" />
      <g transform="rotate(-6 46 75)">
        <text className="mv-pop" style={o(0.9)} x="46" y="76.5" textAnchor="middle" {...txt} fontWeight="500">598?</text>
      </g>
    </>
  );
}

const SCRAWL = [
  'M22 22c2-1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0',
  'M22 31c2-1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4 1.6 6 0',
  'M22 40c2-1.6 4 1.6 6 0s4-1.6 6 0',
  'M22 49c2-1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4 1.6 6 0',
  'M22 58c2-1.6 4 1.6 6 0s4-1.6 6 0',
];

function SheetWithout() {
  return (
    <>
      {/* a handwritten cut sheet: folded corner, scrawl written line by line, and then a mug ring */}
      <g transform="rotate(6 40 40)">
        <path d="M17 10h36l9 9v51H17z" className={solid} />
        <path d="M53 10v9h9" strokeWidth="1.1" />
        {SCRAWL.map((d, i) => (
          <path key={i} className="mv-draw" style={o(i * 0.3)} pathLength={1} d={d} strokeWidth="1" />
        ))}
        <circle className="mv-pop" style={o(1.6)} cx="48" cy="52" r="8.5" strokeWidth="1" strokeDasharray="10 2.5 6 3" />
      </g>
    </>
  );
}

/* ---------- With ---------- */

const ROWS = [28.5, 37.5, 46.5, 55.5, 64.5];
const ROW_W = [12, 9, 13, 10, 12];

function SumsWith() {
  return (
    <>
      {/* a neat parts list fills in row by row, then it is done (tick) */}
      <rect x="13" y="15" width="46" height="55" rx="1" className={solid} />
      <rect x="13" y="15" width="46" height="9" className={accent} fill="currentColor" fillOpacity="0.16" stroke="none" />
      <path d="M13 24h46M13 33h46M13 42h46M13 51h46M13 60h46" strokeWidth="0.8" />
      <path d="M24 24v46M44 24v46" strokeWidth="0.8" />
      {ROWS.map((y, i) => (
        <path key={y} className="mv-draw" style={o(i * 0.18)} pathLength={1} d={`M16 ${y}h5M27 ${y}h${ROW_W[i]}M47 ${y}h7`} strokeWidth="1.1" />
      ))}
      <g className={`${accent} mv-pop`} style={o(1.2)}>
        <circle cx="60" cy="16" r="8.5" className={solid} />
        <path d="M55.8 16.2l2.9 2.9 5.6-5.8" strokeWidth="1.8" />
      </g>
    </>
  );
}

const PARTS: [number, number, number, number][] = [
  [8, 24, 30, 17],
  [8, 41, 30, 17],
  [38, 24, 28, 19],
  [38, 43, 14, 15],
  [52, 43, 14, 15],
];

function BoardWith() {
  return (
    <>
      {/* the same board: the parts drop in packed tight, a thin offcut left, then its 2440 length */}
      <rect x="8" y="24" width="64" height="34" />
      <path d={hatch(66, 72, 24, 58, 4)} strokeWidth="0.7" />
      <path d="M66 24v34" strokeWidth="1.2" />
      {PARTS.map(([x, y, w, h], i) => (
        <rect key={i} className={`${solid} mv-drop`} style={o(i * 0.15)} x={x} y={y} width={w} height={h} strokeWidth="1.2" />
      ))}
      <g className={accent}>
        <path d="M8 13v7M72 13v7" strokeWidth="1.2" />
        <path className="mv-draw" style={o(0.9)} pathLength={1} d="M28 16.5H8M52 16.5H72" strokeWidth="1.2" />
        <text className="mv-pop" style={o(1)} x="40" y="19" textAnchor="middle" {...txt}>2440</text>
      </g>
    </>
  );
}

function SizeWith() {
  return (
    <>
      {/* the same cabinet, sized once: 600 on a clean dimension line, ticked */}
      <rect x="23" y="12" width="34" height="44" />
      <path d="M23 34h34" strokeWidth="1" />
      <g className={accent}>
        <path d="M23 61v8M57 61v8" strokeWidth="1.2" />
        <path className="mv-draw" pathLength={1} d="M30 65H23M50 65H57" strokeWidth="1.2" />
        <path className="mv-pop" style={o(0.7)} d="M25 63.2l-2 1.8 2 1.8M55 63.2l2 1.8-2 1.8" strokeWidth="1.2" />
        <text className="mv-pop" style={o(0.8)} x="40" y="67.6" textAnchor="middle" {...txt}>600</text>
        <g className="mv-pop" style={o(1.2)}>
          <circle cx="58" cy="13" r="8.5" className={solid} />
          <path d="M53.8 13.2l2.9 2.9 5.6-5.8" strokeWidth="1.8" />
        </g>
      </g>
    </>
  );
}

const SHEET_ROWS = ['M21 21h14', 'M21 29h18', 'M21 37h12', 'M21 45h16', 'M21 53h13'];

function SheetWith() {
  return (
    <>
      {/* a printed cut sheet fills in, then a strip of part labels with barcodes comes out */}
      <rect x="10" y="9" width="40" height="54" rx="0.6" className={solid} />
      <rect x="10" y="9" width="40" height="8" className={accent} fill="currentColor" fillOpacity="0.16" stroke="none" />
      <path d="M10 17h40M10 25h40M10 33h40M10 41h40M10 49h40M18 17v46" strokeWidth="0.8" />
      {SHEET_ROWS.map((d, i) => (
        <path key={d} className="mv-draw" style={o(i * 0.15)} pathLength={1} d={d} strokeWidth="1.1" />
      ))}
      <g className="mv-in-right" style={o(0.9)}>
        <rect x="42" y="45" width="30" height="13" rx="0.6" className={solid} />
        <path d="M54 48v7M56 48v7M57.5 48v7M60 48v7M62 48v7M63.5 48v7M66 48v7M68 48v7" strokeWidth="0.9" />
        <text className={accent} x="47.5" y="54" textAnchor="middle" {...txt} fontSize="6.5">1A</text>
      </g>
      <g className="mv-in-right" style={o(1.15)}>
        <rect x="42" y="60" width="30" height="13" rx="0.6" className={solid} />
        <path d="M54 63v7M55.5 63v7M58 63v7M60 63v7M61.5 63v7M64 63v7M66 63v7M68 63v7" strokeWidth="0.9" />
        <text className={accent} x="47.5" y="69" textAnchor="middle" {...txt} fontSize="6.5">2C</text>
      </g>
    </>
  );
}

const DRAWINGS: Record<CompareSketchName, { without: () => React.JSX.Element; with: () => React.JSX.Element }> = {
  sums: { without: SumsWithout, with: SumsWith },
  board: { without: BoardWithout, with: BoardWith },
  size: { without: SizeWithout, with: SizeWith },
  sheet: { without: SheetWithout, with: SheetWith },
};

export default function CompareSketch({ name, side }: { name: CompareSketchName; side: 'without' | 'with' }) {
  const Drawing = DRAWINGS[name][side];
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-sm border bg-paper ${side === 'with' ? 'border-line-strong text-ink' : 'border-line text-faint'}`}
      style={{ ...graphPaper, '--mv-d': side === 'with' ? '1.2s' : '0s' } as React.CSSProperties}
      data-motion=""
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="h-full w-full font-mono" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <Drawing />
      </svg>
    </div>
  );
}
