import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

/* The preview when the simple calculator is shared: the calculator itself on an iPhone 13 after 600 − 36 =
   (taken from the page with Playwright, 7 Nov 2026). A new file name if it's ever retaken. */
export const alt = 'Simple calculator from Raf Carpentry: big keys and a big display, free on your phone or computer.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Free tool',
    title: 'Simple calculator',
    sub: 'Big keys and a big display, on your phone or computer. A night look for dark mode.',
    photo: '/images/tools/calculator-1f5bd09d.jpg',
  });
}
