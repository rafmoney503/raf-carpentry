import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { GAMES_SCREENS } from '@/lib/workshop-games/site';

/* The preview when the Workshop Games page (or rafcarpentry.com/games) is shared: the top of the games' home
   screen (taken from the app with Playwright, 25 Oct 2026). A shared score has its own picture (beat/card). */
export const alt = 'Workshop Games, six free carpentry games for your phone from Raf Carpentry: Measure Up, Sheet Saver, Timber Stack, Nail Pop, Level Best and Find the Difference.';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    kicker: 'Free games · iPhone and Android',
    title: 'Workshop Games',
    sub: 'Measure Up, Sheet Saver, Timber Stack, Nail Pop, Level Best and Find the Difference. New ones every day, real sizes, no adverts.',
    photo: GAMES_SCREENS.og,
  });
}
