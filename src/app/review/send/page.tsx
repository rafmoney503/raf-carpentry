import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { getAllProjects } from '@/lib/projects';
import SendClient from './send-client';

/* Raf's own tool (not linked anywhere, not in Google): type the client's first name and mobile,
   and it opens WhatsApp (or Messages) with the review request already written. Nothing typed
   here is saved; it only goes into the message. Saved to his phone's home screen it opens like an app. */

export const metadata: Metadata = {
  title: 'Ask for a review | Raf Carpentry',
  robots: { index: false, follow: false },
  appleWebApp: { title: 'Ask for review' },
};

export default function SendReviewPage() {
  // Job titles as suggestions for "what you made", e.g. "floating walnut desk with hidden drawers".
  const jobs = [...new Set(getAllProjects().map((p) => p.title.charAt(0).toLowerCase() + p.title.slice(1)))];
  return (
    <Container className="py-10 md:py-16">
      <div className="mx-auto max-w-[560px]">
        <p className="kicker">For Raf</p>
        <h1 className="mt-2 font-display text-[34px] font-[680] leading-[1.05] tracking-[-0.025em] md:text-[44px]">Ask for a review</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          Fill in the client, check the message, press send. The link opens a thank-you page with a big Google review button.
        </p>
        <SendClient jobs={jobs} />
      </div>
    </Container>
  );
}
