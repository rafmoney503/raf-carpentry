import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { GUIDES } from '@/lib/learn';

/* The preview when /learn is shared. */
export const alt = 'Learn to fix it yourself: step-by-step guides with moving drawings, from Raf Carpentry.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Learn · free guides',
    title: 'Fix it yourself, step by step.',
    sub: 'Moving drawings act out each step: hanging heavy things on any wall, French cleats and more.',
    photo: GUIDES[0]?.still,
  });
}
