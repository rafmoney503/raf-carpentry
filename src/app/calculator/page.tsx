import type { Metadata } from 'next';
import { Container, PageHeader } from '@/components/ui';
import CalculatorClient from './calculator-client';
import { TradeNudge } from '@/components/AlsoByMe';
import AppNudge from '@/components/AppNudge';
import './calculator.css';

export const metadata: Metadata = {
  title: 'Workshop calculator in mm | Raf Carpentry',
  description:
    'Free millimetre calculator for carpenters and DIY. Type a sum like 600 − 18 × 2 and see the answer in mm, cm and inches, and how many fit along and across a 2440 × 1220 board.',
};

export default function CalculatorPage() {
  return (
    <>
      <PageHeader
        kicker="Free workshop tool"
        title="Workshop calculator,"
        accent="in millimetres."
        lede="Type a sum like 600 − 18 × 2. The answer shows as you type, in mm, cm and inches, with how many fit along and across a full board."
      />
      <Container className="pb-24 md:pb-32">
        <CalculatorClient />
        <AppNudge bare kicker="In your pocket" text="A calculator with big keys, VAT, waste and square metres is in Workshop Tools, the free app for your phone, with hinges, drawer runners, panelling and stud walls. Works with no signal." />
      </Container>
      <TradeNudge />
    </>
  );
}
