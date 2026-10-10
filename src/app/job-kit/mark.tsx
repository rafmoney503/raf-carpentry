/* The little status marks: waiting (hollow ring), sending (spinning), sent / done (blue tick), stuck (ink !). */
export default function Mark({ state }: { state: 'waiting' | 'sending' | 'sent' | 'lost' }) {
  if (state === 'sent')
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="8" className="fill-accent" />
        <path d="M4.5 8.2l2.3 2.3 4.7-4.9" className="fill-none stroke-on-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === 'sending')
    return (
      <svg viewBox="0 0 16 16" className="jk-spin h-4 w-4 shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="6.5" className="fill-none stroke-line-strong" strokeWidth="2" />
        <path d="M8 1.5a6.5 6.5 0 016.5 6.5" className="fill-none stroke-accent" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  if (state === 'lost')
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="8" className="fill-ink" />
        <path d="M8 4v5M8 11.5v.5" className="fill-none stroke-on-accent" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="6.5" className="fill-none stroke-faint" strokeWidth="1.8" />
    </svg>
  );
}
