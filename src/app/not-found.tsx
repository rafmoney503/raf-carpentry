import Link from 'next/link';
import CtaBand from '@/components/CtaBand';
import StepsMark from '@/components/StepsMark';

/* A page that isn't there: the steps logo, one line, and the way back. */
export default function NotFound() {
  return (
    <>
      <section className="page-head grid-paper">
        <div className="wrap page-head-in nf404">
          <div className="nf404-mark">
            <StepsMark play="mix" roomy delay={0.4} />
          </div>
          <p className="kicker">404</p>
          <h1 className="h1 page-title">
            This step <span className="hl">isn&apos;t here.</span>
          </h1>
          <p className="lead">The page may have moved. The menu and the search at the top still go everywhere.</p>
          <div className="cta-actions" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
            <Link href="/" className="btn">
              Back to the start
            </Link>
            <Link href="/contact" className="btn btn-ghost">
              Tell me the problem
            </Link>
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
