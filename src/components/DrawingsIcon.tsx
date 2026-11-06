/* The little picture for "Drawings and cut lists, done for you" (/drawings): a drawing sheet with a two-door
   wardrobe drawn front on, its width dimensioned in blue, a cut list beside it and a board layout under that.
   Drawn in the site's sketch style, sharp at any size (48 px in the phone menu, 56 to 88 px elsewhere). */

export default function DrawingsIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {/* the sheet */}
      <rect x="4" y="4" width="40" height="40" rx="1" className="fill-white stroke-ink/25" strokeWidth="1" />
      {/* width over the wardrobe */}
      <path d="M9 9.5 L26 9.5 M9 7.5 L9 11.5 M26 7.5 L26 11.5" className="fill-none stroke-accent" strokeWidth="1.2" strokeLinecap="round" />
      {/* the wardrobe front: carcass, two doors, handles, plinth */}
      <rect x="9" y="13.5" width="17" height="25" className="fill-mount stroke-ink" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M17.5 13.5 L17.5 35.5 M9 35.5 L26 35.5" className="fill-none stroke-ink" strokeWidth="1.1" />
      <path d="M15.6 22 L15.6 26 M19.4 22 L19.4 26" className="fill-none stroke-ink" strokeWidth="1.3" strokeLinecap="round" />
      {/* the cut list */}
      <path d="M30 14.5 L39 14.5 M30 18.5 L37 18.5 M30 22.5 L39 22.5" className="fill-none stroke-ink/45" strokeWidth="1.4" strokeLinecap="round" />
      {/* a board with its parts laid out */}
      <rect x="30" y="27.5" width="10" height="11" className="fill-raised stroke-ink" strokeWidth="1.1" />
      <path d="M35 27.5 L35 38.5 M30 33 L35 33" className="fill-none stroke-accent" strokeWidth="1.1" strokeDasharray="1.6 1.2" />
    </svg>
  );
}
