import type { Metadata } from 'next';
import StartProject from '@/components/start/StartProject';
import StepsMark from '@/components/StepsMark';
import { PHONE_DISPLAY, PHONE_HREF } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Start a project',
  description: 'Got an idea for a website, a phone app or a system that joins your tools? Seven quick questions, about a minute. Rafal replies within 24 hours with what he would build first.',
  alternates: { canonical: '/start' },
};

export default function Start() {
  return (
    <section className="start" data-hide-pill>
      <div className="wrap start-row">
        <div className="start-text">
          <div className="start-mark" aria-hidden="true">
            <StepsMark play="build" roomy delay={0.3} />
          </div>
          <p className="kicker">Built for you · step 5</p>
          <h1 className="h1">
            Start a <span className="hl">project.</span>
          </h1>
          <p className="lead">A website, a phone app or a system that joins up the tools you already use. Seven quick questions, about a minute.</p>
          <ul className="ticks start-ticks">
            <li>I reply within 24 hours with what I&apos;d build first</li>
            <li>A clickable mockup on your phone in 2 days</li>
            <li>Tested on my own business before it runs yours</li>
            <li>You own what I build</li>
          </ul>
          <p className="small muted">
            Rather talk? Call <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>.
          </p>
        </div>
        <div className="start-card">
          <StartProject idPrefix="sp" />
        </div>
      </div>
    </section>
  );
}
