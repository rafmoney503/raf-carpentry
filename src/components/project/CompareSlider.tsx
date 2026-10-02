'use client';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import type { Photo } from '@/lib/projects';

/* Before/after: the "before" photo is clipped from the right as the handle moves.
   A real range input sits on top, so it works with a keyboard and screen readers too. */
export default function CompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: Photo;
  after: Photo;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);

  const fromPointer = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <div className="mount">
      <div
        ref={box}
        className="compare relative select-none overflow-hidden bg-raised"
        style={{ aspectRatio: `${after.w} / ${after.h}` }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1 || e.pointerType === 'touch') fromPointer(e.clientX);
        }}
      >
        <Image src={after.src} alt={after.alt} fill sizes="(max-width: 860px) 100vw, 760px" className="object-cover" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Image src={before.src} alt={before.alt} fill sizes="(max-width: 860px) 100vw, 760px" className="object-cover" />
        </div>

        <span className="compare-tag left-3 top-3">{beforeLabel}</span>
        <span className="compare-tag right-3 top-3">{afterLabel}</span>

        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }} aria-hidden="true">
          <div className="absolute inset-y-0 -left-px w-0.5 bg-mount shadow-[0_0_0_1px_rgb(22_25_28/0.25)]" />
          <div className="compare-knob">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6l-5 5 5 5M14 6l5 5-5 5" />
            </svg>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(pos)}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label={`Compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
          className="compare-range"
        />
      </div>
    </div>
  );
}
