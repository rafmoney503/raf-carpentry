/* Small line icons for the Job Kit's sections, drawn like the site's sketches (round ends, one weight), so each
   card on the Today screen and each line in the Today list shows where it goes. Decorative: the text says it. */

export type IconName = 'diary' | 'jobs' | 'designs' | 'library' | 'posts' | 'kit' | 'money' | 'mail' | 'review' | 'search' | 'person' | 'stats' | 'bin' | 'gantt' | 'chat' | 'social' | 'board' | 'file' | 'note';

const PATHS: Record<IconName, React.ReactNode> = {
  // a sheet with its corner folded: a file in a job's diary (PDF, drawing)
  file: (
    <>
      <path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z" />
      <path d="M14 3.5V8h4.5M9 12.5h6M9 15.5h6" />
    </>
  ),
  // a pencil on a lined page: a note on the job
  note: (
    <>
      <path d="M5 4.5h10.5v15.5H5z" />
      <path d="M7.5 8.5h5.5M7.5 11.5h4" />
      <path d="M19.5 9.5l-6.2 6.2-2.3.6.6-2.3 6.2-6.2a1.2 1.2 0 0 1 1.7 1.7z" />
    </>
  ),
  // a heart in a speech bubble: Instagram and Facebook, their followers and comments
  social: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.2 3.6V16H5.5A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M12 13.2s-3.3-1.9-3.3-4.1a1.75 1.75 0 0 1 3.3-.8 1.75 1.75 0 0 1 3.3.8c0 2.2-3.3 4.1-3.3 4.1z" />
    </>
  ),
  // the website stats: a browser window with a bar chart in it
  stats: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 8h18" />
      <path d="M7.5 17v-3.5M11 17v-6M14.5 17v-4.5M18 17v-2" strokeWidth="2" />
    </>
  ),
  // two speech bubbles: a chat brought in from WhatsApp
  chat: (
    <>
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 14H9l-3.6 3v-3H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M16.5 9H19a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 19 18h-.4v3L15 18h-3.5a1.5 1.5 0 0 1-1.5-1.5V14" />
      <path d="M7 8.5h6M7 11h4" />
    </>
  ),
  // the clients board: three columns with cards in them, fewer as they move right
  board: (
    <>
      <rect x="3" y="4" width="18" height="16.5" rx="1.5" />
      <path d="M9 4v16.5M15 4v16.5" />
      <rect x="4.6" y="6.3" width="2.8" height="2.6" rx="0.4" />
      <rect x="4.6" y="10.4" width="2.8" height="2.6" rx="0.4" />
      <rect x="4.6" y="14.5" width="2.8" height="2.6" rx="0.4" />
      <rect x="10.6" y="6.3" width="2.8" height="2.6" rx="0.4" />
      <rect x="10.6" y="10.4" width="2.8" height="2.6" rx="0.4" />
      <rect x="16.6" y="6.3" width="2.8" height="2.6" rx="0.4" />
    </>
  ),
  // the job timeline: three bars stepping across a chart, a today line through them
  gantt: (
    <>
      <path d="M3.5 4v16.5h17" />
      <rect x="6" y="6" width="7" height="3" rx="0.6" />
      <rect x="9.5" y="11" width="8.5" height="3" rx="0.6" />
      <rect x="13" y="16" width="5" height="2.6" rx="0.6" />
      <path d="M11 4.2v1.3M11 10v.6M11 15v.6" strokeWidth="1.3" />
    </>
  ),
  // a diary page with its rings and a few days marked
  diary: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" strokeWidth="2" />
    </>
  ),
  // a job card on a clipboard
  jobs: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="1.5" />
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4" />
    </>
  ),
  // a wardrobe in 3D: a box seen from the corner
  designs: (
    <>
      <path d="M12 3.2l7.8 4.4v8.8L12 20.8l-7.8-4.4V7.6z" />
      <path d="M4.2 7.6L12 12l7.8-4.4M12 12v8.8" />
    </>
  ),
  // the design library: books on a shelf, one leaning
  library: (
    <>
      <path d="M2.8 20.6h18.4" />
      <rect x="4.6" y="6.2" width="3.4" height="14.4" rx="0.5" />
      <rect x="8" y="8.4" width="3.4" height="12.2" rx="0.5" />
      <rect x="11.4" y="4.8" width="3.4" height="15.8" rx="0.5" />
      <path d="M15.2 20.6l3.3-11.9 3 0.8-3 11.1" />
      <path d="M4.6 9.4h3.4M8 11.4h3.4M11.4 8h3.4" />
    </>
  ),
  // a phone playing a clip
  posts: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M10.6 9.4v5.2l4.2-2.6z" />
      <path d="M11 18.8h2" />
    </>
  ),
  // the camera for job photos
  kit: (
    <>
      <path d="M3.5 8.5a1.5 1.5 0 0 1 1.5-1.5h2.6l1.6-2.4h5.6L16.4 7H19a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <circle cx="12" cy="13.2" r="3.6" />
    </>
  ),
  // an envelope, its flap a little open: a job's emails
  mail: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="1.5" />
      <path d="M3.6 7l8.4 6.4L20.4 7" />
      <path d="M3.6 18.4l6.2-6.6M20.4 18.4l-6.2-6.6" />
    </>
  ),
  // a star in a speech bubble: ask for a review
  review: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.2 3.6V16H5.5A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M12 6.8l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" />
    </>
  ),
  // a magnifier: find a customer
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  // a head and shoulders: a customer
  person: (
    <>
      <circle cx="12" cy="8.4" r="3.8" />
      <path d="M4.6 20.4c.9-3.9 3.8-6 7.4-6s6.5 2.1 7.4 6" />
    </>
  ),
  // a bin with its lid: delete
  bin: (
    <>
      <path d="M4 6.5h16M9.5 6.5V4.5h5v2" />
      <path d="M6 6.5l1 13.5h10l1-13.5" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  // a pound coin: money still to collect
  money: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M14.6 8.6a2.5 2.5 0 0 0-4.4 1.6v5.6M8.8 12.6h4.4M8.8 15.8h6.6" />
    </>
  ),
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/* The icon on a small square of graph paper, for the section cards. */
const graph: React.CSSProperties = {
  backgroundImage: 'linear-gradient(rgb(37 71 208 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(37 71 208 / 0.08) 1px, transparent 1px)',
  backgroundSize: '8px 8px',
  backgroundPosition: '-1px -1px',
};
export function IconTile({ name }: { name: IconName }) {
  return (
    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-line bg-paper text-accent" style={graph}>
      <Icon name={name} />
    </span>
  );
}
