import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import Thanks from './thanks';

/* Where Stripe sends someone after paying for drawings (?session_id=...). The page asks /api/drawings/paid, which
   records the payment on the order's job once and sends the emails, then shows the order and the due day. */
export const metadata: Metadata = { title: 'Order received | Raf Carpentry', robots: { index: false, follow: false } };

export default function ThanksPage() {
  return (
    <Container className="pb-20 pt-12 md:pb-28 md:pt-20">
      <Thanks />
    </Container>
  );
}
