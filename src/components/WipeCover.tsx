'use client';
import Image from 'next/image';
import { useRef } from 'react';
import { clamp01, useScrollFx } from '@/lib/use-scroll-fx';

/* A Latest jobs card on the home page: it starts as the job's SketchUp still (the 3D model's poster, on graph
   paper) and a blue line wipes it into the finished photo as the card comes up the screen: from its top at 95%
   of the window to just under half way, each card a little after the one before (`index`), so all four are
   photos by the time the row is in the middle of the screen. --w (0 to 1) is
   written straight onto the box while it scrolls, with data-stage drawing / wipe / photo for the labels ('3D
   drawing' while the drawing shows, 'Built' once the photo comes in). Sent finished (--w 1, the photo, stage
   'still' with no labels), so it's the plain photo before the script runs, with reduced motion and for jobs
   without a 3D model (then there's no drawing at all). */
export default function WipeCover({
  photo,
  model,
  index = 0,
  sizes,
}: {
  photo: { src: string; alt: string };
  model?: string;
  index?: number;
  sizes: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFx(ref, (vh) => {
    const el = ref.current;
    if (!el || !model) return;
    const top = el.getBoundingClientRect().top;
    const w = clamp01((vh * 0.95 - top - index * vh * 0.05) / (vh * 0.5));
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
