/* A dovetail joint along the edge of a grey (raised) section, in place of a straight border line,
   so the sections of a page look joined like boards. The tails belong to the grey section and reach
   14 px into the section next to it; as the edge scrolls up the screen they slide the last 7 px home
   (woodwork.css, scroll-driven, so it follows the finger and costs no script).
   Put it as the first child of a `relative` section and drop that section's border on the same edge:
   <section className="relative bg-raised"><Joint /> ... <Joint edge="bottom" /></section> */

const TILE = 64; // one tail and one socket
const N = 70; // 4,480 px: wider than any screen; centred, so both ends of the joint match
const W = TILE * N;

let line = 'M0 14.5';
for (let i = 0; i < N; i++) {
  const x = i * TILE;
  // tail: 24 px wide at the root, 36 px at the tip, 14 px deep (steeper than a real 1:6 so it reads at this size)
  line += `H${x + 20}L${x + 14} 0.5H${x + 50}L${x + 44} 14.5`;
}
line += `H${W}`;
const fill = `${line}V16H0Z`;

export default function Joint({ edge = 'top' }: { edge?: 'top' | 'bottom' }) {
  return (
    <div className={`joint joint-${edge}`} aria-hidden="true">
      <svg width={W} height="16" viewBox={`0 0 ${W} 16`} focusable="false">
        <path className="joint-fill" d={fill} />
        <path className="joint-line" d={line} />
      </svg>
    </div>
  );
}
