'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { Photo } from '@/lib/projects';
import Lightbox from './Lightbox';

/* Photo grid that opens the full-screen viewer. */
export default function ProjectGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <div className="gallery-grid">
        {photos.map((p, i) => (
          <button
            key={p.src}
            type="button"
            onClick={() => setOpen(i)}
            className="gallery-item group block w-full text-left"
            aria-label={`Open photo ${i + 1} of ${photos.length}: ${p.alt}`}
          >
            <span className="mount block transition-colors group-hover:border-accent">
              <Image
                src={p.src}
                alt={p.alt}
                width={p.w}
                height={p.h}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 400px"
                className="block h-auto w-full"
              />
            </span>
          </button>
        ))}
      </div>
      {open !== null ? <Lightbox photos={photos} index={open} title={title} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
