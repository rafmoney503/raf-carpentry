import type { Metadata } from 'next';
import './globals.css';
import LayoutShell from '@/components/LayoutShell';

export const metadata: Metadata = {
  title: 'Raf Carpentry — Craftsmanship Meets Technology',
  description: 'Bespoke carpentry, Cabinetos cut-list app, SketchUp expertise, and a workshop journal. Based in London.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
