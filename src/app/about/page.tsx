import type { Metadata } from 'next';
import Image from 'next/image';
import PageHeader from '@/components/PageHeader';
import CtaBand from '@/components/CtaBand';
import { SectionHead } from '@/components/blocks';
import { MENU } from '@/lib/menu';
import { ADDRESS, CABINETOS_URL, COMPANY, COMPANY_NO, IMG, RAFCARPENTRY_URL, VAT_NO } from '@/lib/site';

const item = MENU.find((m) => m.href === '/about')!;

export const metadata: Metadata = {
  title: 'About',
  description: 'Rafal Janczy: 22 years as a carpenter in London, and the systems that run his own business. Rafal Solutions Ltd, Wood Green.',
  alternates: { canonical: '/about' },
};

export default function About() {
  return (
    <>
      <PageHeader item={item} title="A carpenter built this. It actually works." lead="I'm Rafal. I still fit wardrobes, kitchens, doors and floors in London. These systems are how I run that business." />

      <section id="story" className="section">
        <div className="wrap about">
          <div className="about-pics">
            <div className="mount">
              <Image src={IMG.rafAtWork} alt="Rafal marking a board with a tape measure in the workshop" width={771} height={1050} sizes="(min-width: 700px) 210px, 44vw" style={{ aspectRatio: '3 / 4', objectFit: 'cover' }} />
            </div>
            <div className="mount">
              <Image src={IMG.wardrobe} alt="A finished birch ply wardrobe with LED lighting, built by Rafal in Chiswick" width={591} height={1050} sizes="(min-width: 700px) 210px, 44vw" style={{ aspectRatio: '3 / 4', objectFit: 'cover' }} />
            </div>
          </div>
          <div className="about-text">
            <p className="kicker">My story</p>
            <h2 className="h2">From the workshop to the phone.</h2>
            <p className="body">
              I&apos;ve fitted wardrobes, kitchens, doors and floors in London for over 22 years, and I still do, as Raf Carpentry. A cut-list mistake in a spreadsheet cost me money on a job, so I built CabinetOS. Then I built the tools that now run the rest of the business: enquiries, diary, emails, quotes, payments and reviews.
            </p>
            <p className="body">
              Every system here runs my own business first. If it doesn&apos;t save me time on a Monday morning, it doesn&apos;t leave the workshop. So when you explain your job, I already know what a site visit, a deposit and a snagging list feel like.
            </p>
          </div>
        </div>
      </section>

      <section id="numbers" className="section white">
        <div className="wrap">
          <SectionHead kicker="In numbers" title="What's running today." />
          <div className="facts-grid" style={{ paddingBlock: 0 }}>
            <div className="fact">
              <strong>22+ years</strong>
              <span>On the tools in London</span>
            </div>
            <div className="fact">
              <strong>31 jobs</strong>
              <span>Every finished job on rafcarpentry.com, drawn in 3D</span>
            </div>
            <div className="fact">
              <strong>3 systems</strong>
              <span>CabinetOS, the Job Kit and the wardrobe planner</span>
            </div>
            <div className="fact">
              <strong>1 enquiry list</strong>
              <span>Website, email and phone, all in ServiceM8</span>
            </div>
          </div>
        </div>
      </section>

      <section id="company" className="section">
        <div className="wrap">
          <SectionHead kicker="The company" title="One company, three names you might see." />
          <div className="three">
            <div className="card">
              <span className="pill">The company</span>
              <h3 className="h3">{COMPANY}</h3>
              <p className="body small" style={{ fontSize: 15 }}>
                Company No. {COMPANY_NO}
                <br />
                VAT No. {VAT_NO}
                <br />
                {ADDRESS}
              </p>
            </div>
            <a className="card card-link" href={RAFCARPENTRY_URL} target="_blank" rel="noopener">
              <span className="pill live">The carpentry</span>
              <h3 className="h3">Raf Carpentry</h3>
              <p className="body small" style={{ fontSize: 15 }}>
                Fitted wardrobes, alcove units, panelling, kitchens, doors and floors across London.
              </p>
              <span className="link-more">
                rafcarpentry.com <span aria-hidden="true">↗</span>
              </span>
            </a>
            <a className="card card-link" href={CABINETOS_URL} target="_blank" rel="noopener">
              <span className="pill live">The software</span>
              <h3 className="h3">CabinetOS</h3>
              <p className="body small" style={{ fontSize: 15 }}>
                Cut lists, board layouts and drawings for wardrobe and cabinet makers. Free plan available.
              </p>
              <span className="link-more">
                cabinetos.co.uk <span aria-hidden="true">↗</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
