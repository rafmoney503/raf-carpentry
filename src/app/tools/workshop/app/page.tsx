import type { Metadata, Viewport } from 'next';
import QRCode from 'qrcode';
import { SITE_URL } from '@/lib/seo';
import WorkshopApp from './workshop-app';

/* Workshop Tools, the app itself (25 Oct 2026). What a phone opens from its home screen (start_url in
   public/workshop-tools.webmanifest). Its page, with how to install it, is /tools/workshop; rafcarpentry.com/app
   goes there (next.config.ts). Not in Google: the page is. */

export const metadata: Metadata = {
  title: 'Workshop Tools | Raf Carpentry',
  description: 'Free setting-out tools for carpenters: hinges, drawer runners, unit sizes, panelling, flooring, stud walls, a calculator and mm to inches. Works with no signal.',
  alternates: { canonical: '/tools/workshop' },
  robots: { index: false, follow: true },
  manifest: '/workshop-tools.webmanifest',
  appleWebApp: { capable: true, title: 'Workshop Tools', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#f1f2ef',
};

export default async function WorkshopAppPage() {
  // for the spirit level on a computer: open the app on a phone instead
  const qrSvg = await QRCode.toString(`${SITE_URL}/app?utm_source=qr-level`, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#16191c', light: '#fbfbf9' },
  });
  return <WorkshopApp qrSvg={qrSvg} />;
}
