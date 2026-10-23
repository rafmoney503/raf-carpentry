'use client';
import Image from 'next/image';
import { useRef } from 'react';
import { clamp01, useScrollFx } from '@/lib/use-scroll-fx';

/* A Latest jobs card on the home page: it starts as the job's SketchUp still (the 3D model's poster, on graph
   paper) and a blue line wipes it into the finished photo while the page scrolls (23 Oct 2026, Raf: start when
   the bottom of the picture comes into view, finish when its top reaches the top). So --w is 0 while the
   picture's bottom edge is at the bottom of the window and 1 once its top edge reaches the bottom of the menu
   bar (the top of what can be seen); the four cards sit in one row, so they wipe together. --w (0 to 1) is
   written straight onto the box while it scrolls, with data-stage drawing / wipe / photo for the labels ('3D
   drawing' while the drawing shows, 'Built' once the photo comes in). Sent finished (--w 1, the photo, stage
   'still' with no labels), so it's the plain photo before the script runs, with reduced motion and for jobs
   without a 3D model (then there's no drawing at all). */
export default function WipeCover({
  photo,
  model,
  sizes,
}: {
  photo: { src: string; alt: string };
  model?: string;
  sizes: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFx(ref, (vh) => {
    const el = ref.current;
    if (!el || !model) return;
    const r = el.getBoundingClientRect();
    // The menu bar stays at the top of the screen, so the top of the picture "reaches the top" at its bottom edge.
    const bar = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const top0 = Math.max(0, Math.min(bar, vh * 0.3));
    const w = clamp01((vh - r.bottom) / Math.max(40, vh - top0 - r.height));
    el.style.setProperty('--w', w.toFixed(3));
    el.dataset.stage = w < 0.01 ? 'drawing' : w > 0.99 ? 'photo' : 'wipe';
  }, (el) => el.closest('ul') ?? el);

  return (
    <div ref={ref} className={`photo latest-photo${model ? ' wc' : ''}`} data-stage="still">
      {model ? <Image src={model} alt="" fill sizes={sizes} className="wc-model" /> : null}
      <div className="wc-photo">
        <Image src={photo.src} alt={photo.alt} fill sizes={sizes} />
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
