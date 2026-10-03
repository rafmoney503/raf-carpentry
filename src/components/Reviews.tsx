import Link from 'next/link';
import { GOOGLE_REVIEWS_URL } from '@/lib/site';
import { getReviews, pickReviews, type JobForReviews } from '@/lib/reviews';
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

/* `inline` is the small line under the main buttons at the top of a page; `box` sits in the reviews section. */
export function GoogleRating({ className = '', variant = 'box' }: { className?: string; variant?: 'box' | 'inline' }) {
  const d = getReviews();
  if (!d.googleRating) return null;
  if (variant === 'inline') {
    return (
      <a
        href={GOOGLE_REVIEWS_URL}
        target="_blank"
        rel="noopener"
        className={`group inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink ${className}`}
      >
        <span className="flex items-center gap-0.5 text-accent" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} />)}
        </span>
        <span>
          <span className="font-semibold">{d.googleRating}</span> on Google
          {d.googleCount ? <span className="text-muted"> from {d.googleCount} reviews</span> : null}
        </span>
        <span className="text-[14px] font-medium text-accent group-hover:underline">Read them <span aria-hidden="true">↗</span></span>
      </a>
    );
  }
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

/* `job` (slug, type + title, tags) puts the reviews about that kind of work first. */
export default function Reviews({ max = 3, job, homeHeading = false }: { max?: number; job?: JobForReviews; homeHeading?: boolean }) {
  const d = getReviews();
  const list = pickReviews(d.reviews, max, job);

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
      <ul className="-mx-5 mt-10 flex items-start snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:items-stretch md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0">
        {list.map((r, i) => (
          <li key={i} className="flex w-[84%] flex-none snap-start flex-col rounded-sm border border-line-strong bg-mount p-6 md:w-auto">
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
      {list.length > 1 ? <p className="mt-3 font-mono text-[12px] text-faint md:hidden">Swipe for more <span aria-hidden="true">→</span></p> : null}
    </div>
  );
}
