import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

export const alt = 'Furniture drawings and cut lists, done for you, by Raf Carpentry';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Drawings and cut lists',
    title: 'Send me your sizes. Get everything to build it.',
    sub: 'Drawings, 3D views, cut list, board layout and assembly guide.',
    photo: '/images/drawings/og-whole-job-23cb697f.jpg',
  });
}
