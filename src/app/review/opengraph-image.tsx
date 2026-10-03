import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

/* The preview a client sees in WhatsApp when Raf sends the review link. */
export const alt = 'Thanks for having me. Leave a quick Google review for Raf Carpentry.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Thank you',
    title: 'Thanks for having me.',
    sub: 'Happy with the work? A quick Google review helps other people find me.',
    photo: '/images/projects/birch-ply-wardrobe-chiswick/cover.jpg',
  });
}
