'use client';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { Photo } from '@/lib/projects';
import './lightbox.css';

/* Full-screen photo viewer used by project photos, plan previews and the SketchUp screenshots.
   Arrow keys, Escape and swiping all work; focus goes back to whatever opened it. */
export default function Lightbox({
  photos,
  index,
  title,
  onIndex,
  onClose,
}: {
  photos: Photo[];
  index: number;
  title: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const startX = useRef<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const go = (dir: number) => onIndex((index + dir + photos.length) % photos.length);

  useEffect(() => {
    opener.current = document.activeElement;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, photos.length, onIndex, onClose]);

  const current = photos[index];
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title}, ${index + 1} of ${photos.length}`}
      className="lightbox"
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50 && photos.length > 1) go(dx < 0 ? 1 : -1);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-bar">
        <span className="font-mono text-[13px]">
          {index + 1} / {photos.length}
        </span>
        <button ref={closeBtn} type="button" onClick={onClose} className="lightbox-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" /></svg>
        </button>
      </div>

      <figure className="lightbox-figure" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <Image key={current.src} src={current.src} alt={current.alt} width={current.w} height={current.h} sizes="100vw" className="lightbox-img" priority />
        <figcaption className="mt-3 text-center text-[14px] text-white/75">{current.alt}</figcaption>
      </figure>

      {photos.length > 1 ? (
        <>
          <button type="button" onClick={() => go(-1)} className="lightbox-btn lightbox-prev" aria-label="Previous">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 4l-6 6 6 6" /></svg>
          </button>
          <button type="button" onClick={() => go(1)} className="lightbox-btn lightbox-next" aria-label="Next">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 4l6 6-6 6" /></svg>
          </button>
        </>
      ) : null}
    </div>
  );
}
