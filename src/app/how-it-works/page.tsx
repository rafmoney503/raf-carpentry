import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';
import CtaBand from '@/components/CtaBand';
import { FaqList, FlowSection, SectionHead, StepsList } from '@/components/blocks';
import { CarryDiagram } from '@/components/motion-pieces';
import { MENU } from '@/lib/menu';

const item = MENU.find((m) => m.href === '/how-it-works')!;

export const metadata: Metadata = {
  title: 'How it works',
  description: 'Half a day watching the job, a mockup on your phone in 2 days, a working system in 2 to 4 weeks. And one enquiry followed start to finish.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorks() {
  return (
    <>
      <PageHeader item={item} title="From your van to your phone." lead="Half a day with you, a mockup on your phone in 2 days, a working system in 2 to 4 weeks." />

      <section id="steps" className="section">
        <div className="wrap">
          <SectionHead kicker="Four steps" title="What working with me looks like." whisper="If you can explain it on the phone, I can build it." />
          <StepsList />
        </div>
      </section>

      <section id="enquiry" className="section white">
        <div className="wrap">
          <SectionHead kicker="Inside one system" title="One enquiry, start to finish, typed once." whisper="This is how Raf Carpentry runs today. Yellow steps happen on my phone." />
          <CarryDiagram caption="Your message becomes a ServiceM8 job, then a line at the top of my Today list. The steps below show what happens on the way." className="carry-block" />
          <FlowSection />
        </div>
      </section>

      <section id="questions" className="section">
        <div className="wrap">
          <SectionHead kicker="Questions" title="What people ask first." />
          <FaqList />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
