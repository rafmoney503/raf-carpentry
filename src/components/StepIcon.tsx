import type { StepId } from '@/lib/steps';

/* A small line icon for each of the five steps (and the steps logo for 'all'), drawn in the current text colour. */

export default function StepIcon({ step, size = 20 }: { step: StepId | 'all'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (step) {
    case 'learn':
      return (
        <svg {...common}>
          <path d="M10 2.5l7 4v7l-7 4-7-4v-7z" />
          <path d="M3 6.5l7 4 7-4M10 10.5v7" />
        </svg>
      );
    case 'design':
      return (
        <svg {...common}>
          <path d="M3 17l1-4 9-9 3 3-9 9z" />
          <path d="M11 6l3 3" />
        </svg>
      );
    case 'make':
      return (
        <svg {...common}>
          <rect x="2.5" y="4.5" width="15" height="11" rx="1" />
          <path d="M10 4.5v11M2.5 10h7.5M13.5 4.5v6" />
        </svg>
      );
    case 'fit':
      return (
        <svg {...common}>
          <rect x="2" y="7" width="16" height="6" rx="1.5" />
          <rect x="8" y="8.6" width="4" height="2.8" rx="1.4" />
        </svg>
      );
    case 'run':
      return (
        <svg {...common}>
          <circle cx="4.5" cy="10" r="2" />
          <circle cx="15.5" cy="4.5" r="2" />
          <circle cx="15.5" cy="15.5" r="2" />
          <path d="M6.4 9.1l7.2-3.6M6.4 10.9l7.2 3.6" />
        </svg>
      );
    default:
      return (
        <svg width={size * 1.2} height={size} viewBox="0 0 34 28" aria-hidden="true">
          <rect x="0" y="21" width="18" height="5" rx="1.5" fill="var(--learn)" />
          <rect x="7" y="14" width="18" height="5" rx="1.5" fill="var(--make)" />
          <rect x="14" y="7" width="18" height="5" rx="1.5" fill="var(--fit)" />
          <circle cx="27" cy="3.2" r="3.2" fill="var(--hl)" />
        </svg>
      );
  }
}
