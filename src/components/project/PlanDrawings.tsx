'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { Plan } from '@/lib/projects';
import Lightbox from './Lightbox';

/* The plan next to the real thing, then any other drawings in a row underneath.
   Every drawing opens in the full-screen viewer; the photo stays put (it is in Photos anyway). */
export default function PlanDrawings({ plan, title }: { plan: Plan; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const views = plan.views ?? [];
  const drawings = [
    { ...plan.image, alt: plan.imageLabel ? `${plan.imageLabel}: ${plan.image.alt}` : plan.image.alt },
    ...views.map((v) => ({ src: v.src, w: v.w, h: v.h, alt: v.caption ?? v.alt })),
  ];
  const ratio = `${plan.image.w} / ${plan.image.h}`;

  return (
    <>
      <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2">
        <figure>
          <button type="button" onClick={() => setOpen(0)} className="group block w-full text-left" aria-label={`Open drawing full size: ${plan.image.alt}`}>
            <span className="mount block transition-colors group-hover:border-accent">
              <span className="relative block overflow-hidden bg-white" style={{ aspectRatio: ratio }}>
                <Image src={plan.image.src} alt={plan.image.alt} fill sizes="(max-width: 768px) 100vw, 600px" className="object-contain" />
              </span>
            </span>
          </button>
          <figcaption className="mt-4 font-mono text-[13px] text-faint">{plan.imageLabel ?? 'The plan'}</figcaption>
        </figure>
        <figure>
          <div className="mount">
            <div className="relative overflow-hidden bg-raised" style={{ aspectRatio: ratio }}>
              <Image src={plan.real.src} alt={plan.real.alt} fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
            </div>
          </div>
          <figcaption className="mt-4 font-mono text-[13px] text-faint">{plan.realLabel ?? 'The real thing'}</figcaption>
        </figure>
      </div>

      {views.length > 0 ? (
        <div className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-6">
            <h3 className="text-[19px] font-[620] leading-snug">More drawings</h3>
            <p className="font-mono text-[13px] text-faint">Tap a drawing to see it full size</p>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {views.map((v, i) => (
              <li key={v.src}>
                <button type="button" onClick={() => setOpen(i + 1)} className="group block w-full text-left" aria-label={`Open drawing full size: ${v.caption ?? v.alt}`}>
                  <span className="mount block p-1.5 transition-colors group-hover:border-accent">
                    <span className="relative block aspect-[3/2] overflow-hidden bg-white">
                      <Image src={v.src} alt={v.alt} fill sizes="(max-width: 1024px) 50vw, 300px" className="object-contain" />
                    </span>
                  </span>
                  <span className="mt-3 block font-mono text-[12.5px] leading-snug text-faint">{v.caption ?? v.alt}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open !== null ? <Lightbox photos={drawings} index={open} title={`${title}: drawings`} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
