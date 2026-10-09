'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Photo } from '@/lib/projects';
import './lightbox.css';

/* Full-screen photo viewer used by project photos, plan previews, the SketchUp screenshots and the CabinetOS app screens.
   Arrow keys, Escape and swiping all work; pinching zooms in (swipes are ignored while zoomed, so a zoomed
   picture can be moved about); focus goes back to whatever opened it.
   The picture's width is worked out from its own shape (--lb-ratio) rather than left to the browser, which
   sized small originals (like 780 px phone screenshots) at a fraction of the screen on iPhones.
   `fill`: the picture takes the whole screen under one top bar (count, short caption, arrows, close), with
   no 1100 px limit (used for the app screens). */
export default function Lightbox({
  photos,
  index,
  title,
  onIndex,
  onClose,
  fill = false,
}: {
  photos: (Photo & { caption?: string })[];
  index: number;
  title: string;
  onIndex: (i: number) => void;
  onClose: () => void;
  fill?: boolean;
}) {
  const startX = useRef<number | null>(null);
  const pointers = useRef(0);
  const multi = useRef(false);
  const [zoomed, setZoomed] = useState(false);
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

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setZoomed(vv.scale > 1.05);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const current = photos[index];
  if (!current) return null;
  const caption = current.caption ?? current.alt;
  const prevBtn = (cls: string) => (
    <button type="button" onClick={() => go(-1)} className={`lightbox-btn${cls}`} aria-label="Previous">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 4l-6 6 6 6" /></svg>
    </button>
  );
  const nextBtn = (cls: string) => (
    <button type="button" onClick={() => go(1)} className={`lightbox-btn${cls}`} aria-label="Next">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 4l6 6-6 6" /></svg>
    </button>
  );
  const endPointer = () => {
    pointers.current = Math.max(0, pointers.current - 1);
    const skip = multi.current || zoomed;
    if (pointers.current === 0) multi.current = false;
    return skip;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title}, ${index + 1} of ${photos.length}`}
      className={`lightbox${fill ? ' lightbox-fill' : ''}${zoomed ? ' lightbox-zoomed' : ''}`}
      onPointerDown={(e) => {
        pointers.current += 1;
        if (pointers.current > 1) multi.current = true;
        startX.current = e.clientX;
      }}
      onPointerCancel={() => {
        endPointer();
        startX.current = null;
      }}
      onPointerUp={(e) => {
        // a pinch (two fingers) or a drag around a zoomed picture is not a swipe
        if (endPointer()) {
          startX.current = null;
          return;
        }
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
        <span className="min-w-0 truncate font-mono text-[13px]">
          {index + 1} / {photos.length}
          {fill && caption ? <span className="lightbox-bar-caption text-white/75"> · {caption}</span> : null}
        </span>
        <span className="lightbox-tools flex flex-none items-center gap-2">
          {fill && photos.length > 1 ? (
            <>
              {prevBtn('')}
              {nextBtn('')}
            </>
          ) : null}
          <button ref={closeBtn} type="button" onClick={onClose} className="lightbox-btn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" /></svg>
          </button>
        </span>
      </div>

      {fill ? (
        <div className="lightbox-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <Image key={current.src} src={current.src} alt={current.alt} width={current.w} height={current.h} sizes="100vw" className="lightbox-fill-img" priority />
        </div>
      ) : (
        <figure className="lightbox-figure" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <Image
            key={current.src}
            src={current.src}
            alt={current.alt}
            width={current.w}
            height={current.h}
            sizes="100vw"
            className="lightbox-img"
            style={{ '--lb-ratio': current.w / current.h } as React.CSSProperties}
            priority
          />
          <figcaption className="mt-3 text-center text-[14px] text-white/75">{caption}</figcaption>
        </figure>
      )}

      {!fill && photos.length > 1 ? (
        <>
          {prevBtn(' lightbox-prev')}
          {nextBtn(' lightbox-next')}
        </>
      ) : null}
    </div>
  );
}
