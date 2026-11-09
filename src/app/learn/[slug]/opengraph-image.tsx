import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { GUIDES, guideBySlug } from '@/lib/learn';

/* The preview when a Learn guide is shared: its title on the drawing paper, with a still of one of its drawings. */
export const alt = 'A step-by-step guide from Raf Carpentry, with moving drawings.';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  return ogCard({
    kicker: `Learn · ${g ? g.steps.length : ''} steps`,
    title: g?.title ?? 'Learn to fix it yourself',
    sub: g?.card,
    photo: g?.still,
  });
}
