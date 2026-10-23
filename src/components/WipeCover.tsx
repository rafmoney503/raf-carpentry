'use client';
import Image from 'next/image';
import { useRef } from 'react';
import { clamp01, useScrollFx } from '@/lib/use-scroll-fx';

/* A job's picture that starts as its SketchUp still (the 3D model's poster, on graph paper) and a blue line
   wipes it into the finished photo while the page scrolls (23 Oct 2026, Raf: start when the bottom of the
   picture comes into view, finish when its top reaches the top). So --w is 0 while the picture's bottom edge is
   at the bottom of the window and 1 once its top edge reaches the bottom of the menu bar (the top of what can
   be seen). Used for the home page's Latest jobs (`row`: the four sit in a row that scrolls sideways on a
   phone, so each watches its row) and the job cards on My Work, the service pages and the area pages (`low`:
   tags along the bottom, clear of the heart). --w is written straight onto the box while it scrolls, with
   data-stage drawing / wipe / photo for the tags ('3D drawing' while the drawing shows, 'Built' once the photo
   comes in). Sent finished (--w 1, the photo, stage 'still' with no tags), so it's the plain photo before the
   script runs, with reduced motion and for jobs without a 3D model (then there's no drawing at all). A card
   already on screen when the page opens keeps its photo until it has gone right off screen once, so nothing
   flashes from photo to drawing as the page loads. Styles in src/app/site-motion.css. */
export default function WipeCover({
  photo,
  model,
  sizes,
  className = 'photo latest-photo',
  imgClassName,
  priority,
  row = false,
  low = false,
}: {
  photo: { src: string; alt: string };
  model?: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  row?: boolean;
  low?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const armed = useRef<boolean | null>(null);
  useScrollFx(
    ref,
    (vh) => {
      const el = ref.current;
      if (!el || !model) return;
      const r = el.getBoundingClientRect();
      const seen = r.bottom > 0 && r.top < vh;
      if (armed.current === null) armed.current = !seen;
      if (!armed.current) {
        if (seen) return;
        armed.current = true;
      }
      // The menu bar stays at the top of the screen, so the top of the picture "reaches the top" at its bottom edge.
      const bar = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
      const top0 = Math.max(0, Math.min(bar, vh * 0.3));
      const w = clamp01((vh - r.bottom) / Math.max(40, vh - top0 - r.height));
      el.style.setProperty('--w', w.toFixed(3));
      el.dataset.stage = w < 0.01 ? 'drawing' : w > 0.99 ? 'photo' : 'wipe';
    },
    row ? (el) => el.closest('ul') ?? el : undefined,
  );

  return (
    <div ref={ref} className={`${className}${model ? ` wc${low ? ' wc-low' : ''}` : ''}`} data-stage="still">
      {model ? <Image src={model} alt="" fill sizes={sizes} className="wc-model" /> : null}
      <div className="wc-photo">
        <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className={imgClassName} />
      </div>
      {model ? (
        <>
          <i className="wc-line" aria-hidden="true" />
          <span className="wc-tag wc-tag-a" aria-hidden="true">3D drawing</span>
          <span className="wc-tag wc-tag-b" aria-hidden="true">Built</span>
        </>
      ) : null}
    </div>
  );
}
