import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/space-grotesk/index.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'HQ · Rafal Solutions',
  description: 'Every app’s numbers in one place.',
  robots: { index: false, follow: false },
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'HQ', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(max-width: 1023px)', color: '#f3f2ee' },
    { media: '(min-width: 1024px)', color: '#0f1114' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
