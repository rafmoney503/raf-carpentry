import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { pageMeta } from '@/lib/seo';
import ReadingsList from './readings-list';

/* Your readings (22 Oct 2026): what was saved with Save on the spirit level, kept in the visitor's own browser
   (src/lib/readings.ts). Sent on WhatsApp or copied from here. Different in every browser, so not for Google;
   linked from the level (its top bar, the Save sheet and the start card). No floating buttons (LayoutShell): the
   send bar sits at the bottom. */

export const metadata: Metadata = {
  ...pageMeta({
    title: 'Your readings | Raf Carpentry',
    description: 'Readings you saved with the free spirit level, by place. Send them on WhatsApp or copy them.',
    path: '/tools/readings',
  }),
  robots: { index: false, follow: true },
};

export default function ReadingsPage() {
  return (
    <Container className="pt-6 md:pt-12">
      <div className="mx-auto max-w-[720px]">
        <nav aria-label="Breadcrumb" className="mb-3 font-mono text-[13px] text-faint">
          <Link href="/tools" className="transition-colors hover:text-accent">Tools</Link>
          <span className="px-2 text-line-strong">/</span>
          <Link href="/tools/spirit-level" className="transition-colors hover:text-accent">Spirit level</Link>
          <span className="px-2 text-line-strong">/</span>
          <span>Your readings</span>
        </nav>
        <h1 className="font-display text-[34px] font-[680] leading-none tracking-[-0.03em] md:text-[44px]">Your readings</h1>
        <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-muted">
          Every Save from the spirit level lands here, by place. They&apos;re kept in this browser only, until you send them on.
        </p>
        <ReadingsList />
      </div>
    </Container>
  );
}
