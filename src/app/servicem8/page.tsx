import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';
import CtaBand from '@/components/CtaBand';
import { IntegrationsGrid, SectionHead, Sm8Grid } from '@/components/blocks';
import { MENU } from '@/lib/menu';

const item = MENU.find((m) => m.href === '/servicem8')!;

export const metadata: Metadata = {
  title: 'ServiceM8 systems',
  description: 'Systems that read and write your ServiceM8 jobs, clients, diary, payments, photos, emails and texts through the official API. Built and tested on a real trade business.',
  alternates: { canonical: '/servicem8' },
};

export default function ServiceM8() {
  return (
    <>
      <PageHeader
        item={item}
        title="On ServiceM8? I already speak its language."
        lead="I run my own business on ServiceM8. My systems read and write the same jobs, clients and diary you see in the app, so the boring parts fill themselves in."
      />

      <section className="section">
        <div className="wrap">
          <SectionHead kicker="Through the official API" title="What it reads, writes and never does." whisper="Every connection here is tested on my own jobs first." />
          <Sm8Grid />
        </div>
      </section>

      <section id="setup" className="section white">
        <div className="wrap">
          <SectionHead kicker="What you need" title="Three things, about 20 minutes." />
          <ol className="steps">
            <li>
              <span className="mono small muted">01</span>
              <h3>ServiceM8 Starter or above</h3>
              <p className="body" style={{ fontSize: 15.5 }}>
                The Free plan has no API access, so the systems can&apos;t talk to it. Starter is enough for everything on this page.
              </p>
            </li>
            <li>
              <span className="mono small muted">02</span>
              <h3>An API key</h3>
              <p className="body" style={{ fontSize: 15.5 }}>
                You make it in your ServiceM8 account and paste it into the system&apos;s settings. I show you where on the visit. It never goes in an email or a message.
              </p>
            </li>
            <li>
              <span className="mono small muted">03</span>
              <h3>Your usual way of working</h3>
              <p className="body" style={{ fontSize: 15.5 }}>
                Job statuses, the diary and invoices stay exactly as you use them now. The system follows ServiceM8, not the other way round.
              </p>
            </li>
          </ol>
          <p className="small muted" style={{ marginTop: 20 }}>
            Not on ServiceM8? I can set it up and move your customers across, or check what your current software allows before you spend anything.
          </p>
        </div>
      </section>

      <section id="integrations" className="section">
        <div className="wrap">
          <SectionHead kicker="Also connected" title="The other pieces my systems talk to." />
          <IntegrationsGrid />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
