'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './review-wall.css';

/* The home page's "What customers say" as a review wall (27 Nov 2026, Raf: 'build it' to the mockup): the Google
   score big, chips to show only the reviews about one kind of work, and the cards in a row that swipes on a phone
   (scroll snap) and moves with the arrows on a computer. A card about a job on the site (the review's job, or for a
   Google review the line in TinaCMS "Google reviews: which job") has that job's photo on top and See the job.
   No motion of its own, so nothing to switch off for reduced motion. */
export type WallReview = {
  name: string;
  area?: string;
  text: string;
  stars: number;
  uri?: string;
  when?: string;
  topics: string[];
  job?: { slug: string; title: string; area: string; photo: { src: string; w: number; h: number; alt: string } };
};

function Star({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="flex-none">
      <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
    </svg>
  );
}

function Arrow({ left }: { left?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={left ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ReviewWall({
  heading,
  intro,
  rating,
  count,
  googleUrl,
  items,
}: {
  heading: string;
  intro?: string;
  rating?: string;
  count?: string;
  googleUrl: string;
  items: WallReview[];
}) {
  const [topic, setTopic] = useState('All');
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const topics = Array.from(new Set(items.flatMap((r) => r.topics)));
  const counts = new Map(topics.map((t) => [t, items.filter((r) => r.topics.includes(t)).length]));
  const chips = topics.filter((t) => (counts.get(t) ?? 0) > 0).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  const shown = topic === 'All' ? items : items.filter((r) => r.topics.includes(topic));

  const measure = () => {
    const t = track.current;
    if (!t) return;
    setEdge({ start: t.scrollLeft < 8, end: t.scrollLeft + t.clientWidth > t.scrollWidth - 8 });
  };
  useEffect(() => {
    const t = track.current;
    if (t) t.scrollTo({ left: 0 });
    measure();
  }, [topic]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const move = (dir: number) => {
    const t = track.current;
    if (!t) return;
    const card = t.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 20 : t.clientWidth * 0.8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    t.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="rv">
      <div className="rv-head">
        <div>
          <h2 className="h2">{heading}</h2>
          {intro ? <p className="mt-3 text-muted">{intro}</p> : null}
        </div>
        {rating ? (
          <a href={googleUrl} target="_blank" rel="noopener" className="rv-score" data-review-score>
            <span className="rv-big">{rating}</span>
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-0.5 text-accent" aria-label={`${rating} out of 5 stars`}>
                {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={17} />)}
              </span>
              <span className="text-[14px] text-muted">
                {count ? `${count} reviews on Google` : 'On Google'} <span aria-hidden="true" className="text-accent">↗</span>
              </span>
            </span>
          </a>
        ) : null}
      </div>

      <div className="rv-bar">
        {chips.length > 1 ? (
          <div className="rv-chips" role="group" aria-label="Show reviews about">
            {['All', ...chips].map((t) => (
              <button
                key={t}
                type="button"
                className="rv-chip"
                aria-pressed={topic === t}
                onClick={() => setTopic(t)}
                data-review-chip={t}
              >
                {t}
                <span className="rv-n">{t === 'All' ? items.length : counts.get(t)}</span>
              </button>
            ))}
          </div>
        ) : <span />}
        <div className="rv-arrows">
          <button type="button" className="rv-arrow" aria-label="Earlier reviews" onClick={() => move(-1)} disabled={edge.start} data-review-prev>
            <Arrow left />
          </button>
          <button type="button" className="rv-arrow" aria-label="More reviews" onClick={() => move(1)} disabled={edge.end} data-review-next>
            <Arrow />
          </button>
        </div>
      </div>

      <ul ref={track} className="rv-track" onScroll={measure} aria-label="Reviews" data-review-track>
        {shown.map((r) => (
          <li key={`${r.name}-${r.text.slice(0, 24)}`} className="rv-card" data-review-card>
            {r.job ? (
              <Link href={`/portfolio/${r.job.slug}`} className="rv-photo" tabIndex={-1} aria-hidden="true">
                <Image src={r.job.photo.src} alt="" width={r.job.photo.w} height={r.job.photo.h} sizes="(min-width: 768px) 360px, 82vw" />
                <span className="rv-tag">{r.job.title}, {r.job.area}</span>
              </Link>
            ) : null}
            <div className="rv-body">
              <span className="flex items-center gap-0.5 text-accent" aria-label={`${r.stars} out of 5 stars`}>
                {Array.from({ length: r.stars }, (_, k) => <Star key={k} />)}
              </span>
              <blockquote className={`rv-quote${r.job ? '' : ' rv-quote-lg'}`}>&ldquo;{r.text.trim()}&rdquo;</blockquote>
              <div className="rv-foot">
                <span className="font-mono text-[13px] text-faint">
                  {r.uri ? (
                    <a href={r.uri} target="_blank" rel="noopener nofollow" className="text-ink underline-offset-2 hover:underline">{r.name}</a>
                  ) : <span className="text-ink">{r.name}</span>}
                  {r.area ? `, ${r.area}` : ''}
                  {r.when ? ` · ${r.when}` : ''}
                  {r.uri ? ' · on Google' : ''}
                </span>
                {r.job ? (
                  <Link href={`/portfolio/${r.job.slug}`} className="text-[14px] font-medium text-accent hover:underline">
                    See the job <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {count ? (
        <p className="mt-4 text-[14px] text-muted">
          {shown.length} of {count} reviews here.{' '}
          <a href={googleUrl} target="_blank" rel="noopener" className="font-medium text-accent hover:underline">Read them all on Google ↗</a>
        </p>
      ) : null}
    </div>
  );
}
