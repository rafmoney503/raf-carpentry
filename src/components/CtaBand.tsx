import Link from 'next/link';
import OpenSketch from './OpenSketch';
import StepsMark from './StepsMark';

/* 'Start here' at the bottom of each page, centred under a warm light, with the steps logo mixing into a mess and
   settling back into order above the words. The floating planner button steps aside while it is on screen. */

export default function CtaBand() {
  return (
    <section className="cta-band" data-hide-pill>
      <div className="wrap cta-row">
        <div className="cta-mark">
          <StepsMark play="mix" roomy delay={0.5} />
        </div>
        <p className="kicker">Start here</p>
        <h2 className="h2">
          Tell me what slows <span className="hl">you down.</span>
        </h2>
        <p className="lead" style={{ maxWidth: '44ch' }}>
          One job, one annoying evening, one thing you type twice. That&apos;s enough to start.
        </p>
        <div className="cta-actions">
          <Link href="/contact" className="btn">
            Tell me the problem
          </Link>
          <OpenSketch className="btn btn-ghost">
            <span className="dot" aria-hidden="true" />
            Sketch my system in 60 seconds
          </OpenSketch>
        </div>
      </div>
    </section>
  );
}
