'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './bounce-cta.css';

/* "Tell me the problem" in the top bar, with a yellow ball that lives in two small holes, one at each end of the
   button. It jumps out, bounces twice along the top edge and drops into the far hole, then comes back the same
   way. After each crossing there is a 4 in 10 chance it sinks into the hole instead and pops up out of the other
   one, then bounces the same way again. The movement itself is CSS generated from a small physics model
   (bounce-cta.css); this file only picks the next move. People who ask for less motion see the ball resting in
   its hole. */

const CROSS_MS = 1615;
const WARP_MS = 700;
type Phase = 'fwd' | 'back' | 'warpR' | 'warpL';

export default function BounceCta({ onPointerEnter }: { onPointerEnter?: () => void }) {
  const [phase, setPhase] = useState<Phase>('fwd');
  const [step, setStep] = useState(0);
  const [moving, setMoving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const phaseRef = useRef<Phase>('fwd');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const durationOf = (p: Phase) => (p === 'fwd' || p === 'back' ? CROSS_MS : WARP_MS);
    const next = () => {
      const p = phaseRef.current;
      const vanish = Math.random() < 0.4;
      const n: Phase = p === 'fwd' ? (vanish ? 'warpR' : 'back') : p === 'back' ? (vanish ? 'warpL' : 'fwd') : p === 'warpR' ? 'fwd' : 'back';
      phaseRef.current = n;
      setPhase(n);
      setStep((s) => s + 1);
      timer.current = window.setTimeout(next, durationOf(n));
    };
    const start = () => {
      window.clearTimeout(timer.current);
      setMoving(true);
      setStep((s) => s + 1);
      timer.current = window.setTimeout(next, durationOf(phaseRef.current));
    };
    const onVisibility = () => {
      if (document.hidden) window.clearTimeout(timer.current);
      else start();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // The track is mirrored for the way back, so one crossing animation serves both directions.
  const flip = phase === 'back' || phase === 'warpL';
  const warp = phase === 'warpR' || phase === 'warpL';

  return (
    <Link href="/contact" className="btn btn-sm head-cta bounce-cta" onPointerEnter={onPointerEnter}>
      <span className="bc-socket bc-l" aria-hidden="true" />
      <span className="bc-socket bc-r" aria-hidden="true" />
      <span className={`bc-track${flip ? ' flip' : ''}`} aria-hidden="true">
        <span key={`r${step}`} className={`bc-ring${moving && warp ? ' pop' : ''}`} />
        <span key={`s${step}`} className={`bc-shadow${moving && !warp ? ' run' : ''}`} />
        <span key={`b${step}`} className={`bc-ball${moving ? (warp ? ' warp' : ' run') : ''}`} />
      </span>
      <span className="bc-text">Tell me the problem</span>
    </Link>
  );
}
