import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getAllProjects } from '@/lib/projects';
import { getAllPosts } from '@/lib/blog';

/* Every public page, job and blog post, for Google. New jobs and posts are added automatically. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/portfolio', '/how-it-works', '/blog', '/about', '/contact', '/sketchup', '/cabinetos', '/tools', '/calculator'];
  const date = (v: unknown) => {
    const d = new Date(v instanceof Date ? v : String(v));
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'monthly' as const, priority: p === '' ? 1 : p === '/how-it-works' || p === '/portfolio' ? 0.9 : 0.6 })),
    ...getAllProjects().map((p) => ({ url: `${SITE_URL}/portfolio/${p.slug}`, lastModified: date(`${p.finished}-28`), changeFrequency: 'yearly' as const, priority: 0.8 })),
    ...getAllPosts().map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: date(p.date), changeFrequency: 'yearly' as const, priority: 0.6 })),
  ];
}
