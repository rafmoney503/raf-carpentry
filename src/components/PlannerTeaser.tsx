import Image from 'next/image';
import Link from 'next/link';
import { PLANNER_ALT, PLANNER_HREF, PLANNER_IMAGE, PLANNER_IMAGE_SQUARE } from '@/lib/planner-picture';

/* The way into the wardrobe planner (/wardrobe-planner), with a picture of the planner itself (src/lib/planner-picture.ts).
   Raf asked for 'a visual miniature, a little bit big' (14 Oct 2026). Two shapes:
   - 'row': picture on the left, words on the right (home page under the 3D chips, the 3D designs pages, the phone menu)
   - 'feature': the big card at the top of the Tools page (picture on top on a phone, on the left on a computer) */

export default function PlannerTeaser({ variant = 'row', onClick, className = '' }: { variant?: 'row' | 'feature'; onClick?: () => void; className?: string }) {
  if (variant === 'feature') {
    return (
      <Link
        href={PLANNER_HREF}
        onClick={onClick}
        className={`group grid overflow-hidden rounded-sm border border-line-strong bg-mount transition-colors hover:border-accent md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] ${className}`}
      >
        <span className="relative block aspect-[4/3] overflow-hidden border-b border-line bg-paper md:border-b-0 md:border-r">
          <Image
            src={PLANNER_IMAGE}
            alt={PLANNER_ALT}
            fill
            sizes="(min-width: 1280px) 640px, (min-width: 768px) 52vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute left-3 top-3 rounded-sm border border-line-strong bg-mount px-2 py-1 font-mono text-[12px] text-ink">
            2800 × 2400 · 3 units
          </span>
        </span>
        <span className="flex flex-col justify-center p-5 md:p-8">
          <span className="font-mono text-[13px] text-accent">Free planner</span>
          <span className="mt-1.5 font-display text-[26px] font-[650] leading-[1.1] tracking-[-0.02em] transition-colors group-hover:text-accent md:text-[30px]">
            Wardrobe planner in 3D
          </span>
          <span className="mt-2.5 text-[15.5px] leading-relaxed text-muted">
            Your wall, your units, doors and colour. Turn it round in 3D, then send it to me for a quote.
          </span>
          <span className="mt-4 grid gap-1.5 text-[15px] text-ink">
            {['Standard unit widths or your own', 'Hinged or sliding doors', 'A drawing with every size'].map((t) => (
              <span key={t} className="flex items-baseline gap-2.5">
                <span aria-hidden="true" className="font-mono text-accent">
                  +
                </span>
                {t}
              </span>
            ))}
          </span>
          <span className="btn btn-primary mt-6 gap-2 self-start">
            Start planning <span aria-hidden="true">→</span>
          </span>
        </span>
      </Link>
    );
  }
  /* Sized by the space it sits in (container queries), not the screen: it goes in the hero, inside the 3D designs
     box and in the phone menu. */
  return (
    <div className={`@container ${className}`}>
      <Link
        href={PLANNER_HREF}
        onClick={onClick}
        className="group grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3.5 rounded-sm border border-line-strong bg-mount p-2 pr-4 transition-colors hover:border-accent @min-[330px]:grid-cols-[112px_minmax(0,1fr)_auto] @min-[480px]:grid-cols-[152px_minmax(0,1fr)_auto] @min-[480px]:gap-5"
      >
        <span className="relative block aspect-square overflow-hidden rounded-[2px] bg-paper">
          <Image
            src={PLANNER_IMAGE_SQUARE}
            alt=""
            fill
            sizes="(min-width: 640px) 152px, 112px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
          <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-mount px-1.5 py-px font-mono text-[11px] font-semibold text-ink">3D</span>
        </span>
        <span className="min-w-0">
          <span className="block font-mono text-[12.5px] text-accent">Free planner</span>
          <span className="mt-1 block text-[17px] font-[650] leading-snug transition-colors group-hover:text-accent @min-[480px]:text-[19px]">
            Plan your own wardrobe in 3D
          </span>
          <span className="mt-1 block text-[14px] leading-snug text-muted @min-[480px]:text-[15px]">Your sizes, units and doors. Then send it to me.</span>
        </span>
        <span aria-hidden="true" className="hidden text-accent transition-transform group-hover:translate-x-1 @min-[330px]:block">
          →
        </span>
      </Link>
    </div>
  );
}
