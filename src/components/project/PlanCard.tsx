'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Photo, PlanSale } from '@/lib/projects';
import Lightbox from './Lightbox';

/* One plan for sale (or free): a drawing, a free look inside, and the buy or download button.
   "wide" is the version used on a job's own page. */
export default function PlanCard({
  plan,
  title,
  meta,
  href,
  wide = false,
}: {
  plan: PlanSale;
  title: string;
  meta?: string;
  href?: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const previews: Photo[] = plan.previews;
  const cover = previews[0];
  if (!cover) return null;

  const buttons = (
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" onClick={() => setOpen(0)} className="btn btn-ghost btn-sm">
        Free preview
        <span className="ml-2 font-mono text-[12.5px] text-faint">{previews.length} {previews.length === 1 ? 'view' : 'views'}</span>
      </button>
      {plan.freeDownload ? (
        <a href={plan.freeDownload} download className="btn btn-primary btn-sm">Download free</a>
      ) : plan.buyUrl ? (
        <a href={plan.buyUrl} target="_blank" rel="noopener" className="btn btn-primary btn-sm">
          Buy plans, {plan.price ?? '£4.99'}
        </a>
      ) : null}
    </div>
  );

  return (
    <article className={wide ? 'grid grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-6' : ''}>
      <button
        type="button"
        onClick={() => setOpen(0)}
        className={`group block w-full text-left ${wide ? 'md:col-span-5' : ''}`}
        aria-label={`Preview the drawings for ${title}`}
      >
        <span className="mount block transition-colors group-hover:border-accent">
          <span className="relative block aspect-[4/3] overflow-hidden bg-white">
            <Image src={cover.src} alt={cover.alt} fill sizes="(max-width: 768px) 100vw, 420px" className="object-contain p-3" />
          </span>
        </span>
      </button>

      <div className={wide ? 'md:col-span-6 md:col-start-7' : 'mt-5'}>
        {meta ? <p className="font-mono text-[13px] text-faint">{meta}</p> : null}
        <h3 className={`${wide ? 'text-[26px] md:text-[30px]' : 'text-[21px]'} mt-1.5 font-[640] leading-tight`}>
          {href ? (
            <Link href={href} className="transition-colors hover:text-accent">{title}</Link>
          ) : (
            title
          )}
        </h3>
        <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{plan.includes}</p>
        {plan.freeDownload ? <p className="mt-1 font-mono text-[13px] text-accent">Free</p> : null}
        {buttons}
      </div>

      {open !== null ? (
        <Lightbox photos={previews} index={open} title={`${title} drawings`} onIndex={setOpen} onClose={() => setOpen(null)} />
      ) : null}
    </article>
  );
}
