'use client';
import { useEffect, useRef, useState } from 'react';

/* The wardrobe planner's own 3D view as a short silent loop, its doors opening and closing (16 Oct 2026, Raf: 'i
   think we need to use this approach and all static designs on website to make it more interactive'). It sits
   over the still picture (src/lib/planner-picture.ts) and only shows once it is actually playing, so the still
   stays if the video can't play (Low Power Mode on an iPhone, a slow connection) or the visitor asked for less
   motion. Nothing is downloaded until it is near the screen; it pauses off screen. */
export default function PlannerClip({ mp4, webm, className = '' }: { mp4: string; webm: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.muted = true;
    let loaded = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!loaded) {
            loaded = true;
            v.preload = 'auto';
            v.load();
          }
          v.play().catch(() => {});
        } else v.pause();
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${playing ? 'opacity-100' : 'opacity-0'} ${className}`}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
    >
      <source src={mp4} type="video/mp4" />
      <source src={webm} type="video/webm" />
    </video>
  );
}
