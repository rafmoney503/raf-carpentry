import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import Thanks from './thanks';

/* Where Stripe sends someone after buying the IKEA PAX guide (?session_id=...), and where the emailed link goes.
   It asks /api/pax-guide/order until Stripe's webhook has recorded the sale, then offers the download
   (src/lib/guide-sales.ts). ?err= comes back from the download: limit, link or busy. */
export const metadata: Metadata = { title: 'Your guide | Raf Carpentry', robots: { index: false, follow: false } };

export default function GuideThanksPage() {
  return (
    <Container className="pb-20 pt-12 md:pb-28 md:pt-20">
      <Thanks />
    </Container>
  );
}
