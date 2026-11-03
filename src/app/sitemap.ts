import type { MetadataRoute } from 'next';
import { BLOG_ITEM, CONTACT_ITEM, PAGES, START_ITEM } from '@/lib/menu';
import { SITE_URL } from '@/lib/site';
import { POSTS } from '@/content/blog/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
    ...[...PAGES, START_ITEM, BLOG_ITEM, CONTACT_ITEM].map((m) => ({ url: `${SITE_URL}${m.href}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...POSTS.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.date, changeFrequency: 'yearly' as const, priority: 0.6 })),
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
