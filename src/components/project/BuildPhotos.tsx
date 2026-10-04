'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { Photo } from '@/lib/projects';
import Lightbox from './Lightbox';

/* "More from the build": the extra build photos from the job folder as small squares.
   Twelve show at first, the rest behind a button; any of them opens full screen. */
const FIRST = 12;

export default function BuildPhotos({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(photos.length <= FIRST + 3);
  const shown = all ? photos : photos.slice(0, FIRST);

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
        {shown.map((p, i) => (
          <li key={p.src}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="mount group block w-full !p-1 transition-colors hover:border-accent"
              aria-label={`Open build photo ${i + 1} of ${photos.length}: ${p.alt}`}
            >
              <span className="relative block aspect-square overflow-hidden bg-raised">
                <Image src={p.src} alt={p.alt} fill sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!all ? (
        <button type="button" onClick={() => setAll(true)} className="btn btn-ghost mt-6">
          Show all {photos.length} build photos
        </button>
      ) : null}
      {open !== null ? <Lightbox photos={photos} index={open} title={title} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
