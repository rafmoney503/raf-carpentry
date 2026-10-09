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
        <path d="M33 43.5l22-2.5" strokeWidth="1.3" />
        <text x="53" y="55" textAnchor="end" {...txt} fontWeight="500">2064</text>
        <path d="M22 61c2-1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" strokeWidth="1" />
      </g>
      <g transform="rotate(-38 60 62)">
        <rect x="44" y="59" width="26" height="5.5" rx="0.6" className={solid} />
        <path d="M70 59l6 2.75-6 2.75M48.5 59v5.5" strokeWidth="1.1" />
      </g>
    </>
  );
}

function BoardWithout() {
  return (
    <>
      {/* a full board with a few parts dotted about and big offcuts (hatched) left over */}
      <rect x="8" y="22" width="64" height="34" />
      <path d={hatch(8, 72, 22, 56, 4.5)} strokeWidth="0.7" />
      <rect x="10.5" y="24.5" width="21" height="13" className={solid} strokeWidth="1.2" />
      <rect x="35" y="24.5" width="11" height="18" className={solid} strokeWidth="1.2" />
      <rect x="10.5" y="41" width="13" height="12.5" className={solid} strokeWidth="1.2" />
      <rect x="51" y="30" width="15" height="11" className={solid} strokeWidth="1.2" />
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
      <path d="M31.5 66.5l17-5" strokeWidth="1.3" />
      <g transform="rotate(-6 46 75)">
        <text x="46" y="76.5" textAnchor="middle" {...txt} fontWeight="500">598?</text>
      </g>
    </>
  );
}

function SheetWithout() {
  return (
    <>
      {/* a handwritten cut sheet: folded corner, scrawl, and a mug ring */}
      <g transform="rotate(6 40 40)">
        <path d="M17 10h36l9 9v51H17z" className={solid} />
        <path d="M53 10v9h9" strokeWidth="1.1" />
        <path
          d="M22 22c2-1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0M22 31c2-1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4 1.6 6 0M22 40c2-1.6 4 1.6 6 0s4-1.6 6 0M22 49c2-1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0 4 1.6 6 0M22 58c2-1.6 4 1.6 6 0s4-1.6 6 0"
          strokeWidth="1"
        />
        <circle cx="48" cy="52" r="8.5" strokeWidth="1" strokeDasharray="10 2.5 6 3" />
      </g>
    </>
  );
}

/* ---------- With ---------- */

function SumsWith() {
  return (
    <>
      {/* a neat parts list, done (tick) */}
      <rect x="13" y="15" width="46" height="55" rx="1" className={solid} />
      <rect x="13" y="15" width="46" height="9" className={accent} fill="currentColor" fillOpacity="0.16" stroke="none" />
      <path d="M13 24h46M13 33h46M13 42h46M13 51h46M13 60h46" strokeWidth="0.8" />
      <path d="M24 24v46M44 24v46" strokeWidth="0.8" />
      <path d="M16 28.5h5M27 28.5h12M47 28.5h7M16 37.5h5M27 37.5h9M47 37.5h7M16 46.5h5M27 46.5h13M47 46.5h7M16 55.5h5M27 55.5h10M47 55.5h7M16 64.5h5M27 64.5h12M47 64.5h7" strokeWidth="1.1" />
      <g className={accent}>
        <circle cx="60" cy="16" r="8.5" className={solid} />
        <path d="M55.8 16.2l2.9 2.9 5.6-5.8" strokeWidth="1.8" />
      </g>
    </>
  );
}

function BoardWith() {
  return (
    <>
      {/* the same board with the parts packed tight, a thin offcut left, and its 2440 length */}
      <rect x="8" y="24" width="64" height="34" />
      <path d={hatch(66, 72, 24, 58, 4)} strokeWidth="0.7" />
      <path d="M66 24v34" strokeWidth="1.2" />
      <rect x="8" y="24" width="30" height="17" className={solid} strokeWidth="1.2" />
      <rect x="8" y="41" width="30" height="17" className={solid} strokeWidth="1.2" />
      <rect x="38" y="24" width="28" height="19" className={solid} strokeWidth="1.2" />
      <rect x="38" y="43" width="14" height="15" className={solid} strokeWidth="1.2" />
      <rect x="52" y="43" width="14" height="15" className={solid} strokeWidth="1.2" />
      <g className={accent}>
        <path d="M8 13v7M72 13v7M8 16.5h20M52 16.5h20" strokeWidth="1.2" />
        <text x="40" y="19" textAnchor="middle" {...txt}>2440</text>
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
        <path d="M23 61v8M57 61v8M23 65h7M50 65h7M25 63.2l-2 1.8 2 1.8M55 63.2l2 1.8-2 1.8" strokeWidth="1.2" />
        <text x="40" y="67.6" textAnchor="middle" {...txt}>600</text>
        <circle cx="58" cy="13" r="8.5" className={solid} />
        <path d="M53.8 13.2l2.9 2.9 5.6-5.8" strokeWidth="1.8" />
      </g>
    </>
  );
}

function SheetWith() {
  return (
    <>
      {/* a printed cut sheet and a strip of part labels with barcodes */}
      <rect x="10" y="9" width="40" height="54" rx="0.6" className={solid} />
      <rect x="10" y="9" width="40" height="8" className={accent} fill="currentColor" fillOpacity="0.16" stroke="none" />
      <path d="M10 17h40M10 25h40M10 33h40M10 41h40M10 49h40M18 17v46" strokeWidth="0.8" />
      <path d="M21 21h14M21 29h18M21 37h12M21 45h16M21 53h13" strokeWidth="1.1" />
      <g>
        <rect x="42" y="45" width="30" height="13" rx="0.6" className={solid} />
        <rect x="42" y="60" width="30" height="13" rx="0.6" className={solid} />
        <path d="M54 48v7M56 48v7M57.5 48v7M60 48v7M62 48v7M63.5 48v7M66 48v7M68 48v7M54 63v7M55.5 63v7M58 63v7M60 63v7M61.5 63v7M64 63v7M66 63v7M68 63v7" strokeWidth="0.9" />
        <g className={accent}>
          <text x="47.5" y="54" textAnchor="middle" {...txt} fontSize="6.5">1A</text>
          <text x="47.5" y="69" textAnchor="middle" {...txt} fontSize="6.5">2C</text>
        </g>
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
      style={graphPaper}
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="h-full w-full font-mono" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <Drawing />
      </svg>
    </div>
  );
}
