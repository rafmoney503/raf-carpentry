import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

/* Default sharing picture for every page that has no picture of its own. */
export const alt = 'Raf Carpentry: fitted wardrobes and built-in furniture in London';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Fitted furniture · London',
    title: 'Fitted furniture, made to the millimetre.',
    sub: 'Wardrobes, alcove units and built-ins, drawn in 3D before a board is cut.',
    photo: '/images/projects/IMG_8405.jpg',
  });
}
