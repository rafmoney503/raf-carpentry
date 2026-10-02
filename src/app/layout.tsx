import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import LayoutShell from '@/components/LayoutShell';

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
  title: 'Raf Carpentry | Fitted wardrobes and built-in furniture in London',
  description:
    'Fitted wardrobes, alcove units, cupboards and garden-office fit-outs across London. Every job is drawn in 3D before a single board is cut.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
