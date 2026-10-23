'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { Photo } from '@/lib/projects';
import Lightbox from './Lightbox';
import TiltShot from '../TiltShot';

/* SketchUp screenshots: the first one large, the rest beside it. Tap any to see it full size. `tilt` (the
   SketchUp page): each leans towards the mouse on a computer (TiltShot, mouse only). */
export default function ScreenGrid({ shots, tilt = false }: { shots: (Photo & { caption: string })[]; tilt?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (shots.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8">
        {shots.map((s, i) => (
          <li key={s.src} className={i === 0 ? 'col-span-2' : ''}>
            <button type="button" onClick={() => setOpen(i)} className="group block w-full text-left" aria-label={`Open screenshot: ${s.caption}`}>
              {(() => {
                const shot = (
                  <span className="mount block p-1.5 transition-colors group-hover:border-accent">
                    <span className="relative block aspect-[16/10] overflow-hidden bg-white">
                      <Image src={s.src} alt={s.alt} fill sizes={i === 0 ? '(max-width: 768px) 100vw, 640px' : '(max-width: 768px) 50vw, 320px'} className="object-contain" />
                    </span>
                  </span>
                );
                return tilt ? (
                  <TiltShot as="span" mouseOnly deg={4} className="tilt-shot block">
                    {shot}
                  </TiltShot>
                ) : (
                  shot
                );
              })()}
              <span className="mt-3 block font-mono text-[12.5px] leading-snug text-faint">{s.caption}</span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null ? (
        <Lightbox photos={shots.map((s) => ({ ...s, alt: s.caption }))} index={open} title="SketchUp screenshots" onIndex={setOpen} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
