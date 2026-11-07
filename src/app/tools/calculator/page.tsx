import type { Viewport } from 'next';
import { pageMeta } from '@/lib/seo';
import BasicCalculator from './basic-calculator';
import './basic-calculator.css';

/* The simple calculator (7 Nov 2026, Raf: "very basic calculator ... big digits and smaller plus minus etc on right
   side with big display"; mockup C2, with C3 for night mode). Full screen, like an app: no menu, footer or floating
   buttons (LayoutShell). The workshop calculator in mm stays at /calculator. */

export const metadata = pageMeta({
  title: 'Simple calculator with big keys | Free from Raf Carpentry',
  description: 'A free, simple calculator with big keys and a big display. Add, take away, times and divide, on your phone or computer. Night look for dark mode.',
  path: '/tools/calculator',
  ownImage: true,
});

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1f2ef' },
    { media: '(prefers-color-scheme: dark)', color: '#121518' },
  ],
};

export default function CalculatorPage() {
  return <BasicCalculator />;
}
