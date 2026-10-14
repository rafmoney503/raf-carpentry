import { pageMeta } from '@/lib/seo';
import WardrobePlanner from './wardrobe-planner';

/* Wardrobe planner (14 Oct 2026, Raf: 'online web configuration with standard width sizes and custom unit sizes',
   then 'add plinth height and top infill and also free standing unit'). The planner fills the screen under the
   navbar, so no floating buttons here (LayoutShell). Sending uses Send to Raf (/api/brief). */

export const metadata = pageMeta({
  title: 'Wardrobe planner | Design your fitted wardrobe | Raf Carpentry',
  description: 'Set your wall size, pick standard or custom unit widths, choose doors and a colour, see it in 3D with every size marked, then send it to Raf for a quote.',
  path: '/wardrobe-planner',
});

export default function WardrobePlannerPage() {
  return <WardrobePlanner />;
}
