'use client';
import Image from 'next/image';
import { useState } from 'react';
import { APP_OPEN, APP_SCREENS } from '@/lib/workshop-tools/site';

/* The app on a phone, beside the words on /tools/workshop. A picture of its home screen; on a computer,
   Try it here swaps the picture for the app itself, working, in the same frame. */

export default function PhonePreview() {
  const [live, setLive] = useState(false);
  return (
    <figure className="mx-auto w-full max-w-[300px]">
      <div className="rounded-[40px] bg-ink p-[9px] shadow-[0_24px_48px_-20px_rgba(22,25,28,0.45)]">
        <div className="relative aspect-[390/844] overflow-hidden rounded-[31px] bg-[#f1f2ef]">
          {live ? (
            <iframe src={APP_OPEN} title="Workshop Tools, working" className="absolute inset-0 h-full w-full border-0" />
          ) : (
            <Image src={APP_SCREENS.home.src} alt={APP_SCREENS.home.alt} fill sizes="300px" className="object-cover" priority />
          )}
        </div>
      </div>
      <figcaption className="mt-4 hidden text-center lg:block">
        {live ? (
          <span className="font-mono text-[13px] text-faint">The real app. Tap away.</span>
        ) : (
          <button type="button" onClick={() => setLive(true)} className="link-more text-[15px]">
            Try it here <span aria-hidden="true">→</span>
          </button>
        )}
      </figcaption>
    </figure>
  );
}
