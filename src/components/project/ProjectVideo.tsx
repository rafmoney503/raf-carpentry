'use client';
import { useEffect, useRef, useState } from 'react';

/* A short, silent clip that plays only while it is on screen.
   With reduced motion switched on it waits for a tap instead of playing by itself. */
export default function ProjectVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduce(rm);
    if (rm) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <div className="mount">
      <div className="relative aspect-[9/16] overflow-hidden bg-ink">
        <video
          ref={ref}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          aria-label={label}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause video' : 'Play video'}
          className="absolute inset-0 flex items-end justify-start p-3"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-mount/90 text-ink shadow-sm">
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" /><rect x="8.5" y="1" width="3.5" height="12" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 1.5v11l9.5-5.5z" /></svg>
            )}
          </span>
          {reduce && !playing ? <span className="ml-2 rounded-sm bg-mount/90 px-2 py-1 font-mono text-[12px] text-ink">Tap to play</span> : null}
        </button>
      </div>
    </div>
  );
}
