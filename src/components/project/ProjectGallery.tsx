'use client';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Photo } from '@/lib/projects';

/* Photo grid that opens a full-screen viewer. Arrow keys, Escape and swiping all work. */
export default function ProjectGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const startX = useRef<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  const go = useCallback(
    (dir: number) => setOpen((i) => (i === null ? i : (i + dir + photos.length) % photos.length)),
    [photos.length],
  );
  const close = useCallback(() => {
    setOpen(null);
    lastTrigger.current?.focus();
  }, []);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, go, close]);

  const current = open === null ? null : photos[open];

  return (
    <>
      <div className="gallery-grid">
        {photos.map((p, i) => (
          <button
            key={p.src}
            type="button"
            onClick={(e) => {
              lastTrigger.current = e.currentTarget;
              setOpen(i);
            }}
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

      {current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title}, photo ${open! + 1} of ${photos.length}`}
          className="lightbox"
          onPointerDown={(e) => (startX.current = e.clientX)}
          onPointerUp={(e) => {
            if (startX.current === null) return;
            const dx = e.clientX - startX.current;
            startX.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="lightbox-bar">
            <span className="font-mono text-[13px]">
              {open! + 1} / {photos.length}
            </span>
            <button ref={closeBtn} type="button" onClick={close} className="lightbox-btn" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" /></svg>
            </button>
          </div>

          <figure className="lightbox-figure" onClick={(e) => e.target === e.currentTarget && close()}>
            <Image
              key={current.src}
              src={current.src}
              alt={current.alt}
              width={current.w}
              height={current.h}
              sizes="100vw"
              className="lightbox-img"
              priority
            />
            <figcaption className="mt-3 text-center text-[14px] text-white/75">{current.alt}</figcaption>
          </figure>

          {photos.length > 1 ? (
            <>
              <button type="button" onClick={() => go(-1)} className="lightbox-btn lightbox-prev" aria-label="Previous photo">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 4l-6 6 6 6" /></svg>
              </button>
              <button type="button" onClick={() => go(1)} className="lightbox-btn lightbox-next" aria-label="Next photo">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 4l6 6-6 6" /></svg>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
