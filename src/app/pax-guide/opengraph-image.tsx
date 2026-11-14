import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

export const alt = 'IKEA PAX, built in: the fitting guide by Raf Carpentry';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'A fitter’s guide · PDF',
    title: 'IKEA PAX, built in.',
    sub: 'Make flat-pack PAX look made to measure. The sums done.',
    photo: '/images/pax-guide/og-cover-e693a25e.jpg',
  });
}
