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

const UPDATED = '13 November 2026';

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
            <li>
              WhatsApp messages come to my business number, and also reach my own job app through <b>360dialog</b>, a partner of Meta’s WhatsApp Business
              Platform, so a new enquiry goes onto my job list without me copying it across. Calls stay on my phone.
            </li>
            <li>
              My own job app keeps my notes on the job and the WhatsApp chats on my business number (the messages, and the photos and PDFs sent for up to 90
              days), in a private database in the EU (<b>Supabase</b>, Frankfurt), so my phone and computer show the same. To sort new messages and emails into
              jobs, it asks <b>Claude</b> (an AI from Anthropic) to read them, with phone numbers, email addresses and street addresses taken out first.
            </li>
            <li>If you leave an email address, you get one automatic email back with a few designs like yours. No newsletters, and I never sell or share your details for marketing.</li>
            <li>
              I keep job details for as long as the job and its paperwork need: invoices and accounts for six years, as the tax rules require. Ask me and I’ll
              delete anything I don’t have to keep.
            </li>
          </ul>
          <p>The law lets me do this because you asked for a quote (steps before a contract), to do the job we agree, and to keep records I’m required to keep.</p>

          <H>When you ask for a cut list</H>
          <p>
            If you tap Get the cut list in the <Link href="/wardrobe-planner">wardrobe planner</Link> and leave your email, I keep that email, the design you made
            (its sizes and units, no name or address) and the country your connection is in, in the same private database (<b>Supabase</b>, Frankfurt). The
            design and your email go to <b>CabinetOS</b>, my cabinet-making app (also Rafal Solutions Ltd), which works out the cut list and emails it to you
            through <b>Resend</b>, with a link that opens the design in CabinetOS if you make a free account. It’s used only for that one email: no mailing
            list. Ask me and I’ll delete it. Nothing is charged.
          </p>

          <H>When you order drawings</H>
          <p>
            If you order <Link href="/drawings">drawings and a cut list</Link>, your name, email, mobile if you give it, what you told me about the job and the
            files you send go into <b>ServiceM8</b> as an order, the same way a quote request does, and I email you about it through ServiceM8. You pay on a
            page run by <b>Stripe</b>: your card details go to Stripe, never to me or this website, and Stripe tells me only that you paid, the amount and your
            email. I keep the order and its payment as long as the law requires for accounts (six years).
          </p>

          <H>Things kept on your own phone or computer</H>
          <p>
            Some parts of the site remember things in your browser only, never sent to me: designs you save with the heart for your brief, the last few pages
            you looked at (so search can offer them again), which suggestions the small card at the bottom has already shown you (so it doesn’t
            repeat them), the calculator’s history, the sizes you last typed and the jobs you save in Workshop Tools, your stars, best scores and daily results in Workshop Games, the day you first opened Workshop Games or Workshop Tools
            from your home screen (so that first open is counted once as an install), whether you’ve seen the planner’s quick guide and which piece the little figure beside the logo made last (so the next page shows a different one). Clearing your browser’s data removes them.
          </p>

          <H id="stats">How visits are counted</H>
          <p>
            This website doesn’t put cookies on your device and has no advertising trackers. To see which pages help people and which don’t, it counts visits in two ways, both without
            your name:
          </p>
          <ul>
            <li>
              <b>Its own counter.</b> For each page (each game counts as a page in Workshop Games): which page it was and the one before it, where the visit came from (for example Google or Instagram), the
              screen size, roughly where from (the country, town or city and, in the UK, the first half of the postcode, such as N22, as your
              internet connection suggests; often only approximate), how long the page was in use, how far down it was scrolled, which part of the page the time went on, and what was tapped
              (the button or link and where on it, never anything you type). A visitor code made from your connection and browser ties together the pages of one
              day’s visit; it changes every day, and your IP address itself is never stored. Kept for 13 months, in a database in the EU (Supabase, Frankfurt).
            </li>
            <li>
              <b>Vercel Web Analytics</b> (the company that hosts the site): page views, the country, the device and where visits came from, also without cookies.
            </li>
          </ul>
          <p>
            From these counts the site sometimes shows a small card saying a job was looked at or saved for a brief lately (for example “Looked at 40
            minutes ago”). It says nothing about who that was or where they were, and never shows you your own visit.
          </p>
          <p>
            Counting visits only to improve the site is allowed without asking first, as long as you can say no easily. The switch below does that for this
            browser, and both counters also stop if your browser sends Global Privacy Control.
          </p>
          <StatsOptOut />

          <H>Who else handles the details</H>
          <p>
            Only the companies that run the tools above, under their own data protection terms: Vercel (hosting the website), Supabase (the visit counts and my job app),
            ServiceM8, Microsoft, CabinetOS, Stripe (card payments for drawings), 360dialog and Meta (WhatsApp) and Anthropic (Claude). Some of them may store data outside the UK, with the safeguards UK law requires.
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
