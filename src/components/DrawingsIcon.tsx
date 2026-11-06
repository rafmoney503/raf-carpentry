/* The little picture for "Drawings and cut lists, done for you" (/drawings), drawn as an app icon so it sits well
   beside Build It in 3D's: a blueprint-blue tile with a faint grid, a two-door wardrobe drawn in white with its
   width over it, and a cut list card in front (blue part codes, grey lines). Bold enough to read at 44 px in the
   menus, sharp up to the Tools page's 76 px. Redrawn 6 Nov 2026 (Raf: "create better icon for drawings and cut
   list"); the first one was a thin drawing sheet that went muddy small. */

export default function DrawingsIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* the tile and its grid */}
      <rect width="64" height="64" rx="14" className="fill-accent" />
      <path
        d="M8 0V64M16 0V64M24 0V64M32 0V64M40 0V64M48 0V64M56 0V64M0 8H64M0 16H64M0 24H64M0 32H64M0 40H64M0 48H64M0 56H64"
        className="fill-none stroke-white"
        strokeOpacity="0.13"
        strokeWidth="1"
      />
      {/* the wardrobe: its width, the carcass, two doors with handles, the plinth */}
      <g className="fill-none stroke-white" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 11.5H34M10 9V14M34 9V14" strokeWidth="2" />
        <rect x="10" y="17" width="24" height="37" strokeWidth="2.6" />
        <path d="M22 17V48.5M10 48.5H34" strokeWidth="2" />
        <path d="M19.5 29V34M24.5 29V34" strokeWidth="2.6" />
      </g>
      {/* the cut list in front, with a soft shadow */}
      <rect x="34.8" y="30.8" width="21.5" height="26" rx="2.5" className="fill-ink" fillOpacity="0.3" />
      <rect x="33.5" y="29" width="21.5" height="26" rx="2.5" className="fill-mount" />
      <g className="fill-accent">
        <rect x="37" y="34.4" width="3.2" height="3.2" rx="0.6" />
        <rect x="37" y="40.4" width="3.2" height="3.2" rx="0.6" />
        <rect x="37" y="46.4" width="3.2" height="3.2" rx="0.6" />
      </g>
      <path d="M43 36H51M43 42H49M43 48H51" className="fill-none stroke-ink" strokeOpacity="0.6" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
