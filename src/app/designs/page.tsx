import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import DesignsPage from './designs-page';

export const metadata: Metadata = pageMeta({
  title: 'Designs in 3D: fitted wardrobes, alcoves, desks and more | Raf Carpentry',
  description: 'Real jobs drawn in SketchUp. Pick what you are planning, turn a design round and open the doors on your phone, then get yours drawn to your own room.',
  path: '/designs',
  ownImage: true,
});

export default function Page() {
  return <DesignsPage />;
}
