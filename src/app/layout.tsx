import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { ADDRESS, COMPANY, COMPANY_NO, PHONE_DISPLAY, SITE_URL, CABINETOS_URL, RAFCARPENTRY_URL } from '@/lib/site';

/* The same three families as rafcarpentry.com. next/font downloads them at build time and serves them from this
   site, so visitors never load anything from Google. */
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['500', '700'], display: 'swap' });
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', weight: ['400', '500'], display: 'swap' });

const title = 'Rafal Solutions: systems for trade businesses, built by a carpenter';
const description =
  'Quoting, enquiries, diary, payments and reviews on your phone, connected to ServiceM8. Built and tested on a real London carpentry business. Mockup in 2 days.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: '%s | Rafal Solutions' },
  description,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: SITE_URL, siteName: 'Rafal Solutions', title, description, locale: 'en_GB' },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f6f3',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'Rafal Solutions',
  legalName: COMPANY,
  url: SITE_URL,
  telephone: PHONE_DISPLAY.replace(/^0/, '+44 '),
  identifier: `UK Company No. ${COMPANY_NO}`,
  address: { '@type': 'PostalAddress', streetAddress: '14 Kings Road', addressLocality: 'London', postalCode: 'N22 5SN', addressCountry: 'GB' },
  areaServed: 'GB',
  founder: { '@type': 'Person', name: 'Rafal Janczy' },
  sameAs: [CABINETOS_URL, RAFCARPENTRY_URL],
  description: `${description} ${ADDRESS}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Analytics />
      </body>
    </html>
  );
}
