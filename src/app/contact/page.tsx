import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';
import ContactForm from '@/components/ContactForm';
import { SectionHead } from '@/components/blocks';
import { CONTACT_ITEM } from '@/lib/menu';
import { ADDRESS, EMAIL, PHONE_DISPLAY, PHONE_HREF, whatsappUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Tell Rafal what slows your business down. Your message goes straight into his ServiceM8 as a job.',
  alternates: { canonical: '/contact' },
};

export default function Contact() {
  return (
    <>
      <PageHeader item={CONTACT_ITEM} title="Tell me what slows you down." lead="One job, one annoying evening, one thing you type twice. That's enough to start." />

      <section id="form" className="contact" data-hide-pill>
        <div className="wrap contact-row">
          <div className="contact-text">
            <p className="kicker">Send a message</p>
            <h2 className="h2" style={{ color: '#fff' }}>
              Straight into my <span style={{ color: 'var(--hl)' }}>ServiceM8.</span>
            </h2>
            <p>It lands as a job, the same way the systems I build work, and you see exactly what happened once you press send.</p>
          </div>
          <div className="contact-form">
            <ContactForm />
          </div>
        </div>
      </section>

      <section id="details" className="section white">
        <div className="wrap">
          <SectionHead kicker="Phone and WhatsApp" title="Rather talk?" />
          <div className="three">
            <a className="card card-link" href={PHONE_HREF}>
              <span className="kicker">Phone</span>
              <b className="h3 mono" style={{ fontSize: 22 }}>
                {PHONE_DISPLAY}
              </b>
              <span className="small muted">If I&apos;m on site, leave a message or WhatsApp me.</span>
            </a>
            <a className="card card-link" href={whatsappUrl('Hi Rafal, I found you on rafalsolutions.co.uk. ')} target="_blank" rel="noopener">
              <span className="kicker">WhatsApp</span>
              <b className="h3" style={{ fontSize: 22 }}>
                Message me
              </b>
              <span className="small muted">Opens WhatsApp with the first line typed in.</span>
            </a>
            <a className="card card-link" href={`mailto:${EMAIL}`}>
              <span className="kicker">Email</span>
              <b className="h3 mono" style={{ fontSize: 18, wordBreak: 'break-word' }}>
                {EMAIL}
              </b>
              <span className="small muted">{ADDRESS}</span>
            </a>
          </div>
        </div>
      </section>

      <section id="next-steps" className="section">
        <div className="wrap">
          <SectionHead kicker="What happens next" title="After you press send." />
          <ol className="steps">
            <li>
              <span className="mono small muted">01</span>
              <h3>I read it</h3>
              <p className="body" style={{ fontSize: 15.5 }}>
                It&apos;s at the top of my phone&apos;s Today list. I come back with one question or a first sketch.
              </p>
            </li>
            <li>
              <span className="mono small muted">02</span>
              <h3>Half a day with you</h3>
              <p className="body" style={{ fontSize: 15.5 }}>
                On site or in the van, watching how the job really runs. You get a fixed price after this.
              </p>
            </li>
            <li>
              <span className="mono small muted">03</span>
              <h3>A mockup in 2 days</h3>
              <p className="body" style={{ fontSize: 15.5 }}>
                On your own phone, to try and change before anything is built.
              </p>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
