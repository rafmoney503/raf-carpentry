import { ogCard, ogContentType, ogSize } from '@/lib/og-card';

export const alt = 'Plan your project with Raf Carpentry';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Plan your project',
    title: 'Plan your project, then send it in one message.',
    sub: 'What I need, what you get, materials, and a two-minute brief.',
    photo: '/images/projects/alcove-units-palmers-green/cover.jpg',
  });
}
