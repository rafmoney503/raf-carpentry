import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import CtaBand from '@/components/CtaBand';
import { CabinetosFeature, JobKitCard, PlannerCard, SectionHead } from '@/components/blocks';
import { MENU } from '@/lib/menu';

const item = MENU.find((m) => m.href === '/systems')!;

export const metadata: Metadata = {
  title: 'Systems',
  description: 'CabinetOS, the Job Kit and the wardrobe planner: three systems that run a real London carpentry business every day.',
  alternates: { canonical: '/systems' },
};

export default function Systems() {
  return (
    <>
      <PageHeader item={item} title="Three systems already doing the work." lead="Each one runs Raf Carpentry before anyone else gets it. Yours would be built the same way, around your own jobs." />

      <section id="cabinetos" className="section">
        <div className="wrap">
          <SectionHead kicker="For cabinet and wardrobe makers" title="CabinetOS" whisper="Built after a spreadsheet cut-list mistake cost me money on a job." />
          <CabinetosFeature more />
        </div>
      </section>

      <section id="job-kit" className="section white">
        <div className="wrap">
          <SectionHead kicker="For running the business" title="Job Kit" whisper="The first thing I open in the morning." />
          <div className="two" style={{ marginTop: 0 }}>
            <JobKitCard more />
            <div className="card">
              <h3 className="h3">What a morning looks like</h3>
              <ol className="mini-steps">
                <li>
                  <b>Today</b> lists the visits, new enquiries, quotes to follow up and money to collect, in that order.
                </li>
                <li>
                  <b>Tap an enquiry</b> and the customer, their photos, their emails and texts and the property facts are on one screen.
                </li>
                <li>
                  <b>Reply</b> with a draft already written. I change a word or two and press send; it is filed on the ServiceM8 job.
                </li>
                <li>
                  <b>Book the visit</b>{' '}in ServiceM8&apos;s diary and confirm it on WhatsApp in one tap.
                </li>
                <li>
                  <b>After the job</b>, the review request is ready to send, and the photos become a post for Instagram.
                </li>
              </ol>
              <p className="small muted">Built for my business. Yours would show your jobs, your words and your way of working.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="planner" className="section">
        <div className="wrap">
          <SectionHead kicker="For getting the job in" title="Wardrobe planner to cut list" whisper="Customers do the first drawing for you." />
          <div className="two" style={{ marginTop: 0 }}>
            <PlannerCard />
            <div className="card">
              <h3 className="h3">What happens when a customer presses Send</h3>
              <ol className="mini-steps">
                <li>A client, a contact and a Quote job appear in ServiceM8, with their design in the description.</li>
                <li>The design becomes a CabinetOS project, cut list included, with the scribe fillers worked out.</li>
                <li>The customer gets a thank-you email with three finished jobs like theirs.</li>
                <li>I get an email and a line at the top of Today. I check the sizes on the visit before anything is cut.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="next" className="section white">
        <div className="wrap">
          <SectionHead kicker="Being built" title="Next: the decorator's paint schedule" whisper="Built with a London decorator who paints by hand and sprays." />
          <div className="card feature">
            <div className="feature-text" style={{ flex: '1 1 420px' }}>
              <span className="pill built">Being built</span>
              <p className="body">Doors, fronts and panels in; litres, tins and a price out. The sizes can come straight from a CabinetOS drawing, so the carpenter and the decorator work from the same numbers.</p>
              <Link href="/paint-schedule" className="btn" style={{ alignSelf: 'flex-start' }}>
                Try the paint schedule
              </Link>
            </div>
            <div className="litres" style={{ flex: '1 1 320px' }}>
              <div className="litre">
                <span className="small muted">Bedroom wardrobes, sprayed</span>
                <strong>17.1 m²</strong>
                <span className="mono" style={{ fontSize: 12.5 }}>
                  4 doors, 6 fronts, 4 m² panels
                </span>
              </div>
              <div className="litre">
                <span className="small muted">Top coat, 2 coats</span>
                <strong>
                  <span className="hl">4.4 L</span>
                </strong>
                <span className="mono" style={{ fontSize: 12.5 }}>
                  Buy 1 × 5 L
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
