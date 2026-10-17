import type { Metadata } from 'next';
import { ADDRESS, COMPANY, COMPANY_NO, EMAIL, PHONE_DISPLAY } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Rafal Solutions Ltd handles the details you send through this website.',
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return (
    <main id="main" className="legal">
      <div className="wrap">
        <article>
          <a href="/" className="mono small" style={{ textUnderlineOffset: 3 }}>
            ← Rafal Solutions
          </a>
          <p className="kicker">Privacy</p>
          <h1 className="h2">How I handle your details.</h1>
          <p>
            This website is run by {COMPANY} (company number {COMPANY_NO}), {ADDRESS}. I&apos;m Rafal Janczy, a director, and I&apos;m the person who reads what you send. Questions about your details: {EMAIL} or {PHONE_DISPLAY}.
          </p>

          <h2>What I collect</h2>
          <ul>
            <li>What you type into the contact form or the &ldquo;Sketch my system&rdquo; planner: your name, business name, trade, email or mobile, your message and the choices you tap.</li>
            <li>Anonymous visit counts (pages viewed, country, device type) from Vercel Web Analytics. It uses no cookies and does not identify you.</li>
          </ul>

          <h2>Why</h2>
          <p>To reply to your enquiry and, if you ask me to, to plan and quote for a system. The legal basis is taking steps at your request before a contract, and my legitimate interest in answering people who contact me.</p>

          <h2>Where it goes</h2>
          <ul>
            <li>Your enquiry is saved as a job in ServiceM8, the job management software I use, and the emails about it are sent through ServiceM8.</li>
            <li>I may reply from my Microsoft 365 email or on WhatsApp if you give me your mobile.</li>
            <li>The website is hosted by Vercel.</li>
          </ul>
          <p>I don&apos;t sell your details, share them for marketing, or add you to a mailing list.</p>

          <h2>How long I keep it</h2>
          <p>If we don&apos;t end up working together, I delete your enquiry within 12 months. If we do, I keep business records for 6 years, as UK tax rules require.</p>

          <h2>Your rights</h2>
          <p>
            You can ask for a copy of your details, ask me to correct or delete them, or object to how I use them: email {EMAIL}. If you&apos;re not happy with my answer, you can complain to the Information Commissioner&apos;s Office at ico.org.uk.
          </p>

          <p className="small muted">Last updated 17 October 2026.</p>
        </article>
      </div>
    </main>
  );
}
