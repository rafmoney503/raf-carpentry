import guide from '../../content/pages/pax-guide.json';

/* "IKEA PAX, built in", the £9.99 PDF guide: its price, Stripe Payment Link and pictures in one place, for the
   guide's own page (/pax-guide) and its card on the Tools page. The price, link and page count are in
   content/pages/pax-guide.json. New picture files get new names (the hash), so change them here. */

export const PAX_GUIDE = {
  price: guide.price,
  buyUrl: guide.buyUrl.trim(),
  pages: guide.pages,
  href: '/pax-guide',
  // The cover (light since 16 Nov 2026, Raf: "i like the lighter picture like the one on the right") and page 4.
  cover: '/images/pax-guide/page-01-ce21b9cc.webp',
  page4: '/images/pax-guide/page-04-589aa262.webp',
};
