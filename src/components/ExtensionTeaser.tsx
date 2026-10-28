import Image from 'next/image';
import Link from 'next/link';
import PlannerClip from '@/components/PlannerClip';
import {
  EXTENSION_CLIP_SQUARE,
  EXTENSION_CLIP_WIDE,
  EXTENSION_HREF,
  EXTENSION_STILL_SQUARE,
  EXTENSION_STILL_WIDE,
} from '@/lib/extension-clip';
import './extension.css';

/* The way to CabinetOS Units, my extension for SketchUp (28 Oct 2026, Raf: 'the cabinetos extension in SketchUp
   should be more prominent and more visual and be seen'), in its dark blueprint look with the moving drawing of units
   building themselves (src/lib/extension-clip.ts; the still stays when the video can't play or for less motion).
   - 'row': the square clip beside a few words (home page, under the CabinetOS band's link)
   - 'feature': the big card (Tools page, CabinetOS page)
   It goes to the extension's section on the SketchUp page, or with `external` to its own page on cabinetos.co.uk. */

const POINTS = ['Every CabinetOS unit, at its cut sizes', 'Doors open, drawers slide out', 'Sent to CabinetOS for the cut list'];

export default function ExtensionTeaser({
  variant = 'row',
  href = EXTENSION_HREF,
  external = false,
  className = '',
}: {
  variant?: 'row' | 'feature';
  href?: string;
  external?: boolean;
  className?: string;
}) {
  const ext = external ? { target: '_blank', rel: 'noopener' } : {};
  const arrow = external ? '↗' : '→';

  if (variant === 'feature') {
    return (
      <Link
        href={href}
        {...ext}
        className={`xt group relative grid overflow-hidden rounded-sm md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] ${className}`}
      >
        <span aria-hidden="true" className="xt-corner tl" />
        <span aria-hidden="true" className="xt-corner tr" />
        <span aria-hidden="true" className="xt-corner bl" />
        <span aria-hidden="true" className="xt-corner br" />
        <span className="block p-4 pb-1 md:p-6 md:pr-2">
          <span className="xt-frame block">
            <span className="relative block aspect-[4/3] overflow-hidden">
              <Image
                src={EXTENSION_STILL_WIDE}
                alt=""
                fill
                sizes="(min-width: 1280px) 640px, (min-width: 768px) 52vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <PlannerClip {...EXTENSION_CLIP_WIDE} className="transition-transform duration-500 group-hover:scale-[1.03]" />
              <span className="xt-tag">SketchUp · CabinetOS Units</span>
            </span>
          </span>
        </span>
        <span className="flex flex-col justify-center p-5 pt-4 md:p-8">
          <span className="xt-new">
            <b>New</b> My extension for SketchUp
          </span>
          <span className="mt-2.5 font-display text-[26px] font-[650] leading-[1.1] tracking-[-0.02em] md:text-[30px]">
            Draw a wardrobe <span className="xt-hi">in a minute</span>
          </span>
          <span className="xt-sub mt-2.5 text-[15.5px] leading-relaxed">
            Pick a unit and type the sizes. It&apos;s drawn board by board in SketchUp, at the sizes CabinetOS cuts.
          </span>
          <span className="mt-4 grid gap-1.5 text-[15px]">
            {POINTS.map((t) => (
              <span key={t} className="flex items-baseline gap-2.5">
                <span aria-hidden="true" className="xt-hi font-mono">
                  +
                </span>
                {t}
              </span>
            ))}
          </span>
          <span className="btn xt-btn mt-6 gap-2 self-start">
            See my extension <span aria-hidden="true">{arrow}</span>
          </span>
        </span>
      </Link>
    );
  }

  /* Sized by the space it sits in (container queries), like the wardrobe planner's row. */
  return (
    <div className={`@container ${className}`}>
      <Link
        href={href}
        {...ext}
        className="xt group grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3.5 rounded-sm p-2 pr-4 @min-[330px]:grid-cols-[112px_minmax(0,1fr)_auto] @min-[440px]:grid-cols-[136px_minmax(0,1fr)_auto] @min-[440px]:gap-5"
      >
        <span className="relative block aspect-square overflow-hidden rounded-[2px] bg-[#fbfbf9]">
          <Image
            src={EXTENSION_STILL_SQUARE}
            alt=""
            fill
            sizes="(min-width: 640px) 136px, 112px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
          <PlannerClip {...EXTENSION_CLIP_SQUARE} className="transition-transform duration-500 group-hover:scale-[1.05]" />
        </span>
        <span className="min-w-0 py-1">
          <span className="xt-new">
            <b>New</b> for SketchUp
          </span>
          <span className="mt-1.5 block text-[17px] font-[650] leading-snug @min-[440px]:text-[19px]">
            My extension: draw a wardrobe <span className="xt-hi">in a minute</span>
          </span>
          <span className="xt-sub mt-1 hidden text-[14px] leading-snug @min-[330px]:block">
            Units built board by board, then sent to CabinetOS for the cut list.
          </span>
        </span>
        <span aria-hidden="true" className="xt-hi hidden text-[20px] transition-transform group-hover:translate-x-1 @min-[330px]:block">
          {arrow}
        </span>
      </Link>
    </div>
  );
}
