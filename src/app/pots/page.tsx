import type { Metadata, Viewport } from 'next';
import PotsLauncher from './pots-launcher';

/* Money pots launcher (29 Oct 2026, Raf: 'can we create better screen icon than standard, make it stand out a lot').
   Money pots is a private claude.ai artifact (Rafal Solutions' money and deadlines app); a page added to an iPhone's
   home screen takes its icon from its own site, so a claude.ai link would show Claude's icon. This page carries the
   Money pots icon (apple-icon.png here, the mint £ over a cut board) and sends the phone on to the app. Visiting
   /pots shows how to add it; the address becomes /pots?go=1 straight away, so the home screen icon saved from here
   opens /pots?go=1, which goes straight to the app. Opens in Safari (manifest display "browser"), where Raf is
   signed in to Claude. Not linked anywhere, not in Google, not counted in the visit stats. */

export const metadata: Metadata = {
  title: 'Money pots',
  description: 'Rafal Solutions Ltd: what to put aside, what you can spend, and every deadline.',
  robots: { index: false, follow: false },
  manifest: '/money-pots.webmanifest',
  appleWebApp: { title: 'Money pots' },
};

export const viewport: Viewport = { themeColor: '#22c88c' };

export default function PotsPage() {
  return <PotsLauncher />;
}
