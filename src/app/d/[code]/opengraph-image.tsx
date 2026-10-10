import { ogCard, ogContentType, ogSize } from '@/lib/og-card';
import { getAllDesigns, getDesign } from '@/lib/designs';

/* The link preview when Raf sends a design on WhatsApp: the still of the first option's model. */
export const alt = 'A 3D design by Raf Carpentry';
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getAllDesigns().map((d) => ({ code: d.code }));
}

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = getDesign(code);
  if (!d) return ogCard({ kicker: 'Your design', title: 'Fitted furniture in 3D' });
  return ogCard({ kicker: `Your design in 3D · ${d.area}`, title: d.title, sub: 'Turn it round and open the doors', photo: d.options[0].model.poster.src });
}
