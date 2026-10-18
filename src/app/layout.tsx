import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './motion.css';
import LayoutShell from '@/components/LayoutShell';
import { getMenuPanels } from '@/lib/menu-panels';
import VercelAnalytics from '@/components/VercelAnalytics';
import MotionObserver from '@/components/MotionObserver';
import SiteStats from '@/components/SiteStats';

// Fonts are self-hosted from src/fonts (SIL Open Font Licence), so builds never depend on Google Fonts.
const bricolage = localFont({
  src: '../fonts/BricolageGrotesque-latin.woff2',
  variable: '--font-bricolage',
  weight: '200 800',
  display: 'swap',
});

const geist = localFont({
  src: '../fonts/Geist-latin.woff2',
  variable: '--font-geist',
  weight: '100 900',
  display: 'swap',
});

const geistMono = localFont({
  src: '../fonts/GeistMono-latin.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.rafcarpentry.com'),
  title: 'Raf Carpentry | Fitted wardrobes and built-in furniture in London',
  description:
    'Fitted wardrobes, alcove units, cupboards and garden-office fit-outs across London. Every job is drawn in 3D before a single board is cut.',
  openGraph: { siteName: 'Raf Carpentry', locale: 'en_GB', type: 'website' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>
        <LayoutShell menu={getMenuPanels()}>{children}</LayoutShell>
        {/* Plays the moving line drawings (motion.css) only while they are on screen. */}
        <MotionObserver />
        {/* Vercel Web Analytics: page views only, no cookies (not for those who opted out on /privacy). */}
        <VercelAnalytics />
        {/* The website's own visitor counter for the Job Kit's Website stats (no cookies; /privacy explains it). */}
        <SiteStats />
      </body>
    </html>
  );
}
