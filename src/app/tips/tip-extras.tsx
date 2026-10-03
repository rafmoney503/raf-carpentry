'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { Photo } from '@/lib/projects';
import Lightbox from '@/components/project/Lightbox';

/* "Copy link" under each tip: copies rafcarpentry.com/tips#<id>, so Raf can post one tip on its own. */
export function CopyTipLink({ id, title }: { id: string; title: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}/tips#${id}`;
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* share sheet closed or clipboard blocked: nothing to do */
    }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-faint transition-colors hover:text-accent">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M6.5 9.5l3-3M7 4.5l1.3-1.3a2.6 2.6 0 0 1 3.7 3.7L10.7 8.2M9 11.5l-1.3 1.3A2.6 2.6 0 0 1 4 9.1l1.3-1.3" />
      </svg>
      {done ? 'Link copied' : 'Share this tip'}
    </button>
  );
}

/* Raf's photos for a tip: small squares that open full screen. */
export function TipPhotos({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <ul className="mt-4 flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.src}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="mount block !p-1 transition-colors hover:border-accent"
              aria-label={`Open photo ${i + 1} of ${photos.length}: ${p.alt}`}
            >
              <span className="relative block h-[72px] w-[72px] overflow-hidden bg-raised sm:h-[88px] sm:w-[88px]">
                <Image src={p.src} alt={p.alt} fill sizes="88px" className="object-cover" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null ? <Lightbox photos={photos} index={open} title={title} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
