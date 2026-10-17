import type { MetadataRoute } from 'next';
import { CONTACT_ITEM, MENU } from '@/lib/menu';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
    ...[...MENU, CONTACT_ITEM].map((m) => ({ url: `${SITE_URL}${m.href}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
