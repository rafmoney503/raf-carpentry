import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { APP_SCREENS } from '@/lib/workshop-tools/site';

/* The preview when the Workshop Tools page (or rafcarpentry.com/app) is shared: the top of the app's home screen
   (taken from the app with Playwright, 25 Oct 2026). */
export const alt = 'Workshop Tools, a free carpentry app for your phone from Raf Carpentry: hinges, drawers, panelling, flooring and stud walls in mm.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Free app · iPhone and Android',
    title: 'Workshop Tools',
    sub: 'Hinges, drawer runners, panelling, flooring and stud walls, in mm. Works with no signal on site.',
    photo: APP_SCREENS.og,
  });
}
