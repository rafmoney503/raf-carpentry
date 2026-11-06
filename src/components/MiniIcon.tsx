import Image from 'next/image';
import DrawingsIcon from './DrawingsIcon';

/* Small square pictures for links that sit under the wardrobe planner (phone menu, the Tools menu panel and the
   Tools page): the drawings service gets its own line drawing, Build It in 3D the icon of its own website
   (public/images/build-it-in-3d/icon.svg, a copy of builditin3d's src/app/icon.svg). */

export type MiniIconKind = 'drawings' | 'builditin3d';

export const BUILD_IT_IN_3D_ICON = '/images/build-it-in-3d/icon.svg';

export default function MiniIcon({ kind, size }: { kind: MiniIconKind; size: number }) {
  if (kind === 'builditin3d') {
    return <Image src={BUILD_IT_IN_3D_ICON} alt="" width={size} height={size} unoptimized className="block h-full w-full" />;
  }
  return <DrawingsIcon className="block h-full w-full" />;
}
