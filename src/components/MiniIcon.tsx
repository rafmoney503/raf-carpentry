import Image from 'next/image';

/* Small square pictures for links that sit under the wardrobe planner (phone menu, the Tools menu panel and the
   Tools page). Build It in 3D uses the icon of its own website (public/images/build-it-in-3d/icon.svg, a copy of
   builditin3d's src/app/icon.svg). Drawings and cut lists has its own app-style icon (Raf picked option 1 of three
   on 6 Nov 2026: a drawing sheet with a wardrobe, its width in blue, the cut list beside it and a pencil, on a dark
   tile); a new file name if it's ever redrawn, so no old copy is served. */

export type MiniIconKind = 'drawings' | 'builditin3d';

export const BUILD_IT_IN_3D_ICON = '/images/build-it-in-3d/icon.svg';
export const DRAWINGS_ICON = '/images/drawings/icon-450f40d2.svg';

export default function MiniIcon({ kind, size }: { kind: MiniIconKind; size: number }) {
  const src = kind === 'builditin3d' ? BUILD_IT_IN_3D_ICON : DRAWINGS_ICON;
  return <Image src={src} alt="" width={size} height={size} unoptimized className="block h-full w-full" />;
}
