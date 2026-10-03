import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { formatMonth, getAllProjects, getProject } from '@/lib/projects';

/* Each job's sharing picture: its main photo, title, type, area and month. */
export const alt = 'A job by Raf Carpentry';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getAllProjects().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return ogCard({ kicker: 'My work', title: 'Fitted furniture across London' });
  return ogCard({
    kicker: `${p.type} · ${p.area}`,
    title: p.title,
    sub: `Finished ${formatMonth(p.finished)}`,
    photo: p.cover.src,
  });
}
