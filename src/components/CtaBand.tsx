import Link from 'next/link';
import OpenSketch from './OpenSketch';

/* The dark band at the bottom of each page. The floating planner button steps aside while it is on screen. */

export default function CtaBand() {
  return (
    <section className="cta-band" data-hide-pill>
      <div className="wrap cta-row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, flex: '1 1 420px' }}>
          <p className="kicker" style={{ color: '#b9bec3' }}>
            Start here
          </p>
          <h2 className="h2" style={{ color: '#fff' }}>
            Tell me what slows <span style={{ color: 'var(--hl)' }}>you down.</span>
          </h2>
          <p style={{ color: '#d3d7da', maxWidth: '44ch' }}>One job, one annoying evening, one thing you type twice. That&apos;s enough to start.</p>
        </div>
        <div className="cta-actions">
          <Link href="/contact" className="btn btn-light">
            Tell me the problem
          </Link>
          <OpenSketch className="btn btn-outline-light">
            <span className="dot" aria-hidden="true" />
            Sketch my system in 60 seconds
          </OpenSketch>
        </div>
      </div>
    </section>
  );
}
