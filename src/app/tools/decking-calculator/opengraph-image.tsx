import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

/* The preview when the decking calculator is shared. The picture is the calculator's own drawing of its starting
   deck (3.5 × 3.0 m, composite), taken from the page as an iPhone 13 (7 Nov 2026); a new file name if retaken. */
export const alt = 'Decking calculator, a free tool from Raf Carpentry: how many boards, joists, clips and screws your deck takes, with a plan drawn to scale.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Free tool',
    title: 'Decking calculator',
    sub: 'How many boards, joists, clips and screws your deck takes, with a plan drawn to scale.',
    photo: '/images/tools/decking-calculator-4fcbb9c1.jpg',
  });
}
