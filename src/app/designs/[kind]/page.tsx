import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { kindWords } from '@/lib/design-kinds';
import { libraryKinds } from '@/lib/design-library';
import { pageMeta } from '@/lib/seo';
import DesignsPage from '../designs-page';

/* One kind of piece in 3D, e.g. rafcarpentry.com/designs/wardrobes: the link to send someone who wants a wardrobe. */
export const dynamicParams = false;

export function generateStaticParams() {
  return libraryKinds().map((k) => ({ kind: k.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  const k = libraryKinds().find((x) => x.slug === kind);
  if (!k) return {};
  return pageMeta({
    title: `${k.label} in 3D | Raf Carpentry`,
    description: `${k.count} ${kindWords(k)} I’ve built in London, drawn in SketchUp. Turn one round and open it up on your phone, then get yours drawn to your own room.`,
    path: `/designs/${k.slug}`,
    ownImage: true,
  });
}

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!libraryKinds().some((k) => k.slug === kind)) notFound();
  return <DesignsPage kind={kind} />;
}
