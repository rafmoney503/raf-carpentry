import type { Metadata, Viewport } from 'next';
import GamesApp from './games-app';

/* Workshop Games, the app itself (25 Oct 2026). What a phone opens from its home screen (start_url in
   public/workshop-games.webmanifest). Its page, with how to install it, is /tools/games; rafcarpentry.com/games
   goes there (next.config.ts). Not in Google: the page is. */

export const metadata: Metadata = {
  title: 'Workshop Games | Raf Carpentry',
  description: 'Five free games about timber, nails, tape measures and keeping things level: Measure Up, Sheet Saver, Timber Stack, Nail Pop and Level Best. New ones every day, and they work with no signal.',
  alternates: { canonical: '/tools/games' },
  robots: { index: false, follow: true },
  manifest: '/workshop-games.webmanifest',
  appleWebApp: { capable: true, title: 'Workshop Games', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#121518',
  viewportFit: 'cover',
};

export default function WorkshopGamesPage() {
  return <GamesApp />;
}
