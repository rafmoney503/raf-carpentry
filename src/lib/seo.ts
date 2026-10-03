import type { Metadata } from 'next';
import { EMAIL, GOOGLE_REVIEWS_URL, SOCIAL_URLS } from './site';

/* Titles, descriptions and link previews (WhatsApp, Facebook, Google) in one place.
   The preview pictures themselves are the opengraph-image.tsx files next to the pages
   (src/lib/og-card.tsx draws them), so every page and every new job or post gets one. */

export const SITE_URL = 'https://www.rafcarpentry.com';
export const SITE_NAME = 'Raf Carpentry';

export function pageMeta({
  title,
  description,
  path,
  type = 'website',
  publishedTime,
  ownImage = false,
}: {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  /* true when the page has its own opengraph-image.tsx (home, jobs, posts, Plan your project) */
  ownImage?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'en_GB',
      type,
      ...(publishedTime ? { publishedTime } : {}),
      // Pages without a card of their own share the site-wide one (src/app/opengraph-image.tsx).
      // A page that sets images here would hide its own opengraph-image file, hence ownImage.
      ...(ownImage ? {} : { images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Raf Carpentry: fitted furniture in London' }] }),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/* What Google reads about the business: the same name, address and phone as the Google
   Business Profile, so the two match. Hours are the ones on that profile. */
export const businessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HomeAndConstructionBusiness',
  '@id': `${SITE_URL}/#business`,
  name: SITE_NAME,
  description:
    'Fitted wardrobes, alcove units, bookcases, window seats, panelling and built-in furniture across London. Every job is drawn in 3D before a board is cut.',
  url: SITE_URL,
  telephone: '+447792860221',
  email: EMAIL,
  image: `${SITE_URL}/images/projects/IMG_8405.jpg`,
  logo: `${SITE_URL}/images/r-logo-final.png`,
  founder: { '@type': 'Person', name: 'Rafal Janczy' },
  address: {
    '@type': 'PostalAddress',
    streetAddress: '14 Kings Road',
    addressLocality: 'London',
    postalCode: 'N22 5SN',
    addressCountry: 'GB',
  },
  geo: { '@type': 'GeoCoordinates', latitude: 51.6014454, longitude: -0.1104532 },
  areaServed: { '@type': 'City', name: 'London' },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:00', closes: '18:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '07:00', closes: '15:00' },
  ],
  hasMap: GOOGLE_REVIEWS_URL,
  sameAs: [...SOCIAL_URLS, GOOGLE_REVIEWS_URL],
};

/* Safe to drop into a <script type="application/ld+json">. */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
