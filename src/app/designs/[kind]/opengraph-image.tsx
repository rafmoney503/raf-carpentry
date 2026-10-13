import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { kindWords } from '@/lib/design-kinds';
import { getLibraryItems, libraryKinds } from '@/lib/design-library';

/* Each kind's sharing picture: its newest design's 3D still, the kind and how many. */
export const alt = 'Designs in 3D by Raf Carpentry';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return libraryKinds().map((k) => ({ kind: k.slug }));
}

export default async function Image({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const items = getLibraryItems();
  const k = libraryKinds(items).find((x) => x.slug === kind);
  if (!k) return ogCard({ kicker: 'Designs in 3D', title: 'Find something like yours, in 3D' });
  const first = items.find((i) => i.kinds.includes(k.slug));
  return ogCard({ kicker: 'Designs in 3D · London', title: `${k.label} in 3D`, sub: `${k.count} ${kindWords(k)} to turn round and open up`, photo: first?.model.poster.src });
}
