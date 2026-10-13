import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { areaPages, getAreaPage } from '@/lib/areas';

/* Each area page's sharing picture: the newest job's photo there, the area and how many jobs. */
export const alt = 'Fitted furniture by Raf Carpentry in a London area';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return areaPages().map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getAreaPage(slug);
  if (!a) return ogCard({ kicker: 'Where I work', title: 'Fitted furniture across London' });
  return ogCard({
    kicker: a.postcode ? `Where I work · ${a.postcode}` : 'Where I work',
    title: `Fitted furniture in ${a.name}`,
    sub: `${a.jobs.length} jobs with photos and 3D models.`,
    photo: a.jobs[0]?.cover.src,
  });
}
