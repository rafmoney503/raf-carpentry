import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

/* The preview when the spirit level is shared. The picture is the level itself on a phone, set to zero
   (made from the page with Playwright, 17 Oct 2026). */
export const alt = 'Spirit level on your phone, a free tool from Raf Carpentry: set zero on any surface, then read the angle and the mm to pack.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Free tool',
    title: 'Spirit level on your phone',
    sub: 'Set zero on any surface, so the buttons and the case don’t matter. Then read the angle and the mm to pack.',
    photo: '/images/tools/spirit-level.jpg',
  });
}
