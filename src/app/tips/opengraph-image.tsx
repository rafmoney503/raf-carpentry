import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

/* The preview when /tips (or one tip, /tips#...) is shared. */
export const alt = 'Workshop tips from Raf Carpentry: measuring alcoves, scribing, wardrobe hinges and screws.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Workshop tips',
    title: 'Workshop tips, from my own fits.',
    sub: 'Measuring alcoves, scribing to uneven walls, wardrobe door hinges and the screws I use.',
    photo: '/images/projects/alcove-units-palmers-green/cover.jpg',
  });
}
