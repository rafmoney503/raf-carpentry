import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { getLibraryItems } from '@/lib/design-library';

/* The sharing picture for /designs: the newest job's 3D still. */
export const alt = 'Designs in 3D by Raf Carpentry';
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  const items = getLibraryItems();
  return ogCard({ kicker: 'Designs in 3D · London', title: 'Find something like yours, in 3D', sub: `${items.length} real jobs to turn round and open up`, photo: items[0]?.model.poster.src });
}
