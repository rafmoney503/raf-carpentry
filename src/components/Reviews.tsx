import Link from 'next/link';
import { GOOGLE_REVIEWS_URL } from '@/lib/site';
import { getReviews, pickReviews } from '@/lib/reviews';
import { SectionHeading } from './ui';

/* "What customers say": the Google rating with a link to the profile, and review cards.
   With no reviews typed in yet it shows only the rating line, so it never looks empty. */

function Star({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="flex-none">
      <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
    </svg>
  );
}

export function GoogleRating({ className = '' }: { className?: string }) {
  const d = getReviews();
  if (!d.googleRating) return null;
  return (
    <a
      href={GOOGLE_REVIEWS_URL}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-2.5 rounded-sm border border-line-strong bg-mount px-4 py-2.5 text-[15px] text-ink transition-colors hover:border-accent ${className}`}
    >
      <span className="text-accent"><Star size={17} /></span>
      <span>
        <span className="font-semibold">{d.googleRating}</span> on Google
        {d.googleCount ? <span className="text-muted"> · {d.googleCount} reviews</span> : null}
      </span>
      <span aria-hidden="true" className="text-accent">↗</span>
    </a>
  );
}

export default function Reviews({ max = 3, jobSlug, homeHeading = false }: { max?: number; jobSlug?: string; homeHeading?: boolean }) {
  const d = getReviews();
  const list = pickReviews(d.reviews, max, jobSlug);

  if (!list.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[17px] font-[620] text-ink">{d.heading}</p>
        <GoogleRating />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          {homeHeading ? <h2 className="h2">{d.heading}</h2> : <SectionHeading>{d.heading}</SectionHeading>}
          {d.intro ? <p className="mt-3 text-muted">{d.intro}</p> : null}
        </div>
        <GoogleRating />
      </div>
      <ul className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        {list.map((r, i) => (
          <li key={i} className="flex flex-col rounded-sm border border-line-strong bg-mount p-6">
            <span className="flex items-center gap-0.5 text-accent" aria-label={`${r.stars ?? 5} out of 5 stars`}>
              {Array.from({ length: Math.max(1, Math.min(5, r.stars ?? 5)) }, (_, k) => <Star key={k} size={14} />)}
            </span>
            <blockquote className="mt-4 text-[16px] leading-relaxed text-ink">&ldquo;{r.text.trim()}&rdquo;</blockquote>
            <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-5">
              <span className="font-mono text-[13px] text-faint">{r.name}{r.area ? `, ${r.area}` : ''}</span>
              {r.job ? (
                <Link href={`/portfolio/${r.job}`} className="text-[14px] font-medium text-accent hover:underline">
                  See the job <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
