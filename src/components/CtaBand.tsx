import OpenSketch from './OpenSketch';
import { PHONE_DISPLAY, PHONE_HREF } from '@/lib/site';

/* Near the bottom of each page: a dark card with the logo, the question and two ways to start. The floating
   Start a project button steps aside while it is on screen. */

export default function CtaBand() {
  return (
    <section className="cta-band" data-hide-pill aria-labelledby="cta-title">
      <div className="wrap">
        <div className="cta-card">
          <div>
            <svg className="cta-logo" viewBox="0 0 34 28" aria-hidden="true">
              <rect x="0" y="21" width="18" height="5" rx="1.5" fill="#fff" />
              <rect x="7" y="14" width="18" height="5" rx="1.5" fill="#fff" />
              <rect x="14" y="7" width="18" height="5" rx="1.5" fill="#fff" />
              <circle cx="27" cy="3.2" r="3.2" fill="var(--hl)" />
            </svg>
            <h2 className="h2" id="cta-title">
              Got an idea for a website or an app?
            </h2>
            <p>Seven quick questions, about a minute. I reply within 24 hours with what I&apos;d build first.</p>
          </div>
          <div className="cta-actions">
            <OpenSketch className="btn btn-white">Start a project</OpenSketch>
            <a href={PHONE_HREF} className="btn btn-line-white">
              Call {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
