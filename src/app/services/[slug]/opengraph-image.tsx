import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { coverFor, getService, getServices, jobsFor, areasFor, joinAreas } from '@/lib/services';

/* Each service's sharing picture: the newest job's photo, the service name and where the jobs were. */
export const alt = 'A service from Raf Carpentry';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getServices().map((s) => ({ slug: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return ogCard({ kicker: 'Services', title: 'Fitted furniture across London' });
  const jobs = jobsFor(s);
  const areas = areasFor(jobs);
  return ogCard({
    kicker: `Services · London`,
    title: s.name,
    sub: jobs.length ? `${jobs.length} jobs, in ${joinAreas(areas, 3)}.` : s.summary,
    photo: coverFor(s, jobs),
  });
}
