import Link from 'next/link';
import { Container, PageHeader } from '@/components/ui';
import { COMPANY, EMAIL, PHONE_DISPLAY, PHONE_HREF } from '@/lib/site';
import { pageMeta } from '@/lib/seo';
import StatsOptOut from './stats-opt-out';

export const metadata = pageMeta({
  title: 'Privacy | Raf Carpentry',
  description: 'What Raf Carpentry keeps when you ask for a quote, how the website counts visits without cookies, and how to opt out.',
  path: '/privacy',
});

const UPDATED = '18 October 2026';

function H({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-28 font-display text-[26px] font-[650] leading-[1.1] tracking-[-0.02em] md:text-[30px]">
      {children}
    </h2>
  );
}

export default function Privacy() {
  return (
    <>
      <PageHeader
        kicker="Privacy"
        title="What I keep, and"
        accent="why."
        lede="In plain words: what happens to your details when you ask me for a quote, and how this website counts visits without cookies."
      />
      <Container className="pb-24">
        <div className="max-w-[68ch] text-[16.5px] leading-relaxed text-muted [&_a]:text-accent [&_a]:underline [&_b]:font-semibold [&_b]:text-ink [&_li]:mt-2 [&_p]:mt-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          <p>
            Raf Carpentry is a trading name of <b>{COMPANY.name}</b> (company no. {COMPANY.number}, registered office {COMPANY.office}). I’m Rafal Janczy, and
            I’m responsible for your details. Questions about any of this: <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>.
          </p>

          <H>When you ask for a quote</H>
          <p>
            When you send me a brief (Send to Raf on <Link href="/how-it-works">Plan your project</Link> or the <Link href="/wardrobe-planner">wardrobe planner</Link>),
            message me on WhatsApp, email or call, I get what you give me: your name, mobile, email, the address or postcode of the job, what you’d like built and
            any photos or sizes you add.
          </p>
          <ul>
            <li>I use them to reply, visit, quote, draw your design, do the job and invoice it, and to ask afterwards whether you’d leave a review.</li>
            <li>
              They’re kept in the tools I run the business with: <b>ServiceM8</b> (my jobs, quotes and invoices, and the emails and texts about the job),{' '}
              <b>Microsoft 365</b> (the {EMAIL} mailbox) and, for a wardrobe planner design, <b>CabinetOS</b> (the app I draw and cut wardrobes with).
            </li>
            <li>WhatsApp messages and calls stay on my phone, in WhatsApp and my call history.</li>
            <li>If you leave an email address, you get one automatic email back with a few designs like yours. No newsletters, and I never sell or share your details for marketing.</li>
            <li>
              I keep job details for as long as the job and its paperwork need: invoices and accounts for six years, as the tax rules require. Ask me and I’ll
              delete anything I don’t have to keep.
            </li>
          </ul>
          <p>The law lets me do this because you asked for a quote (steps before a contract), to do the job we agree, and to keep records I’m required to keep.</p>

          <H>Things kept on your own phone or computer</H>
          <p>
            Some parts of the site remember things in your browser only, never sent to me: designs you save with the heart for your brief, the calculator’s
            history, your best score in the timber game and whether you’ve seen the planner’s quick guide. Clearing your browser’s data removes them.
          </p>

          <H id="stats">How visits are counted</H>
          <p>
            This website doesn’t put cookies on your device and has no advertising trackers. To see which pages help people and which don’t, it counts visits in two ways, both without
            your name:
          </p>
          <ul>
            <li>
              <b>Its own counter.</b> For each page: which page it was and the one before it, where the visit came from (for example Google or Instagram), the
              screen size, the country, how long the page was in use, how far down it was scrolled, which part of the page the time went on, and what was tapped
              (the button or link and where on it, never anything you type). A visitor code made from your connection and browser ties together the pages of one
              day’s visit; it changes every day, and your IP address itself is never stored. Kept for 13 months, in a database in the EU (Supabase, Frankfurt).
            </li>
            <li>
              <b>Vercel Web Analytics</b> (the company that hosts the site): page views, the country, the device and where visits came from, also without cookies.
            </li>
          </ul>
          <p>
            Counting visits only to improve the site is allowed without asking first, as long as you can say no easily. The switch below does that for this
            browser, and both counters also stop if your browser sends Global Privacy Control.
          </p>
          <StatsOptOut />

          <H>Who else handles the details</H>
          <p>
            Only the companies that run the tools above, under their own data protection terms: Vercel (hosting the website), Supabase (the visit counts),
            ServiceM8, Microsoft and CabinetOS. Some of them may store data outside the UK, with the safeguards UK law requires.
          </p>

          <H>Your rights</H>
          <p>
            You can ask me for a copy of what I hold about you, to correct it, to delete it, or to stop using it for anything you don’t want, by emailing{' '}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. If you’re unhappy with how I’ve handled your details, you can complain to the Information Commissioner’s
            Office at <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">ico.org.uk</a>.
          </p>

          <p className="mt-10 font-mono text-[13px] text-faint">Last updated {UPDATED}.</p>
        </div>
      </Container>
    </>
  );
}
