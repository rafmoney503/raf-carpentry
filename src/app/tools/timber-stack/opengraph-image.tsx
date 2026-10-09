import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

/* The preview when the game (or someone's score) is shared. */
export const alt = 'Timber Stack, a free game from Raf Carpentry: drop each board, whatever hangs over gets cut off.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Free game',
    title: 'Timber Stack',
    sub: 'Drop each board on the stack. Whatever hangs over gets cut off. How high can you go?',
    photo: '/images/tools/timber-stack.jpg',
  });
}
