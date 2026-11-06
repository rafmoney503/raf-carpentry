'use client';

import Image from 'next/image';
import { useState } from 'react';
import Lightbox from '@/components/project/Lightbox';
import { DRAWING_EXAMPLES } from './examples-data';

/* "What you get": the real files from one finished example job (a bedroom: two wardrobes, a chest of drawers and a
   bedside table), each opening full size. Which pack each one comes in is said under it. */
export default function Examples() {
  const [open, setOpen] = useState<number | null>(null);
  const photos = DRAWING_EXAMPLES.map((e) => ({ src: e.src, w: e.w, h: e.h, alt: e.alt, caption: e.title }));
  return (
    <>
      <p className="mb-4 font-mono text-[12.5px] text-faint sm:hidden" aria-hidden="true">
        {DRAWING_EXAMPLES.length} files · swipe for more →
      </p>
      {/* A sideways row on phones (8 tall cards one under another was a long scroll), a grid from 640 px */}
      <ul className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {DRAWING_EXAMPLES.map((e, i) => (
          <li key={e.src} data-dw-example className="w-[80%] flex-none snap-start sm:w-auto">
            <button type="button" onClick={() => setOpen(i)} className="group block w-full text-left" aria-label={`Open full size: ${e.title}`}>
              <div className="mount">
                <div className="relative aspect-[4/3] overflow-hidden bg-white">
                  <Image src={e.src} alt={e.alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-contain object-top p-2 transition-transform duration-300 group-hover:scale-[1.02]" />
                </div>
              </div>
              <p className="mt-4 flex items-baseline justify-between gap-3">
                <span className="font-display text-[19px] font-[650] leading-tight tracking-[-0.01em] group-hover:text-accent">{e.title}</span>
              </p>
              <p className="mt-1.5 text-[15px] leading-snug text-muted">{e.line}</p>
              <p className="mt-2 font-mono text-[12px] text-accent">{e.pack}</p>
            </button>
          </li>
        ))}
      </ul>
      {open !== null ? <Lightbox photos={photos} index={open} title="Example drawings" onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
