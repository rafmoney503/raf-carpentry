import Link from 'next/link';
import OpenSketch from './OpenSketch';
import StepsMark from './StepsMark';

/* 'Start here' at the bottom of each page, centred under a warm light, with the steps logo mixing into a mess and
   settling back into order above the words. The floating Start a project button steps aside while it is on screen. */

export default function CtaBand() {
  return (
    <section className="cta-band" data-hide-pill>
      <div className="wrap cta-row">
        <div className="cta-mark">
          <StepsMark play="mix" roomy delay={0.5} />
        </div>
        <p className="kicker">Start here</p>
        <h2 className="h2">
          Got an idea for a website <span className="hl">or an app?</span>
        </h2>
        <p className="lead" style={{ maxWidth: '44ch' }}>
          Answer seven quick questions. It takes about a minute, and I reply within 24 hours with what I&apos;d build first.
        </p>
        <div className="cta-actions">
          <OpenSketch className="btn">
            <span className="dot" aria-hidden="true" />
            Start a project
          </OpenSketch>
          <Link href="/contact" className="btn btn-ghost">
            Or just tell me the problem
          </Link>
        </div>
      </div>
    </section>
  );
}
