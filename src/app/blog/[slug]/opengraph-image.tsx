import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { getAllPosts } from '@/lib/blog';

/* Each blog post's sharing picture: its top photo and title. */
export const alt = 'A post from the Raf Carpentry journal';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getAllPosts().find((p) => p.slug === slug);
  return ogCard({
    kicker: 'Workshop journal',
    title: post?.title ?? 'The Workshop Journal',
    photo: post?.image,
  });
}
